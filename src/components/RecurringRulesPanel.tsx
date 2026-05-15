import { useState, type FormEvent } from 'react'
import { Pencil, Trash2, Pause, Play, Plus, X } from 'lucide-react'
import type { RecurringRule, Category, Envelope, FamilyMember, TransactionKind } from '../types'
import { RECURRING_FREQUENCIES, type RecurringFrequency } from '../types'
import { categories, categoryColors, envelopes, inferEnvelope } from '../lib/categories'
import { validateRule } from '../lib/recurring'
import { buildRecurringRule, removeRule, toggleRulePause, upsertRule } from '../repos/recurringRulesRepo'

type Props = {
  rules: RecurringRule[]
  onChange: (next: RecurringRule[]) => void
  member: FamilyMember
  onClose: () => void
}

type FormState = {
  id: string | null
  label: string
  amount: string
  category: Category
  envelope: Envelope
  kind: TransactionKind
  frequency: RecurringFrequency
  dayOfPeriod: string
  startDate: string
  endDate: string
}

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
}

const KIND_LABELS: Record<TransactionKind, string> = {
  depense: 'Dépense',
  revenu: 'Revenu',
}

const VALIDATION_MESSAGES = {
  label_required: 'Donnez un libellé à la règle.',
  amount_must_be_positive: 'Le montant doit être supérieur à 0.',
  invalid_day_for_weekly: 'Choisissez un jour entre lundi (1) et dimanche (7).',
  invalid_day_for_monthly: 'Le jour du mois doit être entre 1 et 31.',
  invalid_start_date: 'La date de début est invalide.',
  end_before_start: 'La date de fin doit être postérieure au début.',
} as const

const todayIso = () => new Date().toISOString().slice(0, 10)

const emptyForm = (): FormState => ({
  id: null,
  label: '',
  amount: '',
  category: 'Maison',
  envelope: inferEnvelope('Maison'),
  kind: 'depense',
  frequency: 'monthly',
  dayOfPeriod: '5',
  startDate: todayIso(),
  endDate: '',
})

const ruleToForm = (rule: RecurringRule): FormState => ({
  id: rule.id,
  label: rule.label,
  amount: String(rule.amount),
  category: rule.category,
  envelope: rule.envelope,
  kind: rule.kind,
  frequency: rule.frequency,
  dayOfPeriod: String(rule.dayOfPeriod),
  startDate: rule.startDate,
  endDate: rule.endDate ?? '',
})

export function RecurringRulesPanel({ rules, onChange, member, onClose }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const memberRules = rules.filter((r) => r.member === member)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const payload = {
      member,
      label: form.label.trim(),
      amount: Number(form.amount),
      category: form.category,
      envelope: form.envelope,
      kind: form.kind,
      frequency: form.frequency,
      dayOfPeriod: Number(form.dayOfPeriod),
      startDate: form.startDate,
      endDate: form.endDate || null,
    }

    const validation = validateRule(payload)
    if (validation) {
      setError(VALIDATION_MESSAGES[validation])
      return
    }

    if (form.id) {
      const existing = rules.find((r) => r.id === form.id)
      if (!existing) return
      const updated: RecurringRule = { ...existing, ...payload }
      onChange(upsertRule(rules, updated))
    } else {
      const created = buildRecurringRule(payload)
      onChange(upsertRule(rules, created))
    }

    setForm(emptyForm())
    setEditing(false)
  }

  const handleEdit = (rule: RecurringRule) => {
    setForm(ruleToForm(rule))
    setEditing(true)
    setError(null)
  }

  const handleCancel = () => {
    setForm(emptyForm())
    setEditing(false)
    setError(null)
  }

  const handleDelete = (id: string) => {
    onChange(removeRule(rules, id))
    if (form.id === id) handleCancel()
  }

  const handleTogglePause = (id: string) => {
    onChange(toggleRulePause(rules, id))
  }

  return (
    <div
      className="recurring-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Gérer les dépenses récurrentes"
    >
      <div className="recurring-modal glass-card">
        <header className="recurring-header">
          <div>
            <span className="eyebrow">Dépenses récurrentes</span>
            <h2>Règles automatiques</h2>
            <p className="recurring-subtitle">
              Loyer, abonnements, assurances : on les saisit une fois, l'app les ajoute
              automatiquement à chaque échéance.
            </p>
          </div>
          <button
            type="button"
            className="recurring-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </header>

        <section className="recurring-section">
          <h3>{editing ? 'Modifier la règle' : 'Nouvelle règle'}</h3>
          <form className="recurring-form" onSubmit={handleSubmit}>
            <label>
              <span>Libellé</span>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="Loyer, Netflix, Assurance auto…"
                autoComplete="off"
              />
            </label>

            <div className="recurring-form-row">
              <label>
                <span>Montant (€)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="1200"
                />
              </label>

              <label>
                <span>Type</span>
                <select
                  value={form.kind}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, kind: e.target.value as TransactionKind }))
                  }
                >
                  {(['depense', 'revenu'] as const).map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="recurring-form-row">
              <label>
                <span>Catégorie</span>
                <select
                  value={form.category}
                  onChange={(e) => {
                    const next = e.target.value as Category
                    setForm((p) => ({ ...p, category: next, envelope: inferEnvelope(next) }))
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
                <span>Enveloppe</span>
                <select
                  value={form.envelope}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, envelope: e.target.value as Envelope }))
                  }
                >
                  {envelopes.map((env) => (
                    <option key={env} value={env}>
                      {env}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="recurring-form-row">
              <label>
                <span>Fréquence</span>
                <select
                  value={form.frequency}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, frequency: e.target.value as RecurringFrequency }))
                  }
                >
                  {RECURRING_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {FREQUENCY_LABELS[f]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{form.frequency === 'weekly' ? 'Jour (1=Lun → 7=Dim)' : 'Jour du mois'}</span>
                <input
                  type="number"
                  min="1"
                  max={form.frequency === 'weekly' ? 7 : 31}
                  value={form.dayOfPeriod}
                  onChange={(e) => setForm((p) => ({ ...p, dayOfPeriod: e.target.value }))}
                />
              </label>
            </div>

            <div className="recurring-form-row">
              <label>
                <span>Date de début</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </label>

              <label>
                <span>Date de fin (optionnel)</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </label>
            </div>

            {error ? <p className="recurring-error">{error}</p> : null}

            <div className="recurring-form-actions">
              <button type="submit" className="hero-cta-button">
                <Plus size={16} />
                {editing ? 'Mettre à jour' : 'Ajouter la règle'}
              </button>
              {editing ? (
                <button type="button" className="ghost-button" onClick={handleCancel}>
                  Annuler
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="recurring-section">
          <h3>Règles existantes ({memberRules.length})</h3>
          {memberRules.length === 0 ? (
            <p className="recurring-empty">
              Aucune règle pour ce profil. Ajoutez votre premier loyer ou abonnement ci-dessus.
            </p>
          ) : (
            <ul className="recurring-rules-list">
              {memberRules.map((rule) => (
                <li
                  key={rule.id}
                  className={`recurring-item${rule.pausedAt !== null ? ' is-paused' : ''}`}
                >
                  <span
                    className="recurring-color-dot"
                    style={{ background: categoryColors[rule.category] }}
                    aria-hidden="true"
                  />
                  <div className="recurring-item-main">
                    <strong>{rule.label}</strong>
                    <span className="recurring-item-meta">
                      {rule.amount.toLocaleString('fr-FR')} € · {FREQUENCY_LABELS[rule.frequency]}
                      {' · '}
                      {rule.frequency === 'weekly'
                        ? `Jour ${rule.dayOfPeriod}`
                        : `Le ${rule.dayOfPeriod} du mois`}
                      {rule.lastGeneratedOn ? ` · dernière : ${rule.lastGeneratedOn}` : ''}
                    </span>
                  </div>
                  <div className="recurring-item-actions">
                    <button
                      type="button"
                      onClick={() => handleTogglePause(rule.id)}
                      aria-label={rule.pausedAt !== null ? 'Reprendre' : 'Mettre en pause'}
                      title={rule.pausedAt !== null ? 'Reprendre' : 'Mettre en pause'}
                    >
                      {rule.pausedAt !== null ? <Play size={14} /> : <Pause size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(rule)}
                      aria-label="Modifier"
                      title="Modifier"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule.id)}
                      aria-label="Supprimer"
                      title="Supprimer"
                      className="recurring-delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
