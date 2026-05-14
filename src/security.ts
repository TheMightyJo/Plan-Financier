export type AuthRole = 'Parent'

export const SESSION_DURATION_OPTIONS = [7, 14, 30] as const
export type SessionDurationDays = (typeof SESSION_DURATION_OPTIONS)[number]

export type PinChangeLog = {
  id: number
  at: number
  actor: 'Parent'
  parentPinChanged: boolean
}

export type SensitiveState = {
  sessionDurationDays: SessionDurationDays
  persistedSession?: {
    role: AuthRole
    at: number
  }
  /** Vrai tant que le PIN parent par défaut n'a pas été remplacé. */
  usingDefaultPin: boolean
}

export const DEFAULT_PARENT_PIN = '2580'

const SENSITIVE_STORAGE_KEY = 'plan-financier-sensitive-v2'
const LEGACY_SENSITIVE_STORAGE_KEY = 'plan-financier-sensitive-v1'
const SALT_STORAGE_KEY = 'plan-financier-salt-v1'
const PIN_LOG_STORAGE_KEY = 'plan-financier-pin-log-v1'
const LEGACY_PASSPHRASE = 'plan-financier-local-shield'

const PIN_HASH_ITERATIONS = 200_000

export const defaultSensitiveState: SensitiveState = {
  sessionDurationDays: 7,
  usingDefaultPin: true,
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const toBase64 = (value: Uint8Array) => {
  let binary = ''
  value.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const fromBase64 = (value: string) => {
  const binary = atob(value)
  const result = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    result[i] = binary.charCodeAt(i)
  }
  return result
}

const getOrCreateLegacySalt = () => {
  const existing = window.localStorage.getItem(SALT_STORAGE_KEY)
  if (existing) {
    return fromBase64(existing)
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  window.localStorage.setItem(SALT_STORAGE_KEY, toBase64(salt))
  return salt
}

const toFreshUint8 = (source: Uint8Array | ArrayBufferLike): Uint8Array<ArrayBuffer> => {
  const view = source instanceof Uint8Array ? source : new Uint8Array(source)
  const buffer = new ArrayBuffer(view.byteLength)
  const fresh = new Uint8Array(buffer)
  fresh.set(view)
  return fresh
}

const hashPin = async (pin: string, salt: Uint8Array): Promise<Uint8Array> => {
  const pinBytes = toFreshUint8(encoder.encode(pin))
  const saltBytes = toFreshUint8(salt)
  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinBytes,
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PIN_HASH_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    256,
  )
  return new Uint8Array(bits)
}

const constantTimeEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

type StoredSensitiveV2 = {
  v: 2
  parentPinHash: string
  parentPinSalt: string
  sessionDurationDays: SessionDurationDays
  persistedSession?: { role: AuthRole; at: number }
  usingDefaultPin: boolean
}

const isStoredSensitiveV2 = (value: unknown): value is StoredSensitiveV2 => {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<StoredSensitiveV2>
  if (v.v !== 2) return false
  if (typeof v.parentPinHash !== 'string' || typeof v.parentPinSalt !== 'string') return false
  if (typeof v.usingDefaultPin !== 'boolean') return false
  if (!SESSION_DURATION_OPTIONS.includes(v.sessionDurationDays as SessionDurationDays)) return false
  if (v.persistedSession !== undefined) {
    if (
      typeof v.persistedSession !== 'object' ||
      typeof v.persistedSession.at !== 'number' ||
      v.persistedSession.role !== 'Parent'
    ) {
      return false
    }
  }
  return true
}

const writeStored = (record: StoredSensitiveV2) => {
  window.localStorage.setItem(SENSITIVE_STORAGE_KEY, JSON.stringify(record))
}

const readStored = (): StoredSensitiveV2 | null => {
  const raw = window.localStorage.getItem(SENSITIVE_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return isStoredSensitiveV2(parsed) ? parsed : null
  } catch {
    return null
  }
}

const buildInitialRecord = async (parentPin: string): Promise<StoredSensitiveV2> => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await hashPin(parentPin, salt)
  return {
    v: 2,
    parentPinHash: toBase64(hash),
    parentPinSalt: toBase64(salt),
    sessionDurationDays: defaultSensitiveState.sessionDurationDays,
    persistedSession: undefined,
    usingDefaultPin: parentPin === DEFAULT_PARENT_PIN,
  }
}

const tryMigrateLegacy = async (): Promise<StoredSensitiveV2 | null> => {
  const legacyRaw = window.localStorage.getItem(LEGACY_SENSITIVE_STORAGE_KEY)
  if (!legacyRaw) return null

  try {
    const parsedEnvelope = JSON.parse(legacyRaw) as { iv?: string; cipher?: string }
    if (!parsedEnvelope.iv || !parsedEnvelope.cipher) {
      window.localStorage.removeItem(LEGACY_SENSITIVE_STORAGE_KEY)
      return null
    }

    const baseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(LEGACY_PASSPHRASE),
      'PBKDF2',
      false,
      ['deriveKey'],
    )
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: getOrCreateLegacySalt(),
        iterations: 150_000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    )
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(parsedEnvelope.iv) },
      aesKey,
      fromBase64(parsedEnvelope.cipher),
    )
    const plain = JSON.parse(decoder.decode(plaintextBuffer)) as {
      parentPin?: string
      sessionDurationDays?: SessionDurationDays
      persistedSession?: { role: AuthRole; at: number }
    }

    const recoveredPin = typeof plain.parentPin === 'string' ? plain.parentPin : DEFAULT_PARENT_PIN
    const sessionDuration = SESSION_DURATION_OPTIONS.includes(
      plain.sessionDurationDays as SessionDurationDays,
    )
      ? (plain.sessionDurationDays as SessionDurationDays)
      : defaultSensitiveState.sessionDurationDays

    const salt = crypto.getRandomValues(new Uint8Array(16))
    const hash = await hashPin(recoveredPin, salt)
    const migrated: StoredSensitiveV2 = {
      v: 2,
      parentPinHash: toBase64(hash),
      parentPinSalt: toBase64(salt),
      sessionDurationDays: sessionDuration,
      persistedSession: plain.persistedSession,
      usingDefaultPin: recoveredPin === DEFAULT_PARENT_PIN,
    }
    writeStored(migrated)
    window.localStorage.removeItem(LEGACY_SENSITIVE_STORAGE_KEY)
    return migrated
  } catch {
    window.localStorage.removeItem(LEGACY_SENSITIVE_STORAGE_KEY)
    return null
  }
}

const toPublicState = (record: StoredSensitiveV2): SensitiveState => ({
  sessionDurationDays: record.sessionDurationDays,
  persistedSession: record.persistedSession,
  usingDefaultPin: record.usingDefaultPin,
})

const expireSessionIfNeeded = (record: StoredSensitiveV2): StoredSensitiveV2 => {
  if (!record.persistedSession) return record
  const maxAge = record.sessionDurationDays * 24 * 60 * 60 * 1000
  if (Date.now() - record.persistedSession.at > maxAge) {
    const next: StoredSensitiveV2 = { ...record, persistedSession: undefined }
    writeStored(next)
    return next
  }
  return record
}

export const loadSensitiveState = async (): Promise<SensitiveState> => {
  let record = readStored()

  if (!record) {
    record = await tryMigrateLegacy()
  }

  if (!record) {
    record = await buildInitialRecord(DEFAULT_PARENT_PIN)
    writeStored(record)
  }

  record = expireSessionIfNeeded(record)
  return toPublicState(record)
}

/**
 * Persiste les paramètres non secrets (durée de session, session active,
 * drapeau usingDefaultPin). Le hash + sel du PIN sont préservés tels quels.
 */
export const saveSensitiveState = async (state: SensitiveState): Promise<void> => {
  let record = readStored()
  if (!record) {
    record = await buildInitialRecord(DEFAULT_PARENT_PIN)
  }
  const next: StoredSensitiveV2 = {
    ...record,
    sessionDurationDays: state.sessionDurationDays,
    persistedSession: state.persistedSession,
    usingDefaultPin: state.usingDefaultPin,
  }
  writeStored(next)
}

export const verifyParentPin = async (pin: string): Promise<boolean> => {
  const record = readStored()
  if (!record) return false
  const candidateHash = await hashPin(pin, fromBase64(record.parentPinSalt))
  const storedHash = fromBase64(record.parentPinHash)
  return constantTimeEqual(candidateHash, storedHash)
}

export const setParentPin = async (newPin: string): Promise<SensitiveState> => {
  const existing = readStored()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await hashPin(newPin, salt)
  const next: StoredSensitiveV2 = {
    v: 2,
    parentPinHash: toBase64(hash),
    parentPinSalt: toBase64(salt),
    sessionDurationDays: existing?.sessionDurationDays ?? defaultSensitiveState.sessionDurationDays,
    persistedSession: existing?.persistedSession,
    usingDefaultPin: newPin === DEFAULT_PARENT_PIN,
  }
  writeStored(next)
  return toPublicState(next)
}

export const resetSensitiveStorage = async (): Promise<SensitiveState> => {
  window.localStorage.removeItem(SENSITIVE_STORAGE_KEY)
  window.localStorage.removeItem(LEGACY_SENSITIVE_STORAGE_KEY)
  window.localStorage.removeItem(SALT_STORAGE_KEY)
  const record = await buildInitialRecord(DEFAULT_PARENT_PIN)
  writeStored(record)
  return toPublicState(record)
}

export const loadPinChangeLogs = (): PinChangeLog[] => {
  const raw = window.localStorage.getItem(PIN_LOG_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((entry): entry is PinChangeLog => {
      if (!entry || typeof entry !== 'object') {
        return false
      }

      const candidate = entry as Partial<PinChangeLog>
      return (
        typeof candidate.id === 'number' &&
        typeof candidate.at === 'number' &&
        candidate.actor === 'Parent' &&
        typeof candidate.parentPinChanged === 'boolean'
      )
    })
  } catch {
    return []
  }
}

export const addPinChangeLog = (entry: Omit<PinChangeLog, 'id' | 'at'>) => {
  const previous = loadPinChangeLogs()
  const next: PinChangeLog[] = [
    {
      id: Date.now(),
      at: Date.now(),
      ...entry,
    },
    ...previous,
  ].slice(0, 30)

  window.localStorage.setItem(PIN_LOG_STORAGE_KEY, JSON.stringify(next))
  return next
}

export const clearPinChangeLogs = () => {
  window.localStorage.removeItem(PIN_LOG_STORAGE_KEY)
}
