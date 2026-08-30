import type { Transaction } from '../types'
import { shiftDay } from './calendar'

/**
 * Statistiques hebdomadaires (semaine du lundi au dimanche, ISO 8601) pour la
 * vue Statistiques : dépenses vs revenus par semaine, avec un « type » :
 *   - danger  : solde de la semaine négatif (dépensé plus que reçu)
 *   - highest : meilleur solde positif jamais enregistré (sur tout l'historique)
 *   - up      : solde positif en progression par rapport à la semaine précédente
 *   - normal  : le reste
 */

export type WeekType = 'danger' | 'normal' | 'up' | 'highest'

export type WeekStat = {
  /** Lundi de la semaine (YYYY-MM-DD). */
  weekStart: string
  /** Dimanche de la semaine (YYYY-MM-DD). */
  weekEnd: string
  /** Libellé court (« 1–7 sept. »). */
  label: string
  spent: number
  income: number
  net: number
  type: WeekType
}

/** Lundi (ISO) de la semaine contenant la date donnée. */
export const mondayOf = (isoDate: string): string => {
  const date = new Date(`${isoDate}T12:00:00`)
  const offset = (date.getDay() + 6) % 7 // lundi = 0
  return shiftDay(isoDate, -offset)
}

const weekLabel = (weekStart: string, weekEnd: string): string => {
  const fmt = (iso: string, withMonth: boolean) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', {
      day: 'numeric',
      ...(withMonth ? { month: 'short' } : {}),
    })
  const sameMonth = weekStart.slice(0, 7) === weekEnd.slice(0, 7)
  return `${fmt(weekStart, !sameMonth)} – ${fmt(weekEnd, true)}`
}

/**
 * Les `weeksBack` dernières semaines (la plus ancienne d'abord, semaine en
 * cours incluse). Le record « highest » est évalué sur TOUT l'historique des
 * transactions, pas seulement la fenêtre affichée.
 */
export const weeklyStats = (
  transactions: Transaction[],
  todayIso: string,
  weeksBack = 12,
): WeekStat[] => {
  // Totaux par lundi de semaine, sur tout l'historique.
  const totals = new Map<string, { spent: number; income: number }>()
  for (const tx of transactions) {
    const monday = mondayOf(tx.date)
    const entry = totals.get(monday) ?? { spent: 0, income: 0 }
    if (tx.kind === 'depense') entry.spent += tx.amount
    else entry.income += tx.amount
    totals.set(monday, entry)
  }

  const currentMonday = mondayOf(todayIso)
  const windowMondays = Array.from({ length: weeksBack }, (_, i) =>
    shiftDay(currentMonday, -7 * (weeksBack - 1 - i)),
  )

  // Record absolu de solde positif (toutes semaines confondues).
  let highestNet = 0
  let highestMonday: string | null = null
  for (const [monday, entry] of totals) {
    const net = entry.income - entry.spent
    if (net > highestNet) {
      highestNet = net
      highestMonday = monday
    }
  }

  return windowMondays.map((monday, index) => {
    const entry = totals.get(monday) ?? { spent: 0, income: 0 }
    const net = entry.income - entry.spent
    const previousMonday = index > 0 ? windowMondays[index - 1] : shiftDay(monday, -7)
    const previousEntry = totals.get(previousMonday) ?? { spent: 0, income: 0 }
    const previousNet = previousEntry.income - previousEntry.spent

    let type: WeekType = 'normal'
    if (net < 0) {
      type = 'danger'
    } else if (net > 0 && monday === highestMonday) {
      type = 'highest'
    } else if (net > 0 && net > previousNet) {
      type = 'up'
    }

    const weekEnd = shiftDay(monday, 6)
    return {
      weekStart: monday,
      weekEnd,
      label: weekLabel(monday, weekEnd),
      spent: Math.round(entry.spent * 100) / 100,
      income: Math.round(entry.income * 100) / 100,
      net: Math.round(net * 100) / 100,
      type,
    }
  })
}
