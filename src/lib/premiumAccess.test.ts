import { describe, it, expect } from 'vitest'
import { computePremiumAccess, EARLY_ADOPTER_UNTIL, TRIAL_DAYS } from './premiumAccess'

const now = Date.parse('2026-11-15T12:00:00Z')
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString()

describe('computePremiumAccess', () => {
  it('démo et plan payant : ouvert', () => {
    expect(computePremiumAccess({ demoMode: true, plan: 'free', accountCreatedAt: null, now }).reason).toBe('demo')
    expect(computePremiumAccess({ demoMode: false, plan: 'premium', accountCreatedAt: daysAgo(100), now })).toMatchObject({ unlocked: true, reason: 'plan' })
  })

  it('session inconnue : ouvert par précaution', () => {
    expect(computePremiumAccess({ demoMode: false, plan: 'free', accountCreatedAt: null, now })).toMatchObject({ unlocked: true, reason: 'unknown' })
    expect(computePremiumAccess({ demoMode: false, plan: 'free', accountCreatedAt: 'n/a', now }).reason).toBe('unknown')
  })

  it("premiers inscrits (avant le 1er octobre 2026) : offert à vie", () => {
    const before = new Date(Date.parse(`${EARLY_ADOPTER_UNTIL}T00:00:00Z`) - 1).toISOString()
    expect(computePremiumAccess({ demoMode: false, plan: 'free', accountCreatedAt: before, now })).toMatchObject({ unlocked: true, reason: 'early' })
  })

  it('essai : ouvert avec jours restants, puis fermé', () => {
    const active = computePremiumAccess({ demoMode: false, plan: 'free', accountCreatedAt: daysAgo(10), now })
    expect(active).toMatchObject({ unlocked: true, reason: 'trial', daysLeft: TRIAL_DAYS - 10 })
    const lastDay = computePremiumAccess({ demoMode: false, plan: 'free', accountCreatedAt: daysAgo(29.5), now })
    expect(lastDay).toMatchObject({ unlocked: true, daysLeft: 1 })
    const ended = computePremiumAccess({ demoMode: false, plan: 'free', accountCreatedAt: daysAgo(31), now })
    expect(ended).toMatchObject({ unlocked: false, reason: 'trial', daysLeft: 0 })
  })
})
