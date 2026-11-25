"use server";

import { shiftPlacementError, type ScheduleShift, type ScheduleWriteError, type ShiftKind } from "@/lib/schedule/shifts";
import { addScheduleShift, deleteScheduleShift, moveScheduleShift } from "@/server/services/schedule";
import { organizationFromRequest } from "@/server/services/scopes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function addScheduleShiftAction(
  shift: ScheduleShift,
): Promise<{ ok: true; shift: ScheduleShift } | { ok: false; error: ScheduleWriteError }> {
  const parsed = parseShift(shift);
  if (!parsed.ok) return parsed;
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  return addScheduleShift(organization.id, parsed.shift);
}

export async function moveScheduleShiftAction(
  shift: ScheduleShift,
): Promise<{ ok: true; shift: ScheduleShift } | { ok: false; error: ScheduleWriteError }> {
  const parsed = parseShift(shift);
  if (!parsed.ok) return parsed;
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  return moveScheduleShift(organization.id, parsed.shift);
}

export async function deleteScheduleShiftAction(id: string): Promise<{ ok: true } | { ok: false; error: ScheduleWriteError }> {
  if (!UUID.test(id)) return { ok: false, error: "range" };
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  return deleteScheduleShift(organization.id, id);
}

function parseShift(shift: ScheduleShift): { ok: true; shift: ScheduleShift } | { ok: false; error: ScheduleWriteError } {
  const kind: ShiftKind | null = shift.kind === "cash" || shift.kind === "tournament" || shift.kind === "cashier" ? shift.kind : null;
  if (!UUID.test(shift.id) || !UUID.test(shift.userId) || !DAY.test(shift.workDate) || !kind) {
    return { ok: false, error: "range" };
  }
  const draft = {
    userId: shift.userId,
    workDate: shift.workDate,
    kind,
    startMinutes: shift.startMinutes,
    endMinutes: shift.endMinutes,
  };
  const problem = shiftPlacementError([], draft);
  if (problem) return { ok: false, error: problem === "kind" ? "range" : problem };
  return { ok: true, shift: { ...draft, id: shift.id } };
}
