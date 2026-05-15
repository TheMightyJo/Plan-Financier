import type { RecurringRule, FamilyMember } from '../types'
import { RECURRING_FREQUENCIES } from '../types'

/**
 * Repo localStorage pour les règles récurrentes.
 *
 * Quand on basculera sur Supabase (cf. supabase/migrations/0001_initial_schema.sql),
 * l'API publique de ce repo reste compatible — il suffira de remplacer
 * l'implémentation par des appels au client Supabase.
 */

const STORAGE_KEY = 'plan-financier-recurring-rules-v1'

const isValidStored = (value: unknown): value is RecurringRule => {
  if (!value || typeof value !== 'object') return false
  const r = value as Partial<RecurringRule>
  return (
    typeof r.id === 'string' &&
    typeof r.member === 'string' &&
    typeof r.category === 'string' &&
    typeof r.envelope === 'string' &&
    typeof r.label === 'string' &&
    typeof r.amount === 'number' &&
    (r.kind === 'depense' || r.kind === 'revenu') &&
    typeof r.frequency === 'string' &&
    RECURRING_FREQUENCIES.includes(r.frequency as never) &&
    typeof r.dayOfPeriod === 'number' &&
    typeof r.startDate === 'string' &&
    (r.endDate === null || typeof r.endDate === 'string') &&
    (r.lastGeneratedOn === null || typeof r.lastGeneratedOn === 'string') &&
    (r.pausedAt === null || typeof r.pausedAt === 'number')
  )
}

export const loadRecurringRules = (): RecurringRule[] => {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidStored)
  } catch {
    return []
  }
}

export const saveRecurringRules = (rules: RecurringRule[]): void => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `rule-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

/**
 * Crée une nouvelle règle à partir d'une saisie partielle. Remplit createdAt,
 * updatedAt, id ; pose lastGeneratedOn / pausedAt à null.
 */
export const buildRecurringRule = (
  partial: Omit<RecurringRule, 'id' | 'createdAt' | 'updatedAt' | 'lastGeneratedOn' | 'pausedAt'>,
): RecurringRule => {
  const now = Date.now()
  return {
    ...partial,
    id: createId(),
    lastGeneratedOn: null,
    pausedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

export const upsertRule = (rules: RecurringRule[], next: RecurringRule): RecurringRule[] => {
  const idx = rules.findIndex((r) => r.id === next.id)
  if (idx < 0) return [...rules, next]
  const copy = rules.slice()
  copy[idx] = { ...next, updatedAt: Date.now() }
  return copy
}

export const removeRule = (rules: RecurringRule[], id: string): RecurringRule[] =>
  rules.filter((r) => r.id !== id)

export const toggleRulePause = (rules: RecurringRule[], id: string): RecurringRule[] =>
  rules.map((r) =>
    r.id === id
      ? { ...r, pausedAt: r.pausedAt === null ? Date.now() : null, updatedAt: Date.now() }
      : r,
  )

/**
 * Filtre les règles applicables à un membre (account) donné.
 * Quand on basculera sur Supabase, ce sera fait via une requête WHERE account_id.
 */
export const rulesForMember = (rules: RecurringRule[], member: FamilyMember): RecurringRule[] =>
  rules.filter((r) => r.member === member)
