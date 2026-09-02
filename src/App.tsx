import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { AiQuotaExceededError, callCashModel, fetchAiQuota, type AiQuota } from './lib/aiClient'
import {
  fetchSubscription,
  openBillingPortal,
  startCheckout,
  type PlanId,
  type SubscriptionInfo,
} from './repos/billingRepo'
import AuthScreen from './AuthScreen'
import { StatsView } from './components/StatsView'
import { EnvelopeModal } from './components/EnvelopeModal'
import { PremiumGateModal } from './components/PremiumGateModal'
import { StartChecklist } from './components/StartChecklist'
import { CashChatPanel } from './components/CashChatPanel'
import { QuickAddModal } from './components/QuickAddModal'
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
  Layers3,
  Brain,
  Landmark,
  Pencil,
  Trash2,
  X,
  Bot,
  Repeat2,
  Target,
  ArrowUp,
  ArrowDown,
  Zap,
} from 'lucide-react'
import {
  clearPinChangeLogs,
  DEFAULT_PARENT_PIN,
  defaultSensitiveState,
  loadSensitiveState,
  resetSensitiveStorage,
  saveSensitiveState,
  setParentPin,
  type AuthRole,
  type SensitiveState,
} from './security'
import {
  euroFormatter,
  formatTooltipValue,
} from './lib/format'
import {
  normalizeText,
  sanitizeProfileId,
} from './lib/text'
import {
  defaultCsvMapping,
  inferBankProfileKey,
  inferCsvMapping,
  parseCsvRawData,
  parseCsvTransactions,
} from './lib/csvImport'
import { BACKUP_VERSION, decryptBackupPayload } from './lib/backup'
import { generateOnboardingPlan } from './lib/onboardingPlan'
import {
  AVATAR_MAX_DATA_URI_LENGTH,
  avatarColor,
  avatarInitials,
  MONEY_AVATAR_PRESETS,
  readAndResizeImage,
} from './lib/avatar'
import { isValidTxIcon, suggestMerchantIcon } from './lib/merchantIcons'
import { generateDueTransactions, getOccurrencesBetween } from './lib/recurring'
import { loadRecurringRules, saveRecurringRules } from './repos/recurringRulesRepo'
import { RecurringRulesPanel } from './components/RecurringRulesPanel'
import { FirstBudgetTour } from './components/FirstBudgetTour'
import { LandingPage } from './components/LandingPage'
import { AccountsPanel } from './components/AccountsPanel'
import { TransactionHistoryPanel } from './components/TransactionHistoryPanel'
import { ExpenseCalendar } from './components/ExpenseCalendar'
import { SavingsGoalsPanel } from './components/SavingsGoalsPanel'
import { PrivacyPanel } from './components/PrivacyPanel'
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal'
import { ProfilePanel } from './components/ProfilePanel'
import { logAuditEvent } from './lib/auditLog'
import { pushToCloud, syncWithCloud } from './lib/cloudSync'
import {
  acceptInvite,
  cancelSentInvite,
  listFamilyPeers,
  listPendingInvites,
  listSentInvites,
  type FamilyInvite,
  type FamilyPeer,
  type SentInvite,
} from './repos/familyRepo'
import { FamilyView } from './components/FamilyView'
import { MerchantLogo } from './components/MerchantLogo'
import { NotesView, type ExtractedTx, type NoteItem } from './components/NotesView'
import {
  defaultReportPrefs,
  getReportPrefs,
  parseCcEmails,
  saveReportPrefs,
  sendTestReport,
  type ReportPrefs,
} from './repos/reportPrefsRepo'
import { shiftDay, shiftMonth } from './lib/calendar'
import { mondayOf, weeklyStats } from './lib/weeklyStats'
import {
  computeConsolidatedBalance,
  balanceByAccountType,
} from './lib/accounts'
import {
  loadAccounts,
  saveAccounts,
  migrateTransactionsToDefaultAccount,
  ensureDefaultAccount,
} from './repos/accountsRepo'
import { ACCOUNT_TYPE_LABELS } from './types'
import type { Account, RecurringFrequency, RecurringRule } from './types'
import {
  allExpenseCategories,
  categories,
  categoryEmoji,
  colorForCategory,
  envelopes,
  envelopeColors,
  inferEnvelope,
  suggestCategoryFromLabel,
} from './lib/categories'
import type {
  AIProviderId,
  AlertItem,
  BackupPayload,
  Category,
  ChatThread,
  CsvColumnMapping,
  CsvPreviewRow,
  CsvRawData,
  DashboardWidgetId,
  DashboardWidgetSize,
  DashboardWidgetSizes,
  DashboardWidgetState,
  DashboardWidgetTemplateId,
  EncryptedBackup,
  Envelope,
  FamilyMember,
  RolloverState,
  SavingsGoals,
  SavingsTarget,
  StoredCsvMappings,
  Transaction,
  TransactionKind,
  UserProfile,
} from './types'

const TRANSACTIONS_STORAGE_KEY = 'plan-financier-transactions-v1'
const ANTHROPIC_KEY_STORAGE = 'plan-financier-anthropic-key-v1'
const CHAT_HISTORY_STORAGE_PREFIX = 'plan-financier-chat-history-v1'
const CHAT_THREADS_STORAGE_PREFIX = 'plan-financier-chat-threads-v1'
const ROLLOVER_STORAGE_KEY = 'plan-financier-rollover-v1'
const GOALS_STORAGE_KEY = 'plan-financier-goals-v1'
const CSV_MAPPINGS_STORAGE_KEY = 'plan-financier-csv-mappings-v1'
const PROFILES_STORAGE_KEY = 'plan-financier-profiles-v1'
const ACTIVE_PROFILE_STORAGE_KEY = 'plan-financier-active-profile-v1'
const DEFAULT_PROFILE_STORAGE_KEY = 'plan-financier-default-profile-v1'
const SAVINGS_TARGETS_STORAGE_KEY = 'plan-financier-savings-targets-v1'
const ONBOARDING_DONE_KEY = 'plan-financier-onboarding-done-v1'
// Phrases défilantes de l'écran de génération du plan manuel.
const MANUAL_ONBOARDING_PHASES = [
  'Préparation de la structure…',
  'Création de vos profils…',
  'Calcul des budgets mensuels…',
  'Configuration de votre objectif d\'épargne…',
  'Finalisation de votre plan…',
]
const FIRST_TX_TOUR_DONE_KEY = 'plan-financier-first-tx-tour-done-v1'
const START_CHECKLIST_DONE_KEY = 'plan-financier-start-checklist-done-v1'
/** Opérations saisies pendant la démo, reprises à la création du compte. */
const DEMO_CARRY_OVER_KEY = 'plan-financier-demo-carry-over-v1'
/** Ids des opérations du jeu de démo (les autres viennent de l'utilisateur). */
const DEMO_SEED_MAX_ID = 12
// ── Gating doux Premium ────────────────────────────────────────────────
// Promesse de la vitrine : tout est offert aux premiers inscrits — les
// comptes créés avant cette date gardent l'accès complet. Ensuite, chaque
// nouveau compte a 30 jours d'essai complet, puis le plan Découverte
// s'applique (3 poches, 1 profil, pas de rapport email ; l'IA est déjà
// limitée par quota côté serveur).
const EARLY_ADOPTER_UNTIL = '2026-10-01'
const TRIAL_DAYS = 30

// ── URLs propres (routage SPA léger, sans dépendance) ───────────────────────
// / (vitrine) · /login · /demo · /app, /app/depenses, /app/budget,
// /app/statistiques, /app/notes, /app/famille — le .htaccess renvoie tout
// chemin inconnu vers index.html.
const SECTION_TO_PATH: Record<string, string> = {
  overview: '/app',
  operations: '/app/depenses',
  budget: '/app/budget',
  stats: '/app/statistiques',
  notes: '/app/notes',
  family: '/app/famille',
}
const PATH_TO_SECTION: Record<string, string> = Object.fromEntries(
  Object.entries(SECTION_TO_PATH).map(([section, route]) => [route, section]),
)
const ENVELOPE_BUDGETS_STORAGE_KEY = 'plan-financier-envelope-budgets-v1'
const ENVELOPE_FUNDS_STORAGE_KEY = 'plan-financier-envelope-funds-v1'
const CUSTOM_ENVELOPES_STORAGE_KEY = 'plan-financier-custom-envelopes-v1'
const THEME_STORAGE_KEY = 'plan-financier-theme-v1'
const PALETTE_STORAGE_KEY = 'plan-financier-palette-v1'
const NOTES_STORAGE_KEY = 'plan-financier-notes-v1'
const A11Y_STORAGE_KEY = 'plan-financier-a11y-v1'

type A11yPrefs = {
  textSize: 'normal' | 'large' | 'xl'
  reduceMotion: boolean
  highContrast: boolean
}

const defaultA11yPrefs: A11yPrefs = { textSize: 'normal', reduceMotion: false, highContrast: false }

const loadA11yPrefs = (): A11yPrefs => {
  if (typeof window === 'undefined') return defaultA11yPrefs
  try {
    const raw = window.localStorage.getItem(A11Y_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<A11yPrefs>) : {}
    return {
      textSize: parsed.textSize === 'large' || parsed.textSize === 'xl' ? parsed.textSize : 'normal',
      reduceMotion: parsed.reduceMotion === true,
      highContrast: parsed.highContrast === true,
    }
  } catch {
    return defaultA11yPrefs
  }
}

const loadNotes = (): NoteItem[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is NoteItem =>
        !!item &&
        typeof (item as NoteItem).id === 'number' &&
        typeof (item as NoteItem).content === 'string' &&
        typeof (item as NoteItem).updatedAt === 'number',
    )
  } catch {
    return []
  }
}
// Palettes d'accent prédéfinies (voir index.css [data-palette=…]). Les pastilles
// `dots` montrent la teinte claire (thème sombre) et foncée (thème clair).
const COLOR_PALETTES = [
  { id: 'cafe', label: 'Café', dots: ['#C4956A', '#8B6C52'] },
  { id: 'foret', label: 'Forêt', dots: ['#8FBF7A', '#3A7D44'] },
  { id: 'ocean', label: 'Océan', dots: ['#7FB5D1', '#2E6E8E'] },
  { id: 'prune', label: 'Prune', dots: ['#A794C9', '#6B5B8A'] },
  { id: 'terracotta', label: 'Terracotta', dots: ['#D98B5F', '#C05C2A'] },
] as const
type PaletteId = (typeof COLOR_PALETTES)[number]['id']
const isPaletteId = (value: unknown): value is PaletteId =>
  COLOR_PALETTES.some((entry) => entry.id === value)
const DASHBOARD_WIDGETS_STORAGE_KEY = 'plan-financier-dashboard-widgets-v1'
const AI_PROVIDER_KEYS_STORAGE_KEY = 'plan-financier-ai-provider-keys-v1'
const DEFAULT_CHAT_THREAD: ChatThread = { id: 'general', label: 'Général', lastActivityAt: 0 }

const DASHBOARD_WIDGET_LIBRARY: Array<{ id: DashboardWidgetId; label: string }> = [
  { id: 'annualTrend', label: 'Tendance annuelle' },
  { id: 'coaching', label: 'Coaching financier' },
  { id: 'csvImport', label: 'Relevé bancaire' },
  { id: 'alerts', label: 'Alertes intelligentes' },
  { id: 'savingsGoals', label: "Objectifs d'épargne" },
  { id: 'recurringCharges', label: 'Charges récurrentes' },
  { id: 'savingsProjects', label: "Objectifs d'épargne projet" },
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
    widgets: ['annualTrend', 'alerts', 'savingsGoals'],
  },
  {
    id: 'equilibre',
    label: 'Équilibré',
    description: 'Bon compromis suivi + actions.',
    widgets: ['annualTrend', 'coaching', 'alerts', 'savingsGoals'],
  },
  {
    id: 'analytique',
    label: 'Analytique',
    description: 'Vision complète avec import et récurrences.',
    widgets: ['annualTrend', 'coaching', 'csvImport', 'alerts', 'savingsGoals', 'recurringCharges', 'savingsProjects'],
  },
]

const DASHBOARD_WIDGET_SIZE_ORDER: DashboardWidgetSize[] = ['compact', 'medium', 'large']

const DASHBOARD_WIDGET_ALLOWED_SIZES: Record<DashboardWidgetId, DashboardWidgetSize[]> = {
  annualTrend: ['medium', 'large'],
  coaching: ['compact', 'medium'],
  csvImport: ['medium', 'large'],
  alerts: ['compact', 'medium'],
  savingsGoals: ['compact', 'medium', 'large'],
  recurringCharges: ['compact', 'medium'],
  savingsProjects: ['compact', 'medium', 'large'],
}

const isDashboardWidgetId = (value: unknown): value is DashboardWidgetId =>
  typeof value === 'string' && DASHBOARD_WIDGET_LIBRARY.some((entry) => entry.id === value)

const isDashboardWidgetSize = (value: unknown): value is DashboardWidgetSize =>
  typeof value === 'string' && DASHBOARD_WIDGET_SIZE_ORDER.includes(value as DashboardWidgetSize)

const getAllowedDashboardWidgetSizes = (widgetId: DashboardWidgetId) => DASHBOARD_WIDGET_ALLOWED_SIZES[widgetId]

const getDefaultDashboardWidgetSize = (widgetId: DashboardWidgetId): DashboardWidgetSize => {
  return getAllowedDashboardWidgetSizes(widgetId)[0]
}

const buildDashboardWidgetSizes = (widgetIds: DashboardWidgetId[], previousSizes: DashboardWidgetSizes = {}) =>
  widgetIds.reduce<DashboardWidgetSizes>((accumulator, widgetId) => {
    const fallbackSize = getDefaultDashboardWidgetSize(widgetId)
    const candidate = previousSizes[widgetId]
    const allowedSizes = getAllowedDashboardWidgetSizes(widgetId)
    accumulator[widgetId] = candidate && isDashboardWidgetSize(candidate) && allowedSizes.includes(candidate)
      ? candidate
      : fallbackSize
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

  const avatar =
    typeof candidate.avatar === 'string' &&
    (candidate.avatar.startsWith('emoji:') || candidate.avatar.startsWith('data:image/')) &&
    candidate.avatar.length <= AVATAR_MAX_DATA_URI_LENGTH
      ? candidate.avatar
      : undefined

  return {
    id,
    name: candidate.name.trim() || 'Profil',
    monthlyBudget: Math.max(200, Math.round(candidate.monthlyBudget)),
    ...(avatar ? { avatar } : {}),
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

const normalizeTransaction = (value: unknown, knownProfileIds?: Set<string>): Transaction | null => {
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
  // Migration legacy : les très anciennes données avaient member = « Moi »
  // (texte libre) → profil par défaut. À n'appliquer QUE si « moi » n'est pas
  // un vrai profil de l'utilisateur (l'onboarding génère justement l'id 'moi' —
  // sans ce garde-fou, ses transactions étaient remappées vers 'principal' à
  // chaque rechargement et disparaissaient de l'affichage).
  const member =
    legacyMember === 'moi' && !knownProfileIds?.has('moi')
      ? defaultProfile.id
      : sanitizeProfileId(candidate.member)
  // Catégorie/poche : chaînes libres depuis le grand catalogue — on borne
  // juste la longueur et on retombe sur un défaut si vide.
  const category = candidate.category.trim() ? candidate.category.trim().slice(0, 60) : 'Autre'
  const rawEnvelopeValue = (value as { envelope?: unknown }).envelope
  const rawEnvelope = typeof rawEnvelopeValue === 'string' ? rawEnvelopeValue.trim() : ''
  const normalizedEnvelope = rawEnvelope === 'Fille' ? '' : rawEnvelope
  const envelope = normalizedEnvelope ? normalizedEnvelope.slice(0, 60) : inferEnvelope(category)
  const rawBudgetMonth = (value as { budgetMonth?: unknown }).budgetMonth
  const budgetMonth =
    typeof rawBudgetMonth === 'string' && /^\d{4}-\d{2}$/.test(rawBudgetMonth) ? rawBudgetMonth : undefined

  return {
    id: candidate.id,
    label: candidate.label,
    amount: candidate.amount,
    ...(budgetMonth ? { budgetMonth } : {}),
    category,
    member: member || defaultProfile.id,
    date: candidate.date,
    kind: candidate.kind === 'revenu' ? 'revenu' : 'depense',
    envelope,
    ...(typeof (value as { recurringRuleId?: unknown }).recurringRuleId === 'string'
      ? { recurringRuleId: (value as { recurringRuleId: string }).recurringRuleId }
      : {}),
    ...(Array.isArray((value as { tags?: unknown }).tags)
      ? {
          tags: ((value as { tags: unknown[] }).tags)
            .filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)
            .slice(0, 8),
        }
      : {}),
    ...(isValidTxIcon((value as { icon?: unknown }).icon)
      ? { icon: (value as { icon: string }).icon }
      : {}),
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

    const profiles = loadProfiles()
    const knownProfileIds = new Set(profiles.map((profile) => profile.id))
    const fallbackProfileId = loadDefaultProfileId(profiles)

    const cleaned = parsed
      .map((item) => normalizeTransaction(item, knownProfileIds))
      .filter((item): item is Transaction => item !== null)
      // Récupère les transactions orphelines (rattachées à un profil qui
      // n'existe plus, ex. victimes de l'ancien remap 'moi' → 'principal') :
      // on les rebascule sur le profil par défaut plutôt que de les perdre.
      .map((item) =>
        knownProfileIds.has(item.member) ? item : { ...item, member: fallbackProfileId },
      )
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

const getChatThreadScopeKey = (profileId: string, month: string) =>
  `${CHAT_THREADS_STORAGE_PREFIX}:${profileId}:${month}`

const getChatHistoryStorageKey = (profileId: string, month: string, threadId: string) =>
  `${CHAT_HISTORY_STORAGE_PREFIX}:${profileId}:${month}:${threadId}`

/** ℹ️ cliquable : l'explication ne s'affiche qu'à la demande. */
function InfoHint({ text }: { text: string }) {
  return (
    <details className="info-hint">
      <summary aria-label="Plus d'informations" title="Plus d'informations">ℹ️</summary>
      <span className="info-hint__pop" role="note">{text}</span>
    </details>
  )
}

function App() {
  type SettingsSection = 'profiles' | 'ai' | 'security' | 'backup' | 'reset' | 'theme' | 'rgpd' | 'account' | 'report' | 'a11y' | 'subscription'
  const currentMonth = new Date().toISOString().slice(0, 7)
  const todayIso = new Date().toISOString().slice(0, 10)
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
  type ToastLevel = 'info' | 'warning' | 'danger'
  const [toast, setToast] = useState<{ message: string; key: number; level: ToastLevel } | null>(null)
  const showToast = (message: string, level: ToastLevel = 'info') =>
    setToast({ message, key: Date.now(), level })

  /** Mode démo : bloque une action réelle et explique pourquoi. */
  const blockInDemo = (feature: string): boolean => {
    if (!demoMode) return false
    showToast(`🎬 Mode démo — ${feature} n'est pas disponible ici. Créez un compte gratuit pour l'activer !`)
    return true
  }
  useEffect(() => {
    if (!toast) return
    // Toasts d'alerte tiennent plus longtemps (l'utilisateur doit pouvoir lire)
    const duration = toast.level === 'info' ? 2800 : 4500
    const t = window.setTimeout(() => setToast(null), duration)
    return () => window.clearTimeout(t)
  }, [toast])

  // ── Notifications budget : détection franchissement de seuil ─────────
  // Track le dernier seuil notifié par couple (mois, profil) via un ref
  // pour ne déclencher le toast qu'au moment du franchissement (pas à
  // chaque render).
  const lastBudgetThresholdRef = useRef<{ key: string; level: number } | null>(null)

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
  // ── Famille (comptes reliés) ──
  const [familyPeers, setFamilyPeers] = useState<FamilyPeer[]>([])
  const [pendingInvites, setPendingInvites] = useState<FamilyInvite[]>([])
  const [myUserId, setMyUserId] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteFeedback, setInviteFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  // ── Notes ──
  const [notes, setNotes] = useState<NoteItem[]>(loadNotes)

  // ── Rapport par email ──
  const [reportPrefs, setReportPrefs] = useState<ReportPrefs>(defaultReportPrefs)
  const [reportBusy, setReportBusy] = useState(false)
  const [reportFeedback, setReportFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [reportCcDraft, setReportCcDraft] = useState('')
  const [chatAttachment, setChatAttachment] = useState<{ name: string; mediaType: string; data: string } | null>(null)
  const [chatListening, setChatListening] = useState(false)
  const chatFileInputRef = useRef<HTMLInputElement | null>(null)
  const chatRecognitionRef = useRef<{ stop: () => void } | null>(null)
  // Bulle d'invitation près de la bulle de chat (1× par jour, discrète).
  const [chatNudgeVisible, setChatNudgeVisible] = useState(false)
  // Indicateurs de défilement du chat (du contenu caché en haut / en bas ?).
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const [chatScrollHints, setChatScrollHints] = useState({ up: false, down: false })

  const updateChatScrollHints = () => {
    const el = chatScrollRef.current
    if (!el) return
    const up = el.scrollTop > 48
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 48
    setChatScrollHints((previous) => (previous.up === up && previous.down === down ? previous : { up, down }))
  }

  type SpeechRecognitionLike = {
    lang: string
    interimResults: boolean
    continuous: boolean
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
    onend: (() => void) | null
    onerror: (() => void) | null
    start: () => void
    stop: () => void
  }

  const speechRecognitionCtor = (() => {
    if (typeof window === 'undefined') return null
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
  })()

  const handleChatFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast('Fichier trop lourd — 5 Mo maximum', 'danger')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      if (comma < 0) return
      setChatAttachment({
        name: file.name,
        mediaType: file.type || 'application/octet-stream',
        data: result.slice(comma + 1),
      })
    }
    reader.readAsDataURL(file)
  }

  const toggleChatDictation = () => {
    if (chatListening) {
      chatRecognitionRef.current?.stop()
      return
    }
    if (!speechRecognitionCtor) return
    const recognition = new speechRecognitionCtor()
    recognition.lang = 'fr-FR'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.onresult = (event) => {
      const text = Array.from({ length: event.results.length }, (_, i) => event.results[i][0].transcript).join(' ')
      setChatInput(text)
    }
    recognition.onend = () => setChatListening(false)
    recognition.onerror = () => setChatListening(false)
    chatRecognitionRef.current = recognition
    setChatListening(true)
    recognition.start()
  }

  const [sentInvites, setSentInvites] = useState<SentInvite[]>([])
  // Cadre de relance : 1× par 24 h et par invitation (horodatage local).
  const [relanceTick, setRelanceTick] = useState(0)
  const navItems = useMemo(
    () => [
      { id: 'overview',    icon: '🏠', label: 'Accueil' },
      { id: 'operations',  icon: '💳', label: 'Dépenses' },
      { id: 'budget',      icon: '📅', label: 'Budget' },
      // `short` : libellé de la barre d'onglets mobile (place limitée).
      { id: 'stats',       icon: '📊', label: 'Statistiques', short: 'Stats' },
      { id: 'notes',       icon: '🗒️', label: 'Notes' },
      ...(familyPeers.length >= 2 ? [{ id: 'family', icon: '👨‍👩‍👧', label: 'Famille' }] : []),
    ],
    [familyPeers.length],
  )
  const isActiveView = (sectionId: string) => activeSectionId === sectionId
  const navigateToSection = (sectionId: string) => {
    setActiveSectionId(sectionId)
    const route = SECTION_TO_PATH[sectionId]
    if (route && window.location.pathname !== route) {
      window.history.pushState({}, '', route)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const [profiles, setProfiles] = useState<UserProfile[]>(loadProfiles)
  const [activeSectionId, setActiveSectionId] = useState(
    () => PATH_TO_SECTION[window.location.pathname] ?? 'overview',
  )
  const [isSecurityReady, setIsSecurityReady] = useState(false)
  const [authProviderReady, setAuthProviderReady] = useState(false)
  // (saveSensitiveState) — plus aucune lecture depuis la fin des sessions locales.
  const [, setSensitiveState] = useState<SensitiveState>(defaultSensitiveState)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  // Mode démo : visite guidée sans compte — données en mémoire uniquement
  // (toutes les persistances localStorage sont désactivées tant qu'il est actif).
  const [demoMode, setDemoMode] = useState(false)
  // Site vitrine affiché avant l'écran de connexion pour les visiteurs.
  // /login et /app/* mènent directement à l'écran de connexion.
  const [showLanding, setShowLanding] = useState(() => {
    const path = window.location.pathname
    return path !== '/login' && !path.startsWith('/app')
  })
  const [, setAuthRole] = useState<AuthRole>('Parent')
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(
    () => (window.localStorage.getItem(THEME_STORAGE_KEY) as 'dark' | 'light' | 'system') ?? 'system'
  )
  const [a11yPrefs, setA11yPrefs] = useState<A11yPrefs>(loadA11yPrefs)
  const [palette, setPalette] = useState<PaletteId>(() => {
    const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY)
    return isPaletteId(stored) ? stored : 'cafe'
  })
  const [dashboardWidgetState, setDashboardWidgetState] = useState<DashboardWidgetState>(loadDashboardWidgetState)
  const [widgetSizeMenuFor, setWidgetSizeMenuFor] = useState<DashboardWidgetId | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profiles')
  // Sélecteur photo/avatar du profil : s'ouvre en touchant la photo.
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSuccess, setSettingsSuccess] = useState('')

  // Les confirmations de succès s'effacent seules (les erreurs, elles, restent
  // affichées jusqu'à la prochaine action).
  useEffect(() => {
    if (!settingsSuccess) return
    const timer = window.setTimeout(() => setSettingsSuccess(''), 4000)
    return () => window.clearTimeout(timer)
  }, [settingsSuccess])
  const [claudeTestState, setClaudeTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [claudeTestMessage, setClaudeTestMessage] = useState('')
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
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>(loadRecurringRules)
  const [showRecurringPanel, setShowRecurringPanel] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>(loadAccounts)
  const [showAccountsPanel, setShowAccountsPanel] = useState(false)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [showGoalsPanel, setShowGoalsPanel] = useState(false)
  const [showPrivacyPanel, setShowPrivacyPanel] = useState(false)
  const [showProfilePanel, setShowProfilePanel] = useState(false)
  const [legalDoc, setLegalDoc] = useState<'privacy' | 'terms' | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [showFirstTxTour, setShowFirstTxTour] = useState(
    () =>
      typeof window !== 'undefined' &&
      !window.localStorage.getItem(FIRST_TX_TOUR_DONE_KEY),
  )
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoals>(() => loadSavingsGoals(loadProfiles()))
  const [rolloverState, setRolloverState] = useState<RolloverState>(() =>
    loadRolloverState(currentMonth, loadProfiles()),
  )
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
    accountId: '' as string,    // résolu vers le compte par défaut au mount via useEffect
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
  const [budgetAssistantAdvice, setBudgetAssistantAdvice] = useState('')
  const [budgetAssistantError, setBudgetAssistantError] = useState('')
  const [budgetAssistantLoading, setBudgetAssistantLoading] = useState(false)
  const [budgetAssistantContextLoaded, setBudgetAssistantContextLoaded] = useState('')
  // Mode simple permanent (le bascule a été retiré de l'interface).
  const budgetSimpleMode = true
  // Objectifs par poche (enveloppes) : Record<profileId, Record<poche, montant>>.
  const [envelopeBudgets, setEnvelopeBudgets] = useState<Record<string, Record<string, number>>>(() => {
    try {
      const raw = window.localStorage.getItem(ENVELOPE_BUDGETS_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as Record<string, Record<string, number>>) : {}
    } catch {
      return {}
    }
  })
  // Argent « mis dans » chaque poche (provision) : Record<profileId, Record<poche, montant>>.
  const [envelopeFunds, setEnvelopeFunds] = useState<Record<string, Record<string, number>>>(() => {
    try {
      const raw = window.localStorage.getItem(ENVELOPE_FUNDS_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as Record<string, Record<string, number>>) : {}
    } catch {
      return {}
    }
  })
  const [envelopeOpenName, setEnvelopeOpenName] = useState<string | null>(null)
  // Poches créées par l'utilisateur : Record<profileId, string[]>.
  const [customEnvelopes, setCustomEnvelopes] = useState<Record<string, string[]>>(() => {
    try {
      const raw = window.localStorage.getItem(CUSTOM_ENVELOPES_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as Record<string, string[]>) : {}
    } catch {
      return {}
    }
  })
  // Modale de gestion d'une poche (édition ou création).
  const [envelopeModal, setEnvelopeModal] = useState<{ mode: 'edit' | 'create'; name: string } | null>(null)
  const [envModalName, setEnvModalName] = useState('')
  const [envModalTarget, setEnvModalTarget] = useState('')
  const [envModalAdd, setEnvModalAdd] = useState('')
  const [envModalDeleteAsk, setEnvModalDeleteAsk] = useState(false)
  const [goalRowEditing, setGoalRowEditing] = useState<string | null>(null)
  const [goalRowDraft, setGoalRowDraft] = useState('')
  const [budgetQuickEditOpen, setBudgetQuickEditOpen] = useState(false)
  const [budgetQuickEditValue, setBudgetQuickEditValue] = useState('')
  const budgetInfoScopeRef = useRef<HTMLElement | null>(null)

  // ── Claude AI ──────────────────────────────────────────────────────────
  type ChatMessage = { role: 'user' | 'assistant'; content: string }
  const [aiProviderKeys, setAiProviderKeys] = useState<Record<AIProviderId, string>>(() => {
    const fallbackAnthropicKey = window.localStorage.getItem(ANTHROPIC_KEY_STORAGE) ?? ''
    const initial: Record<AIProviderId, string> = {
      anthropic: fallbackAnthropicKey,
      openai: '',
      mistral: '',
      google: '',
      openrouter: '',
    }

    const raw = window.localStorage.getItem(AI_PROVIDER_KEYS_STORAGE_KEY)
    if (!raw) return initial

    try {
      const parsed = JSON.parse(raw) as Partial<Record<AIProviderId, string>>
      return {
        anthropic: parsed.anthropic ?? fallbackAnthropicKey,
        openai: parsed.openai ?? '',
        mistral: parsed.mistral ?? '',
        google: parsed.google ?? '',
        openrouter: parsed.openrouter ?? '',
      }
    } catch {
      return initial
    }
  })
  const anthropicKey = aiProviderKeys.anthropic
  // IA incluse dans le compte : sans clé personnelle, les appels passent par
  // la fonction Edge ai-chat (quota mensuel selon le plan d'abonnement).
  // La clé perso reste prioritaire et sans quota. Pas d'IA incluse en démo.
  const canUseIncludedAi = isAuthenticated && !demoMode
  const cashAiReady = Boolean(anthropicKey) || canUseIncludedAi
  const [chatOpen, setChatOpen] = useState(false)

  // ── Abonnement (Stripe) + quota IA ─────────────────────────────────────
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [aiQuota, setAiQuota] = useState<AiQuota | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null)
  const userPlan: PlanId = subscription?.plan ?? 'free'
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null)
  // Fonctionnalité Premium demandée sans accès : nom affiché dans la modale.
  const [premiumGate, setPremiumGate] = useState<string | null>(null)
  const premiumAccess = useMemo(() => {
    if (demoMode) return { unlocked: true, reason: 'demo' as const, trialEndsAt: null }
    if (userPlan !== 'free') return { unlocked: true, reason: 'plan' as const, trialEndsAt: null }
    // Session pas encore lue : ne jamais bloquer par précaution.
    if (!accountCreatedAt) return { unlocked: true, reason: 'unknown' as const, trialEndsAt: null }
    const created = new Date(accountCreatedAt)
    if (created < new Date(`${EARLY_ADOPTER_UNTIL}T00:00:00`)) {
      return { unlocked: true, reason: 'early' as const, trialEndsAt: null }
    }
    const trialEndsAt = new Date(created.getTime() + TRIAL_DAYS * 86_400_000)
    return { unlocked: Date.now() < trialEndsAt.getTime(), reason: 'trial' as const, trialEndsAt }
  }, [demoMode, userPlan, accountCreatedAt])
  /** Bloque une action Premium (et explique) si le compte n'y a pas accès. */
  const requirePremium = (feature: string): boolean => {
    if (premiumAccess.unlocked) return false
    setPremiumGate(feature)
    return true
  }

  // Charge le plan d'abonnement à la connexion (table subscriptions).
  useEffect(() => {
    if (!canUseIncludedAi) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubscription(null)
      setAiQuota(null)
      return
    }
    let cancelled = false
    void fetchSubscription().then((info) => {
      if (!cancelled) setSubscription(info)
    })
    return () => {
      cancelled = true
    }
  }, [canUseIncludedAi])

  // Quota IA du mois : rafraîchi à l'ouverture des sections concernées.
  useEffect(() => {
    if (!showSettings || !canUseIncludedAi) return
    if (settingsSection !== 'ai' && settingsSection !== 'subscription') return
    let cancelled = false
    void fetchAiQuota().then((quota) => {
      if (!cancelled && quota) setAiQuota(quota)
    })
    return () => {
      cancelled = true
    }
  }, [showSettings, settingsSection, canUseIncludedAi])

  // Retour de Stripe Checkout (…?checkout=success) : confirmation + refresh.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    if (!checkout) return
    params.delete('checkout')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
    if (checkout === 'success') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      showToast('🎉 Merci ! Votre abonnement sera actif d\'ici quelques secondes.')
      window.setTimeout(() => {
        void fetchSubscription().then(setSubscription)
      }, 4000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStartCheckout = async (plan: 'premium' | 'family', interval: 'monthly' | 'yearly') => {
    if (blockInDemo("l'abonnement")) return
    setCheckoutBusy(`${plan}-${interval}`)
    try {
      window.location.href = await startCheckout(plan, interval)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Impossible d'ouvrir le paiement.", 'warning')
      setCheckoutBusy(null)
    }
  }

  const handleOpenBillingPortal = async () => {
    if (blockInDemo("l'abonnement")) return
    setCheckoutBusy('portal')
    try {
      window.location.href = await openBillingPortal()
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Impossible d'ouvrir la facturation.", 'warning')
      setCheckoutBusy(null)
    }
  }

  // /demo lance le mode démo directement ; navigation arrière/avant du
  // navigateur synchronisée avec l'état de l'app.
  useEffect(() => {
    if (window.location.pathname === '/demo' && !isAuthenticated && !demoMode) {
      window.history.replaceState({}, '', '/app')
      enterDemoMode()
    }
    const onPopState = () => {
      const path = window.location.pathname
      if (PATH_TO_SECTION[path]) {
        setActiveSectionId(PATH_TO_SECTION[path])
        setShowLanding(false)
        return
      }
      if (path === '/login') {
        setShowLanding(false)
        return
      }
      setShowLanding(true)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Une fois connecté, l'URL bascule sur /app (et garde la section active).
  useEffect(() => {
    if (!isAuthenticated && !demoMode) return
    if (!window.location.pathname.startsWith('/app')) {
      window.history.replaceState({}, '', SECTION_TO_PATH[activeSectionId] ?? '/app')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, demoMode])

  // Invitation discrète : 3 s après l'arrivée, 1× par 24 h, disparaît en 9 s.
  useEffect(() => {
    if (!isAuthenticated || !cashAiReady || chatOpen) return
    const KEY = 'plan-financier-cash-nudge-at'
    const last = Number(window.localStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < 24 * 3600 * 1000) return
    const showTimer = window.setTimeout(() => {
      setChatNudgeVisible(true)
      window.localStorage.setItem(KEY, String(Date.now()))
    }, 3000)
    const hideTimer = window.setTimeout(() => setChatNudgeVisible(false), 12_000)
    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [isAuthenticated, cashAiReady, chatOpen])
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([DEFAULT_CHAT_THREAD])
  const [chatThreadId, setChatThreadId] = useState(DEFAULT_CHAT_THREAD.id)
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
        // Réinitialise une sélection devenue invalide : non dérivable au render
        // (l'ID actif est piloté par les clics utilisateur).
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
      const target = event.target as HTMLElement | null
      // La bulle reste ouverte uniquement si le clic vise le bouton ℹ️ ou la
      // bulle elle-même ; tout autre clic (même dans le panneau budget) ferme.
      const insideInfoUi = !!target?.closest('.info-dot-wrap, .toolbar-info-wrap, .toolbar-info-btn, .toolbar-info-pop')
      if (!insideInfoUi) {
        setBudgetInfoOpen(null)
        setBudgetInfoDotOpen(null)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setBudgetInfoOpen(null)
        setBudgetInfoDotOpen(null)
      }
    }

    document.addEventListener('mousedown', handleOutsideInfoClick)
    document.addEventListener('touchstart', handleOutsideInfoClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideInfoClick)
      document.removeEventListener('touchstart', handleOutsideInfoClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [budgetInfoOpen, budgetInfoDotOpen])

  // Visibilité simple : tous les blocs activés s'affichent en grille (l'ancienne
  // « navigation vue par vue » qui n'en montrait qu'un a été supprimée).
  const isPilotageWidgetVisible = (widgetId: DashboardWidgetId) =>
    visibleDashboardWidgets.has(widgetId)

  const applyDashboardWidgetTemplate = (templateId: Exclude<DashboardWidgetTemplateId, 'custom'>) => {
    const template = DASHBOARD_WIDGET_TEMPLATES.find((entry) => entry.id === templateId)
    if (!template) return
    setDashboardWidgetState((previous) => ({
      templateId,
      visibleWidgets: [...template.widgets],
      widgetSizes: buildDashboardWidgetSizes(template.widgets, previous.widgetSizes),
    }))
  }










  useEffect(() => {
    if (!widgetSizeMenuFor) return

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('.widget-preview-card__tools, .widget-size-flip-panel')) {
        setWidgetSizeMenuFor(null)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [widgetSizeMenuFor])

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
  type OnboardingProviderId = AIProviderId

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
  ]

  // Un seul fournisseur assumé : Claude (Anthropic) — c'est lui qui motorise
  // l'IA incluse côté serveur et la clé personnelle optionnelle.
  const selectedAiProvider = ONBOARDING_PROVIDERS[0]
  const activeAiKey = aiProviderKeys.anthropic

  // Affiché piloté par le compte (cf. effet plus bas qui lit
  // profiles.onboarding_completed_at à la connexion), pas par l'appareil.
  const [showOnboarding, setShowOnboarding] = useState(false)
  // Branche choisie à l'étape 1 : assistant IA ou questionnaire manuel.
  const [onboardingMode, setOnboardingMode] = useState<'ai' | 'manual'>('ai')
  // Écran de génération animé du plan manuel + index de la phrase affichée.
  const [manualGenerating, setManualGenerating] = useState(false)
  const [manualPhase, setManualPhase] = useState(0)
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3 | 4>(1)
  const [onboardingProvider, setOnboardingProvider] = useState<OnboardingProviderId | null>('anthropic')
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

  const callClaudeOnboarding = async (messages: OnboardingMsg[], key: string): Promise<string> =>
    callCashModel({
      apiKey: key || undefined,
      system: ONBOARDING_SYSTEM,
      maxTokens: 1024,
      messages,
    })

  const handleOnboardingStart = async () => {
    if (!onboardingProvider || onboardingProvider !== 'anthropic') {
      setOnboardingError(`L'intégration ${ONBOARDING_PROVIDERS.find((provider) => provider.id === onboardingProvider)?.name ?? 'sélectionnée'} arrive bientôt dans FP. Aujourd'hui, seul Claude via Anthropic est disponible.`)
      return
    }
    const key = onboardingKeyDraft.trim()
    if (!key && !canUseIncludedAi) { setOnboardingError('Veuillez entrer votre clé API Anthropic.'); return }
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
      if (key) saveAnthropicKey(key)
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
        void persistOnboardingDone()
        setTimeout(() => {
          setShowOnboarding(false)
          landAfterOnboarding()
        }, 2200)
      }
    } catch {
      setOnboardingMessages([...next, { role: 'assistant', content: "Désolé, une erreur s'est produite. Réessayez." }])
    } finally {
      setOnboardingLoading(false)
    }
  }

  // Marque l'onboarding terminé : drapeau localStorage (rapide/offline) +
  // profiles.onboarding_completed_at côté Supabase (source de vérité par compte).
  const persistOnboardingDone = async () => {
    window.localStorage.setItem(ONBOARDING_DONE_KEY, '1')
    try {
      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user.id
      if (userId) {
        await supabase
          .from('profiles')
          .update({ onboarding_completed_at: new Date().toISOString() })
          .eq('user_id', userId)
        // Email de bienvenue (une seule fois par compte, côté serveur) —
        // en arrière-plan : un échec n'empêche jamais l'entrée dans l'app.
        void supabase.functions.invoke('lifecycle-emails', { body: { event: 'welcome' } }).catch(() => {})
        // Bilan hebdomadaire activé par défaut (désactivable dans Paramètres →
        // Rapport par email) : le rappel du dimanche est le premier levier de
        // rétention. Uniquement si aucune préférence n'existe encore.
        const current = await getReportPrefs()
        if (current.frequency === 'none' && !current.lastSentAt) {
          const saved = await saveReportPrefs({ frequency: 'weekly', format: 'summary', attachment: 'none', ccEmails: [] })
          if (saved) setReportPrefs((previous) => ({ ...previous, frequency: 'weekly' }))
        }
      }
    } catch {
      // Hors-ligne : le drapeau localStorage suffit pour cet appareil.
    }
  }

  // Après l'onboarding : atterrir sur l'Accueil (le « cockpit ») et, si le
  // compte est encore vide, enchaîner le guide « première transaction ».
  /** Reprend les opérations saisies pendant la démo (une seule fois). */
  const importDemoCarryOver = (): number => {
    try {
      const raw = window.localStorage.getItem(DEMO_CARRY_OVER_KEY)
      if (!raw) return 0
      window.localStorage.removeItem(DEMO_CARRY_OVER_KEY)
      const rows = JSON.parse(raw) as Transaction[]
      if (!Array.isArray(rows) || rows.length === 0) return 0
      let counter = Date.now()
      const imported = rows
        .filter((tx) => tx && typeof tx.label === 'string' && typeof tx.amount === 'number')
        .map((tx) => ({ ...tx, id: counter++, member: selectedProfileId }))
      if (imported.length === 0) return 0
      setTransactions((previous) => [...previous, ...imported])
      return imported.length
    } catch {
      return 0
    }
  }

  const landAfterOnboarding = () => {
    setActiveSectionId('overview')
    const imported = importDemoCarryOver()
    if (imported > 0) {
      showToast(`🎬 ${imported} opération${imported > 1 ? 's' : ''} de votre démo importée${imported > 1 ? 's' : ''} — bienvenue !`)
      return
    }
    if (transactions.length === 0) {
      setShowFirstTxTour(true)
    }
  }

  /** Démo → inscription : garde ce que l'utilisateur a saisi lui-même. */
  const leaveDemoForSignup = () => {
    const own = transactions.filter((tx) => tx.member === 'demo' && tx.id > DEMO_SEED_MAX_ID)
    try {
      if (own.length > 0) window.localStorage.setItem(DEMO_CARRY_OVER_KEY, JSON.stringify(own))
      else window.localStorage.removeItem(DEMO_CARRY_OVER_KEY)
    } catch {
      /* stockage indisponible : on part sans reprise */
    }
    window.location.href = '/login'
  }

  // Entrée en mode démo : jeu de données réaliste, en mémoire seulement.
  const enterDemoMode = () => {
    const d = (day: number) => `${currentMonth}-${String(day).padStart(2, '0')}`
    const demoProfiles: UserProfile[] = [
      { id: 'demo', name: 'Démo', monthlyBudget: 2200, avatar: 'emoji:💰' },
    ]
    const demoTransactions: Transaction[] = [
      { id: 1, label: 'Salaire', amount: 2450, category: 'Autre', member: 'demo', date: d(2), kind: 'revenu', envelope: 'Perso' },
      { id: 2, label: 'Loyer', amount: 850, category: 'Maison', member: 'demo', date: d(3), kind: 'depense', envelope: 'Maison' },
      { id: 3, label: 'Courses Carrefour', amount: 96.4, category: 'Courses', member: 'demo', date: d(4), kind: 'depense', envelope: 'Maison' },
      { id: 4, label: 'Pass Navigo', amount: 86.4, category: 'Transport', member: 'demo', date: d(5), kind: 'depense', envelope: 'Perso' },
      { id: 5, label: 'Restaurant entre amis', amount: 54, category: 'Loisirs', member: 'demo', date: d(8), kind: 'depense', envelope: 'Perso' },
      { id: 6, label: 'Pharmacie', amount: 18.9, category: 'Sante', member: 'demo', date: d(10), kind: 'depense', envelope: 'Maison' },
      { id: 7, label: 'Courses Lidl', amount: 72.3, category: 'Courses', member: 'demo', date: d(12), kind: 'depense', envelope: 'Maison' },
      { id: 8, label: 'Essence', amount: 65, category: 'Transport', member: 'demo', date: d(15), kind: 'depense', envelope: 'Perso' },
      { id: 9, label: 'Cinéma', amount: 24, category: 'Loisirs', member: 'demo', date: d(16), kind: 'depense', envelope: 'Vacances' },
      { id: 10, label: 'Courses marché', amount: 43.5, category: 'Courses', member: 'demo', date: d(19), kind: 'depense', envelope: 'Maison' },
      { id: 11, label: 'Électricité', amount: 78, category: 'Maison', member: 'demo', date: d(20), kind: 'depense', envelope: 'Maison' },
      { id: 12, label: 'Cantine des enfants', amount: 62, category: 'Ecole', member: 'demo', date: d(22), kind: 'depense', envelope: 'Maison' },
    ]
    setProfiles(demoProfiles)
    setSelectedMember('demo')
    setDefaultProfileId('demo')
    setTransactions(demoTransactions)
    setSavingsTargets([
      { id: 'demo-goal', label: 'Épargne de précaution', targetAmount: 3000, currentSaved: 1450, displayColor: '#3A7D44', member: 'demo' },
    ])
    setShowOnboarding(false)
    setShowFirstTxTour(false)
    setDemoMode(true)
  }

  const skipOnboarding = () => {
    void persistOnboardingDone()
    setShowOnboarding(false)
    landAfterOnboarding()
  }

  // Chemin MANUEL : génère un plan sur mesure depuis les réponses (sans IA) et
  // l'applique (profils + budgets + objectif d'épargne).
  const handleManualPlan = () => {
    // Date.now() = horodatage réel de l'action (handler, pas du render).
    // eslint-disable-next-line react-hooks/purity
    const plan = generateOnboardingPlan(onboardingUserProfile, Date.now())
    setManualPhase(0)
    setManualGenerating(true)

    // Défilement des phrases pendant la « génération ».
    let phase = 0
    const interval = window.setInterval(() => {
      phase += 1
      if (phase < MANUAL_ONBOARDING_PHASES.length) {
        setManualPhase(phase)
      } else {
        window.clearInterval(interval)
      }
    }, 650)

    // Application effective du plan à la fin de l'animation.
    window.setTimeout(() => {
      window.clearInterval(interval)
      applyOnboardingConfig({ profiles: plan.profiles, defaultProfileId: plan.defaultProfileId })
      setSavingsTargets(plan.savingsTargets)
      window.localStorage.setItem(SAVINGS_TARGETS_STORAGE_KEY, JSON.stringify(plan.savingsTargets))
      void persistOnboardingDone()
      setManualGenerating(false)
      setShowOnboarding(false)
      landAfterOnboarding()
    }, MANUAL_ONBOARDING_PHASES.length * 650 + 350)
  }

  // Déclenchement lié au compte : à la connexion, on affiche le wizard tant que
  // profiles.onboarding_completed_at est vide. Fallback localStorage si offline.
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const userId = data.session?.user.id
        if (!userId || cancelled) return
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed_at')
          .eq('user_id', userId)
          .maybeSingle()
        if (cancelled) return
        if (error) {
          if (!window.localStorage.getItem(ONBOARDING_DONE_KEY)) setShowOnboarding(true)
          return
        }
        if (!profile?.onboarding_completed_at) setShowOnboarding(true)
      } catch {
        if (!window.localStorage.getItem(ONBOARDING_DONE_KEY)) setShowOnboarding(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const completeFirstTxTour = (budgetValue?: number) => {
    if (budgetValue) {
      setProfiles((previous) =>
        previous.map((profile) =>
          profile.id === selectedProfileId ? { ...profile, monthlyBudget: budgetValue } : profile,
        ),
      )
      showToast(`🎯 Budget mensuel défini : ${budgetValue.toLocaleString('fr-FR')} €`)
    }
    window.localStorage.setItem(FIRST_TX_TOUR_DONE_KEY, '1')
    setShowFirstTxTour(false)
  }

  const saveAiProviderKey = (provider: AIProviderId, key: string) => {
    setAiProviderKeys((previous) => {
      const next = { ...previous, [provider]: key }
      if (!demoMode) window.localStorage.setItem(AI_PROVIDER_KEYS_STORAGE_KEY, JSON.stringify(next))
      if (provider === 'anthropic') {
        window.localStorage.setItem(ANTHROPIC_KEY_STORAGE, key)
      }
      return next
    })
    setClaudeTestState('idle')
    setClaudeTestMessage('')
  }

  const saveAnthropicKey = (key: string) => {
    saveAiProviderKey('anthropic', key)
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
          model: 'claude-haiku-4-5-20251001',
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

    return `Tu t'appelles Cash, l'assistant financier personnel intégré dans une app de budget privée.
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

Réponds en français, de façon concise et bienveillante, en vouvoyant l'utilisateur. Tu peux analyser les données ci-dessus et répondre à toutes les questions (pas seulement financières).`
  }

  const handlePredictMonth = async () => {
    if (!cashAiReady || predictionLoading) return
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
      const text = await callCashModel({
        apiKey: anthropicKey || undefined,
        maxTokens: 400,
        messages: [{ role: 'user', content: prompt }],
      })
      setPredictionResult(text || '…')
    } catch (error) {
      const msg =
        error instanceof Error && error.message
          ? error.message
          : 'Impossible de contacter Claude. Vérifiez votre connexion.'
      setPredictionResult(`⚠️ ${msg}`)
    } finally {
      setPredictionLoading(false)
    }
  }

  const sendChatMessage = async (
    presetMessage?: string,
    attachment?: { name: string; mediaType: string; data: string } | null,
  ) => {
    const message = (presetMessage ?? chatInput).trim()
    if (!message || !cashAiReady || chatLoading) return

    // Historique affiché/stocké : texte seul (la pièce jointe est signalée par
    // son nom). Elle n'est transmise au modèle que pour ce tour-ci.
    const displayContent = attachment ? `📎 ${attachment.name}\n${message}` : message
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: displayContent }]
    const lastApiContent = attachment
      ? [
          attachment.mediaType === 'application/pdf'
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: attachment.data } }
            : { type: 'image', source: { type: 'base64', media_type: attachment.mediaType, data: attachment.data } },
          { type: 'text', text: message },
        ]
      : message
    const apiMessages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [
      ...chatMessages,
      { role: 'user', content: lastApiContent },
    ]
    // Timestamp réel de l'action utilisateur (handler, pas du render).
    // eslint-disable-next-line react-hooks/purity
    updateChatThreadActivity(activeChatThread.id, Date.now())
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    try {
      const reply = await callCashModel({
        apiKey: anthropicKey || undefined,
        system: buildFinancialContext(),
        maxTokens: 1024,
        messages: apiMessages as Array<{ role: 'user' | 'assistant'; content: unknown }>,
      })
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply || '…' }])
    } catch (error) {
      const msg =
        error instanceof Error && error.message
          ? error.message
          : 'Impossible de contacter Cash. Vérifiez votre connexion.'
      setChatMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }])
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      chatInputRef.current?.focus()
    }
    const timer = window.setTimeout(updateChatScrollHints, 350)
    return () => window.clearTimeout(timer)
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const raw = window.localStorage.getItem(chatThreadScopeKey)
    const fallback = [DEFAULT_CHAT_THREAD]

    if (!raw) {
      // Chargement initial des fils de discussion depuis localStorage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChatThreads(fallback)
      setChatThreadId(DEFAULT_CHAT_THREAD.id)
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
      chatThreadScopeReadyRef.current = chatThreadScopeKey
    } catch {
      setChatThreads(fallback)
      setChatThreadId(DEFAULT_CHAT_THREAD.id)
      chatThreadScopeReadyRef.current = chatThreadScopeKey
    }
  }, [chatThreadScopeKey])

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
    // Reset de l'UI de confirmation au changement de contexte de conversation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // Reset de l'état d'annulation au changement de section.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetChatUndoState()
  }, [activeSectionId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!isAuthenticated || !cashAiReady) {
      // Chargement/purge de l'historique de chat depuis localStorage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [cashAiReady, chatHistoryStorageKey, isAuthenticated])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!isAuthenticated || !cashAiReady) {
      return
    }

    if (chatHistoryReadyKeyRef.current !== chatHistoryStorageKey) {
      return
    }

    window.localStorage.setItem(chatHistoryStorageKey, JSON.stringify(chatMessages))
  }, [cashAiReady, chatHistoryStorageKey, chatMessages, isAuthenticated])

  useEffect(() => {
    const initializeSecurity = async () => {
      const loaded = await loadSensitiveState()
      setSensitiveState(loaded)
      setStoredCsvMappings(loadStoredCsvMappings())
      setSettingsForm((previous) => ({
        ...previous,
        sessionDurationDays: String(loaded.sessionDurationDays),
      }))

      // NB : l'ancienne « session locale » (persistedSession) n'authentifie
      // plus — Supabase est l'unique source de vérité (cf. onAuthStateChange).
      setIsSecurityReady(true)
    }

    void initializeSecurity()
  }, [])

  // ── Synchronisation cloud ─────────────────────────────────────
  // Au login : fusion local↔distant puis convergence. Ensuite : push debouncé
  // à chaque modification. Réfs pour éviter les courses (état au moment T).
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle')
  const cloudSyncReadyRef = useRef(false)
  const cloudPushTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      cloudSyncReadyRef.current = false
      // Reset du statut à la déconnexion (état piloté par événement).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCloudSyncStatus('idle')
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user.id
      if (!userId || cancelled) return
      setCloudSyncStatus('syncing')
      const report = await syncWithCloud(userId, accounts, transactions, defaultProfileId)
      if (cancelled) return
      if (!report.ok) {
        setCloudSyncStatus('error')
        return
      }
      if (report.transactions && report.transactions.addedFromRemote > 0) {
        setTransactions(report.transactions.merged)
      }
      if (report.accounts && report.accounts.addedFromRemote > 0) {
        setAccounts(report.accounts.merged)
      }
      cloudSyncReadyRef.current = true
      setCloudSyncStatus('ok')
      const recovered = (report.transactions?.addedFromRemote ?? 0)
      if (recovered > 0) {
        showToast(`☁️ ${recovered} opération${recovered > 1 ? 's' : ''} récupérée${recovered > 1 ? 's' : ''} depuis le cloud`)
      }
    })()
    return () => {
      cancelled = true
    }
    // Volontairement déclenché sur le seul login : l'état local du moment sert
    // de base à la fusion ; les changements suivants passent par le push.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  useEffect(() => {
    if (!cloudSyncReadyRef.current || !isAuthenticated) return
    if (cloudPushTimerRef.current !== null) window.clearTimeout(cloudPushTimerRef.current)
    cloudPushTimerRef.current = window.setTimeout(() => {
      cloudPushTimerRef.current = null
      setCloudSyncStatus('syncing')
      void pushToCloud(accounts, transactions).then((result) => {
        setCloudSyncStatus(result.ok ? 'ok' : 'error')
      })
    }, 2500)
    return () => {
      if (cloudPushTimerRef.current !== null) {
        window.clearTimeout(cloudPushTimerRef.current)
        cloudPushTimerRef.current = null
      }
    }
  }, [transactions, accounts, isAuthenticated])

  // Chargement des infos famille au login (pairs + invitations en attente).
  const refreshFamily = async () => {
    const [peers, invites, sent, session] = await Promise.all([
      listFamilyPeers(),
      listPendingInvites(),
      listSentInvites(),
      supabase.auth.getSession(),
    ])
    setFamilyPeers(peers)
    setPendingInvites(invites)
    setSentInvites(sent)
    setMyUserId(session.data.session?.user.id ?? '')
  }

  const RELANCE_COOLDOWN_MS = 24 * 60 * 60 * 1000
  const relanceKey = (membershipId: string) => `plan-financier-relance-${membershipId}`
  // Disponibilité des relances, calculée hors rendu (horloge + localStorage) et
  // rafraîchie via relanceTick après chaque relance.
  const relanceInfo = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    return new Map(
      sentInvites.map((invite) => {
        const raw = window.localStorage.getItem(relanceKey(invite.membershipId))
        const availableAt = (raw ? Number(raw) : 0) + RELANCE_COOLDOWN_MS
        return [
          invite.membershipId,
          {
            canRelance: now >= availableAt,
            hoursLeft: Math.max(1, Math.ceil((availableAt - now) / 3_600_000)),
          },
        ] as const
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentInvites, relanceTick])

  const handleResendInvite = async (invite: SentInvite) => {
    if (blockInDemo('les invitations famille')) return
    if (inviteBusy) return
    setInviteBusy(true)
    setInviteFeedback(null)
    try {
      const { data, error } = await supabase.functions.invoke('invite-family-member', {
        body: { email: invite.email, action: 'resend' },
      })
      if (error || !data?.ok) {
        setInviteFeedback({ kind: 'error', text: `La relance vers ${invite.email} a échoué — réessayez plus tard.` })
      } else if (data.outcome === 'already_active') {
        setInviteFeedback({
          kind: 'ok',
          text: `${invite.email} a déjà activé son compte : l'invitation l'attend à sa prochaine connexion (aucun email renvoyé).`,
        })
      } else {
        window.localStorage.setItem(relanceKey(invite.membershipId), String(Date.now()))
        setRelanceTick((tick) => tick + 1)
        setInviteFeedback({ kind: 'ok', text: `📨 Invitation renvoyée à ${invite.email}.` })
        showToast(`📨 Relance envoyée à ${invite.email}`)
        await refreshFamily()
      }
    } catch {
      setInviteFeedback({ kind: 'error', text: 'La relance a échoué (fonction indisponible).' })
    } finally {
      setInviteBusy(false)
    }
  }

  const handleCancelInvite = async (invite: SentInvite) => {
    if (blockInDemo('les invitations famille')) return
    const ok = await cancelSentInvite(invite.membershipId)
    if (ok) {
      showToast(`Invitation de ${invite.email} annulée`)
      await refreshFamily()
    } else {
      setInviteFeedback({ kind: 'error', text: "L'annulation a échoué — réessayez." })
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      // Reset des données famille à la déconnexion.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFamilyPeers([])
      setPendingInvites([])
      return
    }
    void refreshFamily()
    void getReportPrefs().then((prefs) => {
      setReportPrefs(prefs)
      setReportCcDraft(prefs.ccEmails.join(', '))
    })
  }, [isAuthenticated])

  const handleReportPrefsChange = async (
    patch: Partial<Pick<ReportPrefs, 'frequency' | 'format' | 'attachment' | 'ccEmails'>>,
  ) => {
    if (blockInDemo('les rapports par email')) return
    if ((patch.frequency ?? reportPrefs.frequency) !== 'none' && requirePremium('les rapports par email')) return
    const next = {
      frequency: reportPrefs.frequency,
      format: reportPrefs.format,
      attachment: reportPrefs.attachment,
      ccEmails: reportPrefs.ccEmails,
      ...patch,
    }
    setReportPrefs((previous) => ({ ...previous, ...patch }))
    setReportFeedback(null)
    const ok = await saveReportPrefs(next)
    if (ok) {
      showToast(next.frequency === 'none' ? 'Rapport automatique désactivé' : '📧 Préférences de rapport enregistrées')
    } else {
      setReportFeedback({ kind: 'error', text: "Impossible d'enregistrer (les migrations 0005 et 0006 sont-elles appliquées ?)." })
    }
  }

  const handleReportCcCommit = (raw: string) => {
    const { valid, invalid } = parseCcEmails(raw)
    setReportCcDraft(valid.join(', '))
    if (invalid.length > 0) {
      setReportFeedback({
        kind: 'error',
        text: `Adresse${invalid.length > 1 ? 's' : ''} ignorée${invalid.length > 1 ? 's' : ''} : ${invalid.join(', ')}`,
      })
    }
    const unchanged =
      valid.length === reportPrefs.ccEmails.length && valid.every((e, i) => reportPrefs.ccEmails[i] === e)
    if (!unchanged) void handleReportPrefsChange({ ccEmails: valid })
  }

  const handleSendTestReport = async () => {
    if (blockInDemo('l\u2019envoi de rapports par email')) return
    if (reportBusy) return
    setReportBusy(true)
    setReportFeedback(null)
    const result = await sendTestReport()
    if (result.ok) {
      showToast(`✅ Rapport envoyé à ${userEmail} — vérifiez votre boîte mail.`)
    } else {
      setReportFeedback({
        kind: 'error',
        text: result.detail
          ? `L'envoi a échoué : ${result.detail}`
          : "L'envoi a échoué (fonction send-report déployée ? clé Resend configurée ?).",
      })
    }
    setReportBusy(false)
  }

  const handleSendFamilyInvite = async () => {
    if (blockInDemo('les invitations famille')) return
    const email = inviteEmail.trim().toLowerCase()
    if (!email || inviteBusy) return
    setInviteBusy(true)
    setInviteFeedback(null)
    try {
      const { data, error } = await supabase.functions.invoke('invite-family-member', {
        body: { email },
      })
      if (error || !data?.ok) {
        // La fonction renvoie { error, detail } dans le corps même en 4xx/5xx :
        // on le lit pour afficher la vraie cause au lieu d'un message générique.
        let detail = ''
        const context = (error as { context?: Response } | null)?.context
        if (context && typeof context.json === 'function') {
          try {
            const body = (await context.json()) as { error?: string; detail?: string }
            detail = [body.error, body.detail].filter(Boolean).join(' — ')
          } catch {
            /* corps illisible */
          }
        }
        setInviteFeedback({
          kind: 'error',
          text: detail
            ? `L'invitation n'a pas pu partir : ${detail}`
            : "L'invitation n'a pas pu partir. Vérifiez l'adresse, ou réessayez plus tard.",
        })
      } else if (data.outcome === 'invited_new_user') {
        setInviteFeedback({
          kind: 'ok',
          text: `✅ Invitation envoyée à ${email} — cette personne va recevoir un email pour créer son compte.`,
        })
        showToast(`📨 Invitation envoyée à ${email}`)
        setInviteEmail('')
      } else {
        setInviteFeedback({
          kind: 'ok',
          text: `✅ ${email} a déjà un compte : l'invitation lui sera proposée à sa prochaine connexion.`,
        })
        showToast(`🤝 ${email} sera invité·e à sa prochaine connexion`)
        setInviteEmail('')
      }
    } catch {
      setInviteFeedback({
        kind: 'error',
        text: "L'invitation n'a pas pu partir (la fonction invite-family-member est-elle déployée ?).",
      })
    } finally {
      setInviteBusy(false)
    }
  }

  const handleAcceptInvite = async (invite: FamilyInvite) => {
    const ok = await acceptInvite(invite.membershipId)
    if (ok) {
      showToast(`Bienvenue dans « ${invite.groupName} » 👨‍👩‍👧`)
      await refreshFamily()
    } else {
      showToast('Impossible d\'accepter l\'invitation — réessayez.', 'danger')
    }
  }

  // ── Theme ─────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette)
    window.localStorage.setItem(PALETTE_STORAGE_KEY, palette)
  }, [palette])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-textsize', a11yPrefs.textSize)
    if (a11yPrefs.reduceMotion) root.setAttribute('data-reduce-motion', '1')
    else root.removeAttribute('data-reduce-motion')
    if (a11yPrefs.highContrast) root.setAttribute('data-contrast', 'high')
    else root.removeAttribute('data-contrast')
    window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(a11yPrefs))
  }, [a11yPrefs])

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_WIDGETS_STORAGE_KEY, JSON.stringify(dashboardWidgetState))
  }, [dashboardWidgetState])

  // ── Supabase auth listener ────────────────────────────────────
  useEffect(() => {
    // Hydrate la session existante (cookie/storage) au premier mount
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session)
      setUserEmail(data.session?.user.email ?? '')
      setAccountCreatedAt(data.session?.user.created_at ?? null)
      setAuthProviderReady(true)
    })
    // Puis écoute les changements (signin/signout/refresh)
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
      setUserEmail(session?.user.email ?? '')
      setAccountCreatedAt(session?.user.created_at ?? null)
      setAuthProviderReady(true)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (demoMode) return
    window.localStorage.setItem(
      TRANSACTIONS_STORAGE_KEY,
      JSON.stringify(transactions),
    )
  }, [transactions, demoMode])

  // Persistance des règles récurrentes (localStorage v1, mappable Supabase plus tard)
  useEffect(() => {
    if (demoMode) return
    saveRecurringRules(recurringRules)
  }, [recurringRules, demoMode])

  // Persistance des comptes
  useEffect(() => {
    if (demoMode) return
    saveAccounts(accounts)
  }, [accounts, demoMode])

  // Migration : transactions sans accountId → compte courant par défaut
  // Auto-stable : après migration toutes les transactions ont un accountId,
  // donc l'effet ne déclenche plus rien.
  useEffect(() => {
    const hasOrphans = transactions.some((t) => !t.accountId)
    if (!hasOrphans) return
    const result = migrateTransactionsToDefaultAccount(transactions, accounts)
    if (result.changed) {
      // Migration one-shot auto-stabilisante (cf. commentaire ci-dessus).
      // Mise à jour fonctionnelle : au montage, cet effet s'exécute dans le
      // même lot qu'enterDemoMode (/demo) ; une valeur brute écraserait les
      // opérations de démo fraîchement posées avec l'état initial migré.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTransactions((previous) => {
        const migrated = migrateTransactionsToDefaultAccount(previous, accounts)
        return migrated.changed ? migrated.transactions : previous
      })
      setAccounts(result.accounts)
    }
  }, [transactions, accounts])

  // Garantit un compte courant par défaut pour le profil actif (utile pour
  // les nouveaux profils qui n'ont aucune transaction historique).
  useEffect(() => {
    const result = ensureDefaultAccount(accounts, selectedProfileId)
    if (result.accounts !== accounts) {
      // Garantit un compte par défaut, auto-stabilisant.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccounts(result.accounts)
    }
  }, [selectedProfileId, accounts])

  // Génération idempotente des transactions dues depuis les règles récurrentes.
  // Re-run safe : si lastGeneratedOn est à jour, generateDueTransactions ne
  // produit rien et on n'appelle pas setState → pas de boucle.
  useEffect(() => {
    if (recurringRules.length === 0) return
    const today = new Date().toISOString().slice(0, 10)
    let counter = Date.now()
    const generated: Transaction[] = []
    const updatedRules = recurringRules.map((rule) => {
      const result = generateDueTransactions(rule, today, () => counter++)
      if (result.transactions.length === 0) return rule
      generated.push(...result.transactions)
      return { ...rule, lastGeneratedOn: result.lastGeneratedOn, updatedAt: Date.now() }
    })
    if (generated.length === 0) return
    // Génération idempotente des échéances récurrentes (cf. commentaire ci-dessus).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransactions((previous) => [...previous, ...generated])
    setRecurringRules(updatedRules)
  }, [recurringRules])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (demoMode) return
    window.localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(savingsGoals))
  }, [savingsGoals, demoMode])

  useEffect(() => {
    if (demoMode) return
    saveProfiles(profiles)
  }, [profiles, demoMode])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (demoMode) return
    window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, selectedProfileId)
  }, [selectedProfileId, demoMode])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (demoMode) return
    window.localStorage.setItem(DEFAULT_PROFILE_STORAGE_KEY, defaultProfileId)
  }, [defaultProfileId, demoMode])

  useEffect(() => {
    if (profiles.some((profile) => profile.id === selectedMember)) {
      return
    }

    // Réinitialise une sélection de membre devenue invalide.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedMember(profiles[0]?.id ?? defaultProfile.id)
  }, [profiles, selectedMember])

  useEffect(() => {
    if (profiles.some((profile) => profile.id === defaultProfileId)) {
      return
    }

    // Réinitialise le profil par défaut devenu invalide.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

    // Synchronise le formulaire de gestion au profil sélectionné (guardé pour
    // ne pas écraser une saisie en cours — cf. égalité ci-dessus).
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

    if (demoMode) return
    window.localStorage.setItem(ROLLOVER_STORAGE_KEY, JSON.stringify(rolloverState))
  }, [rolloverState, demoMode])

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

    // Snapshot du report budgétaire au passage d'un mois à l'autre (guardé par
    // l'égalité de mois ci-dessus : ne se déclenche qu'une fois par bascule).
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // Le mois de budget prime sur le mois de la date : une dépense imputée
    // à septembre compte dans les stats de septembre, même payée en août.
    () => filteredTransactions.filter((item) => (item.budgetMonth ?? item.date.slice(0, 7)) === selectedMonth),
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

  // Notification du franchissement de seuil budget (80% / 100% / 120%).
  // Idempotent : on track la dernière notif (mois + profil + niveau) via ref
  // pour ne déclencher le toast qu'au passage haut, jamais à chaque render.
  // Au premier mount d'un nouveau mois/profil, on initialise sans toast
  // (sinon spam de l'utilisateur qui ouvre l'app à mi-mois déjà à 90 %).
  useEffect(() => {
    if (budget <= 0) return
    const periodKey = `${currentMonth}-${selectedProfileId}`
    const currentLevel =
      usageRateRaw >= 120 ? 120 : usageRateRaw >= 100 ? 100 : usageRateRaw >= 80 ? 80 : 0

    const previous = lastBudgetThresholdRef.current
    if (!previous || previous.key !== periodKey) {
      // Init silencieuse au premier mount pour ce mois/profil
      lastBudgetThresholdRef.current = { key: periodKey, level: currentLevel }
      return
    }

    if (currentLevel > previous.level) {
      // Franchissement haut → toast (notification au franchissement de seuil,
      // guardé par lastBudgetThresholdRef pour ne notifier qu'une fois).
      if (currentLevel === 120) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        showToast(
          `⚠️ Budget dépassé de ${Math.round(usageRateRaw - 100)} %. Pensez à ajuster vos prochaines dépenses.`,
          'danger',
        )
      } else if (currentLevel === 100) {
        showToast('⚠️ Budget atteint à 100 %. Toute dépense supplémentaire creuse le mois.', 'danger')
      } else if (currentLevel === 80) {
        showToast(
          `💡 Vous avez consommé 80 % du budget mensuel — il reste ${euroFormatter.format(Math.max(0, remaining))}.`,
          'warning',
        )
      }
    }
    // Que le franchissement soit haut ou bas, on update pour permettre
    // une re-notification en cas de re-franchissement futur.
    lastBudgetThresholdRef.current = { key: periodKey, level: currentLevel }
  }, [monthlyExpense, budget, currentMonth, selectedProfileId, remaining, usageRateRaw])
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

  const budgetInsights = useMemo(() => {
    const insights: string[] = []
    // La projection fin de mois est déjà affichée dans le bloc « Santé budget » :
    // on ne la répète pas ici pour éviter le doublon.
    if (depenseChangePercent !== null) {
      insights.push(
        depenseChangePercent > 0
          ? `Dépenses en hausse de ${depenseChangePercent.toFixed(0)}% vs mois dernier.`
          : `Dépenses en baisse de ${Math.abs(depenseChangePercent).toFixed(0)}% vs mois dernier.`,
      )
    }
    if (remaining < 0) insights.push('Le budget est dépassé: prioriser les postes non essentiels.')
    return insights.slice(0, 3)
  }, [depenseChangePercent, remaining])

  // ── Dérivés de l'Accueil (hero « reste à dépenser ») ──────────────────
  const daysLeftInMonth = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    if (selectedMonth !== currentMonth) return daysInMonth
    const today = Number(new Date().toISOString().slice(8, 10))
    return Math.max(1, daysInMonth - today + 1)
  }, [selectedMonth, currentMonth])
  const dailyAllowance = Math.max(0, remaining) / daysLeftInMonth
  const recentTransactions = useMemo(
    () => [...activeMonthTransactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [activeMonthTransactions],
  )
  // Bilan du mois affiché vs mois précédent (carte Accueil).
  const monthSummary = useMemo(() => {
    const previousMonth = shiftMonth(selectedMonth, -1)
    const inMonth = (month: string) => activeTransactions.filter((t) => t.date.startsWith(month))
    const sum = (list: Transaction[], kind: TransactionKind) =>
      list.filter((t) => t.kind === kind).reduce((total, t) => total + t.amount, 0)
    const current = inMonth(selectedMonth)
    const spent = sum(current, 'depense')
    const income = sum(current, 'revenu')
    const previousSpent = sum(inMonth(previousMonth), 'depense')
    const byCategory = new Map<Category, number>()
    current
      .filter((t) => t.kind === 'depense')
      .forEach((t) => byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount))
    const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    return { spent, income, previousSpent, delta: spent - previousSpent, topCategories }
  }, [activeTransactions, selectedMonth])

  const primarySavingsTarget = savingsTargets[0] ?? null
  const primarySavingsProgress = primarySavingsTarget
    ? Math.min(100, Math.round(((primarySavingsTarget.currentSaved ?? 0) / primarySavingsTarget.targetAmount) * 100))
    : 0

  const budgetSeriesColors = {
    revenus: '#22c55e',
    depenses: '#f97316',
    net: '#38bdf8',
  } as const

  // Calcul de l'état du budget
  const budgetStatusColor = remaining < 0 ? '#f43f5e' : usageRate >= 85 ? '#f59e0b' : '#22c55e'
  const budgetStatusLabel = remaining < 0 ? 'Dépassé' : usageRate >= 85 ? 'Attention' : 'Normal'


  const budgetAssistantContextKey = useMemo(
    () => [
      selectedProfileId,
      selectedMonth,
      Math.round(monthlyExpense),
      Math.round(monthlyIncome),
      Math.round(remaining),
      Math.round(usageRate),
      ['budget', 'stats', 'operations'].includes(activeSectionId) ? activeSectionId : 'general',
    ].join('|'),
    [activeSectionId, monthlyExpense, monthlyIncome, remaining, selectedMonth, selectedProfileId, usageRate],
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
          item.label.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
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


  const monthlyNet = monthlyIncome - monthlyExpense

  useEffect(() => {
    if (demoMode) return
    try {
      window.localStorage.setItem(ENVELOPE_BUDGETS_STORAGE_KEY, JSON.stringify(envelopeBudgets))
    } catch {
      /* stockage plein/indisponible : silencieux */
    }
  }, [envelopeBudgets, demoMode])

  useEffect(() => {
    if (demoMode) return
    try {
      window.localStorage.setItem(ENVELOPE_FUNDS_STORAGE_KEY, JSON.stringify(envelopeFunds))
    } catch {
      /* stockage indisponible : silencieux */
    }
  }, [envelopeFunds, demoMode])

  const profileEnvelopeBudgets = envelopeBudgets[selectedProfileId] ?? {}
  const profileEnvelopeFunds = envelopeFunds[selectedProfileId] ?? {}

  useEffect(() => {
    if (demoMode) return
    try {
      window.localStorage.setItem(CUSTOM_ENVELOPES_STORAGE_KEY, JSON.stringify(customEnvelopes))
    } catch {
      /* stockage indisponible : silencieux */
    }
  }, [customEnvelopes, demoMode])

  const profileCustomEnvelopes = customEnvelopes[selectedProfileId] ?? []

  /** Clic sur une poche : rabat qui s'ouvre, puis modale de gestion. */
  const openEnvelopeModal = (name: string) => {
    setEnvelopeOpenName(name)
    setEnvModalName(name)
    setEnvModalTarget(profileEnvelopeBudgets[name] ? String(profileEnvelopeBudgets[name]) : '')
    const inside = envelopeCards.find((card) => card.name === name)?.inside ?? 0
    setEnvModalAdd(String(Math.round(inside * 100) / 100))
    setEnvModalDeleteAsk(false)
    window.setTimeout(() => setEnvelopeModal({ mode: 'edit', name }), 340)
  }

  const closeEnvelopeModal = () => {
    setEnvelopeModal(null)
    setEnvelopeOpenName(null)
    setEnvModalDeleteAsk(false)
  }

  /** Bloc Conseils de Cash — partagé entre les vues (Accueil, Budget, Stats, Dépenses, Famille). */
  const renderCashAdvice = () => (
    <>
        {!isBudgetAiConfigured ? (
          <>
            <div className="budget-assistant-title-row">
              <div className="budget-assistant-title-main">
                <p className="eyebrow">Assistant IA</p>
              </div>
            </div>
            <p className="budget-advice-helper">
              <strong>Assistant IA non configuré.</strong>
              <br />
              Activez votre fournisseur IA dans les paramètres pour débloquer les analyses
              automatiques et le coaching avancé.
            </p>
            <button type="button" className="hero-cta-button" onClick={() => openSettingsPanel('ai')}>
              Configurer l&apos;IA
            </button>
          </>
        ) : (
          <>
            <div className="budget-assistant-title-row">
              <div className="budget-assistant-title-main">
                <p className="eyebrow">Conseils</p>
                <span className="budget-assistant-ai-tag">
                  <Bot size={12} /> Cash · IA
                </span>
              </div>
            </div>
            <p className="budget-advice-helper">
              {activeSectionId === 'budget'
                ? 'Cash analyse votre budget, vos poches et vos plafonds.'
                : activeSectionId === 'stats'
                ? 'Cash analyse vos semaines et leurs tendances.'
                : activeSectionId === 'operations'
                ? 'Cash analyse vos dépenses du mois.'
                : 'Cash analyse votre mois en cours et vous conseille.'}
            </p>
            {budgetAssistantError ? (
              <>
                <p className="budget-assistant-error">{budgetAssistantError}</p>
                <ul className="alert-list coaching-list overview-coaching-list">
                  {coachingTips.slice(0, 3).map((tip) => (
                    <li key={tip}>
                      <Brain size={15} />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : budgetAssistantLoading || !budgetAssistantAdvice ? (
              <div className="budget-assistant-skeleton" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            ) : (
              <p className="budget-assistant-answer">{budgetAssistantAdvice}</p>
            )}
          </>
        )}
    </>
  )

  const createEnvelope = (rawName: string) => {
    const name = rawName.trim().slice(0, 40)
    if (!name) return
    // Plan Découverte : les 3 poches de base seulement.
    if (requirePremium('les poches personnalisées')) return
    const exists = [...envelopes, ...profileCustomEnvelopes].some(
      (existing) => existing.toLowerCase() === name.toLowerCase(),
    )
    if (exists) {
      showToast('Cette poche existe déjà', 'danger')
      return
    }
    setCustomEnvelopes((previous) => ({
      ...previous,
      [selectedProfileId]: [...(previous[selectedProfileId] ?? []), name],
    }))
    const target = Number(envModalTarget)
    if (target > 0) saveEnvelopeBudget(name, target)
    const available = Number(envModalAdd.replace(',', '.'))
    if (available > 0) {
      setEnvelopeFunds((previous) => ({
        ...previous,
        [selectedProfileId]: { ...(previous[selectedProfileId] ?? {}), [name]: Math.round(available * 100) / 100 },
      }))
    }
    showToast(`✉️ Poche « ${name} » créée`)
    closeEnvelopeModal()
  }

  /** Modale poche (édition) : enregistre objectif, disponible et renommage. */
  const saveEnvelopeModal = () => {
    if (!envelopeModal) return
    const target = Number(envModalTarget)
    saveEnvelopeBudget(envelopeModal.name, Number.isNaN(target) ? 0 : target)
    const available = Number(envModalAdd.replace(',', '.'))
    if (!Number.isNaN(available)) {
      setEnvelopeAvailable(envelopeModal.name, available)
    }
    if (envModalName.trim() && envModalName.trim() !== envelopeModal.name) {
      renameEnvelope(envelopeModal.name, envModalName)
    } else {
      showToast(`✉️ Poche ${envelopeModal.name} mise à jour`)
      closeEnvelopeModal()
    }
  }

  const renameEnvelope = (oldName: string, rawNext: string) => {
    const next = rawNext.trim().slice(0, 40)
    if (!next || next === oldName) return
    // Remap partout : poches perso, objectifs, fonds, transactions, règles.
    setCustomEnvelopes((previous) => ({
      ...previous,
      [selectedProfileId]: [
        ...(previous[selectedProfileId] ?? []).filter((n) => n !== oldName && n !== next),
        next,
      ],
    }))
    setEnvelopeBudgets((previous) => {
      const forProfile = { ...(previous[selectedProfileId] ?? {}) }
      if (forProfile[oldName] !== undefined) {
        forProfile[next] = forProfile[oldName]
        delete forProfile[oldName]
      }
      return { ...previous, [selectedProfileId]: forProfile }
    })
    setEnvelopeFunds((previous) => {
      const forProfile = { ...(previous[selectedProfileId] ?? {}) }
      if (forProfile[oldName] !== undefined) {
        forProfile[next] = (forProfile[next] ?? 0) + forProfile[oldName]
        delete forProfile[oldName]
      }
      return { ...previous, [selectedProfileId]: forProfile }
    })
    setTransactions((previous) =>
      previous.map((tx) => (tx.member === selectedProfileId && tx.envelope === oldName ? { ...tx, envelope: next } : tx)),
    )
    setRecurringRules((previous) =>
      previous.map((rule) =>
        rule.member === selectedProfileId && rule.envelope === oldName ? { ...rule, envelope: next, updatedAt: Date.now() } : rule,
      ),
    )
    showToast(`✉️ Poche renommée en « ${next} »`)
    closeEnvelopeModal()
  }

  const deleteEnvelope = (name: string) => {
    if (name === 'Perso') {
      showToast('La poche Perso sert de repli — elle ne peut pas être supprimée.', 'danger')
      return
    }
    setCustomEnvelopes((previous) => ({
      ...previous,
      [selectedProfileId]: (previous[selectedProfileId] ?? []).filter((n) => n !== name),
    }))
    setEnvelopeBudgets((previous) => {
      const forProfile = { ...(previous[selectedProfileId] ?? {}) }
      delete forProfile[name]
      return { ...previous, [selectedProfileId]: forProfile }
    })
    setEnvelopeFunds((previous) => {
      const forProfile = { ...(previous[selectedProfileId] ?? {}) }
      delete forProfile[name]
      return { ...previous, [selectedProfileId]: forProfile }
    })
    setTransactions((previous) =>
      previous.map((tx) => (tx.member === selectedProfileId && tx.envelope === name ? { ...tx, envelope: 'Perso' } : tx)),
    )
    setRecurringRules((previous) =>
      previous.map((rule) =>
        rule.member === selectedProfileId && rule.envelope === name ? { ...rule, envelope: 'Perso', updatedAt: Date.now() } : rule,
      ),
    )
    showToast(`Poche « ${name} » supprimée — ses opérations passent dans Perso`)
    closeEnvelopeModal()
  }

  /** Fixe l'argent DISPONIBLE d'une poche (le fonds est recalculé : dispo + dépensé du mois). */
  const setEnvelopeAvailable = (name: string, availableTarget: number) => {
    const spent = envelopeCards.find((card) => card.name === name)?.spent ?? 0
    const fund = Math.max(0, Math.round((availableTarget + spent) * 100) / 100)
    setEnvelopeFunds((previous) => {
      const forProfile = { ...(previous[selectedProfileId] ?? {}) }
      if (fund > 0) forProfile[name] = fund
      else delete forProfile[name]
      return { ...previous, [selectedProfileId]: forProfile }
    })
  }

  const saveEnvelopeBudget = (name: string, value: number) => {
    setEnvelopeBudgets((previous) => {
      const forProfile = { ...(previous[selectedProfileId] ?? {}) }
      if (value > 0) forProfile[name] = Math.round(value)
      else delete forProfile[name]
      return { ...previous, [selectedProfileId]: forProfile }
    })
  }

  // Cartes enveloppes : dépensé du mois + objectif + météo.
  const envelopeCards = useMemo(() => {
    const spentBy = new Map<string, number>()
    for (const tx of activeMonthTransactions) {
      if (tx.kind !== 'depense') continue
      spentBy.set(tx.envelope, (spentBy.get(tx.envelope) ?? 0) + tx.amount)
    }
    const names = new Set<string>([...envelopes, ...profileCustomEnvelopes, ...Object.keys(profileEnvelopeBudgets), ...spentBy.keys()])
    return [...names]
      .map((name) => {
        const spent = spentBy.get(name) ?? 0
        const target = profileEnvelopeBudgets[name] ?? 0
        const fund = profileEnvelopeFunds[name] ?? 0
        const ratio = target > 0 ? spent / target : null
        const weather =
          ratio === null
            ? { icon: '🌤️', label: "Pas d'objectif — définissez-en un !", tone: 'none' as const }
            : ratio <= 0.7
            ? { icon: '☀️', label: 'Grand beau — tout va bien', tone: 'sun' as const }
            : ratio <= 0.9
            ? { icon: '⛅', label: 'Ça se couvre — surveillez', tone: 'cloud' as const }
            : ratio <= 1
            ? { icon: '🌧️', label: 'Pluie — la limite approche', tone: 'rain' as const }
            : { icon: '⛈️', label: 'Orage — objectif dépassé !', tone: 'storm' as const }
        return { name, spent, target, fund, inside: fund - spent, ratio, weather }
      })
      .sort((a, b) => b.spent - a.spent)
  }, [activeMonthTransactions, profileEnvelopeBudgets, profileEnvelopeFunds, profileCustomEnvelopes])

  // Groupes de poches pour la modale d'opération : les poches créées par
  // l'utilisateur apparaissent en tête, dans un groupe « Mes poches ».
  const envelopeGroupsWithCustom = useMemo(
    () => [{ label: 'Mes poches', options: envelopeCards.map((card) => card.name) }],
    [envelopeCards],
  )

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
      if (goal.target <= 0) return
      if (goal.spent > goal.target) {
        alerts.push({
          message: `${goal.category} : ${Math.round(goal.spent)} € dépensés — budget de ${Math.round(goal.target)} € dépassé.`,
          level: 'danger',
        })
      } else if (goal.rate >= 85) {
        alerts.push({
          message: `${goal.category} : ${Math.round(goal.spent)} € sur ${Math.round(goal.target)} € (${goal.rate.toFixed(0)}%).`,
          level: 'warning',
        })
      }
    })

    return alerts.slice(0, 5)
  }, [activeMonthTransactions, envelopeBreakdown, goalProgress, monthlyExpense, usageRate])

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
      tips.push('Ce mois-ci, vous dépensez plus que vous ne gagnez. Réduisez une dépense souple (loisirs, sorties) avant la fin du mois.')
    }

    if (maisonTotal > budget * 0.35) {
      tips.push('La maison représente une grosse part de votre budget. Jetez un œil aux factures et aux courses.')
    }

    if (vacancesTotal > 120) {
      tips.push('Les dépenses loisirs et vacances grimpent vite. Fixez-vous un petit plafond par semaine pour les lisser.')
    }

    if (hottestGoal && hottestGoal.rate > 90) {
      tips.push(`Vous approchez du plafond prévu pour ${hottestGoal.category}. Si c'est une priorité, augmentez-le ou réduisez ailleurs.`)
    }

    if (tips.length === 0) {
      tips.push('Tout va bien ce mois-ci 👍 Vous pouvez mettre le surplus de côté ou le diriger vers un projet.')
    }

    return tips.slice(0, 3)
  }, [budget, envelopeBreakdown, goalProgress, monthlyNet])

  // ── Rail latéral de la vue Dépenses (échéances, top dépenses, tags) ──
  const upcomingCharges = useMemo(() => {
    // Uniquement la semaine PROCHAINE (lundi → dimanche suivants).
    const nextMonday = shiftDay(mondayOf(todayIso), 7)
    const nextSunday = shiftDay(nextMonday, 6)
    const materialized = new Set(
      activeTransactions.filter((t) => t.recurringRuleId).map((t) => `${t.recurringRuleId}|${t.date}`),
    )
    const items: Array<{ date: string; label: string; amount: number; kind: TransactionKind; category: Category }> = []
    for (const rule of recurringRules) {
      if (rule.pausedAt !== null || rule.member !== selectedProfileId) continue
      for (const date of getOccurrencesBetween(rule, nextMonday, nextSunday)) {
        if (materialized.has(`${rule.id}|${date}`)) continue
        items.push({ date, label: rule.label, amount: rule.amount, kind: rule.kind, category: rule.category })
      }
    }
    items.sort((a, b) => a.date.localeCompare(b.date))
    const totalSpent = items.reduce((sum, item) => sum + (item.kind === 'depense' ? item.amount : 0), 0)
    const fmt = (iso: string, withMonth: boolean) =>
      new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', ...(withMonth ? { month: 'short' } : {}) })
    const sameMonth = nextMonday.slice(0, 7) === nextSunday.slice(0, 7)
    const rangeLabel = `${fmt(nextMonday, !sameMonth)} – ${fmt(nextSunday, true)}`
    return { items: items.slice(0, 8), totalSpent, rangeLabel }
  }, [recurringRules, activeTransactions, selectedProfileId, todayIso])

  const topExpensesMonth = useMemo(
    () =>
      activeMonthTransactions
        .filter((t) => t.kind === 'depense')
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [activeMonthTransactions],
  )

  // ── Premiers pas (Accueil) : 3 gestes qui rendent l'app utile ─────────
  const [startChecklistDismissed, setStartChecklistDismissed] = useState(
    () => window.localStorage.getItem(START_CHECKLIST_DONE_KEY) === '1',
  )
  const dismissStartChecklist = () => {
    setStartChecklistDismissed(true)
    if (!demoMode) window.localStorage.setItem(START_CHECKLIST_DONE_KEY, '1')
  }
  const startChecklist = useMemo(() => {
    const hasFixedCharge = recurringRules.some((rule) => rule.member === selectedProfileId && rule.pausedAt === null)
    const funds = envelopeFunds[selectedProfileId] ?? {}
    const targets = envelopeBudgets[selectedProfileId] ?? {}
    const hasPocket = Object.values(funds).some((v) => v > 0) || Object.values(targets).some((v) => v > 0)
    const hasGoal = savingsTargets.some((target) => (target.member ?? selectedProfileId) === selectedProfileId)
    const items = [
      {
        id: 'fixed',
        done: hasFixedCharge,
        title: 'Ajoutez une charge fixe',
        hint: 'Loyer, énergie, abonnement… choisissez « Mensuel » dans Répéter : elle apparaîtra sur le calendrier avant de tomber.',
        action: () => openQuickAdd(todayIso),
      },
      {
        id: 'pocket',
        done: hasPocket,
        title: 'Remplissez une poche',
        hint: 'Mettez un montant dans Courses, Maison ou Vacances : sa météo vous dira où vous en êtes.',
        action: () => navigateToSection('budget'),
      },
      {
        id: 'goal',
        done: hasGoal,
        title: "Fixez un objectif d'épargne",
        hint: 'Même 30 € par mois — c’est le réflexe qui compte, pas le montant.',
        action: () => setShowGoalsPanel(true),
      },
    ]
    const done = items.filter((item) => item.done).length
    return { items, done, visible: !startChecklistDismissed && done < items.length }
  }, [recurringRules, envelopeFunds, envelopeBudgets, savingsTargets, selectedProfileId, startChecklistDismissed, todayIso])

  const topTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const tx of activeMonthTransactions) {
      for (const tag of tx.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [activeMonthTransactions])

  // Vue Statistiques : 12 dernières semaines (lundi → dimanche).
  // weeklyStatsData reste calé sur aujourd'hui (carte Accueil) ; la vue
  // Statistiques navigue avec sa propre ancre.
  const weeklyStatsData = useMemo(
    () => weeklyStats(activeTransactions, todayIso, 12),
    [activeTransactions, todayIso],
  )
  // Mois affiché dans la vue Statistiques (YYYY-MM) + semaine dépliée.
  const [statsMonth, setStatsMonth] = useState(todayIso.slice(0, 7))
  const [statsSelectedWeek, setStatsSelectedWeek] = useState<string | null>(null)
  const statsMonthEnd = useMemo(() => shiftDay(`${shiftMonth(statsMonth, 1)}-01`, -1), [statsMonth])
  const statsViewData = useMemo(
    () => weeklyStats(activeTransactions, statsMonthEnd, 12),
    [activeTransactions, statsMonthEnd],
  )
  // Semaines qui touchent le mois sélectionné (liste « Semaine par semaine »).
  const statsMonthWeeks = useMemo(() => {
    const firstDay = `${statsMonth}-01`
    return statsViewData.filter((week) => week.weekStart <= statsMonthEnd && week.weekEnd >= firstDay)
  }, [statsViewData, statsMonth, statsMonthEnd])
  // Détail quotidien de la semaine sélectionnée (Lun → Dim).
  const statsWeekDaily = useMemo(() => {
    if (!statsSelectedWeek) return null
    return Array.from({ length: 7 }, (_, i) => {
      const date = shiftDay(statsSelectedWeek, i)
      let spent = 0
      let income = 0
      for (const tx of activeTransactions) {
        if (tx.date !== date) continue
        if (tx.kind === 'depense') spent += tx.amount
        else income += tx.amount
      }
      return {
        label: new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        spent: Math.round(spent * 100) / 100,
        income: Math.round(income * 100) / 100,
      }
    })
  }, [statsSelectedWeek, activeTransactions])
  const statsChartRef = useRef<HTMLDivElement | null>(null)

  const exportWeeklyStatsPdf = async (targetWeek?: (typeof statsViewData)[number]) => {
    const svg = statsChartRef.current?.querySelector('svg')
    const lastWeek = targetWeek ?? statsMonthWeeks.at(-1) ?? statsViewData.at(-1)
    if (!svg || !lastWeek) return
    const { default: JsPdf } = await import('jspdf')

    // Graphique SVG → PNG (fond crème charte).
    const xml = new XMLSerializer().serializeToString(svg)
    const blobUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
    const width = svg.clientWidth || Number(svg.getAttribute('width')) || 800
    const height = svg.clientHeight || Number(svg.getAttribute('height')) || 280
    let png: string
    try {
      png = await new Promise<string>((resolve, reject) => {
        const image = new Image()
        image.onload = () => {
          const canvas = window.document.createElement('canvas')
          canvas.width = width * 2
          canvas.height = height * 2
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('canvas'))
          ctx.fillStyle = '#FDFAF6'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/png'))
        }
        image.onerror = () => reject(new Error('svg'))
        image.src = blobUrl
      })
    } catch {
      showToast("Impossible d'exporter le graphique", 'danger')
      return
    } finally {
      URL.revokeObjectURL(blobUrl)
    }

    const doc = new JsPdf({ orientation: 'landscape' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const reportDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    doc.setTextColor(61, 43, 31)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Statistiques hebdomadaires — Plan Financier', 14, 16)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 128, 96)
    doc.text(`Exporté le ${reportDate} · ${selectedProfileName}`, 14, 23)
    doc.text(`Période affichée : du ${statsViewData[0].weekStart} au ${statsViewData.at(-1)!.weekEnd}`, 14, 29)

    // ── Bandeau de statut : l'information clé de l'export ──────────────
    const STATUS: Record<string, { label: string; advice: string; fill: [number, number, number] }> = {
      danger: {
        label: 'DANGER',
        advice: 'Vous avez dépensé plus que reçu cette semaine. Réduisez les dépenses souples (loisirs, sorties) et évitez les gros achats.',
        fill: [192, 92, 42],
      },
      up: {
        label: 'UP — EN PROGRESSION',
        advice: 'Solde positif et en hausse par rapport à la semaine précédente. Bon moment pour mettre un peu de côté.',
        fill: [58, 125, 68],
      },
      highest: {
        label: 'HIGHEST EVER — RECORD',
        advice: 'Meilleure semaine jamais enregistrée ! Idéal pour renforcer votre épargne ou financer un projet.',
        fill: [184, 150, 62],
      },
      normal: {
        label: 'NORMAL',
        advice: 'Semaine équilibrée, rien à signaler. Continuez sur ce rythme.',
        fill: [139, 108, 82],
      },
    }
    const status = STATUS[lastWeek.type]
    doc.setFillColor(...status.fill)
    doc.roundedRect(14, 34, pageWidth - 28, 30, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(19)
    doc.text(status.label, 20, 45)
    doc.setFontSize(12)
    doc.text(`Semaine du ${lastWeek.label}`, pageWidth - 20, 45, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(doc.splitTextToSize(status.advice, pageWidth - 40), 20, 53)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(58, 125, 68)
    doc.text(`Revenus : +${euroFormatter.format(lastWeek.income)}`, 14, 72)
    doc.setTextColor(192, 92, 42)
    doc.text(`Dépenses : -${euroFormatter.format(lastWeek.spent)}`, 80, 72)
    doc.setTextColor(61, 43, 31)
    doc.text(`Solde : ${lastWeek.net >= 0 ? '+' : ''}${euroFormatter.format(lastWeek.net)}`, 150, 72)

    const imgWidth = pageWidth - 28
    const imgHeight = Math.min((height / width) * imgWidth, 118)
    doc.addImage(png, 'PNG', 14, 78, imgWidth, imgHeight)
    doc.save(`statistiques-semaine-${lastWeek.weekStart}.pdf`)
    showToast('📄 Statistiques exportées en PDF')
  }

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

    // Compte attaché : valeur du form OU défaut résolu du membre actif
    const resolvedAccountId =
      form.accountId ||
      accounts.find(
        (a) => a.ownerMember === form.member && a.type === 'checking' && a.archivedAt === null,
      )?.id ||
      undefined

    if (editingTxId !== null) {
      setTransactions((previous) =>
        previous.map((tx) =>
          tx.id === editingTxId
            ? { ...tx, label: form.label.trim(), amount, category: form.category, member: form.member, date: form.date, kind: form.kind, envelope: form.envelope, accountId: resolvedAccountId }
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
        accountId: resolvedAccountId,
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

  // ── Ajout rapide depuis le calendrier (modale, sans changer de vue) ────
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null)
  const [quickAddForm, setQuickAddForm] = useState({
    label: '',
    amount: '',
    kind: 'depense' as TransactionKind,
    category: 'Courses' as Category,
    envelope: 'Maison' as Envelope,
    tags: '',
    recurrence: 'none' as 'none' | RecurringFrequency,
    /** '' = compte sur le mois de la date ; sinon YYYY-MM choisi. */
    budgetMonth: '',
  })

  // Null = création ; sinon id de la transaction en cours de modification.
  const [quickAddEditingId, setQuickAddEditingId] = useState<number | null>(null)
  // Confirmation de suppression dans la modale (évite les fausses manips).
  const [quickAddDeleteAsk, setQuickAddDeleteAsk] = useState(false)
  // Classification IA (catégorie + tags) : proposée automatiquement quand
  // l'assistant est configuré, sans jamais écraser un choix manuel.
  const quickAddAiTimerRef = useRef<number | null>(null)
  const quickAddTouchedRef = useRef({ category: false, tags: false })
  const [quickAddAiBusy, setQuickAddAiBusy] = useState(false)
  const [quickAddAiApplied, setQuickAddAiApplied] = useState(false)
  const quickAddAiIconRef = useRef<string | null>(null)

  const runQuickAddAi = async (label: string) => {
    if (!cashAiReady) return
    setQuickAddAiBusy(true)
    try {
      const text = await callCashModel({
        apiKey: anthropicKey || undefined,
        maxTokens: 120,
        system:
          'Tu classes une dépense de budget familial français. Réponds UNIQUEMENT un objet JSON de la forme {"category": "...", "tags": ["..."], "icon": "🛒"} sans autre texte. category doit être exactement une valeur parmi: ' + allExpenseCategories.join(', ') + '. tags: 0 à 3 étiquettes courtes en minuscules, utiles et non redondantes avec la catégorie, sinon tableau vide. icon: UN SEUL emoji représentant au mieux le marchand ou la dépense (jamais de texte).',
        messages: [{ role: 'user', content: label }],
      })
      const match = /\{[\s\S]*\}/.exec(text)
      if (!match) return
      const parsed = JSON.parse(match[0]) as { category?: string; tags?: unknown; icon?: unknown }
      if (isValidTxIcon(parsed.icon)) quickAddAiIconRef.current = parsed.icon
      const aiCategory = allExpenseCategories.includes(parsed.category as string)
        ? (parsed.category as Category)
        : null
      const aiTags = Array.isArray(parsed.tags)
        ? parsed.tags.filter((t): t is string => typeof t === 'string' && t.length > 0).slice(0, 3)
        : []
      setQuickAddForm((previous) => {
        // Ne s'applique que si le libellé n'a pas changé entre-temps et que
        // l'utilisateur n'a pas déjà fait un choix manuel sur le champ.
        if (previous.label !== label) return previous
        const next = { ...previous }
        if (aiCategory && !quickAddTouchedRef.current.category) next.category = aiCategory
        if (aiTags.length > 0 && !quickAddTouchedRef.current.tags && !previous.tags.trim()) {
          next.tags = aiTags.join(', ')
        }
        return next
      })
      setQuickAddAiApplied(true)
    } catch {
      // Silencieux : la suggestion locale reste en place.
    } finally {
      setQuickAddAiBusy(false)
    }
  }

  const scheduleQuickAddAi = (label: string) => {
    // La classification IA (catégorie/tags/emoji marchand) ne vaut que pour
    // les dépenses.
    if (!isBudgetAiConfigured || quickAddEditingId !== null || quickAddForm.kind === 'revenu') return
    if (quickAddAiTimerRef.current !== null) window.clearTimeout(quickAddAiTimerRef.current)
    if (label.trim().length < 3) return
    quickAddAiTimerRef.current = window.setTimeout(() => {
      quickAddAiTimerRef.current = null
      void runQuickAddAi(label)
    }, 700)
  }

  const openQuickAdd = (date: string) => {
    setQuickAddForm({ label: '', amount: '', kind: 'depense', category: 'Courses', envelope: 'Maison', tags: '', recurrence: 'none', budgetMonth: '' })
    setQuickAddEditingId(null)
    setQuickAddDeleteAsk(false)
    quickAddTouchedRef.current = { category: false, tags: false }
    quickAddAiIconRef.current = null
    setQuickAddAiApplied(false)
    setQuickAddDate(date)
  }

  /** Règle récurrente encore active liée à une transaction (le cas échéant). */
  const activeRuleOf = (tx: Transaction | undefined): RecurringRule | undefined => {
    if (!tx?.recurringRuleId) return undefined
    const rule = recurringRules.find((r) => r.id === tx.recurringRuleId)
    if (!rule || rule.pausedAt !== null) return undefined
    if (rule.endDate && rule.endDate <= todayIso) return undefined
    return rule
  }

  const openQuickEdit = (tx: Transaction) => {
    setQuickAddForm({
      label: tx.label,
      amount: String(tx.amount).replace('.', ','),
      kind: tx.kind,
      category: tx.category,
      envelope: tx.envelope,
      tags: (tx.tags ?? []).join(', '),
      // Pré-remplit avec la fréquence de la règle liée si elle tourne encore.
      recurrence: activeRuleOf(tx)?.frequency ?? 'none',
      budgetMonth: tx.budgetMonth ?? '',
    })
    setQuickAddEditingId(tx.id)
    setQuickAddDeleteAsk(false)
    setQuickAddDate(tx.date)
  }

  const closeQuickAdd = () => {
    if (quickAddAiTimerRef.current !== null) {
      window.clearTimeout(quickAddAiTimerRef.current)
      quickAddAiTimerRef.current = null
    }
    setQuickAddDate(null)
    setQuickAddEditingId(null)
    setQuickAddDeleteAsk(false)
  }

  const handleQuickAddSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!quickAddDate) return
    const amount = Number(quickAddForm.amount.replace(',', '.'))
    if (!quickAddForm.label.trim() || Number.isNaN(amount) || amount <= 0) return

    const parsedTags = quickAddForm.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8)

    if (quickAddEditingId !== null) {
      setTransactions((previous) =>
        previous.map((tx) =>
          tx.id === quickAddEditingId
            ? {
                ...tx,
                label: quickAddForm.label.trim(),
                amount,
                kind: quickAddForm.kind,
                category: quickAddForm.category,
                envelope: quickAddForm.envelope,
                date: quickAddDate,
                ...(parsedTags.length > 0 ? { tags: parsedTags } : { tags: undefined }),
                budgetMonth: quickAddForm.budgetMonth || undefined,
              }
            : tx,
        ),
      )
      // Récurrence en édition : arrêt, changement de fréquence, ou création
      // d'une règle depuis une opération existante.
      const editedTx = transactions.find((tx) => tx.id === quickAddEditingId)
      const linkedRule = activeRuleOf(editedTx)
      const chosen = quickAddForm.recurrence
      if (linkedRule && chosen === 'none') {
        // « Ne plus répéter » : la règle s'arrête à la date de l'opération.
        setRecurringRules((previous) =>
          previous.map((rule) =>
            rule.id === linkedRule.id ? { ...rule, endDate: quickAddDate, updatedAt: Date.now() } : rule,
          ),
        )
        showToast('Cette opération ne se répétera plus')
      } else if (linkedRule && chosen !== 'none' && chosen !== linkedRule.frequency) {
        const dayOfPeriod =
          chosen === 'weekly'
            ? ((new Date(`${quickAddDate}T12:00:00`).getDay() + 6) % 7) + 1
            : Number(quickAddDate.slice(8, 10))
        setRecurringRules((previous) =>
          previous.map((rule) =>
            rule.id === linkedRule.id
              ? { ...rule, frequency: chosen, dayOfPeriod, amount, label: quickAddForm.label.trim(), updatedAt: Date.now() }
              : rule,
          ),
        )
        showToast('Fréquence de répétition mise à jour')
      } else if (!linkedRule && chosen !== 'none' && editedTx) {
        const dayOfPeriod =
          chosen === 'weekly'
            ? ((new Date(`${quickAddDate}T12:00:00`).getDay() + 6) % 7) + 1
            : Number(quickAddDate.slice(8, 10))
        const rule: RecurringRule = {
          id: `rule-${Date.now()}`,
          member: selectedProfileId,
          category: quickAddForm.category,
          envelope: quickAddForm.envelope,
          label: quickAddForm.label.trim(),
          amount,
          kind: quickAddForm.kind,
          frequency: chosen,
          dayOfPeriod,
          startDate: quickAddDate,
          endDate: null,
          lastGeneratedOn: quickAddDate,
          pausedAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        setRecurringRules((previous) => [...previous, rule])
        setTransactions((previous) =>
          previous.map((tx) => (tx.id === quickAddEditingId ? { ...tx, recurringRuleId: rule.id } : tx)),
        )
        showToast('Cette opération se répétera automatiquement')
      } else {
        showToast(quickAddForm.kind === 'revenu' ? 'Revenu mis à jour' : 'Dépense mise à jour')
      }
      closeQuickAdd()
      return
    }

    // Récurrence demandée → on crée la règle : les prochaines échéances seront
    // générées automatiquement (la dépense saisie couvre l'occurrence du jour).
    let createdRuleId: string | undefined
    if (quickAddForm.recurrence !== 'none') {
      const frequency = quickAddForm.recurrence
      const dayOfPeriod =
        frequency === 'weekly'
          ? ((new Date(`${quickAddDate}T12:00:00`).getDay() + 6) % 7) + 1
          : Number(quickAddDate.slice(8, 10))
      const rule: RecurringRule = {
        id: `rule-${Date.now()}`,
        member: selectedProfileId,
        category: quickAddForm.category,
        envelope: quickAddForm.envelope,
        label: quickAddForm.label.trim(),
        amount,
        kind: quickAddForm.kind,
        frequency,
        dayOfPeriod,
        startDate: quickAddDate,
        endDate: null,
        lastGeneratedOn: quickAddDate,
        pausedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setRecurringRules((previous) => [...previous, rule])
      createdRuleId = rule.id
    }

    const resolvedAccountId =
      accounts.find(
        (a) => a.ownerMember === selectedProfileId && a.type === 'checking' && a.archivedAt === null,
      )?.id || undefined

    const icon = suggestMerchantIcon(quickAddForm.label) ?? quickAddAiIconRef.current
    const newTransaction: Transaction = {
      id: Date.now(),
      label: quickAddForm.label.trim(),
      amount,
      category: quickAddForm.category,
      member: selectedProfileId,
      date: quickAddDate,
      kind: quickAddForm.kind,
      envelope: quickAddForm.envelope,
      ...(icon ? { icon } : {}),
      ...(parsedTags.length > 0 ? { tags: parsedTags } : {}),
      ...(createdRuleId ? { recurringRuleId: createdRuleId } : {}),
      ...(quickAddForm.budgetMonth ? { budgetMonth: quickAddForm.budgetMonth } : {}),
      accountId: resolvedAccountId,
    }
    setTransactions((previous) => [...previous, newTransaction])
    showToast(
      quickAddForm.kind === 'revenu'
        ? (createdRuleId ? 'Revenu ajouté — il se répétera automatiquement' : 'Revenu ajouté')
        : (createdRuleId ? 'Dépense ajoutée — elle se répétera automatiquement' : 'Dépense ajoutée'),
    )
    closeQuickAdd()
  }

  const handleImportExtracted = (rows: ExtractedTx[]) => {
    const resolvedAccountId =
      accounts.find(
        (a) => a.ownerMember === selectedProfileId && a.type === 'checking' && a.archivedAt === null,
      )?.id || undefined
    const base = Date.now()
    const imported: Transaction[] = rows.map((row, index) => ({
      id: base + index,
      ...(suggestMerchantIcon(row.label) ? { icon: suggestMerchantIcon(row.label)! } : {}),
      label: row.label,
      amount: row.amount,
      category: row.category,
      member: selectedProfileId,
      date: row.date ?? todayIso,
      kind: row.kind,
      envelope: inferEnvelope(row.category),
      ...(row.tags.length > 0 ? { tags: row.tags } : {}),
      accountId: resolvedAccountId,
    }))
    setTransactions((previous) => [...previous, ...imported])
    showToast(`✨ ${imported.length} opération${imported.length > 1 ? 's' : ''} ajoutée${imported.length > 1 ? 's' : ''} depuis vos notes`)
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
      accountId: tx.accountId ?? '',
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

    // Palette charte Plan Financier (cf. src/styles/tokens.css)
    const COFFEE = [61, 43, 31] as const         // #3D2B1F — texte / fond couverture
    const COFFEE_DARK = [42, 24, 16] as const    // #2A1810 — surface élevée sur fond café
    const CREAM = [253, 250, 246] as const       // #FDFAF6 — texte clair sur café
    const LIN = [214, 197, 176] as const         // #D6C5B0 — meta / sous-titres
    const CARAMEL = [160, 128, 96] as const      // #A08060 — texte secondaire page blanche
    const SAND_LIGHT = [245, 239, 230] as const  // #F5EFE6 — fond cards (option claire)
    const TERRE = [139, 108, 82] as const        // #8B6C52 — primaire (Budget)
    const TERRACOTTA = [192, 92, 42] as const    // #C05C2A — dépenses
    const VERT = [58, 125, 68] as const          // #3A7D44 — revenus
    const AMBRE = [184, 150, 62] as const        // #B8963E — solde/warning

    const document = new JsPdf()
    const reportDate = new Date().toLocaleDateString('fr-FR')
    const pageWidth = document.internal.pageSize.getWidth()
    const summaryCards = [
      { title: 'Budget', value: euroFormatter.format(budget), color: TERRE },
      { title: 'Depenses', value: euroFormatter.format(monthlyExpense), color: TERRACOTTA },
      { title: 'Revenus', value: euroFormatter.format(monthlyIncome), color: VERT },
      { title: 'Solde', value: euroFormatter.format(monthlyNet), color: AMBRE },
    ] as const
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

    // ─── Page 1 : couverture café + KPI cards ────────────────────────
    document.setFillColor(COFFEE[0], COFFEE[1], COFFEE[2])
    document.rect(0, 0, pageWidth, 297, 'F')
    document.setTextColor(CREAM[0], CREAM[1], CREAM[2])
    document.setFontSize(11)
    document.text('PLAN FINANCIER', 14, 16)
    document.setFontSize(24)
    document.text(`Bilan mensuel — ${selectedProfileName}`, 14, 30)
    document.setFontSize(10)
    document.setTextColor(LIN[0], LIN[1], LIN[2])
    document.text(`Periode ${currentMonth}  •  Genere le ${reportDate}`, 14, 38)
    document.text('Synthese budget, objectifs, depenses et alertes.', 14, 45)

    summaryCards.forEach((card, index) => {
      const x = 14 + index * 46
      document.setFillColor(COFFEE_DARK[0], COFFEE_DARK[1], COFFEE_DARK[2])
      document.roundedRect(x, 56, 40, 28, 4, 4, 'F')
      document.setFillColor(card.color[0], card.color[1], card.color[2])
      document.roundedRect(x, 56, 40, 5, 4, 4, 'F')
      document.setTextColor(CREAM[0], CREAM[1], CREAM[2])
      document.setFontSize(9)
      document.text(card.title, x + 3, 67)
      document.setFontSize(12)
      document.text(card.value, x + 3, 77)
    })

    document.setTextColor(CREAM[0], CREAM[1], CREAM[2])
    document.setFontSize(12)
    document.text('Top categories du mois', 14, 98)

    goalProgress.slice(0, 5).forEach((goal, index) => {
      const y = 108 + index * 14
      const barWidth = Math.min(120, (goal.spent / Math.max(goal.target, 1)) * 120)
      const color = colorForCategory(goal.category)
      const rgb = color.match(/[0-9a-f]{2}/gi)?.map((value) => parseInt(value, 16)) ?? [
        TERRE[0],
        TERRE[1],
        TERRE[2],
      ]
      document.setTextColor(LIN[0], LIN[1], LIN[2])
      document.setFontSize(9)
      document.text(goal.category, 14, y)
      document.setFillColor(COFFEE_DARK[0], COFFEE_DARK[1], COFFEE_DARK[2])
      document.roundedRect(52, y - 4, 120, 5, 2, 2, 'F')
      document.setFillColor(rgb[0], rgb[1], rgb[2])
      document.roundedRect(52, y - 4, Math.max(6, barWidth), 5, 2, 2, 'F')
      document.text(`${euroFormatter.format(goal.spent)} / ${euroFormatter.format(goal.target)}`, 177, y)
    })

    document.setTextColor(CREAM[0], CREAM[1], CREAM[2])
    document.setFontSize(12)
    document.text('Alertes et points de vigilance', 14, 188)
    document.setFontSize(9)
    ;(alertMessages.length > 0 ? alertMessages.map((a) => a.message) : ['Aucune alerte active sur la periode.']).forEach(
      (message, index) => {
        document.setTextColor(LIN[0], LIN[1], LIN[2])
        document.text(`• ${message}`, 18, 198 + index * 8)
      },
    )

    // ─── Page 2 : tables crème détail ────────────────────────────────
    document.addPage()
    // Fond crème pour les tables
    document.setFillColor(SAND_LIGHT[0], SAND_LIGHT[1], SAND_LIGHT[2])
    document.rect(0, 0, pageWidth, 297, 'F')
    document.setFontSize(18)
    document.setTextColor(COFFEE[0], COFFEE[1], COFFEE[2])
    document.text(`Detail mensuel — ${selectedProfileName}`, 14, 18)
    document.setFontSize(10)
    document.setTextColor(CARAMEL[0], CARAMEL[1], CARAMEL[2])
    document.text(`Objectifs, transactions et analyse au ${reportDate}`, 14, 25)

    autoTable(document, {
      startY: 34,
      head: [['Categorie', 'Depense', 'Objectif', 'Progression']],
      body: categoryRows,
      styles: { fontSize: 9, textColor: [61, 43, 31] },
      headStyles: { fillColor: [TERRE[0], TERRE[1], TERRE[2]], textColor: [253, 250, 246] },
      alternateRowStyles: { fillColor: [253, 250, 246] },
    })

    const lastTableY = (document as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
    autoTable(document, {
      startY: lastTableY ? lastTableY + 8 : 96,
      head: [['Date', 'Libelle', 'Categorie', 'Type', 'Montant']],
      body: transactionRows.length > 0 ? transactionRows : [['-', 'Aucune operation', '-', '-', '-']],
      styles: { fontSize: 8.5, textColor: [61, 43, 31] },
      headStyles: { fillColor: [VERT[0], VERT[1], VERT[2]], textColor: [253, 250, 246] },
      alternateRowStyles: { fillColor: [253, 250, 246] },
    })

    // Footer privacy mention
    const finalY = (document as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 270
    if (finalY < 280) {
      document.setFontSize(8)
      document.setTextColor(CARAMEL[0], CARAMEL[1], CARAMEL[2])
      document.text(
        'Confidentialite : ce bilan est genere localement. Aucune donnee envoyee a un tiers.',
        14,
        Math.min(finalY + 10, 290),
      )
    }

    void logAuditEvent('export', {
      metadata: {
        kind: 'pdf_monthly',
        period: currentMonth,
        member: selectedProfileName,
      },
    })

    document.save(`bilan-${selectedProfileName.toLowerCase().replace(/\s+/g, '-')}-${currentMonth}.pdf`)
  }


  const handleLogout = () => {
    window.history.replaceState({}, '', '/')
    setShowLanding(true)
    void (async () => {
      await logAuditEvent('logout')
      await supabase.auth.signOut()
    })()
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

  // Rendu de l'avatar d'un profil : photo importée > emoji preset > initiales.
  const profileAvatarNode = (profile: UserProfile) => {
    if (profile.avatar?.startsWith('data:image/')) {
      return <img className="member-avatar member-avatar--photo" src={profile.avatar} alt="" />
    }
    if (profile.avatar?.startsWith('emoji:')) {
      return (
        <span className="member-avatar member-avatar--emoji" aria-hidden="true">
          {profile.avatar.slice(6)}
        </span>
      )
    }
    return (
      <span className="member-avatar" style={{ background: avatarColor(profile.id) }} aria-hidden="true">
        {avatarInitials(profile.name)}
      </span>
    )
  }

  const setProfileAvatar = (profileId: string, avatar: string | undefined) => {
    if (blockInDemo('le changement de photo ou d\u2019avatar')) return
    setProfiles((previous) =>
      previous.map((item) => {
        if (item.id !== profileId) return item
        if (!avatar) {
          const rest = { ...item }
          delete rest.avatar
          return rest
        }
        return { ...item, avatar }
      }),
    )
  }

  const handleAvatarUpload = async (file: File | undefined) => {
    if (blockInDemo('le changement de photo')) return
    if (!file) return
    setSettingsError('')
    setSettingsSuccess('')
    try {
      const dataUrl = await readAndResizeImage(file, 96)
      setProfileAvatar(settingsForm.manageProfileId, dataUrl)
      setSettingsSuccess('Photo de profil mise à jour.')
    } catch {
      setSettingsError("Impossible d'utiliser cette image (format non lisible ou trop lourde).")
    }
  }

  const handleUpdateManagedProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (blockInDemo('la modification des profils')) return
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

  const isBudgetAiConfigured = activeAiKey.trim().length > 0 || canUseIncludedAi

  const requestBudgetAssistantAdvice = async () => {
    if (!isBudgetAiConfigured || budgetAssistantLoading) {
      return
    }

    setBudgetAssistantLoading(true)
    setBudgetAssistantError('')

    const prompt = `Tu t'appelles Cash, l'assistant budget familial de cette app. Donne des conseils concrets et simples.
Contexte:
- Profil: ${selectedProfileName}
- Mois: ${formatMonth(selectedMonth)}
- Budget: ${euroFormatter.format(budget)}
- Dépenses: ${euroFormatter.format(monthlyExpense)} (${usageRate.toFixed(0)}% du budget)
- Revenus: ${euroFormatter.format(monthlyIncome)}
- Reste: ${euroFormatter.format(remaining)}
- État: ${budgetStatusLabel}
- Projection: ${projectedMessage}
${activeSectionId === 'stats'
  ? `- Dernières semaines (lun→dim): ${weeklyStatsData.slice(-4).map((w) => `${w.label} ${w.net >= 0 ? '+' : ''}${Math.round(w.net)}€ (${w.type})`).join(' · ')}
`
  : ''}${activeSectionId === 'operations'
  ? `- Top dépenses du mois: ${topExpensesMonth.map((t) => `${t.label} ${euroFormatter.format(t.amount)} (${t.category})`).join(' · ') || 'aucune'}
`
  : ''}${activeSectionId === 'budget'
  ? `- Poches (dispo / objectif): ${envelopeCards.map((c) => `${c.name} ${euroFormatter.format(c.inside)} dispo${c.target > 0 ? ` / obj ${euroFormatter.format(c.target)} (${Math.round((c.ratio ?? 0) * 100)}%)` : ''}`).join(' · ')}
- Plafonds par catégorie: ${goalProgress.map((g) => `${g.category} ${g.rate.toFixed(0)}%`).join(' · ')}
`
  : ''}
Réponse attendue:
- TRÈS COURT: 3 phrases maximum, 320 caractères au total
- français simple, en vouvoyant l'utilisateur
- une phrase de résumé puis 1 ou 2 actions concrètes
- pas de markdown, pas de titres
- ton bienveillant et direct.`

    // Garde-fou : sans réponse en 20 s, on abandonne proprement (sinon le
    // squelette de chargement pourrait rester affiché indéfiniment).
    const abort = new AbortController()
    const abortTimer = window.setTimeout(() => abort.abort(), 20_000)
    try {
      const text = await callCashModel({
        apiKey: anthropicKey || undefined,
        maxTokens: 160,
        messages: [{ role: 'user', content: prompt }],
        signal: abort.signal,
      })
      setBudgetAssistantAdvice(text.trim() || 'Conseil IA indisponible pour le moment.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setBudgetAssistantError("L'analyse a pris trop de temps — réessayez dans un instant.")
      } else if (error instanceof AiQuotaExceededError) {
        setBudgetAssistantError(error.message)
      } else {
        setBudgetAssistantError('Impossible de contacter Cash pour le moment.')
      }
    } finally {
      window.clearTimeout(abortTimer)
      // Succès OU échec : le contexte est marqué traité, sinon l'effet
      // relançait l'analyse en boucle (en effaçant le message d'erreur —
      // d'où un squelette de chargement affiché en permanence).
      setBudgetAssistantContextLoaded(budgetAssistantContextKey)
      setBudgetAssistantLoading(false)
    }
  }


  useEffect(() => {
    // L'analyse IA alimente le rail Conseils du Budget, de l'Accueil,
    // des Opérations et de la Famille.
    if (!['budget', 'overview', 'family', 'operations', 'stats'].includes(activeSectionId)) {
      return
    }

    if (!isBudgetAiConfigured) {
      // Reset de l'état de l'assistant à l'entrée de section / config absente.
      // Le contexte est remis à zéro (pas marqué « traité ») pour que
      // l'analyse parte bien dès que l'IA est (re)configurée.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBudgetAssistantAdvice('')
      setBudgetAssistantError('')
      setBudgetAssistantContextLoaded('')
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
    if (blockInDemo('l\u2019export de sauvegarde')) return
    setSettingsError('')
    setSettingsSuccess('')

    const payload: BackupPayload = {
      profiles,
      activeProfileId: selectedProfileId,
      defaultProfileId,
      transactions,
      savingsGoals,
      rolloverState,
      storedCsvMappings,
    }

    const blob = new Blob(
      [JSON.stringify({ pf: 'backup', version: 2, payload }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `plan-financier-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setSettingsSuccess('Sauvegarde exportée — gardez ce fichier en lieu sûr.')
  }

  const handleRestoreEncryptedBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (blockInDemo('la restauration de sauvegarde')) return
    setSettingsError('')
    setSettingsSuccess('')

    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const content = await file.text()
      const parsed = JSON.parse(content) as { pf?: string; version?: number; payload?: BackupPayload } & EncryptedBackup
      let payload: BackupPayload
      if (parsed.pf === 'backup' && parsed.version === 2 && parsed.payload) {
        payload = parsed.payload
      } else if (
        parsed.version === BACKUP_VERSION &&
        typeof parsed.salt === 'string' &&
        typeof parsed.iv === 'string' &&
        typeof parsed.cipher === 'string'
      ) {
        // Ancien format chiffré : on demande le PIN utilisé à l'époque.
        const legacyPin = window.prompt('Cette sauvegarde vient d\u2019une ancienne version et est chiffrée.\nEntrez le PIN parent utilisé à l\u2019époque pour la déverrouiller :')
        if (!legacyPin) return
        payload = await decryptBackupPayload(parsed, legacyPin)
      } else {
        setSettingsError('Format de sauvegarde invalide.')
        return
      }
      const restoredProfiles = payload.profiles
        .map((profile) => normalizeProfile(profile))
        .filter((profile): profile is UserProfile => profile !== null)

      if (restoredProfiles.length === 0) {
        setSettingsError('La sauvegarde ne contient aucun profil valide.')
        return
      }

      const validProfileIds = new Set(restoredProfiles.map((profile) => profile.id))
      const restoredTransactions = payload.transactions
        .map((item) => normalizeTransaction(item, validProfileIds))
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
      setSettingsError('Échec de restauration : fichier corrompu (ou ancien PIN incorrect).')
    } finally {
      event.target.value = ''
    }
  }

  const handleAddProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (blockInDemo('la cr\u00e9ation de profils')) return
    // Plan Découverte : un seul profil.
    if (profiles.length >= 1 && requirePremium('les profils multiples')) return
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
    setSettingsSuccess('Profil ajouté.')
  }

  const resetLocalState = async (nextParentPin: string) => {
    await resetSensitiveStorage()
    const updatedState = await setParentPin(nextParentPin)
    const nextSensitiveState: SensitiveState = {
      ...updatedState,
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
    await resetLocalState(DEFAULT_PARENT_PIN)
  }



  if (!isSecurityReady || !authProviderReady) {
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

  if (!isAuthenticated && !demoMode) {
    if (showLanding) {
      return (
        <LandingPage
          onLogin={() => {
            window.history.pushState({}, '', '/login')
            setShowLanding(false)
          }}
          onTryDemo={() => {
            window.history.pushState({}, '', '/app')
            enterDemoMode()
          }}
        />
      )
    }
    return (
      <AuthScreen
        onTryDemo={() => {
          window.history.pushState({}, '', '/app')
          enterDemoMode()
        }}
        onBackToSite={() => {
          window.history.pushState({}, '', '/')
          setShowLanding(true)
        }}
      />
    )
  }

  return (
    <>
    {demoMode ? (
      <div className="demo-banner" role="status">
        <span>
          🎬 Mode démo<span className="demo-banner__long"> — explorez librement, rien n'est enregistré.</span>
        </span>
        <span className="demo-banner__actions">
          <button type="button" className="demo-banner__cta" onClick={leaveDemoForSignup}>
            Créer mon compte
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            Quitter
          </button>
        </span>
      </div>
    ) : null}
    {pendingInvites.map((invite) => (
      <div key={invite.membershipId} className="invite-banner" role="status">
        <span>
          🤝 <strong>{invite.inviterName}</strong> vous invite à rejoindre « {invite.groupName} »
          pour partager vos budgets.
        </span>
        <button type="button" onClick={() => void handleAcceptInvite(invite)}>
          Accepter
        </button>
      </div>
    ))}
    {/* ── Onboarding wizard (première utilisation) ──────────────────── */}
    {showOnboarding ? (
      <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Configuration initiale">
        <div className="onboarding-modal glass-card">
          {manualGenerating ? (
            <div className="onboarding-generating">
              <div className="onboarding-generating-spinner" aria-hidden="true" />
              <p className="onboarding-generating-phase" key={manualPhase}>{MANUAL_ONBOARDING_PHASES[manualPhase]}</p>
              <p className="onboarding-generating-sub">Construction de votre plan sur mesure…</p>
            </div>
          ) : (
          <>
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
                  onClick={() => { setOnboardingMode('ai'); setOnboardingStep(2) }}
                >
                  <span className="onboarding-choice-icon">✦</span>
                  <strong>Configurer avec l'IA</strong>
                  <p>L'IA est incluse avec votre compte : laissez l'assistant vous poser 3 questions et paramétrer le budget pour vous.</p>
                  <span className="onboarding-choice-badge">Recommandé</span>
                </button>

                {/* Option manuelle */}
                <button
                  type="button"
                  className="onboarding-choice-card onboarding-choice-card--manual"
                  onClick={() => { setOnboardingMode('manual'); setOnboardingStep(3) }}
                >
                  <span className="onboarding-choice-icon">📝</span>
                  <strong>Configurer manuellement</strong>
                  <p>Répondez à 4 questions rapides et laissez l'app construire vos profils, budgets et objectif d'épargne. Sans clé API.</p>
                </button>
              </div>
              <button
                type="button"
                className="ghost-button onboarding-skip"
                onClick={skipOnboarding}
              >
                Commencer avec un tableau vide
              </button>
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
                          L'IA est incluse avec votre compte. Si vous préférez utiliser votre propre clé API, elle reste sur cet appareil et n'est envoyée qu'à Anthropic au moment des appels IA.
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
                          ? (canUseIncludedAi
                            ? 'Facultative : l\'IA est déjà incluse avec votre compte. Une clé personnelle (stockée uniquement sur cet appareil) lève le quota mensuel.'
                            : 'La clé reste stockée uniquement sur cet appareil. Vous pourrez la modifier plus tard dans les paramètres.')
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
                          if (!key && !canUseIncludedAi) { setOnboardingError('Veuillez entrer votre clé API.'); return }
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
              <button type="button" className="onboarding-back-btn" onClick={() => setOnboardingStep(onboardingMode === 'manual' ? 1 : 2)}>← Retour</button>
              <p className="onboarding-profile-intro">
                {onboardingMode === 'manual'
                  ? 'Vos réponses servent à construire directement vos profils, budgets et objectif d\'épargne.'
                  : 'Ces informations permettront à l\'IA de personnaliser directement votre configuration.'}
              </p>

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
                {onboardingMode === 'manual' ? (
                  <button type="button" className="hero-cta-button" onClick={handleManualPlan}>
                    Générer mon plan →
                  </button>
                ) : (
                  <button type="button" className="hero-cta-button" onClick={() => void handleOnboardingStart()} disabled={onboardingLoading}>
                    {onboardingLoading ? (
                      <span className="inline-loading-label"><span className="inline-loader" aria-hidden="true" />Lancement…</span>
                    ) : 'Lancer Claude →'}
                  </button>
                )}
                <button
                  type="button"
                  className="ghost-button"
                  style={{fontSize:'0.8rem',opacity:0.7}}
                  onClick={onboardingMode === 'manual' ? skipOnboarding : () => void handleOnboardingStart()}
                >
                  Passer cette étape
                </button>
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
          </>
          )}
        </div>
      </div>
    ) : null}

    <main className={`dashboard-shell${isActiveView('budget') || isActiveView('overview') || isActiveView('operations') || isActiveView('family') || isActiveView('stats') ? ' dashboard-shell--three-columns' : ''}`} id="app-main" aria-label="Tableau de bord budgétaire">
      <h1 className="sr-only">Plan Financier — Tableau de bord</h1>
      <aside className="glass-card side-menu" aria-label="Navigation principale">
        <div className="side-menu-profiles" role="tablist" aria-label="Sélection du profil">
          <p className="eyebrow">Profil</p>
          <div className="side-menu-profiles__row">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                role="tab"
                aria-selected={selectedProfileId === profile.id}
                className={selectedProfileId === profile.id ? 'active' : ''}
                title={profile.id === defaultProfileId ? `${profile.name} (profil par défaut)` : profile.name}
                aria-label={`Basculer sur ${profile.name}`}
                onClick={() => {
                  setSelectedMember(profile.id)
                  setCsvImportMember(profile.id)
                  setForm((previous) => ({ ...previous, member: profile.id }))
                }}
              >
                {profileAvatarNode(profile)}
              </button>
            ))}
          </div>
          <p className="side-menu-profiles__name">{selectedProfile.name}</p>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeSectionId === item.id ? 'active' : ''}
              onClick={() => navigateToSection(item.id)}
              aria-label={item.label}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              <span className="nav-label nav-label--short" aria-hidden="true">{item.short ?? item.label}</span>
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
            ⚙️<span className="side-menu-btn-label"> Paramètres</span>
          </button>
          <button
            type="button"
            className="side-menu-logout-btn"
            onClick={handleLogout}
            aria-label="Se déconnecter"
          >
            ⎋<span className="side-menu-btn-label"> Déconnexion</span>
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        {isActiveView('overview') ? (
        <header id="overview" className="hero-header glass-card">
        {/* Hero actionnable : LE chiffre que les utilisateurs cherchent en
            premier (« combien il me reste »), son rythme par jour, et le CTA
            principal — au lieu d'un slogan marketing. */}
        <div className="hero-main">
          <span className="hero-greeting">
            Bonjour {selectedProfile.name}{' '}
            <span className="hero-wave" aria-hidden="true">👋</span>
          </span>
          <p className="hero-focus-label">Reste à dépenser · {formatMonth(selectedMonth)}</p>
          <p className={`hero-focus-value${remaining < 0 ? ' hero-focus-value--negative' : ''}`}>
            {euroFormatter.format(remaining)}
          </p>
          <p className="hero-focus-hint">
            {remaining >= 0
              ? `≈ ${euroFormatter.format(dailyAllowance)} / jour sur les ${daysLeftInMonth} jours restants`
              : 'Budget dépassé — réduisez une catégorie ou ajustez le budget.'}
          </p>
          {(() => {
            const week = weeklyStatsData.at(-1)
            if (!week) return null
            const WEEK_STATUS = {
              danger: { icon: '⚠️', label: 'Danger', advice: 'Vous dépensez plus que vous ne recevez — levez le pied cette semaine.' },
              up: { icon: '📈', label: 'Up', advice: 'Solde en hausse par rapport à la semaine dernière — continuez !' },
              highest: { icon: '🏆', label: 'Highest ever', advice: 'Record absolu de la semaine — bravo !' },
              normal: { icon: '✅', label: 'Normal', advice: 'Semaine équilibrée, rien à signaler.' },
            } as const
            const status = WEEK_STATUS[week.type]
            return (
              <button
                type="button"
                className={`hero-week-status hero-week-status--${week.type}`}
                onClick={() => navigateToSection('stats')}
                title="Voir les statistiques hebdomadaires"
              >
                <span className="hero-week-status__icon" aria-hidden="true">{status.icon}</span>
                <span className="hero-week-status__text">
                  <strong>Semaine du {week.label} : {status.label}</strong>
                  <small>{status.advice}</small>
                </span>
                <strong className={`hero-week-status__net ${week.net < 0 ? 'expense' : 'income'}`}>
                  {week.net >= 0 ? '+' : ''}{euroFormatter.format(week.net)}
                </strong>
              </button>
            )
          })()}
          <div className="hero-primary-actions">
            <button type="button" className="hero-cta-button" onClick={() => openQuickAdd(todayIso)}>
              <Plus size={16} /> Ajouter une dépense ou un revenu
            </button>
            <button type="button" className="ghost-button" onClick={() => void exportMonthlyPdf()}>
              <Download size={16} /> PDF mensuel
            </button>
          </div>
        </div>
        <div className="header-actions">
          <div className="hero-priority-bar">
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
        </div>
        </header>
        ) : null}

        {isActiveView('overview') && startChecklist.visible ? (
          <StartChecklist items={startChecklist.items} done={startChecklist.done} onDismiss={dismissStartChecklist} />
        ) : null}

        {isActiveView('overview') ? (
        <section className="kpi-summary" style={{ margin: '0 0 1rem 0' }}>
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
          {primarySavingsTarget ? (
            <div className={`kpi-card kpi-card--accent${primarySavingsProgress >= 100 ? ' kpi-card--celebrate' : ''}`}>
              <div className="kpi-card-label">
                {primarySavingsTarget.label}
                {primarySavingsProgress >= 100 ? <span className="kpi-celebrate-emoji" aria-hidden="true"> 🎉</span> : null}
              </div>
              <div className="kpi-card-value">{euroFormatter.format(primarySavingsTarget.targetAmount)}</div>
              <div className="kpi-card-change">
                <span className="kpi-progress-track" aria-hidden="true">
                  <span className="kpi-progress-fill" style={{ width: `${primarySavingsProgress}%` }} />
                </span>
                {primarySavingsProgress}% atteint
              </div>
            </div>
          ) : (
            <div className="kpi-card kpi-card--accent">
              <div className="kpi-card-label">Économies du mois</div>
              <div className="kpi-card-value">{euroFormatter.format(Math.max(0, monthlyIncome - monthlyExpense))}</div>
              <div className="kpi-card-change positive">Revenus − dépenses</div>
            </div>
          )}
        </section>
        ) : null}

        {isActiveView('overview') ? (
        <section className="glass-card home-calendar-card" aria-label="Calendrier des dépenses">
          <div className="panel-title">
            <h2>Mon calendrier</h2>
            <p>Vos dépenses jour par jour — cliquez sur une case pour voir le détail.</p>
          </div>
          <ExpenseCalendar
            month={selectedMonth}
            transactions={activeTransactions}
            onMonthChange={setSelectedMonth}
            today={todayIso}
            onAddExpense={openQuickAdd}
            onEditExpense={openQuickEdit}
            recurringRules={recurringRules.filter((rule) => rule.member === selectedProfileId)}
          />
        </section>
        ) : null}

        {isActiveView('overview') && recentTransactions.length > 0 ? (
        <section className="glass-card recent-tx-card" aria-label="Dernières opérations">
          <div className="panel-title">
            <h2>Dernières opérations</h2>
            <button type="button" className="ghost-button" onClick={() => navigateToSection('operations')}>
              Tout voir →
            </button>
          </div>
          <ul className="recent-tx-list">
            {recentTransactions.map((tx) => (
              <li key={tx.id}>
                <button
                  type="button"
                  className="recent-tx-hit"
                  onClick={() => openQuickEdit(tx)}
                  aria-label={`Modifier ${tx.label}`}
                >
                  <MerchantLogo label={tx.label} fallbackIcon={tx.icon ?? categoryEmoji(tx.category)} />
                  <span className="recent-tx-label">
                    {tx.label}
                    {tx.recurringRuleId ? <span className="recurring-badge" title="Générée automatiquement (charge récurrente)">🔁</span> : null}
                    {(tx.tags ?? []).map((tag) => (
                      <span key={tag} className="tx-tag">#{tag}</span>
                    ))}
                  </span>
                  <span className="recent-tx-meta">
                    {new Date(`${tx.date}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · {tx.category}
                  </span>
                  <span className={`recent-tx-amount recent-tx-amount--${tx.kind}`}>
                    {tx.kind === 'depense' ? '−' : '+'}{euroFormatter.format(tx.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        ) : null}

        {isActiveView('overview') && (monthSummary.spent > 0 || monthSummary.income > 0) ? (
        <section className="glass-card month-summary-card" aria-label="Bilan du mois">
          <div className="panel-title">
            <h2>Bilan · {formatMonth(selectedMonth)}</h2>
          </div>
          <div className="month-summary-rows">
            <div className="month-summary-row">
              <span>Dépensé</span>
              <strong className="month-summary-spent">−{euroFormatter.format(monthSummary.spent)}</strong>
              {monthSummary.previousSpent > 0 ? (
                <small className={monthSummary.delta > 0 ? 'negative' : 'positive'}>
                  {monthSummary.delta > 0 ? '+' : ''}{euroFormatter.format(monthSummary.delta)} vs mois dernier
                </small>
              ) : null}
            </div>
            <div className="month-summary-row">
              <span>Reçu</span>
              <strong className="month-summary-income">+{euroFormatter.format(monthSummary.income)}</strong>
            </div>
            {monthSummary.topCategories.length > 0 ? (
              <div className="month-summary-row month-summary-row--cats">
                <span>Top catégories</span>
                <div className="month-summary-cats">
                  {monthSummary.topCategories.map(([category, total]) => (
                    <span key={category} className="month-summary-cat">
                      <span className="recent-tx-dot" style={{ background: colorForCategory(category) }} aria-hidden="true" />
                      {category} · {euroFormatter.format(total)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
        ) : null}

      {isActiveView('family') ? (
        <FamilyView month={selectedMonth} peers={familyPeers} myUserId={myUserId} />
      ) : null}

      {isActiveView('notes') ? (
        <NotesView
          notes={notes}
          onChange={setNotes}
          aiEnabled={isBudgetAiConfigured}
          anthropicKey={anthropicKey ?? ''}
          onImportTransactions={handleImportExtracted}
          onConfigureAi={() => openSettingsPanel('ai')}
        />
      ) : null}

      {isActiveView('envelopes') ? (
      <section id="envelopes" className="glass-card envelope-strip">
        <div className="panel-title">
          <h2>Enveloppes</h2>
          <p>Répartissez vos dépenses par poche (Perso, Maison, Vacances)</p>
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


      {premiumGate ? (
      <PremiumGateModal
        feature={premiumGate}
        onClose={() => setPremiumGate(null)}
        onSeePlans={() => {
          setPremiumGate(null)
          openSettingsPanel('subscription')
        }}
      />
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
                <h2 id="settings-modal-title">Paramètres</h2>
                <p className="auth-note">Personnalisez l'application et gérez vos données.</p>
              </div>
              <button type="button" className="settings-close-button" onClick={closeSettingsPanel} aria-label="Fermer les paramètres">
                <X size={18} />
              </button>
            </div>

            <div className="settings-modal-body">
              <aside className="settings-nav" aria-label="Sections de paramètres">
                {([
                  {
                    group: 'Personnalisation',
                    items: [
                      ['theme', '🎨', 'Thème'],
                      ['a11y', '♿', 'Accessibilité'],
                      ['profiles', '👥', 'Profils'],
                      ['ai', '✨', 'Assistant IA'],
                    ],
                  },
                  {
                    group: 'Données',
                    items: [
                      ['backup', '💾', 'Sauvegarde'],
                      ['report', '📧', 'Rapport par email'],
                    ],
                  },
                  {
                    group: 'Compte',
                    items: [
                      ['subscription', '⭐', 'Abonnement'],
                      ['account', '👤', 'Mon compte'],
                      ['rgpd', '🔏', 'Mes données RGPD'],
                      ['reset', '⚠️', 'Réinitialiser'],
                    ],
                  },
                ] as const).map((section) => (
                  <div key={section.group} className="settings-nav-group">
                    <span className="settings-nav-group__label">{section.group}</span>
                    {section.items.map(([id, icon, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={`${settingsSection === id ? 'active' : ''}${id === 'reset' ? ' settings-nav-danger' : ''}`}
                        onClick={() => setSettingsSection(id as SettingsSection)}
                      >
                        <span className="settings-nav-icon" aria-hidden="true">{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                ))}
              </aside>

              <div className="settings-content">
                {settingsError ? <p className="auth-error">{settingsError}</p> : null}
                {settingsSuccess ? <p className="auth-success">{settingsSuccess}</p> : null}

                {settingsSection === 'profiles' ? (
                  <div className="settings-section-grid">
                    <article className="glass-card settings-section-card form-panel">
                      <div className="panel-title">
                        <h2>
                          Profils
                          <InfoHint text="Après l'ajout, basculez de profil via les cercles en haut du menu — chaque profil a son budget et ses dépenses." />
                        </h2>
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
                      </form>
                      <div className="family-invite-block">
                        <h3>🤝 Inviter un proche</h3>
                        <p className="auth-note">
                          Cette personne recevra un email pour créer son propre compte. Une fois
                          l'invitation acceptée, un onglet « Famille » fusionnera vos budgets
                          et dépenses (chacun garde la main sur les siens).
                        </p>
                        <div className="family-invite-row">
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(event) => setInviteEmail(event.target.value)}
                            placeholder="email@exemple.fr"
                            disabled={inviteBusy}
                          />
                          <button
                            type="button"
                            className="hero-cta-button"
                            onClick={() => void handleSendFamilyInvite()}
                            disabled={inviteBusy || !inviteEmail.trim()}
                          >
                            {inviteBusy ? 'Envoi…' : 'Inviter'}
                          </button>
                        </div>
                        {inviteFeedback ? (
                          <p className={inviteFeedback.kind === 'ok' ? 'auth-success' : 'auth-error'}>
                            {inviteFeedback.text}
                          </p>
                        ) : null}
                        {sentInvites.length > 0 ? (
                          <ul className="sent-invites-list" data-relance-tick={relanceTick}>
                            {sentInvites.map((invite) => {
                              const info = relanceInfo.get(invite.membershipId)
                              const canRelance = info?.canRelance ?? true
                              const hoursLeft = info?.hoursLeft ?? 1
                              return (
                                <li key={invite.membershipId}>
                                  <div className="sent-invite-info">
                                    {invite.accepted ? (
                                      <>
                                        <strong>{invite.displayName}</strong>
                                        <small>{invite.email}</small>
                                      </>
                                    ) : (
                                      <strong>{invite.email}</strong>
                                    )}
                                  </div>
                                  {invite.accepted ? (
                                    <span className="sent-invite-status sent-invite-status--ok">A rejoint ✓</span>
                                  ) : (
                                    <>
                                      <span className="sent-invite-status">En attente</span>
                                      <button
                                        type="button"
                                        className="ghost-button sent-invite-btn"
                                        onClick={() => void handleResendInvite(invite)}
                                        disabled={inviteBusy || !canRelance}
                                        title={canRelance ? 'Renvoyer l\'email d\'invitation' : `Relance possible dans ${hoursLeft} h (1 relance par 24 h)`}
                                      >
                                        {canRelance ? 'Relancer' : `Relancé — ${hoursLeft} h`}
                                      </button>
                                      <button
                                        type="button"
                                        className="ghost-button sent-invite-btn sent-invite-btn--danger"
                                        onClick={() => void handleCancelInvite(invite)}
                                        disabled={inviteBusy}
                                      >
                                        Annuler
                                      </button>
                                    </>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        ) : null}
                      </div>
                    </article>

                    <article className="glass-card settings-section-card form-panel">
                      <div className="panel-title">
                        <h2>
                          Profil actif
                          <InfoHint text="Le profil par défaut sert de filet de sécurité : si un profil est supprimé, ses données lui sont rattachées." />
                        </h2>
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
                        <div className="avatar-editor">
                          <span className="avatar-editor__label">Photo du profil</span>
                          <div className="avatar-editor__row">
                            <div className="avatar-editor__current">
                              <button
                                type="button"
                                className="avatar-editor__avatar-btn"
                                onClick={() => setAvatarPickerOpen((open) => !open)}
                                aria-expanded={avatarPickerOpen}
                                aria-label="Changer la photo ou l'avatar du profil"
                              >
                                {profileAvatarNode(managedProfile)}
                                <span className="avatar-editor__edit-badge" aria-hidden="true">📷</span>
                              </button>
                              {managedProfile.avatar ? (
                                <button
                                  type="button"
                                  className="avatar-editor__remove"
                                  onClick={() => {
                                    setProfileAvatar(managedProfile.id, undefined)
                                    setAvatarPickerOpen(false)
                                  }}
                                  aria-label="Retirer la photo et revenir aux initiales"
                                  title="Revenir aux initiales"
                                >
                                  <X size={12} />
                                </button>
                              ) : null}
                            </div>
                            <span className="avatar-editor__hint">
                              Touchez la photo pour la changer
                              {managedProfile.avatar ? ' — la croix la retire.' : '.'}
                            </span>
                          </div>
                          {avatarPickerOpen ? (
                            <div className="avatar-editor__picker">
                              <label className="ghost-button avatar-upload-btn">
                                📷 Importer une photo
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(event) => {
                                    void handleAvatarUpload(event.target.files?.[0])
                                    event.target.value = ''
                                    setAvatarPickerOpen(false)
                                  }}
                                />
                              </label>
                              <span className="avatar-editor__label avatar-editor__label--sub">
                                … ou choisissez un avatar (libres de droit)
                              </span>
                              <div className="avatar-preset-grid" role="listbox" aria-label="Avatars proposés">
                                {MONEY_AVATAR_PRESETS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    role="option"
                                    aria-selected={managedProfile.avatar === `emoji:${emoji}`}
                                    className={`avatar-preset${managedProfile.avatar === `emoji:${emoji}` ? ' avatar-preset--active' : ''}`}
                                    onClick={() => {
                                      setProfileAvatar(managedProfile.id, `emoji:${emoji}`)
                                      setAvatarPickerOpen(false)
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
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
                      </form>
                    </article>
                  </div>
                ) : null}

                {settingsSection === 'ai' ? (
                  <div className="settings-section-grid">
                    <article className="glass-card settings-section-card form-panel ai-settings-card">
                      <div className="panel-title">
                        <h2>Assistant IA</h2>
                        <p>Connectez une IA pour activer le coaching, les analyses et le chat.</p>
                      </div>

                      <div
                        className={`ai-status ai-status--${activeAiKey || canUseIncludedAi ? 'ready' : 'off'}`}
                        role="status"
                      >
                        <span className="ai-status__dot" aria-hidden="true" />
                        <div>
                          <strong>
                            {activeAiKey
                              ? 'Prêt à l\'emploi — clé personnelle'
                              : canUseIncludedAi
                                ? 'Prêt à l\'emploi — IA incluse'
                                : 'Non configuré'}
                          </strong>
                          <small>
                            {activeAiKey
                              ? 'Votre clé est enregistrée sur cet appareil (aucun quota). Testez-la ci-dessous.'
                              : canUseIncludedAi
                                ? `Cash est propulsé par Claude (Anthropic), inclus avec votre compte${aiQuota ? ` : ${aiQuota.used} / ${aiQuota.limit} messages utilisés ce mois-ci` : ''}. Une clé personnelle (facultative) lève le quota.`
                                : 'Ajoutez votre clé pour débloquer l\'assistant.'}
                          </small>
                        </div>
                      </div>

                      <label>
                        Clé API Anthropic (Claude) — facultative
                        <input
                          type="password"
                          value={activeAiKey}
                          onChange={(event) => saveAiProviderKey('anthropic', event.target.value)}
                          placeholder={selectedAiProvider.keyPlaceholder}
                          autoComplete="off"
                        />
                      </label>
                      <p className="ai-key-links">
                        <a href={selectedAiProvider.consoleUrl} target="_blank" rel="noreferrer">
                          Où trouver ma clé ?
                        </a>
                        {' · '}
                        <a href={selectedAiProvider.helpUrl} target="_blank" rel="noreferrer">
                          Guide {selectedAiProvider.name}
                        </a>
                        {' — '}La clé reste sur cet appareil.
                      </p>

                      <div className="settings-inline-actions">
                        <button
                          type="button"
                          onClick={() => void testClaudeKey()}
                          disabled={claudeTestState === 'testing' || !activeAiKey}
                        >
                          {claudeTestState === 'testing' ? (
                            <span className="inline-loading-label"><span className="inline-loader" aria-hidden="true" />Test en cours...</span>
                          ) : 'Tester la clé'}
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setChatOpen(true)}
                          disabled={!isBudgetAiConfigured}
                        >
                          Ouvrir le chat
                        </button>
                      </div>
                      {claudeTestMessage ? (
                        <p className={`claude-status-text claude-status-text--${claudeTestState}`}>
                          {claudeTestMessage}
                        </p>
                      ) : null}
                    </article>
                  </div>
                ) : null}

                {settingsSection === 'a11y' ? (
                  <div className="settings-section-grid settings-section-grid--single">
                    <article className="glass-card settings-section-card form-panel">
                      <div className="panel-title">
                        <h2>
                          ♿ Accessibilité
                         
                        </h2>
                        <p>Adaptez l'application à vos besoins de lecture et de confort.</p>
                      </div>

                      <span className="ai-provider-label">Taille du texte</span>
                      <div className="theme-picker">
                        {([
                          ['normal', 'Aa', 'Normale'],
                          ['large', 'Aa', 'Grande'],
                          ['xl', 'Aa', 'Très grande'],
                        ] as const).map(([value, icon, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`theme-option a11y-size-option a11y-size-option--${value}${a11yPrefs.textSize === value ? ' theme-option--active' : ''}`}
                            onClick={() => setA11yPrefs((previous) => ({ ...previous, textSize: value }))}
                          >
                            <span className="theme-option-icon">{icon}</span>
                            <span>{label}</span>
                            {a11yPrefs.textSize === value ? <span className="theme-option-state">✓</span> : null}
                          </button>
                        ))}
                      </div>

                      <label className="a11y-toggle">
                        <input
                          type="checkbox"
                          checked={a11yPrefs.reduceMotion}
                          onChange={(event) =>
                            setA11yPrefs((previous) => ({ ...previous, reduceMotion: event.target.checked }))
                          }
                        />
                        <span>
                          <strong>Réduire les animations</strong>
                          <small>Désactive les mouvements (coucou 👋, jauges animées, transitions).</small>
                        </span>
                      </label>

                      <label className="a11y-toggle">
                        <input
                          type="checkbox"
                          checked={a11yPrefs.highContrast}
                          onChange={(event) =>
                            setA11yPrefs((previous) => ({ ...previous, highContrast: event.target.checked }))
                          }
                        />
                        <span>
                          <strong>Contraste renforcé</strong>
                          <small>Textes secondaires plus foncés et bordures plus marquées.</small>
                        </span>
                      </label>

                    </article>
                  </div>
                ) : null}

                {settingsSection === 'report' ? (
                  <div className="settings-section-grid settings-section-grid--single">
                    <article className="glass-card settings-section-card form-panel">
                      <div className="panel-title">
                        <h2>📧 Rapport par email</h2>
                        <p>
                          Recevez automatiquement un résumé de vos finances sur {userEmail || 'votre adresse'} —
                          construit à partir de vos données synchronisées.
                        </p>
                      </div>
                      {reportPrefs.frequency !== 'none' ? (
                        <div className="report-current" role="status">
                          <strong>📬 Rapport programmé</strong>
                          <p>
                            {reportPrefs.frequency === 'weekly' ? 'Chaque semaine' : 'Chaque mois'}
                            {' · '}
                            {reportPrefs.format === 'detailed' ? 'détaillé' : "l'essentiel"}
                            {reportPrefs.attachment === 'none'
                              ? ''
                              : ` · ${reportPrefs.attachment === 'csv' ? 'CSV' : reportPrefs.attachment === 'excel' ? 'Excel' : 'PDF'} joint`}
                            {' — envoyé à '}
                            {userEmail || 'votre adresse'}
                            {reportPrefs.ccEmails.length > 0
                              ? ` + ${reportPrefs.ccEmails.length} adresse${reportPrefs.ccEmails.length > 1 ? 's' : ''} en copie`
                              : ''}
                          </p>
                          <small>
                            {reportPrefs.lastSentAt
                              ? `Dernier envoi : ${new Date(reportPrefs.lastSentAt).toLocaleDateString('fr-FR')}. `
                              : 'Aucun envoi automatique pour le moment. '}
                            Modifiez les réglages ci-dessous : ils sont enregistrés aussitôt.
                          </small>
                        </div>
                      ) : (
                        <div className="report-current report-current--off" role="status">
                          <strong>Aucun rapport programmé</strong>
                          <small>Choisissez une fréquence ci-dessous pour l'activer.</small>
                        </div>
                      )}
                      <label>
                        Fréquence
                        <select
                          value={reportPrefs.frequency}
                          onChange={(event) =>
                            void handleReportPrefsChange({
                              frequency: event.target.value as ReportPrefs['frequency'],
                              format: reportPrefs.format,
                            })
                          }
                        >
                          <option value="none">Jamais (désactivé)</option>
                          <option value="weekly">Chaque semaine</option>
                          <option value="monthly">Chaque mois (bilan du mois précédent)</option>
                        </select>
                      </label>
                      <label>
                        Contenu
                        <select
                          value={reportPrefs.format}
                          onChange={(event) =>
                            void handleReportPrefsChange({
                              frequency: reportPrefs.frequency,
                              format: event.target.value as ReportPrefs['format'],
                            })
                          }
                        >
                          <option value="summary">L'essentiel (totaux + top catégories)</option>
                          <option value="detailed">Détaillé (avec la liste des opérations)</option>
                        </select>
                      </label>
                      <label>
                        Pièce jointe
                        <select
                          value={reportPrefs.attachment}
                          onChange={(event) =>
                            void handleReportPrefsChange({
                              attachment: event.target.value as ReportPrefs['attachment'],
                            })
                          }
                        >
                          <option value="none">Aucune — tout est dans l'email</option>
                          <option value="pdf">PDF (à imprimer ou archiver)</option>
                          <option value="csv">CSV (à ouvrir dans un tableur)</option>
                          <option value="excel">Excel</option>
                        </select>
                      </label>
                      <label>
                        Envoyer une copie à (5 adresses max)
                        <input
                          type="text"
                          value={reportCcDraft}
                          onChange={(event) => setReportCcDraft(event.target.value)}
                          onBlur={(event) => handleReportCcCommit(event.target.value)}
                          placeholder="conjoint@exemple.fr, comptable@exemple.fr"
                          autoComplete="off"
                        />
                        <small className="field-hint">
                          Ces adresses reçoivent les rapports automatiques (pas le rapport test).
                        </small>
                      </label>
                      <div className="settings-inline-actions">
                        <button type="button" onClick={() => void handleSendTestReport()} disabled={reportBusy}>
                          {reportBusy ? 'Envoi…' : 'Recevoir un rapport test maintenant'}
                        </button>
                      </div>
                      {reportFeedback ? (
                        <p className={reportFeedback.kind === 'ok' ? 'auth-success' : 'auth-error'}>
                          {reportFeedback.text}
                        </p>
                      ) : null}
                    </article>
                  </div>
                ) : null}


                {settingsSection === 'backup' ? (
                  <div className="settings-section-grid">
                    <article className="glass-card settings-section-card form-panel">
                      <div className="panel-title">
                        <h2>Enregistrement en ligne</h2>
                        <p>Vos données suivent votre compte, sur tous vos appareils.</p>
                      </div>
                      <div className={`sync-status-card sync-status-card--${cloudSyncStatus}`} role="status">
                        {cloudSyncStatus === 'ok' ? (
                          <>
                            <strong>✅ Vos données sont enregistrées en ligne</strong>
                            <small>
                              Tout ce que vous ajoutez est copié automatiquement sur votre compte.
                              Connectez-vous depuis n'importe quel appareil pour les retrouver.
                            </small>
                          </>
                        ) : cloudSyncStatus === 'syncing' ? (
                          <>
                            <strong>☁️ Enregistrement en cours…</strong>
                            <small>Vos dernières modifications sont en train d'être copiées en ligne.</small>
                          </>
                        ) : cloudSyncStatus === 'error' ? (
                          <>
                            <strong>⚠️ Enregistrement en ligne impossible pour le moment</strong>
                            <small>
                              Pas d'inquiétude : tout reste enregistré sur cet appareil. La copie en
                              ligne reprendra automatiquement dès que la connexion reviendra.
                            </small>
                          </>
                        ) : (
                          <>
                            <strong>☁️ En attente de connexion</strong>
                            <small>
                              Vos données sont enregistrées sur cet appareil. La copie en ligne
                              démarre dès que vous êtes connecté.
                            </small>
                          </>
                        )}
                      </div>
                    </article>
                    <article className="glass-card settings-section-card form-panel">
                      <div className="panel-title">
                        <h2>
                          Sauvegarde de vos données
                          <InfoHint text="Le fichier exporté contient toutes vos données : gardez-le en lieu sûr, il permet de tout restaurer sur n'importe quel appareil." />
                        </h2>
                        <p>Exportez ou restaurez toutes vos données en un fichier.</p>
                      </div>
                      <div className="backup-zone backup-zone--standalone">
                        <div className="settings-inline-actions">
                          <button type="button" onClick={() => void handleExportEncryptedBackup()}>
                            Exporter ma sauvegarde
                          </button>
                          <button type="button" className="ghost-button" onClick={() => backupRestoreInputRef.current?.click()}>
                            Restaurer une sauvegarde
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
                        <h2>
                          Thème
                          <InfoHint text="Le mode Système suit automatiquement les préférences (clair/sombre) de votre appareil." />
                        </h2>
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
                      <div className="panel-title" style={{ marginTop: '0.9rem' }}>
                        <h2>Palette de couleurs</h2>
                        <p>La teinte d'accent utilisée par les boutons, liens et indicateurs.</p>
                      </div>
                      <div className="palette-picker" role="listbox" aria-label="Palettes de couleurs">
                        {COLOR_PALETTES.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            role="option"
                            aria-selected={palette === entry.id}
                            className={`palette-option${palette === entry.id ? ' palette-option--active' : ''}`}
                            onClick={() => setPalette(entry.id)}
                          >
                            <span className="palette-dots" aria-hidden="true">
                              <span style={{ background: entry.dots[0] }} />
                              <span style={{ background: entry.dots[1] }} />
                            </span>
                            <span>{entry.label}</span>
                            {palette === entry.id ? <span className="theme-option-state">✓</span> : null}
                          </button>
                        ))}
                      </div>
                    </article>
                  </div>
                ) : null}

                {settingsSection === 'account' ? (
                  <div className="settings-section-grid settings-section-grid--single">
                    <article className="glass-card settings-section-card">
                      <ProfilePanel
                        inline
                        userEmail={userEmail}
                        onEmailChanged={(newEmail) => setUserEmail(newEmail)}
                      />
                    </article>
                  </div>
                ) : null}

                {settingsSection === 'subscription' ? (() => {
                  const renewDate = subscription?.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })
                    : null
                  const quotaPct = aiQuota && aiQuota.limit > 0
                    ? Math.min(100, Math.round((aiQuota.used / aiQuota.limit) * 100))
                    : 0
                  const busyLabel = (key: string, label: string) =>
                    checkoutBusy === key ? (
                      <span className="inline-loading-label"><span className="inline-loader" aria-hidden="true" />Ouverture…</span>
                    ) : label
                  return (
                    <div className="settings-section-grid settings-section-grid--single">
                      <article className="glass-card settings-section-card form-panel">
                        <div className="panel-title">
                          <h2>Abonnement</h2>
                          <p>Votre formule actuelle, votre quota IA inclus et les options pour évoluer.</p>
                        </div>

                        <div className={`subscription-current subscription-current--${userPlan}`}>
                          <strong>
                            {userPlan === 'premium' ? '⭐ Premium' : userPlan === 'family' ? '👨‍👩‍👧 Famille' : '🌱 Découverte — gratuit'}
                          </strong>
                          <small>
                            {userPlan === 'free'
                              ? premiumAccess.reason === 'trial'
                                ? premiumAccess.unlocked && premiumAccess.trialEndsAt
                                  ? `Essai complet jusqu'au ${premiumAccess.trialEndsAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}. Ensuite : 3 poches, 1 profil, sans rapport email.`
                                  : 'Essai terminé — plan Découverte : 3 poches, 1 profil, sans rapport email. Passez Premium pour tout retrouver.'
                                : 'Vous profitez de la période de lancement : toutes les fonctionnalités sont offertes aux premiers inscrits.'
                              : subscription?.cancelAtPeriodEnd
                                ? `Résiliation programmée — accès jusqu'au ${renewDate ?? 'terme en cours'}.`
                                : renewDate
                                  ? `Abonnement actif — renouvellement le ${renewDate}.`
                                  : 'Abonnement actif.'}
                          </small>
                        </div>

                        {canUseIncludedAi ? (
                          <div className="ai-quota-box">
                            <div className="ai-quota-box__head">
                              <strong>🤖 IA incluse (Cash)</strong>
                              <span>{aiQuota ? `${aiQuota.used} / ${aiQuota.limit} messages ce mois-ci` : 'Chargement…'}</span>
                            </div>
                            <div className="ai-quota-bar" role="progressbar" aria-valuenow={quotaPct} aria-valuemin={0} aria-valuemax={100}>
                              <span style={{ width: `${quotaPct}%` }} />
                            </div>
                            <small>Votre clé API personnelle (Paramètres → Assistant IA) reste utilisable sans quota.</small>
                          </div>
                        ) : null}

                        {userPlan !== 'family' ? (
                          <div className="subscription-plans">
                            {userPlan === 'free' ? (
                              <div className="subscription-plan subscription-plan--highlight">
                                <div className="subscription-plan__head">
                                  <strong>⭐ Premium</strong>
                                  <span>3,99 €/mois</span>
                                </div>
                                <p>IA complète (300 messages/mois), poches et profils illimités, rapports email automatiques.</p>
                                <div className="subscription-plan__actions">
                                  <button type="button" className="hero-cta-button" disabled={checkoutBusy !== null} onClick={() => void handleStartCheckout('premium', 'monthly')}>
                                    {busyLabel('premium-monthly', 'Passer Premium — 3,99 €/mois')}
                                  </button>
                                  <button type="button" className="ghost-button" disabled={checkoutBusy !== null} onClick={() => void handleStartCheckout('premium', 'yearly')}>
                                    {busyLabel('premium-yearly', '29,99 €/an (−37 %)')}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                            <div className="subscription-plan">
                              <div className="subscription-plan__head">
                                <strong>👨‍👩‍👧 Famille</strong>
                                <span>5,99 €/mois</span>
                              </div>
                              <p>Tout Premium, jusqu'à 5 membres du foyer, vue famille fusionnée, 500 messages IA/mois.</p>
                              <div className="subscription-plan__actions">
                                <button type="button" className="hero-cta-button" disabled={checkoutBusy !== null} onClick={() => void handleStartCheckout('family', 'monthly')}>
                                  {busyLabel('family-monthly', 'Choisir Famille — 5,99 €/mois')}
                                </button>
                                <button type="button" className="ghost-button" disabled={checkoutBusy !== null} onClick={() => void handleStartCheckout('family', 'yearly')}>
                                  {busyLabel('family-yearly', '44,99 €/an')}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {userPlan !== 'free' ? (
                          <div className="settings-inline-actions">
                            <button type="button" className="ghost-button" disabled={checkoutBusy !== null} onClick={() => void handleOpenBillingPortal()}>
                              {busyLabel('portal', '🧾 Gérer mon abonnement (factures, résiliation)')}
                            </button>
                          </div>
                        ) : null}

                        <p className="auth-note">
                          Paiement sécurisé par Stripe. Résiliable en un clic, sans engagement — vos données restent à vous, quel que soit le plan.
                        </p>
                      </article>
                    </div>
                  )
                })() : null}

                {settingsSection === 'rgpd' ? (
                  <div className="settings-section-grid">
                    <article className="glass-card settings-section-card form-panel">
                      <div className="panel-title">
                        <h2>
                          Mes données RGPD
                          <InfoHint text="Vos données restent stockées sur cet appareil et dans votre espace personnel sécurisé." />
                        </h2>
                        <p>
                          Consultez, exportez ou supprimez vos données personnelles : export complet,
                          journal d'activité, suppression du compte.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="hero-cta-button"
                        onClick={() => {
                          if (blockInDemo('les données RGPD')) return
                          setShowPrivacyPanel(true)
                        }}
                      >
                        🔒 Ouvrir mes données RGPD
                      </button>
                    </article>
                  </div>
                ) : null}

                {settingsSection === 'reset' ? (
                  <div className="settings-section-grid">
                    <article className="glass-card settings-section-card form-panel danger-zone danger-zone--standalone">
                      <h3>⚠️ Tout remettre à zéro</h3>
                      <p className="auth-note">
                        Efface toutes les données enregistrées sur cet appareil : opérations,
                        profils, poches, objectifs et réglages. L'application repart comme au
                        premier jour.
                      </p>
                      <p className="auth-note">
                        💡 Pensez à exporter une sauvegarde avant (Paramètres → Sauvegarde) si
                        vous voulez pouvoir revenir en arrière.
                      </p>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => {
                          if (blockInDemo('la réinitialisation')) return
                          setShowResetConfirmModal(true)
                        }}
                      >
                        Réinitialiser les données locales
                      </button>
                    </article>
                  </div>
                ) : null}
              </div>
            </div>
            <footer className="settings-legal-footer">
              <button type="button" className="auth-rgpd-link" onClick={() => setLegalDoc('terms')}>
                Conditions d'utilisation
              </button>
              {' · '}
              <button type="button" className="auth-rgpd-link" onClick={() => setLegalDoc('privacy')}>
                Politique de confidentialité &amp; mentions légales
              </button>
              <span className="settings-legal-credit"> · Fait par ProtoJo Digital</span>
            </footer>
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
                <span className="recent-tx-dot" style={{ background: colorForCategory(entry.name) }} aria-hidden="true" />
                <span className="operations-category-name">{entry.name}</span>
                <small className="operations-category-share">
                  {monthlyExpense > 0 ? `${Math.round((entry.value / monthlyExpense) * 100)}%` : ''}
                </small>
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
            <h2>Comparaison avec l’an dernier</h2>
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
            <div>
              <h2>Transactions du mois</h2>
              <p>{txFiltered.length} opération{txFiltered.length !== 1 ? 's' : ''} · {formatMonth(selectedMonth)} · {selectedProfileName.toLowerCase()}</p>
            </div>
            <button
              type="button"
              className="hero-cta-button"
              onClick={() => setShowHistoryPanel(true)}
              title="Recherche, filtres, édition, export CSV sur tout l'historique"
            >
              <Layers3 size={14} />
              Voir tout l'historique
            </button>
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
                    <p>
                      <MerchantLogo label={item.label} fallbackIcon={item.icon ?? categoryEmoji(item.category)} />
                      {item.label}
                      {item.recurringRuleId ? <span className="recurring-badge" title="Générée automatiquement (charge récurrente)">🔁</span> : null}
                    </p>
                    <small>
                      {item.date} · {item.category} · {item.envelope}
                      {(item.tags ?? []).map((tag) => (
                        <span key={tag} className="tx-tag">#{tag}</span>
                      ))}
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
                    // Reset accountId : il sera re-résolvé vers le compte par défaut
                    // du nouveau membre au submit (cf. resolvedAccountId).
                    accountId: '',
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
              Compte
              <select
                value={form.accountId}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, accountId: event.target.value }))
                }
              >
                <option value="">— compte par défaut —</option>
                {accounts
                  .filter((a) => a.ownerMember === form.member && a.archivedAt === null)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
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

      {isActiveView('stats') ? (
        <StatsView
          statsMonth={statsMonth}
          setStatsMonth={setStatsMonth}
          statsSelectedWeek={statsSelectedWeek}
          setStatsSelectedWeek={setStatsSelectedWeek}
          todayIso={todayIso}
          formatMonth={formatMonth}
          statsViewData={statsViewData}
          statsMonthWeeks={statsMonthWeeks}
          statsWeekDaily={statsWeekDaily}
          statsChartRef={statsChartRef}
          exportWeeklyStatsPdf={exportWeeklyStatsPdf}
        />
      ) : null}

      {isActiveView('operations') || isActiveView('budget') ? (
      <section id="pilotage" className="panel-grid">
        {isActiveView('budget') ? (
        <article id="budget" className={`glass-card chart-card wide-card${budgetSimpleMode ? ' budget-senior-mode' : ''}`} ref={budgetInfoScopeRef}>
          <div className="panel-title">
            <div className="budget-title-row">
              <h2>
                <span className="budget-title-main">
                  Mon budget ·{' '}
                  <span className="budget-title-month-nav">
                    <button type="button" onClick={() => navigateMonth(-1)} aria-label="Mois précédent">‹</button>
                    <span>{formatMonth(selectedMonth)}</span>
                    <button type="button" onClick={() => navigateMonth(1)} aria-label="Mois suivant">›</button>
                  </span>
                </span>
              </h2>
            </div>
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
              <strong className="budget-simple-value-row">
                {euroFormatter.format(budget)}
                <button
                  type="button"
                  className="budget-edit-icon"
                  onClick={openQuickBudgetEditor}
                  aria-label="Ajuster mon budget"
                  title="Ajuster mon budget"
                >
                  <Pencil size={14} />
                </button>
              </strong>
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
          {profiles.length > 1 ? (
            <p className="budget-profile-split">
              <span className="budget-profile-split__label">Répartition par profil :</span>{' '}
              {profiles.map((profile) => `${profile.name} ${euroFormatter.format(profile.monthlyBudget)}`).join('  ·  ')}
            </p>
          ) : null}
          {/* Bloc de statut unifié : état + % utilisé + score santé + projection. */}
          <div className="budget-status-summary" style={{ borderColor: budgetStatusColor }} role="status" aria-live="polite">
            <div className="budget-status-summary__head">
              <span className="budget-status-summary__state">
                <span className="budget-status-dot" style={{ background: budgetStatusColor }} />
                État : <strong>{budgetStatusLabel}</strong>
                <span className="budget-status-summary__usage">· {usageRate.toFixed(0)}% utilisé</span>
              </span>
              <span
                className="budget-status-summary__score"
                style={{ color: budgetHealthColor }}
                title={`Santé budget : ${budgetHealthLabel}`}
              >
                Santé {budgetMasteryScore}/100
              </span>
            </div>
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
            <small className="budget-projection-note">{projectedMessage}</small>
          </div>
          {budgetInsights.length > 0 ? (
            <div className="budget-insights">
              <h3>À retenir</h3>
              <ul>
                {budgetInsights.map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>
            </div>
          ) : null}
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

        {isActiveView('budget') ? (
        <article className="glass-card chart-card wide-card envelope-board">
          <div className="panel-title">
            <div>
              <h2>✉️ Mes poches</h2>
              <p>La météo de chaque poche — appuyez sur une poche pour la gérer.</p>
            </div>
          </div>
          <div className="envelope-grid">
            {envelopeCards.map((card, index) => (
              <button
                type="button"
                key={card.name}
                className={`envelope-card envelope-card--${card.weather.tone}${envelopeOpenName === card.name ? ' envelope-card--open' : ''}`}
                style={{ animationDelay: `${index * 70}ms` }}
                onClick={() => openEnvelopeModal(card.name)}
                aria-label={`Gérer la poche ${card.name}`}
              >
                <div className="envelope-card__flap" aria-hidden="true" />
                <div className="envelope-card__body">
                  <div className="envelope-card__top">
                    <strong className="envelope-card__name">{card.name}</strong>
                    <span
                      className={`envelope-card__weather envelope-card__weather--${card.weather.tone}`}
                      title={card.weather.label}
                      aria-label={card.weather.label}
                    >
                      {card.weather.icon}
                    </span>
                  </div>
                  <p className="envelope-card__spent">
                    −{euroFormatter.format(card.spent)}
                    <small> dépensés ce mois-ci</small>
                  </p>
                  <small className="envelope-card__fund-line">
                    💰 Dans la poche :{' '}
                    <strong className={card.inside >= 0 ? 'income' : 'expense'}>{euroFormatter.format(card.inside)}</strong>
                  </small>
                  {card.target > 0 ? (
                    <div className="envelope-card__bar" aria-hidden="true">
                      <div
                        className={`envelope-card__bar-fill envelope-card__bar-fill--${card.weather.tone}`}
                        style={{ width: `${Math.min(100, ((card.ratio ?? 0) * 100))}%` }}
                      />
                    </div>
                  ) : null}
                  <small className="envelope-card__target-line">
                    🎯 {card.target > 0
                      ? `Objectif : ${euroFormatter.format(card.target)} — ${Math.round((card.ratio ?? 0) * 100)}% utilisé`
                      : 'Pas encore d\u2019objectif'}
                  </small>
                  <small className="envelope-card__forecast">{card.weather.label}</small>
                </div>
              </button>
            ))}
            <button
              type="button"
              className="envelope-card envelope-card--new"
              onClick={() => {
                setEnvModalName('')
                setEnvModalTarget('')
                setEnvModalAdd('')
                setEnvModalDeleteAsk(false)
                setEnvelopeModal({ mode: 'create', name: '' })
              }}
            >
              <div className="envelope-card__body envelope-card__body--new">
                <span className="envelope-card__new-plus" aria-hidden="true">＋</span>
                <strong>Nouvelle poche</strong>
              </div>
            </button>
          </div>
        </article>
        ) : null}
        {isPilotageWidgetVisible('alerts') && isActiveView('budget') ? (
        <article className="glass-card chart-card">
          <div className="panel-title">
            <h2>Alertes</h2>
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

        {isPilotageWidgetVisible('savingsGoals') && isActiveView('budget') ? (
        <article className="glass-card chart-card">
          <div className="panel-title">
            <h2>Budgets par catégorie</h2>
            <p>Plafond mensuel par catégorie — {selectedProfileName}</p>
          </div>
          <ul className="goal-list goal-list--v2">
            {goalProgress.map((goal) => {
              const tone = goal.rate <= 70 ? 'sun' : goal.rate <= 90 ? 'cloud' : goal.rate <= 100 ? 'rain' : 'storm'
              return (
                <li key={goal.category}>
                  <div className="goal-row-head">
                    <span className="recent-tx-dot" style={{ background: colorForCategory(goal.category) }} aria-hidden="true" />
                    <strong className="goal-row-name">{goal.category}</strong>
                    {goalRowEditing === goal.category ? (
                      <span className="goal-row-edit">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="10"
                          value={goalRowDraft}
                          onChange={(event) => setGoalRowDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              const amount = Number(goalRowDraft)
                              if (amount > 0) {
                                setSavingsGoals((previous) => ({
                                  ...previous,
                                  [selectedProfileId]: {
                                    ...(previous[selectedProfileId] ?? defaultGoalTemplate),
                                    [goal.category]: Math.round(amount),
                                  },
                                }))
                              }
                              setGoalRowEditing(null)
                            }
                            if (event.key === 'Escape') setGoalRowEditing(null)
                          }}
                          onBlur={() => {
                            const amount = Number(goalRowDraft)
                            if (amount > 0) {
                              setSavingsGoals((previous) => ({
                                ...previous,
                                [selectedProfileId]: {
                                  ...(previous[selectedProfileId] ?? defaultGoalTemplate),
                                  [goal.category]: Math.round(amount),
                                },
                              }))
                            }
                            setGoalRowEditing(null)
                          }}
                          aria-label={`Plafond mensuel pour ${goal.category} (euros)`}
                          autoFocus
                        />
                        <small>€</small>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="goal-row-amount"
                        onClick={() => {
                          setGoalRowDraft(String(goal.target))
                          setGoalRowEditing(goal.category)
                        }}
                        title="Modifier le plafond"
                      >
                        {euroFormatter.format(goal.spent)} <small>/ {euroFormatter.format(goal.target)}</small>
                      </button>
                    )}
                    <span className={`goal-row-rate goal-row-rate--${tone}`}>{goal.rate.toFixed(0)}%</span>
                  </div>
                  <div className="goal-progress-track goal-progress-track--v2">
                    <span className={`goal-progress-fill--${tone}`} style={{ width: `${Math.min(100, goal.rate)}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="goal-list-hint">Appuyez sur un montant pour ajuster le plafond de la catégorie.</p>
        </article>
        ) : null}

        {isPilotageWidgetVisible('recurringCharges') && isActiveView('budget') ? (
        <article className="glass-card chart-card">
          <div className="panel-title">
            <div>
              <h2>Charges récurrentes</h2>
              <p>Transactions détectées sur 2+ mois pour {selectedProfileName.toLowerCase()}</p>
            </div>
            <button
              type="button"
              className="hero-cta-button"
              onClick={() => setShowRecurringPanel(true)}
            >
              <Repeat2 size={14} />
              Gérer les règles ({recurringRules.filter((r) => r.member === selectedProfileId).length})
            </button>
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

        {isPilotageWidgetVisible('savingsProjects') && isActiveView('budget') ? (
        <article className="glass-card chart-card">
          <div className="panel-title">
            <div>
              <h2>Projets d'épargne</h2>
              <p>Projets financiers et leur progression estimée</p>
            </div>
            <button
              type="button"
              className="hero-cta-button"
              onClick={() => setShowGoalsPanel(true)}
              title="Échéance, mensualité conseillée, lien vers un compte dédié"
            >
              <Target size={14} />
              Gérer ({savingsTargets.length})
            </button>
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

        {isActiveView('budget') ? (
        <article className="glass-card chart-card accounts-widget">
          <div className="panel-title">
            <div>
              <h2>Comptes</h2>
              <p>Solde consolidé pour {selectedProfileName.toLowerCase()}</p>
            </div>
            <button
              type="button"
              className="hero-cta-button"
              onClick={() => setShowAccountsPanel(true)}
            >
              <Landmark size={14} />
              Gérer ({accounts.filter((a) => a.ownerMember === selectedProfileId && a.archivedAt === null).length})
            </button>
          </div>
          {(() => {
            const consolidated = computeConsolidatedBalance(accounts, transactions, selectedProfileId)
            const breakdown = balanceByAccountType(accounts, transactions, selectedProfileId)
            const nonZeroTypes = (Object.entries(breakdown) as Array<[keyof typeof breakdown, number]>)
              .filter(([, amount]) => amount !== 0)
            return (
              <div className="accounts-widget-body">
                <div className={`accounts-widget-total ${consolidated >= 0 ? 'is-positive' : 'is-negative'}`}>
                  <span>{euroFormatter.format(consolidated)}</span>
                  <small>Patrimoine net (hors investissement non liquide)</small>
                </div>
                {nonZeroTypes.length > 0 ? (
                  <ul className="accounts-widget-breakdown">
                    {nonZeroTypes.map(([type, amount]) => (
                      <li key={type}>
                        <span className="accounts-widget-type">
                          <span aria-hidden="true">
                            {({ checking: '🏦', savings: '💰', cash: '💵', envelope: '✉️', credit_card: '💳', investment: '📈' } as Record<string, string>)[type] ?? '🏦'}
                          </span>{' '}
                          {ACCOUNT_TYPE_LABELS[type]}
                        </span>
                        <span className={amount >= 0 ? 'is-positive' : 'is-negative'}>
                          {euroFormatter.format(amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="auth-note">Aucun compte avec un solde non nul. Cliquez sur « Gérer » pour ajouter un compte.</p>
                )}
              </div>
            )
          })()}
        </article>
        ) : null}

        {isPilotageWidgetVisible('coaching') && isActiveView('budget') ? (
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
          {cashAiReady ? (
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

        {isPilotageWidgetVisible('csvImport') && isActiveView('operations') ? (
        <article className="glass-card form-panel wide-card">
          <div className="panel-title">
            <h2>Importer un relevé bancaire</h2>
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
                  <p className="auth-note">Vérifiez les lignes avant de les ajouter à vos dépenses</p>
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







        {dashboardWidgetState.visibleWidgets.length === 0 && isActiveView('operations') ? (
          <article className="glass-card chart-card wide-card">
            <div className="panel-title">
              <h2>Aucun bloc actif</h2>
              <p>Activez au moins un bloc ou choisissez un modèle.</p>
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
                    <Cell key={entry.name} fill={colorForCategory(entry.name)} />
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

      </div>

      {isActiveView('operations') ? (
      <aside className="glass-card budget-advice-rail dashboard-right-rail ops-rail" aria-label="Repères dépenses">
        <div className="ops-rail__section">{renderCashAdvice()}</div>
        <div className="ops-rail__section">
          <div className="ops-rail__week-head">
            <span>⏳ À venir · semaine du {upcomingCharges.rangeLabel}</span>
            {upcomingCharges.totalSpent > 0 ? (
              <strong className="expense">−{euroFormatter.format(upcomingCharges.totalSpent)}</strong>
            ) : null}
          </div>
          {upcomingCharges.items.length === 0 ? (
            <p className="ops-rail__empty">Aucune échéance la semaine prochaine.</p>
          ) : (
            <ul className="ops-rail__list">
              {upcomingCharges.items.map((item) => (
                <li key={`${item.date}-${item.label}-${item.amount}`}>
                  <span className="ops-rail__date">
                    {new Date(`${item.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                  </span>
                  <MerchantLogo label={item.label} fallbackIcon={categoryEmoji(item.category)} className="ops-rail__icon" />
                  <span className="ops-rail__label">{item.label}</span>
                  <strong className={item.kind === 'revenu' ? 'income' : 'expense'}>
                    {item.kind === 'revenu' ? '+' : '−'}{euroFormatter.format(item.amount)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="ops-rail__section">
          <p className="eyebrow">🔝 Plus grosses dépenses du mois</p>
          {topExpensesMonth.length === 0 ? (
            <p className="ops-rail__empty">Aucune dépense ce mois-ci.</p>
          ) : (
            <ul className="ops-rail__list">
              {topExpensesMonth.map((tx) => (
                <li key={tx.id}>
                  <MerchantLogo label={tx.label} fallbackIcon={tx.icon ?? categoryEmoji(tx.category)} className="ops-rail__icon" />
                  <span className="ops-rail__label">
                    {tx.label}
                    <small>{tx.category}</small>
                  </span>
                  <strong className="expense">−{euroFormatter.format(tx.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
        {topTags.length > 0 ? (
          <div className="ops-rail__section">
            <p className="eyebrow">🏷️ Tags du mois</p>
            <div className="ops-rail__tags">
              {topTags.map(([tag, count]) => (
                <button key={tag} type="button" onClick={() => setTxSearch(tag)} title={`Filtrer les transactions « ${tag} »`}>
                  #{tag} <small>{count}</small>
                </button>
              ))}
            </div>
            <small className="ops-rail__hint">Un clic filtre la liste des transactions.</small>
          </div>
        ) : null}
      </aside>
      ) : null}

      {isActiveView('stats') ? (
      <aside className="glass-card budget-advice-rail dashboard-right-rail overview-coaching-rail" aria-label="Assistant">
        {renderCashAdvice()}
      </aside>
      ) : null}

      {isActiveView('overview') || isActiveView('family') || isActiveView('budget') ? (
      <aside className="glass-card budget-advice-rail dashboard-right-rail overview-coaching-rail" aria-label="Assistant">
        {renderCashAdvice()}
      </aside>
      ) : null}

    </main>

    {/* ── Cash, l'assistant (chat) ───────────────────────────────── */}
    {isAuthenticated && isBudgetAiConfigured ? (
      <CashChatPanel
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        chatNudgeVisible={chatNudgeVisible}
        setChatNudgeVisible={setChatNudgeVisible}
        chatMessages={chatMessages}
        chatLoading={chatLoading}
        chatInput={chatInput}
        setChatInput={setChatInput}
        chatInputRef={chatInputRef}
        chatEndRef={chatEndRef}
        chatScrollRef={chatScrollRef}
        chatScrollHints={chatScrollHints}
        updateChatScrollHints={updateChatScrollHints}
        chatClearConfirmOpen={chatClearConfirmOpen}
        setChatClearConfirmOpen={setChatClearConfirmOpen}
        clearChatConversation={clearChatConversation}
        chatUndoToastOpen={chatUndoToastOpen}
        lastDeletedChat={lastDeletedChat}
        chatHistoryStorageKey={chatHistoryStorageKey}
        restoreLastDeletedChat={restoreLastDeletedChat}
        chatAttachment={chatAttachment}
        setChatAttachment={setChatAttachment}
        chatFileInputRef={chatFileInputRef}
        handleChatFile={handleChatFile}
        dictationAvailable={Boolean(speechRecognitionCtor)}
        chatListening={chatListening}
        toggleChatDictation={toggleChatDictation}
        sendChatMessage={sendChatMessage}
      />
    ) : null}

    {/* ── Modale de gestion d'une poche ──────────────────────────── */}
    {envelopeModal ? (
      <EnvelopeModal
        envelopeModal={envelopeModal}
        envModalName={envModalName}
        setEnvModalName={setEnvModalName}
        envModalTarget={envModalTarget}
        setEnvModalTarget={setEnvModalTarget}
        envModalAdd={envModalAdd}
        setEnvModalAdd={setEnvModalAdd}
        envModalDeleteAsk={envModalDeleteAsk}
        setEnvModalDeleteAsk={setEnvModalDeleteAsk}
        closeEnvelopeModal={closeEnvelopeModal}
        createEnvelope={createEnvelope}
        deleteEnvelope={deleteEnvelope}
        onSave={saveEnvelopeModal}
      />
    ) : null}

    {/* ── Toast notifications ───────────────────────────────────── */}
    {toast ? (
      <div
        key={toast.key}
        className={`app-toast app-toast--${toast.level}`}
        role={toast.level === 'info' ? 'status' : 'alert'}
        aria-live={toast.level === 'info' ? 'polite' : 'assertive'}
      >
        {toast.message}
      </div>
    ) : null}

    {/* ── Panneau de gestion des dépenses récurrentes ───────────── */}
    {showRecurringPanel ? (
      <RecurringRulesPanel
        rules={recurringRules}
        onChange={setRecurringRules}
        member={selectedProfileId}
        onClose={() => setShowRecurringPanel(false)}
      />
    ) : null}

    {/* ── Tour de bienvenue : définir le budget mensuel ──────────── */}
    {showFirstTxTour && !showOnboarding ? (
      <FirstBudgetTour
        currentBudget={selectedProfile.monthlyBudget}
        onSubmit={(value) => completeFirstTxTour(value)}
        onSkip={() => completeFirstTxTour()}
      />
    ) : null}

    {/* ── Panneau de gestion des comptes ─────────────────────────── */}
    {showAccountsPanel ? (
      <AccountsPanel
        accounts={accounts}
        transactions={transactions}
        onChange={setAccounts}
        member={selectedProfileId}
        onClose={() => setShowAccountsPanel(false)}
      />
    ) : null}

    {/* ── Historique complet des transactions ────────────────────── */}
    {showHistoryPanel ? (
      <TransactionHistoryPanel
        transactions={transactions}
        accounts={accounts}
        member={selectedProfileId}
        onChange={setTransactions}
        onClose={() => setShowHistoryPanel(false)}
      />
    ) : null}

    {/* ── Panneau RGPD : export + suppression compte ─────────────── */}
    {/* ── Ajout rapide de dépense depuis le calendrier ────────────── */}
    {quickAddDate ? (
      <QuickAddModal
        quickAddDate={quickAddDate}
        setQuickAddDate={setQuickAddDate}
        closeQuickAdd={closeQuickAdd}
        quickAddForm={quickAddForm}
        setQuickAddForm={setQuickAddForm}
        quickAddEditingId={quickAddEditingId}
        editingHasActiveRule={
          quickAddEditingId !== null && Boolean(activeRuleOf(transactions.find((tx) => tx.id === quickAddEditingId)))
        }
        handleQuickAddSubmit={handleQuickAddSubmit}
        quickAddTouchedRef={quickAddTouchedRef}
        scheduleQuickAddAi={scheduleQuickAddAi}
        quickAddAiBusy={quickAddAiBusy}
        quickAddAiApplied={quickAddAiApplied}
        envelopeGroupsWithCustom={envelopeGroupsWithCustom}
        isBudgetAiConfigured={isBudgetAiConfigured}
        onConfigureAi={() => {
          closeQuickAdd()
          openSettingsPanel('ai')
        }}
        quickAddDeleteAsk={quickAddDeleteAsk}
        setQuickAddDeleteAsk={setQuickAddDeleteAsk}
        deleteTransaction={deleteTransaction}
        formatMonth={formatMonth}
      />
    ) : null}

    {showPrivacyPanel ? (
      <PrivacyPanel
        userEmail={userEmail}
        transactions={transactions}
        accounts={accounts}
        recurringRules={recurringRules}
        savingsGoals={savingsTargets}
        onAccountDeleted={() => {
          setShowPrivacyPanel(false)
          // signOut déjà fait dans le panel, l'auth listener bascule
          // setIsAuthenticated à false → retour AuthScreen
        }}
        onOpenPrivacy={() => setLegalDoc('privacy')}
        onOpenTerms={() => setLegalDoc('terms')}
        onClose={() => setShowPrivacyPanel(false)}
      />
    ) : null}

    {/* ── Modal Privacy Policy / CGU (accessible depuis PrivacyPanel) */}
    {legalDoc ? (
      <PrivacyPolicyModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    ) : null}

    {/* ── Panneau Profil (Art. 16 — rectification email/display_name) */}
    {showProfilePanel ? (
      <ProfilePanel
        userEmail={userEmail}
        onEmailChanged={(newEmail) => {
          // Optimistic UI : on met à jour l'email affiché en local.
          // Tant que l'user n'a pas confirmé via les 2 emails, la session
          // garde l'ancien email côté Supabase.
          setUserEmail(newEmail)
        }}
        onClose={() => setShowProfilePanel(false)}
      />
    ) : null}

    {/* ── Panneau Objectifs d'épargne ─────────────────────────────── */}
    {showGoalsPanel ? (
      <SavingsGoalsPanel
        goals={savingsTargets}
        accounts={accounts}
        transactions={transactions}
        member={selectedProfileId}
        onChange={(next) => {
          setSavingsTargets(next)
          window.localStorage.setItem(SAVINGS_TARGETS_STORAGE_KEY, JSON.stringify(next))
        }}
        onClose={() => setShowGoalsPanel(false)}
      />
    ) : null}
    </>
  )
}

export default App
