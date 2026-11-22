import assert from "node:assert/strict";
import test from "node:test";

import { slugify, validateSlug } from "./slug.ts";

test("accepts a subdomain slug", () => {
  assert.equal(validateSlug("casino-quebec"), "ok");
});

test("rejects uppercase, spaces, and short slugs", () => {
  assert.equal(validateSlug("Casino"), "format");
  assert.equal(validateSlug("a"), "format");
  assert.equal(validateSlug("casino quebec"), "format");
});

test("rejects reserved host labels", () => {
  for (const slug of ["www", "admin", "api", "app", "auth", "mail"]) {
    assert.equal(validateSlug(slug), "reserved");
  }
});

test("slugifies an establishment name", () => {
  assert.equal(slugify("Casino Québec"), "casino-quebec");
  assert.equal(slugify("  Salon — Montréal  "), "salon-montreal");
});
