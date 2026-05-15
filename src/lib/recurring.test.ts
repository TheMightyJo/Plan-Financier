import { describe, it, expect } from 'vitest'
import {
  clampDayToMonth,
  getNextOccurrence,
  getOccurrencesBetween,
  validateRule,
  generateDueTransactions,
} from './recurring'
import type { RecurringRule } from '../types'

const baseRule = (overrides: Partial<RecurringRule> = {}): RecurringRule => ({
  id: 'rule-1',
  member: 'principal',
  category: 'Maison',
  envelope: 'Maison',
  label: 'Loyer',
  amount: 1200,
  kind: 'depense',
  frequency: 'monthly',
  dayOfPeriod: 5,
  startDate: '2026-01-01',
  endDate: null,
  lastGeneratedOn: null,
  pausedAt: null,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

describe('clampDayToMonth', () => {
  it('retourne la valeur si valide', () => {
    expect(clampDayToMonth(2026, 0, 15)).toBe(15) // janvier
  })

  it("ramène 31 février à 28 (année non bissextile)", () => {
    expect(clampDayToMonth(2026, 1, 31)).toBe(28)
  })

  it("ramène 31 février à 29 (année bissextile)", () => {
    expect(clampDayToMonth(2024, 1, 31)).toBe(29)
  })

  it('ramène 31 avril à 30', () => {
    expect(clampDayToMonth(2026, 3, 31)).toBe(30)
  })
})

describe('getNextOccurrence — mensuel', () => {
  it("renvoie le 5 du mois courant si on est avant le 5", () => {
    const rule = baseRule({ frequency: 'monthly', dayOfPeriod: 5 })
    expect(getNextOccurrence(rule, '2026-05-01')).toBe('2026-05-05')
  })

  it('renvoie le 5 du mois suivant si on est après le 5', () => {
    const rule = baseRule({ frequency: 'monthly', dayOfPeriod: 5 })
    expect(getNextOccurrence(rule, '2026-05-10')).toBe('2026-06-05')
  })

  it('renvoie le 5 du jour même si on est le 5', () => {
    const rule = baseRule({ frequency: 'monthly', dayOfPeriod: 5 })
    expect(getNextOccurrence(rule, '2026-05-05')).toBe('2026-05-05')
  })

  it('respecte startDate (occurrence avant startDate non générée)', () => {
    const rule = baseRule({ startDate: '2026-06-01', dayOfPeriod: 15 })
    expect(getNextOccurrence(rule, '2026-01-01')).toBe('2026-06-15')
  })

  it('ramène 31 février au dernier jour du mois (clamp)', () => {
    const rule = baseRule({ dayOfPeriod: 31 })
    expect(getNextOccurrence(rule, '2026-02-15')).toBe('2026-02-28')
  })
})

describe('getNextOccurrence — hebdomadaire', () => {
  it('renvoie le prochain lundi (1) à partir de jeudi', () => {
    // 2026-05-14 = jeudi (ISO dow 4)
    const rule = baseRule({ frequency: 'weekly', dayOfPeriod: 1 })
    expect(getNextOccurrence(rule, '2026-05-14')).toBe('2026-05-18')
  })

  it('renvoie le jour même si on tombe pile dessus', () => {
    // 2026-05-14 = jeudi (ISO dow 4)
    const rule = baseRule({ frequency: 'weekly', dayOfPeriod: 4 })
    expect(getNextOccurrence(rule, '2026-05-14')).toBe('2026-05-14')
  })
})

describe('getNextOccurrence — pause / fin', () => {
  it('renvoie null si la règle est en pause', () => {
    const rule = baseRule({ pausedAt: Date.now() })
    expect(getNextOccurrence(rule, '2026-05-01')).toBeNull()
  })

  it('renvoie null si endDate est dépassée', () => {
    const rule = baseRule({ endDate: '2026-04-30' })
    expect(getNextOccurrence(rule, '2026-05-10')).toBeNull()
  })
})

describe('getOccurrencesBetween', () => {
  it('liste 3 occurrences mensuelles sur un trimestre', () => {
    const rule = baseRule({ dayOfPeriod: 5 })
    expect(getOccurrencesBetween(rule, '2026-04-01', '2026-06-30')).toEqual([
      '2026-04-05',
      '2026-05-05',
      '2026-06-05',
    ])
  })

  it('respecte la borne haute', () => {
    const rule = baseRule({ dayOfPeriod: 28 })
    expect(getOccurrencesBetween(rule, '2026-01-01', '2026-02-15')).toEqual(['2026-01-28'])
  })
})

describe('validateRule', () => {
  it('valide une règle correcte', () => {
    expect(validateRule(baseRule())).toBeNull()
  })

  it('rejette label vide', () => {
    expect(validateRule(baseRule({ label: '   ' }))).toBe('label_required')
  })

  it('rejette montant ≤ 0', () => {
    expect(validateRule(baseRule({ amount: 0 }))).toBe('amount_must_be_positive')
    expect(validateRule(baseRule({ amount: -10 }))).toBe('amount_must_be_positive')
  })

  it('rejette dayOfPeriod 0 ou 8 pour weekly', () => {
    expect(validateRule(baseRule({ frequency: 'weekly', dayOfPeriod: 0 }))).toBe('invalid_day_for_weekly')
    expect(validateRule(baseRule({ frequency: 'weekly', dayOfPeriod: 8 }))).toBe('invalid_day_for_weekly')
  })

  it('rejette dayOfPeriod > 31 pour monthly', () => {
    expect(validateRule(baseRule({ dayOfPeriod: 32 }))).toBe('invalid_day_for_monthly')
  })

  it('rejette endDate avant startDate', () => {
    expect(
      validateRule(baseRule({ startDate: '2026-05-01', endDate: '2026-04-01' })),
    ).toBe('end_before_start')
  })
})

describe('generateDueTransactions', () => {
  let counter = 1
  const nextId = () => counter++

  it("génère les transactions manquantes depuis startDate", () => {
    counter = 100
    const rule = baseRule({ startDate: '2026-03-05', dayOfPeriod: 5 })
    const { transactions, lastGeneratedOn } = generateDueTransactions(rule, '2026-05-15', nextId)
    expect(transactions.map((t) => t.date)).toEqual(['2026-03-05', '2026-04-05', '2026-05-05'])
    expect(transactions[0].label).toBe('Loyer')
    expect(transactions[0].amount).toBe(1200)
    expect(lastGeneratedOn).toBe('2026-05-05')
  })

  it("est idempotent : ne re-génère pas après lastGeneratedOn", () => {
    counter = 200
    const rule = baseRule({
      startDate: '2026-03-05',
      lastGeneratedOn: '2026-04-05',
      dayOfPeriod: 5,
    })
    const { transactions, lastGeneratedOn } = generateDueTransactions(rule, '2026-04-20', nextId)
    expect(transactions).toEqual([])
    expect(lastGeneratedOn).toBe('2026-04-05')
  })

  it("ne génère rien si la règle est en pause", () => {
    counter = 300
    const rule = baseRule({ startDate: '2026-01-01', pausedAt: Date.now() })
    const { transactions } = generateDueTransactions(rule, '2026-05-15', nextId)
    expect(transactions).toEqual([])
  })

  it("respecte endDate", () => {
    counter = 400
    const rule = baseRule({ startDate: '2026-01-05', endDate: '2026-03-05', dayOfPeriod: 5 })
    const { transactions } = generateDueTransactions(rule, '2026-12-31', nextId)
    expect(transactions.map((t) => t.date)).toEqual(['2026-01-05', '2026-02-05', '2026-03-05'])
  })
})
