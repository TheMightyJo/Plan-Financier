import { describe, it, expect } from 'vitest'
import { formatTooltipValue } from './format'

describe('formatTooltipValue', () => {
  it('formate un nombre en euro français sans décimales', () => {
    expect(formatTooltipValue(1234)).toMatch(/1\s?234\s?€/)
  })

  it('accepte une chaîne convertible en nombre', () => {
    expect(formatTooltipValue('500')).toMatch(/500\s?€/)
  })

  it('utilise la première valeur si on lui passe un tableau', () => {
    expect(formatTooltipValue([42, 99])).toMatch(/42\s?€/)
  })

  it('renvoie 0 € pour undefined', () => {
    expect(formatTooltipValue(undefined)).toMatch(/0\s?€/)
  })
})

describe('formatTooltipValue dates', () => {
  it("est sans décimales pour gérer l'affichage compact", () => {
    expect(formatTooltipValue(199.7)).not.toContain(',')
  })
})
