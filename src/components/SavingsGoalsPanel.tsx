import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Trash2, Plus, X, Target, CheckCircle2, AlertTriangle, PiggyBank } from 'lucide-react'
import type { Account, FamilyMember, SavingsTarget, Transaction } from '../types'
import {
  addContribution,
  computeCurrentSaved,
  computeGoalStatus,
  computePaceOutlook,
  progressPercent,
  recommendedMonthlyAmount,
  validateGoal,
  type GoalStatus,
} from '../lib/savingsGoals'

type Props = {
  goals: SavingsTarget[]
  accounts: Account[]
  transactions: Transaction[]
  member: FamilyMember
  onChange: (next: SavingsTarget[]) => void
  onClose: () => void
}

type FormState = {
  id: string | null
  label: string
  targetAmount: string
  targetDate: string
  destinationAccountId: string
  currentSaved: string
  displayColor: string
}

const DEFAULT_COLOR = '#8B6C52' // terre charte

const VALIDATION_MESSAGES = {
  label_required: 'Donnez un nom à l’objectif (ex : Vacances 2027).',
  target_amount_must_be_positive: 'Le montant cible doit être supérieur à 0.',
  target_date_in_past: 'La date cible doit être future.',
} as const

const STATUS_LABELS: Record<GoalStatus, string> = {
  achieved: 'Atteint',
  on_track: 'En route',
  late: 'En retard',
  tight: 'Tendu',
}

const euro = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const euro2 = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

const todayIso = () => new Date().toISOString().slice(0, 10)

const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const formatMonthYear = (iso: string) => monthYear.format(new Date(`${iso}T00:00:00`))
const formatShortDate = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00`))

/** Phrase « à ce rythme » : rythme observé + date projetée + avance/retard. */
const describeOutlook = (
  outlook: { pace: number; projectedDate: string; monthsDelta: number | null },
): string => {
  const base = `Rythme ${euro.format(outlook.pace)}/mois · atteint vers ${formatMonthYear(outlook.projectedDate)}`
  if (outlook.monthsDelta === null || outlook.monthsDelta === 0) return base
  const n = Math.abs(outlook.monthsDelta)
  return `${base} (${outlook.monthsDelta < 0 ? `${n} mois d'avance` : `${n} mois de retard`})`
}

const emptyForm = (): FormState => ({
  id: null,
  label: '',
  targetAmount: '',
  targetDate: '',
  destinationAccountId: '',
  currentSaved: '',
  displayColor: DEFAULT_COLOR,
})

const goalToForm = (g: SavingsTarget): FormState => ({
  id: g.id,
  label: g.label,
  targetAmount: String(g.targetAmount),
  targetDate: g.targetDate ?? '',
  destinationAccountId: g.destinationAccountId ?? '',
  currentSaved: g.currentSaved !== undefined ? String(g.currentSaved) : '',
  displayColor: g.displayColor ?? DEFAULT_COLOR,
})

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `goal-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

export function SavingsGoalsPanel({
  goals,
  accounts,
  transactions,
  member,
  onChange,
  onClose,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  /** Objectif dont le mini-formulaire « Mettre de côté » est ouvert. */
  const [contributingId, setContributingId] = useState<string | null>(null)
  const [contributionAmount, setContributionAmount] = useState('')

  const handleContribute = (goalId: string) => {
    const amount = Number(contributionAmount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount === 0) return
    onChange(goals.map((g) => (g.id === goalId ? addContribution(g, amount, todayIso()) : g)))
    setContributingId(null)
    setContributionAmount('')
  }

  const memberAccounts = useMemo(
    () => accounts.filter((a) => a.ownerMember === member && a.archivedAt === null),
    [accounts, member],
  )
  const memberGoals = useMemo(
    () =>
      goals.filter(
        (g) => g.member === undefined || g.member === member,
      ),
    [goals, member],
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const payload: Partial<SavingsTarget> = {
      label: form.label.trim(),
      targetAmount: Number(form.targetAmount),
      targetDate: form.targetDate || undefined,
      destinationAccountId: form.destinationAccountId || undefined,
      currentSaved: form.currentSaved !== '' ? Number(form.currentSaved) : undefined,
      displayColor: form.displayColor || undefined,
    }

    const validation = validateGoal(payload)
    if (validation) {
      setError(VALIDATION_MESSAGES[validation])
      return
    }

    const now = Date.now()
    if (form.id) {
      const existing = goals.find((g) => g.id === form.id)
      if (!existing) return
      onChange(
        goals.map((g) =>
          g.id === form.id
            ? { ...existing, ...payload, member, updatedAt: now } as SavingsTarget
            : g,
        ),
      )
    } else {
      const created: SavingsTarget = {
        id: createId(),
        label: payload.label!,
        targetAmount: payload.targetAmount!,
        targetDate: payload.targetDate,
        destinationAccountId: payload.destinationAccountId,
        currentSaved: payload.currentSaved,
        displayColor: payload.displayColor,
        member,
        createdAt: now,
        updatedAt: now,
      }
      onChange([...goals, created])
    }

    setForm(emptyForm())
    setEditing(false)
  }

  const handleEdit = (g: SavingsTarget) => {
    setForm(goalToForm(g))
    setEditing(true)
    setError(null)
  }

  const handleCancel = () => {
    setForm(emptyForm())
    setEditing(false)
    setError(null)
  }

  const handleDelete = (id: string) => {
    onChange(goals.filter((g) => g.id !== id))
    if (form.id === id) handleCancel()
  }

  const handleMarkAchieved = (id: string) => {
    onChange(
      goals.map((g) =>
        g.id === id ? { ...g, achievedAt: g.achievedAt ? undefined : Date.now() } : g,
      ),
    )
  }

  const today = todayIso()

  return (
    <div
      className="goals-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Gérer les objectifs d'épargne"
    >
      <div className="goals-modal glass-card">
        <header className="goals-header">
          <div>
            <span className="eyebrow">
              <Target size={12} aria-hidden="true" /> Objectifs d'épargne
            </span>
            <h2>Vos projets</h2>
            <p className="goals-subtitle">
              Vacances, voiture, apport… Définissez l'objectif et l'échéance, on calcule
              combien mettre de côté chaque mois pour y arriver.
            </p>
          </div>
          <button type="button" className="goals-close" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>

        <section className="goals-section">
          <h3>{editing ? 'Modifier l’objectif' : 'Nouvel objectif'}</h3>
          <form className="goals-form" onSubmit={handleSubmit}>
            <label>
              <span>Nom</span>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="Vacances 2027, Apport appartement, Voiture…"
                autoComplete="off"
              />
            </label>

            <div className="goals-form-row">
              <label>
                <span>Montant cible (€)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  value={form.targetAmount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, targetAmount: e.target.value }))
                  }
                  placeholder="3000"
                />
              </label>

              <label>
                <span>Date cible (optionnel)</span>
                <input
                  type="date"
                  value={form.targetDate}
                  min={today}
                  onChange={(e) => setForm((p) => ({ ...p, targetDate: e.target.value }))}
                />
              </label>
            </div>

            <div className="goals-form-row">
              <label>
                <span>Compte dédié (optionnel)</span>
                <select
                  value={form.destinationAccountId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, destinationAccountId: e.target.value }))
                  }
                >
                  <option value="">— Aucun (saisie manuelle) —</option>
                  {memberAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>

              {!form.destinationAccountId ? (
                <label>
                  <span>Déjà épargné (manuel)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="0"
                    value={form.currentSaved}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, currentSaved: e.target.value }))
                    }
                    placeholder="0"
                  />
                </label>
              ) : (
                <label>
                  <span>Couleur</span>
                  <input
                    type="color"
                    value={form.displayColor}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, displayColor: e.target.value }))
                    }
                  />
                </label>
              )}
            </div>

            {error ? <p className="goals-error">{error}</p> : null}

            <div className="goals-form-actions">
              <button type="submit" className="hero-cta-button">
                <Plus size={16} />
                {editing ? 'Mettre à jour' : "Ajouter l'objectif"}
              </button>
              {editing ? (
                <button type="button" className="ghost-button" onClick={handleCancel}>
                  Annuler
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="goals-section">
          <h3>Objectifs en cours ({memberGoals.length})</h3>
          {memberGoals.length === 0 ? (
            <p className="goals-empty">
              Aucun objectif défini. Lancez votre premier projet d'épargne ci-dessus.
            </p>
          ) : (
            <ul className="goals-list">
              {memberGoals.map((g) => {
                const current = computeCurrentSaved(g, accounts, transactions)
                const status = g.achievedAt ? 'achieved' : computeGoalStatus(g, current, today)
                const percent = progressPercent(current, g.targetAmount)
                const monthly = recommendedMonthlyAmount(g, current, today)
                const remaining = Math.max(0, g.targetAmount - current)
                const color = g.displayColor ?? DEFAULT_COLOR
                const outlook = computePaceOutlook(g, current, today)
                const recent = [...(g.contributions ?? [])].slice(-3).reverse()

                return (
                  <li key={g.id} className={`goal-item status-${status}`}>
                    <div className="goal-item-head">
                      <strong>{g.label}</strong>
                      <span className={`goal-status status-${status}`}>
                        {status === 'achieved' ? <CheckCircle2 size={12} /> : null}
                        {status === 'late' || status === 'tight' ? (
                          <AlertTriangle size={12} />
                        ) : null}
                        {STATUS_LABELS[status]}
                      </span>
                    </div>

                    <div className="goal-progress" aria-label={`Progression ${percent.toFixed(0)} pourcent`}>
                      <div
                        className="goal-progress-fill"
                        style={{ width: `${percent}%`, background: color }}
                      />
                    </div>

                    <div className="goal-meta">
                      <span>
                        <strong>{euro.format(current)}</strong> sur {euro.format(g.targetAmount)}
                      </span>
                      <span>{percent.toFixed(0)}%</span>
                    </div>

                    {g.targetDate ? (
                      <div className="goal-deadline">
                        <span>Échéance : {g.targetDate}</span>
                        {monthly !== null && status !== 'achieved' ? (
                          <span>
                            ≈ {euro2.format(monthly)} / mois pour finir à temps
                          </span>
                        ) : null}
                        {status === 'achieved' ? <span>🎉 Bravo !</span> : null}
                      </div>
                    ) : (
                      <div className="goal-deadline">
                        <span>
                          {monthly === null && remaining > 0
                            ? `Reste ${euro.format(remaining)} (sans échéance)`
                            : null}
                        </span>
                      </div>
                    )}

                    {outlook && status !== 'achieved' ? (
                      <p className="goal-outlook">{describeOutlook(outlook)}</p>
                    ) : null}

                    {recent.length > 0 ? (
                      <ul className="goal-contributions" aria-label="Derniers versements">
                        {recent.map((c) => (
                          <li key={c.id}>
                            <span>{formatShortDate(c.date)}</span>
                            <span className={c.amount < 0 ? 'negative' : 'positive'}>
                              {c.amount < 0 ? '−' : '+'} {euro.format(Math.abs(c.amount))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {contributingId === g.id ? (
                      <form
                        className="goal-contribute-form"
                        onSubmit={(event) => {
                          event.preventDefault()
                          handleContribute(g.id)
                        }}
                      >
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          placeholder="Montant (ex : 50)"
                          aria-label="Montant mis de côté"
                          value={contributionAmount}
                          onChange={(event) => setContributionAmount(event.target.value)}
                          autoFocus
                        />
                        <button type="submit" className="hero-cta-button">
                          Valider
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => {
                            setContributingId(null)
                            setContributionAmount('')
                          }}
                        >
                          Annuler
                        </button>
                        {g.destinationAccountId ? (
                          <span className="goal-contribute-hint">
                            Compte lié : le solde du compte fait foi, le versement sert au rythme.
                          </span>
                        ) : null}
                      </form>
                    ) : null}

                    <div className="goal-actions">
                      {status !== 'achieved' ? (
                        <button
                          type="button"
                          className="goal-contribute"
                          onClick={() => {
                            setContributingId(g.id)
                            setContributionAmount('')
                          }}
                          title="Mettre de côté"
                        >
                          <PiggyBank size={14} />
                          <span>Mettre de côté</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleMarkAchieved(g.id)}
                        title={g.achievedAt ? 'Marquer comme en cours' : 'Marquer comme atteint'}
                        aria-label={g.achievedAt ? 'Réactiver' : 'Marquer atteint'}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(g)}
                        title="Modifier"
                        aria-label="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="goal-delete"
                        onClick={() => handleDelete(g.id)}
                        title="Supprimer"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
