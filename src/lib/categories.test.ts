import { describe, it, expect } from 'vitest'
import { suggestCategoryFromLabel, inferEnvelope } from './categories'

describe('suggestCategoryFromLabel', () => {
  it('détecte Courses depuis un libellé contenant "supermarche"', () => {
    expect(suggestCategoryFromLabel('Supermarché du coin')).toBe('Courses')
  })

  it('détecte Transport pour "Essence Total"', () => {
    expect(suggestCategoryFromLabel('Essence Total')).toBe('Transport')
  })

  it('détecte Sante pour "Pharmacie centrale"', () => {
    expect(suggestCategoryFromLabel('Pharmacie centrale')).toBe('Sante')
  })

  it("retourne null si le libellé ne matche aucun mot-clé", () => {
    expect(suggestCategoryFromLabel('Achat divers')).toBeNull()
  })

  it("retourne null pour un libellé vide ou whitespace", () => {
    expect(suggestCategoryFromLabel('   ')).toBeNull()
  })
})

describe('inferEnvelope', () => {
  it('Maison + Courses → enveloppe Maison', () => {
    expect(inferEnvelope('Maison')).toBe('Maison')
    expect(inferEnvelope('Courses')).toBe('Maison')
  })

  it('Loisirs + Autre → enveloppe Vacances', () => {
    expect(inferEnvelope('Loisirs')).toBe('Vacances')
    expect(inferEnvelope('Autre')).toBe('Vacances')
  })

  it('Reste → enveloppe Perso', () => {
    expect(inferEnvelope('Transport')).toBe('Perso')
    expect(inferEnvelope('Ecole')).toBe('Perso')
    expect(inferEnvelope('Sante')).toBe('Perso')
  })
})
