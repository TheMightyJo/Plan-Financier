import type { Account, AccountType, FamilyMember, Transaction } from '../types'

/**
 * Helpers purs pour les comptes (V1 : checking + savings + cash, etc.).
 * Les transferts inter-comptes (transfer_group_id côté SQL) sont V2 :
 * pour V1 chaque transaction est attachée à un compte unique.
 */

export const ACCOUNT_DEFAULT_COLORS: Record<AccountType, string> = {
  checking: '#8B6C52',     // terre — opérations courantes
  savings: '#3A7D44',      // vert forêt — épargne, croissance
  cash: '#A08060',         // caramel — espèces
  envelope: '#B8963E',     // ambre — enveloppe budgétaire
  credit_card: '#C05C2A',  // terracotta — endettement
  investment: '#6B5B8A',   // prune — investissements
}

export const ACCOUNT_DEFAULT_ICONS: Record<AccountType, string> = {
  checking: 'wallet',
  savings: 'piggy-bank',
  cash: 'banknote',
  envelope: 'inbox',
  credit_card: 'credit-card',
  investment: 'trending-up',
}

/**
 * Solde courant d'un compte = solde d'ouverture + somme des revenus
 * — somme des dépenses, sur les transactions liées à ce compte.
 */
export const computeAccountBalance = (
  account: Account,
  transactions: Transaction[],
): number => {
  const owned = transactions.filter((tx) => tx.accountId === account.id)
  const delta = owned.reduce((acc, tx) => {
    if (tx.kind === 'revenu') return acc + tx.amount
    return acc - tx.amount
  }, 0)
  return account.initialBalance + delta
}

/**
 * Solde consolidé = somme des soldes de tous les comptes actifs (non archivés)
 * d'un membre donné.
 */
export const computeConsolidatedBalance = (
  accounts: Account[],
  transactions: Transaction[],
  member: FamilyMember,
): number =>
  accounts
    .filter((a) => a.ownerMember === member && a.archivedAt === null)
    .reduce((acc, account) => acc + computeAccountBalance(account, transactions), 0)

/**
 * Groupe les soldes par type de compte pour la vue patrimoine.
 * Renvoie une map { type → total }.
 */
export const balanceByAccountType = (
  accounts: Account[],
  transactions: Transaction[],
  member: FamilyMember,
): Record<AccountType, number> => {
  const result: Record<AccountType, number> = {
    checking: 0,
    savings: 0,
    cash: 0,
    envelope: 0,
    credit_card: 0,
    investment: 0,
  }
  for (const account of accounts) {
    if (account.ownerMember !== member || account.archivedAt !== null) continue
    result[account.type] += computeAccountBalance(account, transactions)
  }
  return result
}

/**
 * Filtre les comptes actifs d'un membre donné.
 */
export const activeAccountsFor = (accounts: Account[], member: FamilyMember): Account[] =>
  accounts.filter((a) => a.ownerMember === member && a.archivedAt === null)

/**
 * Validation côté client (la BDD aura ses propres CHECK constraints).
 */
export type AccountValidationError =
  | 'name_required'
  | 'invalid_type'
  | 'initial_balance_must_be_finite'

export const validateAccount = (account: Partial<Account>): AccountValidationError | null => {
  if (!account.name || account.name.trim().length === 0) return 'name_required'
  if (!account.type) return 'invalid_type'
  if (typeof account.initialBalance !== 'number' || !Number.isFinite(account.initialBalance)) {
    return 'initial_balance_must_be_finite'
  }
  return null
}
