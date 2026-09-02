import { describe, expect, it } from 'vitest'
import { candidateKey, detectRecurringCandidates } from './recurringDetection'
import type { RecurringRule, Transaction } from '../types'

const tx = (id: number, label: string, amount: number, date: string, kind: 'depense' | 'revenu' = 'depense'): Transaction => ({
  id,
  label,
  amount,
  category: 'Maison',
  member: 'moi',
  date,
  kind,
  envelope: 'Maison',
})

describe('detectRecurringCandidates', () => {
  it('détecte un loyer qui revient chaque mois à date et montant proches', () => {
    const rows = [tx(1, 'Loyer', 850, '2026-06-03'), tx(2, 'Loyer', 850, '2026-07-04'), tx(3, 'Loyer', 850, '2026-08-03')]
    const result = detectRecurringCandidates(rows, [])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ label: 'Loyer', amount: 850, dayOfMonth: 3, months: 3, kind: 'depense' })
  })

  it('ignore les achats isolés et les montants trop variables', () => {
    const rows = [
      tx(1, 'Cadeau', 40, '2026-06-10'),
      tx(2, 'Courses', 60, '2026-06-12'),
      tx(3, 'Courses', 140, '2026-07-12'),
    ]
    expect(detectRecurringCandidates(rows, [])).toHaveLength(0)
  })

  it('exige des mois consécutifs', () => {
    const rows = [tx(1, 'Assurance', 30, '2026-03-05'), tx(2, 'Assurance', 30, '2026-08-05')]
    expect(detectRecurringCandidates(rows, [])).toHaveLength(0)
  })

  it('tolère de petites variations de montant et de jour, et les chiffres dans le libellé', () => {
    const rows = [tx(1, 'EDF facture 0123', 78, '2026-07-15'), tx(2, 'EDF facture 0456', 84, '2026-08-17')]
    const result = detectRecurringCandidates(rows, [])
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(81)
  })

  it('exclut les libellés déjà programmés, rejetés, ou générés par une règle', () => {
    const rule: RecurringRule = {
      id: 'r1', member: 'moi', category: 'Maison', envelope: 'Maison', label: 'loyer', amount: 850, kind: 'depense',
      frequency: 'monthly', dayOfPeriod: 3, startDate: '2026-06-03', endDate: null, lastGeneratedOn: null,
      pausedAt: null, createdAt: 0, updatedAt: 0,
    }
    const rows = [
      tx(1, 'Loyer', 850, '2026-07-03'),
      tx(2, 'Loyer', 850, '2026-08-03'),
      tx(3, 'Netflix', 14, '2026-07-10'),
      tx(4, 'Netflix', 14, '2026-08-10'),
      { ...tx(5, 'Spotify', 10, '2026-07-01'), recurringRuleId: 'r9' },
      { ...tx(6, 'Spotify', 10, '2026-08-01'), recurringRuleId: 'r9' },
    ]
    const result = detectRecurringCandidates(rows, [rule], [candidateKey('netflix', 'depense')])
    expect(result).toHaveLength(0)
  })

  it('propose aussi les revenus et classe par montant décroissant', () => {
    const rows = [
      tx(1, 'Salaire', 2400, '2026-07-28', 'revenu'),
      tx(2, 'Salaire', 2400, '2026-08-28', 'revenu'),
      tx(3, 'Internet', 30, '2026-07-06'),
      tx(4, 'Internet', 30, '2026-08-06'),
    ]
    const result = detectRecurringCandidates(rows, [])
    expect(result.map((c) => c.label)).toEqual(['Salaire', 'Internet'])
    expect(result[0].kind).toBe('revenu')
  })
})
