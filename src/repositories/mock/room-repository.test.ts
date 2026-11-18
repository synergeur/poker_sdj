import { describe, expect, it } from 'vitest'
import { createInitialSnapshot } from '../../data/mock/initial-state.ts'
import { closeTable } from '../../features/room/operations.ts'
import { memoryStore } from '../memory-store.ts'
import { ROOM_STORAGE_KEY, createMockRoomRepository } from './room-repository.ts'

describe('mock room repository', () => {
  it('loads the fictional floor when storage is empty', async () => {
    const repository = createMockRoomRepository(memoryStore())
    const snapshot = await repository.load()
    expect(snapshot.tables).toHaveLength(11)
    expect(snapshot.dealers).toHaveLength(11)
  })

  it('round-trips a changed floor', async () => {
    const store = memoryStore()
    const repository = createMockRoomRepository(store)
    const closed = closeTable(createInitialSnapshot(), 'HN-02')
    await repository.save(closed.snapshot)
    const loaded = await repository.load()
    expect(loaded.tables.find((table) => table.id === 'HN-02')?.status).toBe('closed')
    expect(store.getItem(ROOM_STORAGE_KEY)).toContain('HN-12')
  })

  it('falls back when stored data is unreadable', async () => {
    const store = memoryStore()
    store.setItem(ROOM_STORAGE_KEY, '{not json')
    const repository = createMockRoomRepository(store)
    const snapshot = await repository.load()
    expect(snapshot.version).toBe(1)
    expect(snapshot.tables.some((table) => table.id === 'HN-02')).toBe(true)
  })

  it('reset restores the starting floor', async () => {
    const repository = createMockRoomRepository(memoryStore())
    await repository.save(closeTable(createInitialSnapshot(), 'HN-02').snapshot)
    const fresh = await repository.reset()
    expect(fresh.tables.find((table) => table.id === 'HN-02')?.status).toBe('open')
    expect(await repository.load()).toEqual(createInitialSnapshot())
  })
})
