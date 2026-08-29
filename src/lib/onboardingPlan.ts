// Générateur de plan financier « sur mesure » à partir des réponses du
// questionnaire d'onboarding — chemin MANUEL, sans IA. Déterministe et pur
// (le seul « présent » vient du paramètre `now`), donc entièrement testable.
//
// Produit ce que l'app sait persister : profils + budgets mensuels + un objectif
// d'épargne (SavingsTarget). Les enveloppes (Perso/Maison/Vacances) et catégories
// sont déjà des constantes fixes du code — rien à générer de ce côté.
import type { SavingsTarget, UserProfile } from '../types'

export type OnboardingSituation = 'solo' | 'couple' | 'famille'
export type OnboardingRevenus = 'lt1500' | '1500-2500' | '2500-4000' | 'gt4000'
export type OnboardingObjectif = 'epargner' | 'maitriser' | 'rembourser' | 'investir'
export type OnboardingNiveau = 'debutant' | 'habitue' | 'expert'

export type OnboardingAnswers = {
  situation: OnboardingSituation | null
  revenus: OnboardingRevenus | null
  objectif: OnboardingObjectif | null
  niveau: OnboardingNiveau | null
}

export type GeneratedPlan = {
  profiles: UserProfile[]
  defaultProfileId: string
  savingsTargets: SavingsTarget[]
}

// Budget mensuel du foyer estimé depuis la tranche de revenus (arrondi « rond »).
const HOUSEHOLD_BUDGET: Record<OnboardingRevenus, number> = {
  lt1500: 1300,
  '1500-2500': 2000,
  '2500-4000': 3200,
  gt4000: 4800,
}

// Objectif d'épargne : libellé + multiple du budget mensuel du foyer visé.
const SAVINGS_GOAL: Record<OnboardingObjectif, { label: string; months: number }> = {
  epargner: { label: 'Épargne de précaution', months: 3 },
  maitriser: { label: 'Matelas de sécurité', months: 1 },
  rembourser: { label: 'Remboursement de dettes', months: 2 },
  investir: { label: 'Capital à investir', months: 6 },
}

// Horizon (mois) de l'objectif selon l'aisance déclarée : un débutant se voit
// proposer un rythme plus doux (échéance plus lointaine) qu'un profil expert.
const HORIZON_MONTHS: Record<OnboardingNiveau, number> = {
  debutant: 12,
  habitue: 9,
  expert: 6,
}

const SAVINGS_COLOR = '#3A7D44' // vert « épargne » de la charte

const roundTo = (value: number, step: number) => Math.round(value / step) * step
const budget = (value: number) => Math.max(200, roundTo(value, 10))

const addMonthsISO = (now: number, months: number): string => {
  const date = new Date(now)
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

const buildProfiles = (
  situation: OnboardingSituation,
  household: number,
): UserProfile[] => {
  if (situation === 'solo') {
    return [{ id: 'moi', name: 'Moi', monthlyBudget: budget(household) }]
  }

  if (situation === 'couple') {
    const first = budget(household / 2)
    return [
      { id: 'moi', name: 'Moi', monthlyBudget: first },
      { id: 'conjoint', name: 'Conjoint·e', monthlyBudget: budget(household - first) },
    ]
  }

  // famille : ~20 % du foyer réservé aux dépenses des enfants, le reste réparti
  // entre les deux adultes.
  const enfants = budget(household * 0.2)
  const adultsTotal = Math.max(400, household - enfants)
  const first = budget(adultsTotal / 2)
  return [
    { id: 'moi', name: 'Moi', monthlyBudget: first },
    { id: 'conjoint', name: 'Conjoint·e', monthlyBudget: budget(adultsTotal - first) },
    { id: 'enfants', name: 'Enfants', monthlyBudget: enfants },
  ]
}

/**
 * Construit un plan complet depuis les réponses du questionnaire. Les réponses
 * manquantes retombent sur des valeurs par défaut raisonnables.
 * @param now Epoch ms servant à dater l'objectif (injecté pour la testabilité).
 */
export const generateOnboardingPlan = (
  answers: OnboardingAnswers,
  now: number,
): GeneratedPlan => {
  const situation = answers.situation ?? 'solo'
  const revenus = answers.revenus ?? '1500-2500'
  const objectif = answers.objectif ?? 'epargner'
  const niveau = answers.niveau ?? 'debutant'

  const household = HOUSEHOLD_BUDGET[revenus]
  const profiles = buildProfiles(situation, household)
  const defaultProfileId = profiles[0].id

  const goal = SAVINGS_GOAL[objectif]
  const targetAmount = roundTo(household * goal.months, 100)
  const savingsTarget: SavingsTarget = {
    id: `onboarding-${objectif}`,
    label: goal.label,
    targetAmount,
    targetDate: addMonthsISO(now, HORIZON_MONTHS[niveau]),
    currentSaved: 0,
    displayColor: SAVINGS_COLOR,
    member: defaultProfileId,
    createdAt: now,
    updatedAt: now,
  }

  return { profiles, defaultProfileId, savingsTargets: [savingsTarget] }
}
