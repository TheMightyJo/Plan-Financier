import type { Dispatch, SetStateAction } from 'react'
import type { AiQuota } from '../../lib/aiClient'

type Props = {
  activeAiKey: string
  canUseIncludedAi: boolean
  aiQuota: AiQuota | null
  selectedAiProvider: { name: string; keyPlaceholder: string; consoleUrl: string; helpUrl: string }
  saveAiProviderKey: (provider: 'anthropic', key: string) => void
  testClaudeKey: () => Promise<void>
  claudeTestState: 'idle' | 'testing' | 'success' | 'error'
  claudeTestMessage: string
  setChatOpen: Dispatch<SetStateAction<boolean>>
  isBudgetAiConfigured: boolean
}

/** Paramètres → Assistant IA : statut (IA incluse / clé perso), clé Anthropic, test, chat. */
export function AiSettings({
  activeAiKey,
  canUseIncludedAi,
  aiQuota,
  selectedAiProvider,
  saveAiProviderKey,
  testClaudeKey,
  claudeTestState,
  claudeTestMessage,
  setChatOpen,
  isBudgetAiConfigured,
}: Props) {
  return (
    <div className="settings-section-grid">
      <article className="glass-card settings-section-card form-panel ai-settings-card">
        <div className="panel-title">
          <h2>Assistant IA</h2>
          <p>Connectez une IA pour activer le coaching, les analyses et le chat.</p>
        </div>

        <div
          className={`ai-status ai-status--${activeAiKey || canUseIncludedAi ? 'ready' : 'off'}`}
          role="status"
        >
          <span className="ai-status__dot" aria-hidden="true" />
          <div>
            <strong>
              {activeAiKey
                ? 'Prêt à l\'emploi — clé personnelle'
                : canUseIncludedAi
                  ? 'Prêt à l\'emploi — IA incluse'
                  : 'Non configuré'}
            </strong>
            <small>
              {activeAiKey
                ? 'Votre clé est enregistrée sur cet appareil (aucun quota). Testez-la ci-dessous.'
                : canUseIncludedAi
                  ? `Cash est propulsé par Claude (Anthropic), inclus avec votre compte${aiQuota ? ` : ${aiQuota.used} / ${aiQuota.limit} messages utilisés ce mois-ci` : ''}. Une clé personnelle (facultative) lève le quota.`
                  : 'Ajoutez votre clé pour débloquer l\'assistant.'}
            </small>
          </div>
        </div>

        <label>
          Clé API Anthropic (Claude) — facultative
          <input
            type="password"
            value={activeAiKey}
            onChange={(event) => saveAiProviderKey('anthropic', event.target.value)}
            placeholder={selectedAiProvider.keyPlaceholder}
            autoComplete="off"
          />
        </label>
        <p className="ai-key-links">
          <a href={selectedAiProvider.consoleUrl} target="_blank" rel="noreferrer">
            Où trouver ma clé ?
          </a>
          {' · '}
          <a href={selectedAiProvider.helpUrl} target="_blank" rel="noreferrer">
            Guide {selectedAiProvider.name}
          </a>
          {' — '}La clé reste sur cet appareil.
        </p>

        <div className="settings-inline-actions">
          <button
            type="button"
            onClick={() => void testClaudeKey()}
            disabled={claudeTestState === 'testing' || !activeAiKey}
          >
            {claudeTestState === 'testing' ? (
              <span className="inline-loading-label"><span className="inline-loader" aria-hidden="true" />Test en cours...</span>
            ) : 'Tester la clé'}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setChatOpen(true)}
            disabled={!isBudgetAiConfigured}
          >
            Ouvrir le chat
          </button>
        </div>
        {claudeTestMessage ? (
          <p className={`claude-status-text claude-status-text--${claudeTestState}`}>
            {claudeTestMessage}
          </p>
        ) : null}
      </article>
    </div>
  )
}
