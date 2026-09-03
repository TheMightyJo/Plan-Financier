import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './index.css'
import App from './App.tsx'
import AppErrorBoundary from './AppErrorBoundary.tsx'
import { installErrorReporter } from './lib/errorReporter'
import { installPwaListeners } from './lib/pwaInstall'

// Monitoring maison des erreurs (prod uniquement, cf. lib/errorReporter).
installErrorReporter()
// PWA : l'événement d'installation ne se rejoue pas, on l'écoute dès le départ.
installPwaListeners()

// PWA : service worker en prod uniquement (en dev il interférerait avec HMR).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // updateViaCache: 'none' → le navigateur revérifie sw.js à chaque visite
    // (sinon il peut garder l'ancien script jusqu'à 24 h).
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch(() => {})
    // Quand une nouvelle version prend la main, on recharge une fois : évite
    // un HTML neuf servi avec des assets (CSS/JS) de l'ancienne version.
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
