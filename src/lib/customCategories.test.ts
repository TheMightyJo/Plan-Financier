import { describe, it, expect } from 'vitest'
import {
  allCategoryLabels,
  buildCategoryGroups,
  categoryOverrides,
  normalizeCustomCategory,
  renameCategoryInCaps,
  renameCategoryInRules,
  renameCategoryInTransactions,
  validateCategoryLabel,
  type CustomCategory,
} from './customCategories'
import type { Transaction } from '../types'

const custom = (overrides: Partial<CustomCategory> = {}): CustomCategory => ({
  label: 'Chien',
  kind: 'depense',
  emoji: '🐶',
  createdAt: 1,
  archivedAt: null,
  ...overrides,
})

describe('normalizeCustomCategory', () => {
  it('nettoie et borne', () => {
    expect(normalizeCustomCategory({ label: '  Chien ', kind: 'x', color: 'red', emoji: '🐶' })).toMatchObject({
      label: 'Chien',
      kind: 'depense',
      color: undefined,
      emoji: '🐶',
    })
    expect(normalizeCustomCategory({ label: '' })).toBeNull()
    expect(normalizeCustomCategory({ label: 'Ok', color: '#A1B2C3' })?.color).toBe('#A1B2C3')
  })
})

describe('buildCategoryGroups', () => {
  it('place les catégories sans groupe dans « Mes catégories » en tête', () => {
    const groups = buildCategoryGroups('depense', [custom()])
    expect(groups[0]).toEqual({ label: 'Mes catégories', options: ['Chien'] })
  })

  it('range dans le groupe choisi et ignore les archivées', () => {
    const groups = buildCategoryGroups('depense', [
      custom({ label: 'Vétérinaire', group: 'Loisirs & culture' }),
      custom({ label: 'Vieille', archivedAt: 5 }),
    ])
    expect(groups.find((g) => g.label === 'Loisirs & culture')?.options).toContain('Vétérinaire')
    expect(groups.flatMap((g) => g.options)).not.toContain('Vieille')
    expect(groups[0].label).not.toBe('Mes catégories')
  })

  it('ne duplique pas une surcharge d’une catégorie du catalogue', () => {
    const groups = buildCategoryGroups('depense', [custom({ label: 'Courses', emoji: '🥕' })])
    expect(groups.flatMap((g) => g.options).filter((o) => o === 'Courses')).toHaveLength(1)
  })
})

describe('validateCategoryLabel', () => {
  it('refuse vide, trop long et doublon (insensible à la casse)', () => {
    expect(validateCategoryLabel('  ', 'depense', [])).toBe('empty')
    expect(validateCategoryLabel('x'.repeat(41), 'depense', [])).toBe('too_long')
    expect(validateCategoryLabel('courses', 'depense', [])).toBe('exists')
    expect(validateCategoryLabel('chien', 'depense', [custom()])).toBe('exists')
    expect(validateCategoryLabel('Chien', 'depense', [custom()], 'Chien')).toBeNull()
    expect(validateCategoryLabel('Chat', 'depense', [custom()])).toBeNull()
  })
})

describe('allCategoryLabels / categoryOverrides', () => {
  it('ajoute les personnalisées actives au catalogue', () => {
    const labels = allCategoryLabels('depense', [custom(), custom({ label: 'Courses', emoji: '🥕' })])
    expect(labels).toContain('Chien')
    expect(labels.filter((l) => l === 'Courses')).toHaveLength(1)
  })

  it('expose les surcharges emoji/couleur par libellé', () => {
    expect(categoryOverrides([custom({ label: 'Courses', emoji: '🥕', color: '#123456' })])).toEqual({
      Courses: { emoji: '🥕', color: '#123456' },
    })
  })
})

describe('renommage', () => {
  const tx = (category: string): Transaction => ({
    id: 1,
    label: 'x',
    amount: 1,
    category,
    member: 'principal',
    date: '2026-09-01',
    kind: 'depense',
    envelope: 'Maison',
  })

  it('migre opérations, règles et plafonds', () => {
    expect(renameCategoryInTransactions([tx('Chien'), tx('Courses')], 'Chien', 'Animaux').map((t) => t.category)).toEqual(['Animaux', 'Courses'])
    expect(
      renameCategoryInRules(
        [{ id: 'r', member: 'principal', category: 'Chien', envelope: 'Maison', label: 'x', amount: 1, kind: 'depense', frequency: 'monthly', dayOfPeriod: 1, startDate: '2026-01-01', endDate: null, lastGeneratedOn: null, pausedAt: null, createdAt: 0, updatedAt: 0 }],
        'Chien',
        'Animaux',
      )[0].category,
    ).toBe('Animaux')
    expect(renameCategoryInCaps({ principal: { Chien: 50, Animaux: 20 }, autre: { Courses: 300 } }, 'Chien', 'Animaux')).toEqual({
      principal: { Animaux: 70 },
      autre: { Courses: 300 },
    })
  })
})
