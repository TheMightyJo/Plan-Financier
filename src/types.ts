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
