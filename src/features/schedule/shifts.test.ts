import { describe, expect, it } from 'vitest'
import { createInitialSnapshot } from '../../data/mock/initial-state.ts'
import { formatScheduleMinutes, orderedRange } from './grid.ts'
import { addScheduleShift, moveScheduleShift, removeScheduleShift } from './shifts.ts'

describe('schedule grid', () => {
  it('labels 10:00 through 04:00 the next day', () => {
    expect(formatScheduleMinutes(0)).toBe('10:00')
    expect(formatScheduleMinutes(14 * 60)).toBe('00:00')
    expect(formatScheduleMinutes(18 * 60)).toBe('04:00')
  })

  it('grows a drag to at least 30 minutes', () => {
    expect(orderedRange(120, 120)).toEqual({ start: 120, end: 150 })
    expect(orderedRange(120, 200)).toEqual({ start: 120, end: 200 })
  })
})

describe('schedule shifts', () => {
  it('adds a cash block, moves it, and refuses an overlap', () => {
    const initial = createInitialSnapshot()
    const added = addScheduleShift(initial, {
      dealerId: 'CC66',
      kind: 'cash',
      startMinutes: 60,
      endMinutes: 240,
    })
    expect(added.error).toBeNull()
    const id = added.snapshot.shifts.find(
      (shift) => shift.dealerId === 'CC66' && shift.startMinutes === 60,
    )?.id
    expect(id).toBeTruthy()
    const moved = moveScheduleShift(added.snapshot, id!, {
      dealerId: 'CC68',
      kind: 'cash',
      startMinutes: 300,
      endMinutes: 480,
    })
    expect(moved.snapshot.shifts.find((shift) => shift.id === id)).toMatchObject({
      dealerId: 'CC68',
      startMinutes: 300,
    })
    const overlap = addScheduleShift(moved.snapshot, {
      dealerId: 'CC68',
      kind: 'tournament',
      startMinutes: 360,
      endMinutes: 540,
    })
    expect(overlap.error).toMatch(/déjà un quart/)
    expect(overlap.snapshot).toBe(moved.snapshot)
    const removed = removeScheduleShift(moved.snapshot, id!)
    expect(removed.snapshot.shifts.some((shift) => shift.id === id)).toBe(false)
  })
})
