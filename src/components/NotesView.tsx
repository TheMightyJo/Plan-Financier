import { useState } from 'react'
import { callCashModel } from '../lib/aiClient'
import { categories } from '../lib/categories'
import { euroFormatter } from '../lib/format'
import type { Category, TransactionKind } from '../types'

export type NoteItem = {
  id: number
  content: string
  updatedAt: number
}

/** Opération extraite par l'IA, en attente de validation par l'utilisateur. */
export type ExtractedTx = {
  label: string
  amount: number
  kind: TransactionKind
  date: string | null
  category: Category
  tags: string[]
}

type Props = {
  notes: NoteItem[]
  onChange: (notes: NoteItem[]) => void
  /** IA configurée : active la fenêtre « Ranger avec l'IA ». */
  aiEnabled: boolean
  anthropicKey: string
  /** Importe les opérations validées (l'App complète profil/compte). */
  onImportTransactions: (rows: ExtractedTx[]) => void
  onConfigureAi: () => void
}

const noteTitle = (content: string): string => {
  const first = content.split('\n').find((line) => line.trim().length > 0)
  return first ? first.trim().slice(0, 60) : 'Note vide'
}

export function NotesView({ notes, onChange, aiEnabled, anthropicKey, onImportTransactions, onConfigureAi }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(notes[0]?.id ?? null)
  const [aiInput, setAiInput] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [extracted, setExtracted] = useState<ExtractedTx[] | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const selected = notes.find((note) => note.id === selectedId) ?? null

  const addNote = () => {
    const note: NoteItem = { id: Date.now(), content: '', updatedAt: Date.now() }
    onChange([note, ...notes])
    setSelectedId(note.id)
  }

  const updateSelected = (content: string) => {
    if (!selected) return
    onChange(notes.map((note) => (note.id === selected.id ? { ...note, content, updatedAt: Date.now() } : note)))
  }

  const deleteNote = (id: number) => {
    const next = notes.filter((note) => note.id !== id)
    onChange(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  const runExtraction = async (text: string) => {
    if (!text.trim() || aiBusy) return
    setAiBusy(true)
    setAiError('')
    setExtracted(null)
    try {
      const raw = await callCashModel({
        apiKey: anthropicKey || undefined,
        maxTokens: 1500,
        system: `Tu extrais des opérations financières d'un texte libre en français (relevé bancaire collé, ticket, liste, SMS…). Réponds UNIQUEMENT un JSON de la forme {"transactions":[{"label":"…","amount":12.5,"kind":"depense","date":"2026-08-30","category":"Courses","tags":["…"]}]}.
Règles : amount toujours positif (le signe est porté par kind: "depense" ou "revenu") ; date au format YYYY-MM-DD ou null si inconnue ; category exactement parmi ${categories.join(', ')} ; tags 0-2 étiquettes courtes en minuscules ; libellés courts et propres. Si aucune opération détectable, {"transactions":[]}.`,
        messages: [{ role: 'user', content: text.slice(0, 6000) }],
      })
      const match = /\{[\s\S]*\}/.exec(raw)
      const parsed = match ? (JSON.parse(match[0]) as { transactions?: unknown[] }) : null
      const rows: ExtractedTx[] = (parsed?.transactions ?? [])
        .map((item) => {
          const row = item as Partial<ExtractedTx> & { amount?: unknown }
          const amount = Number(row.amount)
          if (!row.label || Number.isNaN(amount) || amount <= 0) return null
          return {
            label: String(row.label).slice(0, 80),
            amount,
            kind: row.kind === 'revenu' ? 'revenu' : 'depense',
            date: typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : null,
            category: categories.includes(row.category as Category) ? (row.category as Category) : 'Autre',
            tags: Array.isArray(row.tags)
              ? row.tags.filter((t): t is string => typeof t === 'string').slice(0, 2)
              : [],
          } satisfies ExtractedTx
        })
        .filter((row): row is ExtractedTx => row !== null)
      if (rows.length === 0) {
        setAiError("Aucune opération détectée dans ce texte.")
        return
      }
      setExtracted(rows)
      setChecked(new Set(rows.map((_, index) => index)))
    } catch (error) {
      setAiError(
        error instanceof Error && error.message ? error.message : "L'analyse a échoué — réessayez.",
      )
    } finally {
      setAiBusy(false)
    }
  }

  const importChecked = () => {
    if (!extracted) return
    const rows = extracted.filter((_, index) => checked.has(index))
    if (rows.length === 0) return
    onImportTransactions(rows)
    setExtracted(null)
    setAiInput('')
  }

  return (
    <section className="glass-card notes-view" aria-label="Notes">
      <div className="panel-title">
        <h2>🗒️ Notes</h2>
        <p>Un brouillon libre : notez, collez, rangez plus tard.</p>
      </div>

      {/* ── Fenêtre IA : coller → ranger ─────────────────────────────── */}
      {aiEnabled ? (
        <div className="notes-ai-box">
          <p className="notes-ai-box__title">✨ Ranger avec l'IA</p>
          <p className="notes-ai-box__hint">
            Collez des données en vrac (relevé, ticket, liste de dépenses…) : l'IA en extrait
            des opérations que vous validez avant l'ajout.
          </p>
          <textarea
            value={aiInput}
            onChange={(event) => setAiInput(event.target.value)}
            placeholder={'Ex:\n30/08 CARREFOUR MARKET 46,32\nVIR SALAIRE ACME +2 450,00\nEssence Total 65 €'}
            rows={4}
            disabled={aiBusy}
          />
          <div className="notes-ai-actions">
            <button type="button" className="hero-cta-button" onClick={() => void runExtraction(aiInput)} disabled={aiBusy || !aiInput.trim()}>
              {aiBusy ? 'Analyse…' : 'Analyser et ranger'}
            </button>
          </div>
          {aiError ? <p className="auth-error">{aiError}</p> : null}

          {extracted ? (
            <div className="notes-ai-results">
              <p className="notes-ai-box__title">
                {extracted.length} opération{extracted.length > 1 ? 's' : ''} détectée{extracted.length > 1 ? 's' : ''} — décochez ce que vous ne voulez pas :
              </p>
              <ul>
                {extracted.map((row, index) => (
                  <li key={index}>
                    <label className="notes-ai-row">
                      <input
                        type="checkbox"
                        checked={checked.has(index)}
                        onChange={() =>
                          setChecked((previous) => {
                            const next = new Set(previous)
                            if (next.has(index)) next.delete(index)
                            else next.add(index)
                            return next
                          })
                        }
                      />
                      <span className="notes-ai-row__label">{row.label}</span>
                      <span className="notes-ai-row__meta">
                        {row.date ?? 'aujourd’hui'} · {row.category}
                        {row.tags.map((tag) => ` #${tag}`).join('')}
                      </span>
                      <span className={row.kind === 'depense' ? 'expense-calendar__spent' : 'expense-calendar__income'}>
                        {row.kind === 'depense' ? '−' : '+'}{euroFormatter.format(row.amount)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="notes-ai-actions">
                <button type="button" className="ghost-button" onClick={() => setExtracted(null)}>
                  Annuler
                </button>
                <button type="button" className="hero-cta-button" onClick={importChecked} disabled={checked.size === 0}>
                  Ajouter {checked.size} opération{checked.size > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <button type="button" className="quick-add-ai-nudge" onClick={onConfigureAi}>
          ✨ Configurez votre assistant IA pour coller des données en vrac et les laisser se
          ranger toutes seules en dépenses.
        </button>
      )}

      {/* ── Notes libres ─────────────────────────────────────────────── */}
      <div className="notes-toolbar">
        <button type="button" className="hero-cta-button" onClick={addNote}>
          + Nouvelle note
        </button>
        {selected && aiEnabled && selected.content.trim() ? (
          <button type="button" className="ghost-button" onClick={() => void runExtraction(selected.content)} disabled={aiBusy}>
            ✨ Ranger cette note
          </button>
        ) : null}
      </div>

      {selected ? (
        <textarea
          className="notes-editor"
          value={selected.content}
          onChange={(event) => updateSelected(event.target.value)}
          placeholder="Écrivez ou collez ici… (enregistré automatiquement)"
          rows={8}
        />
      ) : (
        <p className="auth-note">Créez votre première note pour commencer.</p>
      )}

      {notes.length > 0 ? (
        <ul className="notes-list">
          {notes.map((note) => (
            <li key={note.id} className={note.id === selectedId ? 'active' : ''}>
              <button type="button" className="notes-list__open" onClick={() => setSelectedId(note.id)}>
                <strong>{noteTitle(note.content)}</strong>
                <small>
                  {new Date(note.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  {' · '}
                  {note.content.trim().length} caractères
                </small>
              </button>
              <button
                type="button"
                className="notes-list__delete"
                onClick={() => deleteNote(note.id)}
                aria-label={`Supprimer la note ${noteTitle(note.content)}`}
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
