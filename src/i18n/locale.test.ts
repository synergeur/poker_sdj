import assert from "node:assert/strict";
import test from "node:test";

import { negotiateLocale } from "./locale.ts";

test("falls back to French when the browser does not say", () => {
  assert.equal(negotiateLocale(null), "fr");
  assert.equal(negotiateLocale("de-DE,de;q=0.9"), "fr");
});

test("follows the highest ranked supported language", () => {
  assert.equal(negotiateLocale("en-CA,en;q=0.8,fr;q=0.6"), "en");
  assert.equal(negotiateLocale("fr-CA,fr;q=0.9,en;q=0.4"), "fr");
});
