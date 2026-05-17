import { isSupabaseConfigured, supabase } from '../supabase'
import {
  transactionFromRow,
  transactionToRow,
  type TransactionRow,
} from '../lib/supabaseMappers'
import type { Transaction } from '../types'
import type { SyncRepo, SyncResult } from './types'

const TABLE = 'transactions'

const requireUser = async (): Promise<{ userId: string; result: SyncResult } | null> => {
  if (!isSupabaseConfigured()) {
    return { userId: '', result: { ok: false, error: 'unauthenticated', message: 'Supabase non configuré' } }
  }
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    return { userId: '', result: { ok: false, error: 'unauthenticated' } }
  }
  return { userId: data.session.user.id, result: { ok: true } }
}

const mapSupabaseError = (message: string): SyncResult['error'] => {
  const m = message.toLowerCase()
  if (m.includes('jwt') || m.includes('unauthor')) return 'unauthenticated'
  if (m.includes('network') || m.includes('fetch')) return 'network'
  if (m.includes('duplicate') || m.includes('conflict') || m.includes('unique')) return 'conflict'
  if (m.includes('check') || m.includes('violates') || m.includes('null value')) return 'validation'
  return 'unknown'
}

export const transactionsSupabaseRepo: SyncRepo<Transaction> = {
  async list() {
    const auth = await requireUser()
    if (!auth || !auth.result.ok) return { data: [], result: auth?.result ?? { ok: false, error: 'unknown' } }

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })

    if (error) {
      return { data: [], result: { ok: false, error: mapSupabaseError(error.message), message: error.message } }
    }
    return {
      data: (data ?? []).map((row) => transactionFromRow(row as TransactionRow)),
      result: { ok: true },
    }
  },

  async upsert(transaction) {
    const auth = await requireUser()
    if (!auth || !auth.result.ok) return auth?.result ?? { ok: false, error: 'unknown' }

    const row = transactionToRow(transaction, auth.userId)
    const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'id' })
    if (error) {
      return { ok: false, error: mapSupabaseError(error.message), message: error.message }
    }
    return { ok: true }
  },

  async upsertMany(transactions) {
    const auth = await requireUser()
    if (!auth || !auth.result.ok) return auth?.result ?? { ok: false, error: 'unknown' }
    if (transactions.length === 0) return { ok: true }

    const rows = transactions.map((t) => transactionToRow(t, auth.userId))
    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'id' })
    if (error) {
      return { ok: false, error: mapSupabaseError(error.message), message: error.message }
    }
    return { ok: true }
  },

  async delete(id) {
    const auth = await requireUser()
    if (!auth || !auth.result.ok) return auth?.result ?? { ok: false, error: 'unknown' }

    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) {
      return { ok: false, error: mapSupabaseError(error.message), message: error.message }
    }
    return { ok: true }
  },
}
