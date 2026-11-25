import assert from "node:assert/strict";
import test from "node:test";

import { availabilityBands, formatScheduleMinutes } from "./bands.ts";

const week = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  available: weekday <= 3,
  startsAt: weekday <= 3 ? "09:00" : null,
  endsAt: weekday <= 3 ? "17:00" : null,
}));

test("the clock runs from 10:00 through 04:00", () => {
  assert.equal(formatScheduleMinutes(0), "10:00");
  assert.equal(formatScheduleMinutes(7 * 60), "17:00");
  assert.equal(formatScheduleMinutes(18 * 60), "04:00");
});

test("usual hours are green and the rest of the night is grey", () => {
  const bands = availabilityBands({ weekdays: week, exceptions: [] }, "2026-11-23");
  assert.deepEqual(bands, [
    { start: 0, end: 7 * 60, tone: "available" },
    { start: 7 * 60, end: 18 * 60, tone: "off" },
  ]);
});

test("an unavailable exception turns that day red, including into the next morning", () => {
  const monday = availabilityBands(
    { weekdays: week, exceptions: [{ workDate: "2026-11-23", available: false, startsAt: null, endsAt: null }] },
    "2026-11-23",
  );
  assert.deepEqual(monday, [
    { start: 0, end: 14 * 60, tone: "exception" },
    { start: 14 * 60, end: 18 * 60, tone: "off" },
  ]);

  const intoTuesday = availabilityBands(
    { weekdays: week, exceptions: [{ workDate: "2026-11-24", available: false, startsAt: null, endsAt: null }] },
    "2026-11-23",
  );
  assert.equal(intoTuesday.find((band) => band.start === 14 * 60)?.tone, "exception");
});

test("custom exception hours replace the usual week", () => {
  const bands = availabilityBands(
    {
      weekdays: week,
      exceptions: [{ workDate: "2026-11-23", available: true, startsAt: "12:00", endsAt: "20:00" }],
    },
    "2026-11-23",
  );
  assert.deepEqual(bands, [
    { start: 0, end: 2 * 60, tone: "off" },
    { start: 2 * 60, end: 10 * 60, tone: "available" },
    { start: 10 * 60, end: 18 * 60, tone: "off" },
  ]);
});
