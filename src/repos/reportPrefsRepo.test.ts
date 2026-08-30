import { describe, expect, it } from 'vitest'
import { MAX_REPORT_CC, parseCcEmails } from './reportPrefsRepo'

describe('parseCcEmails', () => {
  it('accepte virgules, points-virgules et espaces comme séparateurs', () => {
    expect(parseCcEmails('a@b.fr, c@d.fr;e@f.fr g@h.fr').valid).toEqual([
      'a@b.fr',
      'c@d.fr',
      'e@f.fr',
      'g@h.fr',
    ])
  })

  it('normalise en minuscules et déduplique', () => {
    const { valid } = parseCcEmails('Jean@Exemple.FR, jean@exemple.fr')
    expect(valid).toEqual(['jean@exemple.fr'])
  })

  it('rejette les fragments invalides sans bloquer les valides', () => {
    const { valid, invalid } = parseCcEmails('bon@ok.fr, pasunemail, aussi@raté')
    expect(valid).toEqual(['bon@ok.fr'])
    expect(invalid).toEqual(['pasunemail', 'aussi@raté'])
  })

  it('plafonne à MAX_REPORT_CC adresses', () => {
    const raw = Array.from({ length: 8 }, (_, i) => `u${i}@ex.fr`).join(', ')
    expect(parseCcEmails(raw).valid).toHaveLength(MAX_REPORT_CC)
  })

  it('renvoie des listes vides pour une saisie vide', () => {
    expect(parseCcEmails('  ')).toEqual({ valid: [], invalid: [] })
  })
})
