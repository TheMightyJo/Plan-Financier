// Edge Function : stripe-portal
// ---------------------------------------------------------------------------
// Ouvre le portail client Stripe (factures, moyen de paiement, changement de
// formule, résiliation en un clic) pour l'utilisateur connecté.
//
//   POST {} → { url }
//
// Déploiement : supabase functions deploy stripe-portal --no-verify-jwt
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://planfinancier.app'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }
  if (!STRIPE_SECRET_KEY) {
    return json(503, { error: 'billing_not_configured' })
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

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: row } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  const customerId = row?.stripe_customer_id as string | null
  if (!customerId) {
    return json(404, { error: 'no_customer' })
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ customer: customerId, return_url: `${APP_URL}/app` }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error?.message ?? `Stripe ${response.status}`)
    }
    return json(200, { url: data.url })
  } catch (error) {
    console.error('stripe-portal failed:', error instanceof Error ? error.message : error)
    return json(500, { error: 'portal_failed' })
  }
})
