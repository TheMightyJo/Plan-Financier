import type { Dispatch, FormEvent, MutableRefObject, SetStateAction } from 'react'
import { GroupedSearchSelect } from './GroupedSearchSelect'
import { EXPENSE_CATEGORY_GROUPS, INCOME_CATEGORY_GROUPS, suggestCategoryFromLabel, type CategoryGroup } from '../lib/categories'
import { shiftMonth } from '../lib/calendar'
import type { Category, Envelope, RecurringFrequency, TransactionKind } from '../types'

/** Brouillon du formulaire d'ajout rapide (miroir de l'état dans App). */
export type QuickAddFormState = {
  label: string
  amount: string
  kind: TransactionKind
  category: Category
  envelope: Envelope
  tags: string
  recurrence: 'none' | RecurringFrequency
  /** '' = compte sur le mois de la date ; sinon YYYY-MM choisi. */
  budgetMonth: string
}

type Props = {
  quickAddDate: string
  setQuickAddDate: (date: string) => void
  closeQuickAdd: () => void
  quickAddForm: QuickAddFormState
  setQuickAddForm: Dispatch<SetStateAction<QuickAddFormState>>
  quickAddEditingId: number | null
  /** L'opération en cours d'édition est liée à une règle récurrente active. */
  editingHasActiveRule: boolean
  handleQuickAddSubmit: (event: FormEvent<HTMLFormElement>) => void
  quickAddTouchedRef: MutableRefObject<{ category: boolean; tags: boolean }>
  scheduleQuickAddAi: (label: string) => void
  quickAddAiBusy: boolean
  quickAddAiApplied: boolean
  envelopeGroupsWithCustom: CategoryGroup[]
  isBudgetAiConfigured: boolean
  onConfigureAi: () => void
  quickAddDeleteAsk: boolean
  setQuickAddDeleteAsk: (ask: boolean) => void
  deleteTransaction: (id: number) => void
  formatMonth: (ym: string) => string
}

/** Modale d'ajout / modification rapide d'une opération (depuis le calendrier ou le hero). */
export function QuickAddModal(props: Props) {
  const {
    quickAddDate, setQuickAddDate, closeQuickAdd, quickAddForm, setQuickAddForm, quickAddEditingId,
    editingHasActiveRule, handleQuickAddSubmit, quickAddTouchedRef, scheduleQuickAddAi, quickAddAiBusy,
    quickAddAiApplied, envelopeGroupsWithCustom, isBudgetAiConfigured, onConfigureAi, quickAddDeleteAsk,
    setQuickAddDeleteAsk, deleteTransaction, formatMonth,
  } = props

  return (
      <div className="budget-actions-modal-overlay" onClick={closeQuickAdd}>
        <div
          className={`budget-actions-modal quick-add-modal quick-add-modal--${quickAddForm.kind}`}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="budget-actions-modal-close"
            onClick={closeQuickAdd}
            aria-label="Fermer"
          >
            ✕
          </button>
          <h3>
            {quickAddEditingId !== null
              ? (quickAddForm.kind === 'revenu' ? 'Modifier le revenu' : 'Modifier la dépense')
              : (quickAddForm.kind === 'revenu' ? 'Ajouter un revenu' : 'Ajouter une dépense')}{' '}
            — {new Date(`${quickAddDate}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <form onSubmit={handleQuickAddSubmit} className="quick-add-form">
            <div className="quick-add-kind" role="radiogroup" aria-label="Type d'opération">
              <button
                type="button"
                role="radio"
                aria-checked={quickAddForm.kind === 'depense'}
                className={`quick-add-kind__option${quickAddForm.kind === 'depense' ? ' quick-add-kind__option--active' : ''}`}
                onClick={() =>
                  setQuickAddForm((previous) => ({
                    ...previous,
                    kind: 'depense',
                    category: quickAddTouchedRef.current.category ? previous.category : 'Courses',
                  }))
                }
              >
                💸 Dépense
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={quickAddForm.kind === 'revenu'}
                className={`quick-add-kind__option${quickAddForm.kind === 'revenu' ? ' quick-add-kind__option--active' : ''}`}
                onClick={() =>
                  setQuickAddForm((previous) => ({
                    ...previous,
                    kind: 'revenu',
                    category: quickAddTouchedRef.current.category ? previous.category : 'Salaire',
                  }))
                }
              >
                💰 Revenu
              </button>
            </div>
            <label>
              <span>Libellé <span className="required-star" aria-hidden="true">*</span></span>
              <input
                value={quickAddForm.label}
                onChange={(event) => {
                  const label = event.target.value
                  setQuickAddForm((previous) => ({
                    ...previous,
                    label,
                    category: quickAddTouchedRef.current.category
                      ? previous.category
                      : suggestCategoryFromLabel(label) ?? previous.category,
                  }))
                  scheduleQuickAddAi(label)
                }}
                placeholder="Ex: Courses Carrefour"
                autoFocus
                required
              />
            </label>
            <div className="quick-add-selects">
              <label>
                <span>Montant (€) <span className="required-star" aria-hidden="true">*</span></span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={quickAddForm.amount}
                  onChange={(event) => setQuickAddForm((previous) => ({ ...previous, amount: event.target.value }))}
                  placeholder="Ex: 42,50"
                  required
                />
              </label>
              <label>
                <span>Date <span className="required-star" aria-hidden="true">*</span></span>
                <input
                  type="date"
                  value={quickAddDate}
                  onChange={(event) => {
                    if (event.target.value) setQuickAddDate(event.target.value)
                  }}
                  required
                />
              </label>
            </div>
            {quickAddForm.kind === 'depense' &&
            (Number(quickAddForm.amount.replace(',', '.')) >= 150 || quickAddForm.budgetMonth) ? (
              <label className="quick-add-budget-month">
                💡 Grosse dépense — la compter sur le budget d'un autre mois ?
                <select
                  value={quickAddForm.budgetMonth}
                  onChange={(event) =>
                    setQuickAddForm((previous) => ({ ...previous, budgetMonth: event.target.value }))
                  }
                >
                  <option value="">Non — sur le mois de la dépense</option>
                  {[shiftMonth(quickAddDate.slice(0, 7), 1), shiftMonth(quickAddDate.slice(0, 7), 2), shiftMonth(quickAddDate.slice(0, 7), -1)].map((m) => (
                    <option key={m} value={m}>Oui — budget de {formatMonth(m)}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="quick-add-selects">
              <label>
                Catégorie
                {quickAddAiBusy ? (
                  <small className="quick-add-hint"> ✨ analyse…</small>
                ) : quickAddAiApplied ? (
                  <small className="quick-add-hint"> ✨ suggéré par l'IA — modifiable</small>
                ) : null}
                <GroupedSearchSelect
                  value={quickAddForm.category}
                  groups={quickAddForm.kind === 'revenu' ? INCOME_CATEGORY_GROUPS : EXPENSE_CATEGORY_GROUPS}
                  onChange={(category) => {
                    quickAddTouchedRef.current.category = true
                    setQuickAddForm((previous) => ({ ...previous, category }))
                  }}
                  selectAriaLabel="Catégorie"
                  customPlaceholder="Votre catégorie…"
                />
              </label>
              <label>
                Poche
                <GroupedSearchSelect
                  value={quickAddForm.envelope}
                  groups={envelopeGroupsWithCustom}
                  onChange={(envelope) => setQuickAddForm((previous) => ({ ...previous, envelope }))}
                  selectAriaLabel="Poche"
                  customPlaceholder="Votre poche…"
                />
              </label>
            </div>
            <label>
              Tags <small className="quick-add-hint">(optionnel, séparés par des virgules)</small>
              <input
                value={quickAddForm.tags}
                onChange={(event) => {
                  quickAddTouchedRef.current.tags = true
                  setQuickAddForm((previous) => ({ ...previous, tags: event.target.value }))
                }}
                placeholder="Ex: vacances, remboursable"
              />
            </label>
            {!isBudgetAiConfigured ? (
              <button
                type="button"
                className="quick-add-ai-nudge"
                onClick={onConfigureAi}
              >
                ✨ Besoin d'aller plus vite ? Configurez votre assistant IA pour trouver
                automatiquement la catégorie et les tags de vos dépenses.
              </button>
            ) : null}
            <label>
                Répéter
                <select
                  value={quickAddForm.recurrence}
                  onChange={(event) =>
                    setQuickAddForm((previous) => ({
                      ...previous,
                      recurrence: event.target.value as 'none' | RecurringFrequency,
                    }))
                  }
                >
                  <option value="none">
                    {editingHasActiveRule ? 'Ne plus répéter' : 'Jamais (opération unique)'}
                  </option>
                  <option value="weekly">Chaque semaine</option>
                  <option value="monthly">Chaque mois</option>
                  <option value="quarterly">Chaque trimestre</option>
                  <option value="yearly">Chaque année</option>
                </select>
              </label>
            <p className="quick-add-required-note">
              <span className="required-star" aria-hidden="true">*</span> Champs obligatoires pour enregistrer.
            </p>
            {quickAddEditingId !== null && quickAddDeleteAsk ? (
              <div className="quick-add-delete-confirm" role="alertdialog" aria-label="Confirmer la suppression">
                <span>Supprimer définitivement cette opération ?</span>
                <div>
                  <button
                    type="button"
                    className="quick-add-delete-yes"
                    onClick={() => {
                      deleteTransaction(quickAddEditingId)
                      closeQuickAdd()
                    }}
                  >
                    Oui, supprimer
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setQuickAddDeleteAsk(false)}>
                    Non, garder
                  </button>
                </div>
              </div>
            ) : null}
            <div className="quick-add-actions">
              {quickAddEditingId !== null && !quickAddDeleteAsk ? (
                <button
                  type="button"
                  className="quick-add-delete-btn"
                  onClick={() => setQuickAddDeleteAsk(true)}
                >
                  🗑️ Supprimer
                </button>
              ) : null}
              <button type="button" className="ghost-button" onClick={closeQuickAdd}>
                Annuler
              </button>
              <button type="submit" className="hero-cta-button">
                {quickAddEditingId !== null ? 'Enregistrer' : 'Ajouter la dépense'}
              </button>
            </div>
          </form>
        </div>
      </div>
  )
}
