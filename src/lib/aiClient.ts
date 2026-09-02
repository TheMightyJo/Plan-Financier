import { supabase } from '../supabase'

/**
 * Client unique pour parler au modèle de Cash.
 *
 * Deux chemins :
 *  - Clé Anthropic personnelle fournie → appel direct navigateur (comportement
 *    historique, aucun quota).
 *  - Sinon → fonction Edge `ai-chat` : l'IA est incluse dans le compte, la clé
 *    serveur reste secrète et un quota mensuel s'applique selon le plan.
 */

export const CASH_MODEL = 'claude-haiku-4-5-20251001'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export type AiQuota = { plan: 'free' | 'premium' | 'family'; used: number; limit: number }

export class AiQuotaExceededError extends Error {
  quota: AiQuota | null

  constructor(quota: AiQuota | null) {
    const limitText = quota ? ` (${quota.limit} messages)` : ''
    super(
      `Quota IA du mois atteint${limitText}. Passez Premium pour continuer, ou ajoutez votre propre clé API dans Paramètres → Assistant IA.`,
    )
    this.name = 'AiQuotaExceededError'
    this.quota = quota
  }
}

type CashMessage = { role: 'user' | 'assistant'; content: unknown }

type CallOptions = {
  /** Clé Anthropic personnelle : prioritaire, appel direct sans quota. */
  apiKey?: string
  system?: string
  messages: CashMessage[]
  maxTokens: number
  signal?: AbortSignal
}

type AnthropicResponse = { content: Array<{ type: string; text: string }> }

const extractText = (data: AnthropicResponse): string =>
  data.content.find((c) => c.type === 'text')?.text ?? ''

const callDirect = async (options: CallOptions): Promise<string> => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: options.signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': options.apiKey ?? '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CASH_MODEL,
      max_tokens: options.maxTokens,
      ...(options.system ? { system: options.system } : {}),
      messages: options.messages,
    }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = (err as { error?: { message?: string } }).error?.message ?? `Erreur ${response.status}`
    throw new Error(msg)
  }
  return extractText((await response.json()) as AnthropicResponse)
}

const callIncluded = async (options: CallOptions): Promise<string> => {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) {
    throw new Error('Connectez-vous (ou ajoutez votre clé IA) pour utiliser Cash.')
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      system: options.system,
      messages: options.messages,
      max_tokens: options.maxTokens,
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | { text?: string; quota?: AiQuota; error?: { message?: string } }
    | null

  if (response.status === 429) {
    const code = (payload?.error as { code?: string } | undefined)?.code
    if (code === 'rate_limited') {
      throw new Error(payload?.error?.message ?? "Trop de messages d'un coup — patientez une minute.")
    }
    throw new AiQuotaExceededError(payload?.quota ?? null)
  }
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Cash est indisponible pour le moment. Réessayez dans un instant.')
  }
  return payload?.text ?? ''
}

/** Appelle le modèle de Cash et retourne le texte de la réponse. */
export const callCashModel = async (options: CallOptions): Promise<string> => {
  if (options.apiKey?.trim()) {
    return callDirect({ ...options, apiKey: options.apiKey.trim() })
  }
  return callIncluded(options)
}

/** Quota IA du mois pour l'utilisateur connecté (null si indisponible). */
export const fetchAiQuota = async (): Promise<AiQuota | null> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return null
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ usage: true }),
    })
    if (!response.ok) return null
    const payload = (await response.json()) as Partial<AiQuota>
    if (typeof payload.used !== 'number' || typeof payload.limit !== 'number') return null
    return { plan: payload.plan ?? 'free', used: payload.used, limit: payload.limit }
  } catch {
    return null
  }
}
