import type { RoomSnapshot } from '../types/room.ts'

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface RoomRepository {
  load(): Promise<RoomSnapshot>
  save(snapshot: RoomSnapshot): Promise<void>
  reset(): Promise<RoomSnapshot>
}
