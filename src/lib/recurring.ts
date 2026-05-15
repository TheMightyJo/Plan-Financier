import type { RecurringFrequency, RecurringRule, Transaction } from '../types'

/**
 * Helpers purs pour la gestion des dépenses récurrentes.
 * Toutes les dates sont manipulées en UTC pour éviter les surprises de fuseau
 * horaire (notamment quand on calcule "jour du mois" autour des changements
 * heure d'été / heure d'hiver).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

const parseISODate = (iso: string): Date => {
  // 'YYYY-MM-DD' → Date UTC à minuit
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const formatISODate = (date: Date): string => {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const lastDayOfMonth = (year: number, monthZeroBased: number): number =>
  new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate()

/**
 * Pour les fréquences mensuelle/trimestrielle/annuelle, ramène `dayOfPeriod`
 * (1..31) au dernier jour valide du mois cible (ex : 31 février → 28 ou 29).
 */
export const clampDayToMonth = (
  year: number,
  monthZeroBased: number,
  dayOfPeriod: number,
): number => Math.min(dayOfPeriod, lastDayOfMonth(year, monthZeroBased))

/**
 * Calcule la prochaine occurrence d'une règle à partir d'une date donnée
 * (incluse). Renvoie null si la règle est terminée (endDate dépassée) ou en
 * pause.
 */
export const getNextOccurrence = (rule: RecurringRule, fromIso: string): string | null => {
  if (rule.pausedAt !== null) return null

  const start = parseISODate(rule.startDate)
  const from = parseISODate(fromIso)
  const cursor = from.getTime() < start.getTime() ? start : from
  const end = rule.endDate ? parseISODate(rule.endDate) : null

  const candidate = nextDateForFrequency(rule.frequency, rule.dayOfPeriod, cursor)

  if (end && candidate.getTime() > end.getTime()) return null
  return formatISODate(candidate)
}

const nextDateForFrequency = (
  frequency: RecurringFrequency,
  dayOfPeriod: number,
  from: Date,
): Date => {
  if (frequency === 'weekly') {
    // dayOfPeriod 1..7 ISO (1 = lundi, 7 = dimanche)
    // getUTCDay : 0 = dimanche, 1 = lundi, ... → on mappe en ISO
    const fromIsoDow = ((from.getUTCDay() + 6) % 7) + 1 // 1..7
    const diff = (dayOfPeriod - fromIsoDow + 7) % 7
    const out = new Date(from)
    out.setUTCDate(out.getUTCDate() + diff)
    return out
  }

  // monthly / quarterly / yearly
  const monthStep = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12
  let year = from.getUTCFullYear()
  let month = from.getUTCMonth()
  let day = clampDayToMonth(year, month, dayOfPeriod)

  if (day < from.getUTCDate()) {
    // l'occurrence ce mois est déjà passée → avancer du pas
    month += monthStep
    while (month > 11) {
      month -= 12
      year += 1
    }
    day = clampDayToMonth(year, month, dayOfPeriod)
  }

  return new Date(Date.UTC(year, month, day))
}

/**
 * Énumère toutes les dates d'occurrence d'une règle entre `fromIso` (inclus)
 * et `untilIso` (inclus). Borne dure à 366 itérations pour éviter une boucle
 * infinie sur règle malformée.
 */
export const getOccurrencesBetween = (
  rule: RecurringRule,
  fromIso: string,
  untilIso: string,
): string[] => {
  const occurrences: string[] = []
  const until = parseISODate(untilIso).getTime()
  let cursor = fromIso

  for (let i = 0; i < 366; i += 1) {
    const next = getNextOccurrence(rule, cursor)
    if (!next) break
    if (parseISODate(next).getTime() > until) break
    occurrences.push(next)

    // avancer d'un jour après la dernière occurrence trouvée
    const after = new Date(parseISODate(next).getTime() + MS_PER_DAY)
    cursor = formatISODate(after)
  }

  return occurrences
}

export type RuleValidationError =
  | 'label_required'
  | 'amount_must_be_positive'
  | 'invalid_day_for_weekly'
  | 'invalid_day_for_monthly'
  | 'invalid_start_date'
  | 'end_before_start'

export const validateRule = (rule: Partial<RecurringRule>): RuleValidationError | null => {
  if (!rule.label || rule.label.trim().length === 0) return 'label_required'
  if (typeof rule.amount !== 'number' || rule.amount <= 0) return 'amount_must_be_positive'
  if (!rule.startDate || Number.isNaN(parseISODate(rule.startDate).getTime())) {
    return 'invalid_start_date'
  }
  if (rule.endDate) {
    if (parseISODate(rule.endDate).getTime() < parseISODate(rule.startDate).getTime()) {
      return 'end_before_start'
    }
  }
  if (rule.frequency === 'weekly') {
    if (!rule.dayOfPeriod || rule.dayOfPeriod < 1 || rule.dayOfPeriod > 7) {
      return 'invalid_day_for_weekly'
    }
  } else {
    if (!rule.dayOfPeriod || rule.dayOfPeriod < 1 || rule.dayOfPeriod > 31) {
      return 'invalid_day_for_monthly'
    }
  }
  return null
}

/**
 * Génère les transactions manquantes pour une règle, depuis
 * `lastGeneratedOn + 1 jour` (ou `startDate` au premier passage) jusqu'à
 * `todayIso` inclus. Idempotent : pas de doublon si rappelé.
 *
 * Renvoie : { transactions générées, nouvelle valeur de lastGeneratedOn }.
 */
export const generateDueTransactions = (
  rule: RecurringRule,
  todayIso: string,
  /** Fonction de génération d'id unique (pour rester pure et testable). */
  nextId: () => number,
): { transactions: Transaction[]; lastGeneratedOn: string | null } => {
  if (rule.pausedAt !== null) {
    return { transactions: [], lastGeneratedOn: rule.lastGeneratedOn }
  }

  const fromIso = rule.lastGeneratedOn
    ? formatISODate(new Date(parseISODate(rule.lastGeneratedOn).getTime() + MS_PER_DAY))
    : rule.startDate

  if (parseISODate(fromIso).getTime() > parseISODate(todayIso).getTime()) {
    return { transactions: [], lastGeneratedOn: rule.lastGeneratedOn }
  }

  const dates = getOccurrencesBetween(rule, fromIso, todayIso)
  const transactions: Transaction[] = dates.map((date) => ({
    id: nextId(),
    label: rule.label,
    amount: rule.amount,
    category: rule.category,
    member: rule.member,
    date,
    kind: rule.kind,
    envelope: rule.envelope,
  }))

  const lastGeneratedOn = dates.length > 0 ? dates[dates.length - 1] : rule.lastGeneratedOn
  return { transactions, lastGeneratedOn }
}
