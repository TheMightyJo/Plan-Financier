import { isSupabaseConfigured, supabase } from '../supabase'

/**
 * Synchronisation « documents » : les clés localStorage qui portent les
 * données du compte (profils, poches, objectifs, règles, notes, plafonds,
 * préférences) sont copiées telles quelles dans public.user_documents,
 * une ligne par clé. Dernier écrit gagne, clé par clé.
 *
 * - Écritures : Storage.prototype.setItem/removeItem sont enveloppés une
 *   fois (installDocumentSync) ; toute écriture sur une clé suivie marque
 *   la clé « à pousser » et déclenche un push différé (2,5 s).
 * - Connexion : pullDocuments() applique les documents distants plus
 *   récents que ce que l'appareil a déjà vu, puis l'app se recharge pour
 *   relire son état.
 *
 * Les opérations et les comptes ont leur propre synchronisation
 * relationnelle (cloudSync) et ne passent pas par ici.
 */

export const DOCUMENT_KEYS = [
  'plan-financier-profiles-v1',
  'plan-financier-active-profile-v1',
  'plan-financier-default-profile-v1',
  'plan-financier-savings-targets-v1',
  'plan-financier-envelope-budgets-v1',
  'plan-financier-envelope-funds-v1',
  'plan-financier-custom-envelopes-v1',
  'plan-financier-custom-categories-v1',
  'plan-financier-view-layout-v1',
  'plan-financier-notes-v1',
  'plan-financier-goals-v1',
  'plan-financier-rollover-v1',
  'plan-financier-csv-mappings-v1',
  'plan-financier-recurring-rules-v1',
  'plan-financier-recurring-dismissed-v1',
  'plan-financier-onboarding-done-v1',
  'plan-financier-first-tx-tour-done-v1',
  'plan-financier-start-checklist-done-v1',
  'plan-financier-feature-tour-done-v1',
  'plan-financier-dashboard-widgets-v1',
  'plan-financier-chat-threads-v1',
] as const

export const DOC_SYNC_META_KEY = 'plan-financier-doc-sync-meta-v1'
const PUSH_DELAY_MS = 2_500
const RETRY_DELAY_MS = 60_000
const TABLE = 'user_documents'

export type DocumentKey = (typeof DOCUMENT_KEYS)[number]
export const isDocumentKey = (key: string): key is DocumentKey =>
  (DOCUMENT_KEYS as readonly string[]).includes(key)

export type MetaEntry = {
  /** updated_at distant vu en dernier (ISO). */
  remote?: string
  /** Empreinte de la valeur locale au dernier alignement local/distant. */
  hash?: string
  /** Horodatage local de la dernière écriture non poussée. */
  dirtyAt?: number
}
export type SyncMeta = Record<string, MetaEntry>

export type RemoteDocument = { key: string; value: string | null; updated_at: string }

/** Empreinte courte et stable d'une valeur (djb2 + longueur). */
export const hashValue = (value: string | null): string => {
  if (value === null) return 'null'
  let h = 5381
  for (let i = 0; i < value.length; i++) h = (Math.imul(h, 33) + value.charCodeAt(i)) >>> 0
  return `${h.toString(16)}:${value.length}`
}

export type PullPlan = {
  /** Documents à appliquer localement (value null = supprimer la clé). */
  apply: Array<{ key: string; value: string | null; updated_at: string }>
  /** Clés vues sans changement (méta à aligner). */
  seen: Array<{ key: string; updated_at: string; hash: string }>
}

/**
 * Décide, pour chaque document distant, s'il doit écraser la copie locale :
 * - déjà vu (même updated_at) → rien ;
 * - modification locale non poussée plus récente que le distant → le local
 *   gagne (il sera poussé) ;
 * - même contenu → on aligne seulement la méta ;
 * - sinon → on applique le distant.
 */
export const planPull = (
  rows: RemoteDocument[],
  meta: SyncMeta,
  local: Record<string, string | null>,
): PullPlan => {
  const plan: PullPlan = { apply: [], seen: [] }
  for (const row of rows) {
    if (!isDocumentKey(row.key)) continue
    const entry = meta[row.key]
    if (entry?.remote === row.updated_at) continue
    const remoteTime = Date.parse(row.updated_at)
    if (entry?.dirtyAt && entry.dirtyAt > remoteTime) continue
    const localValue = local[row.key] ?? null
    if (localValue === row.value) {
      plan.seen.push({ key: row.key, updated_at: row.updated_at, hash: hashValue(row.value) })
      continue
    }
    plan.apply.push({ key: row.key, value: row.value, updated_at: row.updated_at })
  }
  return plan
}

// ── État module ───────────────────────────────────────────────────────────

let installed = false
let applying = false
let currentUserId: string | null = null
let timer: number | null = null
const dirtyKeys = new Set<string>()
const pulledFor = new Set<string>()

const readMeta = (): SyncMeta => {
  try {
    const raw = window.localStorage.getItem(DOC_SYNC_META_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' ? (parsed as SyncMeta) : {}
  } catch {
    return {}
  }
}

const writeMeta = (meta: SyncMeta) => {
  try {
    window.localStorage.setItem(DOC_SYNC_META_KEY, JSON.stringify(meta))
  } catch {
    /* stockage indisponible */
  }
}

const schedulePush = () => {
  if (!currentUserId || dirtyKeys.size === 0) return
  if (timer !== null) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    timer = null
    void flushDocuments()
  }, PUSH_DELAY_MS)
}

const markDirty = (key: string) => {
  if (!currentUserId || applying) return
  const meta = readMeta()
  meta[key] = { ...meta[key], dirtyAt: Date.now() }
  writeMeta(meta)
  dirtyKeys.add(key)
  schedulePush()
}

/** À appeler une fois au démarrage (avant tout rendu). */
export const installDocumentSync = (): void => {
  if (installed || typeof window === 'undefined') return
  installed = true
  const proto = Storage.prototype
  const originalSetItem = proto.setItem
  const originalRemoveItem = proto.removeItem
  proto.setItem = function (this: Storage, key: string, value: string) {
    originalSetItem.call(this, key, value)
    if (this === window.localStorage && isDocumentKey(key)) markDirty(key)
  }
  proto.removeItem = function (this: Storage, key: string) {
    originalRemoveItem.call(this, key)
    if (this === window.localStorage && isDocumentKey(key)) markDirty(key)
  }
}

/**
 * Active (userId) ou coupe (null : déconnexion, démo) la synchronisation.
 * À l'activation, les écritures restées à pousser (hors-ligne) repartent.
 */
export const setDocumentSyncUser = (userId: string | null): void => {
  currentUserId = userId
  if (!userId) {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    dirtyKeys.clear()
    return
  }
  const meta = readMeta()
  for (const [key, entry] of Object.entries(meta)) {
    if (entry.dirtyAt && isDocumentKey(key)) dirtyKeys.add(key)
  }
  schedulePush()
}

/** Pousse les clés modifiées. Renvoie false si Supabase a refusé (retentera). */
export const flushDocuments = async (): Promise<boolean> => {
  if (!currentUserId || !isSupabaseConfigured() || dirtyKeys.size === 0) return true
  const keys = [...dirtyKeys]
  const rows = keys.map((key) => ({
    user_id: currentUserId,
    key,
    value: window.localStorage.getItem(key),
  }))
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'user_id,key' })
    .select('key, updated_at')
  if (error) {
    // Table absente (migration 0012 non appliquée) ou hors-ligne : on garde
    // les clés à pousser et on retentera plus tard, sans marteler.
    if (timer !== null) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = null
      void flushDocuments()
    }, RETRY_DELAY_MS)
    return false
  }
  const meta = readMeta()
  const stamps = new Map((data ?? []).map((row) => [String(row.key), String(row.updated_at)]))
  for (const key of keys) {
    dirtyKeys.delete(key)
    meta[key] = { remote: stamps.get(key) ?? meta[key]?.remote, hash: hashValue(window.localStorage.getItem(key)) }
  }
  writeMeta(meta)
  return true
}

/**
 * Récupère les documents distants et applique ceux qui sont plus récents.
 * Une fois par compte et par chargement de page. `applied` > 0 ⇒ l'appelant
 * recharge l'app pour relire l'état depuis localStorage.
 */
export const pullDocuments = async (userId: string): Promise<{ ok: boolean; applied: number }> => {
  if (!isSupabaseConfigured() || pulledFor.has(userId)) return { ok: true, applied: 0 }
  pulledFor.add(userId)
  const { data, error } = await supabase.from(TABLE).select('key, value, updated_at')
  if (error) return { ok: false, applied: 0 }
  const rows = (data ?? []) as RemoteDocument[]
  const meta = readMeta()
  const local: Record<string, string | null> = {}
  for (const key of DOCUMENT_KEYS) local[key] = window.localStorage.getItem(key)
  const plan = planPull(rows, meta, local)

  applying = true
  try {
    for (const doc of plan.apply) {
      if (doc.value === null) window.localStorage.removeItem(doc.key)
      else window.localStorage.setItem(doc.key, doc.value)
      meta[doc.key] = { remote: doc.updated_at, hash: hashValue(doc.value) }
    }
    for (const doc of plan.seen) meta[doc.key] = { remote: doc.updated_at, hash: doc.hash }
    writeMeta(meta)
  } finally {
    applying = false
  }
  return { ok: true, applied: plan.apply.length }
}
