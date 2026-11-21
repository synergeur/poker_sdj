import { createInitialSnapshot } from '../../data/mock/initial-state.ts'
import type { Dealer, RoomSettings, RoomSnapshot } from '../../types/room.ts'
import { browserStore } from '../memory-store.ts'
import type { KeyValueStore, RoomRepository } from '../types.ts'

export const ROOM_STORAGE_KEY = 'poker-room-snapshot-v2'

function isSnapshot(value: unknown): value is RoomSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<RoomSnapshot>
  return (
    snapshot.version === 1 &&
    typeof snapshot.clock === 'string' &&
    Array.isArray(snapshot.tables) &&
    Array.isArray(snapshot.dealers) &&
    Array.isArray(snapshot.segments) &&
    typeof snapshot.settings === 'object' &&
    snapshot.settings !== null
  )
}

function asRecord(value: object): Record<string, unknown> {
  return value as Record<string, unknown>
}

export function normalizeSnapshot(snapshot: RoomSnapshot): RoomSnapshot {
  const settings = asRecord(snapshot.settings)
  const rotationMode = settings.rotationMode === 'manual' ? 'manual' : 'auto'
  const interval = settings.rotationIntervalMinutes
  const rotationIntervalMinutes =
    interval === 15 || interval === 30 || interval === 45 || interval === 60 ? interval : 30
  const noteAuthor =
    typeof settings.noteAuthor === 'string' && settings.noteAuthor.trim()
      ? settings.noteAuthor.trim()
      : 'Superviseur'
  const nextSettings: RoomSettings = { rotationMode, rotationIntervalMinutes, noteAuthor }
  const rawShifts = asRecord(snapshot).shifts
  return {
    ...snapshot,
    settings: nextSettings,
    shifts: Array.isArray(rawShifts)
      ? snapshot.shifts
      : createInitialSnapshot().shifts.map((shift) => ({ ...shift })),
    dealers: snapshot.dealers.map((dealer) => {
      const raw = asRecord(dealer)
      return {
        ...dealer,
        availability: Array.isArray(raw.availability) ? dealer.availability : [],
        evaluations: Array.isArray(raw.evaluations) ? dealer.evaluations : [],
        comments: Array.isArray(raw.comments) ? dealer.comments : [],
      } satisfies Dealer
    }),
  }
}

export function createMockRoomRepository(store: KeyValueStore = browserStore()): RoomRepository {
  return {
    async load() {
      const raw = store.getItem(ROOM_STORAGE_KEY)
      if (!raw) return createInitialSnapshot()
      try {
        const parsed: unknown = JSON.parse(raw)
        if (!isSnapshot(parsed)) return createInitialSnapshot()
        return normalizeSnapshot(parsed)
      } catch {
        return createInitialSnapshot()
      }
    },
    async save(snapshot) {
      store.setItem(ROOM_STORAGE_KEY, JSON.stringify(snapshot))
    },
    async reset() {
      store.removeItem(ROOM_STORAGE_KEY)
      return createInitialSnapshot()
    },
  }
}
