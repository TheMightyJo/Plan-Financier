import { describe, it, expect } from 'vitest'
import {
  filterTransactions,
  sortTransactions,
  aggregateFilteredStats,
  transactionsToCsv,
  defaultCriteria,
} from './transactionFilters'
import type { Account, Transaction } from '../types'

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: Math.floor(Math.random() * 1e6),
  label: 'tx',
  amount: 0,
  category: 'Autre',
  member: 'principal',
  date: '2026-05-01',
  kind: 'depense',
  envelope: 'Perso',
  ...overrides,
})

const sample: Transaction[] = [
  tx({ id: 1, label: 'Loyer', amount: 1200, category: 'Maison', date: '2026-04-05', accountId: 'cc' }),
  tx({ id: 2, label: 'Salaire', amount: 2500, category: 'Autre', kind: 'revenu', date: '2026-04-30', accountId: 'cc' }),
  tx({ id: 3, label: 'Carrefour', amount: 80, category: 'Courses', date: '2026-05-02', accountId: 'cc' }),
  tx({ id: 4, label: 'Cinéma', amount: 12, category: 'Loisirs', date: '2026-05-12', accountId: 'cc' }),
  tx({ id: 5, label: 'Virement épargne', amount: 200, category: 'Autre', date: '2026-05-15', accountId: 'liv' }),
  tx({ id: 6, label: 'Pharmacie', amount: 18, category: 'Sante', date: '2025-11-20', accountId: 'cc' }),
]

const today = '2026-05-15'

describe('filterTransactions — search', () => {
  it('matche par libellé insensible accents/casse', () => {
    const criteria = { ...defaultCriteria('principal'), search: 'Cinema' }
    expect(filterTransactions(sample, criteria, today).map((t) => t.id)).toEqual([4])
  })

  it('matche par catégorie', () => {
    const criteria = { ...defaultCriteria('principal'), search: 'Sante' }
    expect(filterTransactions(sample, criteria, today).map((t) => t.id)).toEqual([6])
  })

  it("vide = tout passe", () => {
    const criteria = defaultCriteria('principal')
    expect(filterTransactions(sample, criteria, today)).toHaveLength(6)
  })
})

describe('filterTransactions — kind / category / envelope / account', () => {
  it('kind = revenu', () => {
    const criteria = { ...defaultCriteria('principal'), kind: 'revenu' as const }
    expect(filterTransactions(sample, criteria, today).map((t) => t.id)).toEqual([2])
  })

  it('category = Loisirs', () => {
    const criteria = { ...defaultCriteria('principal'), category: 'Loisirs' as const }
    expect(filterTransactions(sample, criteria, today).map((t) => t.id)).toEqual([4])
  })

  it('accountId = liv', () => {
    const criteria = { ...defaultCriteria('principal'), accountId: 'liv' }
    expect(filterTransactions(sample, criteria, today).map((t) => t.id)).toEqual([5])
  })
})

describe('filterTransactions — period', () => {
  it("month = 2026-05 (mois courant)", () => {
    const criteria = { ...defaultCriteria('principal'), period: 'month' as const, monthIso: '2026-05' }
    expect(filterTransactions(sample, criteria, today).map((t) => t.id)).toEqual([3, 4, 5])
  })

  it("quarter = 3 derniers mois inclus mai (mars-avril-mai)", () => {
    const criteria = { ...defaultCriteria('principal'), period: 'quarter' as const }
    // today = 2026-05-15, donc cutoff = 2026-03-01
    expect(filterTransactions(sample, criteria, today).map((t) => t.id).sort()).toEqual([1, 2, 3, 4, 5])
  })

  it("year = 2026", () => {
    const criteria = { ...defaultCriteria('principal'), period: 'year' as const }
    expect(filterTransactions(sample, criteria, today).map((t) => t.id).sort()).toEqual([1, 2, 3, 4, 5])
  })

  it("custom range 2026-04-01 → 2026-04-30", () => {
    const criteria = {
      ...defaultCriteria('principal'),
      period: 'custom' as const,
      customFrom: '2026-04-01',
      customTo: '2026-04-30',
    }
    expect(filterTransactions(sample, criteria, today).map((t) => t.id).sort()).toEqual([1, 2])
  })
})

describe('sortTransactions', () => {
  it('date_desc (défaut)', () => {
    expect(sortTransactions(sample, 'date_desc').map((t) => t.id)).toEqual([5, 4, 3, 2, 1, 6])
  })
  it('date_asc', () => {
    expect(sortTransactions(sample, 'date_asc').map((t) => t.id)).toEqual([6, 1, 2, 3, 4, 5])
  })
  it('amount_desc', () => {
    expect(sortTransactions(sample, 'amount_desc').map((t) => t.id)).toEqual([2, 1, 5, 3, 6, 4])
  })
  it('amount_asc', () => {
    expect(sortTransactions(sample, 'amount_asc').map((t) => t.id)).toEqual([4, 6, 3, 5, 1, 2])
  })
})

describe('aggregateFilteredStats', () => {
  it('compte / revenu / dépense / net', () => {
    const stats = aggregateFilteredStats(sample)
    expect(stats.count).toBe(6)
    expect(stats.income).toBe(2500)
    expect(stats.expense).toBe(1200 + 80 + 12 + 200 + 18)
    expect(stats.net).toBe(2500 - (1200 + 80 + 12 + 200 + 18))
  })
})

describe('transactionsToCsv', () => {
  const accounts = new Map<string, Account>([
    [
      'cc',
      {
        id: 'cc',
        ownerMember: 'principal',
        name: 'Compte courant',
        type: 'checking',
        currency: 'EUR',
        initialBalance: 0,
        displayColor: null,
        displayIcon: null,
        archivedAt: null,
        createdAt: 0,
        updatedAt: 0,
      },
    ],
  ])

  it("écrit un header + une ligne par transaction (séparateur ;)", () => {
    const csv = transactionsToCsv([sample[0]], accounts)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('Date;Libellé;Catégorie;Enveloppe;Compte;Type;Montant')
    expect(lines[1]).toBe('2026-04-05;Loyer;Maison;Perso;Compte courant;Dépense;1200,00')
  })

  it("échappe les libellés avec point-virgule ou guillemet", () => {
    const csv = transactionsToCsv([tx({ label: 'Carrefour ; Express "promo"', amount: 5 })], new Map())
    const lines = csv.split('\n')
    expect(lines[1]).toContain('"Carrefour ; Express ""promo"""')
  })
})
