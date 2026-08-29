import { describe, it, expect } from 'vitest'
import { mergeById } from './cloudSync'

describe('mergeById', () => {
  it('union : local + entrées distantes inconnues', () => {
    const local = [{ id: 1, v: 'a' }, { id: 2, v: 'b' }]
    const remote = [{ id: 2, v: 'REMOTE' }, { id: 3, v: 'c' }]
    const { merged, addedFromRemote } = mergeById(local, remote)
    expect(merged).toHaveLength(3)
    expect(addedFromRemote).toBe(1)
  })

  it('le local gagne sur conflit d’id', () => {
    const local = [{ id: 7, v: 'local' }]
    const remote = [{ id: 7, v: 'remote' }]
    const { merged } = mergeById(local, remote)
    expect(merged).toEqual([{ id: 7, v: 'local' }])
  })

  it('compare les ids en tant que chaînes (number local vs string distant)', () => {
    const local: Array<{ id: string | number; v: string }> = [{ id: 42, v: 'n' }]
    const remote: Array<{ id: string | number; v: string }> = [{ id: '42', v: 's' }]
    const { merged, addedFromRemote } = mergeById(local, remote)
    expect(merged).toHaveLength(1)
    expect(addedFromRemote).toBe(0)
  })

  it('distant vide → local inchangé ; local vide → tout vient du distant', () => {
    expect(mergeById([{ id: 1 }], []).merged).toHaveLength(1)
    const pull = mergeById<{ id: number }>([], [{ id: 1 }, { id: 2 }])
    expect(pull.merged).toHaveLength(2)
    expect(pull.addedFromRemote).toBe(2)
  })
})
