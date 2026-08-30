// Helpers calendrier purs (grille mensuelle lundi→dimanche, numéros de semaine
// ISO 8601). Utilisés par le calendrier des dépenses de l'Accueil.

export type CalendarDay = {
  /** YYYY-MM-DD */
  date: string
  day: number
  /** Faux pour les jours de complétion (mois précédent/suivant). */
  inMonth: boolean
}

export type CalendarWeek = {
  weekNumber: number
  days: CalendarDay[]
}

const pad = (value: number) => String(value).padStart(2, '0')

export const toISODate = (year: number, month: number, day: number): string =>
  `${year}-${pad(month)}-${pad(day)}`

/** Numéro de semaine ISO 8601 (1..53) pour une date YYYY-MM-DD. */
export const getISOWeek = (isoDate: string): number => {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  // Jeudi de la même semaine ISO (lundi = 1 … dimanche = 7).
  const isoDay = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - isoDay)
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  return Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7)
}

/**
 * Grille du mois `YYYY-MM` : semaines complètes lundi→dimanche, avec les jours
 * de complétion des mois voisins marqués `inMonth: false`.
 */
export const buildMonthGrid = (month: string): CalendarWeek[] => {
  const [year, monthIndex] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthIndex, 0).getDate()
  const firstWeekday = new Date(year, monthIndex - 1, 1).getDay() || 7 // lundi = 1

  const cells: CalendarDay[] = []

  // Complétion avant le 1er (fin du mois précédent).
  const prevMonthDays = new Date(year, monthIndex - 1, 0).getDate()
  const prevYear = monthIndex === 1 ? year - 1 : year
  const prevMonth = monthIndex === 1 ? 12 : monthIndex - 1
  for (let i = firstWeekday - 1; i > 0; i -= 1) {
    const day = prevMonthDays - i + 1
    cells.push({ date: toISODate(prevYear, prevMonth, day), day, inMonth: false })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: toISODate(year, monthIndex, day), day, inMonth: true })
  }

  // Complétion après le dernier jour (début du mois suivant).
  const nextYear = monthIndex === 12 ? year + 1 : year
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1
  let nextDay = 1
  while (cells.length % 7 !== 0) {
    cells.push({ date: toISODate(nextYear, nextMonth, nextDay), day: nextDay, inMonth: false })
    nextDay += 1
  }

  const weeks: CalendarWeek[] = []
  for (let i = 0; i < cells.length; i += 7) {
    const days = cells.slice(i, i + 7)
    weeks.push({ weekNumber: getISOWeek(days[0].date), days })
  }
  return weeks
}

/** Décale un mois YYYY-MM de `delta` mois. */
export const shiftMonth = (month: string, delta: number): string => {
  const [year, monthIndex] = month.split('-').map(Number)
  const total = year * 12 + (monthIndex - 1) + delta
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

/** Décale une date YYYY-MM-DD de `delta` jours. */
export const shiftDay = (isoDate: string, delta: number): string => {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + delta))
  return toISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}
