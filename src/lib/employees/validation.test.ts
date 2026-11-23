import assert from "node:assert/strict";
import test from "node:test";

import {
  employeeReturnPath,
  parseEmployeeException,
  parseEmployeeNote,
  parseEmployeeProfile,
  parseEmployeeWeek,
} from "./validation.ts";

const week = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  available: weekday <= 5,
  startsAt: "09:00",
  endsAt: "17:00",
}));

test("profile fields are trimmed and rejected when they are too long", () => {
  const parsed = parseEmployeeProfile({
    phone: " 514-555-0100 ",
    address: " 12 rue des Jeux ",
    emergencyName: " Marie ",
    emergencyPhone: " 514-555-0199 ",
    other: " Nuits ",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.data.phone, "514-555-0100");
  assert.equal(parseEmployeeProfile({ phone: "x".repeat(41), address: "", emergencyName: "", emergencyPhone: "", other: "" }).ok, false);
});

test("a week needs seven days and a finish time after the start", () => {
  const parsed = parseEmployeeWeek({ days: week });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.data[5].available, false);
  const backwards = week.map((day) => (day.weekday === 1 ? { ...day, startsAt: "18:00", endsAt: "09:00" } : day));
  assert.equal(parseEmployeeWeek({ days: backwards }).ok, false);
});

test("an exception can be a day off or a shift with hours", () => {
  assert.equal(parseEmployeeException({ workDate: "2026-11-23", available: "1", startsAt: "18:00", endsAt: "23:00" }).ok, true);
  assert.equal(parseEmployeeException({ workDate: "2026-02-31", available: false, startsAt: "", endsAt: "" }).ok, false);
  const off = parseEmployeeException({ workDate: "2026-12-25", available: false, startsAt: "09:00", endsAt: "17:00" });
  assert.equal(off.ok, true);
  if (off.ok) assert.equal(off.data.startsAt, "");
});

test("a note stays hidden unless the employee can see it", () => {
  const hidden = parseEmployeeNote({
    userId: "11111111-1111-4111-8111-111111111111",
    kind: "evaluation",
    body: " Reliable on the floor. ",
    visible: "",
  });
  assert.equal(hidden.ok, true);
  if (hidden.ok) {
    assert.equal(hidden.data.visible, false);
    assert.equal(hidden.data.body, "Reliable on the floor.");
  }
  assert.equal(
    parseEmployeeNote({ userId: "not-an-id", kind: "comment", body: "Hello", visible: "1" }).ok,
    false,
  );
});

test("saves return to the employee page or the personal page", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  assert.equal(employeeReturnPath({ page: "employees", userId }), `/employees?employee=${userId}&saved=1`);
  assert.equal(employeeReturnPath({ page: "me", error: "invalid" }), "/me?error=invalid");
  assert.equal(employeeReturnPath({ page: "https://evil.test", userId: "../admin" }), "/employees?saved=1");
});
