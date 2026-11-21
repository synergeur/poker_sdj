export const SCHEDULE_ORIGIN_MINUTES = 10 * 60
export const SCHEDULE_SPAN_MINUTES = 18 * 60
export const SCHEDULE_SNAP_MINUTES = 15
export const SCHEDULE_MIN_LENGTH = 30

export function snapScheduleMinutes(value: number): number {
  const snapped = Math.round(value / SCHEDULE_SNAP_MINUTES) * SCHEDULE_SNAP_MINUTES
  return Math.min(SCHEDULE_SPAN_MINUTES, Math.max(0, snapped))
}

export function formatScheduleMinutes(offset: number): string {
  const clock = (SCHEDULE_ORIGIN_MINUTES + offset) % (24 * 60)
  const hours = Math.floor(clock / 60)
  const minutes = clock % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function minutesFromRatio(ratio: number): number {
  const clamped = Math.min(1, Math.max(0, ratio))
  return snapScheduleMinutes(clamped * SCHEDULE_SPAN_MINUTES)
}

export function orderedRange(anchor: number, current: number): { start: number; end: number } {
  const start = Math.min(anchor, current)
  const end = Math.max(anchor, current)
  if (end - start >= SCHEDULE_MIN_LENGTH) return { start, end }
  if (anchor <= current && start + SCHEDULE_MIN_LENGTH <= SCHEDULE_SPAN_MINUTES) {
    return { start, end: start + SCHEDULE_MIN_LENGTH }
  }
  if (end - SCHEDULE_MIN_LENGTH >= 0) return { start: end - SCHEDULE_MIN_LENGTH, end }
  return { start: 0, end: SCHEDULE_MIN_LENGTH }
}
