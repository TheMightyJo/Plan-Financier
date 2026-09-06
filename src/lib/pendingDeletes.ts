/**
 * Suppressions d'opérations en attente de propagation (hors-ligne, ou avant
 * le prochain push). Sans cette file, une opération supprimée ici serait
 * « ressuscitée » par le distant au login suivant.
 */

export const PENDING_DELETES_KEY = 'plan-financier-pending-deletes-v1'

const read = (storage: Storage): string[] => {
  try {
    const raw = storage.getItem(PENDING_DELETES_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

const write = (storage: Storage, ids: string[]) => {
  try {
    if (ids.length === 0) storage.removeItem(PENDING_DELETES_KEY)
    else storage.setItem(PENDING_DELETES_KEY, JSON.stringify(ids))
  } catch {
    /* stockage indisponible */
  }
}

export const readPendingDeletes = (storage: Storage = window.localStorage): string[] => read(storage)

export const queuePendingDeletes = (ids: Array<string | number>, storage: Storage = window.localStorage): void => {
  if (ids.length === 0) return
  const current = new Set(read(storage))
  for (const id of ids) current.add(String(id))
  write(storage, [...current])
}

export const clearPendingDeletes = (ids: string[], storage: Storage = window.localStorage): void => {
  const done = new Set(ids)
  write(storage, read(storage).filter((id) => !done.has(id)))
}
