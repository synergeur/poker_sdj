import assert from "node:assert/strict";
import test from "node:test";

import { buildOrganizationNav } from "./links.ts";

const labels = {
  overview: "Overview",
  groups: {
    me: "Me",
    operations: "Operations",
    workforce: "Workforce",
    management: "Management",
    analytics: "Analytics",
    administration: "Administration",
  },
  items: {
    "open-close": "Reconciliation",
    "gaming-floor": "Gaming floor",
    "dealer-rotation": "Dealer rotation",
    tournaments: "Tournaments",
    cashier: "Cashier",
    "supervisor-logbook": "Supervisor logbook",
    incidents: "Incidents",
    promotions: "Promotions",
    employees: "Employees",
    me: "My information",
    schedule: "Schedule",
    "time-attendance": "Time & attendance",
    requests: "Requests",
    training: "Training",
    tasks: "Tasks & checklists",
    announcements: "Announcements",
    "knowledge-base": "Knowledge base",
    inventory: "Inventory",
    badbeat: "Bad beat",
    statistics: "Operational statistics",
    reports: "Reports",
    accounts: "Accounts",
    scopes: "Scopes & roles",
    "audit-logs": "Audit logs",
    "organization-settings": "Organization settings",
  },
} as const;

test("the sidebar follows the workspace groups and sends missing sections to the dev page", () => {
  const menu = buildOrganizationNav({
    current: "overview",
    access: {
      self: true,
      employees: true,
      badbeat: true,
      promotions: true,
      schedule: true,
      accounts: true,
      scopes: true,
    },
    labels,
    showDev: true,
  });

  assert.equal(menu.overview.href, "/home");
  assert.deepEqual(
    menu.sections.map((section) => section.id),
    ["me", "operations", "workforce", "management", "analytics", "administration"],
  );
  assert.deepEqual(menu.sections[0]?.items.map((item) => item.id), ["me"]);
  assert.equal(menu.sections[0]?.items[0]?.href, "/me");
  assert.deepEqual(
    menu.sections[1]?.items.map((item) => item.id),
    ["promotions", "open-close", "gaming-floor", "dealer-rotation", "tournaments", "cashier", "supervisor-logbook", "incidents"],
  );
  assert.equal(menu.sections[1]?.items.find((item) => item.id === "promotions")?.href, "/promotions");
  assert.equal(menu.sections[1]?.items.find((item) => item.id === "promotions")?.dev, false);
  assert.equal(
    menu.sections[1]?.items.filter((item) => item.id !== "promotions").every((item) => item.dev && item.href.startsWith("/dev?section=")),
    true,
  );
  assert.equal(menu.sections[2]?.items.find((item) => item.id === "employees")?.href, "/employees");
  assert.equal(menu.sections[2]?.items.some((item) => item.id === "me"), false);
  assert.equal(menu.sections[4]?.items.find((item) => item.id === "badbeat")?.dev, false);
});

test("red sections stay hidden until the sidebar asks for them", () => {
  const menu = buildOrganizationNav({
    current: "overview",
    access: {
      self: true,
      employees: true,
      badbeat: true,
      promotions: true,
      schedule: true,
      accounts: true,
      scopes: true,
    },
    labels,
  });

  assert.deepEqual(
    menu.sections.map((section) => section.id),
    ["me", "operations", "workforce", "analytics", "administration"],
  );
  assert.deepEqual(menu.sections.find((section) => section.id === "operations")?.items.map((item) => item.id), ["promotions"]);
  assert.equal(menu.sections.every((section) => section.items.every((item) => !item.dev)), true);
});
