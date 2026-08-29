// Sauvegarde chiffrée locale : (dé)sérialisation base64, dérivation de clé
// PBKDF2 et chiffrement AES-GCM du payload de backup protégé par le PIN parent.
// Fonctions pures / crypto (aucun état React) extraites de App.tsx.
import type { BackupPayload, EncryptedBackup } from '../types'

export const BACKUP_VERSION = 1

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

export const encryptBackupPayload = async (payload: BackupPayload, pin: string): Promise<EncryptedBackup> => {
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

export const decryptBackupPayload = async (encrypted: EncryptedBackup, pin: string): Promise<BackupPayload> => {
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
