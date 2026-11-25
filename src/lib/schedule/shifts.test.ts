import assert from "node:assert/strict";
import test from "node:test";

import { orderedRange, pushedShifts, resizedEdge, shiftPlacementError, snapScheduleMinutes, type ScheduleShift } from "./shifts.ts";

const existing: ScheduleShift = {
  id: "shift-1",
  userId: "sacha",
  workDate: "2026-11-24",
  kind: "cash",
  startMinutes: 60,
  endMinutes: 240,
};

test("a click grows into a 30 minute shift and a drag keeps its span", () => {
  assert.deepEqual(orderedRange(120, 120), { start: 120, end: 150 });
  assert.deepEqual(orderedRange(200, 120), { start: 120, end: 200 });
  assert.equal(snapScheduleMinutes(7), 0);
  assert.equal(snapScheduleMinutes(8), 15);
});

test("a shift can be added beside another and cannot cover it", () => {
  assert.equal(
    shiftPlacementError([existing], {
      userId: "sacha",
      workDate: "2026-11-24",
      kind: "tournament",
      startMinutes: 240,
      endMinutes: 360,
    }),
    null,
  );
  assert.equal(
    shiftPlacementError([existing], {
      userId: "sacha",
      workDate: "2026-11-24",
      kind: "cash",
      startMinutes: 180,
      endMinutes: 300,
    }),
    "overlap",
  );
  assert.equal(
    shiftPlacementError(
      [existing],
      { userId: "sacha", workDate: "2026-11-24", kind: "cash", startMinutes: 180, endMinutes: 300 },
      existing.id,
    ),
    null,
  );
});

test("a cashier shift only lands on someone with the cashier scope", () => {
  const cashiers = new Set(["sacha"]);
  const draft = {
    userId: "test",
    workDate: "2026-11-24",
    kind: "cashier" as const,
    startMinutes: 60,
    endMinutes: 180,
  };
  assert.equal(shiftPlacementError([], draft, undefined, cashiers), "cashier");
  assert.equal(shiftPlacementError([], { ...draft, userId: "sacha" }, undefined, cashiers), null);
  assert.equal(shiftPlacementError([], { ...draft, kind: "cash" }, undefined, cashiers), null);
});

test("either edge of a shift can move without dropping under 30 minutes", () => {
  assert.deepEqual(resizedEdge("end", 120, 300), { start: 120, end: 300 });
  assert.deepEqual(resizedEdge("start", 300, 180), { start: 180, end: 300 });
  assert.deepEqual(resizedEdge("end", 120, 130), { start: 120, end: 150 });
  assert.deepEqual(resizedEdge("start", 150, 400), { start: 120, end: 150 });
  assert.deepEqual(resizedEdge("end", 1050, 1200), { start: 1050, end: 1080 });
});

function placed(id: string, startMinutes: number, endMinutes: number, userId = "sacha"): ScheduleShift {
  return { id, userId, workDate: "2026-11-24", kind: "cash", startMinutes, endMinutes };
}

test("stretching into later shifts pushes them ahead, furthest first", () => {
  const shifts = [placed("a", 180, 420), placed("b", 420, 645), placed("c", 660, 780), placed("other", 420, 600, "test")];
  assert.deepEqual(pushedShifts(shifts, placed("a", 180, 540), "end"), [placed("c", 765, 885), placed("b", 540, 765)]);
  assert.deepEqual(pushedShifts([placed("a", 180, 420), placed("b", 480, 600)], placed("a", 180, 450), "end"), []);
  assert.equal(pushedShifts([placed("a", 900, 1020), placed("b", 1020, 1080)], placed("a", 900, 1050), "end"), "range");
});

test("stretching into earlier shifts pushes them backward", () => {
  const shifts = [placed("a", 420, 645), placed("b", 240, 420), placed("c", 0, 120)];
  assert.deepEqual(pushedShifts(shifts, placed("a", 360, 645), "start"), [placed("b", 180, 360)]);
  assert.equal(pushedShifts([placed("a", 120, 300), placed("b", 0, 120)], placed("a", 60, 300), "start"), "range");
});

test("a shift stays on the 10:00 to 04:00 grid", () => {
  assert.equal(
    shiftPlacementError([], {
      userId: "sacha",
      workDate: "2026-11-24",
      kind: "cash",
      startMinutes: 0,
      endMinutes: 15,
    }),
    "range",
  );
});
