// Synchronisation cloud (étape 2.C pragmatique) : au login, fusion du local et
// du distant puis convergence des deux côtés. Les modifications suivantes sont
// poussées en continu (debounce côté App).
//
// Stratégie de fusion : union par id, LE LOCAL GAGNE en cas de conflit (c'est
// l'appareil sur lequel l'utilisateur vient d'agir).
//
// Suppressions (semaine 10) : une opération supprimée ici est marquée
// deleted_at côté serveur (file pendingDeletes si hors-ligne) ; au login, les
// opérations marquées supprimées ailleurs sont retirées de cet appareil.
import type { Account, Transaction } from '../types'
import { accountsSupabaseRepo } from '../repos/accountsSupabaseRepo'
import {
  listDeletedTransactionIds,
  softDeleteTransactions,
  transactionsSupabaseRepo,
} from '../repos/transactionsSupabaseRepo'
import { bootstrapPushLocalToRemote } from './syncBootstrap'
import { ensureUuid } from './supabaseMappers'
import { clearPendingDeletes, readPendingDeletes } from './pendingDeletes'

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

/** Retire les opérations dont l'id (uuid) est dans `deletedIds`. */
export const applyDeletions = <T extends { id: string | number }>(
  items: T[],
  deletedIds: Set<string>,
): { kept: T[]; removed: number } => {
  if (deletedIds.size === 0) return { kept: items, removed: 0 }
  const kept = items.filter((item) => !deletedIds.has(ensureUuid(item.id)))
  return { kept, removed: items.length - kept.length }
}

/** Pousse les suppressions en attente ; renvoie les ids encore à exclure. */
const flushPendingDeletes = async (): Promise<string[]> => {
  const pending = readPendingDeletes()
  if (pending.length === 0) return []
  const result = await softDeleteTransactions(pending)
  if (result.ok) clearPendingDeletes(pending)
  return pending
}

export type CloudSyncReport = {
  ok: boolean
  accounts: MergeOutcome<Account> | null
  transactions: (MergeOutcome<Transaction> & { removedLocally: number }) | null
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

  const pending = await flushPendingDeletes()
  const [remoteAccounts, remoteTransactions, remoteDeleted] = await Promise.all([
    accountsSupabaseRepo.list(),
    transactionsSupabaseRepo.list(),
    listDeletedTransactionIds(),
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

  // Suppressions : celles faites ailleurs (deleted_at) et les nôtres encore
  // en attente ne doivent ni rester ici, ni revenir du distant.
  const deletedIds = new Set<string>([...remoteDeleted.data, ...pending.map(ensureUuid)])
  const localKept = applyDeletions(localTransactions, deletedIds)
  const remoteKept = applyDeletions(remoteTransactionsFixed, deletedIds)

  const accounts = mergeById(localAccounts, remoteAccountsFixed)
  const transactions = { ...mergeById(localKept.kept, remoteKept.kept), removedLocally: localKept.removed }

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
  await flushPendingDeletes()
  const accountsResult = await accountsSupabaseRepo.upsertMany(accounts)
  if (!accountsResult.ok) return { ok: false, error: accountsResult.message }
  const transactionsResult = await transactionsSupabaseRepo.upsertMany(
    transactions.filter((t) => t.accountId),
  )
  return { ok: transactionsResult.ok, error: transactionsResult.message }
}
