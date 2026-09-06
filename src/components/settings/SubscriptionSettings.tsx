import type { AiQuota } from '../../lib/aiClient'
import type { PremiumAccess } from '../../lib/premiumAccess'
import type { PlanId, SubscriptionInfo } from '../../repos/billingRepo'

type Props = {
  subscription: SubscriptionInfo | null
  aiQuota: AiQuota | null
  userPlan: PlanId
  premiumAccess: PremiumAccess
  checkoutBusy: string | null
  canUseIncludedAi: boolean
  handleStartCheckout: (plan: 'premium' | 'family', interval: 'monthly' | 'yearly') => Promise<void>
  handleOpenBillingPortal: () => Promise<void>
}

/** Paramètres → Abonnement : formule, essai, quota IA, passage Premium / Famille, portail Stripe. */
export function SubscriptionSettings({
  subscription,
  aiQuota,
  userPlan,
  premiumAccess,
  checkoutBusy,
  canUseIncludedAi,
  handleStartCheckout,
  handleOpenBillingPortal,
}: Props) {
  const renewDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null
  const quotaPct = aiQuota && aiQuota.limit > 0
    ? Math.min(100, Math.round((aiQuota.used / aiQuota.limit) * 100))
    : 0
  const busyLabel = (key: string, label: string) =>
    checkoutBusy === key ? (
      <span className="inline-loading-label"><span className="inline-loader" aria-hidden="true" />Ouverture…</span>
    ) : label
  return (
    <div className="settings-section-grid settings-section-grid--single">
      <article className="glass-card settings-section-card form-panel">
        <div className="panel-title">
          <h2>Abonnement</h2>
          <p>Votre formule actuelle, votre quota IA inclus et les options pour évoluer.</p>
        </div>

        <div className={`subscription-current subscription-current--${userPlan}`}>
          <strong>
            {userPlan === 'premium' ? '⭐ Premium' : userPlan === 'family' ? '👨‍👩‍👧 Famille' : '🌱 Découverte — gratuit'}
          </strong>
          <small>
            {userPlan === 'free'
              ? premiumAccess.reason === 'trial'
                ? premiumAccess.unlocked && premiumAccess.trialEndsAt
                  ? `Essai complet : ${premiumAccess.daysLeft ?? 0} jour${(premiumAccess.daysLeft ?? 0) > 1 ? 's' : ''} restant${(premiumAccess.daysLeft ?? 0) > 1 ? 's' : ''} (jusqu'au ${premiumAccess.trialEndsAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}). Ensuite : plan Découverte — 1 profil, 3 poches, 15 messages Cash par mois, sans rapport email.`
                  : 'Essai terminé — plan Découverte : 3 poches, 1 profil, sans rapport email. Passez Premium pour tout retrouver.'
                : 'Vous profitez de la période de lancement : toutes les fonctionnalités sont offertes aux premiers inscrits.'
              : subscription?.cancelAtPeriodEnd
                ? `Résiliation programmée — accès jusqu'au ${renewDate ?? 'terme en cours'}.`
                : renewDate
                  ? `Abonnement actif — renouvellement le ${renewDate}.`
                  : 'Abonnement actif.'}
          </small>
        </div>

        {canUseIncludedAi ? (
          <div className="ai-quota-box">
            <div className="ai-quota-box__head">
              <strong>🤖 IA incluse (Cash)</strong>
              <span>{aiQuota ? `${aiQuota.used} / ${aiQuota.limit} messages ce mois-ci` : 'Chargement…'}</span>
            </div>
            <div className="ai-quota-bar" role="progressbar" aria-valuenow={quotaPct} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${quotaPct}%` }} />
            </div>
            <small>Votre clé API personnelle (Paramètres → Assistant IA) reste utilisable sans quota.</small>
          </div>
        ) : null}

        {userPlan !== 'family' ? (
          <div className="subscription-plans">
            {userPlan === 'free' ? (
              <div className="subscription-plan subscription-plan--highlight">
                <div className="subscription-plan__head">
                  <strong>⭐ Premium</strong>
                  <span>3,99 €/mois</span>
                </div>
                <p>IA complète (300 messages/mois), poches et profils illimités, rapports email automatiques.</p>
                <div className="subscription-plan__actions">
                  <button type="button" className="hero-cta-button" disabled={checkoutBusy !== null} onClick={() => void handleStartCheckout('premium', 'monthly')}>
                    {busyLabel('premium-monthly', 'Passer Premium — 3,99 €/mois')}
                  </button>
                  <button type="button" className="ghost-button" disabled={checkoutBusy !== null} onClick={() => void handleStartCheckout('premium', 'yearly')}>
                    {busyLabel('premium-yearly', '29,99 €/an (−37 %)')}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="subscription-plan">
              <div className="subscription-plan__head">
                <strong>👨‍👩‍👧 Famille</strong>
                <span>5,99 €/mois</span>
              </div>
              <p>Tout Premium, jusqu'à 5 membres du foyer, vue famille fusionnée, 500 messages IA/mois.</p>
              <div className="subscription-plan__actions">
                <button type="button" className="hero-cta-button" disabled={checkoutBusy !== null} onClick={() => void handleStartCheckout('family', 'monthly')}>
                  {busyLabel('family-monthly', 'Choisir Famille — 5,99 €/mois')}
                </button>
                <button type="button" className="ghost-button" disabled={checkoutBusy !== null} onClick={() => void handleStartCheckout('family', 'yearly')}>
                  {busyLabel('family-yearly', '44,99 €/an')}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {userPlan !== 'free' ? (
          <div className="settings-inline-actions">
            <button type="button" className="ghost-button" disabled={checkoutBusy !== null} onClick={() => void handleOpenBillingPortal()}>
              {busyLabel('portal', '🧾 Gérer mon abonnement (factures, résiliation)')}
            </button>
          </div>
        ) : null}

        <p className="auth-note">
          Paiement sécurisé par Stripe. Résiliable en un clic, sans engagement — vos données restent à vous, quel que soit le plan.
        </p>
      </article>
    </div>
  )
}
