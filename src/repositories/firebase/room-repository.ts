import { isFirebaseConfigured } from '../../config/env.ts'
import type { RoomSnapshot } from '../../types/room.ts'
import type { RoomRepository } from '../types.ts'

/**
 * Boundary for a later Firestore adapter.
 * This visual prototype does not import the Firebase SDK and does not write
 * anywhere except the mock repository selected by the app.
 */
export function createFirebaseRoomRepository(): RoomRepository {
  const reason = isFirebaseConfigured()
    ? "Firestore n'est pas branché dans ce prototype visuel."
    : 'Firebase est activé, mais la configuration publique du projet est incomplète.'

  return {
    async load(): Promise<RoomSnapshot> {
      throw new Error(reason)
    },
    async save(): Promise<void> {
      throw new Error(reason)
    },
    async reset(): Promise<RoomSnapshot> {
      throw new Error(reason)
    },
  }
}
