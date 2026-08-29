import { describe, it, expect } from 'vitest'
import { buildMonthGrid, getISOWeek, shiftDay, shiftMonth } from './calendar'

describe('getISOWeek', () => {
  it('cas connus ISO 8601', () => {
    expect(getISOWeek('2026-01-01')).toBe(1)
    expect(getISOWeek('2026-07-08')).toBe(28)
    expect(getISOWeek('2026-12-31')).toBe(53)
    // Le 1er janvier 2027 appartient à la semaine 53 de 2026.
    expect(getISOWeek('2027-01-01')).toBe(53)
  })
})

describe('buildMonthGrid', () => {
  it('juillet 2026 : commence un mercredi, 5 semaines complètes', () => {
    const weeks = buildMonthGrid('2026-07')
    expect(weeks).toHaveLength(5)
    // Complétion avec fin juin (lundi 29, mardi 30).
    expect(weeks[0].days[0]).toEqual({ date: '2026-06-29', day: 29, inMonth: false })
    expect(weeks[0].days[2]).toEqual({ date: '2026-07-01', day: 1, inMonth: true })
    // Dernière case : dimanche 2 août.
    expect(weeks[4].days[6]).toEqual({ date: '2026-08-02', day: 2, inMonth: false })
    // Toutes les semaines font 7 jours.
    for (const week of weeks) expect(week.days).toHaveLength(7)
  })

  it('numéros de semaine cohérents et croissants', () => {
    const weeks = buildMonthGrid('2026-07')
    expect(weeks[0].weekNumber).toBe(27)
    expect(weeks.map((w) => w.weekNumber)).toEqual([27, 28, 29, 30, 31])
  })

  it('février non bissextile : grille exacte', () => {
    const weeks = buildMonthGrid('2026-02')
    const inMonthDays = weeks.flatMap((w) => w.days).filter((d) => d.inMonth)
    expect(inMonthDays).toHaveLength(28)
  })
})

describe('shiftMonth / shiftDay', () => {
  it('passe les frontières d’année', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDay('2026-02-28', 1)).toBe('2026-03-01')
  })
})
