import assert from "node:assert/strict";
import test from "node:test";

import { parseCreateEmployee, parseRole } from "./validation.ts";

const employee = {
  firstName: "Lea",
  lastName: "Roy",
  accountId: "lea_roy",
  password: "tables-open",
  passwordConfirm: "tables-open",
  roleId: "11111111-1111-4111-8111-111111111111",
  scopes: ["scope_manager"],
};

test("an employee account accepts a role and extra scopes", () => {
  const parsed = parseCreateEmployee(employee);
  assert.equal(parsed.ok, true);
});

test("an employee account rejects a short password", () => {
  const parsed = parseCreateEmployee({ ...employee, password: "short", passwordConfirm: "short" });
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.error, "password_short");
});

test("a role cannot reuse a built-in name", () => {
  const parsed = parseRole({ name: "staff", description: "", scopes: [] });
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.error, "role_invalid");
});
