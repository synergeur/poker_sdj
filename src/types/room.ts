export const ROTATION_INTERVALS = [15, 30, 45, 60] as const

export type RotationInterval = (typeof ROTATION_INTERVALS)[number]
export type GameType = 'tournament' | 'cash' | 'unassigned'
export type TableStatus = 'open' | 'closed'
export type DealerStatus = 'assigned' | 'on_break' | 'available' | 'off_shift'
export type RotationMode = 'auto' | 'manual'
export type TimelineView = 'rotation' | 'breaks'
export type ActivityKind = 'table' | 'break' | 'available' | 'off_shift'
export type TableRow = 'top' | 'bottom'
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface AvailabilitySlot {
  id: string
  day: Weekday
  start: string
  end: string
}

export interface DealerEvaluation {
  id: string
  at: string
  author: string
  score: number
  note: string
}

export interface DealerComment {
  id: string
  at: string
  author: string
  text: string
  dealerAware: boolean
}

export interface PokerTable {
  id: string
  gameType: GameType
  status: TableStatus
  dealerId: string | null
  timelineColor: string
  row: TableRow
  seat: number
}

export interface Dealer {
  id: string
  displayName: string
  status: DealerStatus
  currentTableId: string | null
  isAvailable: boolean
  availability: AvailabilitySlot[]
  evaluations: DealerEvaluation[]
  comments: DealerComment[]
}

export type ScheduleKind = 'cash' | 'tournament'

export interface ScheduleShift {
  id: string
  dealerId: string
  kind: ScheduleKind
  startMinutes: number
  endMinutes: number
}

export interface ActivitySegment {
  id: string
  dealerId: string
  kind: ActivityKind
  tableId: string | null
  start: string
  end: string | null
}

export interface RoomSettings {
  rotationMode: RotationMode
  rotationIntervalMinutes: RotationInterval
  noteAuthor: string
}

export interface RoomSnapshot {
  version: 1
  clock: string
  settings: RoomSettings
  tables: PokerTable[]
  dealers: Dealer[]
  segments: ActivitySegment[]
  shifts: ScheduleShift[]
}

export interface RoomSummary {
  tournamentTables: number
  cashTables: number
  closedTables: number
  openWithoutDealer: number
  dealersInRoom: number
  dealersAssigned: number
  dealersOnBreak: number
  dealersAvailable: number
  dealersOffShift: number
}

export type Selection = { type: 'table'; id: string } | { type: 'dealer'; id: string }
