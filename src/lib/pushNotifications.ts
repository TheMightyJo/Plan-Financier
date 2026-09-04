import { supabase } from '../supabase'
import { isIos, isStandalone } from './pwaInstall'

/**
 * Notifications push (Web Push + VAPID) : abonnement du navigateur et
 * enregistrement dans public.push_subscriptions (RLS : lignes de
 * l'utilisateur). L'envoi est fait par la fonction Edge send-push.
 *
 * La clé publique VAPID n'est pas un secret (elle identifie le serveur
 * d'envoi) ; elle peut être surchargée par VITE_VAPID_PUBLIC_KEY.
 */

export const VAPID_PUBLIC_KEY: string =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || 'BGrBegKK3lyQFtYMbXK_2hLlB_ztireBcZV-tza3F6hwOdiv8kGM0DkPzZy-r1csmkLrf3jICTslB8cOZmWCRos'

export type PushState =
  | 'unsupported'
  | 'ios-not-installed'
  | 'denied'
  | 'subscribed'
  | 'unsubscribed'

const urlBase64ToUint8Array = (base64: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window &&
  VAPID_PUBLIC_KEY.length > 40

const registration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

export const getPushState = async (): Promise<PushState> => {
  if (!isPushSupported()) {
    // iOS n'autorise le push que pour une app installée sur l'écran d'accueil.
    return isIos() && !isStandalone() ? 'ios-not-installed' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'subscribed' : 'unsubscribed'
}

/** Demande la permission, abonne le navigateur et enregistre l'abonnement. */
export const subscribeToPush = async (): Promise<PushState> => {
  if (!isPushSupported()) return await getPushState()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'unsubscribed'
  const reg = await registration()
  if (!reg) return 'unsupported'
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) return 'unsubscribed'
  const keys = sub.toJSON().keys ?? {}
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      user_id: userId,
      p256dh: keys.p256dh ?? '',
      auth: keys.auth ?? '',
      user_agent: navigator.userAgent.slice(0, 300),
      weekly: true,
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    await sub.unsubscribe().catch(() => {})
    throw new Error("Impossible d'enregistrer l'abonnement (migration 0011 appliquée ?).")
  }
  return 'subscribed'
}

/** Désabonne ce navigateur et retire la ligne serveur. */
export const unsubscribeFromPush = async (): Promise<PushState> => {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe().catch(() => {})
  }
  return 'unsubscribed'
}

/** Envoie une notification de test à tous les appareils de l'utilisateur. */
export const sendTestPush = async (): Promise<{ ok: boolean; detail?: string }> => {
  const { data, error } = await supabase.functions.invoke('send-push', { body: { test: true } })
  if (error) {
    const context = (error as { context?: Response }).context
    const payload = context ? await context.json().catch(() => null) : null
    return { ok: false, detail: (payload as { error?: string } | null)?.error ?? 'send_failed' }
  }
  return { ok: Number((data as { sent?: number } | null)?.sent ?? 0) > 0 }
}
