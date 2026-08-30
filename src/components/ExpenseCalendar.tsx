import { useMemo, useState } from 'react'
import { buildMonthGrid, shiftDay, shiftMonth } from '../lib/calendar'
import { getOccurrencesBetween } from '../lib/recurring'
import { euroFormatter } from '../lib/format'
import { categoryColors } from '../lib/categories'
import type { RecurringRule, Transaction } from '../types'

type CalendarView = 'day' | 'month' | 'year'

type Props = {
  /** Mois affiché (YYYY-MM) — piloté par le parent (sélecteur global). */
  month: string
  /** Transactions du profil actif (tous mois confondus, pour la vue année). */
  transactions: Transaction[]
  onMonthChange: (month: string) => void
  /** Date du jour (YYYY-MM-DD) — passée par le parent pour rester pur. */
  today: string
  /** Si fourni : bouton « Ajouter une dépense » sur la vue jour, pré-daté. */
  onAddExpense?: (date: string) => void
  /** Si fourni : bouton ✏️ sur chaque opération de la vue jour. */
  onEditExpense?: (transaction: Transaction) => void
  /** Règles récurrentes du profil : projette les échéances À VENIR (« prévu »). */
  recurringRules?: RecurringRule[]
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_LABELS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

/** Format compact pour les cases (« 42 € », « 1,2k € »). */
const compactEuro = (value: number): string => {
  if (value >= 1000) {
    const k = value / 1000
    return `${k.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}k €`
  }
  return `${Math.round(value)} €`
}

const formatMonthTitle = (month: string): string => {
  const [year, monthIndex] = month.split('-').map(Number)
  return `${MONTH_LABELS[monthIndex - 1]} ${year}`
}

const formatDayTitle = (isoDate: string): string =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

export function ExpenseCalendar({ month, transactions, onMonthChange, today, onAddExpense, onEditExpense, recurringRules = [] }: Props) {
  const [view, setView] = useState<CalendarView>('month')
  const [selectedDay, setSelectedDay] = useState<string>(() => `${month}-01`)

  const year = month.slice(0, 4)

  // Totaux par jour (dépenses / revenus) sur tout l'historique du profil.
  const totalsByDay = useMemo(() => {
    const map = new Map<string, { spent: number; income: number }>()
    for (const tx of transactions) {
      const entry = map.get(tx.date) ?? { spent: 0, income: 0 }
      if (tx.kind === 'depense') entry.spent += tx.amount
      else entry.income += tx.amount
      map.set(tx.date, entry)
    }
    return map
  }, [transactions])

  // Totaux par mois de l'année affichée (vue année).
  const totalsByMonth = useMemo(() => {
    const totals = Array.from({ length: 12 }, () => ({ spent: 0, income: 0 }))
    for (const tx of transactions) {
      if (!tx.date.startsWith(year)) continue
      const index = Number(tx.date.slice(5, 7)) - 1
      if (tx.kind === 'depense') totals[index].spent += tx.amount
      else totals[index].income += tx.amount
    }
    return totals
  }, [transactions, year])

  const weeks = useMemo(() => buildMonthGrid(month), [month])

  // Échéances récurrentes À VENIR (strictement après aujourd'hui) sur la
  // plage affichée — montrées en « prévu », sans compter dans les totaux.
  const plannedByDay = useMemo(() => {
    const map = new Map<string, { total: number; items: Array<{ label: string; amount: number; kind: Transaction['kind'] }> }>()
    if (recurringRules.length === 0) return map
    const gridStart = weeks[0]?.days[0]?.date
    const gridEnd = weeks.at(-1)?.days.at(-1)?.date
    if (!gridStart || !gridEnd) return map
    const from = shiftDay(today, 1) > gridStart ? shiftDay(today, 1) : gridStart
    if (from > gridEnd) return map
    // Échéances déjà transformées en vraie transaction (même règle, même
    // jour) : ne pas les réafficher en « prévu » — sinon doublon à l'écran.
    const materialized = new Set(
      transactions
        .filter((tx) => tx.recurringRuleId)
        .map((tx) => `${tx.recurringRuleId}|${tx.date}`),
    )
    for (const rule of recurringRules) {
      if (rule.pausedAt !== null) continue
      for (const date of getOccurrencesBetween(rule, from, gridEnd)) {
        if (materialized.has(`${rule.id}|${date}`)) continue
        const entry = map.get(date) ?? { total: 0, items: [] }
        entry.total += rule.kind === 'depense' ? rule.amount : 0
        entry.items.push({ label: rule.label, amount: rule.amount, kind: rule.kind })
        map.set(date, entry)
      }
    }
    return map
  }, [recurringRules, transactions, weeks, today])
  const monthMaxSpent = useMemo(
    () =>
      Math.max(
        1,
        ...weeks.flatMap((week) =>
          week.days.filter((d) => d.inMonth).map((d) => totalsByDay.get(d.date)?.spent ?? 0),
        ),
      ),
    [weeks, totalsByDay],
  )

  const dayTransactions = useMemo(
    () =>
      transactions
        .filter((tx) => tx.date === selectedDay)
        .sort((a, b) => b.amount - a.amount),
    [transactions, selectedDay],
  )
  const dayTotals = totalsByDay.get(selectedDay) ?? { spent: 0, income: 0 }

  const openDay = (date: string) => {
    setSelectedDay(date)
    if (!date.startsWith(month)) onMonthChange(date.slice(0, 7))
    setView('day')
  }

  const navigate = (delta: number) => {
    if (view === 'year') {
      onMonthChange(shiftMonth(month, delta * 12))
    } else if (view === 'day') {
      const next = shiftDay(selectedDay, delta)
      setSelectedDay(next)
      if (!next.startsWith(month)) onMonthChange(next.slice(0, 7))
    } else {
      onMonthChange(shiftMonth(month, delta))
    }
  }

  const title =
    view === 'year' ? year : view === 'day' ? formatDayTitle(selectedDay) : formatMonthTitle(month)

  return (
    <div className="expense-calendar">
      <div className="expense-calendar__toolbar">
        <div className="expense-calendar__nav">
          <button type="button" onClick={() => navigate(-1)} aria-label="Précédent">‹</button>
          <strong className="expense-calendar__title">{title}</strong>
          <button type="button" onClick={() => navigate(1)} aria-label="Suivant">›</button>
          <button
            type="button"
            className="expense-calendar__today-btn"
            onClick={() => {
              onMonthChange(today.slice(0, 7))
              setSelectedDay(today)
              if (view === 'year') setView('month')
            }}
          >
            Aujourd&apos;hui
          </button>
        </div>
        <div className="expense-calendar__views" role="tablist" aria-label="Vue du calendrier">
          {([['day', 'Jour'], ['month', 'Mois'], ['year', 'Année']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className={view === id ? 'active' : ''}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' ? (
        <div className="expense-calendar__month" role="grid" aria-label={`Dépenses de ${title}`}>
          <div className="expense-calendar__head" role="row">
            <span className="expense-calendar__weeknum" title="Numéro de semaine">Sem.</span>
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week.weekNumber + week.days[0].date} className="expense-calendar__week" role="row">
              <span className="expense-calendar__weeknum" title={`Semaine ${week.weekNumber}`}>
                {week.weekNumber}
              </span>
              {week.days.map((cell) => {
                const totals = totalsByDay.get(cell.date)
                const spent = totals?.spent ?? 0
                const income = totals?.income ?? 0
                const intensity = spent > 0 ? 0.12 + 0.38 * (spent / monthMaxSpent) : 0
                return (
                  <button
                    key={cell.date}
                    type="button"
                    className={`expense-calendar__cell${cell.inMonth ? '' : ' expense-calendar__cell--out'}${cell.date === today ? ' expense-calendar__cell--today' : ''}`}
                    style={intensity > 0 ? { background: `rgba(192, 92, 42, ${intensity})` } : undefined}
                    onClick={() => openDay(cell.date)}
                    aria-current={cell.date === today ? 'date' : undefined}
                    aria-label={`${cell.date} : ${spent > 0 ? `${Math.round(spent)} € dépensés` : 'aucune dépense'}`}
                  >
                    <span className="expense-calendar__daynum">{cell.day}</span>
                    {spent > 0 ? <span className="expense-calendar__spent">−{compactEuro(spent)}</span> : null}
                    {income > 0 ? <span className="expense-calendar__income">+{compactEuro(income)}</span> : null}
                    {(plannedByDay.get(cell.date)?.total ?? 0) > 0 ? (
                      <span className="expense-calendar__planned" title="Échéance prévue (charge récurrente)">
                        ⏳{compactEuro(plannedByDay.get(cell.date)!.total)}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      ) : null}

      {view === 'year' ? (
        <div className="expense-calendar__year">
          {MONTH_LABELS.map((label, index) => {
            const totals = totalsByMonth[index]
            const monthKey = `${year}-${String(index + 1).padStart(2, '0')}`
            const yearMax = Math.max(1, ...totalsByMonth.map((t) => t.spent))
            const intensity = totals.spent > 0 ? 0.12 + 0.38 * (totals.spent / yearMax) : 0
            return (
              <button
                key={label}
                type="button"
                className={`expense-calendar__yearcell${monthKey === month ? ' expense-calendar__yearcell--current' : ''}`}
                style={intensity > 0 ? { background: `rgba(192, 92, 42, ${intensity})` } : undefined}
                onClick={() => {
                  onMonthChange(monthKey)
                  setView('month')
                }}
              >
                <strong>{label}</strong>
                {totals.spent > 0 ? <span className="expense-calendar__spent">−{compactEuro(totals.spent)}</span> : <span className="expense-calendar__empty">—</span>}
                {totals.income > 0 ? <span className="expense-calendar__income">+{compactEuro(totals.income)}</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}

      {view === 'day' ? (
        <div className="expense-calendar__day">
          <div className="expense-calendar__day-summary">
            <span className="expense-calendar__spent">−{euroFormatter.format(dayTotals.spent)} dépensés</span>
            {dayTotals.income > 0 ? (
              <span className="expense-calendar__income">+{euroFormatter.format(dayTotals.income)} reçus</span>
            ) : null}
          </div>
          {dayTransactions.length === 0 ? (
            <p className="expense-calendar__empty-day">Aucune opération ce jour.</p>
          ) : (
            <ul className="expense-calendar__day-list">
              {dayTransactions.map((tx) => (
                <li key={tx.id}>
                  <span className="recent-tx-dot" style={{ background: categoryColors[tx.category] }} aria-hidden="true" />
                  <span className="expense-calendar__day-label">
                    {tx.label}
                    {tx.recurringRuleId ? <span className="recurring-badge" title="Générée automatiquement">🔁</span> : null}
                    {(tx.tags ?? []).map((tag) => (
                      <span key={tag} className="tx-tag">#{tag}</span>
                    ))}
                  </span>
                  <span className="expense-calendar__day-cat">{tx.category}</span>
                  <span className={tx.kind === 'depense' ? 'expense-calendar__spent' : 'expense-calendar__income'}>
                    {tx.kind === 'depense' ? '−' : '+'}{euroFormatter.format(tx.amount)}
                  </span>
                  {onEditExpense ? (
                    <button
                      type="button"
                      className="expense-calendar__edit-btn"
                      onClick={() => onEditExpense(tx)}
                      aria-label={`Modifier ${tx.label}`}
                      title="Modifier"
                    >
                      ✏️
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {(plannedByDay.get(selectedDay)?.items.length ?? 0) > 0 ? (
            <div className="expense-calendar__planned-block">
              <p className="expense-calendar__planned-title">⏳ Prévu ce jour (charges récurrentes)</p>
              <ul className="expense-calendar__day-list">
                {plannedByDay.get(selectedDay)!.items.map((item, index) => (
                  <li key={`${item.label}-${index}`} className="expense-calendar__planned-row">
                    <span className="recurring-badge" aria-hidden="true">🔁</span>
                    <span className="expense-calendar__day-label">{item.label}</span>
                    <span className="expense-calendar__day-cat">automatique</span>
                    <span className={item.kind === 'depense' ? 'expense-calendar__spent' : 'expense-calendar__income'}>
                      {item.kind === 'depense' ? '−' : '+'}{euroFormatter.format(item.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="expense-calendar__day-actions">
            {onAddExpense ? (
              <button type="button" className="hero-cta-button" onClick={() => onAddExpense(selectedDay)}>
                + Ajouter une dépense ce jour
              </button>
            ) : null}
            <button type="button" className="ghost-button" onClick={() => setView('month')}>
              ← Retour au mois
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
