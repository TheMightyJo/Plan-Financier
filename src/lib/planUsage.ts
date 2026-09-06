import type { PremiumAccess } from './premiumAccess'

/**
 * Usage des fonctionnalités Premium, pour des rappels d'abonnement honnêtes :
 * on parle de ce que la personne utilise vraiment, pas d'une liste marketing.
 */

export const FREE_LIMITS = { profiles: 1, aiMessages: 15 } as const

export type PlanUsage = {
  profiles: number
  /** Poches personnalisées (au-delà des 3 de base), tous profils confondus. */
  customEnvelopes: number
  aiUsed: number
  aiLimit: number
  reportsOn: boolean
}

/** Ce qui dépasse le plan Découverte (à afficher pendant l'essai : « vous utilisez… »). */
export const premiumFeaturesInUse = (usage: PlanUsage): string[] => {
  const items: string[] = []
  if (usage.profiles > FREE_LIMITS.profiles) items.push(`${usage.profiles} profils`)
  if (usage.customEnvelopes > 0) items.push(`${usage.customEnvelopes} poche${usage.customEnvelopes > 1 ? 's' : ''} personnalisée${usage.customEnvelopes > 1 ? 's' : ''}`)
  if (usage.aiUsed > FREE_LIMITS.aiMessages) items.push(`${usage.aiUsed} messages Cash ce mois-ci`)
  if (usage.reportsOn) items.push('les rapports par email')
  return items
}

export type PlanCardVariant =
  | { kind: 'trial'; daysLeft: number; inUse: string[] }
  | { kind: 'free'; aiUsed: number; aiLimit: number; aiShare: number; profiles: number; customEnvelopes: number }
  | null

/**
 * Quelle carte montrer : essai (ce que vous perdriez), Découverte (usage vs
 * limites), rien pour les abonnés, les premiers inscrits et la démo.
 * `dismissedAt` : masquée 7 jours après « Pas maintenant », sauf quota Cash épuisé.
 */
export const planCardVariant = (
  access: PremiumAccess,
  usage: PlanUsage,
  dismissedAt: number,
  now: number = Date.now(),
): PlanCardVariant => {
  if (access.reason !== 'trial') return null
  const aiShare = usage.aiLimit > 0 ? usage.aiUsed / usage.aiLimit : 0
  const dismissed = now - dismissedAt < 7 * 86_400_000
  if (access.unlocked) {
    if (dismissed) return null
    return { kind: 'trial', daysLeft: access.daysLeft ?? 0, inUse: premiumFeaturesInUse(usage) }
  }
  if (dismissed && aiShare < 1) return null
  return { kind: 'free', aiUsed: usage.aiUsed, aiLimit: usage.aiLimit, aiShare, profiles: usage.profiles, customEnvelopes: usage.customEnvelopes }
}
