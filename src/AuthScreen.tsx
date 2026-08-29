import { useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, SUPABASE_CONFIG_ERROR, supabase } from './supabase'
import { logAuditEvent } from './lib/auditLog'
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal'
import { TurnstileWidget } from './components/TurnstileWidget'

type Mode = 'login' | 'signup' | 'forgot'

// Clé publique Cloudflare Turnstile. Si absente, la protection anti-robot est
// simplement désactivée côté app (utile quand le CAPTCHA n'est pas activé dans
// Supabase). Doit correspondre au provider configuré dans Supabase Auth.
const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '') as string

const PAIRS = [
  { emoji: '💰', word: 'Argent' },
  { emoji: '💸', word: 'Money' },
  { emoji: '💳', word: 'Geld' },
  { emoji: '📈', word: 'Dinero' },
  { emoji: '🏦', word: 'Soldi' },
  { emoji: '💵', word: 'Dinheiro' },
  { emoji: '🪙', word: 'お金' },
  { emoji: '📊', word: '钱' },
  { emoji: '💹', word: 'Деньги' },
  { emoji: '💶', word: 'Pengar' },
  { emoji: '💴', word: '돈' },
  { emoji: '💷', word: 'Penge' },
]

// Générer plus d'emojis pour remplir l'écran
const EXTENDED_PAIRS = Array.from({ length: 40 }, (_, i) => PAIRS[i % PAIRS.length])

interface FloaterState {
  x: number; y: number
  vx: number; vy: number
  showWord: boolean
  wordTimer: number
  wordInterval: number
}

function FloatingBg() {
  const itemRefs = useRef<(HTMLSpanElement | null)[]>([])
  const stateRef = useRef<FloaterState[]>(
    // Répartition initiale déterministe (suite du nombre d'or) : bien dispersée
    // comme un aléatoire, mais pure — évite Math.random() pendant le render.
    EXTENDED_PAIRS.map((_, i) => ({
      x: (((i + 1) * 0.61803398875) % 1) * window.innerWidth,
      y: (((i + 1) * 0.38196601125) % 1) * window.innerHeight,
      vx: (25 + (i % 4) * 10) * (i % 2 === 0 ? 1 : -1),
      vy: (20 + (i % 3) * 9) * (i % 3 === 0 ? 1 : -1),
      showWord: i % 2 === 0,
      wordTimer: (i * 800) % 3000,
      wordInterval: 2200 + (i * 600) % 2000,
    }))
  )
  const rafRef = useRef(0)
  const lastRef = useRef(0)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      stateRef.current.forEach((_, i) => {
        const el = itemRefs.current[i]
        if (!el) {
          return
        }

        const x = (i * 83) % Math.max(1, window.innerWidth - 80)
        const y = (i * 67) % Math.max(1, window.innerHeight - 40)
        el.style.transform = `translate(${x}px, ${y}px)`

        const emojiEl = el.children[0] as HTMLElement
        const wordEl = el.children[1] as HTMLElement
        if (emojiEl) emojiEl.style.opacity = '0'
        if (wordEl) wordEl.style.opacity = '1'
      })

      return undefined
    }

    const animate = (now: number) => {
      const dt = Math.min(now - lastRef.current, 40)
      lastRef.current = now
      const W = window.innerWidth
      const H = window.innerHeight

      stateRef.current.forEach((f, i) => {
        f.x += (f.vx * dt) / 1000
        f.y += (f.vy * dt) / 1000

        const el = itemRefs.current[i]
        const w = el?.offsetWidth ?? 48
        const h = el?.offsetHeight ?? 32

        if (f.x < 0)       { f.x = 0;       f.vx = Math.abs(f.vx) }
        if (f.x > W - w)   { f.x = W - w;   f.vx = -Math.abs(f.vx) }
        if (f.y < 0)       { f.y = 0;       f.vy = Math.abs(f.vy) }
        if (f.y > H - h)   { f.y = H - h;   f.vy = -Math.abs(f.vy) }

        f.wordTimer += dt
        if (f.wordTimer >= f.wordInterval) {
          f.wordTimer = 0
          f.showWord = !f.showWord
        }

        if (el) {
          el.style.transform = `translate(${f.x}px, ${f.y}px)`
          const emojiEl = el.children[0] as HTMLElement
          const wordEl  = el.children[1] as HTMLElement
          if (emojiEl) emojiEl.style.opacity = f.showWord ? '0' : '1'
          if (wordEl)  wordEl.style.opacity  = f.showWord ? '1' : '0'
        }
      })

      rafRef.current = requestAnimationFrame(animate)
    }

    lastRef.current = performance.now()
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className="auth-floaters" aria-hidden="true">
      {EXTENDED_PAIRS.map((pair, i) => (
        <span
          key={i}
          ref={(el) => { itemRefs.current[i] = el }}
          className="auth-floater"
        >
          <span className="fb-emoji">{pair.emoji}</span>
          <span className="fb-word">{pair.word}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * Mappe un message d'erreur Supabase Auth (en anglais, format libre) vers
 * un texte FR utilisateur. On matche par mot-clé car Supabase ne renvoie
 * pas de codes stables — uniquement des `message` strings.
 */
const supabaseAuthErrorMessage = (rawMessage: string): string => {
  const m = rawMessage.toLowerCase()
  if (m.includes('captcha')) {
    return 'Vérification anti-robot requise ou échouée. Validez la case de sécurité puis réessayez.'
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return "Les inscriptions sont désactivées sur ce serveur."
  }
  if (m.includes('email logins are disabled') || m.includes('email provider') ) {
    return "La connexion par email est désactivée côté serveur."
  }
  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return 'Email ou mot de passe incorrect.'
  }
  if (m.includes('user already registered') || m.includes('already exists')) {
    return 'Un compte existe déjà avec cet email.'
  }
  if (m.includes('password') && (m.includes('short') || m.includes('weak') || m.includes('6 characters'))) {
    return 'Mot de passe trop faible (8 caractères minimum).'
  }
  if (m.includes('invalid email') || m.includes('invalid format')) {
    return 'Adresse email invalide.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Trop de tentatives. Attendez quelques minutes avant de réessayer.'
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Problème réseau. Vérifiez votre connexion.'
  }
  if (m.includes('email not confirmed')) {
    return 'Email non confirmé. Vérifiez votre boîte mail.'
  }
  return 'Une erreur est survenue. Réessayez.'
}

type AuthScreenProps = {
  /** Si fourni : bouton « Essayer sans compte » qui lance le mode démo. */
  onTryDemo?: () => void
}

export default function AuthScreen({ onTryDemo }: AuthScreenProps = {}) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  // Incrémenté après chaque tentative pour remonter le widget Turnstile
  // (token à usage unique) via sa `key`.
  const [captchaNonce, setCaptchaNonce] = useState(0)

  const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)

  const resetCaptcha = () => {
    if (!captchaEnabled) return
    setCaptchaToken('')
    setCaptchaNonce((nonce) => nonce + 1)
  }

  const reset = (next: Mode) => {
    setMode(next)
    setError('')
    setSuccess('')
  }

  const handleGoogle = async () => {
    setError('')
    if (!isSupabaseConfigured()) {
      setError(SUPABASE_CONFIG_ERROR)
      return
    }
    setLoading(true)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (oauthError) {
        setError(supabaseAuthErrorMessage(oauthError.message))
      }
      // Note : signInWithOAuth redirige hors de l'app — pas de finally setLoading
      // côté succès (la page bascule sur Google).
    } catch (err) {
      setError(supabaseAuthErrorMessage(err instanceof Error ? err.message : ''))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!isSupabaseConfigured()) {
      setError(SUPABASE_CONFIG_ERROR)
      return
    }

    if (mode === 'signup') {
      if (password !== confirm) {
        setError('Les mots de passe ne correspondent pas.')
        return
      }
      if (password.length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caractères.')
        return
      }
    }

    if (captchaEnabled && !captchaToken) {
      setError('Veuillez valider la vérification anti-robot avant de continuer.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
          options: captchaEnabled ? { captchaToken } : undefined,
        })
        if (signInError) throw signInError
        await logAuditEvent('login')
      } else if (mode === 'signup') {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            ...(captchaEnabled ? { captchaToken } : {}),
          },
        })
        if (signUpError) throw signUpError
        // Si la confirmation email est activée côté Supabase (cas par défaut),
        // signUp renvoie un user MAIS pas de session. L'utilisateur doit
        // cliquer le lien reçu par email avant de pouvoir se connecter.
        // Si la confirmation est désactivée, une session est créée directement
        // et le onAuthStateChange dans App.tsx prend le relais.
        if (signUpData.user && !signUpData.session) {
          // reset() efface success : repasser en login PUIS poser le message.
          reset('login')
          setSuccess(
            `Compte créé pour ${email.trim()}. Vérifiez votre boîte mail pour activer votre compte (clic sur le lien reçu).`,
          )
        } else if (signUpData.session) {
          // Confirmation email désactivée côté Supabase → user direct loggué
          await logAuditEvent('signup')
        }
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
          ...(captchaEnabled ? { captchaToken } : {}),
        })
        if (resetError) throw resetError
        // reset() efface success/error : on repasse en mode login PUIS on pose
        // le message, sinon il serait immédiatement effacé.
        reset('login')
        setSuccess('Email de réinitialisation envoyé. Vérifiez votre boîte mail.')
      }
    } catch (err) {
      setError(supabaseAuthErrorMessage(err instanceof Error ? err.message : ''))
    } finally {
      setLoading(false)
      // Token Turnstile à usage unique : on en régénère un pour la prochaine
      // tentative (succès comme échec).
      resetCaptcha()
    }
  }

  const supabaseReady = isSupabaseConfigured()
  const [legalDoc, setLegalDoc] = useState<'privacy' | 'terms' | null>(null)

  return (
    <main className="auth-shell">
      <FloatingBg />
      <section className="glass-card auth-card">

        <div className="auth-brand">
          <div className="auth-brand-icon">
            <img src="/logo.png" alt="Logo FP" />
          </div>
        </div>

        {!supabaseReady ? (
          <div className="auth-config-banner" role="alert">
            <strong>Configuration requise.</strong>
            <p>
              Renseignez <code>VITE_SUPABASE_URL</code> et{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> dans <code>.env.local</code> pour activer
              l'authentification. Voir <code>README.md</code> et{' '}
              <code>docs/architecture.md</code> §6.
            </p>
          </div>
        ) : null}

        <h1>
          {mode === 'login' ? 'Connexion' : mode === 'signup' ? 'Créer un compte' : 'Mot de passe oublié'}
        </h1>
        <p className="hero-copy">
          {mode === 'login'
            ? 'Accédez à votre tableau de bord financier.'
            : mode === 'signup'
            ? 'Créez votre espace personnel sécurisé.'
            : 'Recevez un lien de réinitialisation par email.'}
        </p>

        {mode !== 'forgot' ? (
          <>
            <button
              type="button"
              className="auth-google-btn"
              onClick={() => void handleGoogle()}
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continuer avec Google
            </button>
            <div className="auth-divider"><span>ou</span></div>
          </>
        ) : null}

        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              disabled={loading}
              autoComplete={mode === 'signup' ? 'email' : 'username'}
              autoFocus
            />
          </label>

          {mode !== 'forgot' ? (
            <label>
              Mot de passe
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? '8 caractères minimum' : '••••••••'}
                required
                disabled={loading}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </label>
          ) : null}

          {mode === 'signup' ? (
            <label>
              Confirmer le mot de passe
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Répétez le mot de passe"
                required
                disabled={loading}
                autoComplete="new-password"
              />
            </label>
          ) : null}

          {captchaEnabled && supabaseReady ? (
            <TurnstileWidget
              key={captchaNonce}
              siteKey={TURNSTILE_SITE_KEY}
              onToken={setCaptchaToken}
            />
          ) : null}

          {error ? <p className="auth-error">{error}</p> : null}
          {success ? <p className="auth-success">{success}</p> : null}

          {mode === 'signup' ? (
            <p className="auth-rgpd">
              En créant un compte, vous acceptez nos{' '}
              <button
                type="button"
                className="auth-rgpd-link"
                onClick={() => setLegalDoc('terms')}
              >
                Conditions d'utilisation
              </button>{' '}et notre{' '}
              <button
                type="button"
                className="auth-rgpd-link"
                onClick={() => setLegalDoc('privacy')}
              >
                Politique de confidentialité
              </button>
              . Vos données (email, transactions) sont stockées localement sur cet appareil et
              ne sont jamais transmises à des tiers. Vous pouvez supprimer votre compte et
              l'ensemble de vos données à tout moment depuis les paramètres
              (<em>"Mes données RGPD"</em>).
            </p>
          ) : null}

          <button type="submit" disabled={loading}>
            {loading
              ? <span className="inline-loading-label"><span className="inline-loader" aria-hidden="true" />Chargement...</span>
              : mode === 'login'
              ? 'Se connecter'
              : mode === 'signup'
              ? 'Créer mon compte'
              : 'Envoyer le lien'}
          </button>

          <div className="auth-links">
            {mode === 'login' ? (
              <>
                <button type="button" className="auth-link-button" onClick={() => reset('forgot')}>
                  Mot de passe oublié ?
                </button>
                <button type="button" className="auth-link-button auth-link-button--primary" onClick={() => reset('signup')}>
                  Pas encore de compte&nbsp;?{' '}<strong>S'inscrire</strong>
                </button>
              </>
            ) : (
              <button type="button" className="auth-link-button" onClick={() => reset('login')}>
                ← Retour à la connexion
              </button>
            )}
          </div>
        </form>
        {onTryDemo ? (
          <button type="button" className="ghost-button auth-demo-btn" onClick={onTryDemo}>
            🎬 Essayer sans compte (démo)
          </button>
        ) : null}
      </section>
      {legalDoc ? (
        <PrivacyPolicyModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
      ) : null}
    </main>
  )
}
