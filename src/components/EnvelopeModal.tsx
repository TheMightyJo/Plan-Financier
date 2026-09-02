/** État de la modale de poche : création ou édition d'une poche nommée. */
export type EnvelopeModalState = { mode: 'edit' | 'create'; name: string }

type Props = {
  envelopeModal: EnvelopeModalState
  envModalName: string
  setEnvModalName: (value: string) => void
  envModalTarget: string
  setEnvModalTarget: (value: string) => void
  envModalAdd: string
  setEnvModalAdd: (value: string) => void
  envModalDeleteAsk: boolean
  setEnvModalDeleteAsk: (value: boolean) => void
  closeEnvelopeModal: () => void
  createEnvelope: (name: string) => void
  deleteEnvelope: (name: string) => void
  /** Enregistre objectif, disponible et renommage (mode édition). */
  onSave: () => void
}

/** Modale de gestion d'une poche (création, objectif, disponible, renommage, suppression). */
export function EnvelopeModal(props: Props) {
  const {
    envelopeModal, envModalName, setEnvModalName, envModalTarget, setEnvModalTarget,
    envModalAdd, setEnvModalAdd, envModalDeleteAsk, setEnvModalDeleteAsk,
    closeEnvelopeModal, createEnvelope, deleteEnvelope, onSave,
  } = props

  return (
      <div className="budget-actions-modal-overlay" onClick={closeEnvelopeModal}>
        <div className="budget-actions-modal envelope-modal" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="budget-actions-modal-close" onClick={closeEnvelopeModal} aria-label="Fermer">
            ✕
          </button>
          {envelopeModal.mode === 'create' ? (
            <>
              <h3>✉️ Nouvelle poche</h3>
              <label>
                Nom de la poche
                <input
                  value={envModalName}
                  onChange={(event) => setEnvModalName(event.target.value)}
                  placeholder="Ex : Cadeaux, Voiture, Études…"
                  maxLength={40}
                  autoFocus
                />
              </label>
              <label>
                🎯 Objectif mensuel (€)
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="10"
                  value={envModalTarget}
                  onChange={(event) => setEnvModalTarget(event.target.value)}
                  placeholder="0 = pas d'objectif"
                />
              </label>
              <label>
                💰 Argent disponible dans la poche (€)
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="10"
                  value={envModalAdd}
                  onChange={(event) => setEnvModalAdd(event.target.value)}
                  placeholder="Ex : 100"
                />
              </label>
              <div className="quick-add-actions">
                <button type="button" className="ghost-button" onClick={closeEnvelopeModal}>Annuler</button>
                <button type="button" className="hero-cta-button" onClick={() => createEnvelope(envModalName)} disabled={!envModalName.trim()}>
                  Créer la poche
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>✉️ Poche {envelopeModal.name}</h3>
              <label>
                🎯 Objectif mensuel (€)
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="10"
                  value={envModalTarget}
                  onChange={(event) => setEnvModalTarget(event.target.value)}
                  placeholder="0 = pas d'objectif"
                />
              </label>
              <label>
                💰 Argent disponible dans la poche (€)
                <input
                  type="number"
                  inputMode="decimal"
                  step="10"
                  value={envModalAdd}
                  onChange={(event) => setEnvModalAdd(event.target.value)}
                  placeholder="Ex : 100"
                />
                <small className="field-hint">Le montant actuellement utilisable — modifiez-le librement.</small>
              </label>
              <label>
                ✏️ Renommer la poche
                <input
                  value={envModalName}
                  onChange={(event) => setEnvModalName(event.target.value)}
                  maxLength={40}
                />
              </label>
              {envModalDeleteAsk ? (
                <div className="quick-add-delete-confirm" role="alertdialog" aria-label="Confirmer la suppression">
                  <span>Supprimer la poche « {envelopeModal.name} » ? Ses opérations passeront dans Perso.</span>
                  <div>
                    <button type="button" className="quick-add-delete-yes" onClick={() => deleteEnvelope(envelopeModal.name)}>
                      Oui, supprimer
                    </button>
                    <button type="button" className="ghost-button" onClick={() => setEnvModalDeleteAsk(false)}>
                      Non, garder
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="quick-add-actions">
                {envelopeModal.name !== 'Perso' && !envModalDeleteAsk ? (
                  <button type="button" className="quick-add-delete-btn" onClick={() => setEnvModalDeleteAsk(true)}>
                    🗑️ Supprimer
                  </button>
                ) : null}
                <button type="button" className="ghost-button" onClick={closeEnvelopeModal}>Annuler</button>
                <button
                  type="button"
                  className="hero-cta-button"
                  onClick={onSave}
                >
                  Enregistrer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
  )
}
