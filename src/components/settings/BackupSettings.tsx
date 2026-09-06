import { useRef, type ChangeEvent } from 'react'
import { InfoHint } from '../InfoHint'

type Props = {
  cloudSyncStatus: 'idle' | 'syncing' | 'ok' | 'error'
  handleExportEncryptedBackup: () => Promise<void>
  handleRestoreEncryptedBackup: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
}

/** Paramètres → Sauvegarde : état de la copie en ligne, export / restauration chiffrés. */
export function BackupSettings({ cloudSyncStatus, handleExportEncryptedBackup, handleRestoreEncryptedBackup }: Props) {
  const backupRestoreInputRef = useRef<HTMLInputElement | null>(null)
  return (
    <div className="settings-section-grid">
      <article className="glass-card settings-section-card form-panel">
        <div className="panel-title">
          <h2>Enregistrement en ligne</h2>
          <p>Vos données suivent votre compte, sur tous vos appareils.</p>
        </div>
        <div className={`sync-status-card sync-status-card--${cloudSyncStatus}`} role="status">
          {cloudSyncStatus === 'ok' ? (
            <>
              <strong>✅ Vos données sont enregistrées en ligne</strong>
              <small>
                Tout ce que vous ajoutez est copié automatiquement sur votre compte.
                Connectez-vous depuis n'importe quel appareil pour les retrouver.
              </small>
            </>
          ) : cloudSyncStatus === 'syncing' ? (
            <>
              <strong>☁️ Enregistrement en cours…</strong>
              <small>Vos dernières modifications sont en train d'être copiées en ligne.</small>
            </>
          ) : cloudSyncStatus === 'error' ? (
            <>
              <strong>⚠️ Enregistrement en ligne impossible pour le moment</strong>
              <small>
                Pas d'inquiétude : tout reste enregistré sur cet appareil. La copie en
                ligne reprendra automatiquement dès que la connexion reviendra.
              </small>
            </>
          ) : (
            <>
              <strong>☁️ En attente de connexion</strong>
              <small>
                Vos données sont enregistrées sur cet appareil. La copie en ligne
                démarre dès que vous êtes connecté.
              </small>
            </>
          )}
        </div>
      </article>
      <article className="glass-card settings-section-card form-panel">
        <div className="panel-title">
          <h2>
            Sauvegarde de vos données
            <InfoHint text="Le fichier exporté contient toutes vos données : gardez-le en lieu sûr, il permet de tout restaurer sur n'importe quel appareil." />
          </h2>
          <p>Exportez ou restaurez toutes vos données en un fichier.</p>
        </div>
        <div className="backup-zone backup-zone--standalone">
          <div className="settings-inline-actions">
            <button type="button" onClick={() => void handleExportEncryptedBackup()}>
              Exporter ma sauvegarde
            </button>
            <button type="button" className="ghost-button" onClick={() => backupRestoreInputRef.current?.click()}>
              Restaurer une sauvegarde
            </button>
          </div>
          <input
            ref={backupRestoreInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden-input"
            onChange={(event) => void handleRestoreEncryptedBackup(event)}
          />
        </div>
      </article>
    </div>
  )
}
