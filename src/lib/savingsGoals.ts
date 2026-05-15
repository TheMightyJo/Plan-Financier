import type { Account, SavingsTarget, Transaction } from '../types'
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
