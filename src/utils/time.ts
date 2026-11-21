export const TIME_ZONE = 'America/Toronto'
export const SHIFT_START_MINUTES = 17 * 60
export const SHIFT_END_MINUTES = 23 * 60

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function zonedParts(date: Date, timeZone = TIME_ZONE): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = fmt.formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  let hour = pick('hour')
  if (hour === 24) hour = 0
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour,
    minute: pick('minute'),
    second: pick('second'),
  }
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  timeZone = TIME_ZONE,
): Date {
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  let utc = desiredUtc
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(utc), timeZone)
    const actualUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    )
    const diff = desiredUtc - actualUtc
    if (diff === 0) break
    utc += diff
  }
  return new Date(utc)
}

export function shiftStart(clockIso: string): Date {
  const parts = zonedParts(new Date(clockIso))
  return zonedTimeToUtc(parts.year, parts.month, parts.day, 17, 0, 0)
}

export function shiftEnd(clockIso: string): Date {
  const parts = zonedParts(new Date(clockIso))
  return zonedTimeToUtc(parts.year, parts.month, parts.day, 23, 0, 0)
}

export function isWithinShift(date: Date, clockIso: string): boolean {
  const time = date.getTime()
  return time >= shiftStart(clockIso).getTime() && time <= shiftEnd(clockIso).getTime()
}

export function formatTime(iso: string): string {
  const parts = zonedParts(new Date(iso))
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

export function formatNoteStamp(iso: string): string {
  return `${formatShiftDate(iso)} · ${formatTime(iso)}`
}

export function formatShiftDate(iso: string): string {
  const date = new Date(iso)
  const parts = zonedParts(date)
  const weekday = new Intl.DateTimeFormat('fr-CA', {
    timeZone: TIME_ZONE,
    weekday: 'short',
  }).format(date)
  const month = new Intl.DateTimeFormat('fr-CA', {
    timeZone: TIME_ZONE,
    month: 'short',
  }).format(date)
  const label = `${weekday} ${parts.day} ${month} ${parts.year}`
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function minutesFromShiftStart(iso: string): number {
  return (new Date(iso).getTime() - shiftStart(iso).getTime()) / 60_000
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}
