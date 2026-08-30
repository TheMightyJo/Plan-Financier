// Préférences de rapport par email (table report_preferences, migration 0005)
// + envoi d'un rapport test via l'Edge Function send-report.
import { isSupabaseConfigured, supabase } from '../supabase'

export type ReportFrequency = 'none' | 'weekly' | 'monthly'
export type ReportFormat = 'summary' | 'detailed'

export type ReportPrefs = {
  frequency: ReportFrequency
  format: ReportFormat
  lastSentAt: string | null
}

export const defaultReportPrefs: ReportPrefs = {
  frequency: 'none',
  format: 'summary',
  lastSentAt: null,
}

export const getReportPrefs = async (): Promise<ReportPrefs> => {
  if (!isSupabaseConfigured()) return defaultReportPrefs
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) return defaultReportPrefs
  const { data, error } = await supabase
    .from('report_preferences')
    .select('frequency, format, last_sent_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return defaultReportPrefs
  return {
    frequency: (data.frequency as ReportFrequency) ?? 'none',
    format: (data.format as ReportFormat) ?? 'summary',
    lastSentAt: (data.last_sent_at as string | null) ?? null,
  }
}

export const saveReportPrefs = async (prefs: Pick<ReportPrefs, 'frequency' | 'format'>): Promise<boolean> => {
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) return false
  const { error } = await supabase
    .from('report_preferences')
    .upsert(
      { user_id: userId, frequency: prefs.frequency, format: prefs.format },
      { onConflict: 'user_id' },
    )
  return !error
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
