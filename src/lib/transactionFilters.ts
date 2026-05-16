import type {
  Account,
  Category,
  Envelope,
  FamilyMember,
  Transaction,
  TransactionKind,
} from '../types'
import { normalizeText } from './text'

/**
 * Helpers purs de filtrage / recherche pour la liste de transactions.
 * Composables : chaque fonction prend une liste, renvoie une liste.
 */

export type PeriodKind = 'all' | 'month' | 'quarter' | 'year' | 'custom'

export type TransactionFilterCriteria = {
  search: string                 // texte libre (label + category + notes)
  kind: TransactionKind | 'all'
  category: Category | 'all'
  envelope: Envelope | 'all'
  accountId: string | 'all'
  member: FamilyMember | 'all'
  period: PeriodKind
  /** Format YYYY-MM, requis si period === 'month' */
  monthIso?: string
  /** Bornes pour period === 'custom', format YYYY-MM-DD inclus */
  customFrom?: string
  customTo?: string
}

export const defaultCriteria = (member: FamilyMember): TransactionFilterCriteria => ({
  search: '',
  kind: 'all',
  category: 'all',
  envelope: 'all',
  accountId: 'all',
  member,
  period: 'all',
})

const matchesSearch = (tx: Transaction, query: string) => {
  if (!query.trim()) return true
  const q = normalizeText(query)
  if (!q) return true
  return (
    normalizeText(tx.label).includes(q) ||
    normalizeText(tx.category).includes(q) ||
    normalizeText(tx.envelope).includes(q)
  )
}

const matchesPeriod = (tx: Transaction, criteria: TransactionFilterCriteria, todayIso: string) => {
  switch (criteria.period) {
    case 'all':
      return true
    case 'month': {
      const target = criteria.monthIso ?? todayIso.slice(0, 7)
      return tx.date.startsWith(target)
    }
    case 'quarter': {
      // 3 derniers mois calendaires inclus
      const today = new Date(todayIso)
      const cutoff = new Date(today.getFullYear(), today.getMonth() - 2, 1)
      const txDate = new Date(tx.date)
      return txDate >= cutoff && txDate <= today
    }
    case 'year': {
      return tx.date.startsWith(todayIso.slice(0, 4))
    }
    case 'custom': {
      if (criteria.customFrom && tx.date < criteria.customFrom) return false
      if (criteria.customTo && tx.date > criteria.customTo) return false
      return true
    }
    default:
      return true
  }
}

export const filterTransactions = (
  transactions: Transaction[],
  criteria: TransactionFilterCriteria,
  todayIso: string = new Date().toISOString().slice(0, 10),
): Transaction[] => {
  return transactions.filter((tx) => {
    if (criteria.member !== 'all' && tx.member !== criteria.member) return false
    if (criteria.kind !== 'all' && tx.kind !== criteria.kind) return false
    if (criteria.category !== 'all' && tx.category !== criteria.category) return false
    if (criteria.envelope !== 'all' && tx.envelope !== criteria.envelope) return false
    if (criteria.accountId !== 'all' && tx.accountId !== criteria.accountId) return false
    if (!matchesPeriod(tx, criteria, todayIso)) return false
    if (!matchesSearch(tx, criteria.search)) return false
    return true
  })
}

export type TxSortField = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'

export const sortTransactions = (
  transactions: Transaction[],
  field: TxSortField,
): Transaction[] => {
  const copy = transactions.slice()
  switch (field) {
    case 'date_desc':
      copy.sort((a, b) => b.date.localeCompare(a.date))
      break
    case 'date_asc':
      copy.sort((a, b) => a.date.localeCompare(b.date))
      break
    case 'amount_desc':
      copy.sort((a, b) => b.amount - a.amount)
      break
    case 'amount_asc':
      copy.sort((a, b) => a.amount - b.amount)
      break
  }
  return copy
}

/**
 * Stats agrégées sur le résultat filtré (pour l'en-tête du panel).
 */
export const aggregateFilteredStats = (transactions: Transaction[]) => {
  let income = 0
  let expense = 0
  for (const tx of transactions) {
    if (tx.kind === 'revenu') income += tx.amount
    else expense += tx.amount
  }
  return {
    count: transactions.length,
    income,
    expense,
    net: income - expense,
  }
}

/**
 * Pour l'export CSV : convertit une liste de transactions en lignes CSV
 * compatibles fr-FR (séparateur point-virgule, montant avec virgule).
 */
export const transactionsToCsv = (
  transactions: Transaction[],
  accountsById: Map<string, Account>,
): string => {
  const headers = ['Date', 'Libellé', 'Catégorie', 'Enveloppe', 'Compte', 'Type', 'Montant']
  const escape = (value: string) => {
    if (/[;"\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }
  const lines = [headers.join(';')]
  for (const tx of transactions) {
    const accountName = tx.accountId ? accountsById.get(tx.accountId)?.name ?? '—' : '—'
    lines.push(
      [
        tx.date,
        escape(tx.label),
        tx.category,
        tx.envelope,
        escape(accountName),
        tx.kind === 'depense' ? 'Dépense' : 'Revenu',
        tx.amount.toFixed(2).replace('.', ','),
      ].join(';'),
    )
  }
  return lines.join('\n')
}
