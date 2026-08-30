// Edge Function : send-report
// ---------------------------------------------------------------------------
// Génère et envoie par email le rapport budgétaire d'un utilisateur, à partir
// de ses transactions synchronisées (Postgres).
//
// Deux modes :
//   1. Utilisateur authentifié + body {test:true} → rapport envoyé à SA propre
//      adresse immédiatement (bouton « rapport test » dans les Paramètres).
//   2. Cron (header x-cron-secret = CRON_SECRET) + body {cron:true} → parcourt
//      report_preferences et envoie les rapports « dus » (hebdo : ≥ 6,5 jours
//      depuis le dernier ; mensuel : pas encore envoyé ce mois-ci).
//
// Envoi : API Resend (secret RESEND_API_KEY). Expéditeur : REPORT_FROM
// (défaut : onboarding@resend.dev — en compte Resend gratuit non vérifié,
// seuls les envois vers l'email du compte Resend fonctionnent).
//
// Déploiement :
//   supabase functions deploy send-report --no-verify-jwt
// Secrets (Edge Functions → send-report → Secrets) :
//   RESEND_API_KEY, CRON_SECRET, REPORT_FROM (optionnel)
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const REPORT_FROM = Deno.env.get('REPORT_FROM') ?? 'Plan Financier <onboarding@resend.dev>'

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

type TxRow = {
  amount: number
  kind: 'debit' | 'credit' | 'transfer'
  occurred_at: string
  label: string
  notes: string | null
}

const euro = (value: number) =>
  value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const categoryOf = (notes: string | null): string => {
  if (!notes) return 'Autre'
  try {
    const meta = JSON.parse(notes) as { pf?: number; cat?: string }
    return meta.pf === 1 && meta.cat ? meta.cat : 'Autre'
  } catch {
    return 'Autre'
  }
}

const buildReportHtml = (
  periodLabel: string,
  rows: TxRow[],
  format: 'summary' | 'detailed',
): { subject: string; html: string } => {
  const spent = rows.filter((r) => r.kind === 'debit').reduce((s, r) => s + Number(r.amount), 0)
  const income = rows.filter((r) => r.kind === 'credit').reduce((s, r) => s + Number(r.amount), 0)
  const byCategory = new Map<string, number>()
  rows
    .filter((r) => r.kind === 'debit')
    .forEach((r) => byCategory.set(categoryOf(r.notes), (byCategory.get(categoryOf(r.notes)) ?? 0) + Number(r.amount)))
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const catRows = topCategories
    .map(([cat, total]) => `<tr><td style="padding:6px 12px;">${cat}</td><td style="padding:6px 12px;text-align:right;font-weight:700;">${euro(total)}</td></tr>`)
    .join('')

  const detailRows =
    format === 'detailed'
      ? rows
          .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
          .slice(0, 60)
          .map(
            (r) =>
              `<tr><td style="padding:4px 12px;color:#A08060;">${r.occurred_at}</td><td style="padding:4px 12px;">${r.label}</td><td style="padding:4px 12px;text-align:right;font-weight:700;color:${r.kind === 'credit' ? '#3A7D44' : '#C05C2A'};">${r.kind === 'credit' ? '+' : '−'}${euro(Number(r.amount))}</td></tr>`,
          )
          .join('')
      : ''

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#FDFAF6;font-family:'Segoe UI',Arial,sans-serif;color:#3D2B1F;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:22px;margin:0 0 4px;">💰 Plan Financier</h1>
    <p style="margin:0 0 20px;color:#A08060;">Votre rapport — ${periodLabel}</p>
    <div style="background:#fff;border:1px solid #D6C5B0;border-radius:12px;padding:18px;margin-bottom:16px;">
      <p style="margin:0 0 6px;font-size:15px;">Dépensé : <strong style="color:#C05C2A;">−${euro(spent)}</strong></p>
      <p style="margin:0 0 6px;font-size:15px;">Reçu : <strong style="color:#3A7D44;">+${euro(income)}</strong></p>
      <p style="margin:0;font-size:15px;">Solde de la période : <strong>${income - spent >= 0 ? '+' : ''}${euro(income - spent)}</strong></p>
    </div>
    ${topCategories.length > 0 ? `<div style="background:#fff;border:1px solid #D6C5B0;border-radius:12px;padding:12px;margin-bottom:16px;">
      <p style="margin:4px 12px 8px;font-weight:700;">Top catégories</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${catRows}</table>
    </div>` : ''}
    ${detailRows ? `<div style="background:#fff;border:1px solid #D6C5B0;border-radius:12px;padding:12px;margin-bottom:16px;">
      <p style="margin:4px 12px 8px;font-weight:700;">Détail des opérations</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">${detailRows}</table>
    </div>` : ''}
    <p style="color:#A08060;font-size:12px;">Rapport automatique Plan Financier — modifiez la fréquence dans Paramètres → Rapport par email.</p>
  </div>
  </body></html>`

  return { subject: `📊 Votre rapport Plan Financier — ${periodLabel}`, html }
}

const sendEmail = async (to: string, subject: string, html: string): Promise<string | null> => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REPORT_FROM, to: [to], subject, html }),
  })
  if (!response.ok) {
    return await response.text()
  }
  return null
}

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

const periodFor = (frequency: 'weekly' | 'monthly') => {
  if (frequency === 'weekly') {
    return { from: isoDaysAgo(7), label: 'les 7 derniers jours' }
  }
  // Mensuel : le mois calendaire précédent complet.
  const now = new Date()
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const from = first.toISOString().slice(0, 10)
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10)
  const label = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { from, to, label }
}

const sendReportTo = async (
  admin: ReturnType<typeof createClient>,
  userId: string,
  email: string,
  frequency: 'weekly' | 'monthly',
  format: 'summary' | 'detailed',
): Promise<string | null> => {
  const period = periodFor(frequency)
  let query = admin
    .from('transactions')
    .select('amount, kind, occurred_at, label, notes')
    .eq('created_by_user_id', userId)
    .is('deleted_at', null)
    .gte('occurred_at', period.from)
  if ('to' in period && period.to) query = query.lte('occurred_at', period.to)
  const { data, error } = await query
  if (error) return error.message
  const { subject, html } = buildReportHtml(period.label, (data ?? []) as TxRow[], format)
  return await sendEmail(email, subject, html)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  if (!RESEND_API_KEY) return json(500, { error: 'resend_not_configured' })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  let body: { test?: boolean; cron?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    /* body vide accepté */
  }

  // ── Mode cron : tous les rapports dus ────────────────────────────────
  if (body.cron) {
    if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
      return json(401, { error: 'invalid_cron_secret' })
    }
    const { data: prefs, error } = await admin
      .from('report_preferences')
      .select('user_id, frequency, format, last_sent_at')
      .neq('frequency', 'none')
    if (error) return json(500, { error: 'prefs_read_failed', detail: error.message })

    const now = new Date()
    let sent = 0
    const failures: string[] = []
    for (const pref of prefs ?? []) {
      const last = pref.last_sent_at ? new Date(pref.last_sent_at) : null
      const due =
        pref.frequency === 'weekly'
          ? !last || now.getTime() - last.getTime() > 6.5 * 86_400_000
          : !last || last.toISOString().slice(0, 7) !== now.toISOString().slice(0, 7)
      if (!due) continue

      const { data: userData } = await admin.auth.admin.getUserById(pref.user_id)
      const email = userData?.user?.email
      if (!email) continue

      const failure = await sendReportTo(admin, pref.user_id, email, pref.frequency, pref.format)
      if (failure) {
        failures.push(`${email}: ${failure}`)
        continue
      }
      await admin
        .from('report_preferences')
        .update({ last_sent_at: now.toISOString() })
        .eq('user_id', pref.user_id)
      sent += 1
    }
    return json(200, { ok: true, sent, failures })
  }

  // ── Mode test : l'utilisateur s'envoie son rapport tout de suite ────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { error: 'missing_authorization_header' })
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user?.email) return json(401, { error: 'invalid_session' })

  const { data: pref } = await admin
    .from('report_preferences')
    .select('frequency, format')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  const frequency = pref?.frequency === 'weekly' ? 'weekly' : 'monthly'
  const format = pref?.format === 'detailed' ? 'detailed' : 'summary'
  const failure = await sendReportTo(admin, userData.user.id, userData.user.email, frequency, format)
  if (failure) return json(502, { error: 'send_failed', detail: failure })
  return json(200, { ok: true, sentTo: userData.user.email })
})
