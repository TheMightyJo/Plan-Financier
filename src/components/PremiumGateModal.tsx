type Props = {
  /** Fonctionnalité demandée, au pluriel avec article (« les poches personnalisées »). */
  feature: string
  onClose: () => void
  onSeePlans: () => void
}

/** Modale « gating doux » : explique Premium et mène aux formules. */
export function PremiumGateModal({ feature, onClose, onSeePlans }: Props) {
  return (
      <div
        className="modal-backdrop"
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <section className="glass-card premium-gate-card" role="dialog" aria-modal="true" aria-labelledby="premium-gate-title">
          <span className="premium-gate-badge">⭐ Premium</span>
          <h2 id="premium-gate-title">Passez à la vitesse supérieure</h2>
          <p>
            {feature.charAt(0).toUpperCase() + feature.slice(1)} font partie de Plan Financier Premium :
            poches et profils illimités, rapports email automatiques, Cash sans compter.
            <strong> 3,99 €/mois</strong>, résiliable en un clic.
          </p>
          <div className="premium-gate-actions">
            <button
              type="button"
              className="hero-cta-button"
              onClick={onSeePlans}
            >
              Voir les formules
            </button>
            <button type="button" className="ghost-button" onClick={onClose}>
              Plus tard
            </button>
          </div>
        </section>
      </div>
  )
}
