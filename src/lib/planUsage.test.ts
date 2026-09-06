import { describe, it, expect } from 'vitest'
import { planCardVariant, premiumFeaturesInUse } from './planUsage'
import type { PremiumAccess } from './premiumAccess'

const usage = { profiles: 2, customEnvelopes: 3, aiUsed: 20, aiLimit: 300, reportsOn: true }
const trial = (days: number, unlocked = true): PremiumAccess => ({ unlocked, reason: 'trial', trialEndsAt: new Date(), daysLeft: days })

describe('premiumFeaturesInUse', () => {
  it('liste seulement ce qui dépasse Découverte', () => {
    expect(premiumFeaturesInUse(usage)).toEqual(['2 profils', '3 poches personnalisées', '20 messages Cash ce mois-ci', 'les rapports par email'])
    expect(premiumFeaturesInUse({ profiles: 1, customEnvelopes: 0, aiUsed: 3, aiLimit: 15, reportsOn: false })).toEqual([])
  })
})

describe('planCardVariant', () => {
  it('rien pour abonnés, premiers inscrits, démo', () => {
    for (const reason of ['plan', 'early', 'demo', 'unknown'] as const) {
      expect(planCardVariant({ unlocked: true, reason, trialEndsAt: null, daysLeft: null }, usage, 0)).toBeNull()
    }
  })

  it('essai : carte avec jours restants et usage ; masquée 7 jours après « pas maintenant »', () => {
    expect(planCardVariant(trial(12), usage, 0)).toMatchObject({ kind: 'trial', daysLeft: 12 })
    expect(planCardVariant(trial(12), usage, Date.now() - 86_400_000)).toBeNull()
    expect(planCardVariant(trial(12), usage, Date.now() - 8 * 86_400_000)).not.toBeNull()
  })

  it('Découverte : carte avec le quota, jamais masquée quand le quota est épuisé', () => {
    const free = { ...usage, aiUsed: 12, aiLimit: 15 }
    expect(planCardVariant(trial(0, false), free, 0)).toMatchObject({ kind: 'free', aiShare: 0.8 })
    expect(planCardVariant(trial(0, false), free, Date.now())).toBeNull()
    expect(planCardVariant(trial(0, false), { ...free, aiUsed: 15 }, Date.now())).toMatchObject({ kind: 'free', aiShare: 1 })
  })
})
