import assert from "node:assert/strict";
import test from "node:test";

import { handoffDestination, openHandoff, sealHandoff } from "./handoff.ts";

test("a handoff token round-trips the session cookies", () => {
  const token = sealHandoff([
    { name: "sb-project-auth-token.0", value: "one" },
    { name: "theme", value: "dark" },
  ]);
  assert.deepEqual(openHandoff(token), [{ name: "sb-project-auth-token.0", value: "one" }]);
});

test("a damaged handoff token is ignored", () => {
  assert.equal(openHandoff("not-a-token"), null);
});

test("employee pages survive a handoff", () => {
  assert.equal(handoffDestination("/employees"), "/employees");
  assert.equal(handoffDestination("/me"), "/me");
  assert.equal(handoffDestination("/badbeat"), "/badbeat");
  assert.equal(handoffDestination("/schedule"), "/schedule");
  assert.equal(handoffDestination("/elsewhere"), "/home");
});
