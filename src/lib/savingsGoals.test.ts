import { describe, it, expect } from 'vitest'
import {
  monthsRemaining,
  computeCurrentSaved,
  progressPercent,
  recommendedMonthlyAmount,
  computeGoalStatus,
  validateGoal,
} from './savingsGoals'
import type { Account, SavingsTarget } from '../types'

const goal = (overrides: Partial<SavingsTarget> = {}): SavingsTarget => ({
  id: 'g1',
  label: 'Vacances',
  targetAmount: 3000,
  ...overrides,
})

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'a1',
  ownerMember: 'principal',
  name: 'Livret A',
  type: 'savings',
  currency: 'EUR',
  initialBalance: 0,
  displayColor: null,
  displayIcon: null,
  archivedAt: null,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

describe('monthsRemaining', () => {
  it("renvoie 0 si la cible est passée", () => {
    expect(monthsRemaining('2026-05-15', '2026-04-15')).toBe(0)
  })

  it("renvoie 0 si la cible est aujourd'hui", () => {
    expect(monthsRemaining('2026-05-15', '2026-05-15')).toBe(0)
  })

  it('1 mois si cible dans 30 jours', () => {
    expect(monthsRemaining('2026-05-15', '2026-06-14')).toBe(1)
  })

  it('12 mois si cible dans 1 an', () => {
    expect(monthsRemaining('2026-05-15', '2027-05-15')).toBe(12)
  })

  it('arrondi supérieur (minimum 1) pour les durées < 1 mois mais > 0', () => {
    expect(monthsRemaining('2026-05-15', '2026-05-20')).toBe(1)
  })
})

describe('computeCurrentSaved', () => {
  it("utilise la balance du compte si lié", () => {
    const g = goal({ destinationAccountId: 'a1' })
    const a = account({ id: 'a1', initialBalance: 1500 })
    expect(computeCurrentSaved(g, [a], [])).toBe(1500)
  })

  it("fallback sur currentSaved si pas de compte", () => {
    const g = goal({ currentSaved: 800 })
    expect(computeCurrentSaved(g, [], [])).toBe(800)
  })

  it("fallback à 0 si rien n'est défini", () => {
    expect(computeCurrentSaved(goal(), [], [])).toBe(0)
  })
})

describe('progressPercent', () => {
  it('renvoie 0 si target = 0', () => {
    expect(progressPercent(100, 0)).toBe(0)
  })

  it('renvoie 50 pour moitié', () => {
    expect(progressPercent(500, 1000)).toBe(50)
  })

  it('clampé à 100', () => {
    expect(progressPercent(1500, 1000)).toBe(100)
  })

  it('clampé à 0 si négatif', () => {
    expect(progressPercent(-50, 1000)).toBe(0)
  })
})

describe('recommendedMonthlyAmount', () => {
  it('null si pas de targetDate', () => {
    expect(recommendedMonthlyAmount(goal(), 0)).toBeNull()
  })

  it('null si déjà atteint', () => {
    expect(
      recommendedMonthlyAmount(goal({ targetDate: '2027-01-01' }), 5000, '2026-05-15'),
    ).toBeNull()
  })

  it('3000 sur 12 mois = 250/mois', () => {
    expect(
      recommendedMonthlyAmount(goal({ targetDate: '2027-05-15' }), 0, '2026-05-15'),
    ).toBe(250)
  })

  it('reste à mettre / mois restants', () => {
    const result = recommendedMonthlyAmount(
      goal({ targetAmount: 3000, targetDate: '2026-11-15' }),
      900,
      '2026-05-15',
    )
    // 2100 / 7 mois = 300 (monthsRemaining arrondit au mois supérieur)
    expect(result).toBeCloseTo(300, 0)
  })
})

describe('computeGoalStatus', () => {
  it('achieved si current >= target', () => {
    expect(computeGoalStatus(goal({ targetAmount: 1000 }), 1000, '2026-05-15')).toBe('achieved')
    expect(computeGoalStatus(goal({ targetAmount: 1000 }), 1200, '2026-05-15')).toBe('achieved')
  })

  it('on_track si pas de date', () => {
    expect(computeGoalStatus(goal(), 500, '2026-05-15')).toBe('on_track')
  })

  it('late si targetDate passée et non atteint', () => {
    expect(
      computeGoalStatus(goal({ targetDate: '2026-04-01' }), 500, '2026-05-15'),
    ).toBe('late')
  })

  it("tight si mensualité requise > 30% du restant", () => {
    // 3000 - 0 = 3000 restant ; 1 mois → 3000/mois > 900 (30%) → tight
    expect(
      computeGoalStatus(goal({ targetDate: '2026-06-10' }), 0, '2026-05-15'),
    ).toBe('tight')
  })
})

describe('validateGoal', () => {
  it('valide un objectif correct', () => {
    expect(validateGoal(goal({ targetDate: '2099-01-01' }))).toBeNull()
  })

  it('rejette label vide', () => {
    expect(validateGoal(goal({ label: '  ' }))).toBe('label_required')
  })

  it('rejette montant ≤ 0', () => {
    expect(validateGoal(goal({ targetAmount: 0 }))).toBe('target_amount_must_be_positive')
    expect(validateGoal(goal({ targetAmount: -10 }))).toBe('target_amount_must_be_positive')
  })

  it('rejette date dans le passé', () => {
    expect(validateGoal(goal({ targetDate: '2000-01-01' }))).toBe('target_date_in_past')
  })
})
