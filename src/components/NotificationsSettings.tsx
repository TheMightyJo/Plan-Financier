import { useEffect, useState } from 'react'
import {
  getPushState,
  isPushSupported,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from '../lib/pushNotifications'

type Props = {
  /** Mode démo : aucune action réelle (affiche un toast explicatif). */
  onBlockedInDemo?: () => boolean
  onOpenInstall: () => void
  showToast: (message: string, level?: 'info' | 'warning' | 'danger') => void
}

/** Paramètres → Notifications : bilan de la semaine en notification push. */
export function NotificationsSettings({ onBlockedInDemo, onOpenInstall, showToast }: Props) {
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getPushState().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = async () => {
    if (onBlockedInDemo?.()) return
    setBusy(true)
    try {
      if (state === 'subscribed') {
        setState(await unsubscribeFromPush())
        showToast('Notifications désactivées sur cet appareil')
      } else {
        const next = await subscribeToPush()
        setState(next)
        if (next === 'subscribed') showToast('🔔 Bilan du dimanche activé sur cet appareil')
        else if (next === 'denied') showToast('Notifications refusées par le navigateur', 'warning')
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Impossible d'activer les notifications", 'danger')
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    if (onBlockedInDemo?.()) return
    setBusy(true)
    const result = await sendTestPush()
    setBusy(false)
    showToast(
      result.ok
        ? '📬 Notification de test envoyée — regardez votre appareil'
        : result.detail === 'push_not_configured'
          ? "L'envoi n'est pas encore configuré côté serveur (clés VAPID)."
          : "Aucune notification envoyée (appareil pas abonné ?)",
      result.ok ? 'info' : 'warning',
    )
  }

  return (
    <div className="settings-section-grid settings-section-grid--single">
      <article className="glass-card settings-section-card form-panel">
        <div className="panel-title">
          <h2>Notifications</h2>
          <p>Le bilan de votre semaine, le dimanche soir, directement sur cet appareil — même l'app fermée.</p>
        </div>

        {state === 'loading' ? (
          <p className="auth-note">Vérification…</p>
        ) : state === 'ios-not-installed' ? (
          <div className="notif-hint">
            <p>Sur iPhone et iPad, les notifications ne fonctionnent que si l'app est installée sur l'écran d'accueil.</p>
            <button type="button" className="hero-cta-button" onClick={onOpenInstall}>📲 Installer l'app d'abord</button>
          </div>
        ) : state === 'unsupported' || !isPushSupported() ? (
          <p className="auth-note">Ce navigateur ne prend pas en charge les notifications push. Le bilan par email reste disponible (Paramètres → Rapport par email).</p>
        ) : state === 'denied' ? (
          <p className="auth-error">Les notifications sont bloquées pour planfinancier.app dans les réglages de votre navigateur. Autorisez-les à nouveau, puis revenez ici.</p>
        ) : (
          <>
            <label className="notif-toggle">
              <input type="checkbox" checked={state === 'subscribed'} onChange={() => void toggle()} disabled={busy} />
              <span>
                <strong>🔔 Bilan du dimanche soir</strong>
                <small>« Votre semaine : Normal ✅ — +180 € ». Une notification par semaine, rien d'autre.</small>
              </span>
            </label>
            {state === 'subscribed' ? (
              <div className="settings-inline-actions">
                <button type="button" className="ghost-button" onClick={() => void test()} disabled={busy}>
                  Envoyer une notification de test
                </button>
              </div>
            ) : null}
          </>
        )}
        <p className="auth-note">Chaque appareil s'abonne séparément. Vos données ne quittent pas votre compte : le message est calculé sur votre serveur, sans service tiers.</p>
      </article>
    </div>
  )
}
