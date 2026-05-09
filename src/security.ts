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
  parentPin: string
  sessionDurationDays: SessionDurationDays
  persistedSession?: {
    role: AuthRole
    at: number
  }
}

const SENSITIVE_STORAGE_KEY = 'plan-financier-sensitive-v1'
const SALT_STORAGE_KEY = 'plan-financier-salt-v1'
const PIN_LOG_STORAGE_KEY = 'plan-financier-pin-log-v1'
const PASSPHRASE = 'plan-financier-local-shield'

export const defaultSensitiveState: SensitiveState = {
  parentPin: '2580',
  sessionDurationDays: 7,
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

const getOrCreateSalt = () => {
  const existing = window.localStorage.getItem(SALT_STORAGE_KEY)
  if (existing) {
    return fromBase64(existing)
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  window.localStorage.setItem(SALT_STORAGE_KEY, toBase64(salt))
  return salt
}

const deriveAesKey = async () => {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(PASSPHRASE),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: getOrCreateSalt(),
      iterations: 150000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

const encryptJson = async (data: unknown) => {
  const key = await deriveAesKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = encoder.encode(JSON.stringify(data))
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  )

  return JSON.stringify({
    iv: toBase64(iv),
    cipher: toBase64(new Uint8Array(ciphertextBuffer)),
  })
}

const decryptJson = async <T,>(payload: string): Promise<T> => {
  const parsed = JSON.parse(payload) as { iv?: string; cipher?: string }
  if (!parsed.iv || !parsed.cipher) {
    throw new Error('invalid encrypted payload')
  }

  const key = await deriveAesKey()
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(parsed.iv) },
    key,
    fromBase64(parsed.cipher),
  )

  return JSON.parse(decoder.decode(plaintextBuffer)) as T
}

const isSensitiveState = (value: unknown): value is SensitiveState => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SensitiveState>
  const hasValidPins = typeof candidate.parentPin === 'string'

  const hasValidSessionDuration =
    candidate.sessionDurationDays === undefined ||
    SESSION_DURATION_OPTIONS.includes(candidate.sessionDurationDays)

  if (!hasValidPins || !hasValidSessionDuration) {
    return false
  }

  if (!candidate.persistedSession) {
    return true
  }

  const session = candidate.persistedSession
  return (
    typeof session.at === 'number' &&
    session.role === 'Parent'
  )
}

const normalizeSensitiveState = (state: SensitiveState | Partial<SensitiveState>) => {
  const sessionDurationDays = SESSION_DURATION_OPTIONS.includes(
    state.sessionDurationDays as SessionDurationDays,
  )
    ? (state.sessionDurationDays as SessionDurationDays)
    : defaultSensitiveState.sessionDurationDays

  return {
    parentPin: typeof state.parentPin === 'string' ? state.parentPin : defaultSensitiveState.parentPin,
    sessionDurationDays,
    persistedSession: state.persistedSession,
  }
}

export const loadSensitiveState = async () => {
  const encrypted = window.localStorage.getItem(SENSITIVE_STORAGE_KEY)
  if (!encrypted) {
    await saveSensitiveState(defaultSensitiveState)
    return defaultSensitiveState
  }

  try {
    const decoded = await decryptJson<unknown>(encrypted)
    if (isSensitiveState(decoded)) {
      const normalized = normalizeSensitiveState(decoded)
      const maxSessionAgeMs = normalized.sessionDurationDays * 24 * 60 * 60 * 1000
      const hasExpiredSession =
        !!normalized.persistedSession &&
        Date.now() - normalized.persistedSession.at > maxSessionAgeMs

      if (hasExpiredSession) {
        const sanitizedState: SensitiveState = {
          ...normalized,
          persistedSession: undefined,
        }
        await saveSensitiveState(sanitizedState)
        return sanitizedState
      }

      if (normalized.sessionDurationDays !== decoded.sessionDurationDays) {
        await saveSensitiveState(normalized)
      }

      return normalized
    }
  } catch {
    // Falls back to defaults when local encrypted content is invalid.
  }

  await saveSensitiveState(defaultSensitiveState)
  return defaultSensitiveState
}

export const saveSensitiveState = async (state: SensitiveState) => {
  const encrypted = await encryptJson(state)
  window.localStorage.setItem(SENSITIVE_STORAGE_KEY, encrypted)
}

export const resetSensitiveStorage = async () => {
  window.localStorage.removeItem(SENSITIVE_STORAGE_KEY)
  window.localStorage.removeItem(SALT_STORAGE_KEY)
  await saveSensitiveState(defaultSensitiveState)
  return defaultSensitiveState
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