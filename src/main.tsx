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
    void navigator.serviceWorker.register('/sw.js')
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
