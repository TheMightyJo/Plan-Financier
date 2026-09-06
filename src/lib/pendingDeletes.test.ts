import { describe, it, expect } from 'vitest'
import { clearPendingDeletes, queuePendingDeletes, readPendingDeletes } from './pendingDeletes'

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

describe('pendingDeletes', () => {
  it('met en file, dédoublonne et vide', () => {
    const s = new MemoryStorage()
    queuePendingDeletes([1, '2', 1], s)
    expect(readPendingDeletes(s)).toEqual(['1', '2'])
    clearPendingDeletes(['1'], s)
    expect(readPendingDeletes(s)).toEqual(['2'])
    clearPendingDeletes(['2'], s)
    expect(readPendingDeletes(s)).toEqual([])
    expect(s.getItem('plan-financier-pending-deletes-v1')).toBeNull()
  })
})
