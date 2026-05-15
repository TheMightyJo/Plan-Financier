export type FamilyMember = string

export type UserProfile = {
  id: string
  name: string
  monthlyBudget: number
}

export type TransactionKind = 'depense' | 'revenu'

export type Category =
  | 'Courses'
  | 'Transport'
  | 'Ecole'
  | 'Loisirs'
  | 'Sante'
  | 'Maison'
  | 'Autre'

export type Envelope = 'Perso' | 'Maison' | 'Vacances'

export type Transaction = {
  id: number
  label: string
  amount: number
  category: Category
  member: FamilyMember
  date: string
  kind: TransactionKind
  envelope: Envelope
  /**
   * Compte sur lequel l'opération est imputée. Optionnel pour rétro-compat
   * avec les anciennes transactions stockées avant l'introduction des
   * comptes ; la migration `migrateTransactionsToDefaultAccount` les
   * rebascule sur le compte par défaut au premier mount.
   */
  accountId?: string
}

// ── Comptes (mirror SQL accounts) ────────────────────────────────────────────
// Quand on basculera sur Supabase (cf. supabase/migrations/0001_initial_schema.sql),
// `ownerMember` deviendra `owner_user_id` (FK profiles).

export const ACCOUNT_TYPES = [
  'checking',     // compte courant
  'savings',      // livret / épargne
  'cash',         // espèces
  'envelope',     // enveloppe budgétaire virtuelle
  'credit_card',  // carte de crédit
  'investment',   // investissement (PEA, AV, broker…)
] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Compte courant',
  savings: 'Livret / Épargne',
  cash: 'Espèces',
  envelope: 'Enveloppe',
  credit_card: 'Carte de crédit',
  investment: 'Investissement',
}

export type Account = {
  id: string
  ownerMember: FamilyMember
  name: string
  type: AccountType
  currency: string             // ISO 4217, défaut 'EUR'
  initialBalance: number       // solde d'ouverture (peut être négatif pour CC)
  displayColor: string | null  // hex
  displayIcon: string | null   // nom Tabler/Lucide icon
  archivedAt: number | null
  createdAt: number
  updatedAt: number
}

export type SavingsGoals = Record<FamilyMember, Record<Category, number>>

export type RolloverState = {
  month: string
  carryOver: Record<FamilyMember, number>
}

export type CsvPreviewRow = {
  id: number
  date: string
  label: string
  amount: number
  kind: TransactionKind
  category: Category
  duplicate: boolean
  duplicateReason?: string
}

export type CsvColumnMapping = {
  date: string
  label: string
  amount: string
  type: string
}

export type CsvRawData = {
  headers: string[]
  rows: string[][]
}

export type StoredCsvMappings = Record<string, CsvColumnMapping>

export type EncryptedBackup = {
  version: number
  createdAt: number
  salt: string
  iv: string
  cipher: string
}

export type BackupPayload = {
  profiles: UserProfile[]
  activeProfileId: string
  defaultProfileId: string
  transactions: Transaction[]
  savingsGoals: SavingsGoals
  rolloverState: RolloverState
  storedCsvMappings: StoredCsvMappings
}

export type ChatThread = {
  id: string
  label: string
  lastActivityAt: number
}

export type SavingsTarget = {
  id: string
  label: string
  targetAmount: number
  // Extensions V1 (optionnels = rétro-compat avec les SavingsTarget historiques).
  // Mirror partiel de la table savings_goals (cf. supabase/migrations/0001).
  /** YYYY-MM-DD. Sans date : pas de mensualité conseillée calculable. */
  targetDate?: string
  /** Si renseigné : progression = solde de ce compte (auto). */
  destinationAccountId?: string
  /** Si pas de compte lié : montant manuellement saisi par l'utilisateur. */
  currentSaved?: number
  /** Hex (depuis charte) — utilisé pour la barre de progression. */
  displayColor?: string
  /** Timestamp epoch ms quand l'objectif est atteint (verrou). */
  achievedAt?: number
  /** Propriétaire ; deviendra owner_user_id en Supabase. */
  member?: FamilyMember
  createdAt?: number
  updatedAt?: number
}

export type AlertItem = { message: string; level: 'info' | 'warning' | 'danger' }

export type AIProviderId = 'anthropic' | 'openai' | 'mistral' | 'google' | 'openrouter'

// Règles de dépenses récurrentes (loyer, abonnements, assurances…).
// Le champ `member` reflète le profile actuel — quand on basculera sur Supabase
// (cf. supabase/migrations/0001_initial_schema.sql table recurring_rules),
// `member` deviendra `account_id` (FK vers accounts).
export const RECURRING_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number]

export type RecurringRule = {
  id: string
  member: FamilyMember
  category: Category
  envelope: Envelope
  label: string
  amount: number               // toujours > 0
  kind: TransactionKind        // depense | revenu
  frequency: RecurringFrequency
  /**
   * 1..7 si frequency = 'weekly' (1 = lundi, 7 = dimanche, ISO 8601).
   * 1..31 sinon (jour du mois ; clamp au dernier jour du mois si invalide).
   */
  dayOfPeriod: number
  startDate: string            // YYYY-MM-DD
  endDate: string | null
  lastGeneratedOn: string | null
  pausedAt: number | null      // timestamp epoch ms
  createdAt: number
  updatedAt: number
}

export type DashboardWidgetId =
  | 'annualTrend'
  | 'coaching'
  | 'csvImport'
  | 'alerts'
  | 'savingsGoals'
  | 'recurringCharges'
  | 'savingsProjects'
  | 'expenseCalendar'

export type DashboardWidgetTemplateId = 'essentiel' | 'equilibre' | 'analytique' | 'custom'
export type DashboardWidgetSize = 'compact' | 'medium' | 'large'
export type DashboardWidgetSizes = Partial<Record<DashboardWidgetId, DashboardWidgetSize>>
export type DashboardWidgetState = {
  templateId: DashboardWidgetTemplateId
  visibleWidgets: DashboardWidgetId[]
  widgetSizes: DashboardWidgetSizes
}
