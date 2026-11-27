import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNTS,
  BADBEAT_ENTRY,
  BADBEAT_STATS,
  CASHIER,
  effectiveScopes,
  EMPLOYEES,
  hasEffectiveScope,
  hasScopeManager,
  PROMOTIONS,
  SCHEDULE,
  SCOPE_MANAGER,
} from "./effective.ts";

test("the main account keeps every scope", () => {
  const scopes = effectiveScopes({ isOwner: true, roleScopes: [], extraScopes: [] });
  assert.deepEqual(scopes, [ACCOUNTS, BADBEAT_ENTRY, BADBEAT_STATS, CASHIER, EMPLOYEES, PROMOTIONS, SCHEDULE, SCOPE_MANAGER]);
  assert.equal(hasScopeManager({ isOwner: true, roleScopes: [], extraScopes: [] }), true);
  assert.equal(hasEffectiveScope({ isOwner: true, roleScopes: [], extraScopes: [] }, ACCOUNTS), true);
  assert.equal(hasEffectiveScope({ isOwner: true, roleScopes: [], extraScopes: [] }, EMPLOYEES), true);
  assert.equal(hasEffectiveScope({ isOwner: true, roleScopes: [], extraScopes: [] }, BADBEAT_ENTRY), true);
  assert.equal(hasEffectiveScope({ isOwner: true, roleScopes: [], extraScopes: [] }, BADBEAT_STATS), true);
});

test("a role and extra scopes are combined", () => {
  const scopes = effectiveScopes({
    isOwner: false,
    roleScopes: ["scope_manager"],
    extraScopes: ["floor"],
  });
  assert.deepEqual(scopes, ["floor", "scope_manager"]);
});

test("an employee without the scope manager cannot open it", () => {
  assert.equal(
    hasScopeManager({ isOwner: false, roleScopes: ["floor"], extraScopes: [] }),
    false,
  );
});

test("employee records do not open account creation or the scope manager", () => {
  assert.equal(hasEffectiveScope({ isOwner: false, roleScopes: [EMPLOYEES], extraScopes: [] }, ACCOUNTS), false);
  assert.equal(hasScopeManager({ isOwner: false, roleScopes: [EMPLOYEES], extraScopes: [] }), false);
  assert.equal(hasEffectiveScope({ isOwner: false, roleScopes: [], extraScopes: [EMPLOYEES] }, EMPLOYEES), true);
});

test("bad beat entry and bad beat stats stay separate", () => {
  assert.equal(
    hasEffectiveScope({ isOwner: false, roleScopes: [BADBEAT_ENTRY, BADBEAT_STATS], extraScopes: [] }, BADBEAT_ENTRY),
    true,
  );
  assert.equal(
    hasEffectiveScope({ isOwner: false, roleScopes: [BADBEAT_ENTRY], extraScopes: [] }, BADBEAT_STATS),
    false,
  );
  assert.equal(
    hasEffectiveScope({ isOwner: false, roleScopes: [BADBEAT_STATS], extraScopes: [] }, BADBEAT_ENTRY),
    false,
  );
});

test("account creation does not open the scope manager", () => {
  assert.equal(
    hasScopeManager({ isOwner: false, roleScopes: [ACCOUNTS], extraScopes: [] }),
    false,
  );
  assert.equal(
    hasEffectiveScope({ isOwner: false, roleScopes: [], extraScopes: [ACCOUNTS] }, ACCOUNTS),
    true,
  );
});
