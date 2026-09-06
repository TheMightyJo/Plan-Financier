import type { Dispatch, SetStateAction } from 'react'
import type { ReportPrefs } from '../../repos/reportPrefsRepo'

type Props = {
  userEmail: string
  reportPrefs: ReportPrefs
  reportCcDraft: string
  setReportCcDraft: Dispatch<SetStateAction<string>>
  handleReportPrefsChange: (patch: Partial<Pick<ReportPrefs, 'frequency' | 'format' | 'attachment' | 'ccEmails'>>) => Promise<void>
  handleReportCcCommit: (raw: string) => void
  handleSendTestReport: () => Promise<void>
  reportBusy: boolean
  reportFeedback: { kind: 'ok' | 'error'; text: string } | null
}

/** Paramètres → Rapport par email : fréquence, contenu, pièce jointe, copies, test. */
export function ReportSettings({
  userEmail,
  reportPrefs,
  reportCcDraft,
  setReportCcDraft,
  handleReportPrefsChange,
  handleReportCcCommit,
  handleSendTestReport,
  reportBusy,
  reportFeedback,
}: Props) {
  return (
    <div className="settings-section-grid settings-section-grid--single">
      <article className="glass-card settings-section-card form-panel">
        <div className="panel-title">
          <h2>📧 Rapport par email</h2>
          <p>
            Recevez automatiquement un résumé de vos finances sur {userEmail || 'votre adresse'} —
            construit à partir de vos données synchronisées.
          </p>
        </div>
        {reportPrefs.frequency !== 'none' ? (
          <div className="report-current" role="status">
            <strong>📬 Rapport programmé</strong>
            <p>
              {reportPrefs.frequency === 'weekly' ? 'Chaque semaine' : 'Chaque mois'}
              {' · '}
              {reportPrefs.format === 'detailed' ? 'détaillé' : "l'essentiel"}
              {reportPrefs.attachment === 'none'
                ? ''
                : ` · ${reportPrefs.attachment === 'csv' ? 'CSV' : reportPrefs.attachment === 'excel' ? 'Excel' : 'PDF'} joint`}
              {' — envoyé à '}
              {userEmail || 'votre adresse'}
              {reportPrefs.ccEmails.length > 0
                ? ` + ${reportPrefs.ccEmails.length} adresse${reportPrefs.ccEmails.length > 1 ? 's' : ''} en copie`
                : ''}
            </p>
            <small>
              {reportPrefs.lastSentAt
                ? `Dernier envoi : ${new Date(reportPrefs.lastSentAt).toLocaleDateString('fr-FR')}. `
                : 'Aucun envoi automatique pour le moment. '}
              Modifiez les réglages ci-dessous : ils sont enregistrés aussitôt.
            </small>
          </div>
        ) : (
          <div className="report-current report-current--off" role="status">
            <strong>Aucun rapport programmé</strong>
            <small>Choisissez une fréquence ci-dessous pour l'activer.</small>
          </div>
        )}
        <label>
          Fréquence
          <select
            value={reportPrefs.frequency}
            onChange={(event) =>
              void handleReportPrefsChange({
                frequency: event.target.value as ReportPrefs['frequency'],
                format: reportPrefs.format,
              })
            }
          >
            <option value="none">Jamais (désactivé)</option>
            <option value="weekly">Chaque semaine</option>
            <option value="monthly">Chaque mois (bilan du mois précédent)</option>
          </select>
        </label>
        <label>
          Contenu
          <select
            value={reportPrefs.format}
            onChange={(event) =>
              void handleReportPrefsChange({
                frequency: reportPrefs.frequency,
                format: event.target.value as ReportPrefs['format'],
              })
            }
          >
            <option value="summary">L'essentiel (totaux + top catégories)</option>
            <option value="detailed">Détaillé (avec la liste des opérations)</option>
          </select>
        </label>
        <label>
          Pièce jointe
          <select
            value={reportPrefs.attachment}
            onChange={(event) =>
              void handleReportPrefsChange({
                attachment: event.target.value as ReportPrefs['attachment'],
              })
            }
          >
            <option value="none">Aucune — tout est dans l'email</option>
            <option value="pdf">PDF (à imprimer ou archiver)</option>
            <option value="csv">CSV (à ouvrir dans un tableur)</option>
            <option value="excel">Excel</option>
          </select>
        </label>
        <label>
          Envoyer une copie à (5 adresses max)
          <input
            type="text"
            value={reportCcDraft}
            onChange={(event) => setReportCcDraft(event.target.value)}
            onBlur={(event) => handleReportCcCommit(event.target.value)}
            placeholder="conjoint@exemple.fr, comptable@exemple.fr"
            autoComplete="off"
          />
          <small className="field-hint">
            Ces adresses reçoivent les rapports automatiques (pas le rapport test).
          </small>
        </label>
        <div className="settings-inline-actions">
          <button type="button" onClick={() => void handleSendTestReport()} disabled={reportBusy}>
            {reportBusy ? 'Envoi…' : 'Recevoir un rapport test maintenant'}
          </button>
        </div>
        {reportFeedback ? (
          <p className={reportFeedback.kind === 'ok' ? 'auth-success' : 'auth-error'}>
            {reportFeedback.text}
          </p>
        ) : null}
      </article>
    </div>
  )
}
