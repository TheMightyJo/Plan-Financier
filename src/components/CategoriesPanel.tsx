import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Trash2, Archive, ArchiveRestore, Plus } from 'lucide-react'
import type { TransactionKind } from '../types'
import { EXPENSE_CATEGORY_GROUPS, INCOME_CATEGORY_GROUPS, categoryEmoji, colorForCategory } from '../lib/categories'
import {
  MY_CATEGORIES_GROUP,
  isCatalogCategory,
  validateCategoryLabel,
  type CategoryLabelError,
  type CustomCategory,
} from '../lib/customCategories'

type Props = {
  customCategories: CustomCategory[]
  /** Opérations + règles par catégorie (bloque la suppression). */
  usage: Record<string, number>
  onChange: (next: CustomCategory[]) => void
  /** Renommer une catégorie personnalisée : l'appelant migre les références. */
  onRename: (from: string, to: string) => void
}

const EMOJI_PRESETS = ['🐶', '🚗', '🎓', '🏠', '🍽️', '👶', '💊', '🎁', '✈️', '🏋️', '🎮', '📱', '🧾', '💇', '🛠️', '🌱']
const ERRORS: Record<CategoryLabelError, string> = {
  empty: 'Donnez un nom à la catégorie.',
  too_long: '40 caractères maximum.',
  exists: 'Cette catégorie existe déjà.',
}

type FormState = { label: string; kind: TransactionKind; emoji: string; color: string; group: string }
const emptyForm = (): FormState => ({ label: '', kind: 'depense', emoji: '', color: '#8B6C52', group: '' })

/** Paramètres → Catégories : créer, renommer, icône/couleur, archiver. */
export function CategoriesPanel({ customCategories, usage, onChange, onRename }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const groupsFor = (kind: TransactionKind) => (kind === 'revenu' ? INCOME_CATEGORY_GROUPS : EXPENSE_CATEGORY_GROUPS)
  const mine = useMemo(
    () => customCategories.filter((c) => !isCatalogCategory(c.label, c.kind)).sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [customCategories],
  )
  const overrides = useMemo(
    () => customCategories.filter((c) => isCatalogCategory(c.label, c.kind)).sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [customCategories],
  )

  const startEdit = (category: CustomCategory) => {
    setEditing(category.label)
    setForm({
      label: category.label,
      kind: category.kind,
      emoji: category.emoji ?? '',
      color: category.color ?? colorForCategory(category.label),
      group: category.group ?? '',
    })
    setError(null)
  }

  const cancel = () => {
    setEditing(null)
    setForm(emptyForm())
    setError(null)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const label = form.label.trim()
    const isOverride = isCatalogCategory(label, form.kind)
    const validation = isOverride ? null : validateCategoryLabel(label, form.kind, customCategories, editing ?? undefined)
    if (validation) {
      setError(ERRORS[validation])
      return
    }
    const entry: CustomCategory = {
      label,
      kind: form.kind,
      emoji: form.emoji.trim() || undefined,
      color: /^#[0-9a-f]{6}$/i.test(form.color) ? form.color : undefined,
      group: form.group || undefined,
      archivedAt: null,
      createdAt: customCategories.find((c) => c.label === editing)?.createdAt ?? Date.now(),
    }
    if (editing && editing !== label) {
      onChange([...customCategories.filter((c) => c.label !== editing), entry])
      onRename(editing, label)
    } else {
      onChange([...customCategories.filter((c) => c.label !== label), entry])
    }
    cancel()
  }

  const toggleArchive = (category: CustomCategory) => {
    onChange(
      customCategories.map((c) =>
        c.label === category.label ? { ...c, archivedAt: c.archivedAt ? null : Date.now() } : c,
      ),
    )
  }

  const remove = (category: CustomCategory) => {
    onChange(customCategories.filter((c) => c.label !== category.label))
  }

  const row = (category: CustomCategory, isOverride: boolean) => {
    const used = usage[category.label] ?? 0
    return (
      <li key={`${category.kind}-${category.label}`} className={`categories-row${category.archivedAt ? ' categories-row--archived' : ''}`}>
        <span className="categories-row__icon" style={{ background: category.color ?? colorForCategory(category.label) }} aria-hidden="true">
          {category.emoji ?? categoryEmoji(category.label)}
        </span>
        <span className="categories-row__main">
          <strong>{category.label}</strong>
          <small>
            {category.kind === 'revenu' ? 'Revenu' : 'Dépense'}
            {category.group ? ` · ${category.group}` : isOverride ? '' : ` · ${MY_CATEGORIES_GROUP}`}
            {used > 0 ? ` · ${used} opération${used > 1 ? 's' : ''}` : ''}
            {category.archivedAt ? ' · archivée' : ''}
          </small>
        </span>
        <span className="categories-row__actions">
          <button type="button" onClick={() => startEdit(category)} title="Modifier" aria-label={`Modifier ${category.label}`}>
            <Pencil size={14} />
          </button>
          {!isOverride ? (
            <button
              type="button"
              onClick={() => toggleArchive(category)}
              title={category.archivedAt ? 'Réactiver' : 'Archiver (masquer des listes)'}
              aria-label={category.archivedAt ? `Réactiver ${category.label}` : `Archiver ${category.label}`}
            >
              {category.archivedAt ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </button>
          ) : null}
          <button
            type="button"
            className="goal-delete"
            onClick={() => remove(category)}
            disabled={!isOverride && used > 0}
            title={
              isOverride
                ? "Retirer la personnalisation (retour à l'icône et la couleur d'origine)"
                : used > 0
                  ? 'Utilisée par des opérations : renommez-la vers une autre catégorie ou archivez-la'
                  : 'Supprimer'
            }
            aria-label={`Supprimer ${category.label}`}
          >
            <Trash2 size={14} />
          </button>
        </span>
      </li>
    )
  }

  return (
    <div className="categories-panel">
      <form className="goals-form categories-form" onSubmit={submit}>
        <h3>{editing ? `Modifier « ${editing} »` : 'Nouvelle catégorie'}</h3>
        <div className="goals-form-row">
          <label>
            Nom
            <input
              type="text"
              value={form.label}
              onChange={(event) => setForm((p) => ({ ...p, label: event.target.value }))}
              placeholder="Ex : Chien, Voiture, Études…"
              maxLength={40}
              list="categories-catalog"
            />
            <datalist id="categories-catalog">
              {groupsFor(form.kind).flatMap((g) => g.options).map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
          <label>
            Type
            <select value={form.kind} onChange={(event) => setForm((p) => ({ ...p, kind: event.target.value as TransactionKind, group: '' }))} disabled={!!editing}>
              <option value="depense">Dépense</option>
              <option value="revenu">Revenu</option>
            </select>
          </label>
        </div>
        <div className="goals-form-row">
          <label>
            Icône
            <input
              type="text"
              value={form.emoji}
              onChange={(event) => setForm((p) => ({ ...p, emoji: event.target.value.slice(0, 8) }))}
              placeholder="🐶"
              className="categories-emoji-input"
            />
            <span className="categories-emoji-presets" role="group" aria-label="Icônes suggérées">
              {EMOJI_PRESETS.map((emoji) => (
                <button key={emoji} type="button" className={form.emoji === emoji ? 'active' : ''} onClick={() => setForm((p) => ({ ...p, emoji }))}>
                  {emoji}
                </button>
              ))}
            </span>
          </label>
          <label>
            Couleur
            <input type="color" value={form.color} onChange={(event) => setForm((p) => ({ ...p, color: event.target.value }))} />
          </label>
          <label>
            Famille
            <select value={form.group} onChange={(event) => setForm((p) => ({ ...p, group: event.target.value }))}>
              <option value="">{MY_CATEGORIES_GROUP}</option>
              {groupsFor(form.kind).map((group) => (
                <option key={group.label} value={group.label}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="auth-note">
          Saisissez un nom du catalogue (ex : Courses) pour seulement changer son icône ou sa couleur.
        </p>
        {error ? <p className="goals-error">{error}</p> : null}
        <div className="goals-form-actions">
          <button type="submit" className="hero-cta-button">
            <Plus size={16} />
            {editing ? 'Enregistrer' : 'Ajouter'}
          </button>
          {editing ? (
            <button type="button" className="ghost-button" onClick={cancel}>
              Annuler
            </button>
          ) : null}
        </div>
      </form>

      <section className="goals-section">
        <h3>Mes catégories ({mine.length})</h3>
        {mine.length === 0 ? (
          <p className="goals-empty">Aucune catégorie personnalisée. Le catalogue en propose déjà une quarantaine ; ajoutez les vôtres ci-dessus.</p>
        ) : (
          <ul className="categories-list">{mine.map((c) => row(c, false))}</ul>
        )}
      </section>

      {overrides.length > 0 ? (
        <section className="goals-section">
          <h3>Catégories du catalogue personnalisées ({overrides.length})</h3>
          <ul className="categories-list">{overrides.map((c) => row(c, true))}</ul>
        </section>
      ) : null}
    </div>
  )
}
