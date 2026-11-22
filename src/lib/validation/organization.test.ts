import assert from "node:assert/strict";
import test from "node:test";

import { parseCreateOrganization, parseSignIn } from "./organization.ts";

const organization = {
  name: "Casino Québec",
  slug: "casino-quebec",
  status: "active",
  contactEmail: "desk@casino.test",
  address: "1 rue du Jeu",
  adminFirstName: "Marie",
  adminLastName: "Lavoie",
  adminAccountId: "marie_l",
  adminPassword: "tables-open",
  adminPasswordConfirm: "tables-open",
};

test("sign-in accepts an issued account ID and password", () => {
  const parsed = parseSignIn({ accountId: " Marie_L ", password: "tables-open" });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.accountId, "marie_l");
  }
});

test("sign-in rejects an email used as the account ID", () => {
  const parsed = parseSignIn({ accountId: "marie@casino.test", password: "tables-open" });
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.error, "account_invalid");
  }
});

test("organization creation rejects a reserved subdomain and a mismatched password", () => {
  const reserved = parseCreateOrganization({ ...organization, slug: "admin" });
  assert.equal(reserved.ok, false);
  if (!reserved.ok) {
    assert.equal(reserved.error, "slug_reserved");
  }

  const mismatch = parseCreateOrganization({
    ...organization,
    adminPasswordConfirm: "other-pass",
  });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) {
    assert.equal(mismatch.error, "password_mismatch");
  }
});
