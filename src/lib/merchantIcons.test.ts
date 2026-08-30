import { describe, it, expect } from 'vitest'
import { merchantFaviconUrl, suggestMerchantDomain, isValidTxIcon, suggestMerchantIcon } from './merchantIcons'

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

describe('suggestMerchantDomain', () => {
  it('reconnaît les marchands connus', () => {
    expect(suggestMerchantDomain('Abonnement Canal+ famille')).toBe('canalplus.com')
    expect(suggestMerchantDomain('NETFLIX.COM Paris')).toBe('netflix.com')
    expect(suggestMerchantDomain('Courses Carrefour City')).toBe('carrefour.fr')
  })

  it('renvoie null pour un libellé inconnu', () => {
    expect(suggestMerchantDomain('Boulangerie du coin')).toBeNull()
  })
})

describe('merchantFaviconUrl', () => {
  it('construit une URL Google s2 encodée', () => {
    expect(merchantFaviconUrl('canalplus.com')).toBe(
      'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://canalplus.com&size=64',
    )
  })
})
