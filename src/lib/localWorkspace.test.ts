import { describe, it, expect } from 'vitest'
import { switchLocalWorkspace, readCurrentLocalUser } from './localWorkspace'

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

const seeded = () => {
  const s = new MemoryStorage()
  s.setItem('plan-financier-transactions-v1', '[{"id":1}]')
  s.setItem('plan-financier-profiles-v1', '[{"id":"principal"}]')
  s.setItem('plan-financier-chat-history-v1:principal', '[]')
  s.setItem('plan-financier-theme-v1', 'dark')
  return s
}

describe('switchLocalWorkspace', () => {
  it("attribue les données existantes au premier compte sans bascule", () => {
    const s = seeded()
    expect(switchLocalWorkspace('user-a', s)).toBe(false)
    expect(readCurrentLocalUser(s)).toBe('user-a')
    expect(s.getItem('plan-financier-transactions-v1')).toBe('[{"id":1}]')
  })

  it('ne fait rien si le compte est déjà en place', () => {
    const s = seeded()
    s.setItem('plan-financier-current-user-v1', 'user-a')
    expect(switchLocalWorkspace('user-a', s)).toBe(false)
    expect(s.getItem('plan-financier-transactions-v1')).toBe('[{"id":1}]')
  })

  it('vide les données pour un nouveau compte et garde les préférences', () => {
    const s = seeded()
    s.setItem('plan-financier-current-user-v1', 'user-a')
    expect(switchLocalWorkspace('user-b', s)).toBe(true)
    expect(s.getItem('plan-financier-transactions-v1')).toBeNull()
    expect(s.getItem('plan-financier-profiles-v1')).toBeNull()
    expect(s.getItem('plan-financier-chat-history-v1:principal')).toBeNull()
    expect(s.getItem('plan-financier-theme-v1')).toBe('dark')
    expect(readCurrentLocalUser(s)).toBe('user-b')
    expect(s.getItem('plan-financier-workspace-v1:user-a')).toContain('"plan-financier-transactions-v1"')
  })

  it('restaure les données du compte qui revient', () => {
    const s = seeded()
    s.setItem('plan-financier-current-user-v1', 'user-a')
    switchLocalWorkspace('user-b', s)
    s.setItem('plan-financier-transactions-v1', '[{"id":99}]')
    expect(switchLocalWorkspace('user-a', s)).toBe(true)
    expect(s.getItem('plan-financier-transactions-v1')).toBe('[{"id":1}]')
    const snapshotB = JSON.parse(s.getItem('plan-financier-workspace-v1:user-b') ?? '{}') as Record<string, string>
    expect(snapshotB['plan-financier-transactions-v1']).toBe('[{"id":99}]')
    expect(s.getItem('plan-financier-workspace-v1:user-a')).toBeNull()
  })
})
