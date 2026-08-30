import { useEffect, useRef } from 'react'

// Typage minimal de l'API Turnstile injectée par le script Cloudflare.
interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
      theme?: 'auto' | 'light' | 'dark'
    },
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

// Charge le script Turnstile une seule fois (mutualisé entre tous les montages).
let scriptPromise: Promise<void> | null = null
const loadTurnstileScript = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed')))
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile script failed'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

type Props = {
  siteKey: string
  /** Reçoit le token à la résolution, ou '' en cas d'expiration/erreur. */
  onToken: (token: string) => void
  theme?: 'auto' | 'light' | 'dark'
}

/**
 * Widget Cloudflare Turnstile (rendu explicite). Le token obtenu doit être
 * passé à Supabase via `options: { captchaToken }`. Il est à usage unique :
 * remonter le composant (via une `key`) après chaque tentative pour en obtenir
 * un neuf.
 */
export function TurnstileWidget({ siteKey, onToken, theme = 'auto' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let widgetId: string | null = null
    let cancelled = false

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token) => onToken(token),
          'error-callback': () => onToken(''),
          'expired-callback': () => onToken(''),
        })
      })
      .catch(() => {
        // Script bloqué (réseau/extension) : on ne casse pas l'UI. Le token
        // reste vide et le submit affichera un message d'erreur clair.
      })

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId)
        } catch {
          // widget déjà retiré
        }
      }
    }
  }, [siteKey, theme, onToken])

  return <div ref={containerRef} className="auth-captcha" />
}
