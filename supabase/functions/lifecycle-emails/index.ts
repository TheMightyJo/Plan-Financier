// Edge Function : lifecycle-emails
// ---------------------------------------------------------------------------
// Emails de cycle de vie, envoyés via Resend, une seule fois par utilisateur
// (journal public.lifecycle_emails) :
//
//   1. Bienvenue — POST { event: 'welcome' } avec la session de l'utilisateur
//      (appelé par l'app à la fin de l'onboarding).
//   2. Relance J+3 — POST { cron: true } + header x-cron-secret : parcourt les
//      profils dont l'onboarding date de 3 à 4 jours et envoie le conseil
//      « poches » (une fois).
//
// Secrets : RESEND_API_KEY, CRON_SECRET, REPORT_FROM (optionnel), APP_URL.
// Déploiement : supabase functions deploy lifecycle-emails --no-verify-jwt
// Cron quotidien : voir docs/semaine-1.md.
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const FROM = Deno.env.get('REPORT_FROM') ?? 'Plan Financier <onboarding@resend.dev>'
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

// ── Gabarit ───────────────────────────────────────────────────────────────

const layout = (title: string, inner: string) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#FDFAF6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2A1810;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDFAF6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E6DCCB;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(130deg,#8B6C52,#B8963E);padding:18px 24px;color:#FFF8F0;font-weight:800;font-size:18px;">💰 Plan Financier</td></tr>
        <tr><td style="padding:26px 24px;font-size:16px;line-height:1.6;">${inner}</td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #E6DCCB;color:#6B5644;font-size:12px;line-height:1.5;">
          Vous recevez cet email parce que vous avez créé un compte sur ${APP_URL.replace('https://', '')}.
          Fait en France 🇫🇷 par ProtoJo Digital · <a href="${APP_URL}/blog/" style="color:#6B5644;">Blog</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;margin:6px 0;padding:12px 22px;border-radius:999px;background:linear-gradient(130deg,#8B6C52,#B8963E);color:#FFFFFF;font-weight:700;text-decoration:none;">${label}</a>`

const welcomeEmail = (firstName: string) => ({
  subject: 'Bienvenue sur Plan Financier 👋 — vos 3 premières minutes',
  html: layout(
    'Bienvenue sur Plan Financier',
    `<p style="margin:0 0 12px;font-size:20px;font-weight:800;">Bonjour ${firstName} 👋</p>
     <p style="margin:0 0 16px;">Bienvenue ! Vous venez de faire le plus dur : décider de voir clair dans votre argent. Voici comment obtenir un vrai résultat dès aujourd'hui, en trois minutes :</p>
     <ol style="margin:0 0 18px;padding-left:22px;">
       <li style="margin-bottom:8px;"><strong>Ajoutez vos charges fixes</strong> (loyer, énergie, abonnements) avec leur date : elles apparaîtront sur le calendrier avant de tomber.</li>
       <li style="margin-bottom:8px;"><strong>Créez 3 poches</strong> — Courses, Sorties, Imprévus — et mettez un montant dans chacune.</li>
       <li><strong>Posez une question à Cash</strong>, votre assistant : « où part mon argent ce mois-ci ? »</li>
     </ol>
     <p style="margin:0 0 18px;">${button(`${APP_URL}/app`, 'Ouvrir Plan Financier')}</p>
     <p style="margin:0;color:#6B5644;">Une question ? Répondez simplement à cet email, on lit tout.</p>`,
  ),
})

const followupEmail = (firstName: string) => ({
  subject: 'Le secret des familles qui tiennent leur budget : les poches ✉️',
  html: layout(
    'La méthode des poches',
    `<p style="margin:0 0 12px;font-size:20px;font-weight:800;">${firstName}, trois jours déjà !</p>
     <p style="margin:0 0 14px;">Une famille sur deux abandonne son budget en trois semaines. Pas par manque de volonté : parce qu'un solde qui baisse doucement, on ne le <em>sent</em> pas.</p>
     <p style="margin:0 0 14px;">La parade existe depuis un siècle : <strong>les poches</strong> (ou enveloppes). Un montant par usage — Courses, Sorties, Imprévus — et quand la poche est vide, on le voit tout de suite. Dans Plan Financier, chaque poche a même sa météo : ☀️ tout va bien, ⛈️ ça déborde.</p>
     <p style="margin:0 0 18px;">${button(`${APP_URL}/app/budget`, 'Créer mes poches')}</p>
     <p style="margin:0 0 6px;">Pour aller plus loin : <a href="${APP_URL}/blog/methode-des-enveloppes-budgetaires/" style="color:#C05C2A;">notre guide de la méthode des enveloppes</a> (5 min de lecture).</p>
     <p style="margin:0;color:#6B5644;">Et si quelque chose vous bloque, répondez à cet email.</p>`,
  ),
})

// ── Envoi ─────────────────────────────────────────────────────────────────

const sendEmail = async (to: string, subject: string, html: string): Promise<string | null> => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  return response.ok ? null : await response.text()
}

const firstNameOf = (displayName: string | null | undefined, email: string) => {
  const raw = (displayName ?? '').trim() || email.split('@')[0]
  const first = raw.split(/[\s._-]+/)[0] ?? raw
  return first.charAt(0).toUpperCase() + first.slice(1)
}

type Kind = 'welcome' | 'followup_d3'

/** Envoie l'email `kind` à l'utilisateur si pas déjà fait. */
const sendOnce = async (
  admin: ReturnType<typeof createClient>,
  userId: string,
  kind: Kind,
): Promise<'sent' | 'skipped' | string> => {
  const { data: already } = await admin
    .from('lifecycle_emails')
    .select('kind')
    .eq('user_id', userId)
    .eq('kind', kind)
    .maybeSingle()
  if (already) return 'skipped'

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
  const email = userData?.user?.email
  if (userError || !email) return 'no_email'

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle()
  const firstName = firstNameOf(profile?.display_name as string | undefined, email)

  const message = kind === 'welcome' ? welcomeEmail(firstName) : followupEmail(firstName)
  const failure = await sendEmail(email, message.subject, message.html)
  if (failure) return failure

  await admin.from('lifecycle_emails').upsert({ user_id: userId, kind, sent_at: new Date().toISOString() })
  return 'sent'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  if (!RESEND_API_KEY) return json(500, { error: 'resend_not_configured' })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  let body: { event?: string; cron?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    /* body vide accepté */
  }

  // ── Cron : relance J+3 ───────────────────────────────────────────────
  if (body.cron) {
    if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
      return json(401, { error: 'invalid_cron_secret' })
    }
    const now = Date.now()
    const from = new Date(now - 4 * 86_400_000).toISOString()
    const to = new Date(now - 3 * 86_400_000).toISOString()
    const { data: rows, error } = await admin
      .from('profiles')
      .select('user_id')
      .gte('onboarding_completed_at', from)
      .lt('onboarding_completed_at', to)
    if (error) return json(500, { error: 'profiles_read_failed', detail: error.message })

    let sent = 0
    let skipped = 0
    const failures: string[] = []
    for (const row of rows ?? []) {
      const result = await sendOnce(admin, row.user_id as string, 'followup_d3')
      if (result === 'sent') sent++
      else if (result === 'skipped') skipped++
      else failures.push(result)
    }
    return json(200, { sent, skipped, failures: failures.length })
  }

  // ── Session utilisateur : bienvenue ──────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { error: 'missing_authorization_header' })
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json(401, { error: 'invalid_session' })

  if (body.event !== 'welcome') return json(400, { error: 'unknown_event' })

  const result = await sendOnce(admin, userData.user.id, 'welcome')
  if (result === 'sent' || result === 'skipped') return json(200, { status: result })
  console.error('lifecycle-emails welcome failed:', result)
  return json(502, { error: 'send_failed' })
})
