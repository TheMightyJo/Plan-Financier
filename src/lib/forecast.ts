import type { RecurringRule, Transaction, TransactionKind } from '../types'
import { getOccurrencesBetween } from './recurring'

/**
 * Prévision de fin de mois : à partir du reste à dépenser d'aujourd'hui, on
 * projette jour par jour jusqu'à la fin du mois en retirant les charges
 * fixes à venir (règles récurrentes non encore matérialisées), en ajoutant
 * les revenus récurrents à venir, et en retirant une estimation des dépenses
 * variables (rythme observé sur les 28 derniers jours).
 * Helpers purs, testables.
 */

const MS_PER_DAY = 86_400_000
/** Fenêtre d'observation du rythme de dépenses variables. */
export const VARIABLE_WINDOW_DAYS = 28

const toDate = (iso: string) => new Date(`${iso}T12:00:00Z`)
const toIso = (date: Date) => date.toISOString().slice(0, 10)
export const shiftIso = (iso: string, days: number): string => toIso(new Date(toDate(iso).getTime() + days * MS_PER_DAY))
export const lastDayOfMonth = (iso: string): string => {
  const [year, month] = iso.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0))
  return toIso(last)
}

export type UpcomingFixed = {
  date: string
  label: string
  amount: number
  kind: TransactionKind
  ruleId: string
}

export type ForecastPoint = {
  date: string
  /** Solde projeté en fin de journée. */
  projected: number
}

export type ForecastStatus = 'ok' | 'tight' | 'negative'

export type Forecast = {
  points: ForecastPoint[]
  endOfMonth: number
  upcomingFixed: UpcomingFixed[]
  fixedExpenses: number
  fixedIncomes: number
  /** Dépenses variables estimées par jour (€). */
  variableDailyRate: number
  variableTotal: number
  /** Jours restants (aujourd'hui exclu). */
  daysLeft: number
  /** Premier jour où le solde projeté passe sous zéro. */
  firstNegativeDate: string | null
  status: ForecastStatus
  /** Nombre de jours d'historique disponibles pour le rythme (0 = estimation faible). */
  historyDays: number
}

export type ForecastInput = {
  todayIso: string
  /** Reste à dépenser aujourd'hui (budget + report − dépenses du mois). */
  remaining: number
  /** Règles du profil (actives ou non : filtrées ici). */
  rules: RecurringRule[]
  /** Opérations du profil (tous mois). */
  transactions: Transaction[]
  /** Budget mensuel (sert à écarter les dépenses exceptionnelles du rythme). */
  budget?: number
}

/** Charges/revenus récurrents restant à tomber ce mois-ci (non matérialisés). */
export const upcomingFixedUntil = (
  rules: RecurringRule[],
  transactions: Transaction[],
  fromIso: string,
  untilIso: string,
): UpcomingFixed[] => {
  const materialized = new Set(
    transactions.filter((t) => t.recurringRuleId).map((t) => `${t.recurringRuleId}|${t.date}`),
  )
  const items: UpcomingFixed[] = []
  for (const rule of rules) {
    if (rule.pausedAt !== null) continue
    for (const date of getOccurrencesBetween(rule, fromIso, untilIso)) {
      if (materialized.has(`${rule.id}|${date}`)) continue
      items.push({ date, label: rule.label, amount: rule.amount, kind: rule.kind, ruleId: rule.id })
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date))
}

/** Plancher de jours pour lisser un historique court (évite les extrapolations folles). */
export const MIN_RATE_DAYS = 14
/** Part du budget au-delà de laquelle une dépense isolée est jugée exceptionnelle (loyer saisi à la main…). */
export const EXCEPTIONAL_SHARE = 0.2

/**
 * Rythme de dépenses courantes (hors récurrent, hors dépenses exceptionnelles
 * > 20 % du budget) sur les `VARIABLE_WINDOW_DAYS` derniers jours, ramené au
 * jour. Historique court : on divise par les jours couverts, plancher 14.
 */
export const variableDailyRate = (
  transactions: Transaction[],
  todayIso: string,
  budget = 0,
): { rate: number; historyDays: number } => {
  const windowStart = shiftIso(todayIso, -VARIABLE_WINDOW_DAYS)
  const exceptional = budget > 0 ? budget * EXCEPTIONAL_SHARE : Number.POSITIVE_INFINITY
  const variable = transactions.filter(
    (t) =>
      t.kind === 'depense' &&
      !t.recurringRuleId &&
      t.amount <= exceptional &&
      t.date >= windowStart &&
      t.date < todayIso,
  )
  const all = transactions.filter((t) => t.date < todayIso)
  if (all.length === 0) return { rate: 0, historyDays: 0 }
  const firstDate = all.reduce((min, t) => (t.date < min ? t.date : min), all[0].date)
  const coveredDays = Math.min(
    VARIABLE_WINDOW_DAYS,
    Math.max(1, Math.round((toDate(todayIso).getTime() - toDate(firstDate).getTime()) / MS_PER_DAY)),
  )
  const total = variable.reduce((sum, t) => sum + t.amount, 0)
  return { rate: total / Math.max(MIN_RATE_DAYS, coveredDays), historyDays: coveredDays }
}

export const computeForecast = (input: ForecastInput): Forecast => {
  const { todayIso, remaining, rules, transactions, budget = 0 } = input
  const endIso = lastDayOfMonth(todayIso)
  const daysLeft = Math.max(0, Math.round((toDate(endIso).getTime() - toDate(todayIso).getTime()) / MS_PER_DAY))
  const upcomingFixed = daysLeft > 0 ? upcomingFixedUntil(rules, transactions, shiftIso(todayIso, 1), endIso) : []
  const { rate, historyDays } = variableDailyRate(transactions, todayIso, budget)

  const fixedByDate = new Map<string, number>()
  for (const item of upcomingFixed) {
    const delta = item.kind === 'depense' ? -item.amount : item.amount
    fixedByDate.set(item.date, (fixedByDate.get(item.date) ?? 0) + delta)
  }

  const points: ForecastPoint[] = [{ date: todayIso, projected: remaining }]
  let running = remaining
  let firstNegativeDate: string | null = remaining < 0 ? todayIso : null
  for (let day = 1; day <= daysLeft; day++) {
    const date = shiftIso(todayIso, day)
    running += (fixedByDate.get(date) ?? 0) - rate
    points.push({ date, projected: Math.round(running * 100) / 100 })
    if (firstNegativeDate === null && running < 0) firstNegativeDate = date
  }

  const fixedExpenses = upcomingFixed.filter((i) => i.kind === 'depense').reduce((s, i) => s + i.amount, 0)
  const fixedIncomes = upcomingFixed.filter((i) => i.kind === 'revenu').reduce((s, i) => s + i.amount, 0)
  const variableTotal = rate * daysLeft
  const endOfMonth = Math.round(running * 100) / 100
  const status: ForecastStatus = endOfMonth < 0 ? 'negative' : endOfMonth < rate * 3 ? 'tight' : 'ok'

  return {
    points,
    endOfMonth,
    upcomingFixed,
    fixedExpenses,
    fixedIncomes,
    variableDailyRate: rate,
    variableTotal,
    daysLeft,
    firstNegativeDate,
    status,
    historyDays,
  }
}
