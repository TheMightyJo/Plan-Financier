import type { RecurringRule, Transaction, TransactionKind } from '../types'
import { normalizeText } from './text'

/**
 * Détection des dépenses (ou revenus) qui reviennent chaque mois sans être
 * programmées : même libellé, montant proche, jour du mois proche, sur au
 * moins deux mois distincts. Sert à proposer « Le programmer ? » sur
 * l'Accueil — heuristique locale, aucune IA.
 */

export type RecurringCandidate = {
  /** Libellé tel que saisi la dernière fois. */
  label: string
  /** Clé normalisée (libellé + type) : sert à l'exclusion / au rejet. */
  key: string
  kind: TransactionKind
  category: string
  envelope: string
  /** Montant médian des occurrences (arrondi au centime). */
  amount: number
  /** Jour du mois le plus fréquent (1..31). */
  dayOfMonth: number
  /** Nombre de mois distincts où l'opération apparaît. */
  months: number
  lastDate: string
}

const AMOUNT_TOLERANCE = 0.12
const DAY_TOLERANCE = 4
const MIN_MONTHS = 2

const normalizeLabel = (label: string): string =>
  normalizeText(label)
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

const mostFrequent = (values: number[]): number => {
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
}

export const candidateKey = (label: string, kind: TransactionKind): string => `${kind}:${normalizeLabel(label)}`

/**
 * @param transactions opérations du profil courant (toutes périodes)
 * @param rules règles existantes (les libellés déjà programmés sont exclus)
 * @param dismissedKeys clés rejetées par l'utilisateur (« Non merci »)
 */
export const detectRecurringCandidates = (
  transactions: Transaction[],
  rules: RecurringRule[],
  dismissedKeys: string[] = [],
): RecurringCandidate[] => {
  const ruledKeys = new Set(
    rules.filter((rule) => rule.pausedAt === null).map((rule) => candidateKey(rule.label, rule.kind)),
  )
  const dismissed = new Set(dismissedKeys)
  const groups = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    if (tx.recurringRuleId) continue // déjà générée par une règle
    if (!normalizeLabel(tx.label)) continue
    const key = candidateKey(tx.label, tx.kind)
    if (ruledKeys.has(key) || dismissed.has(key)) continue
    groups.set(key, [...(groups.get(key) ?? []), tx])
  }

  const candidates: RecurringCandidate[] = []
  for (const [key, group] of groups) {
    const byMonth = new Map<string, Transaction>()
    for (const tx of group) {
      const month = tx.date.slice(0, 7)
      // Une occurrence par mois (la dernière du mois si doublon).
      const current = byMonth.get(month)
      if (!current || current.date < tx.date) byMonth.set(month, tx)
    }
    if (byMonth.size < MIN_MONTHS) continue
    const occurrences = [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date))
    const amounts = occurrences.map((tx) => tx.amount)
    const medianAmount = median(amounts)
    const amountsClose = amounts.every((a) => Math.abs(a - medianAmount) <= medianAmount * AMOUNT_TOLERANCE)
    if (!amountsClose) continue
    const days = occurrences.map((tx) => Number(tx.date.slice(8, 10)))
    const day = mostFrequent(days)
    const daysClose = days.every((d) => Math.abs(d - day) <= DAY_TOLERANCE)
    if (!daysClose) continue
    // Mois consécutifs sur au moins les deux derniers (pas un achat isolé).
    const months = occurrences.map((tx) => tx.date.slice(0, 7))
    const consecutive = months.slice(1).some((m, i) => monthDiff(months[i], m) === 1)
    if (!consecutive) continue

    const last = occurrences[occurrences.length - 1]
    candidates.push({
      label: last.label,
      key,
      kind: last.kind,
      category: last.category,
      envelope: last.envelope,
      amount: Math.round(medianAmount * 100) / 100,
      dayOfMonth: day,
      months: byMonth.size,
      lastDate: last.date,
    })
  }

  // Les plus gros montants d'abord (loyer, crédit…) : plus utile à programmer.
  return candidates.sort((a, b) => b.amount - a.amount).slice(0, 5)
}

const monthDiff = (a: string, b: string): number => {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}
