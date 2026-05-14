import { describe, it, expect } from 'vitest'
import { getDateDistanceInDays } from './dates'

describe('getDateDistanceInDays', () => {
  it('retourne 0 pour deux dates identiques', () => {
    expect(getDateDistanceInDays('2026-04-10', '2026-04-10')).toBe(0)
  })

  it("retourne 1 pour deux jours consécutifs", () => {
    expect(getDateDistanceInDays('2026-04-10', '2026-04-11')).toBe(1)
  })

  it('est symétrique (valeur absolue)', () => {
    expect(getDateDistanceInDays('2026-04-15', '2026-04-10')).toBe(5)
    expect(getDateDistanceInDays('2026-04-10', '2026-04-15')).toBe(5)
  })

  it('gère le passage de mois', () => {
    expect(getDateDistanceInDays('2026-03-31', '2026-04-02')).toBe(2)
  })
})
