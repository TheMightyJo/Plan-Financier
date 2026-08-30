import { describe, expect, it } from 'vitest'
import { mondayOf, weeklyStats } from './weeklyStats'
import type { Transaction } from '../types'

const tx = (date: string, amount: number, kind: 'depense' | 'revenu' = 'depense'): Transaction => ({
  id: Math.random(),
  label: 'test',
  amount,
  category: 'Autre',
  member: 'moi',
  date,
  kind,
  envelope: 'Perso',
})

describe('mondayOf', () => {
  it('renvoie le lundi de la semaine (ISO)', () => {
    expect(mondayOf('2026-08-30')).toBe('2026-08-24') // dimanche → lundi précédent
    expect(mondayOf('2026-08-24')).toBe('2026-08-24') // lundi → lui-même
    expect(mondayOf('2026-08-26')).toBe('2026-08-24') // mercredi
  })
})

describe('weeklyStats', () => {
  it('agrège dépenses et revenus du lundi au dimanche', () => {
    const stats = weeklyStats(
      [tx('2026-08-24', 100), tx('2026-08-30', 50), tx('2026-08-26', 500, 'revenu')],
      '2026-08-30',
      2,
    )
    const current = stats.at(-1)!
    expect(current.weekStart).toBe('2026-08-24')
    expect(current.weekEnd).toBe('2026-08-30')
    expect(current.spent).toBe(150)
    expect(current.income).toBe(500)
    expect(current.net).toBe(350)
  })

  it('type danger quand le solde de la semaine est négatif', () => {
    const stats = weeklyStats([tx('2026-08-25', 200)], '2026-08-30', 1)
    expect(stats[0].type).toBe('danger')
  })

  it('type highest pour le record absolu, up pour une progression, normal sinon', () => {
    const stats = weeklyStats(
      [
        // S-2 : +100 ; S-1 : +50 (baisse → normal) ; S0 : +900 (record → highest)
        tx('2026-08-10', 100, 'revenu'),
        tx('2026-08-18', 50, 'revenu'),
        tx('2026-08-26', 900, 'revenu'),
      ],
      '2026-08-30',
      3,
    )
    expect(stats[0].type).toBe('up') // +100 vs semaine précédente vide (0)
    expect(stats[1].type).toBe('normal') // +50 après +100
    expect(stats[2].type).toBe('highest')
  })

  it('le record se mesure sur tout l’historique, pas seulement la fenêtre', () => {
    const stats = weeklyStats(
      [
        tx('2026-01-05', 5000, 'revenu'), // vieux record hors fenêtre
        tx('2026-08-26', 900, 'revenu'),
      ],
      '2026-08-30',
      2,
    )
    // +900 n'est pas le record absolu (5000 en janvier) → up, pas highest.
    expect(stats.at(-1)!.type).toBe('up')
  })

  it('renvoie le bon nombre de semaines, la plus ancienne d’abord', () => {
    const stats = weeklyStats([], '2026-08-30', 4)
    expect(stats).toHaveLength(4)
    expect(stats[0].weekStart < stats[3].weekStart).toBe(true)
    expect(stats[3].weekStart).toBe('2026-08-24')
  })
})
