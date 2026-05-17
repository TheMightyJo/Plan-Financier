import { useEffect, useState, type FormEvent } from 'react'
import { X, User, Mail, Save } from 'lucide-react'
import { supabase } from '../supabase'
import { logAuditEvent } from '../lib/auditLog'

type Props = {
  userEmail: string
  onEmailChanged: (newEmail: string) => void
  onClose: () => void
}

/**
 * Panel Profil : exercice du droit de rectification (Art. 16 RGPD).
 * - display_name : update sur public.profiles (RLS profiles_update_own)
 * - email : supabase.auth.updateUser({ email }) → envoie un email de
 *   confirmation à l'ancien ET au nouveau ; le changement est effectif
 *   après confirmation côté Supabase.
 */
export function ProfilePanel({ userEmail, onEmailChanged, onClose }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [initialDisplayName, setInitialDisplayName] = useState('')
  const [email, setEmail] = useState(userEmail)
  const [loading, setLoading] = useState(false)
  const [savingDisplay, setSavingDisplay] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) {
        if (!cancelled) {
          setError("Session expirée. Reconnectez-vous.")
          setLoading(false)
        }
        return
      }
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', userId)
        .maybeSingle()

      if (cancelled) return
      if (profileError) {
        setError("Impossible de charger votre profil. Réessayez.")
      } else {
        const name = (data?.display_name as string | undefined) ?? ''
        setDisplayName(name)
        setInitialDisplayName(name)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSaveDisplayName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    if (displayName.trim().length === 0) {
      setError('Le nom d\'affichage ne peut pas être vide.')
      return
    }
    setSavingDisplay(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user.id
    if (!userId) {
      setError("Session expirée. Reconnectez-vous.")
      setSavingDisplay(false)
      return
    }
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('user_id', userId)

    if (updateError) {
      setError("Mise à jour échouée : " + updateError.message)
    } else {
      setInitialDisplayName(displayName.trim())
      setSuccess('Nom d\'affichage mis à jour.')
      await logAuditEvent('profile_update', {
        metadata: { field: 'display_name' },
      })
    }
    setSavingDisplay(false)
  }

  const handleSaveEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const trimmed = email.trim()
    if (trimmed === userEmail) {
      setError('Le nouvel email est identique à l\'actuel.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Adresse email invalide.')
      return
    }

    setSavingEmail(true)
    const { error: updateError } = await supabase.auth.updateUser({
      email: trimmed,
    })

    if (updateError) {
      setError("Mise à jour échouée : " + updateError.message)
    } else {
      setSuccess(
        `Un email de confirmation a été envoyé à ${trimmed} ET à votre ancienne adresse. Cliquez sur les deux liens pour valider le changement.`,
      )
      await logAuditEvent('email_change_requested', {
        metadata: { from: userEmail, to: trimmed },
      })
      onEmailChanged(trimmed)
    }
    setSavingEmail(false)
  }

  const displayNameDirty = displayName.trim() !== initialDisplayName

  return (
    <div
      className="profile-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Mon profil"
    >
      <div className="profile-modal glass-card">
        <header className="profile-header">
          <div>
            <span className="eyebrow">
              <User size={12} aria-hidden="true" /> Profil
            </span>
            <h2>Mes informations</h2>
            <p className="profile-subtitle">
              Modifiez votre nom d'affichage et votre email. Le changement
              d'email nécessite une double confirmation par email (ancienne
              et nouvelle adresse).
            </p>
          </div>
          <button
            type="button"
            className="profile-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </header>

        {error ? <p className="profile-error">{error}</p> : null}
        {success ? <p className="profile-success">{success}</p> : null}

        <section className="profile-section">
          <h3>Nom d'affichage</h3>
          <form className="profile-form" onSubmit={handleSaveDisplayName}>
            <label>
              <span>Nom affiché dans l'app</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex : Marie, Famille Dupont…"
                autoComplete="off"
                disabled={loading || savingDisplay}
              />
            </label>
            <div className="profile-form-actions">
              <button
                type="submit"
                className="hero-cta-button"
                disabled={!displayNameDirty || savingDisplay || loading}
              >
                <Save size={14} />
                {savingDisplay ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </section>

        <section className="profile-section">
          <h3>Adresse email</h3>
          <p className="profile-section-help">
            Email actuel : <strong>{userEmail}</strong>. Le changement requiert
            une confirmation via les deux adresses (ancienne + nouvelle).
          </p>
          <form className="profile-form" onSubmit={handleSaveEmail}>
            <label>
              <span>Nouvelle adresse email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nouveau@email.com"
                autoComplete="email"
                disabled={savingEmail}
              />
            </label>
            <div className="profile-form-actions">
              <button
                type="submit"
                className="hero-cta-button"
                disabled={email.trim() === userEmail || savingEmail}
              >
                <Mail size={14} />
                {savingEmail ? 'Envoi…' : 'Demander le changement'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
