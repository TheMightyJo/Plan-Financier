// Edge Function : ai-chat
// ---------------------------------------------------------------------------
// Proxy IA « inclus dans le compte » : le navigateur n'a plus besoin d'une
// clé Anthropic personnelle. La clé serveur (secret ANTHROPIC_API_KEY) reste
// ici, et un quota mensuel de messages s'applique selon le plan de
// l'utilisateur (table subscriptions, alimentée par le webhook Stripe).
//
//   POST { system?, messages, max_tokens? }  → { text, quota }
//   POST { usage: true }                     → { plan, used, limit }
//   429  { error: { message }, quota }         si le quota du mois est atteint
//
// Sécurité : JWT vérifié en code ; la clé IA n'est jamais renvoyée ; les
// compteurs sont incrémentés via la fonction SQL increment_ai_usage
// (service_role uniquement).
//
// Déploiement :
//   supabase functions deploy ai-chat --no-verify-jwt
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const MODEL = 'claude-haiku-4-5-20251001'

/** Messages max par minute et par utilisateur (anti-abus). */
const RATE_LIMIT_PER_MINUTE = 10

/** Messages IA inclus par mois selon le plan. */
const PLAN_LIMITS: Record<string, number> = {
  free: 15,
  premium: 300,
  family: 500,
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })

type IncomingMessage = { role?: unknown; content?: unknown }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: { message: 'method_not_allowed' } })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json(401, { error: { message: 'missing_authorization_header' } })
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) {
    return json(401, { error: { message: 'invalid_session' } })
  }
  const userId = userData.user.id

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Plan actif → limite mensuelle.
  const { data: sub } = await admin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  const planActive = sub && ['active', 'trialing', 'past_due'].includes(sub.status ?? '')
  const plan = planActive ? (sub.plan as string) : 'free'
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free

  // Période courante (UTC) : 'YYYY-MM'.
  const period = new Date().toISOString().slice(0, 7)
  const { data: usageRow } = await admin
    .from('ai_usage')
    .select('used')
    .eq('user_id', userId)
    .eq('period', period)
    .maybeSingle()
  const used = usageRow?.used ?? 0

  let body: {
    usage?: boolean
    system?: unknown
    messages?: unknown
    max_tokens?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: { message: 'invalid_body' } })
  }

  // Simple consultation du quota (affichage dans les paramètres).
  if (body.usage === true) {
    return json(200, { plan, used, limit })
  }

  if (!ANTHROPIC_API_KEY) {
    return json(503, {
      error: { message: "L'IA incluse n'est pas encore activée sur le serveur. Ajoutez votre clé personnelle en attendant." },
    })
  }

  if (used >= limit) {
    return json(429, {
      error: { message: `Quota mensuel atteint (${limit} messages).` },
      quota: { plan, used, limit },
    })
  }

  // Validation légère du payload transmis au modèle.
  const messages = Array.isArray(body.messages) ? (body.messages as IncomingMessage[]) : []
  if (messages.length === 0 || messages.length > 60) {
    return json(400, { error: { message: 'invalid_messages' } })
  }
  if (!messages.every((m) => (m.role === 'user' || m.role === 'assistant') && m.content != null)) {
    return json(400, { error: { message: 'invalid_messages' } })
  }
  const system = typeof body.system === 'string' ? body.system.slice(0, 12_000) : undefined
  const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 400, 1), 2000)

  // Rate limiting : fenêtre glissante d'une minute par utilisateur (en plus
  // du quota mensuel) — un script ne peut pas brûler le quota en un instant.
  const { data: rate } = await admin
    .from('ai_rate_limits')
    .select('window_start, count')
    .eq('user_id', userId)
    .maybeSingle()
  const windowStartMs = rate ? new Date(rate.window_start as string).getTime() : 0
  const inWindow = Date.now() - windowStartMs < 60_000
  const currentCount = inWindow ? Number(rate?.count ?? 0) : 0
  if (currentCount >= RATE_LIMIT_PER_MINUTE) {
    return json(429, {
      error: { code: 'rate_limited', message: "Trop de messages d'un coup — patientez une minute avant de réessayer." },
      quota: { plan, used, limit },
    })
  }
  await admin.from('ai_rate_limits').upsert({
    user_id: userId,
    window_start: inWindow ? (rate!.window_start as string) : new Date().toISOString(),
    count: currentCount + 1,
  })

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages,
    }),
  })

  if (!anthropicResponse.ok) {
    const err = await anthropicResponse.json().catch(() => ({}))
    const message =
      (err as { error?: { message?: string } }).error?.message ??
      `Erreur du fournisseur IA (${anthropicResponse.status}).`
    // Pas d'incrément : l'échec ne consomme pas de crédit.
    return json(502, { error: { message } })
  }

  const data = (await anthropicResponse.json()) as {
    content: Array<{ type: string; text: string }>
  }
  const text = data.content.find((c) => c.type === 'text')?.text ?? ''

  const { data: newUsed } = await admin.rpc('increment_ai_usage', {
    p_user: userId,
    p_period: period,
  })

  return json(200, {
    text,
    quota: { plan, used: typeof newUsed === 'number' ? newUsed : used + 1, limit },
  })
})
