import { isSupabaseConfigured, supabase } from '../supabase'

/**
 * Wrapper minimal pour le registre des traitements (Art. 30 RGPD).
 * Insère une ligne immuable dans `public.audit_logs` à chaque action critique.
 *
 * - `user_id` est auto-renseigné par la RLS (`audit_insert_self` policy)
 *   depuis le JWT, pas besoin de le passer côté client.
 * - `audit_logs` a `UPDATE` et `DELETE` revoke depuis `authenticated`,
 *   donc une fois inséré, le log est immuable côté user (réservé service_role).
 *
 * Échec silencieux côté client (warn console) — ne PAS bloquer l'action
 * utilisateur principale si le log n'arrive pas. La conformité RGPD est
 * réalisée par best-effort + triggers Postgres côté serveur (étape V2).
 */

export type AuditAction =
  | 'login'
  | 'logout'
  | 'signup'
  | 'export'
  | 'erase_request'
  | 'pin_change'
  | 'tos_accepted'
  | 'ai_consent_given'
  | 'ai_consent_revoked'
  | 'transaction_delete_bulk'
  | 'share_account'

export type AuditMetadata = Record<string, unknown>

const userAgentHash = async (): Promise<string | null> => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null
  try {
    const ua = navigator.userAgent
    const encoded = new TextEncoder().encode(ua)
    const buf = await crypto.subtle.digest('SHA-256', encoded as unknown as ArrayBuffer)
    return Array.from(new Uint8Array(buf))
      .slice(0, 8) // 8 premiers octets = 16 chars hex, anonyme + non identifiant
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return null
  }
}

export const logAuditEvent = async (
  action: AuditAction,
  options: {
    entity?: string
    entityId?: string
    metadata?: AuditMetadata
  } = {},
): Promise<void> => {
  if (!isSupabaseConfigured()) return

  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) return

  const ua = await userAgentHash()
  const { error } = await supabase.from('audit_logs').insert({
    user_id: sessionData.session.user.id,
    action,
    entity: options.entity ?? null,
    entity_id: options.entityId ?? null,
    user_agent_hash: ua,
    ip_country: null, // Pays calculé côté Edge Function ou trigger Postgres en V2
    metadata: options.metadata ?? null,
  })

  if (error) {
    // Best-effort : on ne bloque pas l'action utilisateur si le log échoue
    console.warn('[audit] log skipped:', action, error.message)
  }
}
