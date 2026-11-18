import type { KeyValueStore } from './types.ts'

export function memoryStore(): KeyValueStore {
  const values = new Map<string, string>()
  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

export function browserStore(): KeyValueStore {
  if (typeof localStorage === 'undefined') return memoryStore()
  return localStorage
}
