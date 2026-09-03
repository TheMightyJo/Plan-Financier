import { euroFormatter } from '../lib/format'
import type { RecurringCandidate } from '../lib/recurringDetection'

type Props = {
  candidates: RecurringCandidate[]
  onProgram: (candidate: RecurringCandidate) => void
  onDismiss: (candidate: RecurringCandidate) => void
}

/**
 * Carte Accueil : opérations détectées comme mensuelles mais pas encore
 * programmées — « Le programmer ? » crée la règle récurrente en un clic.
 */
export function RecurringSuggestions({ candidates, onProgram, onDismiss }: Props) {
  if (candidates.length === 0) return null
  return (
    <section className="glass-card recurring-suggestions" aria-label="Opérations récurrentes détectées">
      <div className="recurring-suggestions__head">
        <p className="eyebrow">Détecté automatiquement</p>
        <h2>🔁 Ça revient chaque mois — on le programme ?</h2>
        <small>Programmée, l'opération apparaîtra sur le calendrier avant de tomber, sans rien saisir.</small>
      </div>
      <ul>
        {candidates.slice(0, 3).map((candidate) => (
          <li key={candidate.key}>
            <span className="recurring-suggestions__text">
              <strong>{candidate.label}</strong>
              <small>
                {candidate.kind === 'revenu' ? '+' : '−'}
                {euroFormatter.format(candidate.amount)} · vers le {candidate.dayOfMonth} du mois · vu {candidate.months} mois de suite
              </small>
            </span>
            <span className="recurring-suggestions__actions">
              <button type="button" className="hero-cta-button" onClick={() => onProgram(candidate)}>
                Programmer
              </button>
              <button type="button" className="ghost-button" onClick={() => onDismiss(candidate)} aria-label={`Ne pas programmer ${candidate.label}`}>
                Non
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
