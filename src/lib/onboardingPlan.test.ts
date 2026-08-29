import { describe, it, expect } from 'vitest'
import { generateOnboardingPlan, type OnboardingAnswers } from './onboardingPlan'

// Midi UTC le 15 → pas d'effet de bord de fuseau sur le mois de l'échéance.
const NOW = Date.UTC(2026, 0, 15, 12)

const answers = (over: Partial<OnboardingAnswers>): OnboardingAnswers => ({
  situation: null,
  revenus: null,
  objectif: null,
  niveau: null,
  ...over,
})

describe('generateOnboardingPlan — profils & budgets', () => {
  it('solo → 1 profil avec tout le budget du foyer', () => {
    const plan = generateOnboardingPlan(answers({ situation: 'solo', revenus: '1500-2500' }), NOW)
    expect(plan.profiles).toEqual([{ id: 'moi', name: 'Moi', monthlyBudget: 2000 }])
    expect(plan.defaultProfileId).toBe('moi')
  })

  it('couple → 2 profils, budgets répartis, somme = foyer', () => {
    const plan = generateOnboardingPlan(answers({ situation: 'couple', revenus: '1500-2500' }), NOW)
    expect(plan.profiles.map((p) => p.id)).toEqual(['moi', 'conjoint'])
    expect(plan.profiles.reduce((s, p) => s + p.monthlyBudget, 0)).toBe(2000)
  })

  it('famille → 3 profils (dont Enfants), somme = foyer', () => {
    const plan = generateOnboardingPlan(answers({ situation: 'famille', revenus: '1500-2500' }), NOW)
    expect(plan.profiles.map((p) => p.id)).toEqual(['moi', 'conjoint', 'enfants'])
    expect(plan.profiles.find((p) => p.id === 'enfants')?.monthlyBudget).toBe(400)
    expect(plan.profiles.reduce((s, p) => s + p.monthlyBudget, 0)).toBe(2000)
  })

  it('tous les budgets sont des entiers ≥ 200', () => {
    for (const situation of ['solo', 'couple', 'famille'] as const) {
      for (const revenus of ['lt1500', '1500-2500', '2500-4000', 'gt4000'] as const) {
        const plan = generateOnboardingPlan(answers({ situation, revenus }), NOW)
        for (const p of plan.profiles) {
          expect(Number.isInteger(p.monthlyBudget)).toBe(true)
          expect(p.monthlyBudget).toBeGreaterThanOrEqual(200)
        }
      }
    }
  })
})

describe('generateOnboardingPlan — objectif d’épargne', () => {
  it('mappe objectif → libellé + montant cible (multiple du budget foyer)', () => {
    const cases = [
      { objectif: 'epargner', label: 'Épargne de précaution', amount: 6000 },
      { objectif: 'maitriser', label: 'Matelas de sécurité', amount: 2000 },
      { objectif: 'rembourser', label: 'Remboursement de dettes', amount: 4000 },
      { objectif: 'investir', label: 'Capital à investir', amount: 12000 },
    ] as const
    for (const c of cases) {
      const plan = generateOnboardingPlan(
        answers({ situation: 'solo', revenus: '1500-2500', objectif: c.objectif }),
        NOW,
      )
      const target = plan.savingsTargets[0]
      expect(target.label).toBe(c.label)
      expect(target.targetAmount).toBe(c.amount)
      expect(target.id).toBe(`onboarding-${c.objectif}`)
      expect(target.member).toBe('moi')
      expect(target.currentSaved).toBe(0)
    }
  })

  it('horizon d’échéance selon le niveau (debutant 12m, expert 6m)', () => {
    const debutant = generateOnboardingPlan(answers({ niveau: 'debutant' }), NOW)
    const expert = generateOnboardingPlan(answers({ niveau: 'expert' }), NOW)
    expect(debutant.savingsTargets[0].targetDate).toMatch(/^2027-01-\d{2}$/)
    expect(expert.savingsTargets[0].targetDate).toMatch(/^2026-07-\d{2}$/)
  })
})

describe('generateOnboardingPlan — réponses manquantes', () => {
  it('retombe sur des valeurs par défaut (solo / 2000 / épargner / debutant)', () => {
    const plan = generateOnboardingPlan(answers({}), NOW)
    expect(plan.profiles).toEqual([{ id: 'moi', name: 'Moi', monthlyBudget: 2000 }])
    expect(plan.savingsTargets[0].label).toBe('Épargne de précaution')
    expect(plan.savingsTargets[0].targetDate).toMatch(/^2027-01-/)
  })
})
