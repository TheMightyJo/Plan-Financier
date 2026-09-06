import type { Transaction } from '../types'

/** Groupe d'opérations d'un même jour (liste Dépenses), ordre d'entrée conservé. */
export type DayGroup = { date: string; items: Transaction[]; spent: number; income: number }

export const groupTransactionsByDay = (transactions: Transaction[]): DayGroup[] => {
  const groups: DayGroup[] = []
  const byDate = new Map<string, DayGroup>()
  for (const tx of transactions) {
    let group = byDate.get(tx.date)
    if (!group) {
      group = { date: tx.date, items: [], spent: 0, income: 0 }
      byDate.set(tx.date, group)
      groups.push(group)
    }
    group.items.push(tx)
    if (tx.kind === 'depense') group.spent += tx.amount
    else group.income += tx.amount
  }
  return groups
}

/** « Aujourd'hui », « Hier », sinon « lundi 22 sept. ». */
export const dayLabel = (iso: string, todayIso: string): string => {
  if (iso === todayIso) return "Aujourd'hui"
  const yesterday = new Date(`${todayIso}T12:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  if (iso === yesterday.toISOString().slice(0, 10)) return 'Hier'
  const label = new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
