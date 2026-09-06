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
//   3. Fin d'essai — même cron : comptes créés depuis le 1er octobre 2026,
//      sans abonnement payant, à J-3 (« votre essai se termine dans 3 jours »)
//      puis le jour J (« plan Découverte »). Migration 0013 requise.
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
const FROM = Deno.env.get('REPORT_FROM') ?? 'Plan Financier <contact@protojo.fr>'
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

// Logo 96×96 embarqué en pièce jointe inline (CID) : visible même si le client
// mail bloque le contenu distant.
const LOGO_CID = 'plan-financier-logo'
const LOGO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAYKADAAQAAAABAAAAYAAAAACpM19OAAAH1ElEQVR4Ae1cW2wUVRj+5rLbbsv2QktpEJCCIQQUuQS8JXh7QF4gURMT5dUYifHJNx58MDEmhjdfTUz0wcQQlUC8AQWCF7BAlELEtpS2sLT0Sne7273N+P9TtlnS2e5St/NPyznJdKZz+//zfee/nDPnrPbpe6/aUEUMAV1MshLsIKAIEG4IigBFgDACwuKVBSgChBEQFq8sQBEgjICweGUBigBhBITFKwtQBAgjICxeWYAiQBgBYfHKAhQBwggIi1cWoAgQRkBYvLIARYAwAsLilQUoAoQREBavLECYAFNSfjaThmVZ0DQNeMDZSXbeA7quQ9MN8H6hFRECbNsm4LNYvf5xrN24FVVLapDJpB6IBCYumYhjIjqG4ds3MTrUj+josPNewwxMkboA2BAhAETAC/v2Y8fLe6GbQYLJoo2sYI7FzqaRiEUR6enAtYu/o/NyG+KxcZiBoO+J8JyATDqFzc+8hKd2vwabWr2Vnpwj7Pc/FqoO47HNO51tONKLttZjaD93Cpl0GobpeTXvV26W/zx3muwennj6RXI35MVpK1exbYvIZEJTaGheid1vvYvXDxzEshWriQRybz4tnhLAgAcrQwjXN5DXyc4bJFY24xDx6IbNeOP9D7Fu0zZkUv4kwVMCGHEnAGcJ/Lm7/JKJY2uoDtdg39sfYMP2Z5FOJUt+1qsbPSeg3K6nGFAWkR0MVmDP/gNo2fCk79yR9wQUQ4yu64YJnTKY2beAc5+mFa8Ck1ARqsIrFBdq6hudVLUENTy5xXfpgUadqf7eTowNDVDHyigIghkIIET9h7qG5QjV1FFMoSBMvr9QsTIZ1DWtwK69b+LYl58Vus3z8/4jwAjg0pmf0XbqGALByoKAaLoGkzKq6nAd1m7agm3P70HjI2so+KbpGffsyqK0d+POXbhy/gy6//nLeb6gAI8uFLdfjxTJF6MbhtOJ4lZeaDPITdnU6sfHhnHh9I/46tBB/PnLd+SWyGp4aMOtUBbG7m3rrt2+6aD5kgA37FzPEdA8/hOgIJtOJnHi8Bc4e/TrWV2XTeNPLZSeNjavIpc1f6mwq74uJxc2AXkV4tjBnbyzP3yD9j9anQA+dZlIMiigmxXOptFxIBSmMagtyM4SM/JePa+Hi4YARolHVXXafvvpMBLjY9DYTVEP+XbnSbS3foLLJz5Gb/u3sDIJtGzcBnZj0kVegzIjwD5+uP8WOtsvYNOO5/D38Y9wu+sUSZkKzH1Xj2CgqxWPbnkHoeoaTCZiovFg0RHAfLIl9Fy7giqzG5GO4zCD1Xx6ugz2nSd3FEYV9ZIT8agiYBqZMh2wFQz0XcMSYwhGYGYqa5iVGIlcQDa9nCQWyJjKpEux1yyqGJCrLPeOE9EhJCdGqHW7deY06reliAB2P7IQyErPITYv+zQF4MJppm3ZlAXxhyD3Ttu8qOTy0kVJgG1rqAhmqT9QGFy+x8rKV19eA5dWUY5T4XCK3Iv7m/h8JqMjk9UK3uP+ZPnPLjoC+CNbKJRBLRFgWe4MaJqNZMogFyRffXkNyt+o0Nw0AdNg/164xGIB/jQhXhYNAQymRX69uSmO2pqkc1wIXXY/4zGeMSHPwILviDHwHFADpoXm5hga6hPO/4XA58B8924FkklTEVAIJD7vtGjy4dxKCwdTm7IdCzXk75fWT6Kykj7GF/D7OVl8fWhkZucsd93rvS8tgFt0FQXSpuXRe+mkGyw2DabRLIuARXvLafXFwOfWPzQcwkTcH+6Ha+VDAnTKYOJY13IXlaFigVKbthQ3ivLPsSVNTprov0PjQj7w/TndfEUAT7CNj/UiNfYrzWQwirqTXCWK7dmFccrZczPs5P9+CL45nX2VBWl6AEO95zExHqFW6jaGk1O79P0U+Bp6Cfx4nCftymc++dr7ygJYsdTkKP1170DlK17KMfv8ZNIg8GsQm6BpLLMMTZTyvvm4x2cE2KiqXUX1/H8E5Fr5GKWbkf4lTq/Xj+Azob4igKeZN67aidpl6xEb6SIeSlePXQ0DzxnUBLkaznaYAC66z9yOo9S9P6XXMP+peTrm77fBqqXIBrcjGruO2toS/DXdwj3gVEp3gB8br0A0GnQCuF9bfT58viJgSjGLgqWJru5aNDRMDSvnXEq+4s5wMnWq0mndcTEpGlxL3xtc4xa/EMDn+viQgClXwp2qkdHSeqxMELsgP7ua/MaTf+xLAnIKLpRWnNN3Lntf9QPmUoGF/owAARxYSwiuCx3ZEvUXIKBEzR6S2xQBwkQrAhQBwggIi1cWoAgQRkBYvOcWwFMCeWnRbMUPK1dm06+c1zwlgKeNp5IJDEb6aNxgZiecr2dTk7gT6Zla61XOmvr0XZ4S4GBAILe1HkUyHiMOAtOw8CxljaaNt587jYHe675YvTKt3DweeE4ALwuK3OjAkc8PYfDmDfqhJd1ZuZiiln+x9XucpIV2vAT1YSkz/YAHNefFdNevXsKt7n/RtHINghWVGB3sx8hAxHE90nP2PYBgWoQIASydSeAfz+jruEpfsXj9Lq9yFFNnGhCvD0RrzEH3YQQ9n2TPY0C+cHVMyaACQRYBRYAs/soChPFXBCgCpBEQlq9igCJAGAFh8coCFAHCCAiLVxagCBBGQFi8sgBFgDACwuKVBSgChBEQFq8sQBEgjICweGUBwgT8B4VmWXiTF8+rAAAAAElFTkSuQmCC'
const LOGO_ATTACHMENT = { filename: 'logo.png', content: LOGO_BASE64, content_id: LOGO_CID }

// ── Gabarit ───────────────────────────────────────────────────────────────

const layout = (title: string, inner: string) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#FDFAF6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2A1810;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDFAF6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E6DCCB;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(130deg,#8B6C52,#B8963E);padding:16px 24px;color:#FFF8F0;font-weight:800;font-size:18px;"><img src="cid:${LOGO_CID}" width="36" height="36" alt="" style="vertical-align:middle;border-radius:10px;margin-right:10px;">Plan Financier</td></tr>
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
     <p style="margin:0 0 10px;color:#6B5644;">Chaque semaine, vous recevrez un court bilan de vos 7 derniers jours — désactivable en un clic dans Paramètres → Rapport par email.</p>
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
    body: JSON.stringify({ from: FROM, to: [to], subject, html, attachments: [LOGO_ATTACHMENT] }),
  })
  return response.ok ? null : await response.text()
}

const firstNameOf = (displayName: string | null | undefined, email: string) => {
  const raw = (displayName ?? '').trim() || email.split('@')[0]
  const first = raw.split(/[\s._-]+/)[0] ?? raw
  return first.charAt(0).toUpperCase() + first.slice(1)
}

type Kind = 'welcome' | 'followup_d3' | 'trial_ending' | 'trial_ended'

// Miroir du gating doux de l'app (src/lib/premiumAccess.ts).
const EARLY_ADOPTER_UNTIL = Date.UTC(2026, 9, 1) // 1er octobre 2026
const TRIAL_DAYS = 30

const trialEndingEmail = (firstName: string) => ({
  subject: 'Votre essai Plan Financier se termine dans 3 jours',
  html: layout(
    'Fin d’essai dans 3 jours',
    `<p style="margin:0 0 12px;font-size:20px;font-weight:800;">${firstName}, plus que 3 jours d'essai complet</p>
     <p style="margin:0 0 14px;">Dans trois jours, votre compte passe sur le plan <strong>Découverte</strong> (gratuit, sans limite de durée) : 1 profil, 3 poches, 15 messages Cash par mois, et plus de rapport par email. Vos opérations, votre calendrier, vos statistiques et votre prévision de fin de mois restent là, rien n'est perdu.</p>
     <p style="margin:0 0 14px;">Pour garder profils et poches illimités, Cash sans compter et les rapports automatiques : <strong>Premium, 3,99 € par mois</strong> (ou 29,99 € par an), résiliable en un clic.</p>
     <p style="margin:0 0 18px;">${button(`${APP_URL}/app?plan=1`, 'Voir les formules')}</p>
     <p style="margin:0;color:#6B5644;">Une question, un doute sur ce qui change ? Répondez à cet email.</p>`,
  ),
})

const trialEndedEmail = (firstName: string) => ({
  subject: 'Votre compte Plan Financier est passé en plan Découverte',
  html: layout(
    'Plan Découverte',
    `<p style="margin:0 0 12px;font-size:20px;font-weight:800;">${firstName}, votre essai est terminé</p>
     <p style="margin:0 0 14px;">Votre compte est maintenant sur le plan <strong>Découverte</strong>, gratuit et sans limite de durée. Vous gardez toutes vos données, le calendrier, les statistiques et la prévision de fin de mois.</p>
     <p style="margin:0 0 14px;">Ce qui est limité : 1 profil, 3 poches, 15 messages Cash par mois, pas de rapport par email. Si vous aviez plus de profils ou de poches, ils sont conservés mais vous ne pouvez plus en créer.</p>
     <p style="margin:0 0 18px;">${button(`${APP_URL}/app?plan=1`, 'Passer Premium — 3,99 €/mois')}</p>
     <p style="margin:0;color:#6B5644;">Merci d'avoir essayé Plan Financier. Si quelque chose vous a manqué pendant l'essai, dites-le nous en répondant à cet email : on lit tout.</p>`,
  ),
})

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

  const message =
    kind === 'welcome'
      ? welcomeEmail(firstName)
      : kind === 'followup_d3'
        ? followupEmail(firstName)
        : kind === 'trial_ending'
          ? trialEndingEmail(firstName)
          : trialEndedEmail(firstName)
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

    // ── Fin d'essai : J-3 et jour J ────────────────────────────────────
    // Comptes en essai = créés depuis EARLY_ADOPTER_UNTIL, sans plan payant.
    const trial = { sent: 0, skipped: 0, failed: 0 }
    const dayMs = 86_400_000
    const windows: Array<{ kind: Kind; fromDays: number; toDays: number }> = [
      { kind: 'trial_ending', fromDays: TRIAL_DAYS - 3, toDays: TRIAL_DAYS - 2 },
      { kind: 'trial_ended', fromDays: TRIAL_DAYS, toDays: TRIAL_DAYS + 1 },
    ]
    const { data: paid } = await admin
      .from('subscriptions')
      .select('user_id, plan, status')
      .neq('plan', 'free')
    const paidIds = new Set(
      ((paid ?? []) as Array<{ user_id: string; plan: string; status: string }>)
        .filter((sub) => ['active', 'trialing', 'past_due'].includes(sub.status))
        .map((sub) => sub.user_id),
    )
    let page = 1
    const perPage = 200
    for (;;) {
      const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page, perPage })
      if (usersError || !users?.users?.length) break
      for (const user of users.users) {
        const created = Date.parse(user.created_at ?? '')
        if (!Number.isFinite(created) || created < EARLY_ADOPTER_UNTIL || paidIds.has(user.id)) continue
        const ageDays = (now - created) / dayMs
        for (const window of windows) {
          if (ageDays < window.fromDays || ageDays >= window.toDays) continue
          const result = await sendOnce(admin, user.id, window.kind)
          if (result === 'sent') trial.sent++
          else if (result === 'skipped') trial.skipped++
          else trial.failed++
        }
      }
      if (users.users.length < perPage) break
      page++
    }
    return json(200, { sent, skipped, failures: failures.length, trial })
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
