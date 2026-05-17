import { useState, type FormEvent } from 'react'
import { X, Download, Trash2, ShieldAlert, FileText } from 'lucide-react'
import type { Account, RecurringRule, SavingsTarget, Transaction } from '../types'
import { supabase } from '../supabase'
import { logAuditEvent } from '../lib/auditLog'
import { verifyParentPin } from '../security'

type Props = {
  userEmail: string
  transactions: Transaction[]
  accounts: Account[]
  recurringRules: RecurringRule[]
  savingsGoals: SavingsTarget[]
  onAccountDeleted: () => void
  onOpenPrivacy: () => void
  onOpenTerms: () => void
  onClose: () => void
}

/**
 * Panel RGPD : exercise des droits d'accès (Art. 15), portabilité (Art. 20),
 * et effacement (Art. 17).
 *
 * V1 limitations explicites (signalées à l'utilisateur) :
 * - Export = JSON complet local (toutes les entités), pas de ZIP serveur
 * - Suppression compte = côté client uniquement : signOut + purge localStorage.
 *   La row Supabase Auth (auth.users) doit être supprimée par l'admin via
 *   service_role (Edge Function `delete-my-account` prévue en V2).
 */
export function PrivacyPanel({
  userEmail,
  transactions,
  accounts,
  recurringRules,
  savingsGoals,
  onAccountDeleted,
  onOpenPrivacy,
  onOpenTerms,
  onClose,
}: Props) {
  const [confirmStep, setConfirmStep] = useState<'idle' | 'confirming'>('idle')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        userEmail,
        appVersion: '1.0',
        format: 'plan-financier-rgpd-export-v1',
      },
      data: {
        transactions,
        accounts,
        recurringRules,
        savingsGoals,
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plan-financier-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    await logAuditEvent('export', {
      metadata: {
        kind: 'gdpr_full',
        counts: {
          transactions: transactions.length,
          accounts: accounts.length,
          recurringRules: recurringRules.length,
          savingsGoals: savingsGoals.length,
        },
      },
    })
  }

  const handleConfirmDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (confirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()) {
      setError('L\'email ne correspond pas à votre compte.')
      return
    }
    const pinOk = await verifyParentPin(confirmPin)
    if (!pinOk) {
      setError('PIN parent incorrect.')
      return
    }

    setDeleting(true)

    // 1. Logger la demande d'effacement AVANT de signOut (sinon plus de session)
    await logAuditEvent('erase_request', {
      metadata: {
        scope: 'full_v1.1',
        edgeFunction: 'delete-my-account',
      },
    })

    // 2. Insérer une demande RGPD pour traçabilité côté serveur (la table
    //    rgpd_requests est insert-RLS pour le user). L'Edge Function la
    //    marquera comme 'completed' après suppression effective.
    try {
      await supabase.from('rgpd_requests').insert({
        kind: 'erase',
        status: 'pending',
      })
    } catch {
      // Best-effort, ne bloque pas la suite
    }

    // 3. Appel Edge Function pour suppression effective (auth.users + CASCADE)
    //    On capture le résultat pour informer l'utilisateur si l'Edge n'est
    //    pas déployée (fallback "demande enregistrée, traitement sous 30j").
    let edgeSuccess = false
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'delete-my-account',
        { method: 'POST' },
      )
      if (!invokeError && (data as { deleted?: boolean })?.deleted) {
        edgeSuccess = true
      }
    } catch {
      // Edge non déployée → fallback déjà géré par rgpd_requests
    }

    // 4. Purger le localStorage de toutes les clés Plan Financier
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i)
        if (key && key.startsWith('plan-financier-')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k))
    }

    // 5. SignOut Supabase (revoke session active)
    await supabase.auth.signOut()

    if (!edgeSuccess) {
      // Le user n'a pas de feedback visuel particulier ici : la session est
      // déjà coupée, on retourne à l'AuthScreen. La demande rgpd_requests
      // assure la traçabilité, l'éditeur traite sous 30j.
      console.warn(
        '[privacy] Edge Function delete-my-account indisponible, fallback rgpd_requests',
      )
    }

    onAccountDeleted()
  }

  return (
    <div
      className="privacy-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Mes données RGPD"
    >
      <div className="privacy-modal glass-card">
        <header className="privacy-header">
          <div>
            <span className="eyebrow">
              <ShieldAlert size={12} aria-hidden="true" /> Mes données RGPD
            </span>
            <h2>Vos droits, votre contrôle</h2>
            <p className="privacy-subtitle">
              Exercer vos droits d'accès, de portabilité et d'effacement
              prévus par le règlement européen sur les données personnelles.
            </p>
          </div>
          <button
            type="button"
            className="privacy-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </header>

        <section className="privacy-section">
          <h3>Documents légaux</h3>
          <p className="privacy-section-help">
            À consulter avant tout export ou suppression.
          </p>
          <div className="privacy-actions">
            <button type="button" className="ghost-button" onClick={onOpenPrivacy}>
              <FileText size={14} /> Politique de confidentialité
            </button>
            <button type="button" className="ghost-button" onClick={onOpenTerms}>
              <FileText size={14} /> Conditions d'utilisation
            </button>
          </div>
        </section>

        <section className="privacy-section">
          <h3>Exporter mes données (Art. 15 + 20 RGPD)</h3>
          <p className="privacy-section-help">
            Téléchargez un fichier JSON contenant <strong>toutes</strong> vos
            données métier : comptes ({accounts.length}), transactions{' '}
            ({transactions.length}), règles récurrentes ({recurringRules.length}),
            objectifs ({savingsGoals.length}). Format lisible par tout autre
            outil compatible JSON.
          </p>
          <div className="privacy-actions">
            <button type="button" className="hero-cta-button" onClick={handleExport}>
              <Download size={14} /> Télécharger mes données (JSON)
            </button>
          </div>
        </section>

        <section className="privacy-section privacy-section--danger">
          <h3>Supprimer mon compte (Art. 17 RGPD)</h3>
          <p className="privacy-section-help">
            <strong>Cette action est irréversible.</strong> Toutes vos données
            métier locales (transactions, comptes, objectifs, paramètres) seront
            effacées de cet appareil immédiatement, et votre session sera
            fermée. <br />
            <em>
              Note V1 : la suppression complète de votre compte côté serveur
              (auth.users) sera traitée par l'éditeur sous 30 jours conformément
              au RGPD. Une demande d'effacement est créée automatiquement.
            </em>
          </p>

          {confirmStep === 'idle' ? (
            <div className="privacy-actions">
              <button
                type="button"
                className="privacy-danger-btn"
                onClick={() => setConfirmStep('confirming')}
              >
                <Trash2 size={14} /> Supprimer mon compte
              </button>
            </div>
          ) : (
            <form className="privacy-confirm-form" onSubmit={handleConfirmDelete}>
              <label>
                <span>
                  Pour confirmer, saisissez votre email <strong>{userEmail}</strong>
                </span>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={userEmail}
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                <span>Et votre PIN parent</span>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="••••"
                  autoComplete="off"
                  required
                />
              </label>

              {error ? <p className="privacy-error">{error}</p> : null}

              <div className="privacy-confirm-actions">
                <button
                  type="submit"
                  className="privacy-danger-btn"
                  disabled={deleting}
                >
                  {deleting ? 'Suppression…' : 'Confirmer la suppression'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setConfirmStep('idle')
                    setConfirmEmail('')
                    setConfirmPin('')
                    setError(null)
                  }}
                  disabled={deleting}
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
