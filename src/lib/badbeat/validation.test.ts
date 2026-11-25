import assert from "node:assert/strict";
import test from "node:test";

import { parseBadbeatDraft } from "./validation.ts";

test("a bad beat line keeps the customer count and a won flag", () => {
  const parsed = parseBadbeatDraft({
    date: "2026-11-24",
    time: "21:30",
    customers: "12",
    won: true,
    comment: "  Table 4  ",
  });
  assert.deepEqual(parsed, {
    ok: true,
    data: { date: "2026-11-24", time: "21:30", customers: 12, won: true, comment: "Table 4" },
  });
});

test("a bad beat line rejects a fraction of a customer", () => {
  assert.equal(
    parseBadbeatDraft({ date: "2026-11-24", time: "21:30", customers: "1.5", won: false, comment: "" }).ok,
    false,
  );
});
