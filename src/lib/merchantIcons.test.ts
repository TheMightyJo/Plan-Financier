import { describe, it, expect } from 'vitest'
import { isValidTxIcon, suggestMerchantIcon } from './merchantIcons'

describe('suggestMerchantIcon', () => {
  it('reconnaît les enseignes courantes (accents/casse ignorés)', () => {
    expect(suggestMerchantIcon('Courses CARREFOUR Market')).toBe('🛒')
    expect(suggestMerchantIcon('Abonnement Netflix')).toBe('🎬')
    expect(suggestMerchantIcon('Apple Store iPhone')).toBe('📱')
    expect(suggestMerchantIcon('Billet SNCF Paris-Lyon')).toBe('🚆')
    expect(suggestMerchantIcon('Pharmacie du centre')).toBe('💊')
  })

  it('renvoie null pour un libellé inconnu', () => {
    expect(suggestMerchantIcon('Dépense mystère XYZ')).toBeNull()
  })
})

describe('isValidTxIcon', () => {
  it('accepte un emoji, refuse du texte', () => {
    expect(isValidTxIcon('🛒')).toBe(true)
    expect(isValidTxIcon('🅿️')).toBe(true)
    expect(isValidTxIcon('abc')).toBe(false)
    expect(isValidTxIcon('')).toBe(false)
    expect(isValidTxIcon(42)).toBe(false)
  })
})
