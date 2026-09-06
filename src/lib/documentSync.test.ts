import { describe, it, expect } from 'vitest'
import { hashValue, planPull, type SyncMeta } from './documentSync'

const KEY = 'plan-financier-profiles-v1'
const row = (value: string | null, updated_at = '2026-09-06T10:00:00.000Z') => ({ key: KEY, value, updated_at })

describe('hashValue', () => {
  it('est stable et distingue les valeurs', () => {
    expect(hashValue('abc')).toBe(hashValue('abc'))
    expect(hashValue('abc')).not.toBe(hashValue('abd'))
    expect(hashValue(null)).toBe('null')
  })
})

describe('planPull', () => {
  it('applique un document distant inconnu localement', () => {
    const plan = planPull([row('[{"id":"p"}]')], {}, { [KEY]: null })
    expect(plan.apply).toEqual([{ key: KEY, value: '[{"id":"p"}]', updated_at: '2026-09-06T10:00:00.000Z' }])
  })

  it('ignore un document déjà vu (même updated_at)', () => {
    const meta: SyncMeta = { [KEY]: { remote: '2026-09-06T10:00:00.000Z' } }
    expect(planPull([row('x')], meta, { [KEY]: 'y' }).apply).toHaveLength(0)
  })

  it('le local non poussé plus récent gagne', () => {
    const meta: SyncMeta = { [KEY]: { dirtyAt: Date.parse('2026-09-06T11:00:00.000Z') } }
    expect(planPull([row('remote')], meta, { [KEY]: 'local' }).apply).toHaveLength(0)
  })

  it('le distant gagne sur un local non poussé plus ancien', () => {
    const meta: SyncMeta = { [KEY]: { dirtyAt: Date.parse('2026-09-06T09:00:00.000Z') } }
    expect(planPull([row('remote')], meta, { [KEY]: 'local' }).apply).toHaveLength(1)
  })

  it('même contenu → seulement la méta', () => {
    const plan = planPull([row('same')], {}, { [KEY]: 'same' })
    expect(plan.apply).toHaveLength(0)
    expect(plan.seen).toEqual([{ key: KEY, updated_at: '2026-09-06T10:00:00.000Z', hash: hashValue('same') }])
  })

  it('un document distant supprimé retire la clé locale', () => {
    const plan = planPull([row(null)], {}, { [KEY]: 'local' })
    expect(plan.apply).toEqual([{ key: KEY, value: null, updated_at: '2026-09-06T10:00:00.000Z' }])
  })

  it('ignore les clés qui ne sont pas des documents', () => {
    const plan = planPull([{ key: 'plan-financier-transactions-v1', value: '[]', updated_at: '2026-09-06T10:00:00.000Z' }], {}, {})
    expect(plan.apply).toHaveLength(0)
  })
})
