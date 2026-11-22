import assert from "node:assert/strict";
import test from "node:test";

import { isValidAccountId, normalizeAccountId } from "./account-id.ts";

test("normalizes the account ID people type", () => {
  assert.equal(normalizeAccountId("  Host_Admin "), "host_admin");
});

test("accepts an account ID issued with the account", () => {
  assert.equal(isValidAccountId("host"), true);
  assert.equal(isValidAccountId("marie_l"), true);
});

test("rejects emails and short values as account IDs", () => {
  assert.equal(isValidAccountId("marie@casino.test"), false);
  assert.equal(isValidAccountId("ab"), false);
  assert.equal(isValidAccountId("1marie"), false);
});
