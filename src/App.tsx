import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import AuthScreen from './AuthScreen'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  PiggyBank,
  TrendingUp,
  Wallet,
  Sparkles,
  Plus,
  BellRing,
  Upload,
  FileSpreadsheet,
  Download,
  ChevronDown,
  ChevronUp,
  Layers3,
  Brain,
  Landmark,
  Pencil,
  Trash2,
  X,
  MessageCircle,
  Send,
  Bot,
  Repeat2,
  Target,
  ArrowUp,
  ArrowDown,
  Zap,
  GripVertical,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import {
  addPinChangeLog,
  clearPinChangeLogs,
  defaultSensitiveState,
  loadSensitiveState,
  loadPinChangeLogs,
  resetSensitiveStorage,
  SESSION_DURATION_OPTIONS,
  saveSensitiveState,
  type AuthRole,
  type PinChangeLog,
  type SensitiveState,
} from './security'

type FamilyMember = string
type UserProfile = {
  id: string
  name: string
  monthlyBudget: number
}
type TransactionKind = 'depense' | 'revenu'
type Category =
  | 'Courses'
  | 'Transport'
  | 'Ecole'
  | 'Loisirs'
  | 'Sante'
  | 'Maison'
  | 'Autre'

type Envelope = 'Perso' | 'Maison' | 'Vacances'

type Transaction = {
  id: number
  label: string
  amount: number
  category: Category
  member: FamilyMember
  date: string
  kind: TransactionKind
  envelope: Envelope
}

type SavingsGoals = Record<FamilyMember, Record<Category, number>>

type RolloverState = {
  month: string
  carryOver: Record<FamilyMember, number>
}

type CsvPreviewRow = {
  id: number
  date: string
  label: string
  amount: number
  kind: TransactionKind
  category: Category
  duplicate: boolean
  duplicateReason?: string
}

type CsvColumnMapping = {
  date: string
  label: string
  amount: string
  type: string
}

type CsvRawData = {
  headers: string[]
  rows: string[][]
}

type StoredCsvMappings = Record<string, CsvColumnMapping>

type EncryptedBackup = {
  version: number
  createdAt: number
  salt: string
  iv: string
  cipher: string
}

type BackupPayload = {
  profiles: UserProfile[]
  activeProfileId: string
  defaultProfileId: string
  transactions: Transaction[]
  savingsGoals: SavingsGoals
  rolloverState: RolloverState
  storedCsvMappings: StoredCsvMappings
}

type ChatThread = {
  id: string
  label: string
  lastActivityAt: number
}

type SavingsTarget = {
  id: string
  label: string
  targetAmount: number
}

type AlertItem = { message: string; level: 'info' | 'warning' | 'danger' }
type DashboardWidgetId =
  | 'annualTrend'
  | 'coaching'
  | 'csvImport'
  | 'alerts'
  | 'savingsGoals'
  | 'recurringCharges'
  | 'savingsProjects'
  | 'expenseCalendar'
type DashboardWidgetTemplateId = 'essentiel' | 'equilibre' | 'analytique' | 'custom'
type DashboardWidgetSize = 'compact' | 'large'
type DashboardWidgetSizes = Partial<Record<DashboardWidgetId, DashboardWidgetSize>>
type DashboardWidgetState = {
  templateId: DashboardWidgetTemplateId
  visibleWidgets: DashboardWidgetId[]
  widgetSizes: DashboardWidgetSizes
}

const TRANSACTIONS_STORAGE_KEY = 'plan-financier-transactions-v1'
const ANTHROPIC_KEY_STORAGE = 'plan-financier-anthropic-key-v1'
const CHAT_HISTORY_STORAGE_PREFIX = 'plan-financier-chat-history-v1'
const CHAT_THREADS_STORAGE_PREFIX = 'plan-financier-chat-threads-v1'
const MAX_CHAT_THREADS_PER_SCOPE = 8
const ROLLOVER_STORAGE_KEY = 'plan-financier-rollover-v1'
const GOALS_STORAGE_KEY = 'plan-financier-goals-v1'
const CSV_MAPPINGS_STORAGE_KEY = 'plan-financier-csv-mappings-v1'
const PROFILES_STORAGE_KEY = 'plan-financier-profiles-v1'
const ACTIVE_PROFILE_STORAGE_KEY = 'plan-financier-active-profile-v1'
const DEFAULT_PROFILE_STORAGE_KEY = 'plan-financier-default-profile-v1'
const BACKUP_VERSION = 1
const SAVINGS_TARGETS_STORAGE_KEY = 'plan-financier-savings-targets-v1'
const ONBOARDING_DONE_KEY = 'plan-financier-onboarding-done-v1'
const THEME_STORAGE_KEY = 'plan-financier-theme-v1'
const DASHBOARD_WIDGETS_STORAGE_KEY = 'plan-financier-dashboard-widgets-v1'
const DEFAULT_CHAT_THREAD: ChatThread = { id: 'general', label: 'Général', lastActivityAt: 0 }

const DASHBOARD_WIDGET_LIBRARY: Array<{ id: DashboardWidgetId; label: string }> = [
  { id: 'annualTrend', label: 'Tendance annuelle' },
  { id: 'coaching', label: 'Coaching financier' },
  { id: 'csvImport', label: 'Import CSV bancaire' },
  { id: 'alerts', label: 'Alertes intelligentes' },
  { id: 'savingsGoals', label: "Objectifs d'épargne" },
  { id: 'recurringCharges', label: 'Charges récurrentes' },
  { id: 'savingsProjects', label: "Objectifs d'épargne projet" },
  { id: 'expenseCalendar', label: 'Calendrier des dépenses' },
]

const DASHBOARD_WIDGET_TEMPLATES: Array<{
  id: Exclude<DashboardWidgetTemplateId, 'custom'>
  label: string
  description: string
  widgets: DashboardWidgetId[]
}> = [
  {
    id: 'essentiel',
    label: 'Essentiel',
    description: 'Vue courte pour aller droit au but.',
    widgets: ['annualTrend', 'alerts', 'savingsGoals', 'expenseCalendar'],
  },
  {
    id: 'equilibre',
    label: 'Équilibré',
    description: 'Bon compromis suivi + actions.',
    widgets: ['annualTrend', 'coaching', 'alerts', 'savingsGoals', 'expenseCalendar'],
  },
  {
    id: 'analytique',
    label: 'Analytique',
    description: 'Vision complète avec import et récurrences.',
    widgets: ['annualTrend', 'coaching', 'csvImport', 'alerts', 'savingsGoals', 'recurringCharges', 'savingsProjects', 'expenseCalendar'],
  },
]

const isDashboardWidgetId = (value: unknown): value is DashboardWidgetId =>
  typeof value === 'string' && DASHBOARD_WIDGET_LIBRARY.some((entry) => entry.id === value)

const getDefaultDashboardWidgetSize = (widgetId: DashboardWidgetId): DashboardWidgetSize => {
  if (widgetId === 'annualTrend' || widgetId === 'csvImport' || widgetId === 'expenseCalendar') {
    return 'large'
  }

  return 'compact'
}

const buildDashboardWidgetSizes = (widgetIds: DashboardWidgetId[], previousSizes: DashboardWidgetSizes = {}) =>
  widgetIds.reduce<DashboardWidgetSizes>((accumulator, widgetId) => {
    accumulator[widgetId] = previousSizes[widgetId] ?? getDefaultDashboardWidgetSize(widgetId)
    return accumulator
  }, {})

const normalizeDashboardWidgetOrder = (widgetIds: DashboardWidgetId[]) => {
  const seen = new Set<DashboardWidgetId>()
  return widgetIds.filter((widgetId) => {
    if (seen.has(widgetId)) return false
    seen.add(widgetId)
    return true
  })
}

const defaultDashboardWidgetState = (): DashboardWidgetState => {
  const fallbackTemplate = DASHBOARD_WIDGET_TEMPLATES.find((template) => template.id === 'equilibre') ?? DASHBOARD_WIDGET_TEMPLATES[0]
  return {
    templateId: fallbackTemplate.id,
    visibleWidgets: [...fallbackTemplate.widgets],
    widgetSizes: buildDashboardWidgetSizes(fallbackTemplate.widgets),
  }
}

const loadDashboardWidgetState = (): DashboardWidgetState => {
  const raw = window.localStorage.getItem(DASHBOARD_WIDGETS_STORAGE_KEY)
  if (!raw) return defaultDashboardWidgetState()

  try {
    const parsed = JSON.parse(raw) as Partial<DashboardWidgetState>
    const filteredWidgets = Array.isArray(parsed.visibleWidgets)
      ? normalizeDashboardWidgetOrder(parsed.visibleWidgets.filter((value): value is DashboardWidgetId => isDashboardWidgetId(value)))
      : []

    const allowedTemplateIds: DashboardWidgetTemplateId[] = ['essentiel', 'equilibre', 'analytique', 'custom']
    const nextTemplateId = allowedTemplateIds.includes(parsed.templateId as DashboardWidgetTemplateId)
      ? (parsed.templateId as DashboardWidgetTemplateId)
      : 'custom'

    if (filteredWidgets.length === 0) {
      return defaultDashboardWidgetState()
    }

    return {
      templateId: nextTemplateId,
      visibleWidgets: filteredWidgets,
      widgetSizes: buildDashboardWidgetSizes(filteredWidgets, parsed.widgetSizes ?? {}),
    }
  } catch {
    return defaultDashboardWidgetState()
  }
}

const defaultProfile: UserProfile = {
  id: 'principal',
  name: 'Principal',
  monthlyBudget: 2300,
}

const envelopes: Envelope[] = ['Perso', 'Maison', 'Vacances']

const categoryColors: Record<Category, string> = {
  Courses: '#f97316',
  Transport: '#14b8a6',
  Ecole: '#0ea5e9',
  Loisirs: '#f43f5e',
  Sante: '#a855f7',
  Maison: '#10b981',
  Autre: '#64748b',
}

const envelopeColors: Record<Envelope, string> = {
  Perso: '#f97316',
  Maison: '#10b981',
  Vacances: '#eab308',
}

const baseTransactions: Transaction[] = [
  {
    id: 1,
    label: 'Supermarche hebdo',
    amount: 145,
    category: 'Courses',
    member: defaultProfile.id,
    date: '2026-04-02',
    kind: 'depense',
    envelope: 'Maison',
  },
  {
    id: 2,
    label: 'Abonnement transport',
    amount: 58,
    category: 'Transport',
    member: defaultProfile.id,
    date: '2026-04-05',
    kind: 'depense',
    envelope: 'Perso',
  },
  {
    id: 3,
    label: 'Cours de piano',
    amount: 70,
    category: 'Loisirs',
    member: defaultProfile.id,
    date: '2026-04-08',
    kind: 'depense',
    envelope: 'Vacances',
  },
  {
    id: 4,
    label: 'Cantine',
    amount: 55,
    category: 'Ecole',
    member: defaultProfile.id,
    date: '2026-04-10',
    kind: 'depense',
    envelope: 'Perso',
  },
  {
    id: 5,
    label: 'Prime du mois',
    amount: 380,
    category: 'Autre',
    member: defaultProfile.id,
    date: '2026-04-11',
    kind: 'revenu',
    envelope: 'Perso',
  },
  {
    id: 6,
    label: 'Pharmacie',
    amount: 36,
    category: 'Sante',
    member: defaultProfile.id,
    date: '2026-04-17',
    kind: 'depense',
    envelope: 'Perso',
  },
  {
    id: 7,
    label: 'Argent de poche',
    amount: 90,
    category: 'Autre',
    member: defaultProfile.id,
    date: '2026-04-18',
    kind: 'revenu',
    envelope: 'Vacances',
  },
  {
    id: 8,
    label: 'Cinema',
    amount: 24,
    category: 'Loisirs',
    member: defaultProfile.id,
    date: '2026-04-21',
    kind: 'depense',
    envelope: 'Vacances',
  },
  {
    id: 9,
    label: 'Electricite',
    amount: 112,
    category: 'Maison',
    member: defaultProfile.id,
    date: '2026-04-23',
    kind: 'depense',
    envelope: 'Maison',
  },
  {
    id: 10,
    label: 'Sortie scolaire',
    amount: 44,
    category: 'Ecole',
    member: defaultProfile.id,
    date: '2026-04-25',
    kind: 'depense',
    envelope: 'Perso',
  },
]

const categories: Category[] = [
  'Courses',
  'Transport',
  'Ecole',
  'Loisirs',
  'Sante',
  'Maison',
  'Autre',
]

const defaultGoalTemplate: Record<Category, number> = {
  Courses: 320,
  Transport: 120,
  Ecole: 80,
  Loisirs: 140,
  Sante: 90,
  Maison: 260,
  Autre: 110,
}

const defaultSavingsGoals: SavingsGoals = {
  [defaultProfile.id]: defaultGoalTemplate,
}

const categoryKeywords: Array<{ category: Category; keywords: string[] }> = [
  { category: 'Courses', keywords: ['supermarche', 'courses', 'alimentation', 'carrefour'] },
  { category: 'Transport', keywords: ['transport', 'metro', 'bus', 'essence', 'train'] },
  { category: 'Ecole', keywords: ['ecole', 'cantine', 'fourniture', 'scolaire', 'cours'] },
  { category: 'Loisirs', keywords: ['cinema', 'loisir', 'sport', 'sortie', 'jeu'] },
  { category: 'Sante', keywords: ['pharmacie', 'medecin', 'sante', 'dentiste'] },
  { category: 'Maison', keywords: ['electricite', 'loyer', 'maison', 'internet', 'eau'] },
]

const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const formatTooltipValue = (
  value: number | string | ReadonlyArray<number | string> | undefined,
) => {
  const rawValue = Array.isArray(value) ? value[0] : value
  const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0)

  return euroFormatter.format(numericValue)
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const getLabelTokens = (value: string) =>
  normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2)

const computeLabelSimilarity = (left: string, right: string) => {
  const leftTokens = getLabelTokens(left)
  const rightTokens = getLabelTokens(right)

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0
  }

  const leftSet = new Set(leftTokens)
  const rightSet = new Set(rightTokens)
  const intersection = leftTokens.filter((token) => rightSet.has(token)).length
  const union = new Set([...leftSet, ...rightSet]).size

  return union === 0 ? 0 : intersection / union
}

const getDateDistanceInDays = (left: string, right: string) => {
  const leftDate = new Date(left)
  const rightDate = new Date(right)
  return Math.abs(leftDate.getTime() - rightDate.getTime()) / (1000 * 60 * 60 * 24)
}

const suggestCategoryFromLabel = (label: string): Category | null => {
  const normalized = normalizeText(label)
  if (!normalized.trim()) {
    return null
  }

  const found = categoryKeywords.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword)),
  )

  return found?.category ?? null
}

const inferEnvelope = (category: Category): Envelope => {
  if (category === 'Maison' || category === 'Courses') {
    return 'Maison'
  }

  if (category === 'Loisirs' || category === 'Autre') {
    return 'Vacances'
  }

  return 'Perso'
}

const sanitizeProfileId = (value: string) =>
  normalizeText(value).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

const normalizeProfile = (value: unknown): UserProfile | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<UserProfile>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.monthlyBudget !== 'number'
  ) {
    return null
  }

  const id = sanitizeProfileId(candidate.id)
  if (!id) {
    return null
  }

  return {
    id,
    name: candidate.name.trim() || 'Profil',
    monthlyBudget: Math.max(200, Math.round(candidate.monthlyBudget)),
  }
}

const loadProfiles = (): UserProfile[] => {
  if (typeof window === 'undefined') {
    return [defaultProfile]
  }

  try {
    const raw = window.localStorage.getItem(PROFILES_STORAGE_KEY)
    if (!raw) {
      return [defaultProfile]
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return [defaultProfile]
    }

    const cleaned = parsed
      .map((profile) => normalizeProfile(profile))
      .filter((profile): profile is UserProfile => profile !== null)

    return cleaned.length > 0 ? cleaned : [defaultProfile]
  } catch {
    return [defaultProfile]
  }
}

const saveProfiles = (profiles: UserProfile[]) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles))
}

const loadActiveProfileId = (profiles: UserProfile[]) => {
  if (typeof window === 'undefined') {
    return profiles[0]?.id ?? defaultProfile.id
  }

  const saved = window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)
  if (saved && profiles.some((profile) => profile.id === saved)) {
    return saved
  }

  return profiles[0]?.id ?? defaultProfile.id
}

const loadDefaultProfileId = (profiles: UserProfile[]) => {
  if (typeof window === 'undefined') {
    return profiles[0]?.id ?? defaultProfile.id
  }

  const saved = window.localStorage.getItem(DEFAULT_PROFILE_STORAGE_KEY)
  if (saved && profiles.some((profile) => profile.id === saved)) {
    return saved
  }

  return profiles[0]?.id ?? defaultProfile.id
}

const normalizeTransaction = (value: unknown): Transaction | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<Transaction>
  if (
    typeof candidate.id !== 'number' ||
    typeof candidate.label !== 'string' ||
    typeof candidate.amount !== 'number' ||
    typeof candidate.category !== 'string' ||
    typeof candidate.member !== 'string' ||
    typeof candidate.date !== 'string' ||
    typeof candidate.kind !== 'string'
  ) {
    return null
  }

  const legacyMember = normalizeText(candidate.member)
  const member = legacyMember === 'moi' ? defaultProfile.id : sanitizeProfileId(candidate.member)
  const category = categories.includes(candidate.category as Category)
    ? (candidate.category as Category)
    : 'Autre'
  const rawEnvelopeValue = (value as { envelope?: unknown }).envelope
  const rawEnvelope = typeof rawEnvelopeValue === 'string' ? rawEnvelopeValue : undefined
  const normalizedEnvelope = rawEnvelope === 'Fille' ? undefined : rawEnvelope
  const envelope = envelopes.includes(normalizedEnvelope as Envelope)
    ? (normalizedEnvelope as Envelope)
    : inferEnvelope(category)

  return {
    id: candidate.id,
    label: candidate.label,
    amount: candidate.amount,
    category,
    member: member || defaultProfile.id,
    date: candidate.date,
    kind: candidate.kind === 'revenu' ? 'revenu' : 'depense',
    envelope,
  }
}

const loadTransactions = () => {
  if (typeof window === 'undefined') {
    return baseTransactions
  }

  try {
    const raw = window.localStorage.getItem(TRANSACTIONS_STORAGE_KEY)
    if (!raw) {
      return baseTransactions
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return baseTransactions
    }

    const cleaned = parsed
      .map((item) => normalizeTransaction(item))
      .filter((item): item is Transaction => item !== null)
    return cleaned.length > 0 ? cleaned : baseTransactions
  } catch {
    return baseTransactions
  }
}

const buildDefaultGoalsForProfiles = (profiles: UserProfile[]): SavingsGoals =>
  profiles.reduce<SavingsGoals>((accumulator, profile) => {
    accumulator[profile.id] = { ...defaultGoalTemplate }
    return accumulator
  }, {})

const loadSavingsGoals = (profiles: UserProfile[]): SavingsGoals => {
  if (typeof window === 'undefined') {
    return buildDefaultGoalsForProfiles(profiles)
  }

  try {
    const raw = window.localStorage.getItem(GOALS_STORAGE_KEY)
    if (!raw) {
      return buildDefaultGoalsForProfiles(profiles)
    }

    const parsed = JSON.parse(raw) as Partial<SavingsGoals>
    return profiles.reduce<SavingsGoals>((accumulator, profile) => {
      const legacyGoals = profile.id === defaultProfile.id ? parsed.Moi : undefined
      accumulator[profile.id] = {
        ...defaultGoalTemplate,
        ...(legacyGoals ?? parsed[profile.id] ?? {}),
      }
      return accumulator
    }, {})
  } catch {
    return buildDefaultGoalsForProfiles(profiles)
  }
}

const loadRolloverState = (currentMonth: string, profiles: UserProfile[]): RolloverState => {
  const defaultCarryOver = profiles.reduce<Record<string, number>>((accumulator, profile) => {
    accumulator[profile.id] = 0
    return accumulator
  }, {})

  if (typeof window === 'undefined') {
    return {
      month: currentMonth,
      carryOver: defaultCarryOver,
    }
  }

  try {
    const raw = window.localStorage.getItem(ROLLOVER_STORAGE_KEY)
    if (!raw) {
      return {
        month: currentMonth,
        carryOver: defaultCarryOver,
      }
    }

    const parsed = JSON.parse(raw) as Partial<RolloverState>
    return {
      month: typeof parsed.month === 'string' ? parsed.month : currentMonth,
      carryOver: profiles.reduce<Record<string, number>>((accumulator, profile) => {
        const legacyCarry = profile.id === defaultProfile.id ? parsed.carryOver?.Moi : undefined
        const carryOverValue = Number(legacyCarry ?? parsed.carryOver?.[profile.id] ?? 0)
        accumulator[profile.id] = Number.isFinite(carryOverValue) ? carryOverValue : 0
        return accumulator
      }, {}),
    }
  } catch {
    return {
      month: currentMonth,
      carryOver: defaultCarryOver,
    }
  }
}

const loadStoredCsvMappings = (): StoredCsvMappings => {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(CSV_MAPPINGS_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as StoredCsvMappings
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const saveStoredCsvMappings = (mappings: StoredCsvMappings) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(CSV_MAPPINGS_STORAGE_KEY, JSON.stringify(mappings))
}

const loadSavingsTargets = (): SavingsTarget[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SAVINGS_TARGETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is SavingsTarget =>
        typeof item.id === 'string' &&
        typeof item.label === 'string' &&
        typeof item.targetAmount === 'number',
    )
  } catch {
    return []
  }
}

const parseCsvLine = (line: string) => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  result.push(current.trim())
  return result
}

const defaultCsvMapping: CsvColumnMapping = {
  date: '',
  label: '',
  amount: '',
  type: '',
}

const normalizeDateValue = (value: string) => {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('/')
    return `${year}-${month}-${day}`
  }

  return ''
}

const parseAmountValue = (value: string) => {
  const normalized = value.replace(/\s/g, '').replace(',', '.').replace(/€/g, '')
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : NaN
}

const normalizeChatThreadLabel = (value: string) => value.trim().replace(/\s+/g, ' ')

const createChatThreadId = (label: string) => normalizeText(label).replace(/\s+/g, '-').slice(0, 32)

const getChatThreadScopeKey = (profileId: string, month: string) =>
  `${CHAT_THREADS_STORAGE_PREFIX}:${profileId}:${month}`

const getChatHistoryStorageKey = (profileId: string, month: string, threadId: string) =>
  `${CHAT_HISTORY_STORAGE_PREFIX}:${profileId}:${month}:${threadId}`

const formatChatThreadActivity = (value: number) => {
  if (!value) {
    return 'jamais'
  }

  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  })
}

const parseCsvRawData = (content: string): CsvRawData => {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length <= 1) {
    return { headers: [], rows: [] }
  }

  return {
    headers: parseCsvLine(lines[0]),
    rows: lines.slice(1).map((line) => parseCsvLine(line)),
  }
}

const bytesToBase64 = (value: Uint8Array) => {
  let binary = ''
  value.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const base64ToBytes = (value: string) => {
  const binary = atob(value)
  const result = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index)
  }
  return result
}

const toArrayBuffer = (value: Uint8Array) =>
  value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer

const deriveBackupKey = async (pin: string, salt: Uint8Array) => {
  const encoder = new TextEncoder()
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, [
    'deriveKey',
  ])

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: 150000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

const encryptBackupPayload = async (payload: BackupPayload, pin: string): Promise<EncryptedBackup> => {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveBackupKey(pin, salt)
  const plaintext = encoder.encode(JSON.stringify(payload))
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plaintext),
  )

  return {
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    cipher: bytesToBase64(new Uint8Array(cipherBuffer)),
  }
}

const decryptBackupPayload = async (encrypted: EncryptedBackup, pin: string): Promise<BackupPayload> => {
  const decoder = new TextDecoder()
  const salt = base64ToBytes(encrypted.salt)
  const iv = base64ToBytes(encrypted.iv)
  const cipher = base64ToBytes(encrypted.cipher)
  const key = await deriveBackupKey(pin, salt)
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(cipher),
  )

  return JSON.parse(decoder.decode(plainBuffer)) as BackupPayload
}

const inferBankProfileKey = (fileName: string, headers: string[]) => {
  const normalizedName = normalizeText(fileName.replace(/\.csv$/i, ''))
  if (normalizedName) {
    return normalizedName
  }

  return normalizeText(headers.join('-')) || 'banque-generique'
}

const inferCsvMapping = (headers: string[]): CsvColumnMapping => {
  const normalizedHeaders = headers.map((header) => normalizeText(header))

  const findOriginalHeader = (candidates: string[]) => {
    const index = normalizedHeaders.findIndex((header) => candidates.includes(header))
    return index >= 0 ? headers[index] : ''
  }

  return {
    date: findOriginalHeader(['date', 'jour', 'operation date', 'date operation']),
    label: findOriginalHeader(['libelle', 'label', 'description', 'operation']),
    amount: findOriginalHeader(['montant', 'amount', 'somme', 'debit', 'credit']),
    type: findOriginalHeader(['type', 'nature', 'sens']),
  }
}

const buildTransactionSignature = (item: {
  date: string
  label: string
  amount: number
  kind: TransactionKind
  member?: FamilyMember
}) =>
  [item.date, normalizeText(item.label), item.amount.toFixed(2), item.kind, item.member ?? '']
    .join('|')

const findDuplicateReason = (
  candidate: {
    date: string
    label: string
    amount: number
    kind: TransactionKind
    member: FamilyMember
  },
  existingTransactions: Transaction[],
) => {
  const exactMatch = existingTransactions.find(
    (transaction) => buildTransactionSignature(transaction) === buildTransactionSignature(candidate),
  )

  if (exactMatch) {
    return `Doublon exact avec ${exactMatch.label}`
  }

  const fuzzyMatch = existingTransactions.find((transaction) => {
    if (transaction.member !== candidate.member || transaction.kind !== candidate.kind) {
      return false
    }

    if (Math.abs(transaction.amount - candidate.amount) > 0.01) {
      return false
    }

    if (getDateDistanceInDays(transaction.date, candidate.date) > 3) {
      return false
    }

    return computeLabelSimilarity(transaction.label, candidate.label) >= 0.72
  })

  return fuzzyMatch ? `Doublon probable avec ${fuzzyMatch.label}` : undefined
}

const parseCsvTransactions = (
  rawData: CsvRawData,
  mapping: CsvColumnMapping,
  existingTransactions: Transaction[],
  member: FamilyMember,
): CsvPreviewRow[] => {
  const dateIndex = rawData.headers.indexOf(mapping.date)
  const labelIndex = rawData.headers.indexOf(mapping.label)
  const amountIndex = rawData.headers.indexOf(mapping.amount)
  const typeIndex = rawData.headers.indexOf(mapping.type)

  if (dateIndex === -1 || labelIndex === -1 || amountIndex === -1) {
    return []
  }

  return rawData.rows.flatMap((columns, rowIndex) => {
    const date = normalizeDateValue(columns[dateIndex] ?? '')
    const label = (columns[labelIndex] ?? '').trim()
    const parsedAmount = parseAmountValue(columns[amountIndex] ?? '')
    const rawType = normalizeText(columns[typeIndex] ?? '')
    const inferredCategory = suggestCategoryFromLabel(label) ?? 'Autre'

    if (!date || !label || Number.isNaN(parsedAmount)) {
      return []
    }

    const kind: TransactionKind =
      rawType.includes('revenu') || rawType.includes('credit') || parsedAmount > 0
        ? 'revenu'
        : 'depense'

    const duplicateReason = findDuplicateReason(
      {
        date,
        label,
        amount: Math.abs(parsedAmount),
        kind,
        member,
      },
      existingTransactions,
    )

    return [
      {
        id: Date.now() + rowIndex,
        date,
        label,
        amount: Math.abs(parsedAmount),
        kind,
        category: inferredCategory,
        duplicate: !!duplicateReason,
        duplicateReason,
      },
    ]
  })
}

function App() {
  type SettingsSection = 'profiles' | 'ai' | 'security' | 'backup' | 'reset' | 'theme'
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const formatYearMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const navigateMonth = (offset: number) => {
    setSelectedMonth((previous) => {
      const [y, m] = previous.split('-').map(Number)
      const d = new Date(y, m - 1 + offset, 1)
      return formatYearMonth(d)
    })
  }
  const formatMonth = (ym: string) => {
    const s = new Date(`${ym}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  // ── Toast notifications ─────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null)
  const showToast = (message: string) => setToast({ message, key: Date.now() })
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(t)
  }, [toast])

  // ── Raccourcis clavier ←→ pour navigation mois ───────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigateMonth(-1) }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        navigateMonth(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth])

  const backupRestoreInputRef = useRef<HTMLInputElement | null>(null)
  const navItems = useMemo(
    () => [
      { id: 'overview',    label: '🏠 Accueil' },
      { id: 'operations',  label: '💳 Dépenses' },
      { id: 'budget',      label: '📅 Budget' },
    ],
    [],
  )
  const isActiveView = (sectionId: string) => activeSectionId === sectionId
  const navigateToSection = (sectionId: string) => {
    setActiveSectionId(sectionId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const [profiles, setProfiles] = useState<UserProfile[]>(loadProfiles)
  const [activeSectionId, setActiveSectionId] = useState('overview')
  const [isSecurityReady, setIsSecurityReady] = useState(false)
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false)
  const [sensitiveState, setSensitiveState] = useState<SensitiveState>(defaultSensitiveState)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authRole, setAuthRole] = useState<AuthRole>('Parent')
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(
    () => (window.localStorage.getItem(THEME_STORAGE_KEY) as 'dark' | 'light' | 'system') ?? 'system'
  )
  const [dashboardWidgetState, setDashboardWidgetState] = useState<DashboardWidgetState>(loadDashboardWidgetState)
  const isWidgetDirectMode = true
  const [widgetEditMode, setWidgetEditMode] = useState(false)
  const [draggedWidgetId, setDraggedWidgetId] = useState<DashboardWidgetId | null>(null)
  const [dragOverWidgetId, setDragOverWidgetId] = useState<DashboardWidgetId | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profiles')
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSuccess, setSettingsSuccess] = useState('')
  const [claudeTestState, setClaudeTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [claudeTestMessage, setClaudeTestMessage] = useState('')
  const [pinLogs, setPinLogs] = useState<PinChangeLog[]>([])
  const [settingsForm, setSettingsForm] = useState({
    parentPinValidation: '',
    newParentPin: '',
    confirmNewParentPin: '',
    sessionDurationDays: String(defaultSensitiveState.sessionDurationDays),
    resetPinValidation: '',
    newProfileName: '',
    newProfileBudget: '2000',
    manageProfileId: loadActiveProfileId(loadProfiles()),
    manageProfileName: '',
    manageProfileBudget: '',
  })
  const [selectedMember, setSelectedMember] = useState<FamilyMember>(() =>
    loadActiveProfileId(loadProfiles()),
  )
  const [defaultProfileId, setDefaultProfileId] = useState<FamilyMember>(() =>
    loadDefaultProfileId(loadProfiles()),
  )
  const [transactions, setTransactions] = useState<Transaction[]>(loadTransactions)
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoals>(() => loadSavingsGoals(loadProfiles()))
  const [rolloverState, setRolloverState] = useState<RolloverState>(() =>
    loadRolloverState(currentMonth, loadProfiles()),
  )
  const [goalEditor, setGoalEditor] = useState<{ category: Category; amount: string }>({
    category: 'Courses',
    amount: '',
  })
  const [smartCategory, setSmartCategory] = useState<Category | null>(null)
  const [selectedEnvelope, setSelectedEnvelope] = useState<'Tous' | Envelope>('Tous')
  const [csvBankKey, setCsvBankKey] = useState('')
  const [storedCsvMappings, setStoredCsvMappings] = useState<StoredCsvMappings>({})
  const [csvRawData, setCsvRawData] = useState<CsvRawData>({ headers: [], rows: [] })
  const [csvMapping, setCsvMapping] = useState<CsvColumnMapping>(defaultCsvMapping)
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[]>([])
  const [csvStatus, setCsvStatus] = useState('')
  const [csvImportMember, setCsvImportMember] = useState<FamilyMember>(() =>
    loadActiveProfileId(loadProfiles()),
  )
  const [form, setForm] = useState({
    label: '',
    amount: '',
    category: 'Courses' as Category,
    member: loadActiveProfileId(loadProfiles()) as FamilyMember,
    date: new Date().toISOString().slice(0, 10),
    kind: 'depense' as TransactionKind,
    envelope: 'Maison' as Envelope,
  })
  const [editingTxId, setEditingTxId] = useState<number | null>(null)
  const [deletingTxId, setDeletingTxId] = useState<number | null>(null)
  const [txSearch, setTxSearch] = useState('')
  const [txFilterKind, setTxFilterKind] = useState<'tous' | TransactionKind>('tous')
  const [txSortField, setTxSortField] = useState<'date' | 'amount'>('date')
  const [txShowAll, setTxShowAll] = useState(false)
  const [budgetChartType, setBudgetChartType] = useState<'bar' | 'line' | 'area'>('bar')
  const [budgetChartFilter, setBudgetChartFilter] = useState<'all' | 'revenus' | 'depenses' | 'net'>('all')
  const [budgetChartWindow, setBudgetChartWindow] = useState<6 | 12>(12)
  const [budgetCompareMonths, setBudgetCompareMonths] = useState(false)
  const [budgetInfoOpen, setBudgetInfoOpen] = useState<'type' | 'filter' | 'period' | 'compare' | null>(null)
  const [budgetInfoDotOpen, setBudgetInfoDotOpen] = useState<'summary' | 'budget' | 'spent' | 'remaining' | 'trend' | null>(null)
  const [budgetExportFormat, setBudgetExportFormat] = useState<'txt' | 'csv' | 'json' | 'pdf'>('pdf')
  const [budgetExportOpen, setBudgetExportOpen] = useState(false)
  const [budgetAssistantAdvice, setBudgetAssistantAdvice] = useState('')
  const [budgetAssistantError, setBudgetAssistantError] = useState('')
  const [budgetAssistantLoading, setBudgetAssistantLoading] = useState(false)
  const [budgetAssistantContextLoaded, setBudgetAssistantContextLoaded] = useState('')
  const [budgetSimpleMode, setBudgetSimpleMode] = useState(true)
  const [budgetQuickEditOpen, setBudgetQuickEditOpen] = useState(false)
  const [budgetQuickEditValue, setBudgetQuickEditValue] = useState('')
  const [budgetAiHintOpen, setBudgetAiHintOpen] = useState(false)
  const [budgetAssistantVisible, setBudgetAssistantVisible] = useState(true)
  const budgetInfoScopeRef = useRef<HTMLElement | null>(null)

  // ── Claude AI ──────────────────────────────────────────────────────────
  type ChatMessage = { role: 'user' | 'assistant'; content: string }
  const [anthropicKey, setAnthropicKey] = useState<string>(
    () => window.localStorage.getItem(ANTHROPIC_KEY_STORAGE) ?? '',
  )
  const [chatOpen, setChatOpen] = useState(false)
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([DEFAULT_CHAT_THREAD])
  const [chatThreadId, setChatThreadId] = useState(DEFAULT_CHAT_THREAD.id)
  const [chatTopicDraft, setChatTopicDraft] = useState('')
  const [chatRenameDraft, setChatRenameDraft] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

  const visibleDashboardWidgets = useMemo(
    () => new Set(dashboardWidgetState.visibleWidgets),
    [dashboardWidgetState.visibleWidgets],
  )
  const orderedVisibleDashboardWidgets = useMemo(
    () => normalizeDashboardWidgetOrder(dashboardWidgetState.visibleWidgets.filter((id) => isDashboardWidgetId(id))),
    [dashboardWidgetState.visibleWidgets],
  )
  const [activeDashboardWidgetId, setActiveDashboardWidgetId] = useState<DashboardWidgetId | null>(null)

  useEffect(() => {
    if (orderedVisibleDashboardWidgets.length === 0) {
      if (activeDashboardWidgetId !== null) {
        setActiveDashboardWidgetId(null)
      }
      return
    }

    if (!activeDashboardWidgetId || !orderedVisibleDashboardWidgets.includes(activeDashboardWidgetId)) {
      setActiveDashboardWidgetId(orderedVisibleDashboardWidgets[0])
    }
  }, [orderedVisibleDashboardWidgets, activeDashboardWidgetId])

  useEffect(() => {
    if (!budgetInfoOpen && !budgetInfoDotOpen) {
      return
    }

    const handleOutsideInfoClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      const insideBudgetPanel = !!(target && budgetInfoScopeRef.current?.contains(target))
      if (!insideBudgetPanel) {
        setBudgetInfoOpen(null)
        setBudgetInfoDotOpen(null)
      }
    }

    document.addEventListener('mousedown', handleOutsideInfoClick)
    document.addEventListener('touchstart', handleOutsideInfoClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideInfoClick)
      document.removeEventListener('touchstart', handleOutsideInfoClick)
    }
  }, [budgetInfoOpen, budgetInfoDotOpen])

  const goToDashboardWidget = (widgetId: DashboardWidgetId) => {
    if (!orderedVisibleDashboardWidgets.includes(widgetId)) return
    setActiveDashboardWidgetId(widgetId)
  }

  const goToPreviousDashboardWidget = () => {
    if (orderedVisibleDashboardWidgets.length === 0) return
    if (!activeDashboardWidgetId) {
      setActiveDashboardWidgetId(orderedVisibleDashboardWidgets[0])
      return
    }
    const currentIndex = orderedVisibleDashboardWidgets.indexOf(activeDashboardWidgetId)
    const previousIndex = currentIndex <= 0 ? orderedVisibleDashboardWidgets.length - 1 : currentIndex - 1
    setActiveDashboardWidgetId(orderedVisibleDashboardWidgets[previousIndex])
  }

  const goToNextDashboardWidget = () => {
    if (orderedVisibleDashboardWidgets.length === 0) return
    if (!activeDashboardWidgetId) {
      setActiveDashboardWidgetId(orderedVisibleDashboardWidgets[0])
      return
    }
    const currentIndex = orderedVisibleDashboardWidgets.indexOf(activeDashboardWidgetId)
    const nextIndex = currentIndex >= orderedVisibleDashboardWidgets.length - 1 ? 0 : currentIndex + 1
    setActiveDashboardWidgetId(orderedVisibleDashboardWidgets[nextIndex])
  }

  const activeDashboardWidgetIndex = activeDashboardWidgetId
    ? orderedVisibleDashboardWidgets.indexOf(activeDashboardWidgetId)
    : -1

  const isPilotageWidgetVisible = (widgetId: DashboardWidgetId) =>
    visibleDashboardWidgets.has(widgetId) && activeDashboardWidgetId === widgetId

  const applyDashboardWidgetTemplate = (templateId: Exclude<DashboardWidgetTemplateId, 'custom'>) => {
    const template = DASHBOARD_WIDGET_TEMPLATES.find((entry) => entry.id === templateId)
    if (!template) return
    setDashboardWidgetState((previous) => ({
      templateId,
      visibleWidgets: [...template.widgets],
      widgetSizes: buildDashboardWidgetSizes(template.widgets, previous.widgetSizes),
    }))
  }

  const toggleDashboardWidget = (widgetId: DashboardWidgetId) => {
    setDashboardWidgetState((previous) => {
      const alreadyVisible = previous.visibleWidgets.includes(widgetId)
      const nextVisibleWidgets = alreadyVisible
        ? previous.visibleWidgets.filter((id) => id !== widgetId)
        : [...previous.visibleWidgets, widgetId]

      return {
        templateId: 'custom',
        visibleWidgets: nextVisibleWidgets,
        widgetSizes: buildDashboardWidgetSizes(nextVisibleWidgets, previous.widgetSizes),
      }
    })
  }

  const reorderDashboardWidgets = (sourceId: DashboardWidgetId, targetId: DashboardWidgetId) => {
    if (sourceId === targetId) return

    setDashboardWidgetState((previous) => {
      const currentOrder = [...previous.visibleWidgets]
      const sourceIndex = currentOrder.indexOf(sourceId)
      const targetIndex = currentOrder.indexOf(targetId)

      if (sourceIndex === -1 || targetIndex === -1) {
        return previous
      }

      const [movedWidget] = currentOrder.splice(sourceIndex, 1)
      currentOrder.splice(targetIndex, 0, movedWidget)

      return {
        ...previous,
        templateId: 'custom',
        visibleWidgets: currentOrder,
      }
    })
  }

  const toggleDashboardWidgetSize = (widgetId: DashboardWidgetId) => {
    setDashboardWidgetState((previous) => {
      const currentSize = previous.widgetSizes[widgetId] ?? getDefaultDashboardWidgetSize(widgetId)
      const nextSize: DashboardWidgetSize = currentSize === 'large' ? 'compact' : 'large'

      return {
        ...previous,
        templateId: 'custom',
        widgetSizes: {
          ...previous.widgetSizes,
          [widgetId]: nextSize,
        },
      }
    })
  }

  const resetDashboardWidgetLayout = () => {
    setDashboardWidgetState((previous) => ({
      ...previous,
      templateId: 'custom',
      visibleWidgets: [...previous.visibleWidgets].sort(
        (left, right) =>
          DASHBOARD_WIDGET_LIBRARY.findIndex((entry) => entry.id === left) -
          DASHBOARD_WIDGET_LIBRARY.findIndex((entry) => entry.id === right),
      ),
      widgetSizes: buildDashboardWidgetSizes(previous.visibleWidgets),
    }))
    setDraggedWidgetId(null)
    setDragOverWidgetId(null)
  }

  const openWidgetFromOverview = (widgetId: DashboardWidgetId) => {
    setActiveDashboardWidgetId(widgetId)
    navigateToSection(widgetId === 'annualTrend' ? 'budget' : 'pilotage')
  }

  const handleWidgetDragStart = (event: DragEvent<HTMLElement>, widgetId: DashboardWidgetId) => {
    if (!widgetEditMode) return

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', widgetId)
    setDraggedWidgetId(widgetId)
  }

  const handleWidgetDragOver = (event: DragEvent<HTMLElement>, widgetId: DashboardWidgetId) => {
    if (!widgetEditMode) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverWidgetId(widgetId)
  }

  const handleWidgetDrop = (event: DragEvent<HTMLElement>, widgetId: DashboardWidgetId) => {
    if (!widgetEditMode) return

    event.preventDefault()
    const sourceId = (event.dataTransfer.getData('text/plain') || draggedWidgetId) as DashboardWidgetId
    if (isDashboardWidgetId(sourceId)) {
      reorderDashboardWidgets(sourceId, widgetId)
    }
    setDraggedWidgetId(null)
    setDragOverWidgetId(null)
  }

  const handleWidgetDragEnd = () => {
    setDraggedWidgetId(null)
    setDragOverWidgetId(null)
  }
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatClearConfirmOpen, setChatClearConfirmOpen] = useState(false)
  const [lastDeletedChat, setLastDeletedChat] = useState<{
    storageKey: string
    messages: ChatMessage[]
    threadLabel: string
  } | null>(null)
  const [chatUndoToastOpen, setChatUndoToastOpen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const chatInputRef = useRef<HTMLInputElement | null>(null)
  const chatHistoryReadyKeyRef = useRef('')
  const chatThreadScopeReadyRef = useRef('')
  const chatUndoTimerRef = useRef<number | null>(null)

  const [savingsTargets, setSavingsTargets] = useState<SavingsTarget[]>(() => loadSavingsTargets())
  const [savingsTargetDraft, setSavingsTargetDraft] = useState({ label: '', amount: '' })
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [predictionResult, setPredictionResult] = useState('')

  // ── Onboarding first-time ────────────────────────────────────────────
  type OnboardingMsg = { role: 'user' | 'assistant'; content: string }
  type OnboardingProviderId = 'anthropic' | 'openai' | 'mistral' | 'google' | 'openrouter'

  const ONBOARDING_PROVIDERS: Array<{
    id: OnboardingProviderId
    name: string
    modelLabel: string
    badge: string
    tone: 'violet' | 'green' | 'orange' | 'blue' | 'slate'
    logoSrc?: string
    helpUrl: string
    consoleUrl: string
    keyPlaceholder: string
    legalNote: string
    supported: boolean
  }> = [
    {
      id: 'anthropic',
      name: 'Anthropic',
      modelLabel: 'Claude',
      badge: 'CL',
      tone: 'violet',
      logoSrc: '/ai-logos/anthropic.ico',
      helpUrl: 'https://docs.anthropic.com/en/api/getting-started',
      consoleUrl: 'https://console.anthropic.com/settings/keys',
      keyPlaceholder: 'sk-ant-...',
      legalNote: 'Vos prompts transitent par Anthropic. Vérifiez vos réglages de conservation et vos engagements contractuels.',
      supported: true,
    },
    {
      id: 'openai',
      name: 'OpenAI',
      modelLabel: 'GPT',
      badge: 'GPT',
      tone: 'green',
      logoSrc: '/ai-logos/openai.svg',
      helpUrl: 'https://platform.openai.com/docs/quickstart',
      consoleUrl: 'https://platform.openai.com/api-keys',
      keyPlaceholder: 'sk-...',
      legalNote: 'Les traitements dépendent des conditions OpenAI et peuvent impliquer un hébergement hors UE selon votre configuration.',
      supported: false,
    },
    {
      id: 'mistral',
      name: 'Mistral',
      modelLabel: 'Le Chat · API',
      badge: 'MI',
      tone: 'orange',
      logoSrc: '/ai-logos/mistral-boxed-rainbow.png',
      helpUrl: 'https://docs.mistral.ai/getting-started/quickstart/',
      consoleUrl: 'https://console.mistral.ai/api-keys/',
      keyPlaceholder: 'mst-...',
      legalNote: 'Mistral est un acteur français. Contrôlez tout de même vos clauses de confidentialité et de rétention.',
      supported: false,
    },
    {
      id: 'google',
      name: 'Gemini',
      modelLabel: 'Gemini',
      badge: 'GE',
      tone: 'blue',
      logoSrc: '/ai-logos/gemini.svg',
      helpUrl: 'https://ai.google.dev/gemini-api/docs/api-key',
      consoleUrl: 'https://aistudio.google.com/app/apikey',
      keyPlaceholder: 'AIza...',
      legalNote: 'Les usages Gemini relèvent des conditions Google Cloud / AI Studio. Vérifiez la zone et la politique données.',
      supported: false,
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      modelLabel: 'Multi-modèles',
      badge: 'OR',
      tone: 'slate',
      logoSrc: '/ai-logos/openrouter.ico',
      helpUrl: 'https://openrouter.ai/docs/quickstart',
      consoleUrl: 'https://openrouter.ai/keys',
      keyPlaceholder: 'sk-or-...',
      legalNote: 'OpenRouter peut router vers plusieurs fournisseurs. Vous devez vérifier les conditions du routeur et du modèle final.',
      supported: false,
    },
  ]

  const [showOnboarding, setShowOnboarding] = useState(
    () =>
      !window.localStorage.getItem(ONBOARDING_DONE_KEY) &&
      !window.localStorage.getItem(ANTHROPIC_KEY_STORAGE),
  )
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3 | 4>(1)
  const [onboardingProvider, setOnboardingProvider] = useState<OnboardingProviderId | null>(null)
  const [onboardingKeyDraft, setOnboardingKeyDraft] = useState('')
  const [onboardingMessages, setOnboardingMessages] = useState<OnboardingMsg[]>([])
  const [onboardingInput, setOnboardingInput] = useState('')
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [onboardingError, setOnboardingError] = useState('')

  type OnboardingUserProfile = {
    situation: 'solo' | 'couple' | 'famille' | null
    revenus: 'lt1500' | '1500-2500' | '2500-4000' | 'gt4000' | null
    objectif: 'epargner' | 'maitriser' | 'rembourser' | 'investir' | null
    niveau: 'debutant' | 'habitue' | 'expert' | null
  }
  const [onboardingUserProfile, setOnboardingUserProfile] = useState<OnboardingUserProfile>({
    situation: null, revenus: null, objectif: null, niveau: null,
  })

  const ONBOARDING_SYSTEM = `Tu es l'assistant d'installation de Plan Financier, une app de budget familial privée.

Ta mission : configurer l'app pour l'utilisateur en posant 3 questions simples.
Pose-les toutes en une seule fois, de façon chaleureuse et concise en français.
1. Son prénom (ou nom du foyer)
2. Son budget mensuel moyen (en €)
3. Y a-t-il d'autres membres à suivre ? (conjoint·e, enfant…)

Dès que l'utilisateur répond, extrais les infos et réponds en deux parties :
- Un message de confirmation chaleureux
- Un bloc JSON de configuration entre balises <config> et </config>

Format JSON :
{
  "profiles": [
    {"id": "identifiant-court", "name": "Prénom", "monthlyBudget": 2000}
  ],
  "defaultProfileId": "identifiant-court"
}

Règles :
- id en minuscules sans accents ni espaces (tirets autorisés)
- monthlyBudget entier ≥ 200
- Un profil par membre mentionné
- Réponds toujours en français
- Si l'utilisateur fournit son profil en préambule, exploite ces données pour personnaliser directement la configuration et évite de reposer des questions déjà couvertes`

  const callClaudeOnboarding = async (messages: OnboardingMsg[], key: string): Promise<string> => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: ONBOARDING_SYSTEM,
        messages,
      }),
    })
    if (!response.ok) throw new Error(`API ${response.status}`)
    const data = (await response.json()) as { content: Array<{ type: string; text: string }> }
    return data.content.find((c) => c.type === 'text')?.text ?? ''
  }

  const handleOnboardingStart = async () => {
    if (!onboardingProvider || onboardingProvider !== 'anthropic') {
      setOnboardingError(`L'intégration ${ONBOARDING_PROVIDERS.find((provider) => provider.id === onboardingProvider)?.name ?? 'sélectionnée'} arrive bientôt dans FP. Aujourd'hui, seul Claude via Anthropic est disponible.`)
      return
    }
    const key = onboardingKeyDraft.trim()
    if (!key) { setOnboardingError('Veuillez entrer votre clé API Anthropic.'); return }
    setOnboardingError('')
    setOnboardingLoading(true)
    try {
      const situationLabel: Record<string, string> = { solo: 'Solo', couple: 'En couple', famille: 'Famille (avec enfants)' }
      const revenusLabel: Record<string, string> = { lt1500: 'moins de 1 500 €/mois', '1500-2500': '1 500 – 2 500 €/mois', '2500-4000': '2 500 – 4 000 €/mois', gt4000: 'plus de 4 000 €/mois' }
      const objectifLabel: Record<string, string> = { epargner: 'Épargner davantage', maitriser: 'Maîtriser mes dépenses', rembourser: 'Rembourser des dettes', investir: 'Investir' }
      const niveauLabel: Record<string, string> = { debutant: 'Je débute en gestion de budget', habitue: "J'ai déjà l'habitude de gérer un budget", expert: 'Je veux juste optimiser' }
      const profileLines: string[] = []
      if (onboardingUserProfile.situation) profileLines.push(`- Situation : ${situationLabel[onboardingUserProfile.situation]}`)
      if (onboardingUserProfile.revenus) profileLines.push(`- Revenus nets : ${revenusLabel[onboardingUserProfile.revenus]}`)
      if (onboardingUserProfile.objectif) profileLines.push(`- Objectif principal : ${objectifLabel[onboardingUserProfile.objectif]}`)
      if (onboardingUserProfile.niveau) profileLines.push(`- Niveau : ${niveauLabel[onboardingUserProfile.niveau]}`)
      const firstMsg = profileLines.length > 0
        ? `Bonjour, je viens de lancer Plan Financier pour la première fois.\n\nMon profil :\n${profileLines.join('\n')}`
        : `Bonjour, je viens de lancer Plan Financier pour la première fois.`
      const greeting = await callClaudeOnboarding([{ role: 'user', content: firstMsg }], key)
      saveAnthropicKey(key)
      setOnboardingMessages([
        { role: 'user', content: firstMsg },
        { role: 'assistant', content: greeting },
      ])
      setOnboardingStep(4)
    } catch {
      setOnboardingError('Clé API invalide ou problème réseau. Vérifiez la clé et réessayez.')
    } finally {
      setOnboardingLoading(false)
    }
  }

  const parseOnboardingConfig = (text: string) => {
    const match = new RegExp('<config>([\\s\\S]*?)<\\/config>', 'i').exec(text)
    if (!match) return null
    try {
      return JSON.parse(match[1]) as { profiles: UserProfile[]; defaultProfileId: string }
    } catch { return null }
  }

  const applyOnboardingConfig = (config: { profiles: UserProfile[]; defaultProfileId: string }) => {
    const cleaned = config.profiles
      .map((p) => normalizeProfile(p))
      .filter((p): p is UserProfile => p !== null)
    if (cleaned.length === 0) return
    setProfiles(cleaned)
    saveProfiles(cleaned)
    const defId = cleaned.find((p) => p.id === config.defaultProfileId)?.id ?? cleaned[0].id
    setDefaultProfileId(defId)
    window.localStorage.setItem(DEFAULT_PROFILE_STORAGE_KEY, defId)
    setSelectedMember(defId)
  }

  const handleOnboardingSend = async () => {
    if (!onboardingInput.trim() || onboardingLoading) return
    const userMsg: OnboardingMsg = { role: 'user', content: onboardingInput.trim() }
    const next = [...onboardingMessages, userMsg]
    setOnboardingMessages(next)
    setOnboardingInput('')
    setOnboardingLoading(true)
    try {
      const reply = await callClaudeOnboarding(next, anthropicKey)
      const withReply = [...next, { role: 'assistant' as const, content: reply }]
      setOnboardingMessages(withReply)
      const config = parseOnboardingConfig(reply)
      if (config) {
        applyOnboardingConfig(config)
        window.localStorage.setItem(ONBOARDING_DONE_KEY, '1')
        setTimeout(() => setShowOnboarding(false), 2200)
      }
    } catch {
      setOnboardingMessages([...next, { role: 'assistant', content: "Désolé, une erreur s'est produite. Réessayez." }])
    } finally {
      setOnboardingLoading(false)
    }
  }

  const skipOnboarding = () => {
    window.localStorage.setItem(ONBOARDING_DONE_KEY, '1')
    setShowOnboarding(false)
  }

  const saveAnthropicKey = (key: string) => {
    setAnthropicKey(key)
    window.localStorage.setItem(ANTHROPIC_KEY_STORAGE, key)
    setClaudeTestState('idle')
    setClaudeTestMessage('')
  }

  const openSettingsPanel = (section: SettingsSection = 'profiles') => {
    setSettingsSection(section)
    setShowSettings(true)
  }

  const closeSettingsPanel = () => {
    setShowSettings(false)
  }

  const testClaudeKey = async () => {
    if (!anthropicKey.trim()) {
      setClaudeTestState('error')
      setClaudeTestMessage('Ajoute d’abord une clé API Anthropic.')
      return
    }

    setClaudeTestState('testing')
    setClaudeTestMessage('Vérification de la clé en cours...')

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 12,
          messages: [{ role: 'user', content: 'Réponds seulement OK.' }],
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        const msg = (err as { error?: { message?: string } }).error?.message ?? `Erreur ${response.status}`
        setClaudeTestState('error')
        setClaudeTestMessage(msg)
        return
      }

      setClaudeTestState('success')
      setClaudeTestMessage('Clé valide. Claude est prêt dans le dashboard.')
    } catch {
      setClaudeTestState('error')
      setClaudeTestMessage('Impossible de joindre Anthropic. Vérifie la connexion ou la clé.')
    }
  }

  const buildFinancialContext = () => {
    const topExpenses = activeMonthTransactions
      .filter((t) => t.kind === 'depense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((t) => `${t.label} (${euroFormatter.format(t.amount)}, ${t.category})`)
      .join(', ')

    const goalsText = goalProgress
      .filter((g) => g.target > 0)
      .map((g) => `${g.category}: ${euroFormatter.format(g.spent)}/${euroFormatter.format(g.target)} (${g.rate.toFixed(0)}%)`)
      .join(', ')

    return `Tu es un assistant financier personnel intégré dans une app de budget privée.
Voici les données financières de l'utilisateur pour ${formatMonth(selectedMonth)} :
- Profil actif : ${selectedProfileName}
- Budget mensuel : ${euroFormatter.format(budget)}
- Dépenses : ${euroFormatter.format(monthlyExpense)} (${usageRate.toFixed(0)}% du budget)
- Revenus : ${euroFormatter.format(monthlyIncome)}
- Reste disponible : ${euroFormatter.format(remaining)}
- Solde net : ${euroFormatter.format(monthlyNet)}
- Top dépenses : ${topExpenses || 'aucune'}
- Objectifs d'épargne : ${goalsText || 'aucun'}
- Alertes actives : ${alertMessages.length > 0 ? alertMessages.map((a) => a.message).join(' | ') : 'aucune'}

Réponds en français, de façon concise et bienveillante. Tu peux analyser les données ci-dessus et répondre à toutes les questions (pas seulement financières).`
  }

  const handlePredictMonth = async () => {
    if (!anthropicKey || predictionLoading) return
    setPredictionLoading(true)
    setPredictionResult('')

    const today = new Date()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysPassed = Math.min(today.getDate(), daysInMonth)
    const daysLeft = daysInMonth - daysPassed

    const prompt = `Voici les données du mois en cours (${formatMonth(selectedMonth)}) pour ${selectedProfileName} :
- Budget : ${euroFormatter.format(budget)}
- Dépenses à ce jour : ${euroFormatter.format(monthlyExpense)} (${usageRate.toFixed(0)}% du budget)
- Revenus à ce jour : ${euroFormatter.format(monthlyIncome)}
- Solde net actuel : ${euroFormatter.format(monthlyNet)}
- Jours écoulés : ${daysPassed} / ${daysInMonth} (${daysLeft} jours restants)

Sur la base de ces données, estime le solde net probable à la fin du mois. Donne une prédiction chiffrée avec les hypothèses (dépenses journalières moyennes) et 2 recommandations concrètes. Sois bref (5-8 lignes max).`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        const msg = (err as { error?: { message?: string } }).error?.message ?? `Erreur ${response.status}`
        setPredictionResult(`⚠️ ${msg}`)
        return
      }

      type AnthropicResponse = { content: Array<{ type: string; text: string }> }
      const data = (await response.json()) as AnthropicResponse
      setPredictionResult(data.content.find((c) => c.type === 'text')?.text ?? '…')
    } catch {
      setPredictionResult('⚠️ Impossible de contacter Claude. Vérifie ta connexion.')
    } finally {
      setPredictionLoading(false)
    }
  }

  const sendChatMessage = async (presetMessage?: string) => {    const message = (presetMessage ?? chatInput).trim()
    if (!message || !anthropicKey || chatLoading) return

    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: message }]
    updateChatThreadActivity(activeChatThread.id, Date.now())
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          system: buildFinancialContext(),
          messages: newMessages,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        const msg = (err as { error?: { message?: string } }).error?.message ?? `Erreur ${response.status}`
        setChatMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }])
        return
      }

      type AnthropicResponse = { content: Array<{ type: string; text: string }> }
      const data = (await response.json()) as AnthropicResponse
      const reply = data.content.find((c) => c.type === 'text')?.text ?? '…'
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ Impossible de contacter Claude. Vérifie ta connexion et ta clé API.' },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      chatInputRef.current?.focus()
    }
  }, [chatMessages, chatOpen, chatLoading])
  // ──────────────────────────────────────────────────────────────────────

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedMember) ?? profiles[0] ?? defaultProfile
  const selectedProfileId = selectedProfile.id
  const selectedProfileName = selectedProfile.name
  const selectedProfileBudget = selectedProfile.monthlyBudget
  const chatThreadScopeKey = getChatThreadScopeKey(selectedProfileId, selectedMonth)
  const activeChatThread =
    chatThreads.find((thread) => thread.id === chatThreadId) ?? chatThreads[0] ?? DEFAULT_CHAT_THREAD
  const canCreateChatTopic = chatThreads.length < MAX_CHAT_THREADS_PER_SCOPE
  const canManageActiveEmptyThread = chatMessages.length === 0
  const chatHistoryStorageKey = getChatHistoryStorageKey(
    selectedProfileId,
    selectedMonth,
    activeChatThread.id,
  )
  const managedProfile =
    profiles.find((profile) => profile.id === settingsForm.manageProfileId) ?? selectedProfile

  const resetChatUndoState = () => {
    if (chatUndoTimerRef.current !== null) {
      window.clearTimeout(chatUndoTimerRef.current)
      chatUndoTimerRef.current = null
    }

    setLastDeletedChat(null)
    setChatUndoToastOpen(false)
  }

  const updateChatThreadActivity = (threadId: string, timestamp: number) => {
    setChatThreads((previous) =>
      previous.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              lastActivityAt: Math.max(thread.lastActivityAt, timestamp),
            }
          : thread,
      ),
    )
  }

  const createChatTopic = () => {
    if (!canCreateChatTopic) {
      return
    }

    const label = normalizeChatThreadLabel(chatTopicDraft)
    if (!label) {
      return
    }

    const baseId = createChatThreadId(label) || `topic-${Date.now()}`
    let nextId = baseId
    let suffix = 2
    while (chatThreads.some((thread) => thread.id === nextId)) {
      nextId = `${baseId}-${suffix}`
      suffix += 1
    }

    const nextThread = { id: nextId, label, lastActivityAt: Date.now() }
    setChatThreads((previous) => [nextThread, ...previous])
    setChatThreadId(nextThread.id)
    setChatRenameDraft(label)
    setChatTopicDraft('')
    setChatMessages([])
    setChatClearConfirmOpen(false)
    resetChatUndoState()
  }

  const renameActiveChatTopic = () => {
    if (!canManageActiveEmptyThread) {
      return
    }

    const label = normalizeChatThreadLabel(chatRenameDraft)
    if (!label) {
      return
    }

    setChatThreads((previous) =>
      previous.map((thread) =>
        thread.id === activeChatThread.id
          ? {
              ...thread,
              label,
            }
          : thread,
      ),
    )
  }

  const deleteActiveChatTopic = () => {
    if (!canManageActiveEmptyThread || chatThreads.length <= 1) {
      return
    }

    const nextThreads = chatThreads.filter((thread) => thread.id !== activeChatThread.id)
    const fallbackThread = nextThreads[0] ?? DEFAULT_CHAT_THREAD
    setChatThreads(nextThreads)
    setChatThreadId(fallbackThread.id)
    setChatRenameDraft(fallbackThread.label)
    setChatMessages([])
    setChatClearConfirmOpen(false)
    resetChatUndoState()

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(chatHistoryStorageKey)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const raw = window.localStorage.getItem(chatThreadScopeKey)
    const fallback = [DEFAULT_CHAT_THREAD]

    if (!raw) {
      setChatThreads(fallback)
      setChatThreadId(DEFAULT_CHAT_THREAD.id)
      setChatRenameDraft(DEFAULT_CHAT_THREAD.label)
      chatThreadScopeReadyRef.current = chatThreadScopeKey
      return
    }

    try {
      const parsed = JSON.parse(raw) as Array<{ id?: string; label?: string; lastActivityAt?: number }>
      const restored = parsed
        .filter(
          (thread): thread is { id: string; label: string; lastActivityAt?: number } =>
            typeof thread.id === 'string' && thread.id.length > 0 && typeof thread.label === 'string',
        )
        .map((thread) => ({
          id: thread.id,
          label: thread.label,
          lastActivityAt: typeof thread.lastActivityAt === 'number' ? thread.lastActivityAt : 0,
        }))

      const nextThreads = restored.length > 0 ? restored : fallback
      if (!nextThreads.some((thread) => thread.id === DEFAULT_CHAT_THREAD.id)) {
        nextThreads.unshift(DEFAULT_CHAT_THREAD)
      }

      setChatThreads(nextThreads)
      setChatThreadId((previous) =>
        nextThreads.some((thread) => thread.id === previous) ? previous : nextThreads[0].id,
      )
      setChatRenameDraft((previous) => previous || nextThreads[0].label)
      chatThreadScopeReadyRef.current = chatThreadScopeKey
    } catch {
      setChatThreads(fallback)
      setChatThreadId(DEFAULT_CHAT_THREAD.id)
      setChatRenameDraft(DEFAULT_CHAT_THREAD.label)
      chatThreadScopeReadyRef.current = chatThreadScopeKey
    }
  }, [chatThreadScopeKey])

  useEffect(() => {
    setChatRenameDraft(activeChatThread.label)
  }, [activeChatThread.id, activeChatThread.label])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (chatThreadScopeReadyRef.current !== chatThreadScopeKey) {
      return
    }

    window.localStorage.setItem(chatThreadScopeKey, JSON.stringify(chatThreads))
  }, [chatThreadScopeKey, chatThreads])

  const clearChatConversation = () => {
    if (chatMessages.length === 0) {
      setChatClearConfirmOpen(false)
      return
    }

    setLastDeletedChat({
      storageKey: chatHistoryStorageKey,
      messages: chatMessages,
      threadLabel: activeChatThread.label,
    })
    setChatUndoToastOpen(true)
    setChatMessages([])
    setChatClearConfirmOpen(false)

    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.removeItem(chatHistoryStorageKey)
  }

  useEffect(() => {
    chatHistoryReadyKeyRef.current = ''
    setChatClearConfirmOpen(false)
    resetChatUndoState()
  }, [chatHistoryStorageKey])

  const restoreLastDeletedChat = () => {
    if (!lastDeletedChat || lastDeletedChat.storageKey !== chatHistoryStorageKey) {
      return
    }

    setChatMessages(lastDeletedChat.messages)
    setChatClearConfirmOpen(false)
    resetChatUndoState()
  }

  useEffect(() => {
    if (!lastDeletedChat) {
      return
    }

    chatUndoTimerRef.current = window.setTimeout(() => {
      setLastDeletedChat(null)
      setChatUndoToastOpen(false)
      chatUndoTimerRef.current = null
    }, 30_000)

    return () => {
      if (chatUndoTimerRef.current !== null) {
        window.clearTimeout(chatUndoTimerRef.current)
        chatUndoTimerRef.current = null
      }
    }
  }, [lastDeletedChat])

  useEffect(() => {
    resetChatUndoState()
  }, [activeSectionId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!isAuthenticated || !anthropicKey) {
      setChatMessages([])
      chatHistoryReadyKeyRef.current = chatHistoryStorageKey
      return
    }

    const raw = window.localStorage.getItem(chatHistoryStorageKey)
    if (!raw) {
      setChatMessages([])
      chatHistoryReadyKeyRef.current = chatHistoryStorageKey
      return
    }

    try {
      const parsed = JSON.parse(raw) as Array<{ role?: string; content?: string }>
      const restored = parsed
        .filter((item): item is { role: 'user' | 'assistant'; content: string } =>
          (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string',
        )
        .map((item) => ({ role: item.role, content: item.content }))

      setChatMessages(restored)
    } catch {
      setChatMessages([])
    }

    chatHistoryReadyKeyRef.current = chatHistoryStorageKey
  }, [anthropicKey, chatHistoryStorageKey, isAuthenticated])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!isAuthenticated || !anthropicKey) {
      return
    }

    if (chatHistoryReadyKeyRef.current !== chatHistoryStorageKey) {
      return
    }

    window.localStorage.setItem(chatHistoryStorageKey, JSON.stringify(chatMessages))
  }, [anthropicKey, chatHistoryStorageKey, chatMessages, isAuthenticated])

  useEffect(() => {
    const initializeSecurity = async () => {
      const loaded = await loadSensitiveState()
      setSensitiveState(loaded)
      setPinLogs(loadPinChangeLogs())
      setStoredCsvMappings(loadStoredCsvMappings())
      setSettingsForm((previous) => ({
        ...previous,
        sessionDurationDays: String(loaded.sessionDurationDays),
      }))

      if (loaded.persistedSession) {
        setAuthRole(loaded.persistedSession.role)
        setIsAuthenticated(true)
      }

      setIsSecurityReady(true)
    }

    void initializeSecurity()
  }, [])

  // ── Theme ─────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_WIDGETS_STORAGE_KEY, JSON.stringify(dashboardWidgetState))
  }, [dashboardWidgetState])

  // ── Firebase auth listener ────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true)
      } else {
        setIsAuthenticated(false)
      }
      setFirebaseAuthReady(true)
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      TRANSACTIONS_STORAGE_KEY,
      JSON.stringify(transactions),
    )
  }, [transactions])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(savingsGoals))
  }, [savingsGoals])

  useEffect(() => {
    saveProfiles(profiles)
  }, [profiles])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, selectedProfileId)
  }, [selectedProfileId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(DEFAULT_PROFILE_STORAGE_KEY, defaultProfileId)
  }, [defaultProfileId])

  useEffect(() => {
    if (profiles.some((profile) => profile.id === selectedMember)) {
      return
    }

    setSelectedMember(profiles[0]?.id ?? defaultProfile.id)
  }, [profiles, selectedMember])

  useEffect(() => {
    if (profiles.some((profile) => profile.id === defaultProfileId)) {
      return
    }

    setDefaultProfileId(profiles[0]?.id ?? defaultProfile.id)
  }, [defaultProfileId, profiles])

  useEffect(() => {
    if (!showSettings) {
      return
    }

    const profileToManage =
      profiles.find((profile) => profile.id === settingsForm.manageProfileId) ?? selectedProfile
    if (
      settingsForm.manageProfileId === profileToManage.id &&
      settingsForm.manageProfileName === profileToManage.name &&
      settingsForm.manageProfileBudget === String(profileToManage.monthlyBudget)
    ) {
      return
    }

    setSettingsForm((previous) => ({
      ...previous,
      manageProfileId: profileToManage.id,
      manageProfileName: profileToManage.name,
      manageProfileBudget: String(profileToManage.monthlyBudget),
    }))
  }, [profiles, selectedProfile, settingsForm.manageProfileId, showSettings])

  useEffect(() => {
    if (!showSettings) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSettings(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showSettings])


  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(ROLLOVER_STORAGE_KEY, JSON.stringify(rolloverState))
  }, [rolloverState])

  useEffect(() => {
    if (rolloverState.month === currentMonth) {
      return
    }

    const computeCarry = (member: FamilyMember) => {
      const spentDuringTrackedMonth = transactions
        .filter(
          (item) =>
            item.member === member &&
            item.kind === 'depense' &&
            item.date.startsWith(rolloverState.month),
        )
        .reduce((sum, item) => sum + item.amount, 0)

      const profileBudget = profiles.find((profile) => profile.id === member)?.monthlyBudget ?? 0
      const trackedBudget = profileBudget + (rolloverState.carryOver[member] ?? 0)
      return Math.max(0, trackedBudget - spentDuringTrackedMonth)
    }

    setRolloverState({
      month: currentMonth,
      carryOver: profiles.reduce<Record<string, number>>((accumulator, profile) => {
        accumulator[profile.id] = computeCarry(profile.id)
        return accumulator
      }, {}),
    })
  }, [currentMonth, profiles, rolloverState, transactions])

  const activeTransactions = useMemo(
    () => transactions.filter((item) => item.member === selectedProfileId),
    [transactions, selectedProfileId],
  )

  const filteredTransactions = useMemo(
    () =>
      selectedEnvelope === 'Tous'
        ? activeTransactions
        : activeTransactions.filter((item) => item.envelope === selectedEnvelope),
    [activeTransactions, selectedEnvelope],
  )

  const activeMonthTransactions = useMemo(
    () => filteredTransactions.filter((item) => item.date.startsWith(selectedMonth)),
    [filteredTransactions, selectedMonth],
  )

  const monthlyExpense = useMemo(
    () =>
      activeMonthTransactions
        .filter((item) => item.kind === 'depense')
        .reduce((acc, item) => acc + item.amount, 0),
    [activeMonthTransactions],
  )

  const monthlyIncome = useMemo(
    () =>
      activeMonthTransactions
        .filter((item) => item.kind === 'revenu')
        .reduce((acc, item) => acc + item.amount, 0),
    [activeMonthTransactions],
  )

  const budget = selectedProfileBudget + (rolloverState.carryOver[selectedProfileId] ?? 0)
  const remaining = budget - monthlyExpense
  const usageRateRaw = budget > 0 ? (monthlyExpense / budget) * 100 : 0
  const incomeRate = budget > 0 ? (monthlyIncome / budget) * 100 : 0
  const usageRate = Math.min(100, usageRateRaw)
  const budgetSimpleMessage =
    remaining < 0
      ? 'Vous avez dépassé votre budget ce mois-ci. Réduisez une catégorie aujourd’hui.'
      : usageRate >= 85
        ? 'Vous arrivez en fin de budget. Limitez les dépenses non essentielles.'
        : usageRate >= 65
          ? 'Votre rythme est correct. Gardez un oeil sur les grosses dépenses.'
          : 'Très bon départ. Continuez comme ça.'

  // Calcul des % changements par rapport au mois précédent
  const previousMonthKey = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      const now = new Date()
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
    }

    const previousMonthDate = new Date(year, month - 2, 1)
    return `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`
  }, [selectedMonth])

  const previousMonthExpense = useMemo(() => {
    return filteredTransactions
      .filter((item) => item.kind === 'depense' && item.date.startsWith(previousMonthKey))
      .reduce((sum, item) => sum + item.amount, 0)
  }, [filteredTransactions, previousMonthKey])

  const previousMonthIncome = useMemo(() => {
    return filteredTransactions
      .filter((item) => item.kind === 'revenu' && item.date.startsWith(previousMonthKey))
      .reduce((sum, item) => sum + item.amount, 0)
  }, [filteredTransactions, previousMonthKey])

  const depenseChangePercent = previousMonthExpense > 0
    ? ((monthlyExpense - previousMonthExpense) / previousMonthExpense) * 100
    : null
  const currentNet = monthlyIncome - monthlyExpense
  const previousNet = previousMonthIncome - previousMonthExpense
  const netChangePercent = Math.abs(previousNet) > 0
    ? ((currentNet - previousNet) / Math.abs(previousNet)) * 100
    : null
  const depenseChangeLabel = depenseChangePercent === null
    ? monthlyExpense > 0 ? 'Nouveau' : null
    : `${depenseChangePercent > 0 ? '+' : ''}${depenseChangePercent.toFixed(0)}%`
  const netChangeLabel = netChangePercent === null
    ? currentNet !== 0 ? 'Nouveau' : null
    : `${netChangePercent > 0 ? '+' : ''}${netChangePercent.toFixed(0)}%`
  const depenseDeltaAmount = monthlyExpense - previousMonthExpense
  const netDeltaAmount = currentNet - previousNet

  const projectionData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const today = new Date()
    const isCurrentSelection = selectedMonth === currentMonth
    const elapsedDays = isCurrentSelection ? Math.max(1, today.getDate()) : daysInMonth
    const averageDailyExpense = monthlyExpense / elapsedDays
    const projectedExpense = isCurrentSelection ? averageDailyExpense * daysInMonth : monthlyExpense
    const projectedOverrun = projectedExpense - budget
    return {
      daysInMonth,
      elapsedDays,
      averageDailyExpense,
      projectedExpense,
      projectedOverrun,
      isCurrentSelection,
    }
  }, [budget, currentMonth, monthlyExpense, selectedMonth])

  const projectedMessage = projectionData.projectedOverrun > 0
    ? `Au rythme actuel, dépassement estimé: ${euroFormatter.format(projectionData.projectedOverrun)}.`
    : `Projection fin de mois: ${euroFormatter.format(Math.abs(projectionData.projectedOverrun))} de marge.`

  const budgetMasteryScore = useMemo(() => {
    const overrunPenalty = Math.max(0, usageRateRaw - 70) * 1.4
    const trendBonus = depenseChangePercent !== null && depenseChangePercent < 0 ? 8 : 0
    const remainingBonus = remaining > 0 ? 7 : -10
    const rawScore = 100 - overrunPenalty + trendBonus + remainingBonus
    return Math.max(0, Math.min(100, Math.round(rawScore)))
  }, [depenseChangePercent, remaining, usageRateRaw])

  const budgetHealthLabel = budgetMasteryScore >= 80 ? 'Excellente maîtrise' : budgetMasteryScore >= 60 ? 'Stable' : 'À surveiller'
  const budgetHealthColor = budgetMasteryScore >= 80 ? '#22c55e' : budgetMasteryScore >= 60 ? '#f59e0b' : '#f43f5e'
  const budgetHumanAdvice = remaining < 0
    ? 'Vous dépassez le budget. Mettez en pause les dépenses non urgentes.'
    : projectionData.projectedOverrun > 0
      ? 'Attention, au rythme actuel vous risquez de dépasser avant la fin du mois.'
      : usageRate >= 75
        ? 'Vous tenez le cap, mais il faut rester prudent jusqu’à la fin du mois.'
        : 'Vous êtes tranquille ce mois-ci. Continuez comme ça.'

  const budgetInsights = useMemo(() => {
    const insights: string[] = []
    insights.push(projectedMessage)
    if (depenseChangePercent !== null) {
      insights.push(
        depenseChangePercent > 0
          ? `Dépenses en hausse de ${depenseChangePercent.toFixed(0)}% vs mois dernier.`
          : `Dépenses en baisse de ${Math.abs(depenseChangePercent).toFixed(0)}% vs mois dernier.`,
      )
    }
    if (remaining < 0) insights.push('Le budget est dépassé: prioriser les postes non essentiels.')
    return insights.slice(0, 3)
  }, [depenseChangePercent, projectedMessage, remaining])

  const budgetSeriesColors = {
    revenus: '#22c55e',
    depenses: '#f97316',
    net: '#38bdf8',
  } as const

  // Calcul de l'état du budget
  const budgetStatusColor = remaining < 0 ? '#f43f5e' : usageRate >= 85 ? '#f59e0b' : '#22c55e'
  const budgetStatusLabel = remaining < 0 ? 'Dépassé' : usageRate >= 85 ? 'Attention' : 'Normal'

  // Génération des actions
  const budgetActionsList = useMemo(() => {
    const actions: string[] = []
    if (remaining < 0) actions.push('🔴 Dépassement : réduire une catégorie immédiatement')
    else if (usageRate >= 85) actions.push('⚠️ 85% du budget atteint : freiner les dépenses')
    else actions.push('✅ Budget maîtrisé : bon rythme')
    
    if (depenseChangePercent !== null && depenseChangePercent > 15) {
      actions.push(`📈 +${depenseChangePercent.toFixed(0)}% vs mois dernier : vérifier les grosses dépenses`)
    } else if (depenseChangePercent !== null && depenseChangePercent < -15) {
      actions.push(`📉 ${depenseChangePercent.toFixed(0)}% vs mois dernier : très bon contrôle`)
    }
    
    if (monthlyExpense > budget * 0.5) actions.push('💡 Dépenses > 50% : envisager un rééquilibrage')
    
    return actions.slice(0, 3)
  }, [budget, depenseChangePercent, monthlyExpense, remaining, usageRate])

  const budgetAssistantLocalMessage = useMemo(() => {
    const actionsSummary = budgetActionsList
      .slice(0, 2)
      .map((action) => action.replace(/^[^A-Za-z0-9À-ÿ]+/, '').replace(/\s+/g, ' ').trim())
    const actionsText = actionsSummary.length > 0 ? `🎯 Actions: ${actionsSummary.join(' | ')}.` : ''
    return [
      `✅ ${budgetHumanAdvice}`,
      `📅 ${projectedMessage}`,
      actionsText,
    ].filter(Boolean).join('\n')
  }, [budgetActionsList, budgetHumanAdvice, projectedMessage])

  const budgetAssistantContextKey = useMemo(
    () => [
      selectedProfileId,
      selectedMonth,
      Math.round(monthlyExpense),
      Math.round(monthlyIncome),
      Math.round(remaining),
      Math.round(usageRate),
    ].join('|'),
    [monthlyExpense, monthlyIncome, remaining, selectedMonth, selectedProfileId, usageRate],
  )

  const pieData = useMemo(() => {
    const map = new Map<Category, number>()

    for (const item of activeMonthTransactions) {
      if (item.kind === 'depense') {
        map.set(item.category, (map.get(item.category) ?? 0) + item.amount)
      }
    }

    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [activeMonthTransactions])

  const trendData = useMemo(() => {
    const sorted = activeMonthTransactions
      .filter((item) => item.kind === 'depense')
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))

    let cumulative = 0

    return sorted.map((item) => {
      cumulative += item.amount
      return {
        day: item.date.slice(8, 10),
        cumul: cumulative,
      }
    })
  }, [activeMonthTransactions])

  const budgetBalanceData = useMemo(
    () => [
      {
        metric: 'Depenses',
        total: monthlyExpense,
      },
      {
        metric: 'Reste',
        total: Math.max(0, remaining),
      },
    ],
    [monthlyExpense, remaining],
  )

  const txFiltered = useMemo(() => {
    let list = activeMonthTransactions.slice()
    if (txFilterKind !== 'tous') {
      list = list.filter((item) => item.kind === txFilterKind)
    }
    if (txSearch.trim()) {
      const q = txSearch.toLowerCase()
      list = list.filter(
        (item) =>
          item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q),
      )
    }
    list.sort((a, b) =>
      txSortField === 'amount' ? b.amount - a.amount : b.date.localeCompare(a.date),
    )
    return list
  }, [activeMonthTransactions, txFilterKind, txSearch, txSortField])

  const txDisplayed = txShowAll ? txFiltered : txFiltered.slice(0, 8)
  const txFilteredCount = txFiltered.length
  const txFilteredNet = txFiltered.reduce(
    (sum, item) => sum + (item.kind === 'depense' ? -item.amount : item.amount),
    0,
  )
  const txFilterContext = [
    txSearch.trim() ? `Recherche : ${txSearch.trim()}` : null,
    txFilterKind === 'tous' ? 'Tous types' : txFilterKind === 'depense' ? 'Dépenses' : 'Revenus',
    txSortField === 'date' ? 'Tri par date' : 'Tri par montant',
  ]
    .filter(Boolean)
    .join(' · ')

  const goalsForSelectedMember = savingsGoals[selectedProfileId] ?? defaultGoalTemplate

  const goalProgress = useMemo(
    () =>
      categories.map((category) => {
        const spent = activeMonthTransactions
          .filter((item) => item.kind === 'depense' && item.category === category)
          .reduce((sum, item) => sum + item.amount, 0)
        const target = goalsForSelectedMember[category]

        return {
          category,
          spent,
          target,
          rate: target > 0 ? Math.min(100, (spent / target) * 100) : 0,
        }
      }),
    [activeMonthTransactions, goalsForSelectedMember],
  )

  const calendarData = useMemo(() => {
    const [calYear, calMon] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(calYear, calMon, 0).getDate()
    const map = new Map<number, number>()

    activeMonthTransactions
      .filter((item) => item.kind === 'depense')
      .forEach((item) => {
        const day = Number(item.date.slice(8, 10))
        map.set(day, (map.get(day) ?? 0) + item.amount)
      })

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const total = map.get(day) ?? 0
      return {
        day,
        total,
        intensity: Math.min(1, total / 120),
      }
    })
  }, [activeMonthTransactions, selectedMonth])

  const monthlyNet = monthlyIncome - monthlyExpense

  const envelopeBreakdown = useMemo(
    () =>
      envelopes.map((envelope) => ({
        envelope,
        total: activeMonthTransactions
          .filter((item) => item.envelope === envelope && item.kind === 'depense')
          .reduce((sum, item) => sum + item.amount, 0),
      })),
    [activeMonthTransactions],
  )

  const alertMessages = useMemo(() => {
    const alerts: AlertItem[] = []

    if (usageRate >= 100) {
      alerts.push({ message: 'Budget mensuel dépassé : ajustement immédiat recommandé.', level: 'danger' })
    } else if (usageRate >= 80) {
      alerts.push({ message: 'Attention : plus de 80% du budget consommé.', level: 'warning' })
    }

    envelopeBreakdown.forEach(({ envelope, total }) => {
      const share = monthlyExpense > 0 ? total / monthlyExpense : 0
      if (share >= 0.5 && total >= 150) {
        alerts.push({ message: `L'enveloppe ${envelope} représente plus de 50% des dépenses.`, level: 'warning' })
      }
    })

    const recentExpenses = activeMonthTransactions
      .filter((item) => item.kind === 'depense')
      .sort((a, b) => a.date.localeCompare(b.date))
    const latestExpense = recentExpenses.at(-1)

    if (latestExpense) {
      const baseline = recentExpenses
        .slice(0, -1)
        .reduce((sum, item) => sum + item.amount, 0)
      const count = Math.max(1, recentExpenses.length - 1)
      const average = baseline / count

      if (latestExpense.amount > average * 1.8 && latestExpense.amount >= 80) {
        alerts.push({ message: `Dépense inhabituelle détectée : ${latestExpense.label}.`, level: 'warning' })
      }
    }

    goalProgress.forEach((goal) => {
      if (goal.rate >= 100) {
        alerts.push({ message: `Objectif ${goal.category} dépassé pour ${selectedProfileName}.`, level: 'danger' })
      }
    })

    return alerts.slice(0, 5)
  }, [activeMonthTransactions, envelopeBreakdown, goalProgress, monthlyExpense, selectedProfileName, usageRate])

  const annualTrendData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthTransactions = filteredTransactions.filter((item) => item.date.startsWith(monthKey))

      return {
        month: date.toLocaleDateString('fr-FR', { month: 'short' }),
        revenus: monthTransactions
          .filter((item) => item.kind === 'revenu')
          .reduce((sum, item) => sum + item.amount, 0),
        depenses: monthTransactions
          .filter((item) => item.kind === 'depense')
          .reduce((sum, item) => sum + item.amount, 0),
      }
    })
  }, [filteredTransactions])

  const previousMonthData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 1 - (11 - index), 1)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthTransactions = filteredTransactions.filter((item) => item.date.startsWith(monthKey))

      return {
        month: date.toLocaleDateString('fr-FR', { month: 'short' }),
        revenus: monthTransactions
          .filter((item) => item.kind === 'revenu')
          .reduce((sum, item) => sum + item.amount, 0),
        depenses: monthTransactions
          .filter((item) => item.kind === 'depense')
          .reduce((sum, item) => sum + item.amount, 0),
      }
    })
  }, [filteredTransactions])

  const budgetTrendDataWithComparison = useMemo(() => {
    const source = budgetChartWindow === 6 ? annualTrendData.slice(-6) : annualTrendData
    const sourceCompare = budgetChartWindow === 6 ? previousMonthData.slice(-6) : previousMonthData
    
    if (!budgetCompareMonths) {
      return source.map((item) => ({
        ...item,
        net: item.revenus - item.depenses,
      }))
    }
    
    return source.map((item, i) => ({
      month: item.month,
      revenus: item.revenus,
      depenses: item.depenses,
      net: item.revenus - item.depenses,
      revenus_prev: sourceCompare[i]?.revenus ?? 0,
      depenses_prev: sourceCompare[i]?.depenses ?? 0,
      net_prev: (sourceCompare[i]?.revenus ?? 0) - (sourceCompare[i]?.depenses ?? 0),
    }))
  }, [annualTrendData, budgetChartWindow, budgetCompareMonths, previousMonthData])

  const coachingTips = useMemo(() => {
    const tips: string[] = []
    const maisonTotal = envelopeBreakdown.find((item) => item.envelope === 'Maison')?.total ?? 0
    const vacancesTotal = envelopeBreakdown.find((item) => item.envelope === 'Vacances')?.total ?? 0
    const hottestGoal = [...goalProgress].sort((left, right) => right.rate - left.rate)[0]

    if (monthlyNet < 0) {
      tips.push('Le solde du mois est negatif. Coupez une enveloppe variable avant la fin du cycle.')
    }

    if (maisonTotal > budget * 0.35) {
      tips.push('L’enveloppe Maison prend une part elevee du budget. Verifiez les charges fixes et les courses.')
    }

    if (vacancesTotal > 120) {
      tips.push('L’enveloppe Vacances/Loisirs est dynamique. Fixez un plafond hebdomadaire pour lisser les depenses.')
    }

    if (hottestGoal && hottestGoal.rate > 90) {
      tips.push(`L’objectif ${hottestGoal.category} approche du plafond. Reallouez du reste disponible si prioritaire.`)
    }

    if (tips.length === 0) {
      tips.push('Trajectoire saine ce mois-ci. Vous pouvez diriger le surplus vers une enveloppe projet ou epargne.')
    }

    return tips.slice(0, 3)
  }, [budget, envelopeBreakdown, goalProgress, monthlyNet])

  const recurringItems = useMemo(() => {
    type RecurringEntry = { label: string; avgAmount: number; monthCount: number }
    const labelMap = new Map<string, { amounts: number[]; months: Set<string>; originalLabel: string }>()

    for (const tx of activeTransactions.filter((t) => t.kind === 'depense')) {
      const key = normalizeText(tx.label).slice(0, 28)
      if (!key) continue
      const month = tx.date.slice(0, 7)
      if (!labelMap.has(key)) {
        labelMap.set(key, { amounts: [], months: new Set(), originalLabel: tx.label })
      }
      const entry = labelMap.get(key)!
      entry.amounts.push(tx.amount)
      entry.months.add(month)
    }

    const results: RecurringEntry[] = []
    for (const entry of labelMap.values()) {
      if (entry.months.size >= 2) {
        results.push({
          label: entry.originalLabel,
          avgAmount: entry.amounts.reduce((s, a) => s + a, 0) / entry.amounts.length,
          monthCount: entry.months.size,
        })
      }
    }

    return results.sort((a, b) => b.monthCount - a.monthCount).slice(0, 8)
  }, [activeTransactions])

  const widgetPreviewDefinitions = useMemo(() => {
    const annualTrendPreview = annualTrendData.slice(-3)
    const highestExpenseDay = [...calendarData].sort((left, right) => right.total - left.total)[0]

    return {
      annualTrend: {
        eyebrow: '12 mois',
        title: 'Tendance annuelle',
        summary: 'Suivi revenus et dépenses sur les derniers mois.',
        accent: `${annualTrendPreview.at(-1)?.month ?? ''} · ${euroFormatter.format(annualTrendPreview.at(-1)?.depenses ?? 0)}`,
      },
      coaching: {
        eyebrow: 'Conseils',
        title: 'Coaching financier',
        summary: coachingTips[0] ?? 'Conseils prêts dès que des données sont disponibles.',
        accent: `${coachingTips.length} suggestion${coachingTips.length > 1 ? 's' : ''}`,
      },
      csvImport: {
        eyebrow: 'Banque',
        title: 'Import CSV bancaire',
        summary: csvPreview.length > 0 ? `${csvPreview.length} ligne(s) prêtes à être importées.` : 'Associez un CSV bancaire et prévisualisez avant fusion.',
        accent: csvStatus || (csvRawData.headers.length > 0 ? `${csvRawData.headers.length} colonnes détectées` : 'Aucun fichier chargé'),
      },
      alerts: {
        eyebrow: 'Alerte',
        title: 'Alertes intelligentes',
        summary: alertMessages[0]?.message ?? 'Aucune alerte active en ce moment.',
        accent: `${alertMessages.length} alerte${alertMessages.length > 1 ? 's' : ''}`,
      },
      savingsGoals: {
        eyebrow: 'Épargne',
        title: "Objectifs d'épargne",
        summary: goalProgress[0]
          ? `${goalProgress[0].category} : ${goalProgress[0].rate.toFixed(0)}% consommé sur la cible.`
          : 'Définissez un objectif pour piloter les dépenses par catégorie.',
        accent: `${goalProgress.length} catégorie${goalProgress.length > 1 ? 's' : ''} suivie${goalProgress.length > 1 ? 's' : ''}`,
      },
      recurringCharges: {
        eyebrow: 'Habitudes',
        title: 'Charges récurrentes',
        summary: recurringItems[0]
          ? `${recurringItems[0].label} revient sur ${recurringItems[0].monthCount} mois.`
          : 'Pas encore assez de recul pour isoler des charges récurrentes.',
        accent: `${recurringItems.length} récurrence${recurringItems.length > 1 ? 's' : ''}`,
      },
      savingsProjects: {
        eyebrow: 'Projet',
        title: "Objectifs d'épargne projet",
        summary: savingsTargets[0]
          ? `${savingsTargets[0].label} · cible ${euroFormatter.format(savingsTargets[0].targetAmount)}.`
          : 'Ajoutez un projet pour suivre une grande enveloppe d’épargne.',
        accent: `${savingsTargets.length} projet${savingsTargets.length > 1 ? 's' : ''}`,
      },
      expenseCalendar: {
        eyebrow: 'Calendrier',
        title: 'Calendrier des dépenses',
        summary: highestExpenseDay?.total
          ? `Pic détecté le ${highestExpenseDay.day} avec ${euroFormatter.format(highestExpenseDay.total)}.`
          : 'La heatmap s’alimente à mesure que les dépenses arrivent.',
        accent: highestExpenseDay?.total ? `Jour chaud : ${highestExpenseDay.day}` : 'Aucun pic détecté',
      },
    } satisfies Record<DashboardWidgetId, { eyebrow: string; title: string; summary: string; accent: string }>
  }, [alertMessages, annualTrendData, calendarData, coachingTips, csvPreview.length, csvRawData.headers.length, csvStatus, goalProgress, recurringItems, savingsTargets])

  const yoyComparisonData = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const prevYear = `${y - 1}-${String(m).padStart(2, '0')}`
    const prevMonthTxs = filteredTransactions.filter(
      (t) => t.date.startsWith(prevYear) && t.kind === 'depense',
    )

    return categories
      .map((cat) => {
        const current = activeMonthTransactions
          .filter((t) => t.kind === 'depense' && t.category === cat)
          .reduce((s, t) => s + t.amount, 0)
        const previous = prevMonthTxs
          .filter((t) => t.category === cat)
          .reduce((s, t) => s + t.amount, 0)
        return { category: cat, current, previous, delta: current - previous }
      })
      .filter((d) => d.current > 0 || d.previous > 0)
  }, [activeMonthTransactions, filteredTransactions, selectedMonth])

  const allTimePositiveSurplus = useMemo(() => {
    const months = [...new Set(activeTransactions.map((t) => t.date.slice(0, 7)))]
    return months.reduce((total, month) => {
      const monthTxs = activeTransactions.filter((t) => t.date.startsWith(month))
      const income = monthTxs.filter((t) => t.kind === 'revenu').reduce((s, t) => s + t.amount, 0)
      const expenses = monthTxs.filter((t) => t.kind === 'depense').reduce((s, t) => s + t.amount, 0)
      return total + Math.max(0, income - expenses)
    }, 0)
  }, [activeTransactions])

  const duplicateCount = csvPreview.filter((row) => row.duplicate).length

  const addTransaction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const amount = Number(form.amount)
    if (!form.label || Number.isNaN(amount) || amount <= 0) {
      return
    }

    if (editingTxId !== null) {
      setTransactions((previous) =>
        previous.map((tx) =>
          tx.id === editingTxId
            ? { ...tx, label: form.label.trim(), amount, category: form.category, member: form.member, date: form.date, kind: form.kind, envelope: form.envelope }
            : tx
        )
      )
      setEditingTxId(null)
      showToast('Transaction mise à jour')
    } else {
      const newTransaction: Transaction = {
        id: Date.now(),
        label: form.label.trim(),
        amount,
        category: form.category,
        member: form.member,
        date: form.date,
        kind: form.kind,
        envelope: form.envelope,
      }
      setTransactions((previous) => [...previous, newTransaction])
      showToast(`${form.kind === 'revenu' ? 'Revenu' : 'Dépense'} ajouté·e`)
    }

    setForm((previous) => ({
      ...previous,
      label: '',
      amount: '',
    }))
    setSmartCategory(null)
  }

  const startEditTransaction = (tx: Transaction) => {
    navigateToSection('operations')
    setEditingTxId(tx.id)
    setForm({
      label: tx.label,
      amount: String(tx.amount),
      category: tx.category,
      member: tx.member,
      date: tx.date,
      kind: tx.kind,
      envelope: tx.envelope,
    })
  }

  const cancelEditTransaction = () => {
    setEditingTxId(null)
    setForm((previous) => ({ ...previous, label: '', amount: '' }))
    setSmartCategory(null)
  }

  const deleteTransaction = (id: number) => {
    setTransactions((previous) => previous.filter((tx) => tx.id !== id))
    showToast('Transaction supprimée')
    if (editingTxId === id) {
      setEditingTxId(null)
      setForm((previous) => ({ ...previous, label: '', amount: '' }))
      setSmartCategory(null)
    }
  }

  const updateGoalTarget = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(goalEditor.amount)
    if (Number.isNaN(amount) || amount <= 0) {
      return
    }

    setSavingsGoals((previous) => ({
      ...previous,
      [selectedProfileId]: {
        ...(previous[selectedProfileId] ?? defaultGoalTemplate),
        [goalEditor.category]: amount,
      },
    }))
    setGoalEditor((previous) => ({ ...previous, amount: '' }))
  }

  const handleCsvFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const content = await file.text()
    const rawData = parseCsvRawData(content)
    const bankKey = inferBankProfileKey(file.name, rawData.headers)
    const inferredMapping = storedCsvMappings[bankKey] ?? inferCsvMapping(rawData.headers)
    const parsedRows = parseCsvTransactions(
      rawData,
      inferredMapping,
      transactions,
      csvImportMember,
    )

    if (parsedRows.length === 0) {
      setCsvBankKey(bankKey)
      setCsvRawData(rawData)
      setCsvMapping(inferredMapping)
      setCsvPreview([])
      setCsvStatus('Fichier charge. Ajustez le mapping des colonnes pour continuer.')
      return
    }

    setCsvBankKey(bankKey)
    setCsvRawData(rawData)
    setCsvMapping(inferredMapping)
    setCsvPreview(parsedRows)
    setCsvStatus(
      `${parsedRows.length} operation(s) detectee(s), dont ${parsedRows.filter((row) => !row.duplicate).length} nouvelle(s).`,
    )
  }

  const refreshCsvPreview = (
    nextMapping: CsvColumnMapping,
    member: FamilyMember = csvImportMember,
  ) => {
    if (csvRawData.headers.length === 0) {
      return
    }

    const parsedRows = parseCsvTransactions(csvRawData, nextMapping, transactions, member)
    setCsvPreview(parsedRows)
    if (parsedRows.length === 0) {
      setCsvStatus('Mapping incomplet ou non exploitable. Selectionnez date, libelle et montant.')
      return
    }

    const newRowsCount = parsedRows.filter((row) => !row.duplicate).length
    setCsvStatus(`${parsedRows.length} operation(s) analysee(s), ${newRowsCount} nouvelle(s), ${parsedRows.length - newRowsCount} doublon(s).`)
  }

  const persistCsvMapping = (bankKey: string, nextMapping: CsvColumnMapping) => {
    if (!bankKey) {
      return
    }

    const nextMappings = {
      ...storedCsvMappings,
      [bankKey]: nextMapping,
    }
    setStoredCsvMappings(nextMappings)
    saveStoredCsvMappings(nextMappings)
  }

  const importCsvPreview = () => {
    if (csvPreview.length === 0) {
      return
    }

    const importedTransactions: Transaction[] = csvPreview
      .filter((row) => !row.duplicate)
      .map((row) => ({
        id: row.id,
        label: row.label,
        amount: row.amount,
        category: row.category,
        member: csvImportMember,
        date: row.date,
        kind: row.kind,
        envelope: inferEnvelope(row.category),
      }))

    if (importedTransactions.length === 0) {
      setCsvStatus('Aucune nouvelle ligne a importer: tout est deja present.')
      return
    }

    setTransactions((previous) => [...previous, ...importedTransactions])
    persistCsvMapping(csvBankKey, csvMapping)
    const profileName = profiles.find((profile) => profile.id === csvImportMember)?.name ?? csvImportMember
    setCsvStatus(`${importedTransactions.length} operation(s) importee(s) pour ${profileName}.`)
    setCsvPreview([])
    setCsvRawData({ headers: [], rows: [] })
    setCsvMapping(defaultCsvMapping)
    setCsvBankKey('')
  }

  const exportMonthlyPdf = async () => {
    const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])

    const document = new JsPdf()
    const reportDate = new Date().toLocaleDateString('fr-FR')
    const pageWidth = document.internal.pageSize.getWidth()
    const summaryCards = [
      { title: 'Budget', value: euroFormatter.format(budget), color: [249, 115, 22] as const },
      { title: 'Depenses', value: euroFormatter.format(monthlyExpense), color: [244, 63, 94] as const },
      { title: 'Revenus', value: euroFormatter.format(monthlyIncome), color: [34, 197, 94] as const },
      { title: 'Solde', value: euroFormatter.format(monthlyNet), color: [14, 165, 233] as const },
    ]
    const categoryRows = goalProgress.map((goal) => [
      goal.category,
      euroFormatter.format(goal.spent),
      euroFormatter.format(goal.target),
      `${goal.rate.toFixed(0)}%`,
    ])
    const transactionRows = activeMonthTransactions
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => [
        item.date,
        item.label,
        item.category,
        item.kind === 'depense' ? 'Depense' : 'Revenu',
        euroFormatter.format(item.amount),
      ])

    document.setFillColor(11, 16, 32)
    document.rect(0, 0, pageWidth, 297, 'F')
    document.setTextColor(255, 255, 255)
    document.setFontSize(11)
    document.text('PLAN FINANCIER', 14, 16)
    document.setFontSize(24)
    document.text(`Bilan premium - ${selectedProfileName}`, 14, 30)
    document.setFontSize(10)
    document.setTextColor(212, 212, 216)
    document.text(`Periode ${currentMonth}  •  Genere le ${reportDate}`, 14, 38)
    document.text('Synthese budget, objectifs, depenses et import intelligent.', 14, 45)

    summaryCards.forEach((card, index) => {
      const x = 14 + index * 46
      document.setFillColor(20, 28, 48)
      document.roundedRect(x, 56, 40, 28, 4, 4, 'F')
      document.setFillColor(card.color[0], card.color[1], card.color[2])
      document.roundedRect(x, 56, 40, 5, 4, 4, 'F')
      document.setTextColor(255, 255, 255)
      document.setFontSize(9)
      document.text(card.title, x + 3, 67)
      document.setFontSize(12)
      document.text(card.value, x + 3, 77)
    })

    document.setTextColor(255, 255, 255)
    document.setFontSize(12)
    document.text('Top categories du mois', 14, 98)

    goalProgress.slice(0, 5).forEach((goal, index) => {
      const y = 108 + index * 14
      const barWidth = Math.min(120, (goal.spent / Math.max(goal.target, 1)) * 120)
      const color = categoryColors[goal.category]
      const rgb = color.match(/[0-9a-f]{2}/gi)?.map((value) => parseInt(value, 16)) ?? [249, 115, 22]
      document.setTextColor(212, 212, 216)
      document.setFontSize(9)
      document.text(goal.category, 14, y)
      document.setFillColor(40, 48, 68)
      document.roundedRect(52, y - 4, 120, 5, 2, 2, 'F')
      document.setFillColor(rgb[0], rgb[1], rgb[2])
      document.roundedRect(52, y - 4, Math.max(6, barWidth), 5, 2, 2, 'F')
      document.text(`${euroFormatter.format(goal.spent)} / ${euroFormatter.format(goal.target)}`, 177, y)
    })

    document.setTextColor(255, 255, 255)
    document.setFontSize(12)
    document.text('Alertes et points de vigilance', 14, 188)
    document.setFontSize(9)
    ;(alertMessages.length > 0 ? alertMessages.map((a) => a.message) : ['Aucune alerte active sur la periode.']).forEach(
      (message, index) => {
        document.setTextColor(212, 212, 216)
        document.text(`• ${message}`, 18, 198 + index * 8)
      },
    )

    document.addPage()
    document.setFontSize(18)
    document.setTextColor(20, 23, 31)
    document.text(`Detail mensuel - ${selectedProfileName}`, 14, 18)
    document.setFontSize(10)
    document.setTextColor(100, 116, 139)
    document.text(`Objectifs, transactions et analyse au ${reportDate}`, 14, 25)

    autoTable(document, {
      startY: 34,
      head: [['Categorie', 'Depense', 'Objectif', 'Progression']],
      body: categoryRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [249, 115, 22] },
    })

    const lastTableY = (document as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
    autoTable(document, {
      startY: lastTableY ? lastTableY + 8 : 96,
      head: [['Date', 'Libelle', 'Categorie', 'Type', 'Montant']],
      body: transactionRows.length > 0 ? transactionRows : [['-', 'Aucune operation', '-', '-', '-']],
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [34, 197, 94] },
    })

    document.save(`bilan-${selectedProfileName.toLowerCase().replace(/\s+/g, '-')}-${currentMonth}.pdf`)
  }

  const exportBudgetSummary = async () => {
    const todayLabel = new Date().toLocaleDateString('fr-FR')
    const fileBase = `resume-budget-${currentMonth}`
    const summary = {
      date: todayLabel,
      profil: selectedProfileName,
      mois: currentMonth,
      budget,
      depense: monthlyExpense,
      revenu: monthlyIncome,
      reste: remaining,
      utilisationPercent: Number(usageRate.toFixed(0)),
      etat: budgetStatusLabel,
      score: budgetMasteryScore,
      projectionDepense: Math.round(projectionData.projectedExpense),
      projectionEcart: Math.round(projectionData.projectedOverrun),
      message: budgetSimpleMessage,
      actions: budgetActionsList,
    }

    const downloadBlob = (content: BlobPart, mimeType: string, extension: string) => {
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${fileBase}.${extension}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    }

    if (budgetExportFormat === 'txt') {
      const text = [
        `Résumé Budget - ${todayLabel}`,
        `Profil: ${selectedProfileName}`,
        `Mois: ${currentMonth}`,
        '',
        `Budget: ${euroFormatter.format(budget)}`,
        `Dépensé: ${euroFormatter.format(monthlyExpense)}`,
        `Revenus: ${euroFormatter.format(monthlyIncome)}`,
        `Reste: ${euroFormatter.format(remaining)}`,
        `Utilisation: ${usageRate.toFixed(0)}%`,
        `Score de maîtrise: ${budgetMasteryScore}/100`,
        `Projection dépenses fin de mois: ${euroFormatter.format(projectionData.projectedExpense)}`,
        `État: ${budgetStatusLabel}`,
        '',
        'Actions recommandées:',
        ...budgetActionsList.map((action) => `- ${action}`),
      ].join('\n')
      downloadBlob(text, 'text/plain;charset=utf-8', 'txt')
      return
    }

    if (budgetExportFormat === 'csv') {
      const escapeCsvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
      const csvRows = [
        ['date', 'profil', 'mois', 'budget', 'depense', 'revenu', 'reste', 'utilisation_percent', 'score', 'projection_depense', 'projection_ecart', 'etat', 'message'],
        [
          summary.date,
          summary.profil,
          summary.mois,
          summary.budget,
          summary.depense,
          summary.revenu,
          summary.reste,
          summary.utilisationPercent,
          summary.score,
          summary.projectionDepense,
          summary.projectionEcart,
          summary.etat,
          summary.message,
        ],
      ]
      const actionsRows = budgetActionsList.map((action) => ['action', action])
      const csv = [...csvRows.map((row) => row.map(escapeCsvCell).join(',')), ...actionsRows.map((row) => row.map(escapeCsvCell).join(','))].join('\n')
      downloadBlob(csv, 'text/csv;charset=utf-8', 'csv')
      return
    }

    if (budgetExportFormat === 'json') {
      downloadBlob(JSON.stringify(summary, null, 2), 'application/json;charset=utf-8', 'json')
      return
    }

    await exportMonthlyPdf()
  }


  const handleLogout = () => {
    void signOut(auth)
    closeSettingsPanel()
  }

  const updateSettingsValue = (
    field:
      | 'parentPinValidation'
      | 'newParentPin'
      | 'confirmNewParentPin'
      | 'resetPinValidation'
      | 'newProfileName'
      | 'newProfileBudget'
      | 'manageProfileName'
      | 'manageProfileBudget',
    value: string,
  ) => {
    if (field === 'newProfileName' || field === 'manageProfileName') {
      setSettingsForm((previous) => ({
        ...previous,
        [field]: value,
      }))
      return
    }

    setSettingsForm((previous) => ({
      ...previous,
      [field]: value.replace(/\D/g, ''),
    }))
  }

  const handleManagedProfileSelection = (profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId)
    if (!profile) {
      return
    }

    setSettingsForm((previous) => ({
      ...previous,
      manageProfileId: profile.id,
      manageProfileName: profile.name,
      manageProfileBudget: String(profile.monthlyBudget),
    }))
  }

  const handleUpdateManagedProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSettingsError('')
    setSettingsSuccess('')

    const profile = managedProfile
    const nextName = settingsForm.manageProfileName.trim()
    const nextBudget = Number(settingsForm.manageProfileBudget)

    if (!nextName) {
      setSettingsError('Le nom du profil est obligatoire.')
      return
    }

    if (Number.isNaN(nextBudget) || nextBudget < 200) {
      setSettingsError('Le budget du profil doit etre superieur ou egal a 200 EUR.')
      return
    }

    setProfiles((previous) =>
      previous.map((item) =>
        item.id === profile.id
          ? { ...item, name: nextName, monthlyBudget: Math.round(nextBudget) }
          : item,
      ),
    )
    setSettingsSuccess('Profil mis a jour.')
  }

  const openQuickBudgetEditor = () => {
    setBudgetQuickEditValue(String(selectedProfileBudget))
    setBudgetQuickEditOpen(true)
  }

  const isBudgetAiConfigured = anthropicKey.trim().length > 0

  const requestBudgetAssistantAdvice = async () => {
    if (!isBudgetAiConfigured || budgetAssistantLoading) {
      return
    }

    setBudgetAssistantLoading(true)
    setBudgetAssistantError('')

    const prompt = `Tu es un assistant budget familial. Donne des conseils concrets et simples.
Contexte:
- Profil: ${selectedProfileName}
- Mois: ${formatMonth(selectedMonth)}
- Budget: ${euroFormatter.format(budget)}
- Dépenses: ${euroFormatter.format(monthlyExpense)} (${usageRate.toFixed(0)}% du budget)
- Revenus: ${euroFormatter.format(monthlyIncome)}
- Reste: ${euroFormatter.format(remaining)}
- État: ${budgetStatusLabel}
- Projection: ${projectedMessage}

Réponse attendue:
- 4 lignes maximum
- français simple
- format: "Résumé" puis 2 actions courtes
- pas de markdown
- ton bienveillant et direct.`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 220,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        const msg = (err as { error?: { message?: string } }).error?.message ?? `Erreur ${response.status}`
        setBudgetAssistantError(msg)
        return
      }

      type AnthropicResponse = { content: Array<{ type: string; text: string }> }
      const data = (await response.json()) as AnthropicResponse
      const text = data.content.find((c) => c.type === 'text')?.text?.trim() ?? ''
      setBudgetAssistantAdvice(text || 'Conseil IA indisponible pour le moment.')
      setBudgetAssistantContextLoaded(budgetAssistantContextKey)
    } catch {
      setBudgetAssistantError('Impossible de contacter Claude pour le moment.')
    } finally {
      setBudgetAssistantLoading(false)
    }
  }

  const handleBudgetAiClick = () => {
    if (!isBudgetAiConfigured) {
      setBudgetAiHintOpen(true)
      return
    }
    setBudgetAiHintOpen((previous) => !previous)
  }

  useEffect(() => {
    if (activeSectionId !== 'budget') {
      return
    }

    if (!isBudgetAiConfigured) {
      setBudgetAssistantAdvice('')
      setBudgetAssistantError('')
      setBudgetAssistantContextLoaded(budgetAssistantContextKey)
      return
    }

    if (budgetAssistantContextLoaded === budgetAssistantContextKey || budgetAssistantLoading) {
      return
    }

    void requestBudgetAssistantAdvice()
  }, [
    activeSectionId,
    budgetAssistantContextKey,
    budgetAssistantContextLoaded,
    budgetAssistantLoading,
    isBudgetAiConfigured,
  ])

  const applyQuickBudgetUpdate = () => {
    const nextBudget = Number(budgetQuickEditValue)
    if (Number.isNaN(nextBudget) || nextBudget < 200) {
      return
    }

    setProfiles((previous) =>
      previous.map((item) =>
        item.id === selectedProfileId
          ? { ...item, monthlyBudget: Math.round(nextBudget) }
          : item,
      ),
    )
    setSettingsForm((previous) =>
      previous.manageProfileId === selectedProfileId
        ? { ...previous, manageProfileBudget: String(Math.round(nextBudget)) }
        : previous,
    )
    setBudgetQuickEditOpen(false)
  }

  const handleSetDefaultProfile = () => {
    setSettingsError('')
    setSettingsSuccess('')
    setDefaultProfileId(managedProfile.id)
    setSettingsSuccess(`Profil par defaut defini: ${managedProfile.name}.`)
  }

  const handleDeleteManagedProfile = () => {
    setSettingsError('')
    setSettingsSuccess('')

    if (profiles.length <= 1) {
      setSettingsError('Impossible de supprimer le dernier profil.')
      return
    }

    const profileIdToDelete = managedProfile.id
    const remainingProfiles = profiles.filter((profile) => profile.id !== profileIdToDelete)
    const fallbackProfileId = remainingProfiles[0]?.id ?? defaultProfile.id

    setProfiles(remainingProfiles)
    setTransactions((previous) => previous.filter((item) => item.member !== profileIdToDelete))
    setSavingsGoals((previous) => {
      const next = { ...previous }
      delete next[profileIdToDelete]
      return next
    })
    setRolloverState((previous) => {
      const nextCarryOver = { ...previous.carryOver }
      delete nextCarryOver[profileIdToDelete]
      return {
        ...previous,
        carryOver: nextCarryOver,
      }
    })

    if (selectedMember === profileIdToDelete) {
      setSelectedMember(fallbackProfileId)
    }
    if (csvImportMember === profileIdToDelete) {
      setCsvImportMember(fallbackProfileId)
    }
    if (form.member === profileIdToDelete) {
      setForm((previous) => ({ ...previous, member: fallbackProfileId }))
    }
    if (defaultProfileId === profileIdToDelete) {
      setDefaultProfileId(fallbackProfileId)
    }

    handleManagedProfileSelection(fallbackProfileId)
    setSettingsSuccess('Profil supprime et donnees associees nettoyees.')
  }

  const handleExportEncryptedBackup = async () => {
    setSettingsError('')
    setSettingsSuccess('')

    const pin = window.prompt('Entrez le PIN parent pour chiffrer la sauvegarde:')
    if (!pin) {
      return
    }

    if (pin !== sensitiveState.parentPin) {
      setSettingsError('PIN parent incorrect. Sauvegarde annulee.')
      return
    }

    const payload: BackupPayload = {
      profiles,
      activeProfileId: selectedProfileId,
      defaultProfileId,
      transactions,
      savingsGoals,
      rolloverState,
      storedCsvMappings,
    }

    const encrypted = await encryptBackupPayload(payload, pin)
    const blob = new Blob([JSON.stringify(encrypted, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `plan-financier-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setSettingsSuccess('Sauvegarde chiffree exportee.')
  }

  const handleRestoreEncryptedBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettingsError('')
    setSettingsSuccess('')

    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const content = await file.text()
      const encrypted = JSON.parse(content) as EncryptedBackup
      if (
        encrypted.version !== BACKUP_VERSION ||
        typeof encrypted.salt !== 'string' ||
        typeof encrypted.iv !== 'string' ||
        typeof encrypted.cipher !== 'string'
      ) {
        setSettingsError('Format de sauvegarde invalide.')
        return
      }

      const pin = window.prompt('Entrez le PIN parent pour restaurer la sauvegarde:')
      if (!pin) {
        return
      }

      const payload = await decryptBackupPayload(encrypted, pin)
      const restoredProfiles = payload.profiles
        .map((profile) => normalizeProfile(profile))
        .filter((profile): profile is UserProfile => profile !== null)

      if (restoredProfiles.length === 0) {
        setSettingsError('La sauvegarde ne contient aucun profil valide.')
        return
      }

      const validProfileIds = new Set(restoredProfiles.map((profile) => profile.id))
      const restoredTransactions = payload.transactions
        .map((item) => normalizeTransaction(item))
        .filter((item): item is Transaction => item !== null)
        .filter((item) => validProfileIds.has(item.member))
      const restoredGoals = buildDefaultGoalsForProfiles(restoredProfiles)
      Object.entries(payload.savingsGoals ?? {}).forEach(([profileId, goals]) => {
        if (!validProfileIds.has(profileId) || !goals) {
          return
        }

        restoredGoals[profileId] = {
          ...defaultGoalTemplate,
          ...goals,
        }
      })

      const restoredRollover = loadRolloverState(currentMonth, restoredProfiles)
      if (payload.rolloverState?.carryOver) {
        restoredRollover.month =
          typeof payload.rolloverState.month === 'string'
            ? payload.rolloverState.month
            : currentMonth
        restoredRollover.carryOver = restoredProfiles.reduce<Record<string, number>>(
          (accumulator, profile) => {
            accumulator[profile.id] = Number(payload.rolloverState.carryOver[profile.id] ?? 0)
            return accumulator
          },
          {},
        )
      }

      const restoredActiveProfileId =
        typeof payload.activeProfileId === 'string' && validProfileIds.has(payload.activeProfileId)
          ? payload.activeProfileId
          : restoredProfiles[0].id
      const restoredDefaultProfileId =
        typeof payload.defaultProfileId === 'string' && validProfileIds.has(payload.defaultProfileId)
          ? payload.defaultProfileId
          : restoredProfiles[0].id

      setProfiles(restoredProfiles)
      setSelectedMember(restoredActiveProfileId)
      setCsvImportMember(restoredActiveProfileId)
      setDefaultProfileId(restoredDefaultProfileId)
      setTransactions(restoredTransactions)
      setSavingsGoals(restoredGoals)
      setRolloverState(restoredRollover)
      setStoredCsvMappings(payload.storedCsvMappings ?? {})
      saveStoredCsvMappings(payload.storedCsvMappings ?? {})
      setForm((previous) => ({ ...previous, member: restoredActiveProfileId }))
      handleManagedProfileSelection(restoredActiveProfileId)
      setSettingsSuccess('Sauvegarde restauree avec succes.')
    } catch {
      setSettingsError('Echec de restauration: PIN invalide ou fichier corrompu.')
    } finally {
      event.target.value = ''
    }
  }

  const handleAddProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSettingsError('')
    setSettingsSuccess('')

    const profileName = settingsForm.newProfileName.trim()
    const budget = Number(settingsForm.newProfileBudget)

    if (!profileName) {
      setSettingsError('Le nom du profil est obligatoire.')
      return
    }

    if (Number.isNaN(budget) || budget < 200) {
      setSettingsError('Le budget mensuel du profil doit etre superieur ou egal a 200 EUR.')
      return
    }

    const nextId = sanitizeProfileId(profileName)
    if (!nextId) {
      setSettingsError('Nom de profil invalide.')
      return
    }

    if (profiles.some((profile) => profile.id === nextId)) {
      setSettingsError('Un profil avec ce nom existe deja.')
      return
    }

    const nextProfile: UserProfile = {
      id: nextId,
      name: profileName,
      monthlyBudget: Math.round(budget),
    }

    setProfiles((previous) => [...previous, nextProfile])
    setSavingsGoals((previous) => ({
      ...previous,
      [nextProfile.id]: { ...defaultGoalTemplate },
    }))
    setRolloverState((previous) => ({
      ...previous,
      carryOver: {
        ...previous.carryOver,
        [nextProfile.id]: 0,
      },
    }))
    setSelectedMember(nextProfile.id)
    setCsvImportMember(nextProfile.id)
    setForm((previous) => ({ ...previous, member: nextProfile.id }))
    setSettingsForm((previous) => ({
      ...previous,
      newProfileName: '',
      newProfileBudget: previous.newProfileBudget,
    }))
    setSettingsSuccess('Profil ajoute. La base multi-profils est maintenant active et evolutive.')
  }

  const handlePinUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSettingsError('')
    setSettingsSuccess('')

    if (authRole !== 'Parent') {
      setSettingsError('Seul le parent peut modifier les PIN.')
      return
    }

    if (settingsForm.parentPinValidation !== sensitiveState.parentPin) {
      setSettingsError('PIN parent incorrect.')
      return
    }

    const hasParentUpdate = settingsForm.newParentPin.length > 0
    const requestedSessionDuration = Number(settingsForm.sessionDurationDays)
    const hasSessionDurationUpdate =
      requestedSessionDuration !== sensitiveState.sessionDurationDays

    if (!hasParentUpdate && !hasSessionDurationUpdate) {
      setSettingsError('Aucun changement detecte dans les parametres.')
      return
    }

    if (!SESSION_DURATION_OPTIONS.includes(requestedSessionDuration as 7 | 14 | 30)) {
      setSettingsError('La duree de session doit etre 7, 14 ou 30 jours.')
      return
    }

    const hasValidLength = [settingsForm.newParentPin]
      .filter((pin) => pin.length > 0)
      .every((pin) => pin.length >= 4 && pin.length <= 6)

    if (!hasValidLength) {
      setSettingsError('Chaque nouveau PIN doit contenir entre 4 et 6 chiffres.')
      return
    }

    if (
      hasParentUpdate &&
      settingsForm.newParentPin !== settingsForm.confirmNewParentPin
    ) {
      setSettingsError('La confirmation du nouveau PIN parent ne correspond pas.')
      return
    }

    const nextSensitiveState: SensitiveState = {
      ...sensitiveState,
      parentPin: hasParentUpdate ? settingsForm.newParentPin : sensitiveState.parentPin,
      sessionDurationDays: requestedSessionDuration as 7 | 14 | 30,
    }

    setSensitiveState(nextSensitiveState)
    await saveSensitiveState(nextSensitiveState)
    if (hasParentUpdate) {
      setPinLogs(
        addPinChangeLog({
          actor: 'Parent',
          parentPinChanged: hasParentUpdate,
        }),
      )
    }
    setSettingsSuccess('Parametres de securite mis a jour avec succes.')
    setSettingsForm({
      parentPinValidation: '',
      newParentPin: '',
      confirmNewParentPin: '',
      sessionDurationDays: String(nextSensitiveState.sessionDurationDays),
      resetPinValidation: '',
      newProfileName: '',
      newProfileBudget: settingsForm.newProfileBudget,
      manageProfileId: managedProfile.id,
      manageProfileName: managedProfile.name,
      manageProfileBudget: String(managedProfile.monthlyBudget),
    })
  }

  const handleResetLocalData = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSettingsError('')
    setSettingsSuccess('')

    if (authRole !== 'Parent') {
      setSettingsError('Seul le parent peut reinitialiser les donnees.')
      return
    }

    if (settingsForm.resetPinValidation !== sensitiveState.parentPin) {
      setSettingsError('PIN parent incorrect pour la reinitialisation.')
      return
    }

    setShowResetConfirmModal(true)
  }

  const resetLocalState = async (nextParentPin: string) => {
    const resetState = await resetSensitiveStorage()
    const nextSensitiveState: SensitiveState = {
      ...resetState,
      parentPin: nextParentPin,
      persistedSession: undefined,
    }

    await saveSensitiveState(nextSensitiveState)

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TRANSACTIONS_STORAGE_KEY)
      window.localStorage.removeItem(ROLLOVER_STORAGE_KEY)
      window.localStorage.removeItem(GOALS_STORAGE_KEY)
      window.localStorage.removeItem(PROFILES_STORAGE_KEY)
      window.localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY)
      window.localStorage.removeItem(DEFAULT_PROFILE_STORAGE_KEY)
    }

    clearPinChangeLogs()
    setPinLogs([])
    setTransactions(baseTransactions)
    setProfiles([defaultProfile])
    setSelectedMember(defaultProfile.id)
    setDefaultProfileId(defaultProfile.id)
    setCsvImportMember(defaultProfile.id)
    setSavingsGoals(defaultSavingsGoals)
    setRolloverState({ month: currentMonth, carryOver: { [defaultProfile.id]: 0 } })
    setSensitiveState(nextSensitiveState)
    setIsAuthenticated(false)
    setAuthRole('Parent')
    closeSettingsPanel()
    setShowResetConfirmModal(false)
    setSmartCategory(null)
    setForm((previous) => ({ ...previous, member: defaultProfile.id }))
    setSettingsForm({
      parentPinValidation: '',
      newParentPin: '',
      confirmNewParentPin: '',
      sessionDurationDays: String(nextSensitiveState.sessionDurationDays),
      resetPinValidation: '',
      newProfileName: '',
      newProfileBudget: '2000',
      manageProfileId: defaultProfile.id,
      manageProfileName: defaultProfile.name,
      manageProfileBudget: String(defaultProfile.monthlyBudget),
    })
  }

  const executeLocalReset = async () => {
    await resetLocalState(defaultSensitiveState.parentPin)
  }



  if (!isSecurityReady || !firebaseAuthReady) {
    return (
      <main className="auth-shell auth-shell-loading">
        <section className="glass-card auth-card auth-card-loading" aria-busy="true" aria-live="polite">
          <div className="auth-brand">
            <div className="auth-brand-icon">
              <img src="/logo.png" alt="Logo FP" />
            </div>
            <div className="auth-loading-spinner" aria-hidden="true" />
          </div>
          <h1>Chargement en cours…</h1>
          <p className="auth-loading-text">Préparation de votre espace budget.</p>
          <div className="auth-loading-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      </main>
    )
  }

  if (!isAuthenticated) {
    return <AuthScreen />
  }

  return (
    <>
    {/* ── Onboarding wizard (première utilisation) ──────────────────── */}
    {showOnboarding ? (
      <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Configuration initiale">
        <div className="onboarding-modal glass-card">
          <div className="onboarding-header">
            <span className="eyebrow">Bienvenue sur Plan Financier</span>
            <h2>Comment voulez-vous démarrer ?</h2>
            {onboardingStep === 1 ? (
              <p>Choisissez votre mode de démarrage. Vous pourrez toujours tout modifier ensuite.</p>
            ) : null}
          </div>

          {onboardingStep === 1 ? (
            <div className="onboarding-step1">
              <div className="onboarding-choice-grid">
                {/* Option IA */}
                <button
                  type="button"
                  className="onboarding-choice-card"
                  onClick={() => setOnboardingStep(2)}
                >
                  <span className="onboarding-choice-icon">✦</span>
                  <strong>Configurer avec l'IA</strong>
                  <p>Choisissez ensuite votre fournisseur IA, ajoutez votre clé API puis laissez l'assistant vous aider à paramétrer le budget.</p>
                  <span className="onboarding-choice-badge">Recommandé</span>
                </button>

                {/* Option manuelle */}
                <button
                  type="button"
                  className="onboarding-choice-card onboarding-choice-card--manual"
                  onClick={skipOnboarding}
                >
                  <span className="onboarding-choice-icon">⊞</span>
                  <strong>Dashboard vide</strong>
                  <p>Démarrez avec un tableau de bord vide et configurez tout à votre rythme depuis les paramètres.</p>
                </button>
              </div>
            </div>
          ) : onboardingStep === 2 ? (
            <div className="onboarding-step1">
              <button
                type="button"
                className="onboarding-back-btn"
                onClick={() => setOnboardingStep(1)}
              >
                ← Retour
              </button>
              <div className="onboarding-provider-grid">
                {ONBOARDING_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    className={`onboarding-provider-card${onboardingProvider === provider.id ? ' onboarding-provider-card--active' : ''}${!provider.supported ? ' onboarding-provider-card--disabled' : ''}`}
                    onClick={() => {
                      setOnboardingProvider(provider.id)
                      setOnboardingError('')
                    }}
                  >
                    <div className="onboarding-provider-card__head">
                      {provider.logoSrc ? (
                        <img
                          className="onboarding-provider-logo"
                          src={provider.logoSrc}
                          alt={`Logo ${provider.name}`}
                        />
                      ) : (
                        <span className={`onboarding-provider-badge onboarding-provider-badge--${provider.tone}`}>
                          {provider.badge}
                        </span>
                      )}
                      <div className="onboarding-provider-card__info">
                        <strong>{provider.name}</strong>
                        <span className="onboarding-provider-model">{provider.modelLabel}</span>
                      </div>
                      <span className={`onboarding-provider-pill${provider.supported ? ' onboarding-provider-pill--active' : ' onboarding-provider-pill--disabled'}`}>
                        {provider.supported ? '✓ Actif' : 'Indisponible'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {onboardingProvider !== null && (() => {
                const selectedProvider = ONBOARDING_PROVIDERS.find((provider) => provider.id === onboardingProvider) ?? ONBOARDING_PROVIDERS[0]
                return (
                  <>
                    <div className="onboarding-provider-help glass-card">
                      <div>
                        <h3>{selectedProvider.name}</h3>
                        <p>
                          Récupérez votre clé API puis conservez-la sur cet appareil. FP ne l'envoie nulle part sauf vers le fournisseur choisi au moment des appels IA.
                        </p>
                      </div>
                      <div className="onboarding-provider-help__actions">
                        <a href={selectedProvider.helpUrl} target="_blank" rel="noreferrer">Guide API</a>
                        <a href={selectedProvider.consoleUrl} target="_blank" rel="noreferrer">Créer / voir ma clé</a>
                      </div>
                    </div>
                    <label className="onboarding-key-label">
                      Clé API {selectedProvider.name}
                      <input
                        type="password"
                        value={onboardingKeyDraft}
                        onChange={(e) => setOnboardingKeyDraft(e.target.value)}
                        placeholder={selectedProvider.keyPlaceholder}
                        autoComplete="off"
                        disabled={onboardingLoading || !selectedProvider.supported}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleOnboardingStart() }}
                      />
                      <span className="onboarding-key-hint">
                        {selectedProvider.supported
                          ? 'La clé reste stockée uniquement sur cet appareil. Vous pourrez la modifier plus tard dans les paramètres.'
                          : 'Vous pouvez préparer votre clé dès maintenant, mais FP ne sait pas encore utiliser ce fournisseur pendant l’onboarding.'}
                      </span>
                    </label>
                    <div className="onboarding-legal-note">
                      <strong>Information légale</strong>
                      <p>{selectedProvider.legalNote}</p>
                      <p>
                        Vous êtes responsable du contrat, de la facturation, des transferts de données et du respect RGPD liés au fournisseur sélectionné.
                      </p>
                    </div>
                    {onboardingError ? <p className="auth-error">{onboardingError}</p> : null}
                    <div className="onboarding-actions">
                      <button
                        type="button"
                        className="hero-cta-button"
                        onClick={() => {
                          const key = onboardingKeyDraft.trim()
                          if (!key) { setOnboardingError('Veuillez entrer votre clé API.'); return }
                          setOnboardingError('')
                          setOnboardingStep(3)
                        }}
                        disabled={!selectedProvider.supported}
                      >
                        {selectedProvider.supported ? 'Continuer →' : `${selectedProvider.name} non disponible`}
                      </button>
                    </div>
                  </>
                )
              })()}
            </div>
          ) : onboardingStep === 3 ? (
            <div className="onboarding-profile-step">
              <button type="button" className="onboarding-back-btn" onClick={() => setOnboardingStep(2)}>← Retour</button>
              <p className="onboarding-profile-intro">Ces informations permettront à l'IA de personnaliser directement votre configuration.</p>

              <div className="onboarding-profile-question">
                <span className="onboarding-profile-qlabel">Votre situation</span>
                <div className="onboarding-profile-options">
                  {([['solo','👤 Solo'],['couple','👥 En couple'],['famille','👨‍👩‍👧 Famille']] as const).map(([val, label]) => (
                    <button key={val} type="button"
                      className={`onboarding-profile-chip${onboardingUserProfile.situation === val ? ' onboarding-profile-chip--active' : ''}`}
                      onClick={() => setOnboardingUserProfile(p => ({ ...p, situation: p.situation === val ? null : val }))}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="onboarding-profile-question">
                <span className="onboarding-profile-qlabel">Revenus nets mensuels</span>
                <div className="onboarding-profile-options">
                  {([['lt1500','< 1 500 €'],['1500-2500','1 500 – 2 500 €'],['2500-4000','2 500 – 4 000 €'],['gt4000','> 4 000 €']] as const).map(([val, label]) => (
                    <button key={val} type="button"
                      className={`onboarding-profile-chip${onboardingUserProfile.revenus === val ? ' onboarding-profile-chip--active' : ''}`}
                      onClick={() => setOnboardingUserProfile(p => ({ ...p, revenus: p.revenus === val ? null : val }))}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="onboarding-profile-question">
                <span className="onboarding-profile-qlabel">Objectif principal</span>
                <div className="onboarding-profile-options">
                  {([['epargner','💰 Épargner davantage'],['maitriser','📊 Maîtriser mes dépenses'],['rembourser','🔄 Rembourser des dettes'],['investir','📈 Investir']] as const).map(([val, label]) => (
                    <button key={val} type="button"
                      className={`onboarding-profile-chip${onboardingUserProfile.objectif === val ? ' onboarding-profile-chip--active' : ''}`}
                      onClick={() => setOnboardingUserProfile(p => ({ ...p, objectif: p.objectif === val ? null : val }))}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="onboarding-profile-question">
                <span className="onboarding-profile-qlabel">Votre niveau</span>
                <div className="onboarding-profile-options">
                  {([['debutant','🌱 Je débute'],['habitue','📋 J\'ai déjà un budget'],['expert','⚡ Je veux optimiser']] as const).map(([val, label]) => (
                    <button key={val} type="button"
                      className={`onboarding-profile-chip${onboardingUserProfile.niveau === val ? ' onboarding-profile-chip--active' : ''}`}
                      onClick={() => setOnboardingUserProfile(p => ({ ...p, niveau: p.niveau === val ? null : val }))}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="onboarding-actions">
                <button type="button" className="hero-cta-button" onClick={() => void handleOnboardingStart()} disabled={onboardingLoading}>
                  {onboardingLoading ? (
                    <span className="inline-loading-label"><span className="inline-loader" aria-hidden="true" />Lancement…</span>
                  ) : 'Lancer Claude →'}
                </button>
                <button type="button" className="ghost-button" style={{fontSize:'0.8rem',opacity:0.7}} onClick={() => void handleOnboardingStart()}>Passer cette étape</button>
              </div>
              {onboardingError ? <p className="auth-error">{onboardingError}</p> : null}
            </div>
          ) : (
            <div className="onboarding-step2">
              <button
                type="button"
                className="onboarding-back-btn"
                onClick={() => setOnboardingStep(3)}
              >
                ← Retour
              </button>
              <div className="onboarding-chat">
                {onboardingMessages.map((msg, i) => (
                  <div key={i} className={`onboarding-msg onboarding-msg--${msg.role}`}>
                    <span className="onboarding-msg__label">{msg.role === 'user' ? 'Vous' : 'Claude'}</span>
                    <p>{msg.content.replace(new RegExp('<config>[\\s\\S]*?<\\/config>', 'gi'), '').trim()}</p>
                  </div>
                ))}
                {onboardingLoading ? (
                  <div className="onboarding-msg onboarding-msg--assistant">
                    <span className="onboarding-msg__label">Claude</span>
                    <p className="onboarding-typing">…</p>
                  </div>
                ) : null}
                {parseOnboardingConfig(onboardingMessages.at(-1)?.content ?? '') ? (
                  <div className="onboarding-success">
                    ✓ Configuration appliquée — fermeture dans un instant…
                  </div>
                ) : null}
              </div>
              {!parseOnboardingConfig(onboardingMessages.at(-1)?.content ?? '') ? (
                <div className="onboarding-input-row">
                  <input
                    type="text"
                    value={onboardingInput}
                    onChange={(e) => setOnboardingInput(e.target.value)}
                    placeholder="Répondez à Claude…"
                    disabled={onboardingLoading}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleOnboardingSend() }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="hero-cta-button"
                    onClick={() => void handleOnboardingSend()}
                    disabled={onboardingLoading || !onboardingInput.trim()}
                  >
                    {onboardingLoading ? (
                      <span className="inline-loading-label"><span className="inline-loader" aria-hidden="true" />Envoi…</span>
                    ) : 'Envoyer'}
                  </button>
                </div>
              ) : null}
              <button type="button" className="ghost-button onboarding-skip" onClick={skipOnboarding}>
                Passer et configurer manuellement
              </button>
            </div>
          )}
        </div>
      </div>
    ) : null}

    <main className={`dashboard-shell${isActiveView('budget') || isActiveView('overview') ? ' dashboard-shell--three-columns' : ''}`} id="app-main" aria-label="Tableau de bord budgétaire">
      <h1 className="sr-only">Plan Financier — Tableau de bord</h1>
      <aside className="glass-card side-menu" aria-label="Navigation principale">
        <p className="eyebrow">Navigation</p>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeSectionId === item.id ? 'active' : ''}
              onClick={() => navigateToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="side-menu-footer">
          <button
            type="button"
            className="side-menu-settings-btn"
            onClick={() => openSettingsPanel('profiles')}
            aria-label="Ouvrir les paramètres"
          >
            ⚙️ Paramètres
          </button>
          <button
            type="button"
            className="side-menu-logout-btn"
            onClick={handleLogout}
            aria-label="Se déconnecter"
          >
            ⎋ Déconnexion
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        {isActiveView('overview') ? (
        <header id="overview" className="hero-header glass-card">
        {!isBudgetAiConfigured ? (
          <div className="hero-ai-info-bar" role="status" aria-live="polite">
            <div>
              <strong>Assistant IA non configuré</strong>
              <small>
                Activez votre fournisseur IA dans les paramètres pour débloquer les analyses automatiques et le coaching avancé.
              </small>
            </div>
            <button type="button" onClick={() => openSettingsPanel('ai')}>
              Configurer l&apos;IA
            </button>
          </div>
        ) : null}
        <div>
          <div className="app-brand-row">
            <img className="app-brand-logo" src="/logo.png" alt="Logo FP" />
          </div>
          <h2>Suivez votre argent simplement</h2>
          <p className="hero-copy">
            Tout est regroupé ici pour gérer votre budget facilement, sans jargon.
          </p>
        </div>
        <div className="header-actions">
          <div className="hero-priority-bar">
            <div className="member-toggle" role="tablist" aria-label="Selection profil">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedProfileId === profile.id}
                  className={selectedProfileId === profile.id ? 'active' : ''}
                  onClick={() => {
                    setSelectedMember(profile.id)
                    setCsvImportMember(profile.id)
                    setForm((previous) => ({ ...previous, member: profile.id }))
                  }}
                >
                  {profile.name}
                  {profile.id === defaultProfileId ? ' • Defaut' : ''}
                </button>
              ))}
            </div>
            <div className="month-nav month-nav--hero">
              <button type="button" onClick={() => navigateMonth(-1)} aria-label="Mois précédent">&#8249;</button>
              <label className="month-picker-label" title="Choisir un mois">
                <span>{formatMonth(selectedMonth)}</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="month-picker-input"
                  aria-label="Sélecteur de mois"
                />
              </label>
              <button type="button" onClick={() => navigateMonth(1)} aria-label="Mois suivant">&#8250;</button>
            </div>
          </div>
          <div className="hero-budget-bar">
            <div className="hero-budget-bar__track">
              <div
                className="hero-budget-bar__fill"
                style={{ width: `${Math.min(100, usageRate)}%`, background: usageRate >= 100 ? '#f43f5e' : usageRate >= 80 ? '#eab308' : '#22c55e' }}
              />
            </div>
            <span className="hero-budget-bar__label">
              {euroFormatter.format(monthlyExpense)} / {euroFormatter.format(budget)} &mdash; {usageRate.toFixed(0)}% utilisé
            </span>
          </div>
          <div className="hero-secondary-actions">
            <button type="button" className="ghost-button" onClick={() => openSettingsPanel('profiles')}>
              Paramètres
            </button>
            <button type="button" className="ghost-button" onClick={() => void exportMonthlyPdf()}>
              <Download size={16} /> PDF mensuel
            </button>
          </div>
        </div>
        </header>
        ) : null}

        {isActiveView('overview') ? (
        <section className="glass-card kpi-summary" style={{ margin: '0 0 1rem 0' }}>
          <div className="kpi-card kpi-card--primary">
            <div className="kpi-card-label">Solde disponible</div>
            <div className="kpi-card-value">{euroFormatter.format(budget - monthlyExpense)}</div>
            <div className="kpi-card-change" style={{ color: budget - monthlyExpense >= 0 ? 'var(--kpi-positive)' : 'var(--kpi-danger)' }}>
              {budget - monthlyExpense >= 0 ? '✓ En positif' : '⚠ À revoir'}
            </div>
          </div>
          <div className="kpi-card kpi-card--secondary">
            <div className="kpi-card-label">Revenus ce mois</div>
            <div className="kpi-card-value">{euroFormatter.format(monthlyIncome)}</div>
            <div className="kpi-card-change positive">+{incomeRate.toFixed(0)}% du budget</div>
          </div>
          <div className="kpi-card kpi-card--danger">
            <div className="kpi-card-label">Dépenses ce mois</div>
            <div className="kpi-card-value">{euroFormatter.format(monthlyExpense)}</div>
            <div className="kpi-card-change" style={{ color: usageRate >= 80 ? 'var(--kpi-danger)' : 'var(--kpi-warn)' }}>
              {usageRate.toFixed(0)}% du budget
            </div>
          </div>
          <div className="kpi-card kpi-card--accent">
            <div className="kpi-card-label">Économies possibles</div>
            <div className="kpi-card-value">{euroFormatter.format(Math.max(0, budget * 0.15 - monthlyExpense + monthlyIncome))}</div>
            <div className="kpi-card-change positive">Reste à optimiser</div>
          </div>
        </section>
        ) : null}

      {isActiveView('envelopes') ? (
      <section id="envelopes" className="glass-card envelope-strip">
        <div className="panel-title">
          <h2>Enveloppes</h2>
          <p>Segmentation budgétaire par poche de dépense</p>
        </div>
        <div className="envelope-actions">
          <div className="member-toggle" role="tablist" aria-label="Filtre enveloppe">
            {(['Tous', ...envelopes] as Array<'Tous' | Envelope>).map((envelope) => (
              <button
                key={envelope}
                type="button"
                className={selectedEnvelope === envelope ? 'active' : ''}
                aria-selected={selectedEnvelope === envelope}
                onClick={() => setSelectedEnvelope(envelope)}
              >
                {envelope}
              </button>
            ))}
          </div>
          <div className="envelope-kpis">
            {envelopeBreakdown.map((entry) => (
              <div key={entry.envelope} className="envelope-chip">
                <span className="dot" style={{ background: envelopeColors[entry.envelope] }} />
                <strong>{entry.envelope}</strong>
                <small>{euroFormatter.format(entry.total)}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {isActiveView('overview') ? (
      <section className={`widget-customizer${isWidgetDirectMode ? ' widget-customizer--direct' : ''}`} aria-label={isWidgetDirectMode ? 'Widgets du dashboard' : 'Personnalisation des widgets'}>
        <div className="widget-customizer-toolbar">
          <button
            type="button"
            className={widgetEditMode ? 'hero-cta-button' : 'ghost-button'}
            onClick={() => setWidgetEditMode((previous) => !previous)}
          >
            {widgetEditMode ? 'Terminer l’édition' : 'Modifier les widgets'}
          </button>
          <button type="button" className="ghost-button" onClick={resetDashboardWidgetLayout}>
            Réinitialiser la disposition
          </button>
        </div>
        <div className="widget-template-row" role="tablist" aria-label="Modèles de widgets">
          {DASHBOARD_WIDGET_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              role="tab"
              aria-selected={dashboardWidgetState.templateId === template.id}
              className={dashboardWidgetState.templateId === template.id ? 'active' : ''}
              onClick={() => applyDashboardWidgetTemplate(template.id)}
              title={template.description}
            >
              {template.label}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={dashboardWidgetState.templateId === 'custom'}
            className={dashboardWidgetState.templateId === 'custom' ? 'active' : ''}
          >
            Personnalisé
          </button>
        </div>
        <div className={`widget-board${widgetEditMode ? ' widget-board--editing' : ''}`}>
          {(widgetEditMode
            ? orderedVisibleDashboardWidgets
            : orderedVisibleDashboardWidgets.filter((widgetId) => widgetId !== 'coaching')
          ).map((widgetId) => {
            const widget = DASHBOARD_WIDGET_LIBRARY.find((entry) => entry.id === widgetId)
            if (!widget) return null

            const preview = widgetPreviewDefinitions[widgetId]
            const widgetSize = dashboardWidgetState.widgetSizes[widgetId] ?? getDefaultDashboardWidgetSize(widgetId)
            const isDragging = draggedWidgetId === widgetId
            const isDropTarget = dragOverWidgetId === widgetId && draggedWidgetId !== widgetId

            return (
              <article
                key={widgetId}
                className={`widget-preview-card widget-preview-card--${widgetSize}${isWidgetDirectMode ? ' widget-preview-card--direct' : ''}${widgetId === 'coaching' && !widgetEditMode ? ' widget-preview-card--advice-rail' : ''}${isDragging ? ' is-dragging' : ''}${isDropTarget ? ' is-drop-target' : ''}`}
                draggable={!isWidgetDirectMode && widgetEditMode}
                onDragStart={(event) => handleWidgetDragStart(event, widgetId)}
                onDragOver={(event) => handleWidgetDragOver(event, widgetId)}
                onDrop={(event) => handleWidgetDrop(event, widgetId)}
                onDragEnd={handleWidgetDragEnd}
                onClick={() => {
                  if (isWidgetDirectMode) {
                    openWidgetFromOverview(widgetId)
                  }
                }}
                onKeyDown={(event) => {
                  if (!isWidgetDirectMode) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openWidgetFromOverview(widgetId)
                  }
                }}
                tabIndex={isWidgetDirectMode ? 0 : undefined}
                role={isWidgetDirectMode ? 'button' : undefined}
              >
                {!isWidgetDirectMode ? (
                  <button
                    type="button"
                    className="widget-preview-card__remove"
                    aria-label={`Retirer ${widget.label}`}
                    onClick={() => toggleDashboardWidget(widgetId)}
                  >
                    ✕
                  </button>
                ) : null}
                <div className="widget-preview-card__top">
                  <div>
                    <span className="widget-preview-card__eyebrow">{preview.eyebrow}</span>
                    <h3>{preview.title}</h3>
                  </div>
                  {widgetEditMode ? (
                    <span className="widget-preview-card__drag" aria-hidden="true">
                      <GripVertical size={16} />
                    </span>
                  ) : null}
                </div>
                <p className="widget-preview-card__summary">{preview.summary}</p>
                <div className="widget-preview-card__accent">{preview.accent}</div>
                {widgetEditMode || isWidgetDirectMode ? (
                <div className="widget-preview-card__actions">
                  <button type="button" className="ghost-button" onClick={() => openWidgetFromOverview(widgetId)}>
                    Ouvrir
                  </button>
                  {!isWidgetDirectMode ? (
                    <button type="button" className="ghost-button" onClick={() => toggleDashboardWidgetSize(widgetId)}>
                      {widgetSize === 'large' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      {widgetSize === 'large' ? 'Réduire' : 'Agrandir'}
                    </button>
                  ) : null}
                </div>
                ) : null}
              </article>
            )
          })}
          {(widgetEditMode
            ? orderedVisibleDashboardWidgets
            : orderedVisibleDashboardWidgets.filter((widgetId) => widgetId !== 'coaching')
          ).length === 0 ? (
            <article className="widget-preview-card widget-preview-card--empty">
              <span className="widget-preview-card__eyebrow">Vide</span>
              <h3>Aucun widget sur la vue d’ensemble</h3>
              <p className="widget-preview-card__summary">Activez des widgets ci-dessous pour composer votre cockpit personnel.</p>
            </article>
          ) : null}
        </div>
        <div className="widget-chip-grid">
          {DASHBOARD_WIDGET_LIBRARY.map((widget) => {
            const active = visibleDashboardWidgets.has(widget.id)
            return (
              <button
                key={widget.id}
                type="button"
                className={`widget-chip${active ? ' widget-chip--active' : ''}`}
                onClick={() => toggleDashboardWidget(widget.id)}
                aria-pressed={active}
              >
                {widget.label}
              </button>
            )
          })}
        </div>
      </section>
      ) : null}

      {showSettings ? (
        <div
          className="modal-backdrop settings-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeSettingsPanel()
            }
          }}
        >
          <section className="glass-card settings-modal-card" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
            <div className="settings-modal-header">
              <div>
                <p className="eyebrow">Réglages sensibles</p>
                <h2 id="settings-modal-title">Paramètres du cockpit</h2>
                <p className="auth-note">
                  Profils, IA, sécurité, sauvegarde et reset sont séparés pour réduire la charge mentale.
                </p>
              </div>
              <button type="button" className="settings-close-button" onClick={closeSettingsPanel} aria-label="Fermer les paramètres">
                <X size={18} />
              </button>
            </div>

            <div className="settings-modal-body">
              <aside className="settings-nav" aria-label="Sections de paramètres">
                {[
                  ['profiles', 'Profils'],
                  ['ai', 'Claude AI'],
                  ['security', 'Sécurité'],
                  ['backup', 'Sauvegarde'],
                  ['theme', 'Thème'],
                  ['reset', 'Reset'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={settingsSection === id ? 'active' : ''}
                    onClick={() => setSettingsSection(id as SettingsSection)}
                  >
                    {label}
                  </button>
                ))}
              </aside>

              <div className="settings-content">
                {settingsError ? <p className="auth-error">{settingsError}</p> : null}
                {settingsSuccess ? <p className="auth-success">{settingsSuccess}</p> : null}

                {settingsSection === 'profiles' ? (
                  <div className="settings-section-grid">
                    <article className="glass-card settings-section-card form-panel">
                      <div className="panel-title">
                        <h2>Profils</h2>
                        <p>Crée, mets à jour et désigne le profil par défaut depuis un espace dédié.</p>
                      </div>
                      <form onSubmit={handleAddProfile}>
                        <label>
                          Nouveau profil
                          <input
                            value={settingsForm.newProfileName}
                            onChange={(event) => updateSettingsValue('newProfileName', event.target.value)}
                            placeholder="Ex: Pro, Perso, Studio"
                          />
                        </label>
                        <label>
                          Budget mensuel du profil
                          <input
                            type="number"
                            min="200"
                            value={settingsForm.newProfileBudget}
                            onChange={(event) => updateSettingsValue('newProfileBudget', event.target.value)}
                          />
                        </label>
                        <button type="submit">Ajouter le profil</button>
                        <p className="auth-note">Bascule ensuite dans le header pour piloter le bon contexte.</p>
                      </form>
                    </article>

                    <article className="glass-card settings-section-card form-panel">
                      <div className="panel-title">
                        <h2>Profil actif</h2>
                        <p>Réglages du profil sélectionné et choix du profil de repli.</p>
                      </div>
                      <form onSubmit={handleUpdateManagedProfile}>
                        <label>
                          Profil à gérer
                          <select
                            value={settingsForm.manageProfileId}
                            onChange={(event) => handleManagedProfileSelection(event.target.value)}
                          >
                            {profiles.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name}
                                {profile.id === defaultProfileId ? ' (défaut)' : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Nom du profil
                          <input
                            value={settingsForm.manageProfileName}
                            onChange={(event) => updateSettingsValue('manageProfileName', event.target.value)}
                          />
                        </label>
                        <label>
                          Budget mensuel
                          <input
                            type="number"
                            min="200"
                            value={settingsForm.manageProfileBudget}
                            onChange={(event) => updateSettingsValue('manageProfileBudget', event.target.value)}
                          />
                        </label>
                        <div className="settings-inline-actions">
                          <button type="submit">Mettre à jour</button>
                          <button type="button" className="ghost-button" onClick={handleSetDefaultProfile}>
                            Définir par défaut
                          </button>
                          <button type="button" className="danger-button" onClick={handleDeleteManagedProfile}>
                            Supprimer
                          </button>
                        </div>
                        <p className="auth-note">Le profil par défaut sert de filet de sécurité si un profil est supprimé.</p>
                      </form>
                    </article>
                  </div>
                ) : null}

                {settingsSection === 'ai' ? (
                  <div className="settings-section-grid">
                    <article className="glass-card settings-section-card form-panel claude-onboarding-card">
                      <div className="panel-title">
                        <h2>Claude AI</h2>
                        <p>Active l’assistant, vérifie la clé et rends son état explicite.</p>
                      </div>
                      <div className="claude-status-banner">
                        <strong>{anthropicKey ? 'Statut: activable' : 'Statut: inactif'}</strong>
                        <small>
                          {anthropicKey
                            ? 'Une clé est enregistrée localement. Teste-la avant de t’appuyer dessus.'
                            : 'Aucune clé enregistrée pour le moment.'}
                        </small>
                      </div>
                      <label>
                        Clé API Claude (sk-ant-…)
                        <input
                          type="password"
                          value={anthropicKey}
                          onChange={(event) => saveAnthropicKey(event.target.value)}
                          placeholder="sk-ant-api03-..."
                          autoComplete="off"
                        />
                      </label>
                      <div className="settings-inline-actions">
                        <button type="button" onClick={() => void testClaudeKey()} disabled={claudeTestState === 'testing'}>
                          {claudeTestState === 'testing' ? (
                            <span className="inline-loading-label"><span className="inline-loader" aria-hidden="true" />Test en cours...</span>
                          ) : 'Tester la clé'}
                        </button>
                        <button type="button" className="ghost-button" onClick={() => setChatOpen(true)} disabled={!anthropicKey}>
                          Ouvrir le chat
                        </button>
                      </div>
                      <p className={`claude-status-text claude-status-text--${claudeTestState}`}>
                        {claudeTestMessage || (anthropicKey ? 'Clé enregistrée localement.' : 'Ajoute une clé pour activer Claude.')}
                      </p>
                    </article>
                  </div>
                ) : null}

                {settingsSection === 'security' ? (
                  <div className="settings-section-grid">
                    <article className="glass-card settings-section-card form-panel">
                      <div className="panel-title">
                        <h2>Sécurité</h2>
                        <p>Mets à jour le PIN parent et la durée de session mémorisée.</p>
                      </div>
                      <form onSubmit={(event) => void handlePinUpdate(event)}>
                        <label>
                          PIN parent actuel
                          <input
                            required
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={settingsForm.parentPinValidation}
                            onChange={(event) => updateSettingsValue('parentPinValidation', event.target.value)}
                            placeholder="Entrez le PIN parent actuel"
                          />
                        </label>
                        <label>
                          Nouveau PIN parent (optionnel)
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={settingsForm.newParentPin}
                            onChange={(event) => updateSettingsValue('newParentPin', event.target.value)}
                            placeholder="4 à 6 chiffres"
                          />
                        </label>
                        <label>
                          Confirmer le nouveau PIN parent
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={settingsForm.confirmNewParentPin}
                            onChange={(event) => updateSettingsValue('confirmNewParentPin', event.target.value)}
                            placeholder="Retapez le nouveau PIN parent"
                          />
                        </label>
                        <label>
                          Durée de session mémorisée
                          <select
                            value={settingsForm.sessionDurationDays}
                            onChange={(event) =>
                              setSettingsForm((previous) => ({
                                ...previous,
                                sessionDurationDays: event.target.value,
                              }))
                            }
                          >
                            <option value="7">7 jours</option>
                            <option value="14">14 jours</option>
                            <option value="30">30 jours</option>
                          </select>
                        </label>
                        <button type="submit">Enregistrer les paramètres</button>
                      </form>
                    </article>

                    <article className="glass-card settings-section-card pin-log-zone">
                      <h3>Journal local des changements PIN</h3>
                      {pinLogs.length === 0 ? (
                        <p className="auth-note">Aucun changement PIN enregistré pour le moment.</p>
                      ) : (
                        <ul>
                          {pinLogs.slice(0, 8).map((entry) => (
                            <li key={entry.id}>
                              <span>
                                {new Date(entry.at).toLocaleString('fr-FR')} - {entry.actor}
                              </span>
                              <small>{entry.parentPinChanged ? 'PIN parent' : 'Mise à jour sécurité'}</small>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  </div>
                ) : null}

                {settingsSection === 'backup' ? (
                  <div className="settings-section-grid">
                    <article className="glass-card settings-section-card form-panel">
                      <div className="panel-title">
                        <h2>Sauvegarde chiffrée</h2>
                        <p>Exporte ou restaure les données locales avec le PIN parent.</p>
                      </div>
                      <div className="backup-zone backup-zone--standalone">
                        <p className="auth-note">Le fichier JSON exporté reste chiffré et portable entre appareils.</p>
                        <div className="settings-inline-actions">
                          <button type="button" onClick={() => void handleExportEncryptedBackup()}>
                            Exporter le backup chiffré
                          </button>
                          <button type="button" className="ghost-button" onClick={() => backupRestoreInputRef.current?.click()}>
                            Restaurer un backup
                          </button>
                        </div>
                        <input
                          ref={backupRestoreInputRef}
                          type="file"
                          accept="application/json,.json"
                          className="hidden-input"
                          onChange={(event) => void handleRestoreEncryptedBackup(event)}
                        />
                      </div>
                    </article>
                  </div>
                ) : null}

                {settingsSection === 'theme' ? (
                  <div className="settings-section-grid">
                    <article className="glass-card settings-section-card form-panel">
                      <div className="panel-title">
                        <h2>Thème</h2>
                        <p>Choisissez l'apparence de l'application.</p>
                      </div>
                      <div className="theme-picker">
                        {([
                          ['dark',   '🌙', 'Sombre'],
                          ['light',  '☀️', 'Clair'],
                          ['system', '💻', 'Système'],
                        ] as const).map(([value, icon, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`theme-option${theme === value ? ' theme-option--active' : ''}`}
                            onClick={() => setTheme(value)}
                          >
                            <span className="theme-option-icon">{icon}</span>
                            <span>{label}</span>
                            {theme === value ? <span className="theme-option-state">✓ sélectionné</span> : null}
                          </button>
                        ))}
                      </div>
                      <p className="auth-note">
                        Le mode Système suit automatiquement les préférences de votre appareil.
                      </p>
                    </article>
                  </div>
                ) : null}

                {settingsSection === 'reset' ? (
                  <div className="settings-section-grid">
                    <article className="glass-card settings-section-card form-panel danger-zone danger-zone--standalone">
                      <h3>Zone de réinitialisation</h3>
                      <p className="auth-note">
                        Cette action supprime les transactions locales, les PIN personnalisés et les sessions mémorisées.
                      </p>
                      <form onSubmit={(event) => void handleResetLocalData(event)}>
                        <label>
                          PIN parent pour confirmer
                          <input
                            required
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={settingsForm.resetPinValidation}
                            onChange={(event) => updateSettingsValue('resetPinValidation', event.target.value)}
                            placeholder="Entrez le PIN parent"
                          />
                        </label>
                        <button type="submit" className="danger-button">
                          Réinitialiser les données locales
                        </button>
                      </form>
                    </article>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {showResetConfirmModal ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="glass-card modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-reset-title"
          >
            <h2 id="confirm-reset-title">Confirmer la reinitialisation</h2>
            <p className="auth-note">
              Cette action est irreversible. Voulez-vous vraiment supprimer toutes les
              donnees locales de cette application ?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="logout-button"
                onClick={() => setShowResetConfirmModal(false)}
              >
                Annuler
              </button>
              <button type="button" className="danger-button" onClick={() => void executeLocalReset()}>
                Oui, reinitialiser
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeMonthTransactions.length === 0 && isActiveView('overview') ? (
        <section className="empty-month-state glass-card">
          <PiggyBank size={40} className="empty-month-icon" />
          <h2>Aucune transaction en {formatMonth(selectedMonth)}</h2>
          <p>Ce mois est vide. Ajoutez votre première opération pour commencer le suivi.</p>
          <button type="button" className="hero-cta-button" onClick={() => navigateToSection('operations')}>
            <Plus size={16} /> Ajouter une transaction
          </button>
        </section>
      ) : null}

      {isActiveView('kpis') ? (
      <section id="kpis" className="kpi-grid">
        <article className="kpi-card glass-card">
          <p>Budget mensuel</p>
          <h3>{euroFormatter.format(budget)}</h3>
          <span>
            <Wallet size={16} /> {selectedProfileName} : base {euroFormatter.format(selectedProfileBudget)} + rollover{' '}
            {euroFormatter.format(rolloverState.carryOver[selectedProfileId] ?? 0)}
          </span>
        </article>
        <article className="kpi-card glass-card">
          <p>Dépenses</p>
          <h3>{euroFormatter.format(monthlyExpense)}</h3>
          <span>
            <TrendingUp size={16} /> {usageRate.toFixed(0)}% utilisé
          </span>
        </article>
        <article className="kpi-card glass-card">
          <p>Reste disponible</p>
          <h3>{euroFormatter.format(remaining)}</h3>
          <span>
            <PiggyBank size={16} /> À ajuster si nécessaire
          </span>
        </article>
        <article className="kpi-card glass-card">
          <p>Revenus</p>
          <h3>{euroFormatter.format(monthlyIncome)}</h3>
          <span>
            <Sparkles size={16} /> Entrees du mois
          </span>
        </article>
      </section>
      ) : null}

      {orderedVisibleDashboardWidgets.length > 0 && isActiveView('pilotage') ? (
        <section className="glass-card widget-view-nav" aria-label="Navigation des vues widgets">
          <div className="widget-view-nav__top">
            <strong>Navigation vue par vue</strong>
            <span>
              Vue {Math.max(1, activeDashboardWidgetIndex + 1)} / {orderedVisibleDashboardWidgets.length}
            </span>
          </div>
          <div className="widget-view-nav__actions">
            <button type="button" className="ghost-button" onClick={goToPreviousDashboardWidget}>← Vue précédente</button>
            <button type="button" className="ghost-button" onClick={goToNextDashboardWidget}>Vue suivante →</button>
          </div>
          <div className="widget-view-nav__chips">
            {orderedVisibleDashboardWidgets.map((widgetId) => {
              const label = DASHBOARD_WIDGET_LIBRARY.find((entry) => entry.id === widgetId)?.label ?? widgetId
              const active = activeDashboardWidgetId === widgetId
              return (
                <button
                  key={widgetId}
                  type="button"
                  className={`widget-chip${active ? ' widget-chip--active' : ''}`}
                  aria-pressed={active}
                  onClick={() => goToDashboardWidget(widgetId)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {isActiveView('pilotage') || isActiveView('budget') ? (
      <section id="pilotage" className="panel-grid">
        {isActiveView('budget') ? (
        <article id="budget" className={`glass-card chart-card wide-card${budgetSimpleMode ? ' budget-senior-mode' : ''}`} ref={budgetInfoScopeRef}>
          <div className="panel-title">
            <div className="budget-title-row">
              <h2>
                <span className="budget-title-main">Budget: lecture simple</span>
                <span className="info-dot-wrap">
                  <button
                    type="button"
                    className="info-dot"
                    onClick={() => setBudgetInfoDotOpen(budgetInfoDotOpen === 'summary' ? null : 'summary')}
                    aria-label="Information: ce bloc résume votre budget actuel"
                    aria-expanded={budgetInfoDotOpen === 'summary'}
                  >
                    ℹ️
                  </button>
                  {budgetInfoDotOpen === 'summary' ? (
                    <span className="info-mini-pop">
                      Résumé instantané du budget prévu, des dépenses et du reste.
                    </span>
                  ) : null}
                </span>
              </h2>
              <button
                type="button"
                className={`budget-export-toggle budget-export-toggle-inline${budgetExportOpen ? ' open' : ''}`}
                onClick={() => setBudgetExportOpen((open) => !open)}
                aria-expanded={budgetExportOpen}
                aria-controls="budget-export-panel-content"
              >
                <span>Exporter</span>
                {budgetExportOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
            <p>Comprenez votre situation en 10 secondes.</p>
            <div
              id="budget-export-panel-content"
              className={`budget-export-controls budget-export-controls-inline${budgetExportOpen ? ' open' : ''}`}
              aria-hidden={!budgetExportOpen}
            >
              <label className="budget-export-label" htmlFor="budget-export-format">
                Format du fichier
              </label>
              <div className="budget-export-row">
                <select
                  id="budget-export-format"
                  value={budgetExportFormat}
                  onChange={(event) => setBudgetExportFormat(event.target.value as 'txt' | 'csv' | 'json' | 'pdf')}
                  aria-label="Choisir le format de téléchargement"
                >
                  <option value="pdf">PDF</option>
                  <option value="txt">TXT</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
                <button
                  type="button"
                  className="budget-export-link"
                  onClick={() => { void exportBudgetSummary() }}
                  aria-label="Télécharger le résumé du budget"
                >
                  <Download size={14} />
                  Télécharger le résumé
                </button>
              </div>
            </div>
            <div className="budget-quick-actions-row">
              <button
                type="button"
                className={`budget-switch${budgetSimpleMode ? ' on' : ''}`}
                onClick={() => setBudgetSimpleMode((previous) => !previous)}
                aria-pressed={budgetSimpleMode}
                aria-label="Activer ou désactiver le mode simple"
              >
                <span className="budget-switch-label">Mode simple</span>
                <span className="budget-switch-track" aria-hidden="true">
                  <span className="budget-switch-thumb" />
                </span>
              </button>
              <button
                type="button"
                className="budget-mini-btn budget-mini-btn-primary"
                onClick={openQuickBudgetEditor}
              >
                Ajuster mon budget
              </button>
              <button
                type="button"
                className="budget-mini-btn budget-mini-btn-secondary"
                onClick={handleBudgetAiClick}
                aria-expanded={budgetAiHintOpen}
              >
                {isBudgetAiConfigured ? 'IA budget' : 'IA budget (à configurer)'}
              </button>
            </div>
            {budgetAiHintOpen ? (
              <div className={`budget-ai-hint${isBudgetAiConfigured ? '' : ' warning'}`} role="status" aria-live="polite">
                <span className="budget-ai-hint-text">
                  {isBudgetAiConfigured
                    ? 'IA prête: vous pouvez utiliser Claude pour vos projections et conseils automatiques.'
                    : "IA non configurée. Ajoutez d'abord votre clé Anthropic pour activer IA budget."}
                </span>
                <span className="budget-ai-hint-actions">
                  {!isBudgetAiConfigured ? (
                    <button
                      type="button"
                      className="budget-ai-hint-action"
                      onClick={() => openSettingsPanel('ai')}
                    >
                      Configurer l’IA
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="budget-ai-hint-action"
                      onClick={() => setChatOpen(true)}
                    >
                      Ouvrir Claude
                    </button>
                  )}
                  <button
                    type="button"
                    className="budget-ai-hint-action budget-ai-hint-action-ghost"
                    onClick={() => setBudgetAiHintOpen(false)}
                  >
                    Masquer
                  </button>
                </span>
              </div>
            ) : null}
          </div>
          <div className="budget-shell-layout">
          <div className="budget-simple-grid" aria-label="Résumé simple du budget">
            <div className="budget-simple-card">
              <p>
                Budget prévu
                <span className="info-dot-wrap">
                  <button
                    type="button"
                    className="info-dot"
                    onClick={() => setBudgetInfoDotOpen(budgetInfoDotOpen === 'budget' ? null : 'budget')}
                    aria-label="Information: budget du mois"
                    aria-expanded={budgetInfoDotOpen === 'budget'}
                  >
                    ℹ️
                  </button>
                  {budgetInfoDotOpen === 'budget' ? (
                    <span className="info-mini-pop">
                      Montant prévu ce mois, ajusté par le report éventuel.
                    </span>
                  ) : null}
                </span>
              </p>
              <strong>{euroFormatter.format(budget)}</strong>
            </div>
            <div className="budget-simple-card">
              <p>
                Dépensé ce mois-ci
                <span className="info-dot-wrap">
                  <button
                    type="button"
                    className="info-dot"
                    onClick={() => setBudgetInfoDotOpen(budgetInfoDotOpen === 'spent' ? null : 'spent')}
                    aria-label="Information: dépenses du mois"
                    aria-expanded={budgetInfoDotOpen === 'spent'}
                  >
                    ℹ️
                  </button>
                  {budgetInfoDotOpen === 'spent' ? (
                    <span className="info-mini-pop">
                      Total des dépenses enregistrées pour le mois sélectionné.
                    </span>
                  ) : null}
                </span>
              </p>
              <div className="budget-card-value-row">
                <strong>{euroFormatter.format(monthlyExpense)}</strong>
                {depenseChangeLabel ? (
                  <span className={`budget-change-badge${depenseChangePercent === null ? ' neutral' : depenseChangePercent > 0 ? ' negative' : ' positive'}`}>
                    {depenseChangeLabel}
                  </span>
                ) : null}
              </div>
              <small className={`budget-delta-line${depenseDeltaAmount > 0 ? ' negative' : ' positive'}`}>
                {depenseDeltaAmount > 0 ? '+' : ''}{euroFormatter.format(depenseDeltaAmount)} vs mois dernier
              </small>
            </div>
            <div className="budget-simple-card">
              <p>
                Reste disponible
                <span className="info-dot-wrap">
                  <button
                    type="button"
                    className="info-dot"
                    onClick={() => setBudgetInfoDotOpen(budgetInfoDotOpen === 'remaining' ? null : 'remaining')}
                    aria-label="Information: reste du budget"
                    aria-expanded={budgetInfoDotOpen === 'remaining'}
                  >
                    ℹ️
                  </button>
                  {budgetInfoDotOpen === 'remaining' ? (
                    <span className="info-mini-pop">
                      Différence entre budget et dépenses. Peut être négative.
                    </span>
                  ) : null}
                </span>
              </p>
              <div className="budget-card-value-row">
                <strong>{euroFormatter.format(remaining)}</strong>
                {netChangeLabel ? (
                  <span className={`budget-change-badge${netChangePercent === null ? ' neutral' : netChangePercent < 0 ? ' negative' : ' positive'}`}>
                    {netChangeLabel}
                  </span>
                ) : null}
              </div>
              <small className={`budget-delta-line${netDeltaAmount < 0 ? ' negative' : ' positive'}`}>
                {netDeltaAmount > 0 ? '+' : ''}{euroFormatter.format(netDeltaAmount)} de variation nette
              </small>
            </div>
          </div>
          <div className="budget-status-bar" style={{ borderColor: budgetStatusColor }}>
            <span className="budget-status-dot" style={{ background: budgetStatusColor }} />
            <span className="budget-status-text">État : <strong>{budgetStatusLabel}</strong></span>
          </div>
          <div className="budget-simple-progress" role="status" aria-live="polite">
            <p>{usageRate.toFixed(0)}% du budget utilisé</p>
            <div className="budget-simple-progress__track" aria-hidden="true">
              <div
                className="budget-simple-progress__fill"
                style={{
                  width: `${Math.min(100, usageRate)}%`,
                  background: budgetStatusColor,
                }}
              />
            </div>
            <small>{budgetSimpleMessage}</small>
          </div>
          <div className="budget-health-block">
            <div className="budget-health-top">
              <strong>Santé budget: {budgetHealthLabel}</strong>
              <span style={{ color: budgetHealthColor }}>{budgetMasteryScore}/100</span>
            </div>
            <div className="budget-health-track" aria-hidden="true">
              <div className="budget-health-fill" style={{ width: `${budgetMasteryScore}%`, background: budgetHealthColor }} />
            </div>
            <small className="budget-projection-note">{projectedMessage}</small>
          </div>
          <div className="budget-insights">
            <h3>À retenir</h3>
            <ul>
              {budgetInsights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </div>
          {budgetQuickEditOpen ? (
            <div className="budget-actions-modal-overlay" onClick={() => setBudgetQuickEditOpen(false)}>
              <div className="budget-actions-modal budget-quick-edit-modal" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="budget-actions-modal-close"
                  onClick={() => setBudgetQuickEditOpen(false)}
                  aria-label="Fermer"
                >
                  ✕
                </button>
                <h3>Ajuster mon budget</h3>
                <p className="budget-quick-edit-help">
                  Changez votre budget mensuel ici, sans passer par les paramètres.
                </p>
                <label className="budget-quick-edit-label">
                  Nouveau budget mensuel (€)
                  <input
                    type="number"
                    min={200}
                    step={50}
                    value={budgetQuickEditValue}
                    onChange={(event) => setBudgetQuickEditValue(event.target.value.replace(/\D/g, ''))}
                  />
                </label>
                <small className="budget-quick-edit-note">Minimum conseillé: 200 €.</small>
                <div className="budget-quick-edit-actions">
                  <button
                    type="button"
                    className="budget-mini-btn budget-mini-btn-secondary"
                    onClick={() => setBudgetQuickEditOpen(false)}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="budget-mini-btn budget-mini-btn-primary budget-quick-edit-save"
                    onClick={applyQuickBudgetUpdate}
                    disabled={!budgetQuickEditValue || Number(budgetQuickEditValue) < 200}
                  >
                    Enregistrer le budget
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {!budgetSimpleMode ? (
          <>
          <div className="panel-title budget-trend-title">
            <h2>
              Vue du budget
              <span className="info-dot-wrap">
                <button
                  type="button"
                  className="info-dot"
                  onClick={() => setBudgetInfoDotOpen(budgetInfoDotOpen === 'trend' ? null : 'trend')}
                  aria-label="Information: graphique annuel"
                  aria-expanded={budgetInfoDotOpen === 'trend'}
                >
                  ℹ️
                </button>
                {budgetInfoDotOpen === 'trend' ? (
                  <span className="info-mini-pop">
                    Compare revenus et dépenses mois par mois pour visualiser la tendance.
                  </span>
                ) : null}
              </span>
            </h2>
            <p>Choisissez le type, le filtre et la période pour adapter la lecture.</p>
          </div>
          <div className="budget-chart-toolbar" aria-label="Options du graphique budget">
            <label>
              <span className="toolbar-label-row">
                Type de graphique
                <button
                  type="button"
                  className="toolbar-info-btn"
                  onClick={() => setBudgetInfoOpen(budgetInfoOpen === 'type' ? null : 'type')}
                  aria-label="Information sur les types de graphique"
                  aria-expanded={budgetInfoOpen === 'type'}
                >
                  ℹ️
                </button>
                {budgetInfoOpen === 'type' ? (
                  <span className="toolbar-info-pop">
                    Barres : comparaison. Lignes : tendance. Aires : volume visuel.
                  </span>
                ) : null}
              </span>
              <select
                value={budgetChartType}
                onChange={(event) => setBudgetChartType(event.target.value as 'bar' | 'line' | 'area')}
              >
                <option value="bar">Barres</option>
                <option value="line">Lignes</option>
                <option value="area">Aires</option>
              </select>
            </label>
            <label>
              <span className="toolbar-label-row">
                Afficher
                <button
                  type="button"
                  className="toolbar-info-btn"
                  onClick={() => setBudgetInfoOpen(budgetInfoOpen === 'filter' ? null : 'filter')}
                  aria-label="Information sur les affichages"
                  aria-expanded={budgetInfoOpen === 'filter'}
                >
                  ℹ️
                </button>
                {budgetInfoOpen === 'filter' ? (
                  <span className="toolbar-info-pop">
                    Revenus: rentrées. Dépenses: sorties. Solde net: revenus moins dépenses.
                  </span>
                ) : null}
              </span>
              <select
                value={budgetChartFilter}
                onChange={(event) => setBudgetChartFilter(event.target.value as 'all' | 'revenus' | 'depenses' | 'net')}
              >
                <option value="all">Revenus + dépenses</option>
                <option value="revenus">Revenus</option>
                <option value="depenses">Dépenses</option>
                <option value="net">Solde net</option>
              </select>
            </label>
            <label>
              <span className="toolbar-label-row">
                Période
                <button
                  type="button"
                  className="toolbar-info-btn"
                  onClick={() => setBudgetInfoOpen(budgetInfoOpen === 'period' ? null : 'period')}
                  aria-label="Information sur la période"
                  aria-expanded={budgetInfoOpen === 'period'}
                >
                  ℹ️
                </button>
                {budgetInfoOpen === 'period' ? (
                  <span className="toolbar-info-pop">
                    6 mois pour une vue rapprochée, 12 mois pour la tendance annuelle.
                  </span>
                ) : null}
              </span>
              <select
                value={budgetChartWindow}
                onChange={(event) => setBudgetChartWindow(Number(event.target.value) as 6 | 12)}
              >
                <option value={6}>6 mois</option>
                <option value={12}>12 mois</option>
              </select>
            </label>
            <label>
              <span className="toolbar-label-row">
                Comparer avec avant
                <button
                  type="button"
                  className="toolbar-info-btn"
                  onClick={() => setBudgetInfoOpen(budgetInfoOpen === 'compare' ? null : 'compare')}
                  aria-label="Information sur la comparaison"
                  aria-expanded={budgetInfoOpen === 'compare'}
                >
                  ℹ️
                </button>
                {budgetInfoOpen === 'compare' ? (
                  <span className="toolbar-info-pop">
                    Superpose le mois précédent pour comparer rapidement l'évolution.
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                className={`toolbar-toggle-btn${budgetCompareMonths ? ' active' : ''}`}
                onClick={() => setBudgetCompareMonths(!budgetCompareMonths)}
                aria-pressed={budgetCompareMonths}
              >
                {budgetCompareMonths ? 'Oui' : 'Non'}
              </button>
            </label>
          </div>
          <div className="budget-series-legend" aria-hidden="true">
            <span><i style={{ background: budgetSeriesColors.revenus }} /> Revenus</span>
            <span><i style={{ background: budgetSeriesColors.depenses }} /> Dépenses</span>
            <span><i style={{ background: budgetSeriesColors.net }} /> Solde net</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              {budgetChartType === 'bar' ? (
                <BarChart data={budgetTrendDataWithComparison}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#3f3f46" opacity={0.35} />
                  <XAxis dataKey="month" stroke="#a1a1aa" />
                  <YAxis stroke="#a1a1aa" />
                  <Tooltip formatter={(value) => formatTooltipValue(value)} />
                  {(budgetChartFilter === 'all' || budgetChartFilter === 'revenus') ? (
                    <>
                      <Bar dataKey="revenus" fill={budgetSeriesColors.revenus} radius={[8, 8, 0, 0]} />
                      {budgetCompareMonths ? <Bar dataKey="revenus_prev" fill={budgetSeriesColors.revenus} fillOpacity={0.4} radius={[8, 8, 0, 0]} /> : null}
                    </>
                  ) : null}
                  {(budgetChartFilter === 'all' || budgetChartFilter === 'depenses') ? (
                    <>
                      <Bar dataKey="depenses" fill={budgetSeriesColors.depenses} radius={[8, 8, 0, 0]} />
                      {budgetCompareMonths ? <Bar dataKey="depenses_prev" fill={budgetSeriesColors.depenses} fillOpacity={0.4} radius={[8, 8, 0, 0]} /> : null}
                    </>
                  ) : null}
                  {budgetChartFilter === 'net' ? (
                    <>
                      <Bar dataKey="net" fill={budgetSeriesColors.net} radius={[8, 8, 0, 0]} />
                      {budgetCompareMonths ? <Bar dataKey="net_prev" fill={budgetSeriesColors.net} fillOpacity={0.4} radius={[8, 8, 0, 0]} /> : null}
                    </>
                  ) : null}
                </BarChart>
              ) : null}

              {budgetChartType === 'line' ? (
                <LineChart data={budgetTrendDataWithComparison}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#3f3f46" opacity={0.35} />
                  <XAxis dataKey="month" stroke="#a1a1aa" />
                  <YAxis stroke="#a1a1aa" />
                  <Tooltip formatter={(value) => formatTooltipValue(value)} />
                  {(budgetChartFilter === 'all' || budgetChartFilter === 'revenus') ? (
                    <>
                      <Line type="monotone" dataKey="revenus" stroke={budgetSeriesColors.revenus} strokeWidth={2.4} dot={false} />
                      {budgetCompareMonths ? <Line type="monotone" dataKey="revenus_prev" stroke={budgetSeriesColors.revenus} strokeWidth={2.4} strokeDasharray="5 5" dot={false} opacity={0.5} /> : null}
                    </>
                  ) : null}
                  {(budgetChartFilter === 'all' || budgetChartFilter === 'depenses') ? (
                    <>
                      <Line type="monotone" dataKey="depenses" stroke={budgetSeriesColors.depenses} strokeWidth={2.4} dot={false} />
                      {budgetCompareMonths ? <Line type="monotone" dataKey="depenses_prev" stroke={budgetSeriesColors.depenses} strokeWidth={2.4} strokeDasharray="5 5" dot={false} opacity={0.5} /> : null}
                    </>
                  ) : null}
                  {budgetChartFilter === 'net' ? (
                    <>
                      <Line type="monotone" dataKey="net" stroke={budgetSeriesColors.net} strokeWidth={2.4} dot={false} />
                      {budgetCompareMonths ? <Line type="monotone" dataKey="net_prev" stroke={budgetSeriesColors.net} strokeWidth={2.4} strokeDasharray="5 5" dot={false} opacity={0.5} /> : null}
                    </>
                  ) : null}
                </LineChart>
              ) : null}

              {budgetChartType === 'area' ? (
                <AreaChart data={budgetTrendDataWithComparison}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#3f3f46" opacity={0.35} />
                  <XAxis dataKey="month" stroke="#a1a1aa" />
                  <YAxis stroke="#a1a1aa" />
                  <Tooltip formatter={(value) => formatTooltipValue(value)} />
                  {(budgetChartFilter === 'all' || budgetChartFilter === 'revenus') ? (
                    <>
                      <Area type="monotone" dataKey="revenus" stroke={budgetSeriesColors.revenus} fill={budgetSeriesColors.revenus} fillOpacity={0.22} />
                      {budgetCompareMonths ? <Area type="monotone" dataKey="revenus_prev" stroke={budgetSeriesColors.revenus} fill={budgetSeriesColors.revenus} fillOpacity={0.08} strokeDasharray="5 5" /> : null}
                    </>
                  ) : null}
                  {(budgetChartFilter === 'all' || budgetChartFilter === 'depenses') ? (
                    <>
                      <Area type="monotone" dataKey="depenses" stroke={budgetSeriesColors.depenses} fill={budgetSeriesColors.depenses} fillOpacity={0.2} />
                      {budgetCompareMonths ? <Area type="monotone" dataKey="depenses_prev" stroke={budgetSeriesColors.depenses} fill={budgetSeriesColors.depenses} fillOpacity={0.08} strokeDasharray="5 5" /> : null}
                    </>
                  ) : null}
                  {budgetChartFilter === 'net' ? (
                    <>
                      <Area type="monotone" dataKey="net" stroke={budgetSeriesColors.net} fill={budgetSeriesColors.net} fillOpacity={0.22} />
                      {budgetCompareMonths ? <Area type="monotone" dataKey="net_prev" stroke={budgetSeriesColors.net} fill={budgetSeriesColors.net} fillOpacity={0.08} strokeDasharray="5 5" /> : null}
                    </>
                  ) : null}
                </AreaChart>
              ) : null}
            </ResponsiveContainer>
          </div>
          </>
          ) : null}
          </div>
        </article>
        ) : null}

        {isPilotageWidgetVisible('coaching') && isActiveView('pilotage') ? (
        <article className="glass-card chart-card">
          <div className="panel-title">
            <h2>Coaching financier</h2>
            <p>Conseils automatiques pour arbitrer plus vite</p>
          </div>
          <ul className="alert-list coaching-list">
            {coachingTips.map((tip) => (
              <li key={tip}>
                <Brain size={15} />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <div className="pro-mini-stats">
            <div>
              <Layers3 size={16} />
              <span>{selectedEnvelope === 'Tous' ? 'Vue globale' : `Focus ${selectedEnvelope}`}</span>
            </div>
            <div>
              <Landmark size={16} />
              <span>Solde projete: {euroFormatter.format(monthlyNet)}</span>
            </div>
          </div>
          {anthropicKey ? (
            <div className="predict-zone">
              <button
                type="button"
                className="predict-button"
                onClick={() => void handlePredictMonth()}
                disabled={predictionLoading}
              >
                {predictionLoading ? (
                  <span className="inline-loading-label"><span className="inline-loader" aria-hidden="true" />Analyse en cours...</span>
                ) : (
                  <><Zap size={14} />Prévoir la fin de mois</>
                )}
              </button>
              {predictionResult ? (
                <div className="predict-result">
                  <p>{predictionResult}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
        ) : null}

        {isPilotageWidgetVisible('csvImport') && isActiveView('pilotage') ? (
        <article className="glass-card form-panel wide-card">
          <div className="panel-title">
            <h2>Import CSV bancaire</h2>
            <p>Import premium avec catégorisation automatique et prévisualisation</p>
          </div>

          <div className="csv-upload-box">
            <label className="csv-input-label">
              <Upload size={16} />
              <span>Choisir un fichier CSV</span>
              <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} />
            </label>

            <label>
              Profil banque
              <input
                value={csvBankKey}
                onChange={(event) => {
                  const nextBankKey = normalizeText(event.target.value)
                  setCsvBankKey(nextBankKey)
                  if (nextBankKey && storedCsvMappings[nextBankKey]) {
                    const nextMapping = storedCsvMappings[nextBankKey]
                    setCsvMapping(nextMapping)
                    refreshCsvPreview(nextMapping)
                  }
                }}
                placeholder="Ex: bnp-compte-courant"
              />
            </label>
            <label>
              Profil cible
              <select
                value={csvImportMember}
                onChange={(event) => {
                  const nextProfileId = event.target.value
                  setCsvImportMember(nextProfileId)
                  if (csvRawData.headers.length > 0) {
                    refreshCsvPreview(csvMapping, nextProfileId)
                  }
                }}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {csvRawData.headers.length > 0 ? (
            <div className="csv-mapping-grid">
              <label>
                Colonne date
                <select
                  value={csvMapping.date}
                  onChange={(event) => {
                    const nextMapping = { ...csvMapping, date: event.target.value }
                    setCsvMapping(nextMapping)
                    persistCsvMapping(csvBankKey, nextMapping)
                    refreshCsvPreview(nextMapping)
                  }}
                >
                  <option value="">Choisir</option>
                  {csvRawData.headers.map((header) => (
                    <option key={`date-${header}`} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Colonne libelle
                <select
                  value={csvMapping.label}
                  onChange={(event) => {
                    const nextMapping = { ...csvMapping, label: event.target.value }
                    setCsvMapping(nextMapping)
                    persistCsvMapping(csvBankKey, nextMapping)
                    refreshCsvPreview(nextMapping)
                  }}
                >
                  <option value="">Choisir</option>
                  {csvRawData.headers.map((header) => (
                    <option key={`label-${header}`} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Colonne montant
                <select
                  value={csvMapping.amount}
                  onChange={(event) => {
                    const nextMapping = { ...csvMapping, amount: event.target.value }
                    setCsvMapping(nextMapping)
                    persistCsvMapping(csvBankKey, nextMapping)
                    refreshCsvPreview(nextMapping)
                  }}
                >
                  <option value="">Choisir</option>
                  {csvRawData.headers.map((header) => (
                    <option key={`amount-${header}`} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Colonne type (optionnel)
                <select
                  value={csvMapping.type}
                  onChange={(event) => {
                    const nextMapping = { ...csvMapping, type: event.target.value }
                    setCsvMapping(nextMapping)
                    persistCsvMapping(csvBankKey, nextMapping)
                    refreshCsvPreview(nextMapping)
                  }}
                >
                  <option value="">Aucune</option>
                  {csvRawData.headers.map((header) => (
                    <option key={`type-${header}`} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <p className="auth-note">
            Colonnes attendues: date, libelle, montant, type optionnel. Dates acceptees:
            AAAA-MM-JJ ou JJ/MM/AAAA.
          </p>
          {csvStatus ? <p className="auth-success">{csvStatus}</p> : null}
          {csvPreview.length > 0 ? (
            <p className="auth-note">
              Doublons detectes et exclus de l'import: {duplicateCount}
            </p>
          ) : null}

          {csvPreview.length > 0 ? (
            <>
              <div className="csv-preview-header">
                <div>
                  <h3>
                    <FileSpreadsheet size={16} /> Previsualisation avant import
                  </h3>
                  <p className="auth-note">Verification rapide avant fusion dans le dashboard</p>
                </div>
                <button type="button" onClick={importCsvPreview}>
                  Importer {csvPreview.length} ligne(s)
                </button>
              </div>
              <div className="csv-preview-list">
                {csvPreview.slice(0, 8).map((row) => (
                  <div
                    key={row.id}
                    className={`csv-preview-row${row.duplicate ? ' is-duplicate' : ''}`}
                  >
                    <div>
                      <strong>{row.label}</strong>
                      <small>
                        {row.date} • {row.category} • {row.kind}
                      </small>
                      {row.duplicateReason ? <small>{row.duplicateReason}</small> : null}
                    </div>
                    <div className="csv-preview-amount">
                      <span>{euroFormatter.format(row.amount)}</span>
                      {row.duplicate ? <small>Doublon</small> : <small>Nouveau</small>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </article>
        ) : null}

        {isPilotageWidgetVisible('alerts') && isActiveView('pilotage') ? (
        <article className="glass-card chart-card">
          <div className="panel-title">
            <h2>Alertes intelligentes</h2>
            <p>Signaux budget et dépenses inhabituelles du mois</p>
          </div>
          {alertMessages.length === 0 ? (
                <p className="auth-note">
                  Aucune alerte pour le moment. Continuez comme ça !
                </p>
          ) : (
            <ul className="alert-list">
              {alertMessages.map((alert) => (
                <li key={alert.message} className={`alert--${alert.level}`}>
                  <BellRing size={15} />
                  <span>{alert.message}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
        ) : null}

        {isPilotageWidgetVisible('savingsGoals') && isActiveView('pilotage') ? (
        <article className="glass-card chart-card">
          <div className="panel-title">
            <h2>Objectifs d'épargne</h2>
            <p>Suivi cible vs dépenses pour {selectedProfileName.toLowerCase()}</p>
          </div>
          <ul className="goal-list">
            {goalProgress.map((goal) => (
              <li key={goal.category}>
                <div>
                  <strong>{goal.category}</strong>
                  <small>
                    {euroFormatter.format(goal.spent)} / {euroFormatter.format(goal.target)}
                  </small>
                </div>
                <div className="goal-progress-track">
                  <span style={{ width: `${goal.rate}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <form className="goal-editor" onSubmit={updateGoalTarget}>
            <select
              value={goalEditor.category}
              onChange={(event) =>
                setGoalEditor((previous) => ({
                  ...previous,
                  category: event.target.value as Category,
                }))
              }
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={goalEditor.amount}
              onChange={(event) =>
                setGoalEditor((previous) => ({
                  ...previous,
                  amount: event.target.value,
                }))
              }
              placeholder="Nouvel objectif"
            />
            <button type="submit">Mettre a jour</button>
          </form>
        </article>
        ) : null}

        {isPilotageWidgetVisible('recurringCharges') && isActiveView('pilotage') ? (
        <article className="glass-card chart-card">
          <div className="panel-title">
            <h2>Charges récurrentes</h2>
            <p>Transactions détectées sur 2+ mois pour {selectedProfileName.toLowerCase()}</p>
          </div>
          {recurringItems.length === 0 ? (
            <p className="auth-note">Pas assez de données pour détecter des récurrences sur ce profil.</p>
          ) : (
            <ul className="recurring-list">
              {recurringItems.map((item) => (
                <li key={item.label}>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.monthCount} mois · moy. {euroFormatter.format(item.avgAmount)}</small>
                  </div>
                  <Repeat2 size={14} className="recurring-icon" />
                </li>
              ))}
            </ul>
          )}
        </article>
        ) : null}

        {isPilotageWidgetVisible('savingsProjects') && isActiveView('pilotage') ? (
        <article className="glass-card chart-card">
          <div className="panel-title">
            <h2>Objectifs d'épargne projet</h2>
            <p>Projets financiers et leur progression estimée</p>
          </div>
          {savingsTargets.length > 0 ? (
            <ul className="savings-target-list">
              {savingsTargets.map((target) => {
                const progress = Math.min(100, (allTimePositiveSurplus / target.targetAmount) * 100)
                return (
                  <li key={target.id}>
                    <div className="savings-target-header">
                      <strong>{target.label}</strong>
                      <span>{euroFormatter.format(allTimePositiveSurplus)} / {euroFormatter.format(target.targetAmount)}</span>
                      <button
                        type="button"
                        className="tx-btn tx-delete"
                        onClick={() => {
                          setSavingsTargets((prev) => {
                            const next = prev.filter((t) => t.id !== target.id)
                            window.localStorage.setItem(SAVINGS_TARGETS_STORAGE_KEY, JSON.stringify(next))
                            return next
                          })
                        }}
                        title="Supprimer cet objectif"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="goal-progress-track">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <small>{progress.toFixed(0)}% atteint · basé sur les surplus mensuels cumulés</small>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="auth-note">Aucun objectif défini. Ajoutez-en un ci-dessous.</p>
          )}
          <form
            className="goal-editor savings-target-form"
            onSubmit={(event) => {
              event.preventDefault()
              const amount = Number(savingsTargetDraft.amount)
              if (!savingsTargetDraft.label.trim() || Number.isNaN(amount) || amount <= 0) return
              const newTarget: SavingsTarget = {
                id: `target-${Date.now()}`,
                label: savingsTargetDraft.label.trim(),
                targetAmount: amount,
              }
              setSavingsTargets((prev) => {
                const next = [...prev, newTarget]
                window.localStorage.setItem(SAVINGS_TARGETS_STORAGE_KEY, JSON.stringify(next))
                return next
              })
              setSavingsTargetDraft({ label: '', amount: '' })
            }}
          >
            <input
              value={savingsTargetDraft.label}
              onChange={(event) => setSavingsTargetDraft((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="Ex: Vacances, Voiture..."
            />
            <input
              type="number"
              min="1"
              value={savingsTargetDraft.amount}
              onChange={(event) => setSavingsTargetDraft((prev) => ({ ...prev, amount: event.target.value }))}
              placeholder="Montant cible (€)"
            />
            <button type="submit"><Target size={14} /> Ajouter</button>
          </form>
        </article>
        ) : null}

        {isPilotageWidgetVisible('expenseCalendar') && isActiveView('pilotage') ? (
        <article className="glass-card chart-card wide-card">
          <div className="panel-title">
            <h2>Calendrier des dépenses</h2>
            <p>Lecture rapide des jours les plus chargés</p>
          </div>
          <div className="calendar-grid">
            {calendarData.map((entry) => (
              <div
                key={entry.day}
                className="calendar-cell"
                style={{
                  background: `rgba(249, 115, 22, ${0.1 + entry.intensity * 0.7})`,
                }}
                title={`Jour ${entry.day}: ${euroFormatter.format(entry.total)}`}
              >
                <strong>{entry.day}</strong>
                <small>{entry.total > 0 ? euroFormatter.format(entry.total) : '-'}</small>
              </div>
            ))}
          </div>
        </article>
        ) : null}

        {dashboardWidgetState.visibleWidgets.length === 0 && isActiveView('pilotage') ? (
          <article className="glass-card chart-card wide-card">
            <div className="panel-title">
              <h2>Aucun widget actif</h2>
              <p>Activez au moins un widget ou appliquez un modèle.</p>
            </div>
            <div className="settings-inline-actions">
              <button type="button" onClick={() => applyDashboardWidgetTemplate('equilibre')}>
                Appliquer le modèle Équilibré
              </button>
            </div>
          </article>
        ) : null}
      </section>
      ) : null}

      {isActiveView('visuals') ? (
      <section id="visuals" className="panel-grid">
        <article className="glass-card chart-card">
          <div className="panel-title">
            <h2>Répartition des dépenses</h2>
            <p>Par catégorie pour {selectedProfileName.toLowerCase()}</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={categoryColors[entry.name as Category]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatTooltipValue(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="glass-card chart-card">
          <div className="panel-title">
            <h2>Progression du mois</h2>
            <p>Évolution cumulée des dépenses</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#3f3f46" opacity={0.35} />
                <XAxis dataKey="day" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" />
                <Tooltip formatter={(value) => formatTooltipValue(value)} />
                <Area
                  type="monotone"
                  dataKey="cumul"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  fill="url(#expenseGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="glass-card chart-card wide-card">
          <div className="panel-title">
            <h2>Équilibre du budget</h2>
            <p>Dépenses du mois vs reste disponible</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={budgetBalanceData} barCategoryGap={22}>
                <CartesianGrid strokeDasharray="4 4" stroke="#3f3f46" opacity={0.35} />
                <XAxis dataKey="metric" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" />
                <Tooltip formatter={(value) => formatTooltipValue(value)} />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {budgetBalanceData.map((entry) => (
                    <Cell
                      key={entry.metric}
                      fill={entry.metric === 'Dépenses' ? '#f43f5e' : '#22c55e'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
      ) : null}

      {isActiveView('operations') ? (
      <section id="operations" className="panel-grid">
        <article className="glass-card chart-card">
          <div className="panel-title">
            <h2>Dépenses par catégorie</h2>
            <p>Vue simplifiée pour ce mois</p>
          </div>
          <ul className="operations-category-list">
            {pieData.map((entry) => (
              <li key={entry.name} className="operations-category-item">
                <span className="operations-category-name">{entry.name}</span>
                <span className="operations-category-amount">{euroFormatter.format(entry.value)}</span>
              </li>
            ))}
          </ul>
          <div className="operations-category-total">
            <strong>Total dépensé:</strong>
            <strong>{euroFormatter.format(monthlyExpense)}</strong>
          </div>
        </article>

        <article className="glass-card chart-card wide-card">
          <div className="panel-title">
            <h2>Comparaison N vs N-1</h2>
            <p>{formatMonth(selectedMonth)} par rapport au même mois l'an dernier</p>
          </div>
          {yoyComparisonData.length === 0 ? (
            <p className="auth-note">Aucune donnée disponible pour la comparaison annuelle.</p>
          ) : (
            <ul className="yoy-list">
              {yoyComparisonData.map((item) => {
                const maxVal = Math.max(item.current, item.previous, 1)
                const hasImproved = item.delta <= 0
                const pctChange = item.previous > 0
                  ? Math.abs((item.delta / item.previous) * 100).toFixed(0)
                  : null
                return (
                  <li key={item.category}>
                    <div className="yoy-row">
                      <strong>{item.category}</strong>
                      <span className={hasImproved ? 'income' : 'expense'}>
                        {hasImproved ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                        {pctChange ? `${pctChange}%` : 'nouveau'}
                      </span>
                    </div>
                    <div className="yoy-bars">
                      <div
                        className="yoy-bar yoy-bar--prev"
                        style={{ width: `${(item.previous / maxVal) * 100}%` }}
                        title={`N-1 : ${euroFormatter.format(item.previous)}`}
                      />
                      <div
                        className="yoy-bar yoy-bar--curr"
                        style={{ width: `${(item.current / maxVal) * 100}%` }}
                        title={`N : ${euroFormatter.format(item.current)}`}
                      />
                    </div>
                    <small>{euroFormatter.format(item.previous)} → {euroFormatter.format(item.current)}</small>
                  </li>
                )
              })}
            </ul>
          )}
        </article>

        <article className="glass-card transaction-panel wide-card">
          <div className="panel-title">
            <h2>Transactions du mois</h2>
            <p>{txFiltered.length} opération{txFiltered.length !== 1 ? 's' : ''} · {formatMonth(selectedMonth)} · {selectedProfileName.toLowerCase()}</p>
          </div>
          <div className="tx-summary-bar">
            <div className="tx-summary-card">
              <strong>{txFilteredCount}</strong>
              <span>résultat{txFilteredCount > 1 ? 's' : ''}</span>
            </div>
            <div className="tx-summary-card">
              <strong className={txFilteredNet < 0 ? 'expense' : 'income'}>{txFilteredNet < 0 ? '-' : '+'}{euroFormatter.format(Math.abs(txFilteredNet))}</strong>
              <span>solde des lignes filtrées</span>
            </div>
            <div className="tx-summary-context">
              <span>{txFilterContext}</span>
              {txShowAll ? <small>Vue complète active</small> : <small>Vue condensée 8 lignes</small>}
            </div>
          </div>
          <div className="tx-toolbar">
            <input
              className="tx-search"
              placeholder="Rechercher un libellé ou une catégorie..."
              value={txSearch}
              onChange={(event) => setTxSearch(event.target.value)}
            />
            <select
              value={txFilterKind}
              onChange={(event) => setTxFilterKind(event.target.value as 'tous' | TransactionKind)}
            >
              <option value="tous">Tous types</option>
              <option value="depense">Dépenses</option>
              <option value="revenu">Revenus</option>
            </select>
            <select
              value={txSortField}
              onChange={(event) => setTxSortField(event.target.value as 'date' | 'amount')}
            >
              <option value="date">Tri : date</option>
              <option value="amount">Tri : montant</option>
            </select>
          </div>
          {txFiltered.length === 0 ? (
            <p className="auth-note">Aucune transaction pour ces critères.</p>
          ) : (
            <ul className="transaction-list">
              {txDisplayed.map((item) => (
                <li
                  key={item.id}
                  className={
                    editingTxId === item.id
                      ? 'tx-editing'
                      : deletingTxId === item.id
                      ? 'tx-confirming'
                      : ''
                  }
                >
                  <div>
                    <p>{item.label}</p>
                    <small>
                      {item.date} · {item.category} · {item.envelope}
                    </small>
                  </div>
                  {deletingTxId === item.id ? (
                    <div className="tx-confirm-row">
                      <span>Supprimer ?</span>
                      <button
                        type="button"
                        className="tx-confirm-yes"
                        onClick={() => {
                          deleteTransaction(item.id)
                          setDeletingTxId(null)
                        }}
                      >
                        Oui
                      </button>
                      <button
                        type="button"
                        className="tx-confirm-no"
                        onClick={() => setDeletingTxId(null)}
                      >
                        Non
                      </button>
                    </div>
                  ) : (
                    <div className="tx-actions">
                      <strong className={item.kind === 'depense' ? 'expense' : 'income'}>
                        {item.kind === 'depense' ? '-' : '+'}
                        {euroFormatter.format(item.amount)}
                      </strong>
                      <button
                        type="button"
                        className="tx-btn tx-edit"
                        onClick={() => startEditTransaction(item)}
                        title="Modifier"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="tx-btn tx-delete"
                        onClick={() => setDeletingTxId(item.id)}
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {txFiltered.length > 8 && (
            <button
              type="button"
              className="tx-show-more"
              onClick={() => setTxShowAll((previous) => !previous)}
            >
              {txShowAll
                ? 'Réduire la liste'
                : `Voir toutes les ${txFiltered.length} opérations`}
            </button>
          )}
        </article>

        <article className="glass-card form-panel">
          <div className="panel-title">
            <h2>{editingTxId !== null ? "Modifier l'opération" : 'Ajouter une opération'}</h2>
            <p>{editingTxId !== null ? 'Modifiez les champs puis validez' : 'Suivi en direct du budget personnel'}</p>
          </div>
          <form onSubmit={addTransaction}>
            <label>
              Libellé
              <input
                required
                value={form.label}
                onChange={(event) => {
                  const nextLabel = event.target.value
                  const suggestion = suggestCategoryFromLabel(nextLabel)

                  setForm((previous) => ({
                    ...previous,
                    label: nextLabel,
                    category: suggestion ?? previous.category,
                    envelope: suggestion ? inferEnvelope(suggestion) : previous.envelope,
                  }))
                  setSmartCategory(suggestion)
                }}
                placeholder="Ex: Fournitures scolaires"
              />
              {smartCategory ? (
                <small className="smart-hint">Catégorie suggérée automatiquement : {smartCategory}</small>
              ) : null}
            </label>
            <label>
              Montant
              <input
                required
                type="number"
                min="1"
                value={form.amount}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, amount: event.target.value }))
                }
                placeholder="0"
              />
            </label>
            {form.amount && form.kind === 'depense' && Number(form.amount) > 0 ? (
              <p className={`impact-hint ${remaining - Number(form.amount) < 0 ? 'impact-negative' : 'impact-positive'}`}>
                Après ajout : il restera{' '}
                <strong>{euroFormatter.format(Math.max(0, remaining - Number(form.amount)))}</strong>
                {remaining - Number(form.amount) < 0 ? ' — budget dépassé !' : ''}
              </p>
            ) : null}
            <label>
              Date
              <input
                required
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, date: event.target.value }))
                }
              />
            </label>
            <label>
              Catégorie
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    category: event.target.value as Category,
                    envelope: inferEnvelope(event.target.value as Category),
                  }))
                }
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Profil
              <select
                value={form.member}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    member: event.target.value,
                  }))
                }
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Enveloppe
              <select
                value={form.envelope}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    envelope: event.target.value as Envelope,
                  }))
                }
              >
                {envelopes.map((envelope) => (
                  <option key={envelope} value={envelope}>
                    {envelope}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select
                value={form.kind}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    kind: event.target.value as TransactionKind,
                  }))
                }
              >
                <option value="depense">Dépense</option>
                <option value="revenu">Revenu</option>
              </select>
            </label>

            <div className="form-actions">
              <button type="submit">
                {editingTxId !== null ? <><Pencil size={16} /> Mettre à jour</> : <><Plus size={16} /> Ajouter</>}
              </button>
              {editingTxId !== null && (
                <button type="button" className="btn-cancel" onClick={cancelEditTransaction}>
                  <X size={16} /> Annuler
                </button>
              )}
            </div>
          </form>
        </article>
      </section>
      ) : null}
      </div>

      {isActiveView('overview') ? (
      <aside className="glass-card budget-advice-rail dashboard-right-rail overview-coaching-rail" aria-label="Conseils coaching">
        <div className="budget-assistant-title-row">
          <div className="budget-assistant-title-main">
            <p className="eyebrow">Conseils</p>
            <span className="budget-assistant-ai-tag">
              <Brain size={12} /> Coaching financier
            </span>
          </div>
        </div>
        <p className="budget-advice-helper">
          Conseils rapides pour garder le cap ce mois-ci.
        </p>
        <ul className="alert-list coaching-list overview-coaching-list">
          {(coachingTips.length > 0 ? coachingTips.slice(0, 4) : ['Ajoutez vos premières transactions pour obtenir des conseils personnalisés.']).map((tip) => (
            <li key={tip}>
              <Brain size={15} />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </aside>
      ) : null}

      {isActiveView('budget') ? (
      <aside className={`glass-card budget-advice-rail dashboard-right-rail${budgetAssistantVisible ? '' : ' collapsed'}`} aria-label="Conseils budget">
        <div className="budget-assistant-title-row">
          <div className="budget-assistant-title-main">
            <p className="eyebrow">Assistant conseil</p>
            {isBudgetAiConfigured ? (
              <span className="budget-assistant-ai-tag">
                <Bot size={12} /> Connecté IA
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="budget-assistant-hide"
            onClick={() => setBudgetAssistantVisible((previous) => !previous)}
          >
            {budgetAssistantVisible ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        {budgetAssistantVisible ? (
        <>
        <p className="budget-advice-helper">
          {isBudgetAiConfigured
            ? 'IA connectée: conseil dynamique selon votre situation.'
            : 'Mode local: conseils automatiques selon les données du mois.'}
        </p>
        <div className="budget-assistant-panel" aria-live="polite">
          <div className="budget-assistant-header">
            <strong>{isBudgetAiConfigured ? '🤖 Assistant IA actif' : '🧭 Assistant local actif'}</strong>
          </div>

          {isBudgetAiConfigured ? (
            <div className="budget-assistant-answer-wrap budget-assistant-answer-wrap--ia">
              {budgetAssistantError ? (
                <p className="budget-assistant-error">{budgetAssistantError}</p>
              ) : budgetAssistantLoading ? (
                <div className="budget-assistant-skeleton" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              ) : (
                <p className="budget-assistant-answer">
                  {budgetAssistantAdvice || 'Analyse en cours…'}
                </p>
              )}
            </div>
          ) : (
            <div className="budget-assistant-answer-wrap budget-assistant-answer-wrap--local" aria-label="Conseil automatique local">
              <p className="budget-assistant-answer">{budgetAssistantLocalMessage}</p>
            </div>
          )}
        </div>
        </>
        ) : null}
      </aside>
      ) : null}
    </main>

    {/* ── Claude AI Chat ─────────────────────────────────────────── */}
    {isAuthenticated && anthropicKey ? (
      <>
        <button
          type="button"
          className={`chat-fab${chatOpen ? ' chat-fab--open' : ''}`}
          onClick={() => setChatOpen((prev) => !prev)}
          title="Assistant Claude"
          aria-label="Ouvrir l'assistant Claude"
        >
          {chatOpen ? <X size={22} /> : <MessageCircle size={22} />}
          {!chatOpen && chatMessages.length > 0 && (
            <span className="chat-fab-badge">{chatMessages.filter((m) => m.role === 'assistant').length}</span>
          )}
        </button>

        {chatOpen ? (
          <div className="chat-panel glass-card" role="dialog" aria-label="Assistant Claude">
            <div className="chat-header">
              <Bot size={18} />
              <span>Assistant Claude</span>
              <small>{selectedProfileName} · {formatMonth(selectedMonth)}</small>
              <button
                type="button"
                className="chat-clear-btn"
                onClick={() => setChatClearConfirmOpen((prev) => !prev)}
                title="Effacer la conversation"
                aria-label="Effacer la conversation"
                disabled={chatMessages.length === 0 || chatLoading}
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="chat-topic-bar">
              <label className="chat-topic-select">
                <span>Sujet</span>
                <select
                  value={activeChatThread.id}
                  onChange={(event) => setChatThreadId(event.target.value)}
                  disabled={chatLoading}
                >
                  {chatThreads.map((thread) => (
                    <option key={thread.id} value={thread.id}>
                      {thread.label} · {formatChatThreadActivity(thread.lastActivityAt)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="chat-topic-create">
                <input
                  value={chatTopicDraft}
                  onChange={(event) => setChatTopicDraft(event.target.value)}
                  placeholder="Nouveau sujet"
                  disabled={chatLoading}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      createChatTopic()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={createChatTopic}
                  disabled={!chatTopicDraft.trim() || chatLoading || !canCreateChatTopic}
                  title={canCreateChatTopic ? 'Créer un sujet' : `Limite de ${MAX_CHAT_THREADS_PER_SCOPE} sujets atteinte`}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="chat-topic-meta">
              <span>
                Dernière activité: {formatChatThreadActivity(activeChatThread.lastActivityAt)}
              </span>
              <span>
                {chatThreads.length}/{MAX_CHAT_THREADS_PER_SCOPE} sujets
              </span>
            </div>

            {canManageActiveEmptyThread ? (
              <div className="chat-topic-manage">
                <input
                  value={chatRenameDraft}
                  onChange={(event) => setChatRenameDraft(event.target.value)}
                  placeholder="Renommer le sujet vide"
                  disabled={chatLoading}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      renameActiveChatTopic()
                    }
                  }}
                />
                <button
                  type="button"
                  className="chat-topic-rename-btn"
                  onClick={renameActiveChatTopic}
                  disabled={!chatRenameDraft.trim() || chatLoading}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="chat-topic-delete-btn"
                  onClick={deleteActiveChatTopic}
                  disabled={chatThreads.length <= 1 || chatLoading}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : null}

            {chatClearConfirmOpen ? (
              <div className="chat-clear-confirm" role="status" aria-live="polite">
                <span>
                  Effacer la conversation du sujet {activeChatThread.label} pour {selectedProfileName} en {formatMonth(selectedMonth)} ?
                </span>
                <div className="chat-clear-confirm-actions">
                  <button type="button" className="chat-clear-confirm-yes" onClick={clearChatConversation}>
                    Effacer
                  </button>
                  <button
                    type="button"
                    className="chat-clear-confirm-no"
                    onClick={() => setChatClearConfirmOpen(false)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : null}

            {chatUndoToastOpen && lastDeletedChat?.storageKey === chatHistoryStorageKey ? (
              <div className="chat-undo-toast" role="status" aria-live="polite">
                <span>Conversation supprimée sur {lastDeletedChat.threadLabel}.</span>
                <button type="button" onClick={restoreLastDeletedChat} disabled={chatLoading}>
                  Restaurer
                </button>
              </div>
            ) : null}

            <div className="chat-messages" aria-live="polite" aria-relevant="additions text">
              {chatMessages.length === 0 ? (
                <div className="chat-empty">
                  <Bot size={32} />
                  <p>Bonjour ! Je peux analyser tes dépenses, ton budget et tes objectifs en quelques secondes.</p>
                  <small className="chat-empty-meta">Profil: {selectedProfileName} · Période: {formatMonth(selectedMonth)}</small>
                  <div className="chat-suggestions">
                    {[
                      'Résume mon mois',
                      'Où puis-je économiser ?',
                      'Mon budget tient-il ?',
                    ].map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={chatLoading}
                        onClick={() => {
                          setChatInput('')
                          void sendChatMessage(s)
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div key={index} className={`chat-bubble chat-bubble--${msg.role}`}>
                    <p>{msg.content}</p>
                  </div>
                ))
              )}
              {chatLoading ? (
                <div className="chat-bubble chat-bubble--assistant chat-bubble--loading">
                  <span /><span /><span />
                </div>
              ) : null}
              <div ref={chatEndRef} />
            </div>

            <form
              className="chat-input-row"
              onSubmit={(event) => { event.preventDefault(); void sendChatMessage() }}
            >
              <input
                ref={chatInputRef}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Pose une question…"
                disabled={chatLoading}
                autoFocus
              />
              <button type="submit" disabled={!chatInput.trim() || chatLoading}>
                {chatLoading ? <span className="inline-loader" aria-hidden="true" /> : <Send size={16} />}
              </button>
            </form>
          </div>
        ) : null}
      </>
    ) : null}

    {/* ── Toast notifications ───────────────────────────────────── */}
    {toast ? (
      <div key={toast.key} className="app-toast" role="status" aria-live="polite">
        {toast.message}
      </div>
    ) : null}
    </>
  )
}

export default App
