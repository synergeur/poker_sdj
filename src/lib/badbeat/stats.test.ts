import assert from "node:assert/strict";
import test from "node:test";

import { badbeatInsights, badbeatPeriodRange, badbeatStats, badbeatTrend, orderBadbeat, priceBadbeat } from "./stats.ts";

test("customers add two dollars and the previous day carries over", () => {
  const priced = priceBadbeat([
    { id: "b", date: "2026-11-18", time: "21:00", customers: 5, won: false },
    { id: "a", date: "2026-11-17", time: "20:00", customers: 10, won: false },
  ]);
  const byId = Object.fromEntries(priced.map((entry) => [entry.id, entry.amount]));
  assert.equal(byId.a, 20);
  assert.equal(byId.b, 30);
  assert.deepEqual(badbeatStats(priced, "2026-11-18"), {
    current: 30,
    dayTotal: 10,
    dayEntries: 1,
    carryover: 20,
    lastWon: null,
  });
});

test("a month range keeps the jackpot through today", () => {
  const entries = [
    { id: "a", date: "2026-11-24", time: "05:50", customers: 50, won: false, createdAt: "1" },
    { id: "b", date: "2026-11-24", time: "05:50", customers: 234, won: false, createdAt: "2" },
  ];
  assert.deepEqual(badbeatPeriodRange("month", "2026-11-24"), { start: "2026-11-01", end: "2026-11-30" });
  assert.deepEqual(badbeatPeriodRange("week", "2026-11-24"), { start: "2026-11-23", end: "2026-11-29" });
  assert.deepEqual(badbeatPeriodRange("year", "2026-11-24"), { start: "2026-01-01", end: "2026-12-31" });
  const trend = badbeatTrend(entries, "2026-11-01", "2026-11-30", "2026-11-24");
  assert.equal(trend[0]?.date, "2026-11-01");
  assert.equal(trend[0]?.amount, 0);
  assert.equal(trend.at(-1)?.date, "2026-11-24");
  assert.equal(trend.at(-1)?.amount, 568);
  assert.equal(trend.at(-1)?.customers, 284);
});

test("lines in the same minute follow the order they were entered", () => {
  const priced = priceBadbeat([
    { id: "second", date: "2026-11-24", time: "05:50", customers: 234, won: false, createdAt: "2026-11-24T10:51:00Z" },
    { id: "first", date: "2026-11-24", time: "05:50", customers: 50, won: false, createdAt: "2026-11-24T10:50:00Z" },
  ]);
  const byId = Object.fromEntries(priced.map((entry) => [entry.id, entry.amount]));
  assert.equal(byId.first, 100);
  assert.equal(byId.second, 568);
  assert.deepEqual(
    orderBadbeat(priced, "date", "desc").map((entry) => entry.id),
    ["second", "first"],
  );
  assert.deepEqual(
    orderBadbeat(priced, "customers", "asc").map((entry) => entry.id),
    ["first", "second"],
  );
});

test("a won entry pays the pot and the next entry starts at zero", () => {
  const entries = [
    { id: "a", date: "2026-11-17", time: "20:00", customers: 10, won: false },
    { id: "won", date: "2026-11-18", time: "22:00", customers: 0, won: true },
    { id: "c", date: "2026-11-19", time: "19:00", customers: 4, won: false },
  ];
  const priced = priceBadbeat(entries);
  const byId = Object.fromEntries(priced.map((entry) => [entry.id, entry]));
  assert.equal(byId.won?.amount, 0);
  assert.equal(byId.won?.wonAmount, 20);
  assert.equal(byId.c?.amount, 8);
  assert.deepEqual(badbeatStats(entries, "2026-11-19"), {
    current: 8,
    dayTotal: 8,
    dayEntries: 1,
    carryover: 0,
    lastWon: 20,
  });
  assert.deepEqual(badbeatInsights(entries), {
    highestDay: { date: "2026-11-17", added: 20, customers: 10 },
    medianCustomers: 4,
    busiestDay: { date: "2026-11-17", added: 20, customers: 10 },
    averageAdded: 9.33,
    wins: 1,
  });
});
