import { useState } from 'react'
import type { CategoryGroup } from '../lib/categories'
import { normalizeText } from '../lib/text'

/**
 * Sélecteur groupé (optgroup natifs) avec champ de recherche : la saisie
 * filtre les options, la valeur courante reste toujours sélectionnable.
 * Utilisé pour Catégorie et Poche dans la modale d'opération.
 */
export function GroupedSearchSelect({
  value,
  groups,
  onChange,
  searchPlaceholder = 'Rechercher…',
  selectAriaLabel,
}: {
  value: string
  groups: CategoryGroup[]
  onChange: (next: string) => void
  searchPlaceholder?: string
  selectAriaLabel: string
}) {
  const [query, setQuery] = useState('')
  const normalizedQuery = normalizeText(query).trim()

  const filtered = normalizedQuery
    ? groups
        .map((group) => ({
          ...group,
          options: group.options.filter((option) => normalizeText(option).includes(normalizedQuery)),
        }))
        .filter((group) => group.options.length > 0)
    : groups

  const valueListed = filtered.some((group) => group.options.includes(value))

  return (
    <div className="grouped-select">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={`${selectAriaLabel} — recherche`}
        className="grouped-select__search"
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={selectAriaLabel}
        size={normalizedQuery ? Math.min(8, Math.max(2, filtered.reduce((n, g) => n + g.options.length + 1, 0))) : undefined}
      >
        {!valueListed ? <option value={value}>{value}</option> : null}
        {filtered.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {normalizedQuery && filtered.length === 0 ? (
        <small className="grouped-select__empty">Aucun résultat — « {value} » reste sélectionné.</small>
      ) : null}
    </div>
  )
}
