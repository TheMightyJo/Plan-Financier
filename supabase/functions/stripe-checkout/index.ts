// Edge Function : stripe-checkout
// ---------------------------------------------------------------------------
// Crée une session Stripe Checkout (abonnement Premium ou Famille) pour
// l'utilisateur connecté et retourne son URL. Le client Stripe est créé au
// premier passage et mémorisé dans `subscriptions.stripe_customer_id`.
//
//   POST { plan: 'premium' | 'family', interval: 'monthly' | 'yearly' } → { url }
//
// Secrets requis :
//   STRIPE_SECRET_KEY               clé secrète Stripe (sk_live_… / sk_test_…)
//   STRIPE_PRICE_PREMIUM_MONTHLY    price_… (3,99 €/mois)
//   STRIPE_PRICE_PREMIUM_YEARLY     price_… (29,99 €/an)
//   STRIPE_PRICE_FAMILY_MONTHLY     price_… (5,99 €/mois)
//   STRIPE_PRICE_FAMILY_YEARLY     price_… (44,99 €/an)
//
// Déploiement : supabase functions deploy stripe-checkout --no-verify-jwt
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://planfinancier.app'

const PRICE_IDS: Record<string, string> = {
  'premium-monthly': Deno.env.get('STRIPE_PRICE_PREMIUM_MONTHLY') ?? '',
  'premium-yearly': Deno.env.get('STRIPE_PRICE_PREMIUM_YEARLY') ?? '',
  'family-monthly': Deno.env.get('STRIPE_PRICE_FAMILY_MONTHLY') ?? '',
  'family-yearly': Deno.env.get('STRIPE_PRICE_FAMILY_YEARLY') ?? '',
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

/** Appel REST Stripe (form-encodé, pas de SDK nécessaire sous Deno). */
const stripePost = async (path: string, params: Record<string, string>) => {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Stripe ${response.status}`)
  }
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json(401, { error: 'missing_authorization_header' })
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) {
    return json(401, { error: 'invalid_session' })
  }
  const user = userData.user

  let plan = ''
  let interval = ''
  try {
    const body = await req.json()
    plan = String(body.plan ?? '')
    interval = String(body.interval ?? '')
  } catch {
    return json(400, { error: 'invalid_body' })
  }
  if (!['premium', 'family'].includes(plan) || !['monthly', 'yearly'].includes(interval)) {
    return json(400, { error: 'invalid_plan' })
  }

  const priceId = PRICE_IDS[`${plan}-${interval}`]
  if (!STRIPE_SECRET_KEY || !priceId) {
    return json(503, { error: 'billing_not_configured' })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // Client Stripe existant, ou création + mémorisation.
    const { data: row } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()
    let customerId = row?.stripe_customer_id as string | null

    if (!customerId) {
      const customer = await stripePost('customers', {
        email: user.email ?? '',
        'metadata[user_id]': user.id,
      })
      customerId = customer.id as string
      await admin.from('subscriptions').upsert(
        { user_id: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    }

    const session = await stripePost('checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${APP_URL}/app?checkout=success`,
      cancel_url: `${APP_URL}/app?checkout=cancelled`,
      client_reference_id: user.id,
      'subscription_data[metadata][user_id]': user.id,
      allow_promotion_codes: 'true',
      locale: 'fr',
    })

    return json(200, { url: session.url })
  } catch (error) {
    console.error('stripe-checkout failed:', error instanceof Error ? error.message : error)
    return json(500, { error: 'checkout_failed' })
  }
})
