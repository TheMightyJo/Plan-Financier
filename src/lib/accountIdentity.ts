import type { UserProfile } from '../types'
import { avatarInitials } from './avatar'

/**
 * Identité du compte (prénom / nom) telle que saisie à l'inscription
 * (user_metadata.first_name / last_name) ou fournie par Google
 * (full_name / name). Sert à personnaliser le profil local : prénom en
 * nom de profil et initiales « Prénom Nom » sur l'avatar.
 */

export type AccountIdentity = {
  firstName: string
  lastName: string
  fullName: string
  /** Initiales prénom + nom (ex. « JQ »), ou du prénom seul si pas de nom. */
  initials: string
}

type MetadataLike = Record<string, unknown> | null | undefined

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const capitalize = (value: string): string =>
  value ? value.charAt(0).toLocaleUpperCase('fr-FR') + value.slice(1) : value

export const accountIdentityFromMetadata = (metadata: MetadataLike): AccountIdentity | null => {
  if (!metadata) return null
  let firstName = capitalize(str(metadata.first_name))
  let lastName = capitalize(str(metadata.last_name))
  if (!firstName) {
    const full = str(metadata.full_name) || str(metadata.name) || str(metadata.display_name)
    if (!full) return null
    const parts = full.split(/\s+/).filter(Boolean)
    firstName = capitalize(parts[0] ?? '')
    lastName = lastName || capitalize(parts.slice(1).join(' '))
  }
  if (!firstName) return null
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  return { firstName, lastName, fullName, initials: avatarInitials(fullName) }
}

/** Noms de profil « génériques » posés par défaut ou par l'onboarding. */
const GENERIC_PROFILE_NAMES = new Set(['principal', 'moi', 'me', 'vous'])

/**
 * Applique l'identité du compte au profil principal s'il porte encore un nom
 * générique : prénom comme nom de profil, initiales prénom+nom en avatar
 * (sauf si l'utilisateur a déjà choisi une photo ou un emoji).
 * Renvoie la même référence si rien ne change.
 */
export const personalizeProfiles = (
  profiles: UserProfile[],
  defaultProfileId: string,
  identity: AccountIdentity | null,
): UserProfile[] => {
  if (!identity) return profiles
  let changed = false
  const next = profiles.map((profile) => {
    if (profile.id !== defaultProfileId) return profile
    const generic = GENERIC_PROFILE_NAMES.has(profile.name.trim().toLowerCase())
    const initialsAvatar = `initials:${identity.initials}`
    const needsAvatar = !profile.avatar || profile.avatar.startsWith('initials:')
    if (!generic && (!needsAvatar || profile.avatar === initialsAvatar)) return profile
    if (!generic && !needsAvatar) return profile
    changed = true
    return {
      ...profile,
      name: generic ? identity.firstName : profile.name,
      avatar: needsAvatar ? initialsAvatar : profile.avatar,
    }
  })
  return changed ? next : profiles
}
