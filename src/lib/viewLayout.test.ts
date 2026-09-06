import { describe, it, expect } from 'vitest'
import { cardPosition, effectiveOrder, hiddenCards, moveCard, setCardHidden, visibleCards, type ViewLayouts } from './viewLayout'

describe('viewLayout', () => {
  it('ordre par défaut sans réglage, cartes inconnues ignorées', () => {
    expect(effectiveOrder('operations')).toEqual(['transactions', 'categories', 'yoy', 'detailed'])
    expect(effectiveOrder('operations', { order: ['yoy', 'plop'], hidden: [] })).toEqual(['yoy', 'transactions', 'categories', 'detailed'])
  })

  it('déplace une carte parmi les visibles et borne aux extrémités', () => {
    let layouts: ViewLayouts = {}
    layouts = moveCard('operations', 'yoy', -1, layouts)
    expect(visibleCards('operations', layouts)).toEqual(['transactions', 'yoy', 'categories', 'detailed'])
    expect(moveCard('operations', 'transactions', -1, layouts)).toBe(layouts)
    expect(cardPosition('operations', 'yoy', layouts)).toBe(1)
  })

  it('masque, saute les masquées lors du déplacement, réaffiche', () => {
    let layouts: ViewLayouts = setCardHidden('operations', 'categories', true, {})
    expect(hiddenCards('operations', layouts)).toEqual(['categories'])
    expect(visibleCards('operations', layouts)).toEqual(['transactions', 'yoy', 'detailed'])
    layouts = moveCard('operations', 'yoy', -1, layouts)
    expect(visibleCards('operations', layouts)).toEqual(['yoy', 'transactions', 'detailed'])
    layouts = setCardHidden('operations', 'categories', false, layouts)
    expect(hiddenCards('operations', layouts)).toEqual([])
  })
})
