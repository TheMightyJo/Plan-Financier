import type { Account, Transaction } from '../types'
import { accountsSupabaseRepo } from '../repos/accountsSupabaseRepo'
import { transactionsSupabaseRepo } from '../repos/transactionsSupabaseRepo'
import type { SyncResult } from '../repos/types'
import { logAuditEvent } from './auditLog'

/**
 * Helper de bootstrap : pousse l'état localStorage vers Supabase au premier
 * login d'un user qui a déjà des données locales.
 *
 * Idempotent : un flag localStorage par user (sha de l'user_id) marque le
 * bootstrap comme fait. Ne re-pousse pas en cas de re-mount.
 *
 * **Ordre des inserts (FK requirements)** :
 *   1. Accounts d'abord (transactions ont FK → accounts)
 *   2. Transactions ensuite
 *
 * Si l'étape 1 échoue, on n'attaque pas l'étape 2 (les transactions
 * orphelines violeraient la FK).
 *
 * Cf. docs/etape-2-sync-data.md pour le plan global (2.A / 2.B / 2.C).
 */

const BOOTSTRAP_FLAG_PREFIX = 'plan-financier-sync-bootstrap-v1-'

const flagKey = (userId: string) => `${BOOTSTRAP_FLAG_PREFIX}${userId}`

export const hasBootstrapped = (userId: string): boolean => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(flagKey(userId)) === '1'
}

export const markBootstrapped = (userId: string): void => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(flagKey(userId), '1')
}

export const clearBootstrapFlag = (userId: string): void => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(flagKey(userId))
}

export type BootstrapReport = {
  ok: boolean
  accountsPushed: number
  accountsResult: SyncResult
  transactionsPushed: number
  transactionsResult: SyncResult
  /** True si le bootstrap a été skip (déjà fait précédemment ou rien à pousser). */
  skipped: boolean
  skipReason?: 'already_bootstrapped' | 'nothing_to_push'
}

const emptySyncResult: SyncResult = { ok: true }

/**
 * Push initial localStorage → Postgres.
 *
 * Stratégie 2.A (cette session) : push-only.
 *   - Au login, on prend l'état local et on le pousse vers Postgres
 *   - Si succès → flag bootstrapped, on n'y revient plus
 *   - Si échec → on retry au prochain login (rien n'est marqué)
 *   - Aucun pull depuis Postgres dans cette phase : multi-device pas
 *     fonctionnel tant que 2.C n'est pas livrée
 *
 * Stratégie 2.C (à venir) : sync bidirectionnel avec merge par updatedAt.
 */
export const bootstrapPushLocalToRemote = async (
  userId: string,
  localAccounts: Account[],
  localTransactions: Transaction[],
): Promise<BootstrapReport> => {
  // Idempotence : skip si déjà fait
  if (hasBootstrapped(userId)) {
    return {
      ok: true,
      accountsPushed: 0,
      accountsResult: emptySyncResult,
      transactionsPushed: 0,
      transactionsResult: emptySyncResult,
      skipped: true,
      skipReason: 'already_bootstrapped',
    }
  }

  // Rien à pousser → on flag quand même pour ne pas re-essayer à chaque login
  if (localAccounts.length === 0 && localTransactions.length === 0) {
    markBootstrapped(userId)
    return {
      ok: true,
      accountsPushed: 0,
      accountsResult: emptySyncResult,
      transactionsPushed: 0,
      transactionsResult: emptySyncResult,
      skipped: true,
      skipReason: 'nothing_to_push',
    }
  }

  // Étape 1 : accounts (FK requirements pour transactions)
  const accountsResult = await accountsSupabaseRepo.upsertMany(localAccounts)
  if (!accountsResult.ok) {
    return {
      ok: false,
      accountsPushed: 0,
      accountsResult,
      transactionsPushed: 0,
      transactionsResult: emptySyncResult,
      skipped: false,
    }
  }

  // Étape 2 : transactions (on ne pousse que celles qui ont un accountId
  // résolu — les orphelines seront re-attachées en 2.B après la migration ID)
  const transactionsWithAccount = localTransactions.filter((t) => t.accountId)
  const transactionsResult =
    transactionsWithAccount.length > 0
      ? await transactionsSupabaseRepo.upsertMany(transactionsWithAccount)
      : emptySyncResult

  const ok = accountsResult.ok && transactionsResult.ok

  if (ok) {
    markBootstrapped(userId)
    void logAuditEvent('export', {
      metadata: {
        kind: 'sync_bootstrap',
        accounts: localAccounts.length,
        transactions: transactionsWithAccount.length,
      },
    })
  }

  return {
    ok,
    accountsPushed: localAccounts.length,
    accountsResult,
    transactionsPushed: transactionsWithAccount.length,
    transactionsResult,
    skipped: false,
  }
}
