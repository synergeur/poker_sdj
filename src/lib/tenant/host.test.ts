import assert from "node:assert/strict";
import test from "node:test";

import { buildApexSignInUrl, buildTenantUrl, parseRequestHost, requestSite } from "./host.ts";

test("localhost is the apex", () => {
  assert.deepEqual(parseRequestHost("localhost:3000"), { kind: "apex" });
  assert.deepEqual(parseRequestHost("www.localhost"), { kind: "apex" });
});

test("an organization host is the tenant slug", () => {
  assert.deepEqual(parseRequestHost("casino.localhost:3000"), {
    kind: "tenant",
    slug: "casino",
  });
  assert.deepEqual(parseRequestHost("salon-montreal.domain.com"), {
    kind: "tenant",
    slug: "salon-montreal",
  });
});

test("www on the public domain stays on the apex", () => {
  assert.deepEqual(parseRequestHost("domain.com"), { kind: "apex" });
  assert.deepEqual(parseRequestHost("www.domain.com"), { kind: "apex" });
});

test("a country-code domain keeps its registrable name", () => {
  assert.deepEqual(parseRequestHost("example.co.uk"), { kind: "apex" });
  assert.deepEqual(parseRequestHost("salon.example.co.uk"), { kind: "tenant", slug: "salon" });
  assert.equal(buildTenantUrl("salon", "/home", requestSite("example.co.uk", "https")).href, "https://salon.example.co.uk/home");
});

test("a tenant request is sent to the apex sign-in", () => {
  const url = buildApexSignInUrl("http://casino.localhost:3000/home?x=1");
  assert.equal(url.toString(), "http://localhost:3000/sign-in");
});

test("the incoming host supplies the protocol and apex", () => {
  const url = buildApexSignInUrl("https://casino.domain.com/admin");
  assert.equal(url.toString(), "https://domain.com/sign-in");
});
