import type { Account, AccountType, FamilyMember, Transaction } from '../types'
import { ACCOUNT_TYPES } from '../types'
import { ACCOUNT_DEFAULT_COLORS, ACCOUNT_DEFAULT_ICONS } from '../lib/accounts'

/**
 * Repo localStorage pour les comptes.
 *
 * Migration vers Supabase : remplacer load/save par des appels au client
 * (table `accounts`). La shape des objets est déjà conforme — on perdra
 * juste `ownerMember` au profit de `owner_user_id` (FK profiles).
 */

const STORAGE_KEY = 'plan-financier-accounts-v1'

const isAccount = (value: unknown): value is Account => {
  if (!value || typeof value !== 'object') return false
  const a = value as Partial<Account>
  return (
    typeof a.id === 'string' &&
    typeof a.ownerMember === 'string' &&
    typeof a.name === 'string' &&
    typeof a.type === 'string' &&
    ACCOUNT_TYPES.includes(a.type as AccountType) &&
    typeof a.currency === 'string' &&
    typeof a.initialBalance === 'number' &&
    (a.archivedAt === null || typeof a.archivedAt === 'number')
  )
}

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `acc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

export const loadAccounts = (): Account[] => {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isAccount)
  } catch {
    return []
  }
}

export const saveAccounts = (accounts: Account[]): void => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
}

export const buildAccount = (
  partial: Omit<
    Account,
    'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'displayColor' | 'displayIcon'
  > & { displayColor?: string | null; displayIcon?: string | null },
): Account => {
  const now = Date.now()
  return {
    ...partial,
    id: createId(),
    archivedAt: null,
    displayColor: partial.displayColor ?? ACCOUNT_DEFAULT_COLORS[partial.type],
    displayIcon: partial.displayIcon ?? ACCOUNT_DEFAULT_ICONS[partial.type],
    createdAt: now,
    updatedAt: now,
  }
}

export const upsertAccount = (accounts: Account[], next: Account): Account[] => {
  const idx = accounts.findIndex((a) => a.id === next.id)
  if (idx < 0) return [...accounts, next]
  const copy = accounts.slice()
  copy[idx] = { ...next, updatedAt: Date.now() }
  return copy
}

export const archiveAccount = (accounts: Account[], id: string): Account[] =>
  accounts.map((a) =>
    a.id === id
      ? { ...a, archivedAt: a.archivedAt === null ? Date.now() : null, updatedAt: Date.now() }
      : a,
  )

export const removeAccount = (accounts: Account[], id: string): Account[] =>
  accounts.filter((a) => a.id !== id)

/**
 * Garantit qu'un compte par défaut "Compte courant" existe pour le membre.
 * Si oui : renvoie son id. Si non : le crée et renvoie l'id du nouveau.
 *
 * Utilisé par `migrateTransactionsToDefaultAccount` au premier mount pour
 * faire migrer les transactions historiques (sans accountId) vers un compte
 * réel.
 */
export const ensureDefaultAccount = (
  accounts: Account[],
  member: FamilyMember,
): { accounts: Account[]; defaultId: string } => {
  const existing = accounts.find(
    (a) => a.ownerMember === member && a.type === 'checking' && a.archivedAt === null,
  )
  if (existing) return { accounts, defaultId: existing.id }

  const defaultAccount = buildAccount({
    ownerMember: member,
    name: 'Compte courant',
    type: 'checking',
    currency: 'EUR',
    initialBalance: 0,
  })
  return { accounts: [...accounts, defaultAccount], defaultId: defaultAccount.id }
}

/**
 * Patch les transactions historiques (sans accountId) en les rebascule sur
 * le compte par défaut de leur membre.
 *
 * Idempotent : retourne la liste inchangée si toutes les transactions ont
 * déjà un accountId valide.
 */
export const migrateTransactionsToDefaultAccount = (
  transactions: Transaction[],
  accounts: Account[],
): { transactions: Transaction[]; accounts: Account[]; changed: boolean } => {
  const orphaned = transactions.filter((t) => !t.accountId)
  if (orphaned.length === 0) return { transactions, accounts, changed: false }

  let workingAccounts = accounts
  const memberDefaults = new Map<FamilyMember, string>()

  for (const tx of orphaned) {
    if (memberDefaults.has(tx.member)) continue
    const result = ensureDefaultAccount(workingAccounts, tx.member)
    workingAccounts = result.accounts
    memberDefaults.set(tx.member, result.defaultId)
  }

  const patched = transactions.map((tx) => {
    if (tx.accountId) return tx
    const defaultId = memberDefaults.get(tx.member)
    return defaultId ? { ...tx, accountId: defaultId } : tx
  })

  return { transactions: patched, accounts: workingAccounts, changed: true }
}
