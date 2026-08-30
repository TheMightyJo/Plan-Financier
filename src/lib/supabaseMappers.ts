import type {
  Account,
  AccountType,
  Category,
  Envelope,
  FamilyMember,
  RecurringFrequency,
  RecurringRule,
  SavingsTarget,
  Transaction,
  TransactionKind,
} from '../types'

/**
 * Mappers TS ↔ Postgres pour les entités synchronisées vers Supabase.
 *
 * Conventions :
 *   - Côté Postgres : snake_case, timestamps en ISO 8601, uuid en string
 *   - Côté TS : camelCase, dates en ISO 'YYYY-MM-DD' pour les dates métier
 *   - On NE persiste PAS côté Postgres : member (deviendra owner_user_id géré
 *     par RLS), createdAt/updatedAt côté JS (auto par triggers Postgres)
 *
 * Hypothèses sur les IDs :
 *   - Account.id, RecurringRule.id, SavingsTarget.id : déjà string (uuid-ready)
 *   - Transaction.id : actuellement number — la conversion vers string (uuid)
 *     se fait dans transactionFromRow (Postgres → TS) via le hash du uuid,
 *     ET dans transactionToRow on accepte un client-provided uuid (étape 2.B).
 *
 * Cf. supabase/migrations/0001_initial_schema.sql pour le schéma cible.
 */

// ── Helpers de conversion d'ID ───────────────────────────────────────────

/**
 * Convertit une représentation client d'id (number ou string) en uuid Postgres.
 * - Si déjà uuid → passe tel quel
 * - Si number → encode dans un uuid déterministe via le namespace plan-financier
 *   pour faciliter la migration sans collision
 *
 * Format de fallback (uuid v4 simplifié, pas cryptographique) :
 *   {8x}-{4x}-{4x}-{4x}-{12x}
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ensureUuid = (id: string | number): string => {
  const str = String(id)
  if (UUID_RE.test(str)) return str
  // Génération déterministe basique à partir d'un nombre/string legacy :
  // hash 32 bits (Mulberry-like) → 4 segments hex pour combler le format uuid.
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  const a = hex(h)
  const b = hex(Math.imul(h, 31))
  const c = hex(Math.imul(h, 1009))
  const d = hex(Math.imul(h, 9301))
  return `${a.slice(0, 8)}-${a.slice(0, 4)}-${b.slice(0, 4)}-${c.slice(0, 4)}-${d}${b.slice(0, 4)}`
}

/**
 * Génère un uuid v4 cryptographique. Utilisé pour les NOUVELLES entités
 * créées côté client (post-migration, on stocke directement en string).
 */
export const newUuid = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Math.random().toString(16).slice(2, 10)}-${Math.random()
        .toString(16)
        .slice(2, 6)}-4${Math.random().toString(16).slice(2, 5)}-${Math.random()
        .toString(16)
        .slice(2, 6)}-${Math.random().toString(16).slice(2, 14)}`

// ── Account ──────────────────────────────────────────────────────────────

export type AccountRow = {
  id: string
  owner_user_id: string | null
  family_group_id: string | null
  name: string
  type: AccountType
  currency: string
  initial_balance: number
  display_color: string | null
  display_icon: string | null
  archived_at: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export const accountToRow = (account: Account, ownerUserId: string): Omit<AccountRow, 'created_at' | 'updated_at'> => ({
  id: ensureUuid(account.id),
  owner_user_id: ownerUserId,
  family_group_id: null, // V1 = perso uniquement, mode famille en étape 3
  name: account.name,
  type: account.type,
  currency: account.currency,
  initial_balance: account.initialBalance,
  display_color: account.displayColor,
  display_icon: account.displayIcon,
  archived_at: account.archivedAt ? new Date(account.archivedAt).toISOString() : null,
})

export const accountFromRow = (row: AccountRow): Account => ({
  id: row.id,
  ownerMember: row.owner_user_id ?? '',
  name: row.name,
  type: row.type,
  currency: row.currency,
  initialBalance: Number(row.initial_balance),
  displayColor: row.display_color,
  displayIcon: row.display_icon,
  archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
})

// ── Transaction ──────────────────────────────────────────────────────────

export type TransactionRow = {
  id: string
  account_id: string
  category_id: string | null  // null en V1 (catégories système non liées via FK)
  amount: number
  kind: 'debit' | 'credit' | 'transfer'  // contrainte CHECK côté SQL
  occurred_at: string  // YYYY-MM-DD
  label: string
  notes: string | null
  paid_by_user_id: string | null
  created_by_user_id: string
  recurring_rule_id: string | null
  receipt_storage_path: string | null
  ai_categorized: boolean
  transfer_group_id: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

/**
 * Métadonnées client rangées dans `notes` (colonne text libre du schéma) pour
 * garantir un aller-retour SANS PERTE : catégorie, enveloppe, profil local et
 * id numérique d'origine (le schéma SQL n'a pas (encore) ces colonnes).
 */
type TransactionMeta = {
  pf: 1
  cat: Category
  env: Envelope
  member: FamilyMember
  localId: number
  rec?: string
  tags?: string[]
  icon?: string
  /** Mois de budget YYYY-MM quand différent du mois de la date. */
  bm?: string
}

const encodeTransactionMeta = (transaction: Transaction): string =>
  JSON.stringify({
    pf: 1,
    cat: transaction.category,
    env: transaction.envelope,
    member: transaction.member,
    localId: transaction.id,
    ...(transaction.recurringRuleId ? { rec: transaction.recurringRuleId } : {}),
    ...(transaction.tags && transaction.tags.length > 0 ? { tags: transaction.tags } : {}),
    ...(transaction.icon ? { icon: transaction.icon } : {}),
    ...(transaction.budgetMonth ? { bm: transaction.budgetMonth } : {}),
  } satisfies TransactionMeta)

const decodeTransactionMeta = (notes: string | null): Partial<TransactionMeta> => {
  if (!notes) return {}
  try {
    const parsed = JSON.parse(notes) as Partial<TransactionMeta>
    return parsed && parsed.pf === 1 ? parsed : {}
  } catch {
    return {}
  }
}

/** Mapping kind local ↔ contrainte CHECK SQL (debit/credit/transfer). */
const kindToRow = (kind: TransactionKind): 'debit' | 'credit' =>
  kind === 'revenu' ? 'credit' : 'debit'

const kindFromRow = (kind: TransactionRow['kind']): TransactionKind =>
  kind === 'credit' ? 'revenu' : 'depense'

/**
 * Convertit une Transaction TS vers le format Postgres.
 * category/envelope/member/id d'origine voyagent dans `notes` (JSON) —
 * cf. TransactionMeta — en attendant des colonnes dédiées (étape 2.B).
 */
export const transactionToRow = (
  transaction: Transaction,
  createdByUserId: string,
): Omit<TransactionRow, 'created_at' | 'updated_at'> => ({
  id: ensureUuid(transaction.id),
  account_id: transaction.accountId ? ensureUuid(transaction.accountId) : ensureUuid('orphan'),
  category_id: null, // FK catégories SQL non mappée en 2.A
  amount: transaction.amount,
  kind: kindToRow(transaction.kind),
  occurred_at: transaction.date,
  label: transaction.label,
  notes: encodeTransactionMeta(transaction),
  paid_by_user_id: createdByUserId, // V1 mono-profil = même user que créateur
  created_by_user_id: createdByUserId,
  recurring_rule_id: null,
  receipt_storage_path: null,
  ai_categorized: false,
  transfer_group_id: null,
})

/**
 * Convertit une row Postgres en Transaction TS. Les métadonnées `notes`
 * restaurent catégorie/enveloppe/profil/id d'origine ; fallbacks sûrs pour
 * les rows écrites sans meta (anciens pushes 2.A).
 */
export const transactionFromRow = (row: TransactionRow): Transaction => {
  const meta = decodeTransactionMeta(row.notes)
  return {
    id: typeof meta.localId === 'number' ? meta.localId : hashUuidToNumber(row.id),
    label: row.label,
    amount: Number(row.amount),
    category: meta.cat ?? ('Autre' as Category),
    member: meta.member ?? '',
    date: row.occurred_at,
    kind: kindFromRow(row.kind),
    envelope: meta.env ?? ('Perso' as Envelope),
    ...(meta.rec ? { recurringRuleId: meta.rec } : {}),
    ...(Array.isArray(meta.tags) && meta.tags.length > 0 ? { tags: meta.tags } : {}),
    ...(typeof meta.icon === 'string' && meta.icon ? { icon: meta.icon } : {}),
    ...(typeof meta.bm === 'string' && /^\d{4}-\d{2}$/.test(meta.bm) ? { budgetMonth: meta.bm } : {}),
    accountId: row.account_id,
  }
}

/**
 * Hash déterministe uuid → number stable (pour la rétrocompatibilité avec
 * Transaction.id: number en attendant la migration 2.B). Conserve l'ordre
 * d'insertion dans une certaine mesure.
 */
const hashUuidToNumber = (uuid: string): number => {
  let h = 0
  for (let i = 0; i < uuid.length; i += 1) {
    h = (h * 31 + uuid.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// ── RecurringRule ────────────────────────────────────────────────────────

export type RecurringRuleRow = {
  id: string
  account_id: string
  category_id: string | null
  label: string
  amount: number
  kind: 'debit' | 'credit'
  frequency: RecurringFrequency
  day_of_period: number
  start_date: string
  end_date: string | null
  last_generated_on: string | null
  paused_at: string | null
  created_at?: string
  updated_at?: string
}

export const recurringRuleToRow = (
  rule: RecurringRule,
  defaultAccountId: string,
): Omit<RecurringRuleRow, 'created_at' | 'updated_at'> => ({
  id: ensureUuid(rule.id),
  account_id: ensureUuid(defaultAccountId),
  category_id: null,
  label: rule.label,
  amount: rule.amount,
  kind: rule.kind === 'depense' ? 'debit' : 'credit',
  frequency: rule.frequency,
  day_of_period: rule.dayOfPeriod,
  start_date: rule.startDate,
  end_date: rule.endDate,
  last_generated_on: rule.lastGeneratedOn,
  paused_at: rule.pausedAt ? new Date(rule.pausedAt).toISOString() : null,
})

export const recurringRuleFromRow = (row: RecurringRuleRow): RecurringRule => ({
  id: row.id,
  member: '' as FamilyMember,
  category: 'Autre' as Category,
  envelope: 'Perso' as Envelope,
  label: row.label,
  amount: Number(row.amount),
  kind: row.kind === 'debit' ? 'depense' : 'revenu',
  frequency: row.frequency,
  dayOfPeriod: row.day_of_period,
  startDate: row.start_date,
  endDate: row.end_date,
  lastGeneratedOn: row.last_generated_on,
  pausedAt: row.paused_at ? new Date(row.paused_at).getTime() : null,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
})

// ── SavingsGoal ──────────────────────────────────────────────────────────

export type SavingsGoalRow = {
  id: string
  owner_user_id: string | null
  family_group_id: string | null
  label: string
  target_amount: number
  target_date: string | null
  destination_account_id: string | null
  display_color: string | null
  achieved_at: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export const savingsGoalToRow = (
  goal: SavingsTarget,
  ownerUserId: string,
): Omit<SavingsGoalRow, 'created_at' | 'updated_at'> => ({
  id: ensureUuid(goal.id),
  owner_user_id: ownerUserId,
  family_group_id: null,
  label: goal.label,
  target_amount: goal.targetAmount,
  target_date: goal.targetDate ?? null,
  destination_account_id: goal.destinationAccountId
    ? ensureUuid(goal.destinationAccountId)
    : null,
  display_color: goal.displayColor ?? null,
  achieved_at: goal.achievedAt ? new Date(goal.achievedAt).toISOString() : null,
})

export const savingsGoalFromRow = (row: SavingsGoalRow): SavingsTarget => ({
  id: row.id,
  label: row.label,
  targetAmount: Number(row.target_amount),
  targetDate: row.target_date ?? undefined,
  destinationAccountId: row.destination_account_id ?? undefined,
  currentSaved: undefined, // currentSaved est dérivé du compte ou manuel
  displayColor: row.display_color ?? undefined,
  achievedAt: row.achieved_at ? new Date(row.achieved_at).getTime() : undefined,
  member: row.owner_user_id ?? undefined,
  createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
})
