/**
 * Accès Premium (« gating doux ») — helper pur, miroir de la logique serveur
 * (send-report / lifecycle-emails) :
 *  - démo : tout ouvert ;
 *  - plan payant actif : tout ouvert ;
 *  - comptes créés avant EARLY_ADOPTER_UNTIL : offert à vie ;
 *  - sinon : essai complet de TRIAL_DAYS jours, puis plan Découverte.
 */

export const EARLY_ADOPTER_UNTIL = '2026-10-01'
export const TRIAL_DAYS = 30
const MS_PER_DAY = 86_400_000

export type PremiumReason = 'demo' | 'plan' | 'unknown' | 'early' | 'trial'

export type PremiumAccess = {
  unlocked: boolean
  reason: PremiumReason
  trialEndsAt: Date | null
  /** Jours restants d'essai (entier, ≥ 0) ; null hors essai. */
  daysLeft: number | null
}

export type PremiumInput = {
  demoMode: boolean
  plan: 'free' | 'premium' | 'family'
  /** auth.users.created_at (ISO) ; null tant que la session n'est pas lue. */
  accountCreatedAt: string | null
  now?: number
}

export const computePremiumAccess = ({ demoMode, plan, accountCreatedAt, now = Date.now() }: PremiumInput): PremiumAccess => {
  if (demoMode) return { unlocked: true, reason: 'demo', trialEndsAt: null, daysLeft: null }
  if (plan !== 'free') return { unlocked: true, reason: 'plan', trialEndsAt: null, daysLeft: null }
  // Session pas encore lue : ne jamais bloquer par précaution.
  if (!accountCreatedAt) return { unlocked: true, reason: 'unknown', trialEndsAt: null, daysLeft: null }
  const created = new Date(accountCreatedAt)
  if (Number.isNaN(created.getTime())) return { unlocked: true, reason: 'unknown', trialEndsAt: null, daysLeft: null }
  if (created.getTime() < Date.parse(`${EARLY_ADOPTER_UNTIL}T00:00:00Z`)) {
    return { unlocked: true, reason: 'early', trialEndsAt: null, daysLeft: null }
  }
  const trialEndsAt = new Date(created.getTime() + TRIAL_DAYS * MS_PER_DAY)
  const remainingMs = trialEndsAt.getTime() - now
  return {
    unlocked: remainingMs > 0,
    reason: 'trial',
    trialEndsAt,
    daysLeft: Math.max(0, Math.ceil(remainingMs / MS_PER_DAY)),
  }
}
