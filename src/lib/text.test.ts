import { describe, it, expect } from 'vitest'
import { normalizeText, getLabelTokens, computeLabelSimilarity, sanitizeProfileId } from './text'

describe('normalizeText', () => {
  it('strip les accents et met en minuscules', () => {
    expect(normalizeText('École de Médecine')).toBe('ecole de medecine')
  })

  it('remplace la ponctuation par un espace simple', () => {
    expect(normalizeText("Café au lait, s'il vous plaît !")).toBe('cafe au lait s il vous plait')
  })

  it('renvoie une chaîne vide pour une entrée vide', () => {
    expect(normalizeText('   ')).toBe('')
  })
})

describe('getLabelTokens', () => {
  it('garde uniquement les tokens > 2 caractères', () => {
    expect(getLabelTokens('Le café du coin')).toEqual(['cafe', 'coin'])
  })
})

describe('computeLabelSimilarity', () => {
  it('renvoie 1 pour deux libellés identiques', () => {
    expect(computeLabelSimilarity('Supermarché Carrefour', 'supermarche carrefour')).toBe(1)
  })

  it('renvoie 0 pour deux libellés sans token commun significatif', () => {
    expect(computeLabelSimilarity('Pharmacie', 'Loyer')).toBe(0)
  })

  it('renvoie une valeur strictement entre 0 et 1 pour un recouvrement partiel', () => {
    const score = computeLabelSimilarity('Carrefour Express Paris', 'Carrefour Lille')
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })
})

describe('sanitizeProfileId', () => {
  it('produit un slug ASCII compatible URL', () => {
    expect(sanitizeProfileId('Élodie & Maman')).toBe('elodie-maman')
  })

  it('tolère les chaînes vides', () => {
    expect(sanitizeProfileId('   ')).toBe('')
  })
})
