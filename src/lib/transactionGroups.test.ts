import { describe, it, expect } from 'vitest'
import { dayLabel, groupTransactionsByDay } from './transactionGroups'
import type { Transaction } from '../types'

const tx = (id: number, date: string, amount: number, kind: 'depense' | 'revenu' = 'depense'): Transaction => ({
  id, date, amount, kind, label: 'x', category: 'Courses', member: 'principal', envelope: 'Maison',
})

describe('groupTransactionsByDay', () => {
  it('regroupe par jour en gardant l’ordre et totalise', () => {
    const groups = groupTransactionsByDay([tx(1, '2026-09-22', 10), tx(2, '2026-09-22', 5, 'revenu'), tx(3, '2026-09-20', 7)])
    expect(groups.map((g) => g.date)).toEqual(['2026-09-22', '2026-09-20'])
    expect(groups[0]).toMatchObject({ spent: 10, income: 5 })
    expect(groups[0].items.map((t) => t.id)).toEqual([1, 2])
  })
})

describe('dayLabel', () => {
  it("dit Aujourd'hui, Hier, sinon le jour", () => {
    expect(dayLabel('2026-09-06', '2026-09-06')).toBe("Aujourd'hui")
    expect(dayLabel('2026-09-05', '2026-09-06')).toBe('Hier')
    expect(dayLabel('2026-09-01', '2026-09-06')).toMatch(/^Mardi 1 sept\.?$/)
  })
})
