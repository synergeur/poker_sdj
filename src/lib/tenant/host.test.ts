import assert from "node:assert/strict";
import test from "node:test";

import { buildApexSignInUrl, parseRequestHost } from "./host.ts";

test("localhost is the apex", () => {
  assert.deepEqual(parseRequestHost("localhost:3000", "localhost"), { kind: "apex" });
  assert.deepEqual(parseRequestHost("www.localhost", "localhost"), { kind: "apex" });
});

test("an organization host is the tenant slug", () => {
  assert.deepEqual(parseRequestHost("casino.localhost:3000", "localhost"), {
    kind: "tenant",
    slug: "casino",
  });
  assert.deepEqual(parseRequestHost("salon-montreal.domain.com", "domain.com"), {
    kind: "tenant",
    slug: "salon-montreal",
  });
});

test("www on the public domain stays on the apex", () => {
  assert.deepEqual(parseRequestHost("domain.com", "domain.com"), { kind: "apex" });
  assert.deepEqual(parseRequestHost("www.domain.com", "domain.com"), { kind: "apex" });
});

test("a tenant request is sent to the apex sign-in", () => {
  const url = buildApexSignInUrl("http://casino.localhost:3000/home?x=1", "localhost");
  assert.equal(url.toString(), "http://localhost:3000/sign-in");
});

test("the configured app URL wins over the incoming host", () => {
  const url = buildApexSignInUrl(
    "https://casino.domain.com/admin",
    "domain.com",
    "https://domain.com",
  );
  assert.equal(url.toString(), "https://domain.com/sign-in");
});
