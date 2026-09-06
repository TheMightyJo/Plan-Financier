import { Sparkles } from 'lucide-react'
import { FREE_LIMITS, type PlanCardVariant } from '../lib/planUsage'

type Props = {
  variant: NonNullable<PlanCardVariant>
  onSeePlans: () => void
  onDismiss: () => void
}

/**
 * Carte « Votre formule » (rail de droite) : pendant l'essai, ce que la
 * personne utilise qui est Premium ; en Découverte, l'usage face aux limites.
 * Un seul rappel à la fois, « Pas maintenant » = 7 jours de silence.
 */
export function PlanCard({ variant, onSeePlans, onDismiss }: Props) {
  if (variant.kind === 'trial') {
    const hasPremiumUse = variant.inUse.length > 0
    return (
      <aside className="glass-card plan-card plan-card--trial" aria-label="Votre essai Premium">
        <p className="eyebrow">
          <Sparkles size={12} aria-hidden="true" /> Essai Premium · {variant.daysLeft <= 1 ? 'dernier jour' : `${variant.daysLeft} jours restants`}
        </p>
        {hasPremiumUse ? (
          <>
            <p className="plan-card__text">
              Vous utilisez <strong>{variant.inUse.join(', ')}</strong>. Après l'essai, ces éléments restent lisibles mais ne peuvent plus être créés ni envoyés.
            </p>
            <button type="button" className="hero-cta-button plan-card__cta" onClick={onSeePlans}>
              Garder tout · 3,99 €/mois
            </button>
          </>
        ) : (
          <>
            <p className="plan-card__text">
              Profitez-en pour essayer plusieurs profils, des poches personnalisées et Cash sans compter : tout est inclus jusqu'à la fin de l'essai.
            </p>
            <button type="button" className="ghost-button plan-card__cta" onClick={onSeePlans}>
              Voir les formules
            </button>
          </>
        )}
        <button type="button" className="plan-card__later" onClick={onDismiss}>
          Pas maintenant
        </button>
      </aside>
    )
  }

  const pct = Math.min(100, Math.round(variant.aiShare * 100))
  const exhausted = variant.aiShare >= 1
  return (
    <aside className={`glass-card plan-card plan-card--free${exhausted ? ' plan-card--alert' : ''}`} aria-label="Votre formule">
      <p className="eyebrow">🌱 Plan Découverte</p>
      <ul className="plan-card__usage">
        <li>
          <span>Messages Cash ce mois-ci</span>
          <strong className={exhausted ? 'negative' : undefined}>
            {variant.aiUsed} / {variant.aiLimit}
          </strong>
          <span className="plan-card__bar" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </span>
        </li>
        <li>
          <span>Profils</span>
          <strong>
            {variant.profiles} / {FREE_LIMITS.profiles}
          </strong>
        </li>
        <li>
          <span>Poches personnalisées</span>
          <strong>{variant.customEnvelopes > 0 ? `${variant.customEnvelopes} (lecture seule)` : 'Premium'}</strong>
        </li>
      </ul>
      <p className="plan-card__text">
        {exhausted
          ? 'Cash a atteint sa limite mensuelle. Premium : 300 messages, profils et poches illimités, rapports par email.'
          : 'Premium : 300 messages Cash, profils et poches illimités, rapports par email. 3,99 €/mois, résiliable en un clic.'}
      </p>
      <button type="button" className="hero-cta-button plan-card__cta" onClick={onSeePlans}>
        Passer Premium
      </button>
      {!exhausted ? (
        <button type="button" className="plan-card__later" onClick={onDismiss}>
          Pas maintenant
        </button>
      ) : null}
    </aside>
  )
}
