import type { Category, RecurringRule, Transaction, TransactionKind } from '../types'
import { EXPENSE_CATEGORY_GROUPS, INCOME_CATEGORY_GROUPS, type CategoryGroup } from './categories'

/**
 * Catégories personnalisées : créées par l'utilisateur, ou surcharge (emoji,
 * couleur) d'une catégorie du catalogue. L'identité d'une catégorie est son
 * libellé (les opérations le stockent tel quel) ; renommer = migrer les
 * références (helpers ci-dessous). Stockage : une clé localStorage, suivie
 * par la synchro documents.
 */

export const CUSTOM_CATEGORIES_KEY = 'plan-financier-custom-categories-v1'
export const MY_CATEGORIES_GROUP = 'Mes catégories'
export const MAX_LABEL_LENGTH = 40

export type CustomCategory = {
  label: string
  kind: TransactionKind
  emoji?: string
  color?: string
  /** Groupe du catalogue où la ranger ; absent = « Mes catégories ». */
  group?: string
  archivedAt?: number | null
  createdAt: number
}

const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

export const normalizeCustomCategory = (value: unknown): CustomCategory | null => {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<CustomCategory>
  const label = typeof candidate.label === 'string' ? candidate.label.trim().slice(0, MAX_LABEL_LENGTH) : ''
  if (!label) return null
  const kind: TransactionKind = candidate.kind === 'revenu' ? 'revenu' : 'depense'
  return {
    label,
    kind,
    emoji: typeof candidate.emoji === 'string' && candidate.emoji.trim() ? candidate.emoji.trim().slice(0, 8) : undefined,
    color: isHexColor(candidate.color) ? candidate.color : undefined,
    group: typeof candidate.group === 'string' && candidate.group.trim() ? candidate.group.trim() : undefined,
    archivedAt: typeof candidate.archivedAt === 'number' ? candidate.archivedAt : null,
    createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
  }
}

export const loadCustomCategories = (storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null): CustomCategory[] => {
  if (!storage) return []
  try {
    const raw = storage.getItem(CUSTOM_CATEGORIES_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    return parsed
      .map(normalizeCustomCategory)
      .filter((c): c is CustomCategory => c !== null)
      .filter((c) => {
        const key = `${c.kind}|${c.label.toLowerCase()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  } catch {
    return []
  }
}

export const saveCustomCategories = (list: CustomCategory[], storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null): void => {
  if (!storage) return
  try {
    storage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(list))
  } catch {
    /* stockage indisponible */
  }
}

const baseGroups = (kind: TransactionKind): CategoryGroup[] =>
  kind === 'revenu' ? INCOME_CATEGORY_GROUPS : EXPENSE_CATEGORY_GROUPS

export const isCatalogCategory = (label: string, kind: TransactionKind): boolean =>
  baseGroups(kind).some((group) => group.options.includes(label))

/** Libellés du catalogue + catégories personnalisées actives, pour un type. */
export const allCategoryLabels = (kind: TransactionKind, customs: CustomCategory[]): string[] => {
  const base = baseGroups(kind).flatMap((group) => group.options)
  const extra = customs
    .filter((c) => c.kind === kind && !c.archivedAt && !base.includes(c.label))
    .map((c) => c.label)
  return [...base, ...extra]
}

/**
 * Catalogue affiché dans les sélecteurs : les catégories personnalisées
 * actives rejoignent le groupe choisi, sinon un groupe « Mes catégories »
 * placé en tête. Les surcharges de catégories existantes ne changent rien ici.
 */
export const buildCategoryGroups = (kind: TransactionKind, customs: CustomCategory[]): CategoryGroup[] => {
  const groups = baseGroups(kind).map((group) => ({ label: group.label, options: [...group.options] }))
  const mine: string[] = []
  for (const custom of customs) {
    if (custom.kind !== kind || custom.archivedAt) continue
    if (groups.some((group) => group.options.includes(custom.label))) continue
    const target = custom.group ? groups.find((group) => group.label === custom.group) : undefined
    if (target) target.options.push(custom.label)
    else mine.push(custom.label)
  }
  return mine.length > 0 ? [{ label: MY_CATEGORIES_GROUP, options: mine }, ...groups] : groups
}

export type CategoryLabelError = 'empty' | 'too_long' | 'exists'

/** Valide un nouveau libellé (ou un renommage) pour un type donné. */
export const validateCategoryLabel = (
  label: string,
  kind: TransactionKind,
  customs: CustomCategory[],
  ignoreLabel?: string,
): CategoryLabelError | null => {
  const trimmed = label.trim()
  if (!trimmed) return 'empty'
  if (trimmed.length > MAX_LABEL_LENGTH) return 'too_long'
  const lower = trimmed.toLowerCase()
  if (ignoreLabel && ignoreLabel.toLowerCase() === lower) return null
  if (allCategoryLabels(kind, customs).some((existing) => existing.toLowerCase() === lower)) return 'exists'
  return null
}

/** Surcharges (emoji / couleur) indexées par libellé, pour l'affichage. */
export const categoryOverrides = (customs: CustomCategory[]): Record<string, { emoji?: string; color?: string }> => {
  const map: Record<string, { emoji?: string; color?: string }> = {}
  for (const custom of customs) {
    if (custom.emoji || custom.color) map[custom.label] = { emoji: custom.emoji, color: custom.color }
  }
  return map
}

/** Nombre d'opérations et de règles par catégorie (pour bloquer une suppression). */
export const categoryUsage = (transactions: Transaction[], rules: RecurringRule[]): Record<string, number> => {
  const usage: Record<string, number> = {}
  for (const tx of transactions) usage[tx.category] = (usage[tx.category] ?? 0) + 1
  for (const rule of rules) usage[rule.category] = (usage[rule.category] ?? 0) + 1
  return usage
}

// ── Renommage : migration des références ─────────────────────────────────

export const renameCategoryInTransactions = (transactions: Transaction[], from: Category, to: Category): Transaction[] =>
  from === to ? transactions : transactions.map((tx) => (tx.category === from ? { ...tx, category: to } : tx))

export const renameCategoryInRules = (rules: RecurringRule[], from: Category, to: Category): RecurringRule[] =>
  from === to ? rules : rules.map((rule) => (rule.category === from ? { ...rule, category: to, updatedAt: Date.now() } : rule))

/** Plafonds par profil : { profilId: { catégorie: montant } }. */
export const renameCategoryInCaps = (
  caps: Record<string, Record<string, number>>,
  from: Category,
  to: Category,
): Record<string, Record<string, number>> => {
  if (from === to) return caps
  const next: Record<string, Record<string, number>> = {}
  for (const [profile, byCategory] of Object.entries(caps)) {
    if (!(from in byCategory)) {
      next[profile] = byCategory
      continue
    }
    const { [from]: amount, ...rest } = byCategory
    next[profile] = { ...rest, [to]: (rest[to] ?? 0) + amount }
  }
  return next
}
