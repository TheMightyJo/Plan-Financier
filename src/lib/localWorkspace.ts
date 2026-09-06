/**
 * Espace local par compte.
 *
 * Les données « local-first » (opérations, profils, poches, objectifs…) vivent
 * dans localStorage sous des clés fixes. Sur un appareil partagé, ou quand on
 * crée un second compte, le compte suivant héritait des données du précédent.
 *
 * Ici : à chaque connexion, si l'identifiant du compte change, on met de côté
 * l'espace du compte précédent (instantané sous sa propre clé), on vide les
 * clés de données, puis on restaure l'instantané du nouveau compte s'il en a
 * un. Un compte tout neuf démarre donc vide. Les préférences d'appareil
 * (thème, palette, accessibilité, PIN parent) ne bougent pas.
 */

const CURRENT_USER_KEY = 'plan-financier-current-user-v1'
const SNAPSHOT_PREFIX = 'plan-financier-workspace-v1:'

/** Clés de données rattachées à un compte (pas les préférences d'appareil). */
export const LOCAL_DATA_KEYS = [
  'plan-financier-transactions-v1',
  'plan-financier-rollover-v1',
  'plan-financier-goals-v1',
  'plan-financier-csv-mappings-v1',
  'plan-financier-profiles-v1',
  'plan-financier-active-profile-v1',
  'plan-financier-default-profile-v1',
  'plan-financier-savings-targets-v1',
  'plan-financier-envelope-budgets-v1',
  'plan-financier-envelope-funds-v1',
  'plan-financier-custom-envelopes-v1',
  'plan-financier-notes-v1',
  'plan-financier-onboarding-done-v1',
  'plan-financier-first-tx-tour-done-v1',
  'plan-financier-feature-tour-done-v1',
  'plan-financier-start-checklist-done-v1',
  'plan-financier-recurring-dismissed-v1',
  'plan-financier-dashboard-widgets-v1',
  'plan-financier-accounts-v1',
  'plan-financier-recurring-rules-v1',
  'plan-financier-chat-threads-v1',
  'plan-financier-ai-provider-keys-v1',
  'plan-financier-anthropic-key-v1',
  'plan-financier-cash-nudge-at',
  'plan-financier-doc-sync-meta-v1',
  'plan-financier-pending-deletes-v1',
] as const

/** Préfixes de clés dynamiques (historique de chat par profil, etc.). */
const LOCAL_DATA_PREFIXES = ['plan-financier-chat-history-v1'] as const

const isDataKey = (key: string): boolean =>
  (LOCAL_DATA_KEYS as readonly string[]).includes(key) ||
  LOCAL_DATA_PREFIXES.some((prefix) => key.startsWith(prefix))

const listDataKeys = (storage: Storage): string[] => {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key && isDataKey(key)) keys.push(key)
  }
  return keys
}

export const readCurrentLocalUser = (storage: Storage = window.localStorage): string | null => {
  try {
    return storage.getItem(CURRENT_USER_KEY)
  } catch {
    return null
  }
}

/**
 * Bascule l'espace local vers `nextUserId`.
 * Renvoie true si une bascule a eu lieu (l'appelant recharge l'app pour
 * relire l'état depuis localStorage), false si le compte est déjà celui en place.
 *
 * Premier passage (aucun compte enregistré) : les données présentes sont
 * attribuées au compte qui se connecte — c'est le comportement historique,
 * qui garde intactes les données des utilisateurs existants.
 */
export const switchLocalWorkspace = (
  nextUserId: string,
  storage: Storage = window.localStorage,
): boolean => {
  let previous: string | null
  try {
    previous = storage.getItem(CURRENT_USER_KEY)
  } catch {
    return false
  }
  if (previous === nextUserId) return false

  try {
    if (previous === null) {
      storage.setItem(CURRENT_USER_KEY, nextUserId)
      return false
    }

    // 1. Instantané du compte précédent.
    const snapshot: Record<string, string> = {}
    for (const key of listDataKeys(storage)) {
      const value = storage.getItem(key)
      if (value !== null) snapshot[key] = value
    }
    storage.setItem(`${SNAPSHOT_PREFIX}${previous}`, JSON.stringify(snapshot))

    // 2. Espace vide.
    for (const key of Object.keys(snapshot)) storage.removeItem(key)

    // 3. Restauration de l'espace du nouveau compte, s'il existe.
    const rawNext = storage.getItem(`${SNAPSHOT_PREFIX}${nextUserId}`)
    if (rawNext) {
      const restored = JSON.parse(rawNext) as Record<string, string>
      for (const [key, value] of Object.entries(restored)) {
        if (isDataKey(key) && typeof value === 'string') storage.setItem(key, value)
      }
      storage.removeItem(`${SNAPSHOT_PREFIX}${nextUserId}`)
    }

    storage.setItem(CURRENT_USER_KEY, nextUserId)
    return true
  } catch {
    // Stockage plein ou indisponible : on ne casse pas la connexion.
    return false
  }
}
