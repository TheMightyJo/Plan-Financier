import { useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { euroFormatter } from '../lib/format'
import { shiftMonth } from '../lib/calendar'
import type { WeekStat } from '../lib/weeklyStats'

/** Point du détail quotidien d'une semaine (lun → dim). */
export type StatsDailyPoint = { label: string; spent: number; income: number }

type Props = {
  statsMonth: string
  setStatsMonth: (month: string) => void
  statsSelectedWeek: string | null
  setStatsSelectedWeek: Dispatch<SetStateAction<string | null>>
  todayIso: string
  formatMonth: (ym: string) => string
  /** 12 semaines jusqu'à la fin du mois sélectionné. */
  statsViewData: WeekStat[]
  /** Semaines qui touchent le mois sélectionné. */
  statsMonthWeeks: WeekStat[]
  statsWeekDaily: StatsDailyPoint[] | null
  statsChartRef: RefObject<HTMLDivElement | null>
  exportWeeklyStatsPdf: (week?: WeekStat) => Promise<void>
}

/** Vue Statistiques : courbe hebdo dépenses vs revenus + semaine par semaine. */
export function StatsView(props: Props) {
  const {
    statsMonth, setStatsMonth, statsSelectedWeek, setStatsSelectedWeek, todayIso, formatMonth,
    statsViewData, statsMonthWeeks, statsWeekDaily, statsChartRef, exportWeeklyStatsPdf,
  } = props
  // Sélecteur mois + année (popover) : état purement local à la vue.
  const [statsPickerOpen, setStatsPickerOpen] = useState(false)
  const [statsPickerYear, setStatsPickerYear] = useState(() => Number(todayIso.slice(0, 4)))

  return (
      <section id="stats" className="panel-grid">
        <article className="glass-card chart-card wide-card">
          <div className="panel-title">
            <div>
              <h2>Dépenses vs Revenus par semaine</h2>
              <p>Semaines du lundi au dimanche · 12 semaines affichées sur le graphique.</p>
            </div>
            <div className="stats-toolbar">
              <button
                type="button"
                onClick={() => { setStatsMonth(shiftMonth(statsMonth, -1)); setStatsSelectedWeek(null) }}
                aria-label="Mois précédent"
              >‹</button>
              <span className="stats-month-picker-wrap">
                <button
                  type="button"
                  className="stats-month-title"
                  onClick={() => {
                    setStatsPickerYear(Number(statsMonth.slice(0, 4)))
                    setStatsPickerOpen((previous) => !previous)
                  }}
                  aria-expanded={statsPickerOpen}
                  title="Choisir le mois et l'année"
                >
                  {formatMonth(statsMonth).charAt(0).toUpperCase() + formatMonth(statsMonth).slice(1)} ▾
                </button>
                {statsPickerOpen ? (
                  <div className="stats-month-popover" role="dialog" aria-label="Choisir le mois et l'année">
                    <div className="stats-month-popover__year">
                      <button type="button" onClick={() => setStatsPickerYear((y) => y - 1)} aria-label="Année précédente">‹</button>
                      <strong>{statsPickerYear}</strong>
                      <button
                        type="button"
                        onClick={() => setStatsPickerYear((y) => y + 1)}
                        aria-label="Année suivante"
                        disabled={statsPickerYear >= Number(todayIso.slice(0, 4))}
                      >›</button>
                    </div>
                    <div className="stats-month-popover__grid">
                      {['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'].map((name, index) => {
                        const value = `${statsPickerYear}-${String(index + 1).padStart(2, '0')}`
                        return (
                          <button
                            key={name}
                            type="button"
                            className={value === statsMonth ? 'active' : ''}
                            disabled={value > todayIso.slice(0, 7)}
                            onClick={() => {
                              setStatsMonth(value)
                              setStatsSelectedWeek(null)
                              setStatsPickerOpen(false)
                            }}
                          >
                            {name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => { setStatsMonth(shiftMonth(statsMonth, 1)); setStatsSelectedWeek(null) }}
                aria-label="Mois suivant"
                disabled={statsMonth >= todayIso.slice(0, 7)}
              >›</button>
              {statsMonth !== todayIso.slice(0, 7) ? (
                <button type="button" onClick={() => { setStatsMonth(todayIso.slice(0, 7)); setStatsSelectedWeek(null) }}>
                  Aujourd&apos;hui
                </button>
              ) : null}
              <button type="button" className="hero-cta-button stats-export-btn" onClick={() => void exportWeeklyStatsPdf()}>
                📄 Exporter
              </button>
            </div>
          </div>
          {statsSelectedWeek && statsWeekDaily ? (
            <div className="stats-week-detail-bar">
              <strong>
                Détail de la semaine du{' '}
                {statsMonthWeeks.find((w) => w.weekStart === statsSelectedWeek)?.label ?? statsSelectedWeek}
              </strong>
              <button type="button" className="ghost-button" onClick={() => setStatsSelectedWeek(null)}>
                ← Retour aux 12 semaines
              </button>
            </div>
          ) : null}
          <div className="stats-chart-wrap" ref={statsChartRef}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={statsSelectedWeek && statsWeekDaily ? statsWeekDaily : statsViewData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(160, 128, 96, 0.2)" />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={11} interval="preserveStartEnd" />
                <YAxis stroke="#a1a1aa" fontSize={11} />
                <Tooltip
                  formatter={(value, name) => [
                    euroFormatter.format(Number(value)),
                    name === 'income' ? 'Revenus' : 'Dépenses',
                  ]}
                  labelFormatter={(label) => (statsSelectedWeek ? String(label) : `Semaine du ${label}`)}
                  contentStyle={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    color: 'var(--text-1)',
                  }}
                  labelStyle={{ color: 'var(--text-1)', fontWeight: 700 }}
                />
                <Line
                  type="linear"
                  dataKey="income"
                  name="income"
                  stroke="#3A7D44"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#3A7D44' }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="spent"
                  name="spent"
                  stroke="#C05C2A"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#C05C2A' }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="stats-legend">
            <span><i className="stats-legend__dot" style={{ background: '#3A7D44' }} /> Revenus</span>
            <span><i className="stats-legend__dot" style={{ background: '#C05C2A' }} /> Dépenses</span>
          </div>
        </article>

        <article className="glass-card chart-card wide-card">
          <div className="panel-title">
            <div>
              <h2>Semaine par semaine</h2>
              <p>
                Les semaines de {formatMonth(statsMonth)} — appuyez sur une semaine pour voir son
                détail jour par jour sur le graphique.
              </p>
            </div>
          </div>
          <ul className="stats-week-list">
            {[...statsMonthWeeks].reverse().map((week) => (
              <li key={week.weekStart} className={statsSelectedWeek === week.weekStart ? 'stats-week-row--active' : ''}>
                <button
                  type="button"
                  className="stats-week-main"
                  onClick={() => setStatsSelectedWeek((previous) => (previous === week.weekStart ? null : week.weekStart))}
                  aria-label={`Voir le détail de la semaine du ${week.label}`}
                >
                  <span className="stats-week-label">{week.label}</span>
                  <span className="stats-week-amounts">
                    <span className="income">+{euroFormatter.format(week.income)}</span>
                    <span className="expense">−{euroFormatter.format(week.spent)}</span>
                  </span>
                  <strong className={`stats-week-net ${week.net < 0 ? 'expense' : 'income'}`}>
                    {week.net >= 0 ? '+' : ''}{euroFormatter.format(week.net)}
                  </strong>
                  <span className={`stats-week-type stats-week-type--${week.type}`}>
                    {week.type === 'danger' ? '⚠️ Danger'
                      : week.type === 'highest' ? '🏆 Highest ever'
                      : week.type === 'up' ? '📈 Up'
                      : 'Normal'}
                  </span>
                </button>
                <button
                  type="button"
                  className="stats-week-export"
                  onClick={() => void exportWeeklyStatsPdf(week)}
                  aria-label={`Exporter la semaine du ${week.label} en PDF`}
                  title="Exporter cette semaine en PDF"
                >
                  📄
                </button>
              </li>
            ))}
          </ul>
        </article>
      </section>
  )
}
