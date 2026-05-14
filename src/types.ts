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
