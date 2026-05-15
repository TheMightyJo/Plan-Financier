import { useState, type FormEvent } from 'react'
import { Pencil, Trash2, Archive, ArchiveRestore, Plus, X, Wallet } from 'lucide-react'
import type { Account, AccountType, FamilyMember, Transaction } from '../types'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from '../types'
import {
  ACCOUNT_DEFAULT_COLORS,
  computeAccountBalance,
  computeConsolidatedBalance,
  validateAccount,
} from '../lib/accounts'
import { archiveAccount, buildAccount, removeAccount, upsertAccount } from '../repos/accountsRepo'

type Props = {
  accounts: Account[]
  transactions: Transaction[]
  onChange: (next: Account[]) => void
  member: FamilyMember
  onClose: () => void
}

type FormState = {
  id: string | null
  name: string
  type: AccountType
  initialBalance: string
  displayColor: string
}

const VALIDATION_MESSAGES = {
  name_required: 'Donnez un nom au compte (ex : Compte courant Crédit Mutuel).',
  invalid_type: 'Type de compte invalide.',
  initial_balance_must_be_finite: 'Le solde d’ouverture doit être un nombre valide.',
} as const

const emptyForm = (): FormState => ({
  id: null,
  name: '',
  type: 'checking',
  initialBalance: '0',
  displayColor: ACCOUNT_DEFAULT_COLORS.checking,
})

const accountToForm = (account: Account): FormState => ({
  id: account.id,
  name: account.name,
  type: account.type,
  initialBalance: String(account.initialBalance),
  displayColor: account.displayColor ?? ACCOUNT_DEFAULT_COLORS[account.type],
})

const euro = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

export function AccountsPanel({ accounts, transactions, onChange, member, onClose }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const memberAccounts = accounts.filter((a) => a.ownerMember === member)
  const consolidated = computeConsolidatedBalance(accounts, transactions, member)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const payload = {
      ownerMember: member,
      name: form.name.trim(),
      type: form.type,
      currency: 'EUR',
      initialBalance: Number(form.initialBalance),
      displayColor: form.displayColor || null,
    }
    const validation = validateAccount(payload)
    if (validation) {
      setError(VALIDATION_MESSAGES[validation])
      return
    }

    if (form.id) {
      const existing = accounts.find((a) => a.id === form.id)
      if (!existing) return
      onChange(upsertAccount(accounts, { ...existing, ...payload }))
    } else {
      onChange(upsertAccount(accounts, buildAccount(payload)))
    }

    setForm(emptyForm())
    setEditing(false)
  }

  const handleEdit = (account: Account) => {
    setForm(accountToForm(account))
    setEditing(true)
    setError(null)
  }

  const handleCancel = () => {
    setForm(emptyForm())
    setEditing(false)
    setError(null)
  }

  const handleDelete = (id: string) => {
    const hasTransactions = transactions.some((t) => t.accountId === id)
    if (hasTransactions) {
      setError(
        "Ce compte contient des transactions. Archivez-le plutôt que de le supprimer (les transactions seraient orphelines).",
      )
      return
    }
    onChange(removeAccount(accounts, id))
    if (form.id === id) handleCancel()
  }

  const handleArchive = (id: string) => {
    onChange(archiveAccount(accounts, id))
  }

  return (
    <div
      className="accounts-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Gérer les comptes"
    >
      <div className="accounts-modal glass-card">
        <header className="accounts-header">
          <div>
            <span className="eyebrow">
              <Wallet size={12} aria-hidden="true" /> Comptes
            </span>
            <h2>Vos comptes</h2>
            <p className="accounts-subtitle">
              Compte courant, livret A, espèces, investissements… Chaque transaction est imputée à
              un compte. Le solde consolidé apparaît en haut.
            </p>
          </div>
          <button
            type="button"
            className="accounts-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </header>

        <section className="accounts-summary">
          <span className="accounts-summary-label">Solde total ({memberAccounts.filter((a) => a.archivedAt === null).length} comptes actifs)</span>
          <strong className={consolidated >= 0 ? 'is-positive' : 'is-negative'}>
            {euro.format(consolidated)}
          </strong>
        </section>

        <section className="accounts-section">
          <h3>{editing ? 'Modifier le compte' : 'Nouveau compte'}</h3>
          <form className="accounts-form" onSubmit={handleSubmit}>
            <label>
              <span>Nom</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Compte courant Crédit Mutuel, Livret A, PEA…"
                autoComplete="off"
              />
            </label>

            <div className="accounts-form-row">
              <label>
                <span>Type</span>
                <select
                  value={form.type}
                  onChange={(e) => {
                    const next = e.target.value as AccountType
                    setForm((p) => ({
                      ...p,
                      type: next,
                      displayColor:
                        p.displayColor === ACCOUNT_DEFAULT_COLORS[p.type]
                          ? ACCOUNT_DEFAULT_COLORS[next]
                          : p.displayColor,
                    }))
                  }}
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ACCOUNT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Solde d'ouverture (€)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.initialBalance}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, initialBalance: e.target.value }))
                  }
                />
              </label>
            </div>

            <label className="accounts-form-color">
              <span>Couleur</span>
              <input
                type="color"
                value={form.displayColor}
                onChange={(e) => setForm((p) => ({ ...p, displayColor: e.target.value }))}
              />
            </label>

            {error ? <p className="accounts-error">{error}</p> : null}

            <div className="accounts-form-actions">
              <button type="submit" className="hero-cta-button">
                <Plus size={16} />
                {editing ? 'Mettre à jour' : 'Ajouter le compte'}
              </button>
              {editing ? (
                <button type="button" className="ghost-button" onClick={handleCancel}>
                  Annuler
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="accounts-section">
          <h3>Comptes existants ({memberAccounts.length})</h3>
          {memberAccounts.length === 0 ? (
            <p className="accounts-empty">
              Aucun compte. Ajoutez votre premier compte courant ci-dessus pour commencer.
            </p>
          ) : (
            <ul className="accounts-list">
              {memberAccounts.map((account) => {
                const balance = computeAccountBalance(account, transactions)
                const isArchived = account.archivedAt !== null
                return (
                  <li
                    key={account.id}
                    className={`account-item${isArchived ? ' is-archived' : ''}`}
                  >
                    <span
                      className="account-color-dot"
                      style={{ background: account.displayColor ?? ACCOUNT_DEFAULT_COLORS[account.type] }}
                      aria-hidden="true"
                    />
                    <div className="account-item-main">
                      <strong>{account.name}</strong>
                      <span className="account-item-meta">
                        {ACCOUNT_TYPE_LABELS[account.type]}
                        {isArchived ? ' · archivé' : ''}
                      </span>
                    </div>
                    <span
                      className={`account-balance ${balance >= 0 ? 'is-positive' : 'is-negative'}`}
                    >
                      {euro.format(balance)}
                    </span>
                    <div className="account-item-actions">
                      <button
                        type="button"
                        onClick={() => handleArchive(account.id)}
                        aria-label={isArchived ? 'Restaurer' : 'Archiver'}
                        title={isArchived ? 'Restaurer' : 'Archiver'}
                      >
                        {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(account)}
                        aria-label="Modifier"
                        title="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(account.id)}
                        aria-label="Supprimer"
                        title="Supprimer (impossible si transactions liées)"
                        className="account-delete"
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
