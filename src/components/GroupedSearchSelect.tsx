import { useState } from 'react'
import type { CategoryGroup } from '../lib/categories'

const CUSTOM_VALUE = '__custom__'

/**
 * Sélecteur groupé (optgroup natifs) pour Catégorie et Poche dans la modale
 * d'opération. La dernière option « ✏️ Autre (personnalisé)… » ouvre un champ
 * libre : Category/Envelope étant des chaînes, la valeur saisie est stockée
 * telle quelle (et survit au rechargement / à la synchro).
 */
export function GroupedSearchSelect({
  value,
  groups,
  onChange,
  selectAriaLabel,
  customPlaceholder = 'Votre nom personnalisé…',
}: {
  value: string
  groups: CategoryGroup[]
  onChange: (next: string) => void
  selectAriaLabel: string
  customPlaceholder?: string
}) {
  const [customMode, setCustomMode] = useState(false)
  const [draft, setDraft] = useState('')

  const valueListed = groups.some((group) => group.options.includes(value))

  const commitDraft = () => {
    const custom = draft.trim().slice(0, 40)
    if (custom) onChange(custom)
    setCustomMode(false)
    setDraft('')
  }

  return (
    <div className="grouped-select">
      <select
        value={customMode ? CUSTOM_VALUE : value}
        onChange={(event) => {
          if (event.target.value === CUSTOM_VALUE) {
            setCustomMode(true)
            setDraft('')
            return
          }
          setCustomMode(false)
          onChange(event.target.value)
        }}
        aria-label={selectAriaLabel}
      >
        {!valueListed && !customMode ? <option value={value}>{value}</option> : null}
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </optgroup>
        ))}
        <optgroup label="Pas dans la liste ?">
          <option value={CUSTOM_VALUE}>✏️ Autre (personnalisé)…</option>
        </optgroup>
      </select>
      {customMode ? (
        <input
          type="text"
          className="grouped-select__custom"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitDraft()
            }
            if (event.key === 'Escape') {
              setCustomMode(false)
              setDraft('')
            }
          }}
          placeholder={customPlaceholder}
          aria-label={`${selectAriaLabel} personnalisée`}
          maxLength={40}
          autoFocus
        />
      ) : null}
    </div>
  )
}
