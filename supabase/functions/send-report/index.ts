// Edge Function : send-report
// ---------------------------------------------------------------------------
// Génère et envoie par email le rapport budgétaire d'un utilisateur, à partir
// de ses transactions synchronisées (Postgres).
//
// Deux modes :
//   1. Utilisateur authentifié + body {test:true} → rapport envoyé à SA propre
//      adresse immédiatement (bouton « rapport test » dans les Paramètres).
//      Les adresses en copie (cc_emails) ne reçoivent PAS le rapport test.
//   2. Cron (header x-cron-secret = CRON_SECRET) + body {cron:true} → parcourt
//      report_preferences et envoie les rapports « dus » (hebdo : ≥ 6,5 jours
//      depuis le dernier ; mensuel : pas encore envoyé ce mois-ci), avec les
//      adresses cc_emails en copie.
//
// Pièce jointe optionnelle (colonne attachment, migration 0006) : csv, excel
// (table HTML ouverte par Excel) ou pdf (généré ici sans dépendance).
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

type ReportFormat = 'summary' | 'detailed'
type ReportAttachment = 'none' | 'csv' | 'excel' | 'pdf'
type Attachment = { filename: string; content: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_CC = 5

const sanitizeCc = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [])
    .filter((e): e is string => typeof e === 'string' && EMAIL_PATTERN.test(e))
    .slice(0, MAX_CC)

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

const sortedByDateDesc = (rows: TxRow[]) =>
  [...rows].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))

// ── Pièces jointes ──────────────────────────────────────────────────────────

/** Encode une chaîne UTF-8 en base64 (format attendu par Resend). */
const utf8ToBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

const buildCsv = (rows: TxRow[]): string => {
  const header = 'Date;Libellé;Catégorie;Type;Montant (EUR)'
  const lines = sortedByDateDesc(rows).map((r) => {
    const label = `"${r.label.replace(/"/g, '""')}"`
    const amount = `${r.kind === 'credit' ? '' : '-'}${String(Number(r.amount)).replace('.', ',')}`
    return [r.occurred_at, label, categoryOf(r.notes), r.kind === 'credit' ? 'Revenu' : 'Dépense', amount].join(';')
  })
  // BOM UTF-8 pour que les accents s'affichent bien dans Excel.
  return `${'\uFEFF'}${[header, ...lines].join('\r\n')}`
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Table HTML avec extension .xls : Excel/LibreOffice/Numbers l'ouvrent nativement. */
const buildXls = (periodLabel: string, rows: TxRow[]): string => {
  const body = sortedByDateDesc(rows)
    .map(
      (r) =>
        `<tr><td>${r.occurred_at}</td><td>${escapeHtml(r.label)}</td><td>${escapeHtml(categoryOf(r.notes))}</td><td>${r.kind === 'credit' ? 'Revenu' : 'Dépense'}</td><td>${r.kind === 'credit' ? '' : '-'}${Number(r.amount)}</td></tr>`,
    )
    .join('')
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
<table border="1"><caption>Plan Financier — ${escapeHtml(periodLabel)}</caption>
<tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Type</th><th>Montant (EUR)</th></tr>${body}</table>
</body></html>`
}

// ── Génération PDF minimaliste (Helvetica + WinAnsi, zéro dépendance) ──────

type PdfLine = { text: string; size?: number; bold?: boolean; extraGap?: number }

const toWinAnsi = (text: string): string =>
  [...text]
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 63
      if (ch === '€') return String.fromCharCode(0x80)
      if (ch === '’') return "'"
      if (ch === '—' || ch === '–' || ch === '−') return '-'
      if (ch === ' ' || ch === ' ') return ' '
      if (ch === '…') return '...'
      if (ch === 'œ') return 'oe'
      if (ch === 'Œ') return 'OE'
      return code <= 0xff ? ch : '?'
    })
    .join('')

const pdfEscape = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

const buildPdf = (lines: PdfLine[]): string => {
  // Page A4 (595 × 842 pt), marge 48 pt, une ligne = un opérateur texte.
  const pagesContent: string[] = []
  let ops: string[] = []
  let y = 802
  const flushPage = () => {
    pagesContent.push(ops.join('\n'))
    ops = []
    y = 802
  }
  for (const line of lines) {
    const size = line.size ?? 10
    const lineHeight = size * 1.5 + (line.extraGap ?? 0)
    if (y - lineHeight < 42) flushPage()
    y -= lineHeight
    ops.push(
      `BT /${line.bold ? 'F2' : 'F1'} ${size} Tf 48 ${y.toFixed(1)} Td (${pdfEscape(toWinAnsi(line.text))}) Tj ET`,
    )
  }
  if (ops.length > 0 || pagesContent.length === 0) flushPage()

  // Objets : 1 catalog, 2 pages, 3-4 polices, puis (contenu, page) par page.
  const objects: string[] = []
  const pageObjNums = pagesContent.map((_, i) => 6 + 2 * i)
  objects[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pagesContent.length} >>\nendobj\n`
  objects[3] = '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n'
  objects[4] = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n'
  pagesContent.forEach((content, i) => {
    const contentNum = 5 + 2 * i
    const pageNum = 6 + 2 * i
    objects[contentNum] = `${contentNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`
    objects[pageNum] = `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`
  })

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pdf.length
    pdf += objects[i]
  }
  const xrefPos = pdf.length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`
  return pdf
}

/** base64 d'une chaîne d'octets (chaque caractère ≤ 0xFF). */
const byteStringToBase64 = (byteString: string): string => btoa(byteString)

const buildPdfReport = (periodLabel: string, rows: TxRow[], format: ReportFormat): string => {
  const spent = rows.filter((r) => r.kind === 'debit').reduce((s, r) => s + Number(r.amount), 0)
  const income = rows.filter((r) => r.kind === 'credit').reduce((s, r) => s + Number(r.amount), 0)
  const byCategory = new Map<string, number>()
  rows
    .filter((r) => r.kind === 'debit')
    .forEach((r) => byCategory.set(categoryOf(r.notes), (byCategory.get(categoryOf(r.notes)) ?? 0) + Number(r.amount)))

  const lines: PdfLine[] = [
    { text: 'Plan Financier', size: 20, bold: true },
    { text: `Rapport — ${periodLabel}`, size: 12, extraGap: 8 },
    { text: `Dépensé : ${euro(spent)}`, size: 12, bold: true },
    { text: `Reçu : ${euro(income)}`, size: 12, bold: true },
    { text: `Solde de la période : ${income - spent >= 0 ? '+' : ''}${euro(income - spent)}`, size: 12, bold: true, extraGap: 10 },
  ]
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  if (topCategories.length > 0) {
    lines.push({ text: 'Top catégories', size: 13, bold: true, extraGap: 6 })
    topCategories.forEach(([cat, total]) => lines.push({ text: `${cat} : ${euro(total)}` }))
  }
  if (format === 'detailed' && rows.length > 0) {
    lines.push({ text: 'Détail des opérations', size: 13, bold: true, extraGap: 10 })
    sortedByDateDesc(rows)
      .slice(0, 200)
      .forEach((r) => {
        const label = r.label.length > 52 ? `${r.label.slice(0, 51)}…` : r.label
        lines.push({ text: `${r.occurred_at}   ${label}   ${r.kind === 'credit' ? '+' : '−'}${euro(Number(r.amount))}` })
      })
  }
  return buildPdf(lines)
}

const buildAttachment = (
  attachment: ReportAttachment,
  periodLabel: string,
  rows: TxRow[],
  format: ReportFormat,
): Attachment | null => {
  const stamp = new Date().toISOString().slice(0, 10)
  if (attachment === 'csv') {
    return { filename: `rapport-plan-financier-${stamp}.csv`, content: utf8ToBase64(buildCsv(rows)) }
  }
  if (attachment === 'excel') {
    return { filename: `rapport-plan-financier-${stamp}.xls`, content: utf8ToBase64(buildXls(periodLabel, rows)) }
  }
  if (attachment === 'pdf') {
    return { filename: `rapport-plan-financier-${stamp}.pdf`, content: byteStringToBase64(buildPdfReport(periodLabel, rows, format)) }
  }
  return null
}

// ── Email HTML ─────────────────────────────────────────────────────────────

const buildReportHtml = (
  periodLabel: string,
  rows: TxRow[],
  format: ReportFormat,
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
      ? sortedByDateDesc(rows)
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

const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  cc: string[],
  attachment: Attachment | null,
): Promise<string | null> => {
  const payload: Record<string, unknown> = { from: REPORT_FROM, to: [to], subject, html }
  if (cc.length > 0) payload.cc = cc
  if (attachment) payload.attachments = [attachment]
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  format: ReportFormat,
  attachment: ReportAttachment,
  cc: string[],
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
  const rows = (data ?? []) as TxRow[]
  const { subject, html } = buildReportHtml(period.label, rows, format)
  const file = buildAttachment(attachment, period.label, rows, format)
  return await sendEmail(email, subject, html, cc, file)
}

// Lecture défensive d'une ligne report_preferences (les colonnes attachment /
// cc_emails n'existent qu'à partir de la migration 0006).
const prefOf = (row: Record<string, unknown> | null | undefined) => ({
  frequency: row?.frequency === 'weekly' ? 'weekly' as const : row?.frequency === 'monthly' ? 'monthly' as const : 'none' as const,
  format: (row?.format === 'detailed' ? 'detailed' : 'summary') as ReportFormat,
  attachment: (['csv', 'excel', 'pdf'].includes(String(row?.attachment)) ? row?.attachment : 'none') as ReportAttachment,
  cc: sanitizeCc(row?.cc_emails),
})

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
      .select('*')
      .neq('frequency', 'none')
    if (error) return json(500, { error: 'prefs_read_failed', detail: error.message })

    const now = new Date()
    let sent = 0
    const failures: string[] = []
    for (const row of prefs ?? []) {
      const last = row.last_sent_at ? new Date(row.last_sent_at) : null
      const pref = prefOf(row)
      if (pref.frequency === 'none') continue
      const due =
        pref.frequency === 'weekly'
          ? !last || now.getTime() - last.getTime() > 6.5 * 86_400_000
          : !last || last.toISOString().slice(0, 7) !== now.toISOString().slice(0, 7)
      if (!due) continue

      const { data: userData } = await admin.auth.admin.getUserById(row.user_id)
      const email = userData?.user?.email
      if (!email) continue

      const failure = await sendReportTo(admin, row.user_id, email, pref.frequency, pref.format, pref.attachment, pref.cc)
      if (failure) {
        failures.push(`${email}: ${failure}`)
        continue
      }
      await admin
        .from('report_preferences')
        .update({ last_sent_at: now.toISOString() })
        .eq('user_id', row.user_id)
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

  const { data: prefRow } = await admin
    .from('report_preferences')
    .select('*')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  const pref = prefOf(prefRow)
  const frequency = pref.frequency === 'weekly' ? 'weekly' : 'monthly'
  // Rapport test : jamais de cc — uniquement l'utilisateur lui-même.
  const failure = await sendReportTo(admin, userData.user.id, userData.user.email, frequency, pref.format, pref.attachment, [])
  if (failure) return json(502, { error: 'send_failed', detail: failure })
  return json(200, { ok: true, sentTo: userData.user.email })
})
