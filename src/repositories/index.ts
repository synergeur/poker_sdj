import { env } from '../config/env.ts'
import { createFirebaseRoomRepository } from './firebase/room-repository.ts'
import { createMockRoomRepository } from './mock/room-repository.ts'
import type { RoomRepository } from './types.ts'

export function createRoomRepository(): RoomRepository {
  if (env.enableFirebase && !env.useMockData) return createFirebaseRoomRepository()
  return createMockRoomRepository()
}

export type { RoomRepository } from './types.ts'
