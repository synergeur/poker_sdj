import { createInitialSnapshot } from '../../data/mock/initial-state.ts'
import type { RoomSnapshot } from '../../types/room.ts'
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

export function createMockRoomRepository(store: KeyValueStore = browserStore()): RoomRepository {
  return {
    async load() {
      const raw = store.getItem(ROOM_STORAGE_KEY)
      if (!raw) return createInitialSnapshot()
      try {
        const parsed: unknown = JSON.parse(raw)
        if (!isSnapshot(parsed)) return createInitialSnapshot()
        return parsed
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
