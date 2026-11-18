import { describe, expect, it } from 'vitest'
import { formatShiftDate, formatTime, isWithinShift, zonedTimeToUtc } from './time.ts'

describe('room clock', () => {
  it('places 19:44 on 17 November 2026 in Toronto', () => {
    const clock = zonedTimeToUtc(2026, 11, 17, 19, 44, 0).toISOString()
    expect(formatTime(clock)).toBe('19:44')
    expect(formatShiftDate(clock).toLowerCase()).toContain('17')
    expect(formatShiftDate(clock).toLowerCase()).toContain('2026')
  })

  it('keeps the displayed shift inside 17:00 and 23:00', () => {
    const clock = zonedTimeToUtc(2026, 11, 17, 19, 44, 0).toISOString()
    expect(isWithinShift(zonedTimeToUtc(2026, 11, 17, 17, 0, 0), clock)).toBe(true)
    expect(isWithinShift(zonedTimeToUtc(2026, 11, 17, 23, 0, 0), clock)).toBe(true)
    expect(isWithinShift(zonedTimeToUtc(2026, 11, 17, 16, 59, 0), clock)).toBe(false)
    expect(isWithinShift(zonedTimeToUtc(2026, 11, 17, 23, 1, 0), clock)).toBe(false)
  })
})
