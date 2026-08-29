// Synchronisation cloud (étape 2.C pragmatique) : au login, fusion du local et
// du distant puis convergence des deux côtés. Les modifications suivantes sont
// poussées en continu (debounce côté App).
//
// Stratégie de fusion : union par id, LE LOCAL GAGNE en cas de conflit (c'est
// l'appareil sur lequel l'utilisateur vient d'agir). Les suppressions ne se
// propagent pas encore entre appareils (v1 assumée — cf. docs/etape-2).
import type { Account, Transaction } from '../types'
import { accountsSupabaseRepo } from '../repos/accountsSupabaseRepo'
import { transactionsSupabaseRepo } from '../repos/transactionsSupabaseRepo'
import { bootstrapPushLocalToRemote } from './syncBootstrap'

export type MergeOutcome<T> = {
  merged: T[]
  addedFromRemote: number
}

/** Union par id : tout le local + les entrées distantes inconnues localement. */
export const mergeById = <T extends { id: string | number }>(
  local: T[],
  remote: T[],
): MergeOutcome<T> => {
  const localIds = new Set(local.map((item) => String(item.id)))
  const fromRemote = remote.filter((item) => !localIds.has(String(item.id)))
  return { merged: [...local, ...fromRemote], addedFromRemote: fromRemote.length }
}

export type CloudSyncReport = {
  ok: boolean
  accounts: MergeOutcome<Account> | null
  transactions: MergeOutcome<Transaction> | null
  error?: string
}

/**
 * Synchronisation complète au login :
 *   1. bootstrap push (idempotent, premier login seulement)
 *   2. pull distant + fusion (local prioritaire)
 *   3. push de l'état fusionné pour faire converger le serveur
 *
 * Les comptes distants inconnus localement sont rattachés à
 * `fallbackMemberId` (le schéma SQL ne porte pas encore le profil local).
 */
export const syncWithCloud = async (
  userId: string,
  localAccounts: Account[],
  localTransactions: Transaction[],
  fallbackMemberId: string,
): Promise<CloudSyncReport> => {
  const bootstrap = await bootstrapPushLocalToRemote(userId, localAccounts, localTransactions)
  if (!bootstrap.ok) {
    return {
      ok: false,
      accounts: null,
      transactions: null,
      error: bootstrap.accountsResult.message ?? bootstrap.transactionsResult.message ?? 'bootstrap',
    }
  }

  const [remoteAccounts, remoteTransactions] = await Promise.all([
    accountsSupabaseRepo.list(),
    transactionsSupabaseRepo.list(),
  ])
  if (!remoteAccounts.result.ok || !remoteTransactions.result.ok) {
    return {
      ok: false,
      accounts: null,
      transactions: null,
      error: remoteAccounts.result.message ?? remoteTransactions.result.message ?? 'pull',
    }
  }

  // Les rows distantes ne portent pas le profil local pour les comptes :
  // celles récupérées d'un autre appareil retombent sur le profil par défaut.
  const remoteAccountsFixed = remoteAccounts.data.map((account) => ({
    ...account,
    ownerMember: fallbackMemberId,
  }))
  // Transactions distantes sans meta (anciennes) : member vide → profil défaut.
  const remoteTransactionsFixed = remoteTransactions.data.map((transaction) =>
    transaction.member ? transaction : { ...transaction, member: fallbackMemberId },
  )

  const accounts = mergeById(localAccounts, remoteAccountsFixed)
  const transactions = mergeById(localTransactions, remoteTransactionsFixed)

  // Convergence : on repousse l'état fusionné (upsert idempotent).
  const pushAccounts = await accountsSupabaseRepo.upsertMany(accounts.merged)
  const pushTransactions = pushAccounts.ok
    ? await transactionsSupabaseRepo.upsertMany(transactions.merged.filter((t) => t.accountId))
    : pushAccounts

  return {
    ok: pushAccounts.ok && pushTransactions.ok,
    accounts,
    transactions,
    error: pushAccounts.message ?? pushTransactions.message,
  }
}

/** Push incrémental (debounce côté App) de l'état courant. */
export const pushToCloud = async (
  accounts: Account[],
  transactions: Transaction[],
): Promise<{ ok: boolean; error?: string }> => {
  const accountsResult = await accountsSupabaseRepo.upsertMany(accounts)
  if (!accountsResult.ok) return { ok: false, error: accountsResult.message }
  const transactionsResult = await transactionsSupabaseRepo.upsertMany(
    transactions.filter((t) => t.accountId),
  )
  return { ok: transactionsResult.ok, error: transactionsResult.message }
}
