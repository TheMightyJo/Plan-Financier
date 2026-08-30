// Préférences de rapport par email (table report_preferences, migrations 0005 + 0006)
// + envoi d'un rapport test via l'Edge Function send-report.
import { isSupabaseConfigured, supabase } from '../supabase'

export type ReportFrequency = 'none' | 'weekly' | 'monthly'
export type ReportFormat = 'summary' | 'detailed'
export type ReportAttachment = 'none' | 'csv' | 'excel' | 'pdf'

export type ReportPrefs = {
  frequency: ReportFrequency
  format: ReportFormat
  attachment: ReportAttachment
  ccEmails: string[]
  lastSentAt: string | null
}

export const defaultReportPrefs: ReportPrefs = {
  frequency: 'none',
  format: 'summary',
  attachment: 'none',
  ccEmails: [],
  lastSentAt: null,
}

export const MAX_REPORT_CC = 5

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Découpe une saisie libre (virgules, points-virgules, espaces) en adresses
 * valides normalisées + liste des fragments rejetés. */
export const parseCcEmails = (raw: string): { valid: string[]; invalid: string[] } => {
  const valid: string[] = []
  const invalid: string[] = []
  for (const part of raw.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase()
    if (!email) continue
    if (EMAIL_PATTERN.test(email)) {
      if (!valid.includes(email) && valid.length < MAX_REPORT_CC) valid.push(email)
    } else {
      invalid.push(email)
    }
  }
  return { valid, invalid }
}

export const getReportPrefs = async (): Promise<ReportPrefs> => {
  if (!isSupabaseConfigured()) return defaultReportPrefs
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) return defaultReportPrefs
  const { data, error } = await supabase
    .from('report_preferences')
    .select('frequency, format, attachment, cc_emails, last_sent_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    // Migration 0006 pas encore appliquée : relire les colonnes historiques.
    const legacy = await supabase
      .from('report_preferences')
      .select('frequency, format, last_sent_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (legacy.error || !legacy.data) return defaultReportPrefs
    return {
      ...defaultReportPrefs,
      frequency: (legacy.data.frequency as ReportFrequency) ?? 'none',
      format: (legacy.data.format as ReportFormat) ?? 'summary',
      lastSentAt: (legacy.data.last_sent_at as string | null) ?? null,
    }
  }
  if (!data) return defaultReportPrefs
  return {
    frequency: (data.frequency as ReportFrequency) ?? 'none',
    format: (data.format as ReportFormat) ?? 'summary',
    attachment: (data.attachment as ReportAttachment) ?? 'none',
    ccEmails: Array.isArray(data.cc_emails) ? (data.cc_emails as string[]) : [],
    lastSentAt: (data.last_sent_at as string | null) ?? null,
  }
}

export const saveReportPrefs = async (
  prefs: Pick<ReportPrefs, 'frequency' | 'format' | 'attachment' | 'ccEmails'>,
): Promise<boolean> => {
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) return false
  const { error } = await supabase
    .from('report_preferences')
    .upsert(
      {
        user_id: userId,
        frequency: prefs.frequency,
        format: prefs.format,
        attachment: prefs.attachment,
        cc_emails: prefs.ccEmails.slice(0, MAX_REPORT_CC),
      },
      { onConflict: 'user_id' },
    )
  if (!error) return true
  // Migration 0006 pas encore appliquée : sauver au moins fréquence + contenu.
  const legacy = await supabase
    .from('report_preferences')
    .upsert(
      { user_id: userId, frequency: prefs.frequency, format: prefs.format },
      { onConflict: 'user_id' },
    )
  return !legacy.error
}

export const sendTestReport = async (): Promise<{ ok: boolean; detail?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-report', { body: { test: true } })
    if (error || !data?.ok) {
      let detail = ''
      const context = (error as { context?: Response } | null)?.context
      if (context && typeof context.json === 'function') {
        try {
          const body = (await context.json()) as { error?: string; detail?: string }
          detail = [body.error, body.detail].filter(Boolean).join(' — ')
        } catch {
          /* corps illisible */
        }
      }
      return { ok: false, detail }
    }
    return { ok: true }
  } catch {
    return { ok: false, detail: 'fonction indisponible' }
  }
}
