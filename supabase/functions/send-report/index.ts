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
// Contenu : synthèse (dépensé / reçu / solde), comparaison avec la période
// précédente, répartition par catégorie, plus grosses dépenses, et en format
// « détaillé » la liste des opérations. Logo embarqué en pièce jointe inline
// (CID) : il s'affiche même quand le client mail bloque le contenu distant.
//
// Pièce jointe optionnelle (colonne attachment, migration 0006) : csv, excel
// (table HTML ouverte par Excel) ou pdf (mis en page ici, sans dépendance).
//
// Envoi : API Resend (secret RESEND_API_KEY). Expéditeur : REPORT_FROM
// (défaut : contact@protojo.fr — domaine à vérifier dans Resend). Le logo est
// embarqué en base64 dans ce fichier (pièce jointe inline CID).
//
// Déploiement :
//   supabase functions deploy send-report --no-verify-jwt
// Secrets (Edge Functions → Secrets) :
//   RESEND_API_KEY, CRON_SECRET, REPORT_FROM (optionnel), APP_URL (optionnel)
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const REPORT_FROM = Deno.env.get('REPORT_FROM') ?? 'Plan Financier <contact@protojo.fr>'
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

type TxRow = {
  amount: number
  kind: 'debit' | 'credit' | 'transfer'
  occurred_at: string
  label: string
  notes: string | null
}

type ReportFormat = 'summary' | 'detailed'
type ReportAttachment = 'none' | 'csv' | 'excel' | 'pdf'
type Attachment = { filename: string; content: string; content_id?: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_CC = 5

const sanitizeCc = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [])
    .filter((e): e is string => typeof e === 'string' && EMAIL_PATTERN.test(e))
    .slice(0, MAX_CC)

const euro = (value: number) =>
  value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const frDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })

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

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ── Synthèse d'une période ────────────────────────────────────────────────

type Summary = {
  spent: number
  income: number
  net: number
  count: number
  categories: Array<{ name: string; total: number; share: number }>
  topExpenses: TxRow[]
}

const summarize = (rows: TxRow[]): Summary => {
  const debits = rows.filter((r) => r.kind === 'debit')
  const spent = debits.reduce((s, r) => s + Number(r.amount), 0)
  const income = rows.filter((r) => r.kind === 'credit').reduce((s, r) => s + Number(r.amount), 0)
  const byCategory = new Map<string, number>()
  debits.forEach((r) => byCategory.set(categoryOf(r.notes), (byCategory.get(categoryOf(r.notes)) ?? 0) + Number(r.amount)))
  const categories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => ({ name, total, share: spent > 0 ? total / spent : 0 }))
  const topExpenses = [...debits].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5)
  return { spent, income, net: income - spent, count: rows.length, categories, topExpenses }
}

/** Phrase de comparaison avec la période précédente. */
const comparisonSentence = (current: Summary, previous: Summary): string => {
  if (previous.spent <= 0) return 'Pas de dépense enregistrée sur la période précédente : pas de comparaison possible.'
  const delta = ((current.spent - previous.spent) / previous.spent) * 100
  const rounded = Math.round(Math.abs(delta))
  if (rounded === 0) return 'Vos dépenses sont stables par rapport à la période précédente.'
  return delta < 0
    ? `Vous avez dépensé ${rounded} % de moins que la période précédente (${euro(previous.spent)}). Bravo !`
    : `Vous avez dépensé ${rounded} % de plus que la période précédente (${euro(previous.spent)}).`
}

// ── Logo embarqué (inline, CID) ──────────────────────────────────────────

const LOGO_CID = 'plan-financier-logo'
/** Logo 96×96 (PNG, ~2 Ko) embarqué : aucun chargement distant, aucun déploiement requis. */
const LOGO_BASE64 =
  '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'

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

const logoAttachment = (): Attachment => ({ filename: 'logo.png', content: LOGO_BASE64, content_id: LOGO_CID })

// ── Pièces jointes de données ─────────────────────────────────────────────

/** Encode une chaîne UTF-8 en base64 (format attendu par Resend). */
const utf8ToBase64 = (text: string): string => bytesToBase64(new TextEncoder().encode(text))

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

// ── Mini moteur PDF (Helvetica + WinAnsi, rectangles, couleurs — zéro dépendance) ──

type Rgb = [number, number, number]
const rgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
]
const C = {
  brand: rgb('#8B6C52'),
  gold: rgb('#B8963E'),
  ink: rgb('#2A1810'),
  muted: rgb('#6B5644'),
  sand: rgb('#F5EFE6'),
  line: rgb('#E6DCCB'),
  white: rgb('#FFFFFF'),
  negative: rgb('#C05C2A'),
  positive: rgb('#3A7D44'),
}
const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 44
const CONTENT_W = PAGE_W - 2 * MARGIN

const toWinAnsi = (text: string): string =>
  [...text]
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 63
      if (ch === '€') return String.fromCharCode(0x80)
      if (ch === '’') return "'"
      if (ch === '—' || ch === '–' || ch === '−') return '-'
      if (ch === '\u00A0' || ch === '\u202F' || ch === '\u2009') return ' '
      if (ch === '…') return '...'
      if (ch === 'œ') return 'oe'
      if (ch === 'Œ') return 'OE'
      return code <= 0xff ? ch : '?'
    })
    .join('')

const pdfEscape = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

const color = (c: Rgb) => c.map((v) => v.toFixed(3)).join(' ')
const num = (v: number) => v.toFixed(2)

/** Largeur approximative d'un texte Helvetica (pour aligner à droite). */
const textWidth = (text: string, size: number, bold: boolean) =>
  toWinAnsi(text).length * size * (bold ? 0.56 : 0.52)

type TextOptions = { size?: number; bold?: boolean; color?: Rgb; align?: 'left' | 'right' | 'center' }

class PdfDoc {
  private pages: string[][] = []
  private ops: string[] = []
  y = PAGE_H - MARGIN

  newPage() {
    if (this.ops.length > 0) this.pages.push(this.ops)
    this.ops = []
    this.y = PAGE_H - MARGIN
  }

  rect(x: number, y: number, w: number, h: number, fill: Rgb) {
    this.ops.push(`${color(fill)} rg ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`)
  }

  hline(x1: number, x2: number, y: number, stroke: Rgb, width = 0.6) {
    this.ops.push(`${color(stroke)} RG ${num(width)} w ${num(x1)} ${num(y)} m ${num(x2)} ${num(y)} l S`)
  }

  text(x: number, y: number, value: string, options: TextOptions = {}) {
    const size = options.size ?? 10
    const bold = options.bold ?? false
    let left = x
    if (options.align === 'right') left = x - textWidth(value, size, bold)
    if (options.align === 'center') left = x - textWidth(value, size, bold) / 2
    this.ops.push(
      `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color(options.color ?? C.ink)} rg ${num(left)} ${num(y)} Td (${pdfEscape(toWinAnsi(value))}) Tj ET`,
    )
  }

  /** Coupe un libellé pour tenir dans `maxWidth`. */
  fit(value: string, maxWidth: number, size: number, bold = false): string {
    if (textWidth(value, size, bold) <= maxWidth) return value
    let out = value
    while (out.length > 1 && textWidth(`${out}…`, size, bold) > maxWidth) out = out.slice(0, -1)
    return `${out}…`
  }

  /** Saute de page si `height` points ne tiennent plus. Renvoie true si saut. */
  ensure(height: number): boolean {
    if (this.y - height < MARGIN + 24) {
      this.newPage()
      return true
    }
    return false
  }

  finish(footer: (page: number, total: number) => string): string {
    if (this.ops.length > 0 || this.pages.length === 0) this.pages.push(this.ops)
    const total = this.pages.length
    const contents = this.pages.map((ops, index) => {
      const label = footer(index + 1, total)
      const footerOps = [
        `${color(C.line)} RG 0.6 w ${num(MARGIN)} ${num(MARGIN - 6)} m ${num(PAGE_W - MARGIN)} ${num(MARGIN - 6)} l S`,
        `BT /F1 8 Tf ${color(C.muted)} rg ${num(MARGIN)} ${num(MARGIN - 18)} Td (${pdfEscape(toWinAnsi(label))}) Tj ET`,
      ]
      return [...ops, ...footerOps].join('\n')
    })

    // Objets : 1 catalog, 2 pages, 3-4 polices, puis (contenu, page) par page.
    const objects: string[] = []
    const pageObjNums = contents.map((_, i) => 6 + 2 * i)
    objects[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'
    objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${contents.length} >>\nendobj\n`
    objects[3] = '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n'
    objects[4] = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n'
    contents.forEach((content, i) => {
      const contentNum = 5 + 2 * i
      const pageNum = 6 + 2 * i
      objects[contentNum] = `${contentNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`
      objects[pageNum] = `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`
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
}

/** base64 d'une chaîne d'octets (chaque caractère ≤ 0xFF). */
const byteStringToBase64 = (byteString: string): string => btoa(byteString)

const buildPdfReport = (
  periodLabel: string,
  rows: TxRow[],
  previousRows: TxRow[],
  format: ReportFormat,
  firstName: string,
): string => {
  const doc = new PdfDoc()
  const current = summarize(rows)
  const previous = summarize(previousRows)

  // Bandeau de marque.
  doc.rect(0, PAGE_H - 72, PAGE_W, 72, C.brand)
  doc.rect(0, PAGE_H - 76, PAGE_W, 4, C.gold)
  doc.text(MARGIN, PAGE_H - 40, 'Plan Financier', { size: 20, bold: true, color: C.white })
  doc.text(MARGIN, PAGE_H - 58, `Rapport — ${periodLabel}`, { size: 11, color: C.white })
  doc.text(PAGE_W - MARGIN, PAGE_H - 58, `Généré le ${new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`, {
    size: 9,
    color: C.white,
    align: 'right',
  })
  doc.y = PAGE_H - 76 - 30

  doc.text(MARGIN, doc.y, `Bonjour ${firstName}, voici votre bilan.`, { size: 12, bold: true })
  doc.y -= 16
  doc.text(MARGIN, doc.y, doc.fit(comparisonSentence(current, previous), CONTENT_W, 10), { size: 10, color: C.muted })
  doc.y -= 24

  // Trois indicateurs.
  const gap = 10
  const boxW = (CONTENT_W - 2 * gap) / 3
  const boxH = 58
  const kpis: Array<{ label: string; value: string; tone: Rgb }> = [
    { label: 'DÉPENSÉ', value: `−${euro(current.spent)}`, tone: C.negative },
    { label: 'REÇU', value: `+${euro(current.income)}`, tone: C.positive },
    { label: 'SOLDE DE LA PÉRIODE', value: `${current.net >= 0 ? '+' : ''}${euro(current.net)}`, tone: current.net >= 0 ? C.positive : C.negative },
  ]
  kpis.forEach((kpi, index) => {
    const x = MARGIN + index * (boxW + gap)
    doc.rect(x, doc.y - boxH, boxW, boxH, C.sand)
    doc.text(x + 12, doc.y - 18, kpi.label, { size: 7.5, bold: true, color: C.muted })
    doc.text(x + 12, doc.y - 42, kpi.value, { size: 16, bold: true, color: kpi.tone })
  })
  doc.y -= boxH + 10
  doc.text(MARGIN, doc.y, `${current.count} opération${current.count > 1 ? 's' : ''} sur la période`, { size: 9, color: C.muted })
  doc.y -= 26

  const section = (title: string) => {
    doc.ensure(40)
    doc.text(MARGIN, doc.y, title, { size: 13, bold: true })
    doc.y -= 8
    doc.hline(MARGIN, PAGE_W - MARGIN, doc.y, C.line)
    doc.y -= 18
  }

  // Répartition par catégorie.
  if (current.categories.length > 0) {
    section('Où est parti votre argent')
    const barX = MARGIN + 130
    const barMax = CONTENT_W - 130 - 110
    current.categories.slice(0, 8).forEach((cat) => {
      doc.ensure(20)
      doc.text(MARGIN, doc.y - 3, doc.fit(cat.name, 120, 10), { size: 10 })
      doc.rect(barX, doc.y - 7, barMax, 9, C.sand)
      doc.rect(barX, doc.y - 7, Math.max(2, barMax * cat.share), 9, C.gold)
      doc.text(PAGE_W - MARGIN - 44, doc.y - 3, euro(cat.total), { size: 10, bold: true, align: 'right' })
      doc.text(PAGE_W - MARGIN, doc.y - 3, `${Math.round(cat.share * 100)} %`, { size: 9, color: C.muted, align: 'right' })
      doc.y -= 20
    })
    doc.y -= 12
  }

  // Plus grosses dépenses.
  if (current.topExpenses.length > 0) {
    section('Vos plus grosses dépenses')
    current.topExpenses.forEach((tx) => {
      doc.ensure(18)
      doc.text(MARGIN, doc.y, frDate(tx.occurred_at), { size: 9, color: C.muted })
      doc.text(MARGIN + 60, doc.y, doc.fit(tx.label, CONTENT_W - 60 - 90, 10), { size: 10 })
      doc.text(PAGE_W - MARGIN, doc.y, `−${euro(Number(tx.amount))}`, { size: 10, bold: true, color: C.negative, align: 'right' })
      doc.y -= 18
    })
    doc.y -= 12
  }

  // Détail des opérations (format détaillé).
  if (format === 'detailed' && rows.length > 0) {
    section('Détail des opérations')
    const cols = { date: MARGIN, label: MARGIN + 62, category: MARGIN + 300, amount: PAGE_W - MARGIN }
    const tableHeader = () => {
      doc.rect(MARGIN, doc.y - 5, CONTENT_W, 16, C.sand)
      doc.text(cols.date, doc.y, 'Date', { size: 8, bold: true, color: C.muted })
      doc.text(cols.label, doc.y, 'Libellé', { size: 8, bold: true, color: C.muted })
      doc.text(cols.category, doc.y, 'Catégorie', { size: 8, bold: true, color: C.muted })
      doc.text(cols.amount, doc.y, 'Montant', { size: 8, bold: true, color: C.muted, align: 'right' })
      doc.y -= 20
    }
    tableHeader()
    sortedByDateDesc(rows)
      .slice(0, 400)
      .forEach((tx, index) => {
        if (doc.ensure(16)) tableHeader()
        if (index % 2 === 1) doc.rect(MARGIN, doc.y - 5, CONTENT_W, 15, rgb('#FBF8F3'))
        doc.text(cols.date, doc.y, frDate(tx.occurred_at), { size: 9, color: C.muted })
        doc.text(cols.label, doc.y, doc.fit(tx.label, 228, 9), { size: 9 })
        doc.text(cols.category, doc.y, doc.fit(categoryOf(tx.notes), 110, 9), { size: 9, color: C.muted })
        const credit = tx.kind === 'credit'
        doc.text(cols.amount, doc.y, `${credit ? '+' : '−'}${euro(Number(tx.amount))}`, {
          size: 9,
          bold: true,
          color: credit ? C.positive : C.negative,
          align: 'right',
        })
        doc.y -= 15
      })
  }

  return doc.finish((page, total) => `Plan Financier · ${periodLabel} · page ${page}/${total} · planfinancier.app`)
}

const buildAttachment = (
  attachment: ReportAttachment,
  periodLabel: string,
  rows: TxRow[],
  previousRows: TxRow[],
  format: ReportFormat,
  firstName: string,
): Attachment | null => {
  const stamp = new Date().toISOString().slice(0, 10)
  if (attachment === 'csv') {
    return { filename: `rapport-plan-financier-${stamp}.csv`, content: utf8ToBase64(buildCsv(rows)) }
  }
  if (attachment === 'excel') {
    return { filename: `rapport-plan-financier-${stamp}.xls`, content: utf8ToBase64(buildXls(periodLabel, rows)) }
  }
  if (attachment === 'pdf') {
    return {
      filename: `rapport-plan-financier-${stamp}.pdf`,
      content: byteStringToBase64(buildPdfReport(periodLabel, rows, previousRows, format, firstName)),
    }
  }
  return null
}

// ── Email HTML ─────────────────────────────────────────────────────────────

const buildReportHtml = (
  periodLabel: string,
  rows: TxRow[],
  previousRows: TxRow[],
  format: ReportFormat,
  firstName: string,
  attachment: ReportAttachment,
): { subject: string; html: string } => {
  const current = summarize(rows)
  const previous = summarize(previousRows)
  const netTone = current.net >= 0 ? '#3A7D44' : '#C05C2A'

  const kpiCell = (label: string, value: string, tone: string) =>
    `<td width="33%" style="padding:0 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5EFE6;border-radius:12px;">
        <tr><td style="padding:14px 12px 4px;font-size:11px;font-weight:700;letter-spacing:0.04em;color:#6B5644;">${label}</td></tr>
        <tr><td style="padding:0 12px 14px;font-size:20px;font-weight:800;color:${tone};">${value}</td></tr>
      </table>
    </td>`

  const categoryRows = current.categories
    .slice(0, 6)
    .map(
      (cat) => `<tr>
        <td style="padding:7px 0;font-size:14px;width:30%;">${escapeHtml(cat.name)}</td>
        <td style="padding:7px 8px;width:40%;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F5EFE6;border-radius:6px;"><tr>
            <td style="width:${Math.max(2, Math.round(cat.share * 100))}%;height:9px;background:#B8963E;border-radius:6px;font-size:0;line-height:0;">&nbsp;</td>
            <td style="font-size:0;line-height:0;">&nbsp;</td>
          </tr></table>
        </td>
        <td style="padding:7px 0 7px 8px;text-align:right;font-size:14px;font-weight:700;white-space:nowrap;">${euro(cat.total)}</td>
        <td style="padding:7px 0 7px 8px;text-align:right;font-size:12px;color:#6B5644;white-space:nowrap;width:42px;">${Math.round(cat.share * 100)} %</td>
      </tr>`,
    )
    .join('')

  const topRows = current.topExpenses
    .map(
      (tx) => `<tr>
        <td style="padding:6px 0;font-size:12px;color:#6B5644;white-space:nowrap;width:64px;">${frDate(tx.occurred_at)}</td>
        <td style="padding:6px 8px;font-size:14px;">${escapeHtml(tx.label)}</td>
        <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:700;color:#C05C2A;white-space:nowrap;">−${euro(Number(tx.amount))}</td>
      </tr>`,
    )
    .join('')

  const detailRows =
    format === 'detailed'
      ? sortedByDateDesc(rows)
          .slice(0, 60)
          .map(
            (tx) => `<tr>
              <td style="padding:5px 0;font-size:12px;color:#6B5644;white-space:nowrap;width:64px;border-bottom:1px solid #F0E8DC;">${frDate(tx.occurred_at)}</td>
              <td style="padding:5px 8px;font-size:13px;border-bottom:1px solid #F0E8DC;">${escapeHtml(tx.label)}<span style="color:#A08060;font-size:11px;"> · ${escapeHtml(categoryOf(tx.notes))}</span></td>
              <td style="padding:5px 0;text-align:right;font-size:13px;font-weight:700;color:${tx.kind === 'credit' ? '#3A7D44' : '#C05C2A'};white-space:nowrap;border-bottom:1px solid #F0E8DC;">${tx.kind === 'credit' ? '+' : '−'}${euro(Number(tx.amount))}</td>
            </tr>`,
          )
          .join('')
      : ''

  const card = (title: string, inner: string) =>
    `<tr><td style="padding:0 24px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E6DCCB;border-radius:14px;">
        <tr><td style="padding:16px 18px 4px;font-size:15px;font-weight:800;">${title}</td></tr>
        <tr><td style="padding:4px 18px 14px;">${inner}</td></tr>
      </table>
    </td></tr>`

  const attachmentNote =
    attachment === 'none'
      ? ''
      : `<p style="margin:0 0 12px;font-size:13px;color:#6B5644;">📎 Le ${attachment === 'pdf' ? 'rapport PDF' : attachment === 'csv' ? 'fichier CSV' : 'fichier Excel'} est en pièce jointe.</p>`

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Votre rapport Plan Financier</title></head>
<body style="margin:0;background:#FDFAF6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2A1810;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDFAF6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FDFAF6;">

        <tr><td style="background:#8B6C52;background-image:linear-gradient(130deg,#8B6C52,#B8963E);border-radius:16px 16px 0 0;padding:20px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;"><img src="cid:${LOGO_CID}" width="40" height="40" alt="Plan Financier" style="display:block;border-radius:11px;"></td>
            <td style="vertical-align:middle;padding-left:12px;">
              <div style="font-size:18px;font-weight:800;color:#FFF8F0;">Plan Financier</div>
              <div style="font-size:12px;color:#FFF8F0;opacity:0.9;">Votre rapport — ${escapeHtml(periodLabel)}</div>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="background:#FFFFFF;border:1px solid #E6DCCB;border-top:0;border-radius:0 0 16px 16px;padding:22px 24px 8px;">
          <p style="margin:0 0 6px;font-size:20px;font-weight:800;">Bonjour ${escapeHtml(firstName)} 👋</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#4A3628;">${comparisonSentence(current, previous)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -4px;"><tr>
            ${kpiCell('DÉPENSÉ', `−${euro(current.spent)}`, '#C05C2A')}
            ${kpiCell('REÇU', `+${euro(current.income)}`, '#3A7D44')}
            ${kpiCell('SOLDE', `${current.net >= 0 ? '+' : ''}${euro(current.net)}`, netTone)}
          </tr></table>
          <p style="margin:12px 0 14px;font-size:12px;color:#6B5644;">${current.count} opération${current.count > 1 ? 's' : ''} sur la période</p>
        </td></tr>

        <tr><td style="height:18px;font-size:0;line-height:0;">&nbsp;</td></tr>

        ${current.categories.length > 0 ? card('Où est parti votre argent', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;width:100%;">${categoryRows}</table>`) : ''}
        ${current.topExpenses.length > 0 ? card('Vos plus grosses dépenses', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${topRows}</table>`) : ''}
        ${detailRows ? card('Détail des opérations', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table>${rows.length > 60 ? `<p style="margin:10px 0 0;font-size:12px;color:#6B5644;">${rows.length - 60} autres opérations dans l'app.</p>` : ''}`) : ''}

        <tr><td align="center" style="padding:6px 24px 22px;">
          ${attachmentNote}
          <a href="${APP_URL}/app" style="display:inline-block;padding:13px 26px;border-radius:999px;background:#8B6C52;background-image:linear-gradient(130deg,#8B6C52,#B8963E);color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;">Ouvrir mon tableau de bord →</a>
        </td></tr>

        <tr><td style="padding:0 24px 8px;border-top:1px solid #E6DCCB;padding-top:16px;color:#6B5644;font-size:12px;line-height:1.5;">
          Rapport automatique Plan Financier — modifiez la fréquence ou arrêtez l'envoi dans <a href="${APP_URL}/app" style="color:#6B5644;">Paramètres → Rapport par email</a>.<br>
          Fait en France 🇫🇷 par ProtoJo Digital · <a href="${APP_URL}/blog/" style="color:#6B5644;">Blog</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return { subject: `📊 Votre rapport Plan Financier — ${periodLabel}`, html }
}

const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  cc: string[],
  attachments: Attachment[],
): Promise<string | null> => {
  const payload: Record<string, unknown> = { from: REPORT_FROM, to: [to], subject, html, attachments }
  if (cc.length > 0) payload.cc = cc
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

// Miroir du gating doux de l'app : comptes créés avant EARLY_ADOPTER_UNTIL
// (offerts), sinon plan payant actif ou essai de TRIAL_DAYS jours.
const EARLY_ADOPTER_UNTIL = Date.UTC(2026, 9, 1) // 1er octobre 2026
const TRIAL_DAYS = 30

const hasPremiumAccess = async (
  admin: ReturnType<typeof createClient>,
  userId: string,
  createdAt: string | undefined,
): Promise<boolean> => {
  const { data: sub } = await admin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (sub && sub.plan !== 'free' && ['active', 'trialing', 'past_due'].includes(String(sub.status ?? ''))) {
    return true
  }
  if (!createdAt) return true
  const created = new Date(createdAt).getTime()
  if (created < EARLY_ADOPTER_UNTIL) return true
  return Date.now() - created < TRIAL_DAYS * 86_400_000
}

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

type Period = { from: string; to: string; label: string; previousFrom: string; previousTo: string }

/** Période courante + période précédente (même durée) pour la comparaison. */
const periodFor = (frequency: 'weekly' | 'monthly'): Period => {
  if (frequency === 'weekly') {
    return {
      from: isoDaysAgo(7),
      to: isoDaysAgo(0),
      label: 'les 7 derniers jours',
      previousFrom: isoDaysAgo(14),
      previousTo: isoDaysAgo(8),
    }
  }
  // Mensuel : le mois calendaire précédent complet, comparé au mois d'avant.
  const now = new Date()
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  const previousFirst = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1))
  const previousLast = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 0))
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
    label: first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    previousFrom: previousFirst.toISOString().slice(0, 10),
    previousTo: previousLast.toISOString().slice(0, 10),
  }
}

const firstNameOf = (displayName: string | null | undefined, email: string) => {
  const raw = (displayName ?? '').trim() || email.split('@')[0]
  const first = raw.split(/[\s._-]+/)[0] ?? raw
  return first.charAt(0).toUpperCase() + first.slice(1)
}

const fetchRows = async (
  admin: ReturnType<typeof createClient>,
  userId: string,
  from: string,
  to: string,
): Promise<{ rows: TxRow[]; error: string | null }> => {
  const { data, error } = await admin
    .from('transactions')
    .select('amount, kind, occurred_at, label, notes')
    .eq('created_by_user_id', userId)
    .is('deleted_at', null)
    .gte('occurred_at', from)
    .lte('occurred_at', to)
  return { rows: (data ?? []) as TxRow[], error: error?.message ?? null }
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
  const [current, previous, { data: profile }] = await Promise.all([
    fetchRows(admin, userId, period.from, period.to),
    fetchRows(admin, userId, period.previousFrom, period.previousTo),
    admin.from('profiles').select('display_name').eq('user_id', userId).maybeSingle(),
  ])
  if (current.error) return current.error
  const firstName = firstNameOf(profile?.display_name as string | undefined, email)

  const { subject, html } = buildReportHtml(period.label, current.rows, previous.rows, format, firstName, attachment)
  const attachments: Attachment[] = [logoAttachment()]
  const file = buildAttachment(attachment, period.label, current.rows, previous.rows, format, firstName)
  if (file) attachments.push(file)
  return await sendEmail(email, subject, html, cc, attachments)
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
      // Plan Découverte après l'essai : pas de rapport automatique.
      if (!(await hasPremiumAccess(admin, row.user_id, userData?.user?.created_at))) continue

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
