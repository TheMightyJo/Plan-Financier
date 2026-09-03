/**
 * Installation de l'app (PWA) : capture l'événement `beforeinstallprompt`
 * (Chrome, Edge, Android) pour proposer un bouton « Installer », et détecte
 * iOS/Safari où l'installation passe par Partager → « Sur l'écran d'accueil ».
 * À appeler très tôt (main.tsx) : l'événement ne se rejoue pas.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((listener) => listener())

export const installPwaListeners = (): void => {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

/** Abonnement aux changements de disponibilité (retourne le désabonnement). */
export const onInstallAvailabilityChange = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** L'app tourne déjà en mode installé (icône sur l'écran d'accueil). */
export const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true)

/** iPhone / iPad (iPadOS se présente comme un Mac tactile). */
export const isIos = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1))

/** Un bouton « Installer » natif est possible (Chrome/Edge/Android). */
export const canPromptInstall = (): boolean => deferredPrompt !== null

/** Ouvre l'invite native ; retourne true si l'utilisateur a accepté. */
export const promptInstall = async (): Promise<boolean> => {
  if (!deferredPrompt) return false
  const event = deferredPrompt
  deferredPrompt = null
  notify()
  await event.prompt()
  const choice = await event.userChoice
  return choice.outcome === 'accepted'
}
