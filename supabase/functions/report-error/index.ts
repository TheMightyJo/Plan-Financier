// Edge Function : report-error
// ---------------------------------------------------------------------------
// Monitoring maison des erreurs de production (sans tiers) :
//   1. POST { message, stack?, url?, userAgent?, build?, userId? }
//      → dédup par empreinte (message + ligne de pile), compteur
//      d'occurrences dans public.client_errors. Appel public (clé anon),
//      donc taille des champs bornée et garde-fou anti-flood.
//   2. POST { cron: true } + header x-cron-secret
//      → digest des erreurs des dernières 24 h envoyé à ADMIN_EMAIL (Resend).
//
// Secrets : CRON_SECRET, RESEND_API_KEY, REPORT_FROM (optionnel),
//           ADMIN_EMAIL (défaut contact@protojo.fr).
// Déploiement : supabase functions deploy report-error --no-verify-jwt
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM = Deno.env.get('REPORT_FROM') ?? 'Plan Financier <onboarding@resend.dev>'
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? 'contact@protojo.fr'

/** Nouvelles empreintes max par heure (au-delà : on ignore, anti-flood). */
const MAX_NEW_FINGERPRINTS_PER_HOUR = 100

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

const clip = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length > 0 ? value.slice(0, max) : null

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const sha256 = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'invalid_body' })
  }

  // ── Cron : digest quotidien ──────────────────────────────────────────
  if (body.cron === true) {
    if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
      return json(401, { error: 'invalid_cron_secret' })
    }
    if (!RESEND_API_KEY) return json(500, { error: 'resend_not_configured' })

    const since = new Date(Date.now() - 24 * 3_600_000).toISOString()
    const { data: rows, error } = await admin
      .from('client_errors')
      .select('message, url, occurrences, first_seen, last_seen, build, user_id')
      .gte('last_seen', since)
      .order('occurrences', { ascending: false })
      .limit(30)
    if (error) return json(500, { error: 'read_failed', detail: error.message })
    if (!rows || rows.length === 0) return json(200, { sent: false, reason: 'no_errors' })

    const total = rows.reduce((sum, row) => sum + Number(row.occurrences ?? 0), 0)
    const list = rows
      .map(
        (row) => `<tr>
  <td style="padding:8px 10px;border-bottom:1px solid #E6DCCB;font-weight:700;text-align:right;">${row.occurrences}×</td>
  <td style="padding:8px 10px;border-bottom:1px solid #E6DCCB;">
    <div style="font-weight:600;">${escapeHtml(String(row.message))}</div>
    <div style="color:#6B5644;font-size:12px;">${escapeHtml(String(row.url ?? ''))} · dernière : ${new Date(String(row.last_seen)).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}${row.user_id ? ' · utilisateur identifié' : ''}</div>
  </td>
</tr>`,
      )
      .join('')

    const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#FDFAF6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2A1810;">
<div style="max-width:640px;margin:0 auto;padding:24px 12px;">
  <h1 style="font-size:20px;margin:0 0 6px;">🩺 Plan Financier — erreurs des dernières 24 h</h1>
  <p style="margin:0 0 16px;color:#6B5644;">${rows.length} erreur${rows.length > 1 ? 's' : ''} distincte${rows.length > 1 ? 's' : ''}, ${total} occurrence${total > 1 ? 's' : ''}.</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#fff;border:1px solid #E6DCCB;border-radius:12px;overflow:hidden;">${list}</table>
  <p style="margin:16px 0 0;color:#6B5644;font-size:12px;">Détail (pile d'appels) : Supabase → Table Editor → client_errors.</p>
</div></body></html>`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [ADMIN_EMAIL],
        subject: `🩺 ${rows.length} erreur${rows.length > 1 ? 's' : ''} sur Plan Financier (24 h)`,
        html,
      }),
    })
    if (!response.ok) return json(502, { error: 'send_failed', detail: await response.text() })
    return json(200, { sent: true, distinct: rows.length, total })
  }

  // ── Remontée d'une erreur ────────────────────────────────────────────
  const message = clip(body.message, 500)
  if (!message) return json(400, { error: 'missing_message' })
  const stack = clip(body.stack, 4000) ?? ''
  const url = clip(body.url, 200)
  const userAgent = clip(body.userAgent, 300)
  const build = clip(body.build, 120)
  const userId = typeof body.userId === 'string' && UUID_RE.test(body.userId) ? body.userId : null

  const stackLine = stack.split('\n').find((line) => line.includes('/assets/')) ?? stack.split('\n')[1] ?? ''
  const fingerprint = await sha256(`${message.slice(0, 120)}|${stackLine.trim().slice(0, 160)}`)
  const now = new Date().toISOString()

  const { data: existing } = await admin
    .from('client_errors')
    .select('id, occurrences')
    .eq('fingerprint', fingerprint)
    .maybeSingle()

  if (existing) {
    await admin
      .from('client_errors')
      .update({ occurrences: Number(existing.occurrences) + 1, last_seen: now, url, build, user_id: userId ?? undefined })
      .eq('id', existing.id)
    return json(200, { status: 'counted' })
  }

  // Anti-flood : trop de nouvelles empreintes dans l'heure → on ignore.
  const { count } = await admin
    .from('client_errors')
    .select('id', { count: 'exact', head: true })
    .gte('first_seen', new Date(Date.now() - 3_600_000).toISOString())
  if ((count ?? 0) >= MAX_NEW_FINGERPRINTS_PER_HOUR) return json(429, { status: 'throttled' })

  const { error: insertError } = await admin.from('client_errors').insert({
    fingerprint,
    message,
    stack: stack || null,
    url,
    user_agent: userAgent,
    build,
    user_id: userId,
    occurrences: 1,
    first_seen: now,
    last_seen: now,
  })
  if (insertError) return json(500, { error: 'insert_failed' })
  return json(200, { status: 'recorded' })
})
