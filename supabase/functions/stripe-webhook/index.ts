// Edge Function : stripe-webhook
// ---------------------------------------------------------------------------
// Reçoit les événements Stripe et tient à jour la table `subscriptions`.
// La signature `Stripe-Signature` est vérifiée (HMAC-SHA256, tolérance 10 min)
// — aucun JWT ici : c'est Stripe qui appelle, pas l'application.
//
// Événements gérés :
//   checkout.session.completed        → activation du plan après paiement
//   customer.subscription.updated     → renouvellement / changement / annulation programmée
//   customer.subscription.deleted     → retour au plan gratuit
//
// Secrets requis : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (whsec_…),
// et les STRIPE_PRICE_* (mêmes valeurs que stripe-checkout) pour mapper
// price → plan.
//
// Déploiement : supabase functions deploy stripe-webhook --no-verify-jwt
// Endpoint à déclarer dans Stripe : https://<ref>.supabase.co/functions/v1/stripe-webhook
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const PLAN_BY_PRICE: Record<string, 'premium' | 'family'> = {}
for (const [env, plan] of [
  ['STRIPE_PRICE_PREMIUM_MONTHLY', 'premium'],
  ['STRIPE_PRICE_PREMIUM_YEARLY', 'premium'],
  ['STRIPE_PRICE_FAMILY_MONTHLY', 'family'],
  ['STRIPE_PRICE_FAMILY_YEARLY', 'family'],
] as const) {
  const id = Deno.env.get(env)
  if (id) PLAN_BY_PRICE[id] = plan
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

/** Vérifie la signature Stripe (t=…,v1=…) sur le corps brut. */
const verifySignature = async (payload: string, header: string | null): Promise<boolean> => {
  if (!header || !STRIPE_WEBHOOK_SECRET) return false
  const parts = new Map<string, string[]>()
  for (const piece of header.split(',')) {
    const [k, v] = piece.split('=', 2)
    if (!k || !v) continue
    const list = parts.get(k.trim()) ?? []
    list.push(v.trim())
    parts.set(k.trim(), list)
  }
  const timestamp = parts.get('t')?.[0]
  const signatures = parts.get('v1') ?? []
  if (!timestamp || signatures.length === 0) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 600) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(STRIPE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`))
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return signatures.some((sig) => sig.toLowerCase() === expected)
}

type StripeSubscription = {
  id: string
  status: string
  customer: string
  cancel_at_period_end?: boolean
  current_period_end?: number
  metadata?: Record<string, string>
  items?: { data?: Array<{ price?: { id?: string } }> }
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

/** user_id depuis les metadata, sinon retrouvé via le customer Stripe. */
const resolveUserId = async (sub: StripeSubscription): Promise<string | null> => {
  if (sub.metadata?.user_id) return sub.metadata.user_id
  const { data } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', sub.customer)
    .maybeSingle()
  return (data?.user_id as string | null) ?? null
}

const upsertFromSubscription = async (sub: StripeSubscription, deleted: boolean) => {
  const userId = await resolveUserId(sub)
  if (!userId) {
    console.error('stripe-webhook: user introuvable pour customer', sub.customer)
    return
  }
  const priceId = sub.items?.data?.[0]?.price?.id ?? null
  const plan = deleted ? 'free' : (priceId && PLAN_BY_PRICE[priceId]) || 'premium'
  await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      plan,
      status: deleted ? 'canceled' : sub.status,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      price_id: priceId,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
}

const fetchSubscriptionFromStripe = async (id: string): Promise<StripeSubscription | null> => {
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${id}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  })
  if (!response.ok) return null
  return (await response.json()) as StripeSubscription
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }

  const payload = await req.text()
  const valid = await verifySignature(payload, req.headers.get('stripe-signature'))
  if (!valid) {
    return json(401, { error: 'invalid_signature' })
  }

  let event: { type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(payload)
  } catch {
    return json(400, { error: 'invalid_payload' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          client_reference_id?: string
          customer?: string
          subscription?: string
        }
        if (session.subscription) {
          const sub = await fetchSubscriptionFromStripe(session.subscription)
          if (sub) {
            // Sécurise le user_id via client_reference_id si les metadata manquent.
            if (session.client_reference_id && !sub.metadata?.user_id) {
              sub.metadata = { ...(sub.metadata ?? {}), user_id: session.client_reference_id }
            }
            await upsertFromSubscription(sub, false)
          }
        }
        break
      }
      case 'customer.subscription.updated':
        await upsertFromSubscription(event.data.object as unknown as StripeSubscription, false)
        break
      case 'customer.subscription.deleted':
        await upsertFromSubscription(event.data.object as unknown as StripeSubscription, true)
        break
      default:
        // Événement non géré : accusé de réception silencieux.
        break
    }
  } catch (error) {
    console.error('stripe-webhook failed:', error instanceof Error ? error.message : error)
    return json(500, { error: 'webhook_failed' })
  }

  return json(200, { received: true })
})
