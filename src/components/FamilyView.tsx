import { useEffect, useMemo, useState } from 'react'
import { listFamilyTransactions, type FamilyPeer, type FamilyTransaction } from '../repos/familyRepo'
import { euroFormatter } from '../lib/format'
import { categoryColors } from '../lib/categories'
import { avatarColor, avatarInitials } from '../lib/avatar'

type Props = {
  /** Mois affiché (YYYY-MM), piloté par le sélecteur global. */
  month: string
  /** Membres acceptés de la famille (moi inclus). */
  peers: FamilyPeer[]
  /** Mon user id Supabase (pour marquer « Moi »). */
  myUserId: string
}

/**
 * Vue « Famille » : budgets et dépenses des comptes reliés, fusionnés en
 * lecture. Chacun continue de saisir dans son propre compte ; cette vue
 * additionne et étiquette par personne.
 */
export function FamilyView({ month, peers, myUserId }: Props) {
  const [transactions, setTransactions] = useState<FamilyTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // Indicateur de chargement au (re)fetch — pattern volontaire.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    void listFamilyTransactions().then((rows) => {
      if (cancelled) return
      setTransactions(rows)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [peers.length])

  const peerName = useMemo(() => {
    const map = new Map(peers.map((peer) => [peer.userId, peer.displayName]))
    return (userId: string) =>
      userId === myUserId ? 'Moi' : map.get(userId) ?? 'Membre'
  }, [peers, myUserId])

  const monthTransactions = useMemo(
    () => transactions.filter((tx) => tx.date.startsWith(month)),
    [transactions, month],
  )

  const totals = useMemo(() => {
    const byPerson = new Map<string, { spent: number; income: number }>()
    let spent = 0
    let income = 0
    for (const tx of monthTransactions) {
      const entry = byPerson.get(tx.ownerUserId) ?? { spent: 0, income: 0 }
      if (tx.kind === 'depense') {
        entry.spent += tx.amount
        spent += tx.amount
      } else {
        entry.income += tx.amount
        income += tx.amount
      }
      byPerson.set(tx.ownerUserId, entry)
    }
    return { spent, income, byPerson }
  }, [monthTransactions])

  const visibleTransactions = monthTransactions.slice(0, 40)

  return (
    <section className="glass-card family-view" aria-label="Vue famille">
      <div className="panel-title">
        <h2>👨‍👩‍👧 Famille</h2>
        <p>
          Les budgets de {peers.length} compte{peers.length > 1 ? 's' : ''} reliés, fusionnés.
          Chacun garde la main sur ses propres dépenses.
        </p>
      </div>

      <div className="family-members-row">
        {peers.map((peer) => {
          const entry = totals.byPerson.get(peer.userId)
          return (
            <div key={peer.userId} className="family-member-chip">
              <span className="member-avatar" style={{ background: avatarColor(peer.userId) }} aria-hidden="true">
                {avatarInitials(peer.displayName)}
              </span>
              <div>
                <strong>{peerName(peer.userId)}</strong>
                <small>−{euroFormatter.format(entry?.spent ?? 0)}</small>
              </div>
            </div>
          )
        })}
      </div>

      <div className="family-totals">
        <div>
          <span>Dépensé ensemble ce mois</span>
          <strong className="month-summary-spent">−{euroFormatter.format(totals.spent)}</strong>
        </div>
        <div>
          <span>Reçu ensemble</span>
          <strong className="month-summary-income">+{euroFormatter.format(totals.income)}</strong>
        </div>
      </div>

      {loading ? (
        <p className="auth-note">Chargement des dépenses de la famille…</p>
      ) : visibleTransactions.length === 0 ? (
        <p className="auth-note">
          Aucune opération ce mois-ci. Les dépenses de chaque membre apparaissent ici dès
          qu'elles sont synchronisées.
        </p>
      ) : (
        <ul className="recent-tx-list family-tx-list">
          {visibleTransactions.map((tx) => (
            <li key={`${tx.ownerUserId}-${tx.id}`}>
              <span
                className="member-avatar member-avatar--tiny"
                style={{ background: avatarColor(tx.ownerUserId) }}
                title={peerName(tx.ownerUserId)}
                aria-label={peerName(tx.ownerUserId)}
              >
                {avatarInitials(peerName(tx.ownerUserId))}
              </span>
              <span className="recent-tx-dot" style={{ background: categoryColors[tx.category] }} aria-hidden="true" />
              <span className="recent-tx-label">{tx.label}</span>
              <span className="recent-tx-meta">
                {new Date(`${tx.date}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · {tx.category}
              </span>
              <span className={`recent-tx-amount recent-tx-amount--${tx.kind}`}>
                {tx.kind === 'depense' ? '−' : '+'}{euroFormatter.format(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
