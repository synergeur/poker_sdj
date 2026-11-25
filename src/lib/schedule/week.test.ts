import assert from "node:assert/strict";
import test from "node:test";

import { shiftDate, weekDates } from "./week.ts";

test("a week starts on Monday", () => {
  assert.deepEqual(weekDates("2026-11-24"), [
    "2026-11-23",
    "2026-11-24",
    "2026-11-25",
    "2026-11-26",
    "2026-11-27",
    "2026-11-28",
    "2026-11-29",
  ]);
  assert.deepEqual(weekDates("2026-11-23"), weekDates("2026-11-29"));
  assert.equal(shiftDate("2026-11-29", 1), "2026-11-30");
});
