import assert from "node:assert/strict";
import test from "node:test";

import { decideAccess } from "./access.ts";
import { requestSite } from "./host.ts";

const site = requestSite("localhost:3000", "http");

test("an organization account on the apex is sent to its own home", () => {
  const decision = decideAccess({
    host: { kind: "apex" },
    pathname: "/sign-in",
    home: { kind: "organization", slug: "salle" },
    site,
  });

  assert.deepEqual(decision, { type: "redirect", href: "http://salle.localhost:3000/home" });
});

test("an organization account on the apex is sent to its scope manager", () => {
  const decision = decideAccess({
    host: { kind: "apex" },
    pathname: "/scopes",
    home: { kind: "organization", slug: "salle" },
    site,
  });

  assert.deepEqual(decision, { type: "redirect", href: "http://salle.localhost:3000/scopes" });
});

test("an organization account on the apex is sent to its accounts page", () => {
  const decision = decideAccess({
    host: { kind: "apex" },
    pathname: "/accounts",
    home: { kind: "organization", slug: "salle" },
    site,
  });

  assert.deepEqual(decision, { type: "redirect", href: "http://salle.localhost:3000/accounts" });
});

test("an organization account on the apex is sent to its employees page", () => {
  const decision = decideAccess({
    host: { kind: "apex" },
    pathname: "/employees",
    home: { kind: "organization", slug: "salle" },
    site,
  });

  assert.deepEqual(decision, { type: "redirect", href: "http://salle.localhost:3000/employees" });
});

test("an organization account on the apex is sent to its bad beat log", () => {
  const decision = decideAccess({
    host: { kind: "apex" },
    pathname: "/badbeat",
    home: { kind: "organization", slug: "salle" },
    site,
  });

  assert.deepEqual(decision, { type: "redirect", href: "http://salle.localhost:3000/badbeat" });
});

test("an organization account on the apex is sent to its promotions", () => {
  const decision = decideAccess({
    host: { kind: "apex" },
    pathname: "/promotions",
    home: { kind: "organization", slug: "salle" },
    site,
  });

  assert.deepEqual(decision, { type: "redirect", href: "http://salle.localhost:3000/promotions" });
});

test("an organization account on the apex is sent to its schedule", () => {
  const decision = decideAccess({
    host: { kind: "apex" },
    pathname: "/schedule",
    home: { kind: "organization", slug: "salle" },
    site,
  });

  assert.deepEqual(decision, { type: "redirect", href: "http://salle.localhost:3000/schedule" });
});

test("an organization account on the apex is sent to its own information", () => {
  const decision = decideAccess({
    host: { kind: "apex" },
    pathname: "/me",
    home: { kind: "organization", slug: "salle" },
    site,
  });

  assert.deepEqual(decision, { type: "redirect", href: "http://salle.localhost:3000/me" });
});

test("an organization account cannot open the host console", () => {
  const decision = decideAccess({
    host: { kind: "apex" },
    pathname: "/admin",
    home: { kind: "organization", slug: "salle" },
    site,
  });

  assert.deepEqual(decision, { type: "redirect", href: "http://salle.localhost:3000/home" });
});

test("an organization account cannot open another establishment", () => {
  const decision = decideAccess({
    host: { kind: "tenant", slug: "autre" },
    pathname: "/home",
    home: { kind: "organization", slug: "salle" },
    site,
  });

  assert.deepEqual(decision, { type: "redirect", href: "http://salle.localhost:3000/home" });
});

test("an organization account stays on its own home", () => {
  const decision = decideAccess({
    host: { kind: "tenant", slug: "salle" },
    pathname: "/home",
    home: { kind: "organization", slug: "salle" },
    site,
  });

  assert.deepEqual(decision, { type: "allow" });
});

test("sign-out is allowed on the organization host", () => {
  const decision = decideAccess({
    host: { kind: "tenant", slug: "salle" },
    pathname: "/auth/sign-out",
    home: { kind: "organization", slug: "salle" },
    site,
  });

  assert.deepEqual(decision, { type: "allow" });
});

test("the session handoff can run before the organization cookie exists", () => {
  const decision = decideAccess({
    host: { kind: "tenant", slug: "salle" },
    pathname: "/auth/handoff",
    home: { kind: "anonymous" },
    site,
  });

  assert.deepEqual(decision, { type: "allow" });
});

test("a signed-out visit to an organization goes to the apex sign-in", () => {
  const decision = decideAccess({
    host: { kind: "tenant", slug: "salle" },
    pathname: "/home",
    home: { kind: "anonymous" },
    site,
  });

  assert.deepEqual(decision, { type: "redirect", href: "http://localhost:3000/sign-in" });
});

test("the platform host still opens the console", () => {
  const decision = decideAccess({
    host: { kind: "apex" },
    pathname: "/sign-in",
    home: { kind: "host" },
    site,
  });

  assert.deepEqual(decision, { type: "redirect", href: "http://localhost:3000/admin" });
});
