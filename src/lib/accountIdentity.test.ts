import { describe, it, expect } from 'vitest'
import { accountIdentityFromMetadata, personalizeProfiles } from './accountIdentity'

describe('accountIdentityFromMetadata', () => {
  it('lit prénom / nom saisis à l’inscription', () => {
    expect(accountIdentityFromMetadata({ first_name: 'johan', last_name: 'quille' })).toEqual({
      firstName: 'Johan',
      lastName: 'Quille',
      fullName: 'Johan Quille',
      initials: 'JQ',
    })
  })

  it('découpe full_name (Google)', () => {
    expect(accountIdentityFromMetadata({ full_name: 'Marie Dupont Martin' })).toMatchObject({
      firstName: 'Marie',
      lastName: 'Dupont Martin',
      initials: 'MD',
    })
  })

  it('renvoie null sans information', () => {
    expect(accountIdentityFromMetadata(null)).toBeNull()
    expect(accountIdentityFromMetadata({ email: 'x@y.z' })).toBeNull()
  })
})

describe('personalizeProfiles', () => {
  const identity = { firstName: 'Johan', lastName: 'Quille', fullName: 'Johan Quille', initials: 'JQ' }

  it('renomme le profil générique et pose les initiales', () => {
    const next = personalizeProfiles([{ id: 'principal', name: 'Principal', monthlyBudget: 0 }], 'principal', identity)
    expect(next[0]).toEqual({ id: 'principal', name: 'Johan', monthlyBudget: 0, avatar: 'initials:JQ' })
  })

  it('renomme aussi « Moi » (onboarding) mais pas les autres membres', () => {
    const next = personalizeProfiles(
      [
        { id: 'moi', name: 'Moi', monthlyBudget: 1200 },
        { id: 'conjoint', name: 'Conjoint·e', monthlyBudget: 900 },
      ],
      'moi',
      identity,
    )
    expect(next[0].name).toBe('Johan')
    expect(next[1]).toEqual({ id: 'conjoint', name: 'Conjoint·e', monthlyBudget: 900 })
  })

  it('respecte un nom personnalisé et une photo choisie', () => {
    const profiles = [{ id: 'principal', name: 'Papa', monthlyBudget: 0, avatar: 'emoji:💰' }]
    expect(personalizeProfiles(profiles, 'principal', identity)).toBe(profiles)
  })

  it('ajoute les initiales à un nom personnalisé sans avatar', () => {
    const next = personalizeProfiles([{ id: 'principal', name: 'Papa', monthlyBudget: 0 }], 'principal', identity)
    expect(next[0]).toMatchObject({ name: 'Papa', avatar: 'initials:JQ' })
  })

  it('renvoie la même référence quand rien ne change', () => {
    const profiles = [{ id: 'principal', name: 'Johan', monthlyBudget: 0, avatar: 'initials:JQ' }]
    expect(personalizeProfiles(profiles, 'principal', identity)).toBe(profiles)
    expect(personalizeProfiles(profiles, 'principal', null)).toBe(profiles)
  })
})
