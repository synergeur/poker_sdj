import assert from "node:assert/strict";
import test from "node:test";

import { parseCreateOrganization, parseSignIn, parseUpdateOrganization } from "./organization.ts";

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

const update = {
  organizationId: "26855b6c-abdc-420a-b545-407b703c5443",
  adminUserId: "11111111-1111-4111-8111-111111111111",
  name: "Salle principale",
  slug: "salle",
  contactEmail: "",
  address: "12 rue des Jeux",
  adminFirstName: "Alex",
  adminLastName: "Martin",
  adminAccountId: "organisateur",
  adminPassword: "",
  adminPasswordConfirm: "",
};

test("an organizer edit can keep the current password", () => {
  const parsed = parseUpdateOrganization(update);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.adminPassword, "");
    assert.equal(parsed.data.adminAccountId, "organisateur");
  }
});

test("an organizer edit rejects a short replacement password", () => {
  const parsed = parseUpdateOrganization({
    ...update,
    adminPassword: "short",
    adminPasswordConfirm: "short",
  });
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.error, "password_short");
  }
});

test("an organizer edit rejects a password that was typed only once", () => {
  const parsed = parseUpdateOrganization({
    ...update,
    adminPassword: "tables-open",
    adminPasswordConfirm: "",
  });
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.error, "password_mismatch");
  }
});
