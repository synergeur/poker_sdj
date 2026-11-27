import assert from "node:assert/strict";
import test from "node:test";

import { parsePromotionDraft, parsePromotionEntryDraft } from "./validation.ts";

const base = {
  name: "December straight flush",
  kind: "instant",
  startsOn: "2026-12-01",
  endsOn: "2026-12-31",
  climbMode: "",
  startAmount: "",
  climbAmount: "",
  requirements: [{ label: "Straight flush", payout: "300", appliesOn: null }],
};

test("an instant promotion keeps a fixed payout", () => {
  const parsed = parsePromotionDraft(base);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.data.requirements[0]?.payout, 300);
  assert.equal(parsed.data.climbMode, null);
});

test("a cumulative promotion can climb on one requirement or a different one each day", () => {
  const steady = parsePromotionDraft({
    ...base,
    kind: "cumulative",
    climbMode: "steady",
    startAmount: "100",
    climbAmount: "50",
    requirements: [{ label: "Straight flush", payout: "", appliesOn: null }],
  });
  assert.equal(steady.ok, true);
  if (!steady.ok) return;
  assert.equal(steady.data.startAmount, 100);
  assert.equal(steady.data.climbAmount, 50);

  const daily = parsePromotionDraft({
    ...base,
    endsOn: "2026-12-02",
    kind: "cumulative",
    climbMode: "daily",
    startAmount: "100,50",
    climbAmount: "25",
    requirements: [
      { label: "Straight flush", payout: "", appliesOn: "2026-12-01" },
      { label: "Quads", payout: "", appliesOn: "2026-12-02" },
    ],
  });
  assert.equal(daily.ok, true);
  if (!daily.ok) return;
  assert.deepEqual(
    daily.data.requirements.map((requirement) => requirement.label),
    ["Straight flush", "Quads"],
  );
});

test("a daily promotion rejects a missing day", () => {
  const parsed = parsePromotionDraft({
    ...base,
    endsOn: "2026-12-02",
    kind: "cumulative",
    climbMode: "daily",
    startAmount: "100",
    climbAmount: "25",
    requirements: [{ label: "Straight flush", payout: "", appliesOn: "2026-12-01" }],
  });
  assert.deepEqual(parsed, { ok: false, error: "invalid" });
});

test("a best hand keeps one prize, and a call needs a phone", () => {
  const parsed = parsePromotionDraft({
    ...base,
    name: "Best hand",
    kind: "besthand",
    requirements: [{ label: "Best hand", payout: "100", appliesOn: null }],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.data.kind, "besthand");
  assert.equal(parsed.data.requirements[0]?.payout, 100);

  const line = {
    promotionId: "28ee1b57-d15c-46fa-8e12-7fc454fa1678",
    date: "2026-12-01",
    time: "23:40",
    requirementId: "22af4590-ffad-4560-8fcc-0d72bed407b4",
    won: false,
    comment: "",
    kind: "besthand",
    playerName: "Marie",
    playerPhone: "",
    hand: "Quads",
    settle: "call",
  };
  assert.equal(parsePromotionEntryDraft(line).ok, false);
  const ready = parsePromotionEntryDraft({ ...line, playerPhone: "5145550101" });
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  assert.equal(ready.data.won, false);
  assert.equal(ready.data.settle, "call");
  const paid = parsePromotionEntryDraft({ ...line, settle: "tonight", playerPhone: "" });
  assert.equal(paid.ok, true);
  if (!paid.ok) return;
  assert.equal(paid.data.won, true);
});

test("a log line needs a promotion, a requirement, and a time", () => {
  const input = {
    promotionId: "28ee1b57-d15c-46fa-8e12-7fc454fa1678",
    date: "2026-12-01",
    time: "19:30",
    requirementId: "22af4590-ffad-4560-8fcc-0d72bed407b4",
    won: true,
    comment: "Table 4",
  };
  assert.equal(parsePromotionEntryDraft(input).ok, true);
  assert.equal(parsePromotionEntryDraft({ ...input, promotionId: "nope" }).ok, false);
});
