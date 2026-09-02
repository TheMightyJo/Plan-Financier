import { supabase } from '../supabase'

/**
 * Remontée des erreurs de production vers la fonction Edge `report-error`
 * (table client_errors + digest quotidien par email). Sans tiers, sans
 * dépendance : en dev, rien n'est envoyé.
 *
 * Garde-fous côté client : une seule remontée par empreinte (message +
 * ligne de pile), 8 remontées max par session, aucune donnée personnelle
 * hors identifiant de compte (pour pouvoir aider l'utilisateur concerné).
 */

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/report-error`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const MAX_REPORTS_PER_SESSION = 8

const reported = new Set<string>()
let reportsSent = 0

const buildId = (): string =>
  document.querySelector<HTMLScriptElement>('script[src*="/assets/index-"]')?.getAttribute('src')?.slice(0, 120) ??
  'dev'

const fingerprintOf = (message: string, stack: string): string => {
  const line = stack.split('\n').find((entry) => entry.includes('/assets/')) ?? stack.split('\n')[1] ?? ''
  return `${message.slice(0, 120)}|${line.trim().slice(0, 160)}`
}

export const reportError = (error: unknown, context?: string): void => {
  if (!import.meta.env.PROD || !ENDPOINT.startsWith('https://')) return
  const err =
    error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Erreur inconnue')
  const message = `${context ? `[${context}] ` : ''}${err.message || 'Erreur sans message'}`
  const stack = err.stack ?? ''
  const fingerprint = fingerprintOf(message, stack)
  if (reported.has(fingerprint) || reportsSent >= MAX_REPORTS_PER_SESSION) return
  reported.add(fingerprint)
  reportsSent++

  void (async () => {
    let userId: string | null = null
    try {
      const { data } = await supabase.auth.getSession()
      userId = data.session?.user.id ?? null
    } catch {
      /* session indisponible : remontée anonyme */
    }
    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json', apikey: ANON_KEY },
        body: JSON.stringify({
          message: message.slice(0, 500),
          stack: stack.slice(0, 4000),
          url: window.location.pathname.slice(0, 200),
          userAgent: navigator.userAgent.slice(0, 300),
          build: buildId(),
          userId,
        }),
      })
    } catch {
      /* jamais bloquant */
    }
  })()
}

/** À appeler une fois au démarrage : erreurs non interceptées + promesses. */
export const installErrorReporter = (): void => {
  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message, 'window')
  })
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, 'promise')
  })
}
