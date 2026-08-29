// Accès aux données familiales (migration 0002_family_sharing) :
// invitations en attente, acceptation, pairs et données fusionnées (lecture).
import { isSupabaseConfigured, supabase } from '../supabase'
import { transactionFromRow, type TransactionRow } from '../lib/supabaseMappers'
import type { Transaction } from '../types'

export type FamilyInvite = {
  membershipId: string
  familyGroupId: string
  groupName: string
  inviterName: string
}

export type FamilyPeer = {
  userId: string
  displayName: string
}

/** Invitations en attente pour l'utilisateur connecté. */
export const listPendingInvites = async (): Promise<FamilyInvite[]> => {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase.rpc('family_pending_invites')
  if (error || !data) return []
  return (data as Array<Record<string, string>>).map((row) => ({
    membershipId: row.membership_id,
    familyGroupId: row.family_group_id,
    groupName: row.group_name,
    inviterName: row.inviter_name,
  }))
}

/** Accepte une invitation (policy : chacun peut mettre à jour sa membership). */
export const acceptInvite = async (membershipId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('family_memberships')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', membershipId)
  return !error
}

/** Membres acceptés de ma famille (moi inclus), avec noms d'affichage. */
export const listFamilyPeers = async (): Promise<FamilyPeer[]> => {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase.rpc('family_peers_info')
  if (error || !data) return []
  return (data as Array<Record<string, string>>).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
  }))
}

export type FamilyTransaction = Transaction & {
  /** Compte Supabase (personne) à l'origine de la transaction. */
  ownerUserId: string
}

/**
 * Transactions fusionnées de la famille (les miennes + celles des membres,
 * via la RLS de la migration 0002). Lecture seule.
 */
export const listFamilyTransactions = async (): Promise<FamilyTransaction[]> => {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(2000)
  if (error || !data) return []
  return (data as TransactionRow[]).map((row) => ({
    ...transactionFromRow(row),
    ownerUserId: row.created_by_user_id,
  }))
}
