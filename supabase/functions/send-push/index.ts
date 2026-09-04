// Edge Function : send-push
// ---------------------------------------------------------------------------
// Bilan de la semaine en notification push (Web Push, VAPID), le dimanche
// soir : « Votre semaine : Normal ✅ — +180 € ». Calculé côté serveur à
// partir des transactions synchronisées des 7 derniers jours (et des 7
// précédents pour le statut « Up »).
//
//   POST { cron: true } + header x-cron-secret → envoie à tous les abonnés
//   POST { test: true } + session utilisateur  → envoie à SES appareils
//
// Secrets : CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//           VAPID_SUBJECT (mailto:contact@protojo.fr), APP_URL.
// Déploiement : supabase functions deploy send-push --no-verify-jwt
// Cron : dimanche 17:00 UTC (19h Paris en été) — voir docs/semaine-7.md.
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@protojo.fr'
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

const euro = (value: number) =>
  value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

type Totals = { spent: number; income: number }

const totalsBetween = async (
  admin: ReturnType<typeof createClient>,
  userId: string,
  from: string,
  to: string,
): Promise<Totals> => {
  const { data } = await admin
    .from('transactions')
    .select('amount, kind')
    .eq('created_by_user_id', userId)
    .is('deleted_at', null)
    .gte('occurred_at', from)
    .lt('occurred_at', to)
  let spent = 0
  let income = 0
  for (const row of (data ?? []) as Array<{ amount: number; kind: string }>) {
    if (row.kind === 'debit') spent += Number(row.amount)
    else if (row.kind === 'credit') income += Number(row.amount)
  }
  return { spent, income }
}

/** Message du bilan hebdo pour un utilisateur (null si aucune activité). */
const weeklyMessage = async (admin: ReturnType<typeof createClient>, userId: string) => {
  const today = isoDaysAgo(0)
  const week = await totalsBetween(admin, userId, isoDaysAgo(7), today)
  const previous = await totalsBetween(admin, userId, isoDaysAgo(14), isoDaysAgo(7))
  if (week.spent === 0 && week.income === 0) return null
  const net = week.income - week.spent
  const previousNet = previous.income - previous.spent
  const status = net < 0 ? { label: 'Danger', icon: '⚠️' } : net > previousNet ? { label: 'Up', icon: '📈' } : { label: 'Normal', icon: '✅' }
  return {
    title: `Votre semaine : ${status.label} ${status.icon}`,
    body: `${net >= 0 ? '+' : ''}${euro(net)} · dépensé ${euro(week.spent)}, reçu ${euro(week.income)}`,
    url: `${APP_URL}/app/statistiques`,
    tag: 'weekly-summary',
  }
}

type SubscriptionRow = { endpoint: string; p256dh: string; auth: string; user_id: string }

const pushTo = async (
  admin: ReturnType<typeof createClient>,
  row: SubscriptionRow,
  payload: { title: string; body: string; url: string; tag: string },
): Promise<'sent' | 'removed' | 'failed'> => {
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify(payload),
      { vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY }, TTL: 6 * 3600 },
    )
    await admin
      .from('push_subscriptions')
      .update({ last_success_at: new Date().toISOString(), failures: 0 })
      .eq('endpoint', row.endpoint)
    return 'sent'
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) {
      // Abonnement expiré ou révoqué : on le retire.
      await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
      return 'removed'
    }
    console.error('send-push failed:', status, (error as Error).message)
    await admin
      .from('push_subscriptions')
      .update({ failures: 1 })
      .eq('endpoint', row.endpoint)
    return 'failed'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return json(503, { error: 'push_not_configured' })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  let body: { cron?: boolean; test?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    /* body vide accepté */
  }

  // ── Cron : bilan hebdo à tous les abonnés ────────────────────────────
  if (body.cron) {
    if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
      return json(401, { error: 'invalid_cron_secret' })
    }
    const { data: rows, error } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .eq('weekly', true)
    if (error) return json(500, { error: 'read_failed', detail: error.message })

    const messages = new Map<string, Awaited<ReturnType<typeof weeklyMessage>>>()
    let sent = 0
    let removed = 0
    let failed = 0
    let silent = 0
    for (const row of (rows ?? []) as SubscriptionRow[]) {
      if (!messages.has(row.user_id)) messages.set(row.user_id, await weeklyMessage(admin, row.user_id))
      const message = messages.get(row.user_id)
      if (!message) {
        silent++
        continue
      }
      const result = await pushTo(admin, row, message)
      if (result === 'sent') sent++
      else if (result === 'removed') removed++
      else failed++
    }
    return json(200, { sent, removed, failed, silent })
  }

  // ── Test : l'utilisateur s'envoie une notification tout de suite ─────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { error: 'missing_authorization_header' })
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json(401, { error: 'invalid_session' })

  const { data: rows } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .eq('user_id', userData.user.id)
  if (!rows || rows.length === 0) return json(404, { error: 'no_subscription' })

  const message = (await weeklyMessage(admin, userData.user.id)) ?? {
    title: 'Plan Financier 👋',
    body: 'Les notifications fonctionnent. Rendez-vous dimanche soir pour votre bilan.',
    url: `${APP_URL}/app`,
    tag: 'test',
  }
  let sent = 0
  for (const row of rows as SubscriptionRow[]) {
    if ((await pushTo(admin, row, message)) === 'sent') sent++
  }
  return json(200, { sent })
})
