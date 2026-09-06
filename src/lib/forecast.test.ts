import { describe, it, expect } from 'vitest'
import { computeForecast, lastDayOfMonth, upcomingFixedUntil, variableDailyRate } from './forecast'
import type { RecurringRule, Transaction } from '../types'

const rule = (overrides: Partial<RecurringRule> = {}): RecurringRule => ({
  id: 'r1',
  member: 'principal',
  category: 'Maison',
  envelope: 'Maison',
  label: 'Loyer',
  amount: 800,
  kind: 'depense',
  frequency: 'monthly',
  dayOfPeriod: 20,
  startDate: '2026-01-01',
  endDate: null,
  lastGeneratedOn: null,
  pausedAt: null,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

const tx = (date: string, amount: number, overrides: Partial<Transaction> = {}): Transaction => ({
  id: Math.round(Math.random() * 1e9),
  label: 'x',
  amount,
  category: 'Courses',
  member: 'principal',
  date,
  kind: 'depense',
  envelope: 'Maison',
  ...overrides,
})

describe('lastDayOfMonth', () => {
  it('gère février et les mois de 31 jours', () => {
    expect(lastDayOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(lastDayOfMonth('2028-02-10')).toBe('2028-02-29')
    expect(lastDayOfMonth('2026-09-06')).toBe('2026-09-30')
  })
})

describe('upcomingFixedUntil', () => {
  it('liste les occurrences non matérialisées et ignore les règles en pause', () => {
    const rules = [rule(), rule({ id: 'r2', label: 'Netflix', amount: 15, dayOfPeriod: 25, pausedAt: 1 })]
    const items = upcomingFixedUntil(rules, [], '2026-09-07', '2026-09-30')
    expect(items).toEqual([{ date: '2026-09-20', label: 'Loyer', amount: 800, kind: 'depense', ruleId: 'r1' }])
  })

  it("exclut l'occurrence déjà saisie", () => {
    const items = upcomingFixedUntil([rule()], [tx('2026-09-20', 800, { recurringRuleId: 'r1' })], '2026-09-07', '2026-09-30')
    expect(items).toHaveLength(0)
  })
})

describe('variableDailyRate', () => {
  it('moyenne les dépenses variables des 28 derniers jours (hors récurrent)', () => {
    const transactions = [
      tx('2026-08-20', 280),
      tx('2026-08-25', 280),
      tx('2026-08-28', 800, { recurringRuleId: 'r1' }),
      tx('2026-07-01', 999),
    ]
    const { rate, historyDays } = variableDailyRate(transactions, '2026-09-06')
    expect(rate).toBeCloseTo(560 / 28, 2)
    expect(historyDays).toBe(28)
  })

  it('historique court : divise par les jours couverts (plancher 14)', () => {
    const { rate, historyDays } = variableDailyRate([tx('2026-09-04', 70)], '2026-09-06')
    expect(historyDays).toBe(2)
    expect(rate).toBeCloseTo(5, 5)
  })

  it('écarte les dépenses exceptionnelles (> 20 % du budget) du rythme', () => {
    // Historique couvert : 17 jours (du 20 août au 6 septembre).
    const transactions = [tx('2026-08-20', 850), tx('2026-08-25', 280)]
    expect(variableDailyRate(transactions, '2026-09-06', 2200).rate).toBeCloseTo(280 / 17, 5)
    expect(variableDailyRate(transactions, '2026-09-06').rate).toBeCloseTo(1130 / 17, 5)
  })

  it('sans historique : 0', () => {
    expect(variableDailyRate([], '2026-09-06')).toEqual({ rate: 0, historyDays: 0 })
  })
})

describe('computeForecast', () => {
  it('retire les charges fixes à leur date, ajoute les revenus, détecte le découvert', () => {
    const rules = [rule(), rule({ id: 'r2', label: 'Salaire', amount: 500, kind: 'revenu', dayOfPeriod: 28 })]
    const forecast = computeForecast({ todayIso: '2026-09-06', remaining: 700, rules, transactions: [] })
    expect(forecast.daysLeft).toBe(24)
    expect(forecast.fixedExpenses).toBe(800)
    expect(forecast.fixedIncomes).toBe(500)
    expect(forecast.variableDailyRate).toBe(0)
    // 700 − 800 (le 20) = −100 ; +500 (le 28) = 400
    expect(forecast.points.find((p) => p.date === '2026-09-20')?.projected).toBe(-100)
    expect(forecast.firstNegativeDate).toBe('2026-09-20')
    expect(forecast.endOfMonth).toBe(400)
    expect(forecast.status).toBe('ok')
  })

  it('applique le rythme variable jour par jour', () => {
    const transactions = Array.from({ length: 28 }, (_, i) => tx(`2026-08-${String(9 + (i % 20)).padStart(2, '0')}`, 10))
    const forecast = computeForecast({ todayIso: '2026-09-06', remaining: 100, rules: [], transactions })
    expect(forecast.variableDailyRate).toBeCloseTo(10, 5)
    expect(forecast.endOfMonth).toBeCloseTo(100 - 240, 2)
    expect(forecast.status).toBe('negative')
    expect(forecast.firstNegativeDate).toBe('2026-09-17')
  })

  it('dernier jour du mois : aucun jour restant', () => {
    const forecast = computeForecast({ todayIso: '2026-09-30', remaining: 50, rules: [rule()], transactions: [] })
    expect(forecast.daysLeft).toBe(0)
    expect(forecast.points).toHaveLength(1)
    expect(forecast.endOfMonth).toBe(50)
  })

  it('statut tendu quand il reste moins de 3 jours de marge', () => {
    const transactions = Array.from({ length: 10 }, (_, i) => tx(`2026-08-${String(10 + i).padStart(2, '0')}`, 28))
    // rythme 10 €/j sur 28 j ; reste 24 j → 240 € variables ; reste 260 → fin 20 € < 30
    const forecast = computeForecast({ todayIso: '2026-09-06', remaining: 260, rules: [], transactions })
    expect(forecast.status).toBe('tight')
  })
})
