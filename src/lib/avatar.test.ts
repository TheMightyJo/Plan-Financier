import { describe, it, expect } from 'vitest'
import { avatarInitials, avatarColor } from './avatar'

describe('avatarInitials', () => {
  it('prend les 2 premières lettres d’un prénom simple', () => {
    expect(avatarInitials('Moi')).toBe('MO')
    expect(avatarInitials('Enfants')).toBe('EN')
  })

  it('prend les initiales des deux mots si nom composé', () => {
    expect(avatarInitials('Marie Dupont')).toBe('MD')
  })

  it('gère les chaînes vides', () => {
    expect(avatarInitials('   ')).toBe('?')
  })
})

describe('avatarColor', () => {
  it('est déterministe (même seed → même couleur)', () => {
    expect(avatarColor('moi')).toBe(avatarColor('moi'))
  })

  it('renvoie une couleur hex de la palette', () => {
    expect(avatarColor('conjoint')).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
})
