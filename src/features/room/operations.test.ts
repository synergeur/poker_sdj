import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialSnapshot } from '../../data/mock/initial-state.ts'
import { formatTime } from '../../utils/time.ts'
import {
  advanceClock,
  assignDealer,
  closeTable,
  findAssignmentConflicts,
  openTable,
  resetOperationIds,
  setDealerStatus,
  setGameType,
  setRotationInterval,
  setRotationMode,
  setShiftTime,
  unassignDealer,
} from './operations.ts'
import { summarize } from './summary.ts'

function expectClean(snapshot: ReturnType<typeof createInitialSnapshot>) {
  expect(findAssignmentConflicts(snapshot)).toEqual([])
}

describe('table open and close', () => {
  beforeEach(() => resetOperationIds())

  it('starts from the reference floor without assignment conflicts', () => {
    const snapshot = createInitialSnapshot()
    const summary = summarize(snapshot)
    expect(summary).toMatchObject({
      tournamentTables: 5,
      cashTables: 2,
      closedTables: 4,
      openWithoutDealer: 0,
      dealersAssigned: 7,
      dealersOnBreak: 0,
      dealersAvailable: 4,
      dealersInRoom: 11,
    })
    expect(formatTime(snapshot.clock)).toBe('19:44')
    expectClean(snapshot)
  })

  it('opens a closed table only after a game type is chosen', () => {
    const initial = createInitialSnapshot()
    const opened = openTable(initial, 'HN-08', 'cash')
    expect(opened.error).toBeNull()
    const table = opened.snapshot.tables.find((item) => item.id === 'HN-08')
    expect(table).toMatchObject({ status: 'open', gameType: 'cash', dealerId: null })
    expect(summarize(opened.snapshot).cashTables).toBe(3)
    expect(summarize(opened.snapshot).openWithoutDealer).toBe(1)
    expectClean(opened.snapshot)
    expect(initial.tables.find((item) => item.id === 'HN-08')?.status).toBe('closed')
  })

  it('closes a table, frees the dealer, and clears the game type', () => {
    const closed = closeTable(createInitialSnapshot(), 'HN-02')
    expect(closed.error).toBeNull()
    expect(closed.snapshot.tables.find((item) => item.id === 'HN-02')).toMatchObject({
      status: 'closed',
      gameType: 'unassigned',
      dealerId: null,
    })
    expect(closed.snapshot.dealers.find((item) => item.id === 'CC63')).toMatchObject({
      status: 'available',
      currentTableId: null,
      isAvailable: true,
    })
    const segment = closed.snapshot.segments.find(
      (item) => item.dealerId === 'CC63' && item.end === null,
    )
    expect(segment?.kind).toBe('available')
    expectClean(closed.snapshot)
  })

  it('keeps the dealer when the game type changes', () => {
    const changed = setGameType(createInitialSnapshot(), 'HN-10', 'tournament')
    expect(changed.error).toBeNull()
    expect(changed.snapshot.tables.find((item) => item.id === 'HN-10')).toMatchObject({
      gameType: 'tournament',
      dealerId: 'CC67',
      status: 'open',
    })
    expectClean(changed.snapshot)
  })

  it('refuses a game type change on a closed table', () => {
    const initial = createInitialSnapshot()
    const changed = setGameType(initial, 'HN-07', 'cash')
    expect(changed.error).toMatch(/Ouvrez/)
    expect(changed.snapshot).toBe(initial)
  })
})

describe('dealer assignment', () => {
  beforeEach(() => resetOperationIds())

  it('blocks a second table for the same dealer and a dealer on a closed table', () => {
    const initial = createInitialSnapshot()
    const opened = openTable(initial, 'HN-08', 'tournament')
    expect(assignDealer(opened.snapshot, 'HN-08', 'CC63').error).toMatch(/déjà à HN-02/)
    expect(assignDealer(initial, 'HN-08', 'CC66').error).toMatch(/Ouvrez/)
    expect(assignDealer(initial, 'HN-04', 'CC66').error).toMatch(/CC64 est déjà/)
    expectClean(initial)
  })

  it('moves an available dealer onto a table after the current dealer leaves', () => {
    const freed = unassignDealer(createInitialSnapshot(), 'HN-02')
    const assigned = assignDealer(freed.snapshot, 'HN-02', 'CC66')
    expect(assigned.error).toBeNull()
    expect(assigned.snapshot.dealers.find((item) => item.id === 'CC66')).toMatchObject({
      status: 'assigned',
      currentTableId: 'HN-02',
      isAvailable: false,
    })
    expect(assigned.snapshot.dealers.find((item) => item.id === 'CC63')?.status).toBe('available')
    expect(assigned.snapshot.tables.find((item) => item.id === 'HN-02')?.dealerId).toBe('CC66')
    expectClean(assigned.snapshot)
  })

  it('sends a dealer on break and leaves the table open without anyone', () => {
    const paused = setDealerStatus(createInitialSnapshot(), 'CC73', 'on_break')
    expect(paused.error).toBeNull()
    expect(paused.snapshot.dealers.find((item) => item.id === 'CC73')).toMatchObject({
      status: 'on_break',
      currentTableId: null,
      isAvailable: false,
    })
    expect(paused.snapshot.tables.find((item) => item.id === 'HN-11')).toMatchObject({
      status: 'open',
      gameType: 'cash',
      dealerId: null,
    })
    expect(
      paused.snapshot.segments.find((item) => item.dealerId === 'CC73' && item.end === null)?.kind,
    ).toBe('break')
    expect(assignDealer(paused.snapshot, 'HN-11', 'CC73').error).toMatch(/pause/)
    expectClean(paused.snapshot)
  })

  it('does not assign a dealer who is off shift, then allows it once they return', () => {
    const away = setDealerStatus(createInitialSnapshot(), 'CC66', 'off_shift')
    expect(assignDealer(away.snapshot, 'HN-08', 'CC66').error).toBeTruthy()
    const opened = openTable(away.snapshot, 'HN-08', 'tournament')
    expect(assignDealer(opened.snapshot, 'HN-08', 'CC66').error).toMatch(/hors quart/)
    const back = setDealerStatus(opened.snapshot, 'CC66', 'available')
    const seated = assignDealer(back.snapshot, 'HN-08', 'CC66')
    expect(seated.error).toBeNull()
    expectClean(seated.snapshot)
  })

  it('replaces a same-time status instead of stacking empty segments', () => {
    const freed = unassignDealer(createInitialSnapshot(), 'HN-04')
    const paused = setDealerStatus(freed.snapshot, 'CC64', 'on_break')
    const open = paused.snapshot.segments.filter(
      (item) => item.dealerId === 'CC64' && item.end === null,
    )
    expect(open).toHaveLength(1)
    expect(open[0]?.kind).toBe('break')
    expectClean(paused.snapshot)
  })
})

describe('clock and rotation settings', () => {
  beforeEach(() => resetOperationIds())

  it('moves the clock without moving dealers', () => {
    const initial = createInitialSnapshot()
    const later = advanceClock(initial, 16)
    expect(later.error).toBeNull()
    expect(formatTime(later.snapshot.clock)).toBe('20:00')
    expect(later.snapshot.dealers).toEqual(initial.dealers)
    expect(later.snapshot.tables).toEqual(initial.tables)
    expect(later.snapshot.segments).toEqual(initial.segments)
  })

  it('stops at 23:00', () => {
    const end = advanceClock(createInitialSnapshot(), 8 * 60)
    expect(formatTime(end.snapshot.clock)).toBe('23:00')
    const stuck = advanceClock(end.snapshot, 15)
    expect(stuck.error).toMatch(/23:00/)
    expect(formatTime(stuck.snapshot.clock)).toBe('23:00')
  })

  it('rejects a time outside the shift', () => {
    const initial = createInitialSnapshot()
    const early = setShiftTime(initial, 16, 30)
    expect(early.error).toMatch(/17:00/)
    expect(early.snapshot).toBe(initial)
  })

  it('stores rotation preferences without creating movement', () => {
    const initial = createInitialSnapshot()
    const changed = setRotationInterval(setRotationMode(initial, 'manual').snapshot, 15)
    expect(changed.snapshot.settings).toMatchObject({
      rotationMode: 'manual',
      rotationIntervalMinutes: 15,
    })
    expect(changed.snapshot.segments).toEqual(initial.segments)
    expect(changed.snapshot.dealers).toEqual(initial.dealers)
    expectClean(changed.snapshot)
  })
})
