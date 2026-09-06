import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'
import { Plus } from 'lucide-react'
import type { Transaction, UserProfile } from '../../types'
import { euroFormatter } from '../../lib/format'
import { MONEY_AVATAR_PRESETS } from '../../lib/avatar'
import { InfoHint } from '../InfoHint'
import type { SentInvite } from '../../repos/familyRepo'

type Props = {
  profiles: UserProfile[]
  managedProfile: UserProfile
  selectedProfileId: string
  defaultProfileId: string
  settingsForm: { newProfileName: string; newProfileBudget: string; manageProfileName: string; manageProfileBudget: string }
  updateSettingsValue: (field: 'newProfileName' | 'newProfileBudget' | 'manageProfileName' | 'manageProfileBudget', value: string) => void
  handleAddProfile: (event: FormEvent<HTMLFormElement>) => void
  handleUpdateManagedProfile: (event: FormEvent<HTMLFormElement>) => void
  handleManagedProfileSelection: (profileId: string) => void
  handleSetDefaultProfile: () => void
  handleDeleteManagedProfile: () => void
  profileAvatarNode: (profile: UserProfile) => ReactNode
  setProfileAvatar: (profileId: string, avatar: string | undefined) => void
  handleAvatarUpload: (file: File | undefined) => Promise<void>
  avatarPickerOpen: boolean
  setAvatarPickerOpen: Dispatch<SetStateAction<boolean>>
  addProfileOpen: boolean
  setAddProfileOpen: Dispatch<SetStateAction<boolean>>
  deleteProfileAsk: boolean
  setDeleteProfileAsk: Dispatch<SetStateAction<boolean>>
  spentByProfileThisMonth: Record<string, number>
  transactions: Transaction[]
  inviteEmail: string
  setInviteEmail: Dispatch<SetStateAction<string>>
  inviteBusy: boolean
  handleSendFamilyInvite: () => Promise<void>
  inviteFeedback: { kind: 'ok' | 'error'; text: string } | null
  sentInvites: SentInvite[]
  relanceTick: number
  relanceInfo: Map<string, { canRelance: boolean; hoursLeft: number }>
  handleResendInvite: (invite: SentInvite) => Promise<void>
  handleCancelInvite: (invite: SentInvite) => Promise<void>
}

/** Paramètres → Profils : liste, éditeur du profil géré, invitations famille. */
export function ProfilesSettings({
  profiles,
  managedProfile,
  selectedProfileId,
  defaultProfileId,
  settingsForm,
  updateSettingsValue,
  handleAddProfile,
  handleUpdateManagedProfile,
  handleManagedProfileSelection,
  handleSetDefaultProfile,
  handleDeleteManagedProfile,
  profileAvatarNode,
  setProfileAvatar,
  handleAvatarUpload,
  avatarPickerOpen,
  setAvatarPickerOpen,
  addProfileOpen,
  setAddProfileOpen,
  deleteProfileAsk,
  setDeleteProfileAsk,
  spentByProfileThisMonth,
  transactions,
  inviteEmail,
  setInviteEmail,
  inviteBusy,
  handleSendFamilyInvite,
  inviteFeedback,
  sentInvites,
  relanceTick,
  relanceInfo,
  handleResendInvite,
  handleCancelInvite,
}: Props) {
  return (
    <>
    <div className="settings-section-grid">
      <article className="glass-card settings-section-card form-panel">
        <div className="panel-title">
          <h2>
            Vos profils
            <InfoHint text="Un profil = un budget et des dépenses séparés (vous, votre conjoint·e, un enfant, un projet). Vous basculez de l'un à l'autre via les cercles en haut du menu." />
          </h2>
          <p>Chaque profil a son budget mensuel et ses opérations. Touchez un profil pour le modifier.</p>
        </div>
        <ul className="profiles-list" aria-label="Profils">
          {profiles.map((profile) => {
            const spent = spentByProfileThisMonth[profile.id] ?? 0
            const ratio = profile.monthlyBudget > 0 ? Math.min(100, Math.round((spent / profile.monthlyBudget) * 100)) : 0
            const isManaged = profile.id === managedProfile.id
            return (
              <li key={profile.id}>
                <button
                  type="button"
                  className={`profile-row${isManaged ? ' profile-row--selected' : ''}`}
                  onClick={() => {
                    handleManagedProfileSelection(profile.id)
                    setDeleteProfileAsk(false)
                  }}
                  aria-pressed={isManaged}
                >
                  {profileAvatarNode(profile)}
                  <span className="profile-row__main">
                    <span className="profile-row__name">
                      <strong>{profile.name}</strong>
                      {profile.id === selectedProfileId ? <span className="profile-badge profile-badge--active">Actif</span> : null}
                      {profile.id === defaultProfileId ? <span className="profile-badge">Par défaut</span> : null}
                    </span>
                    <span className="profile-row__budget">
                      {profile.monthlyBudget > 0
                        ? `${euroFormatter.format(spent)} dépensés sur ${euroFormatter.format(profile.monthlyBudget)} ce mois-ci`
                        : 'Budget mensuel à définir'}
                    </span>
                    {profile.monthlyBudget > 0 ? (
                      <span className="kpi-progress-track profile-row__track" aria-hidden="true">
                        <span className={`kpi-progress-fill${ratio >= 100 ? ' profile-row__fill--over' : ''}`} style={{ width: `${ratio}%` }} />
                      </span>
                    ) : null}
                  </span>
                  <span className="profile-row__chevron" aria-hidden="true">›</span>
                </button>
              </li>
            )
          })}
        </ul>
        {addProfileOpen ? (
          <form onSubmit={(event) => { handleAddProfile(event); setAddProfileOpen(false) }} className="profile-add-form">
            <h3>Nouveau profil</h3>
            <div className="goals-form-row">
              <label>
                Nom
                <input
                  value={settingsForm.newProfileName}
                  onChange={(event) => updateSettingsValue('newProfileName', event.target.value)}
                  placeholder="Ex : Camille, Enfants, Pro"
                  autoFocus
                />
              </label>
              <label>
                Budget mensuel (€)
                <input
                  type="number"
                  min="200"
                  value={settingsForm.newProfileBudget}
                  onChange={(event) => updateSettingsValue('newProfileBudget', event.target.value)}
                />
              </label>
            </div>
            <div className="settings-inline-actions">
              <button type="submit">Créer le profil</button>
              <button type="button" className="ghost-button" onClick={() => setAddProfileOpen(false)}>
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="ghost-button profile-add-btn" onClick={() => setAddProfileOpen(true)}>
            <Plus size={16} /> Ajouter un profil
          </button>
        )}
      </article>

      <article className="glass-card settings-section-card form-panel">
        <div className="panel-title">
          <h2>Modifier « {managedProfile.name} »</h2>
          <p>Photo, nom et budget mensuel de ce profil.</p>
        </div>
        <form onSubmit={handleUpdateManagedProfile}>
          <div className="avatar-editor">
            <span className="avatar-editor__label">Photo ou avatar</span>
            <div className="avatar-editor__row">
              <div className="avatar-editor__current avatar-editor__current--large">
                <button
                  type="button"
                  className="avatar-editor__avatar-btn"
                  onClick={() => setAvatarPickerOpen((open) => !open)}
                  aria-expanded={avatarPickerOpen}
                  aria-label="Changer la photo ou l'avatar du profil"
                >
                  {profileAvatarNode(managedProfile)}
                </button>
              </div>
              <div className="avatar-editor__actions">
                <button type="button" className="ghost-button" onClick={() => setAvatarPickerOpen((open) => !open)}>
                  📷 {managedProfile.avatar ? 'Changer' : 'Choisir une photo ou un avatar'}
                </button>
                {managedProfile.avatar ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setProfileAvatar(managedProfile.id, undefined)
                      setAvatarPickerOpen(false)
                    }}
                  >
                    Retirer
                  </button>
                ) : null}
              </div>
            </div>
            {avatarPickerOpen ? (
              <div className="avatar-editor__picker">
                <label className="ghost-button avatar-upload-btn">
                  📷 Importer une photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      void handleAvatarUpload(event.target.files?.[0])
                      event.target.value = ''
                      setAvatarPickerOpen(false)
                    }}
                  />
                </label>
                <span className="avatar-editor__label avatar-editor__label--sub">
                  … ou choisissez un avatar (libres de droit)
                </span>
                <div className="avatar-preset-grid" role="listbox" aria-label="Avatars proposés">
                  {MONEY_AVATAR_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      role="option"
                      aria-selected={managedProfile.avatar === `emoji:${emoji}`}
                      className={`avatar-preset${managedProfile.avatar === `emoji:${emoji}` ? ' avatar-preset--active' : ''}`}
                      onClick={() => {
                        setProfileAvatar(managedProfile.id, `emoji:${emoji}`)
                        setAvatarPickerOpen(false)
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="goals-form-row">
            <label>
              Nom du profil
              <input
                value={settingsForm.manageProfileName}
                onChange={(event) => updateSettingsValue('manageProfileName', event.target.value)}
              />
            </label>
            <label>
              Budget mensuel (€)
              <input
                type="number"
                min="200"
                step="50"
                value={settingsForm.manageProfileBudget}
                onChange={(event) => updateSettingsValue('manageProfileBudget', event.target.value)}
              />
            </label>
          </div>
          <p className="auth-note">
            💡 Repère : vos revenus mensuels moins ce que vous voulez épargner. Toutes les jauges, alertes et la prévision de fin de mois s'appuient sur ce montant.
          </p>
          <div className="settings-inline-actions">
            <button type="submit">Enregistrer</button>
            {managedProfile.id !== defaultProfileId ? (
              <button type="button" className="ghost-button" onClick={handleSetDefaultProfile}>
                Définir par défaut
              </button>
            ) : null}
            {profiles.length > 1 && !deleteProfileAsk ? (
              <button type="button" className="danger-button" onClick={() => setDeleteProfileAsk(true)}>
                Supprimer…
              </button>
            ) : null}
          </div>
          {deleteProfileAsk ? (
            <div className="profile-delete-confirm" role="alertdialog" aria-label="Confirmer la suppression du profil">
              <p>
                Supprimer « {managedProfile.name} » et ses{' '}
                <strong>{transactions.filter((tx) => tx.member === managedProfile.id).length} opération{transactions.filter((tx) => tx.member === managedProfile.id).length > 1 ? 's' : ''}</strong>
                {' '}? Cette action est définitive.
              </p>
              <div className="settings-inline-actions">
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => {
                    handleDeleteManagedProfile()
                    setDeleteProfileAsk(false)
                  }}
                >
                  Oui, supprimer
                </button>
                <button type="button" className="ghost-button" onClick={() => setDeleteProfileAsk(false)}>
                  Annuler
                </button>
              </div>
            </div>
          ) : null}
          {managedProfile.id === defaultProfileId ? (
            <p className="auth-note">Ce profil est le profil par défaut : c'est lui qui s'ouvre au lancement.</p>
          ) : null}
        </form>
      </article>
    </div>

    <div className="settings-section-grid settings-section-grid--single">
      <article className="glass-card settings-section-card form-panel">
        <div className="panel-title">
          <h2>🤝 Famille</h2>
          <p>Invitez un proche : il crée son propre compte, et un onglet « Famille » réunit vos budgets et dépenses (chacun garde la main sur les siens).</p>
        </div>
        <div className="family-invite-block">
          <div className="family-invite-row">
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="email@exemple.fr"
              disabled={inviteBusy}
            />
            <button
              type="button"
              className="hero-cta-button"
              onClick={() => void handleSendFamilyInvite()}
              disabled={inviteBusy || !inviteEmail.trim()}
            >
              {inviteBusy ? 'Envoi…' : 'Inviter'}
            </button>
          </div>
          {inviteFeedback ? (
            <p className={inviteFeedback.kind === 'ok' ? 'auth-success' : 'auth-error'}>
              {inviteFeedback.text}
            </p>
          ) : null}
          {sentInvites.length > 0 ? (
            <ul className="sent-invites-list" data-relance-tick={relanceTick}>
              {sentInvites.map((invite) => {
                const info = relanceInfo.get(invite.membershipId)
                const canRelance = info?.canRelance ?? true
                const hoursLeft = info?.hoursLeft ?? 1
                return (
                  <li key={invite.membershipId}>
                    <div className="sent-invite-info">
                      {invite.accepted ? (
                        <>
                          <strong>{invite.displayName}</strong>
                          <small>{invite.email}</small>
                        </>
                      ) : (
                        <strong>{invite.email}</strong>
                      )}
                    </div>
                    {invite.accepted ? (
                      <span className="sent-invite-status sent-invite-status--ok">A rejoint ✓</span>
                    ) : (
                      <>
                        <span className="sent-invite-status">En attente</span>
                        <button
                          type="button"
                          className="ghost-button sent-invite-btn"
                          onClick={() => void handleResendInvite(invite)}
                          disabled={inviteBusy || !canRelance}
                          title={canRelance ? 'Renvoyer l\'email d\'invitation' : `Relance possible dans ${hoursLeft} h (1 relance par 24 h)`}
                        >
                          {canRelance ? 'Relancer' : `Relancé — ${hoursLeft} h`}
                        </button>
                        <button
                          type="button"
                          className="ghost-button sent-invite-btn sent-invite-btn--danger"
                          onClick={() => void handleCancelInvite(invite)}
                          disabled={inviteBusy}
                        >
                          Annuler
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </article>
    </div>
    </>
  )
}
