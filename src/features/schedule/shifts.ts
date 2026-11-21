import type { RoomSnapshot, ScheduleKind, ScheduleShift } from '../../types/room.ts'
import { SCHEDULE_MIN_LENGTH, SCHEDULE_SNAP_MINUTES, SCHEDULE_SPAN_MINUTES } from './grid.ts'

export interface ShiftDraft {
  dealerId: string
  kind: ScheduleKind
  startMinutes: number
  endMinutes: number
}

function rangesOverlap(start: number, end: number, other: ScheduleShift): boolean {
  return start < other.endMinutes && end > other.startMinutes
}

export function shiftPlacementError(
  snapshot: RoomSnapshot,
  draft: ShiftDraft,
  ignoreId?: string,
): string | null {
  if (!snapshot.dealers.some((dealer) => dealer.id === draft.dealerId)) {
    return 'Croupier introuvable.'
  }
  if (draft.kind !== 'cash' && draft.kind !== 'tournament') return 'Type de quart invalide.'
  if (!Number.isInteger(draft.startMinutes) || !Number.isInteger(draft.endMinutes)) {
    return 'Plage invalide.'
  }
  if (
    draft.startMinutes < 0 ||
    draft.endMinutes > SCHEDULE_SPAN_MINUTES ||
    draft.endMinutes - draft.startMinutes < SCHEDULE_MIN_LENGTH
  ) {
    return 'Le quart doit rester entre 10:00 et 04:00.'
  }
  if (
    draft.startMinutes % SCHEDULE_SNAP_MINUTES !== 0 ||
    draft.endMinutes % SCHEDULE_SNAP_MINUTES !== 0
  ) {
    return 'Le quart se cale sur 15 minutes.'
  }
  const hit = snapshot.shifts.some(
    (shift) =>
      shift.id !== ignoreId &&
      shift.dealerId === draft.dealerId &&
      rangesOverlap(draft.startMinutes, draft.endMinutes, shift),
  )
  if (hit) return 'Ce croupier a déjà un quart sur cette plage.'
  return null
}

let sequence = 0

export function resetScheduleIds(): void {
  sequence = 0
}

function nextId(): string {
  sequence += 1
  return `shift-${sequence}`
}

export function addScheduleShift(
  snapshot: RoomSnapshot,
  draft: ShiftDraft,
): { snapshot: RoomSnapshot; error: string | null } {
  const error = shiftPlacementError(snapshot, draft)
  if (error) return { snapshot, error }
  const shift: ScheduleShift = { id: nextId(), ...draft }
  return { snapshot: { ...snapshot, shifts: [...snapshot.shifts, shift] }, error: null }
}

export function moveScheduleShift(
  snapshot: RoomSnapshot,
  shiftId: string,
  draft: ShiftDraft,
): { snapshot: RoomSnapshot; error: string | null } {
  const current = snapshot.shifts.find((shift) => shift.id === shiftId)
  if (!current) return { snapshot, error: 'Quart introuvable.' }
  const error = shiftPlacementError(snapshot, draft, shiftId)
  if (error) return { snapshot, error }
  return {
    snapshot: {
      ...snapshot,
      shifts: snapshot.shifts.map((shift) =>
        shift.id === shiftId ? { ...shift, ...draft } : shift,
      ),
    },
    error: null,
  }
}

export function removeScheduleShift(
  snapshot: RoomSnapshot,
  shiftId: string,
): { snapshot: RoomSnapshot; error: string | null } {
  if (!snapshot.shifts.some((shift) => shift.id === shiftId)) {
    return { snapshot, error: 'Quart introuvable.' }
  }
  return {
    snapshot: { ...snapshot, shifts: snapshot.shifts.filter((shift) => shift.id !== shiftId) },
    error: null,
  }
}
