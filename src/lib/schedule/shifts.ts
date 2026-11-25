import { SCHEDULE_SPAN_MINUTES } from "@/lib/schedule/bands";

export const SCHEDULE_SNAP_MINUTES = 15;
export const SCHEDULE_MIN_LENGTH = 30;

export type ShiftKind = "cash" | "tournament" | "cashier";

export type ScheduleShift = {
  id: string;
  userId: string;
  workDate: string;
  kind: ShiftKind;
  startMinutes: number;
  endMinutes: number;
};

export type ShiftDraft = {
  userId: string;
  workDate: string;
  kind: ShiftKind;
  startMinutes: number;
  endMinutes: number;
};

export type ShiftPlacementError = "range" | "overlap" | "kind" | "cashier";
export type ScheduleWriteError = "forbidden" | "unavailable" | "failed" | "range" | "overlap" | "not_found" | "cashier";

export function snapScheduleMinutes(value: number) {
  const snapped = Math.round(value / SCHEDULE_SNAP_MINUTES) * SCHEDULE_SNAP_MINUTES;
  return Math.min(SCHEDULE_SPAN_MINUTES, Math.max(0, snapped));
}

export function minutesFromRatio(ratio: number) {
  const clamped = Math.min(1, Math.max(0, ratio));
  return snapScheduleMinutes(clamped * SCHEDULE_SPAN_MINUTES);
}

export function resizedEdge(edge: "start" | "end", fixed: number, pointer: number) {
  if (edge === "start") {
    const start = Math.min(Math.max(0, pointer), fixed - SCHEDULE_MIN_LENGTH);
    return { start, end: fixed };
  }
  const end = Math.max(Math.min(SCHEDULE_SPAN_MINUTES, pointer), fixed + SCHEDULE_MIN_LENGTH);
  return { start: fixed, end };
}

export function pushedShifts(
  shifts: readonly ScheduleShift[],
  draft: ScheduleShift,
  edge: "start" | "end",
): ScheduleShift[] | "range" {
  const others = shifts.filter(
    (shift) => shift.id !== draft.id && shift.userId === draft.userId && shift.workDate === draft.workDate,
  );
  const moved: ScheduleShift[] = [];
  if (edge === "end") {
    let occupied = draft.endMinutes;
    const ordered = [...others].sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);
    for (const shift of ordered) {
      if (shift.endMinutes <= draft.startMinutes) continue;
      if (shift.startMinutes >= occupied) break;
      const duration = shift.endMinutes - shift.startMinutes;
      const endMinutes = occupied + duration;
      if (endMinutes > SCHEDULE_SPAN_MINUTES) return "range";
      moved.push({ ...shift, startMinutes: occupied, endMinutes });
      occupied = endMinutes;
    }
  } else {
    let occupied = draft.startMinutes;
    const ordered = [...others].sort((a, b) => b.endMinutes - a.endMinutes || b.startMinutes - a.startMinutes);
    for (const shift of ordered) {
      if (shift.startMinutes >= draft.endMinutes) continue;
      if (shift.endMinutes <= occupied) break;
      const duration = shift.endMinutes - shift.startMinutes;
      const startMinutes = occupied - duration;
      if (startMinutes < 0) return "range";
      moved.push({ ...shift, startMinutes, endMinutes: occupied });
      occupied = startMinutes;
    }
  }
  return moved.reverse();
}

export function orderedRange(anchor: number, current: number) {
  const start = Math.min(anchor, current);
  const end = Math.max(anchor, current);
  if (end - start >= SCHEDULE_MIN_LENGTH) return { start, end };
  if (anchor <= current && start + SCHEDULE_MIN_LENGTH <= SCHEDULE_SPAN_MINUTES) {
    return { start, end: start + SCHEDULE_MIN_LENGTH };
  }
  if (end - SCHEDULE_MIN_LENGTH >= 0) return { start: end - SCHEDULE_MIN_LENGTH, end };
  return { start: 0, end: SCHEDULE_MIN_LENGTH };
}

export function shiftPlacementError(
  shifts: readonly ScheduleShift[],
  draft: ShiftDraft,
  ignoreId?: string,
  cashiers?: ReadonlySet<string>,
): ShiftPlacementError | null {
  if (draft.kind !== "cash" && draft.kind !== "tournament" && draft.kind !== "cashier") return "kind";
  if (draft.kind === "cashier" && cashiers && !cashiers.has(draft.userId)) return "cashier";
  if (!Number.isInteger(draft.startMinutes) || !Number.isInteger(draft.endMinutes)) return "range";
  if (
    draft.startMinutes < 0 ||
    draft.endMinutes > SCHEDULE_SPAN_MINUTES ||
    draft.endMinutes - draft.startMinutes < SCHEDULE_MIN_LENGTH ||
    draft.startMinutes % SCHEDULE_SNAP_MINUTES !== 0 ||
    draft.endMinutes % SCHEDULE_SNAP_MINUTES !== 0
  ) {
    return "range";
  }
  const hit = shifts.some(
    (shift) =>
      shift.id !== ignoreId &&
      shift.userId === draft.userId &&
      shift.workDate === draft.workDate &&
      draft.startMinutes < shift.endMinutes &&
      draft.endMinutes > shift.startMinutes,
  );
  return hit ? "overlap" : null;
}
