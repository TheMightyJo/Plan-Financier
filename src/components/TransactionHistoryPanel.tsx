import { useMemo, useState, type FormEvent } from 'react'
import { Search, X, Pencil, Trash2, Download, Filter } from 'lucide-react'
import type {
  Account,
  Category,
  Envelope,
  FamilyMember,
  Transaction,
  TransactionKind,
} from '../types'
import { categories, categoryColors, envelopes, inferEnvelope } from '../lib/categories'
import {
  aggregateFilteredStats,
  defaultCriteria,
  filterTransactions,
  sortTransactions,
  transactionsToCsv,
  type PeriodKind,
  type TransactionFilterCriteria,
  type TxSortField,
} from '../lib/transactionFilters'

type Props = {
  transactions: Transaction[]
  accounts: Account[]
  member: FamilyMember
  onChange: (next: Transaction[]) => void
  onClose: () => void
}

type EditState = {
  id: number
  label: string
  amount: string
  category: Category
  envelope: Envelope
  kind: TransactionKind
  date: string
  accountId: string
}

const PERIOD_LABELS: Record<PeriodKind, string> = {
  all: 'Tout',
  month: 'Mois',
  quarter: '3 derniers mois',
  year: 'Année',
  custom: 'Personnalisé',
}

const SORT_LABELS: Record<TxSortField, string> = {
  date_desc: 'Date ↓',
  date_asc: 'Date ↑',
  amount_desc: 'Montant ↓',
  amount_asc: 'Montant ↑',
}

const euro = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

const todayIso = () => new Date().toISOString().slice(0, 10)

const txToEdit = (tx: Transaction): EditState => ({
  id: tx.id,
  label: tx.label,
  amount: String(tx.amount),
  category: tx.category,
  envelope: tx.envelope,
  kind: tx.kind,
  date: tx.date,
  accountId: tx.accountId ?? '',
})

export function TransactionHistoryPanel({
  transactions,
  accounts,
  member,
  onChange,
  onClose,
}: Props) {
  const [criteria, setCriteria] = useState<TransactionFilterCriteria>(() => ({
    ...defaultCriteria(member),
  }))
  const [sortField, setSortField] = useState<TxSortField>('date_desc')
  const [edit, setEdit] = useState<EditState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const memberAccounts = useMemo(
    () => accounts.filter((a) => a.ownerMember === member),
    [accounts, member],
  )
  const accountsById = useMemo(() => {
    const map = new Map<string, Account>()
    for (const a of accounts) map.set(a.id, a)
    return map
  }, [accounts])

  const filtered = useMemo(
    () => sortTransactions(filterTransactions(transactions, criteria), sortField),
    [transactions, criteria, sortField],
  )
  const stats = useMemo(() => aggregateFilteredStats(filtered), [filtered])

  const updateCriteria = (patch: Partial<TransactionFilterCriteria>) =>
    setCriteria((previous) => ({ ...previous, ...patch }))

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!edit) return
    const amountNum = Number(edit.amount)
    if (!edit.label.trim() || !amountNum || amountNum <= 0) return

    const updated: Transaction = {
      id: edit.id,
      label: edit.label.trim(),
      amount: amountNum,
      category: edit.category,
      envelope: edit.envelope,
      kind: edit.kind,
      member,
      date: edit.date,
      accountId: edit.accountId || undefined,
    }
    onChange(transactions.map((t) => (t.id === edit.id ? updated : t)))
    setEdit(null)
  }

  const handleDelete = (id: number) => {
    onChange(transactions.filter((t) => t.id !== id))
    setConfirmDeleteId(null)
    if (edit?.id === id) setEdit(null)
  }

  const handleExportCsv = () => {
    const csv = transactionsToCsv(filtered, accountsById)
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${todayIso()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="tx-history-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Historique des transactions"
    >
      <div className="tx-history-modal glass-card">
        <header className="tx-history-header">
          <div>
            <span className="eyebrow">
              <Filter size={12} aria-hidden="true" /> Historique
            </span>
            <h2>Toutes vos transactions</h2>
            <p className="tx-history-subtitle">
              Recherche, filtres, édition et suppression sur l'ensemble de votre historique.
            </p>
          </div>
          <button
            type="button"
            className="tx-history-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </header>

        <section className="tx-history-stats">
          <div>
            <span>Résultats</span>
            <strong>{stats.count}</strong>
          </div>
          <div>
            <span>Revenus</span>
            <strong className="is-positive">{euro.format(stats.income)}</strong>
          </div>
          <div>
            <span>Dépenses</span>
            <strong className="is-negative">{euro.format(stats.expense)}</strong>
          </div>
          <div>
            <span>Net</span>
            <strong className={stats.net >= 0 ? 'is-positive' : 'is-negative'}>
              {euro.format(stats.net)}
            </strong>
          </div>
        </section>

        <section className="tx-history-filters">
          <label className="tx-history-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              placeholder="Rechercher (libellé, catégorie, enveloppe…)"
              value={criteria.search}
              onChange={(e) => updateCriteria({ search: e.target.value })}
            />
          </label>

          <div className="tx-history-filters-row">
            <select
              value={criteria.kind}
              onChange={(e) =>
                updateCriteria({ kind: e.target.value as TransactionKind | 'all' })
              }
              aria-label="Type"
            >
              <option value="all">Tous types</option>
              <option value="depense">Dépenses</option>
              <option value="revenu">Revenus</option>
            </select>

            <select
              value={criteria.category}
              onChange={(e) =>
                updateCriteria({ category: e.target.value as Category | 'all' })
              }
              aria-label="Catégorie"
            >
              <option value="all">Toutes catégories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={criteria.envelope}
              onChange={(e) =>
                updateCriteria({ envelope: e.target.value as Envelope | 'all' })
              }
              aria-label="Enveloppe"
            >
              <option value="all">Toutes enveloppes</option>
              {envelopes.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>

            <select
              value={criteria.accountId}
              onChange={(e) => updateCriteria({ accountId: e.target.value })}
              aria-label="Compte"
            >
              <option value="all">Tous comptes</option>
              {memberAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>

            <select
              value={criteria.period}
              onChange={(e) => updateCriteria({ period: e.target.value as PeriodKind })}
              aria-label="Période"
            >
              {(Object.entries(PERIOD_LABELS) as Array<[PeriodKind, string]>).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as TxSortField)}
              aria-label="Tri"
            >
              {(Object.entries(SORT_LABELS) as Array<[TxSortField, string]>).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="ghost-button tx-history-export"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              title="Exporter le résultat filtré en CSV"
            >
              <Download size={14} /> CSV
            </button>
          </div>

          {criteria.period === 'custom' ? (
            <div className="tx-history-custom-range">
              <label>
                <span>Du</span>
                <input
                  type="date"
                  value={criteria.customFrom ?? ''}
                  onChange={(e) => updateCriteria({ customFrom: e.target.value })}
                />
              </label>
              <label>
                <span>Au</span>
                <input
                  type="date"
                  value={criteria.customTo ?? ''}
                  onChange={(e) => updateCriteria({ customTo: e.target.value })}
                />
              </label>
            </div>
          ) : null}
        </section>

        <section className="tx-history-list-wrap">
          {filtered.length === 0 ? (
            <p className="tx-history-empty">
              Aucune transaction ne correspond à ces critères.
            </p>
          ) : (
            <ul className="tx-history-list">
              {filtered.map((item) => {
                const account = item.accountId ? accountsById.get(item.accountId) : null
                const isEditing = edit?.id === item.id
                const isConfirming = confirmDeleteId === item.id

                if (isEditing && edit) {
                  return (
                    <li key={item.id} className="tx-history-item is-editing">
                      <form onSubmit={handleEditSubmit} className="tx-history-edit">
                        <input
                          type="text"
                          value={edit.label}
                          onChange={(e) => setEdit({ ...edit, label: e.target.value })}
                          aria-label="Libellé"
                          autoFocus
                        />
                        <div className="tx-history-edit-row">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={edit.amount}
                            onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
                            aria-label="Montant"
                          />
                          <select
                            value={edit.kind}
                            onChange={(e) =>
                              setEdit({ ...edit, kind: e.target.value as TransactionKind })
                            }
                            aria-label="Type"
                          >
                            <option value="depense">Dépense</option>
                            <option value="revenu">Revenu</option>
                          </select>
                          <input
                            type="date"
                            value={edit.date}
                            onChange={(e) => setEdit({ ...edit, date: e.target.value })}
                            aria-label="Date"
                          />
                        </div>
                        <div className="tx-history-edit-row">
                          <select
                            value={edit.category}
                            onChange={(e) => {
                              const next = e.target.value as Category
                              setEdit({ ...edit, category: next, envelope: inferEnvelope(next) })
                            }}
                            aria-label="Catégorie"
                          >
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <select
                            value={edit.envelope}
                            onChange={(e) =>
                              setEdit({ ...edit, envelope: e.target.value as Envelope })
                            }
                            aria-label="Enveloppe"
                          >
                            {envelopes.map((e) => (
                              <option key={e} value={e}>
                                {e}
                              </option>
                            ))}
                          </select>
                          <select
                            value={edit.accountId}
                            onChange={(e) => setEdit({ ...edit, accountId: e.target.value })}
                            aria-label="Compte"
                          >
                            <option value="">— sans compte —</option>
                            {memberAccounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="tx-history-edit-actions">
                          <button type="submit" className="hero-cta-button">
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => setEdit(null)}
                          >
                            Annuler
                          </button>
                        </div>
                      </form>
                    </li>
                  )
                }

                return (
                  <li
                    key={item.id}
                    className={`tx-history-item${isConfirming ? ' is-confirming' : ''}`}
                  >
                    <span
                      className="tx-history-color-dot"
                      style={{ background: categoryColors[item.category] }}
                      aria-hidden="true"
                    />
                    <div className="tx-history-main">
                      <strong>{item.label}</strong>
                      <span className="tx-history-meta">
                        {item.date} · {item.category} · {item.envelope}
                        {account ? ` · ${account.name}` : ''}
                      </span>
                    </div>
                    <span
                      className={`tx-history-amount ${
                        item.kind === 'depense' ? 'is-negative' : 'is-positive'
                      }`}
                    >
                      {item.kind === 'depense' ? '-' : '+'}
                      {euro.format(item.amount)}
                    </span>
                    {isConfirming ? (
                      <div className="tx-history-confirm">
                        <span>Supprimer ?</span>
                        <button
                          type="button"
                          className="tx-history-confirm-yes"
                          onClick={() => handleDelete(item.id)}
                        >
                          Oui
                        </button>
                        <button
                          type="button"
                          className="tx-history-confirm-no"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Non
                        </button>
                      </div>
                    ) : (
                      <div className="tx-history-actions">
                        <button
                          type="button"
                          onClick={() => setEdit(txToEdit(item))}
                          aria-label="Modifier"
                          title="Modifier"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          aria-label="Supprimer"
                          title="Supprimer"
                          className="tx-history-delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
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
