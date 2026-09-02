import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react'
import { Bot, ChevronDown, ChevronUp, Mic, Paperclip, Send, Trash2, X } from 'lucide-react'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type ChatAttachment = { name: string; mediaType: string; data: string }

type Props = {
  chatOpen: boolean
  setChatOpen: Dispatch<SetStateAction<boolean>>
  chatNudgeVisible: boolean
  setChatNudgeVisible: (visible: boolean) => void
  chatMessages: ChatMessage[]
  chatLoading: boolean
  chatInput: string
  setChatInput: (value: string) => void
  chatInputRef: RefObject<HTMLInputElement | null>
  chatEndRef: RefObject<HTMLDivElement | null>
  chatScrollRef: RefObject<HTMLDivElement | null>
  chatScrollHints: { up: boolean; down: boolean }
  updateChatScrollHints: () => void
  chatClearConfirmOpen: boolean
  setChatClearConfirmOpen: Dispatch<SetStateAction<boolean>>
  clearChatConversation: () => void
  chatUndoToastOpen: boolean
  lastDeletedChat: { storageKey: string; threadLabel: string } | null
  chatHistoryStorageKey: string
  restoreLastDeletedChat: () => void
  chatAttachment: ChatAttachment | null
  setChatAttachment: (attachment: ChatAttachment | null) => void
  chatFileInputRef: RefObject<HTMLInputElement | null>
  handleChatFile: (event: ChangeEvent<HTMLInputElement>) => void
  dictationAvailable: boolean
  chatListening: boolean
  toggleChatDictation: () => void
  sendChatMessage: (presetMessage?: string, attachment?: ChatAttachment | null) => Promise<void>
}

/** Cash, l'assistant : bouton flottant, bulle d'invitation et fenêtre de chat. */
export function CashChatPanel(props: Props) {
  const {
    chatOpen, setChatOpen, chatNudgeVisible, setChatNudgeVisible, chatMessages, chatLoading,
    chatInput, setChatInput, chatInputRef, chatEndRef, chatScrollRef, chatScrollHints,
    updateChatScrollHints, chatClearConfirmOpen, setChatClearConfirmOpen, clearChatConversation,
    chatUndoToastOpen, lastDeletedChat, chatHistoryStorageKey, restoreLastDeletedChat,
    chatAttachment, setChatAttachment, chatFileInputRef, handleChatFile, dictationAvailable,
    chatListening, toggleChatDictation, sendChatMessage,
  } = props

  return (
    <>
        {chatNudgeVisible && !chatOpen ? (
          <button
            type="button"
            className="chat-fab-nudge"
            onClick={() => {
              setChatNudgeVisible(false)
              setChatOpen(true)
            }}
          >
            👋 Je suis Cash, votre assistant budget. Une question sur vos finances ? Demandez-moi !
          </button>
        ) : null}
        <button
          type="button"
          className={`chat-fab${chatOpen ? ' chat-fab--open' : ''}`}
          onClick={() => setChatOpen((prev) => !prev)}
          title="Cash, votre assistant budget"
          aria-label="Ouvrir Cash, votre assistant budget"
        >
          {chatOpen ? <X size={22} /> : <Bot size={24} />}
          {!chatOpen && chatMessages.length > 0 && (
            <span className="chat-fab-badge">{chatMessages.filter((m) => m.role === 'assistant').length}</span>
          )}
        </button>

        {chatOpen ? (
          <div className="chat-panel glass-card" role="dialog" aria-label="Cash, votre assistant budget">
            <div className="chat-header">
              <Bot size={18} />
              <span className="chat-header-title">
                Cash 💰 <small>· votre assistant virtuel</small>
              </span>
              {chatMessages.length > 0 ? (
                <button
                  type="button"
                  className="chat-clear-btn"
                  onClick={() => setChatClearConfirmOpen((prev) => !prev)}
                  title="Effacer la conversation"
                  aria-label="Effacer la conversation"
                  disabled={chatLoading}
                >
                  <Trash2 size={14} />
                  <span>Effacer</span>
                </button>
              ) : null}
            </div>

            {chatClearConfirmOpen ? (
              <div className="chat-clear-confirm" role="status" aria-live="polite">
                <span>
                  Effacer cette conversation ?
                </span>
                <div className="chat-clear-confirm-actions">
                  <button type="button" className="chat-clear-confirm-yes" onClick={clearChatConversation}>
                    Effacer
                  </button>
                  <button
                    type="button"
                    className="chat-clear-confirm-no"
                    onClick={() => setChatClearConfirmOpen(false)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : null}

            {chatUndoToastOpen && lastDeletedChat?.storageKey === chatHistoryStorageKey ? (
              <div className="chat-undo-toast" role="status" aria-live="polite">
                <span>Conversation supprimée sur {lastDeletedChat.threadLabel}.</span>
                <button type="button" onClick={restoreLastDeletedChat} disabled={chatLoading}>
                  Restaurer
                </button>
              </div>
            ) : null}

            <div className="chat-messages-wrap">
              {chatScrollHints.up ? (
                <button
                  type="button"
                  className="chat-scroll-hint chat-scroll-hint--up"
                  onClick={() => chatScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                  aria-label="Remonter la conversation"
                >
                  <ChevronUp size={18} />
                </button>
              ) : null}
              {chatScrollHints.down ? (
                <button
                  type="button"
                  className="chat-scroll-hint chat-scroll-hint--down"
                  onClick={() => {
                    const el = chatScrollRef.current
                    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
                  }}
                  aria-label="Descendre en bas de la conversation"
                >
                  <ChevronDown size={18} />
                </button>
              ) : null}
            <div
              className="chat-messages"
              ref={chatScrollRef}
              onScroll={updateChatScrollHints}
              aria-live="polite"
              aria-relevant="additions text"
            >
              {chatMessages.length === 0 ? (
                <div className="chat-empty">
                  <Bot size={32} />
                  <p>
                    Bonjour, moi c'est <strong>Cash</strong> 💰 Je compte vos sous plus vite que
                    votre banquier — et sans commission. Une question sur vos finances ?
                  </p>
                  <div className="chat-suggestions">
                    {[
                      'Résume mon mois',
                      'Où puis-je économiser ?',
                      'Mon budget tient-il ?',
                      'Quelle est ma plus grosse dépense ?',
                      'Analyse mes abonnements',
                      'Prépare mon budget du mois prochain',
                    ].map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={chatLoading}
                        onClick={() => {
                          setChatInput('')
                          void sendChatMessage(s)
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div key={index} className={`chat-bubble chat-bubble--${msg.role}`}>
                    <p>{msg.content}</p>
                  </div>
                ))
              )}
              {chatLoading ? (
                <div className="chat-bubble chat-bubble--assistant chat-bubble--loading">
                  <span /><span /><span />
                </div>
              ) : null}
              <div ref={chatEndRef} />
            </div>
            </div>

            {chatAttachment ? (
              <span className="advice-attachment-chip chat-attachment-chip">
                📎 {chatAttachment.name}
                <button type="button" onClick={() => setChatAttachment(null)} aria-label="Retirer la pièce jointe">✕</button>
              </span>
            ) : null}
            <form
              className="chat-input-row"
              onSubmit={(event) => {
                event.preventDefault()
                void sendChatMessage(undefined, chatAttachment)
                setChatAttachment(null)
              }}
            >
              <button
                type="button"
                className="advice-icon-btn"
                onClick={() => chatFileInputRef.current?.click()}
                title="Joindre une image ou un PDF (ticket, facture…)"
                aria-label="Joindre une pièce jointe"
                disabled={chatLoading}
              >
                <Paperclip size={16} />
              </button>
              {dictationAvailable ? (
                <button
                  type="button"
                  className={`advice-icon-btn${chatListening ? ' advice-icon-btn--live' : ''}`}
                  onClick={toggleChatDictation}
                  title={chatListening ? 'Arrêter la dictée' : 'Dicter la question'}
                  aria-label={chatListening ? 'Arrêter la dictée' : 'Dicter la question'}
                  disabled={chatLoading}
                >
                  <Mic size={16} />
                </button>
              ) : null}
              <input
                ref={chatInputRef}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder={chatListening ? 'Cash vous écoute…' : 'Posez une question…'}
                disabled={chatLoading}
                autoFocus
              />
              <button type="submit" disabled={!chatInput.trim() || chatLoading}>
                {chatLoading ? <span className="inline-loader" aria-hidden="true" /> : <Send size={16} />}
              </button>
              <input
                type="file"
                hidden
                ref={chatFileInputRef}
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                onChange={handleChatFile}
              />
            </form>
          </div>
        ) : null}
    </>
  )
}
