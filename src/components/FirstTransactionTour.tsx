import { useState, type FormEvent } from 'react'
import { Sparkles, X } from 'lucide-react'
import type { Category, Envelope, FamilyMember, Transaction, TransactionKind } from '../types'
import { categories, inferEnvelope } from '../lib/categories'

type Props = {
  /** Profil actif au moment du tour (account_id équivalent post-Supabase). */
  member: FamilyMember
  /** Suggestion personnalisée par profil (ex : "Achat boulangerie 8 €"). */
  suggestion?: { label: string; amount: number; category: Category }
  /** Callback : la transaction validée par l'utilisateur. */
  onSubmit: (transaction: Transaction) => void
  /** Callback : l'utilisateur passe l'étape (rien à enregistrer). */
  onSkip: () => void
}

const todayIso = () => new Date().toISOString().slice(0, 10)

const DEFAULT_SUGGESTION = {
  label: 'Boulangerie',
  amount: 8.5,
  category: 'Courses' as Category,
}

const KIND_LABELS: Record<TransactionKind, string> = {
  depense: 'Dépense',
  revenu: 'Revenu',
}

export function FirstTransactionTour({ member, suggestion, onSubmit, onSkip }: Props) {
  const seed = suggestion ?? DEFAULT_SUGGESTION
  const [label, setLabel] = useState(seed.label)
  const [amount, setAmount] = useState(String(seed.amount))
  const [category, setCategory] = useState<Category>(seed.category)
  const [envelope, setEnvelope] = useState<Envelope>(inferEnvelope(seed.category))
  const [kind, setKind] = useState<TransactionKind>('depense')
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) {
      setError('Donnez un libellé à la transaction.')
      return
    }
    const amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) {
      setError('Le montant doit être supérieur à 0.')
      return
    }
    onSubmit({
      id: Date.now(),
      label: trimmed,
      amount: amountNum,
      category,
      member,
      date,
      kind,
      envelope,
    })
  }

  return (
    <div
      className="first-tx-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Ajouter votre première transaction"
    >
      <div className="first-tx-modal glass-card">
        <header className="first-tx-header">
          <div>
            <span className="eyebrow">
              <Sparkles size={12} aria-hidden="true" /> Bienvenue
            </span>
            <h2>Ajoutez votre première transaction</h2>
            <p className="first-tx-subtitle">
              Une transaction = une ligne de votre vie financière. Pas besoin d'être exhaustif —
              démarrez avec ce qui vous vient en tête. Vous pourrez tout modifier plus tard.
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
            <span>Libellé</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex : Boulangerie, Restaurant, Salaire…"
              autoFocus
            />
          </label>

          <div className="first-tx-row">
            <label>
              <span>Montant (€)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>

            <label>
              <span>Type</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as TransactionKind)}
              >
                {(['depense', 'revenu'] as const).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="first-tx-row">
            <label>
              <span>Catégorie</span>
              <select
                value={category}
                onChange={(e) => {
                  const next = e.target.value as Category
                  setCategory(next)
                  setEnvelope(inferEnvelope(next))
                }}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={todayIso()}
              />
            </label>
          </div>

          {error ? <p className="first-tx-error">{error}</p> : null}

          <div className="first-tx-actions">
            <button type="submit" className="hero-cta-button">
              Ajouter cette transaction
            </button>
            <button type="button" className="ghost-button" onClick={onSkip}>
              Passer cette étape
            </button>
          </div>

          <p className="first-tx-note">
            <strong>Confidentialité :</strong> votre transaction est stockée localement sur cet
            appareil. Aucun envoi serveur tant que vous n'activez pas la synchronisation.
          </p>
        </form>
      </div>
    </div>
  )
}
