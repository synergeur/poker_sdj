import assert from "node:assert/strict";
import test from "node:test";

import {
  callsWaiting,
  cumulativePrize,
  eachDay,
  monthBounds,
  pricePromotion,
  promotionInsights,
  promotionStats,
  requirementFor,
  type PromotionEntryInput,
  type PromotionRecord,
} from "./rules.ts";

function promo(overrides: Partial<PromotionRecord> = {}): PromotionRecord {
  return {
    id: "a",
    name: "December",
    kind: "cumulative",
    startsOn: "2026-12-01",
    endsOn: "2026-12-31",
    climbMode: "steady",
    startAmount: 100,
    climbAmount: 50,
    requirements: [{ id: "req-a", label: "Straight flush", payout: null, appliesOn: null, position: 0 }],
    ...overrides,
  };
}

function entry(overrides: Partial<PromotionEntryInput> = {}): PromotionEntryInput {
  return {
    id: "line",
    promotionId: "a",
    date: "2026-12-01",
    time: "19:30",
    requirementId: "req-a",
    won: false,
    comment: "",
    playerName: "",
    playerPhone: "",
    hand: "",
    settle: null,
    createdAt: "2026-12-01T19:30:00.000Z",
    ...overrides,
  };
}

test("a month promotion climbs by X each missed day and resets after a win", () => {
  const promotion = promo();
  const entries = [
    entry({ id: "1", date: "2026-12-01", won: false }),
    entry({ id: "2", date: "2026-12-03", won: true }),
  ];
  assert.equal(cumulativePrize(promotion, entries, "2026-12-01"), 100);
  assert.equal(cumulativePrize(promotion, entries, "2026-12-02"), 150);
  assert.equal(cumulativePrize(promotion, entries, "2026-12-03"), 200);
  assert.equal(cumulativePrize(promotion, entries, "2026-12-04"), 100);
});

test("a missed day with no log still climbs, and only inside this promotion", () => {
  const december = promo();
  const november = promo({
    id: "b",
    name: "November",
    startsOn: "2026-11-01",
    endsOn: "2026-11-30",
    startAmount: 20,
    climbAmount: 10,
    requirements: [{ id: "req-b", label: "Quads", payout: null, appliesOn: null, position: 0 }],
  });
  const entries = [
    entry({ id: "nov", promotionId: "b", requirementId: "req-b", date: "2026-11-02", won: true }),
    entry({ id: "dec", date: "2026-12-02", won: false }),
  ];
  assert.equal(cumulativePrize(december, entries, "2026-12-03"), 200);
  assert.equal(cumulativePrize(november, entries, "2026-11-03"), 20);
  assert.equal(promotionStats(december, entries, "2026-12-03").kind === "cumulative" && promotionStats(december, entries, "2026-12-03").totalPaid, 0);
});

test("a daily requirement changes with the date while the prize still climbs", () => {
  const promotion = promo({
    climbMode: "daily",
    requirements: [
      { id: "d1", label: "Straight flush", payout: null, appliesOn: "2026-12-01", position: 0 },
      { id: "d2", label: "Quads", payout: null, appliesOn: "2026-12-02", position: 1 },
    ],
    endsOn: "2026-12-02",
  });
  assert.equal(requirementFor(promotion, "2026-12-01")?.label, "Straight flush");
  assert.equal(requirementFor(promotion, "2026-12-02")?.label, "Quads");
  assert.equal(cumulativePrize(promotion, [], "2026-12-02"), 150);
});

test("an instant payout stays on its own requirement and its own promotion", () => {
  const promotion = promo({
    id: "instant",
    kind: "instant",
    climbMode: null,
    startAmount: null,
    climbAmount: null,
    requirements: [
      { id: "sf", label: "Straight flush", payout: 300, appliesOn: null, position: 0 },
      { id: "rf", label: "Royal flush", payout: 1000, appliesOn: null, position: 1 },
    ],
  });
  const other = promo({ id: "other" });
  const entries = [
    entry({ id: "hit", promotionId: "instant", requirementId: "sf", won: true }),
    entry({ id: "noise", promotionId: "other", requirementId: "req-a", won: true, date: "2026-12-01" }),
  ];
  const priced = pricePromotion(promotion, entries);
  assert.equal(priced.length, 1);
  assert.equal(priced[0]?.amount, 300);
  assert.equal(priced[0]?.requirement, "Straight flush");
  const stats = promotionStats(promotion, entries, "2026-12-01");
  assert.equal(stats.kind === "instant" && stats.totalPaid, 300);
  assert.equal(stats.kind === "instant" && stats.hits, 1);
  assert.equal(pricePromotion(other, entries)[0]?.amount, 100);
});

test("insights follow one promotion and chart the prize through today", () => {
  const promotion = promo();
  const entries = [entry({ id: "1", date: "2026-12-01", won: false }), entry({ id: "2", date: "2026-12-03", won: true })];
  const insights = promotionInsights(promotion, entries, "2026-12-04");
  assert.equal(insights.wins, 1);
  assert.equal(insights.highest?.amount, 200);
  assert.equal(insights.last?.date, "2026-12-03");
  assert.deepEqual(
    insights.trend.map((point) => point.amount),
    [100, 150, 200, 100],
  );
  assert.equal(insights.favorite?.label, "Straight flush");
});

test("a best hand paid tonight is closed, and a player who left stays on the call list", () => {
  const promotion = promo({
    id: "hand",
    kind: "besthand",
    climbMode: null,
    startAmount: null,
    climbAmount: null,
    requirements: [{ id: "prize", label: "Best hand", payout: 100, appliesOn: null, position: 0 }],
  });
  const entries = [
    entry({
      id: "night",
      promotionId: "hand",
      requirementId: "prize",
      date: "2026-12-01",
      won: true,
      playerName: "Luc",
      playerPhone: "",
      hand: "Flush",
      settle: "tonight",
    }),
    entry({
      id: "left",
      promotionId: "hand",
      requirementId: "prize",
      date: "2026-12-02",
      won: false,
      playerName: "Marie",
      playerPhone: "5145550101",
      hand: "Quads",
      settle: "call",
    }),
  ];
  const stats = promotionStats(promotion, entries, "2026-12-02");
  assert.equal(stats.kind, "besthand");
  if (stats.kind !== "besthand") return;
  assert.equal(stats.toCall, 1);
  assert.equal(stats.paidTonight, 1);
  assert.equal(stats.totalPaid, 100);
  assert.equal(stats.lastPlayer, "Marie");
  const insights = promotionInsights(promotion, entries, "2026-12-02");
  assert.equal(insights.totalPaid, 100);
  assert.deepEqual(callsWaiting(entries).map((item) => item.playerName), ["Marie"]);
  assert.deepEqual(
    insights.trend.map((point) => point.amount),
    [100, 100],
  );
});

test("the default promotion dates are the current month", () => {
  assert.deepEqual(monthBounds("2026-11-27"), { start: "2026-11-01", end: "2026-11-30" });
  assert.equal(eachDay("2026-12-01", "2026-12-03").join(","), "2026-12-01,2026-12-02,2026-12-03");
});
