import { lazy, Suspense, useEffect, useState } from 'react'
import { LandingPage } from './components/LandingPage'

/**
 * Point d'entrée « vitrine d'abord » : un visiteur qui arrive sur « / » sans
 * session enregistrée voit la vitrine immédiatement, sans télécharger
 * l'application (graphiques, Supabase, PDF…). L'app n'est chargée qu'au clic
 * sur « Se connecter » / « Essayer la démo », ou dès l'arrivée pour toute
 * autre URL (/app, /login, /demo…) et pour les comptes déjà connectés.
 */

const App = lazy(() => import('./App'))

/** Clé de session Supabase (cf. src/supabase.ts, storageKey). */
const SESSION_STORAGE_KEY = 'plan-financier-supabase-auth'

const hasStoredSession = (): boolean => {
  try {
    return Boolean(window.localStorage.getItem(SESSION_STORAGE_KEY))
  } catch {
    return false
  }
}

const shouldBootApp = (): boolean => window.location.pathname !== '/' || hasStoredSession()

/** Précharge l'app au premier signe d'intention (sans peser sur le premier affichage). */
const prefetchApp = () => {
  void import('./App')
}

export default function Bootstrap() {
  const [showApp, setShowApp] = useState(shouldBootApp)

  useEffect(() => {
    if (showApp) return
    const onIntent = () => {
      prefetchApp()
      window.removeEventListener('pointerdown', onIntent)
      window.removeEventListener('keydown', onIntent)
    }
    window.addEventListener('pointerdown', onIntent, { passive: true })
    window.addEventListener('keydown', onIntent)
    // Retour arrière depuis /login → « / » : la vitrine est déjà là.
    return () => {
      window.removeEventListener('pointerdown', onIntent)
      window.removeEventListener('keydown', onIntent)
    }
  }, [showApp])

  if (!showApp) {
    return (
      <LandingPage
        onLogin={() => {
          window.history.pushState({}, '', '/login')
          setShowApp(true)
        }}
        onTryDemo={() => {
          window.history.pushState({}, '', '/demo')
          setShowApp(true)
        }}
      />
    )
  }

  return (
    <Suspense
      fallback={
        <div className="app-boot" role="status" aria-live="polite" aria-label="Chargement de Plan Financier">
          <span className="inline-loader" aria-hidden="true" />
        </div>
      }
    >
      <App />
    </Suspense>
  )
}
