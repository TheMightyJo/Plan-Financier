import { useState, type FormEvent } from 'react'
import { Sparkles, X } from 'lucide-react'

type Props = {
  /** Budget mensuel actuel du profil (pré-rempli). */
  currentBudget: number
  /** Callback : budget validé par l'utilisateur. */
  onSubmit: (budget: number) => void
  /** Callback : l'utilisateur passe l'étape (budget inchangé). */
  onSkip: () => void
}

const PRESETS = [1500, 2000, 2500, 3000]

/**
 * Guide de bienvenue au premier lancement : définir le budget mensuel.
 * (Remplace l'ancien tour « première transaction » — le budget est la
 * fondation de toutes les jauges et alertes, autant démarrer par lui.)
 * Réutilise les styles first-tx-* existants.
 */
export function FirstBudgetTour({ currentBudget, onSubmit, onSkip }: Props) {
  const [amount, setAmount] = useState(String(currentBudget))
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Math.round(Number(amount.replace(',', '.')))
    if (!value || Number.isNaN(value) || value < 200) {
      setError('Indiquez un budget mensuel d’au moins 200 €.')
      return
    }
    onSubmit(value)
  }

  return (
    <div
      className="first-tx-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Définir votre budget mensuel"
    >
      <div className="first-tx-modal glass-card">
        <header className="first-tx-header">
          <div>
            <span className="eyebrow">
              <Sparkles size={12} aria-hidden="true" /> Bienvenue
            </span>
            <h2>Définissez votre budget mensuel</h2>
            <p className="first-tx-subtitle">
              C'est la somme que vous vous autorisez à dépenser chaque mois. Toutes les jauges,
              alertes et conseils s'appuient dessus — et vous pourrez l'ajuster à tout moment
              dans les Paramètres.
            </p>
          </div>
          <button
            type="button"
            className="first-tx-close"
            onClick={onSkip}
            aria-label="Passer cette étape"
          >
            <X size={18} />
          </button>
        </header>

        <form className="first-tx-form" onSubmit={handleSubmit}>
          <label>
            <span>Budget mensuel (€)</span>
            <input
              type="number"
              inputMode="numeric"
              step="50"
              min="200"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </label>

          <div className="first-tx-presets" role="group" aria-label="Suggestions de budget">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`first-tx-preset${Number(amount) === preset ? ' first-tx-preset--active' : ''}`}
                onClick={() => setAmount(String(preset))}
              >
                {preset.toLocaleString('fr-FR')} €
              </button>
            ))}
          </div>

          {error ? <p className="first-tx-error">{error}</p> : null}

          <div className="first-tx-actions">
            <button type="submit" className="hero-cta-button">
              Enregistrer mon budget
            </button>
            <button type="button" className="ghost-button" onClick={onSkip}>
              Plus tard
            </button>
          </div>

          <p className="first-tx-note">
            💡 Repère utile : comptez vos revenus mensuels moins ce que vous voulez épargner.
          </p>
        </form>
      </div>
    </div>
  )
}
