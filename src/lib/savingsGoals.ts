import type { Account, SavingsContribution, SavingsTarget, Transaction } from '../types'
import { computeAccountBalance } from './accounts'

/**
 * Helpers purs pour les objectifs d'épargne (savings goals).
 * Mirror partiel de la table savings_goals du schéma Supabase.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Nombre de mois (entiers, arrondi supérieur) entre `fromIso` et `targetIso`.
 * Retourne 0 si la cible est passée (objectif en retard) — l'UI affichera
 * un avertissement.
 */
export const monthsRemaining = (fromIso: string, targetIso: string): number => {
  const from = new Date(`${fromIso}T00:00:00Z`)
  const target = new Date(`${targetIso}T00:00:00Z`)
  if (target.getTime() <= from.getTime()) return 0
  const diffMs = target.getTime() - from.getTime()
  const diffDays = diffMs / MS_PER_DAY
  // ~30.44 jours par mois en moyenne (365.25 / 12)
  return Math.max(1, Math.ceil(diffDays / 30.44))
}

/**
 * Renvoie le montant épargné aujourd'hui :
 * - si goal.destinationAccountId : balance du compte (auto)
 * - sinon : goal.currentSaved (manuel, fallback 0)
 */
export const computeCurrentSaved = (
  goal: SavingsTarget,
  accounts: Account[],
  transactions: Transaction[],
): number => {
  if (goal.destinationAccountId) {
    const account = accounts.find((a) => a.id === goal.destinationAccountId)
    if (account) return computeAccountBalance(account, transactions)
  }
  return goal.currentSaved ?? 0
}

/**
 * Progression en pourcentage (0..100, clampé). Sécurise division par 0.
 */
export const progressPercent = (currentSaved: number, targetAmount: number): number => {
  if (targetAmount <= 0) return 0
  const raw = (currentSaved / targetAmount) * 100
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.min(100, raw))
}

/**
 * Mensualité conseillée pour atteindre l'objectif à temps.
 * Renvoie null si pas de date cible OU si déjà atteint.
 */
export const recommendedMonthlyAmount = (
  goal: SavingsTarget,
  currentSaved: number,
  todayIso: string = new Date().toISOString().slice(0, 10),
): number | null => {
  if (!goal.targetDate) return null
  if (currentSaved >= goal.targetAmount) return null
  const remaining = goal.targetAmount - currentSaved
  const months = monthsRemaining(todayIso, goal.targetDate)
  if (months === 0) return remaining // tout sur ce mois : objectif en retard
  return remaining / months
}

export type GoalStatus =
  | 'achieved'    // currentSaved >= targetAmount
  | 'on_track'    // pas de date OU progression cohérente avec le temps écoulé
  | 'late'        // date cible passée et pas atteint
  | 'tight'       // mensualité requise > 30% du montant restant (signal "ça va être serré")

/**
 * Diagnostique l'état de l'objectif pour piloter l'affichage (badge, couleur).
 */
export const computeGoalStatus = (
  goal: SavingsTarget,
  currentSaved: number,
  todayIso: string = new Date().toISOString().slice(0, 10),
): GoalStatus => {
  if (currentSaved >= goal.targetAmount) return 'achieved'
  if (!goal.targetDate) return 'on_track'
  if (goal.targetDate < todayIso) return 'late'

  const monthly = recommendedMonthlyAmount(goal, currentSaved, todayIso)
  if (monthly !== null) {
    const remaining = goal.targetAmount - currentSaved
    if (monthly > remaining * 0.3) return 'tight'
  }
  return 'on_track'
}

export type GoalValidationError =
  | 'label_required'
  | 'target_amount_must_be_positive'
  | 'target_date_in_past'

export const validateGoal = (goal: Partial<SavingsTarget>): GoalValidationError | null => {
  if (!goal.label || goal.label.trim().length === 0) return 'label_required'
  if (typeof goal.targetAmount !== 'number' || goal.targetAmount <= 0) {
    return 'target_amount_must_be_positive'
  }
  if (goal.targetDate) {
    const today = new Date().toISOString().slice(0, 10)
    if (goal.targetDate < today) return 'target_date_in_past'
  }
  return null
}

// ── V2 : versements, rythme, projection ──────────────────────────────

/** Fenêtre d'observation du rythme d'épargne (jours). */
export const PACE_WINDOW_DAYS = 90

const createContributionId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `contrib-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

/**
 * Enregistre un versement (ou un retrait si amount < 0) sur l'objectif.
 * Sans compte lié, `currentSaved` est mis à jour ; avec compte lié, seule
 * l'historique est enrichi (le solde du compte fait foi).
 * Un objectif atteint après versement n'est pas verrouillé automatiquement :
 * c'est l'utilisateur qui « marque atteint » (achievedAt).
 */
export const addContribution = (
  goal: SavingsTarget,
  amount: number,
  dateIso: string = new Date().toISOString().slice(0, 10),
): SavingsTarget => {
  if (!Number.isFinite(amount) || amount === 0) return goal
  const entry: SavingsContribution = { id: createContributionId(), date: dateIso, amount }
  const contributions = [...(goal.contributions ?? []), entry]
  const next: SavingsTarget = { ...goal, contributions, updatedAt: Date.now() }
  if (!goal.destinationAccountId) {
    next.currentSaved = Math.max(0, (goal.currentSaved ?? 0) + amount)
  }
  return next
}

/**
 * Rythme d'épargne observé : total des versements des `PACE_WINDOW_DAYS`
 * derniers jours, ramené au mois. Null si aucun versement dans la fenêtre
 * (rien à projeter).
 */
export const monthlyPace = (
  goal: SavingsTarget,
  todayIso: string = new Date().toISOString().slice(0, 10),
): number | null => {
  const contributions = goal.contributions ?? []
  if (contributions.length === 0) return null
  const today = new Date(`${todayIso}T00:00:00Z`).getTime()
  const windowStart = today - PACE_WINDOW_DAYS * MS_PER_DAY
  const inWindow = contributions.filter((c) => {
    const t = new Date(`${c.date}T00:00:00Z`).getTime()
    return t >= windowStart && t <= today
  })
  if (inWindow.length === 0) return null
  // La fenêtre démarre au premier versement observé (pas de mois « vides »
  // avant qu'on ne commence à épargner), avec un plancher d'un mois.
  const first = Math.min(...inWindow.map((c) => new Date(`${c.date}T00:00:00Z`).getTime()))
  const observedDays = Math.max(30.44, (today - first) / MS_PER_DAY + 1)
  const total = inWindow.reduce((sum, c) => sum + c.amount, 0)
  if (total <= 0) return null
  return total / (observedDays / 30.44)
}

/**
 * Date (YYYY-MM-DD) à laquelle l'objectif sera atteint au rythme observé.
 * Null si pas de rythme ou déjà atteint.
 */
export const projectedCompletionDate = (
  goal: SavingsTarget,
  currentSaved: number,
  pace: number | null,
  todayIso: string = new Date().toISOString().slice(0, 10),
): string | null => {
  if (pace === null || pace <= 0) return null
  const remaining = goal.targetAmount - currentSaved
  if (remaining <= 0) return null
  const days = Math.ceil((remaining / pace) * 30.44)
  const date = new Date(new Date(`${todayIso}T00:00:00Z`).getTime() + days * MS_PER_DAY)
  return date.toISOString().slice(0, 10)
}

export type PaceOutlook = {
  /** Rythme observé (€/mois). */
  pace: number
  /** Date projetée d'atteinte. */
  projectedDate: string
  /** Écart en mois vs la date cible : négatif = en avance, positif = en retard, null sans échéance. */
  monthsDelta: number | null
}

/** Synthèse « à ce rythme » prête pour l'affichage. Null si rien à projeter. */
export const computePaceOutlook = (
  goal: SavingsTarget,
  currentSaved: number,
  todayIso: string = new Date().toISOString().slice(0, 10),
): PaceOutlook | null => {
  const pace = monthlyPace(goal, todayIso)
  const projectedDate = projectedCompletionDate(goal, currentSaved, pace, todayIso)
  if (pace === null || projectedDate === null) return null
  let monthsDelta: number | null = null
  if (goal.targetDate) {
    const diffDays =
      (new Date(`${projectedDate}T00:00:00Z`).getTime() - new Date(`${goal.targetDate}T00:00:00Z`).getTime()) /
      MS_PER_DAY
    monthsDelta = Math.round(diffDays / 30.44)
  }
  return { pace, projectedDate, monthsDelta }
}
