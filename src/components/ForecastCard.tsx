import { useLayoutEffect, useRef, useState } from 'react'
import type { Forecast } from '../lib/forecast'
import { euroFormatter } from '../lib/format'
import { MerchantLogo } from './MerchantLogo'

type Props = {
  forecast: Forecast
  /** Ouvre le gestionnaire de charges récurrentes. */
  onManageRecurring: () => void
}

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
const shortDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

const STATUS = {
  ok: { icon: '✅', title: 'Fin de mois prévue' },
  tight: { icon: '⚠️', title: 'Fin de mois serrée' },
  negative: { icon: '🚨', title: 'Découvert probable' },
} as const

/** Courbe du solde projeté jusqu'à la fin du mois (SVG inline, sans dépendance). */
function Sparkline({ forecast }: { forecast: Forecast }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(320)

  // Largeur réelle du conteneur → viewBox 1:1, aucune déformation (points ronds, traits nets).
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const update = () => setWidth(Math.max(200, Math.round(host.getBoundingClientRect().width)))
    update()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    observer?.observe(host)
    return () => observer?.disconnect()
  }, [])

  const H = 120
  const PAD_X = 16
  const PAD_TOP = 22
  const PAD_BOTTOM = 22
  const values = forecast.points.map((p) => p.projected)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  // Plage centrée sur les valeurs (zéro inclus seulement s'il est proche) ; marge 12 %.
  let lo = rawMin < 0 || rawMin < rawMax * 0.15 ? Math.min(0, rawMin) : rawMin
  let hi = rawMax
  if (hi - lo < 1) {
    hi += 50
    lo -= 50
  }
  const margin = (hi - lo) * 0.12
  lo -= margin
  hi += margin
  const span = hi - lo
  const x = (i: number) => PAD_X + (i / Math.max(1, values.length - 1)) * (width - PAD_X * 2)
  const y = (v: number) => PAD_TOP + ((hi - v) / span) * (H - PAD_TOP - PAD_BOTTOM)
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const floor = H - PAD_BOTTOM
  const area = `${x(0).toFixed(1)},${floor} ${line} ${x(values.length - 1).toFixed(1)},${floor}`
  const zeroVisible = lo < 0 && hi > 0
  const last = values.length - 1
  const midIndex = Math.floor(last / 2)
  const tick = (i: number) => shortDay(forecast.points[i].date)

  return (
    <div className="forecast-spark-host" ref={hostRef}>
      <svg
        className={`forecast-spark forecast-spark--${forecast.status}`}
        viewBox={`0 0 ${width} ${H}`}
        width={width}
        height={H}
        role="img"
        aria-label="Solde projeté jour par jour"
      >
        {zeroVisible ? <line x1={PAD_X} x2={width - PAD_X} y1={y(0)} y2={y(0)} className="forecast-spark__zero" /> : null}
        <polygon points={area} className="forecast-spark__area" />
        <polyline points={line} className="forecast-spark__line" fill="none" />
        {forecast.upcomingFixed.slice(0, 12).map((item) => {
          const index = forecast.points.findIndex((p) => p.date === item.date)
          if (index < 0) return null
          return (
            <circle
              key={`${item.ruleId}-${item.date}`}
              cx={x(index)}
              cy={y(forecast.points[index].projected)}
              r={4}
              className={`forecast-spark__dot forecast-spark__dot--${item.kind}`}
            >
              <title>{`${shortDay(item.date)} · ${item.label} ${item.kind === 'depense' ? '−' : '+'}${euroFormatter.format(item.amount)}`}</title>
            </circle>
          )
        })}
        {/* Montants de départ et d'arrivée */}
        <text x={x(0)} y={y(values[0]) - 10} className="forecast-spark__value" textAnchor="start">
          {euroFormatter.format(values[0])}
        </text>
        <text x={x(last) - 10} y={y(values[last]) - 10} className="forecast-spark__value forecast-spark__value--end" textAnchor="end">
          {euroFormatter.format(values[last])}
        </text>
        {/* Repères de dates */}
        <text x={x(0)} y={H - 6} className="forecast-spark__tick" textAnchor="start">
          Aujourd'hui
        </text>
        {last >= 4 ? (
          <text x={x(midIndex)} y={H - 6} className="forecast-spark__tick" textAnchor="middle">
            {tick(midIndex)}
          </text>
        ) : null}
        <text x={x(last)} y={H - 6} className="forecast-spark__tick" textAnchor="end">
          {tick(last)}
        </text>
      </svg>
    </div>
  )
}

/** Carte Accueil : prévision de fin de mois (solde projeté, charges à venir, rythme). */
export function ForecastCard({ forecast, onManageRecurring }: Props) {
  const status = STATUS[forecast.status]
  const upcoming = forecast.upcomingFixed.slice(0, 5)
  return (
    <article className={`glass-card forecast-card forecast-card--${forecast.status}`}>
      <div className="panel-title">
        <div>
          <h2>
            {status.icon} {status.title}
          </h2>
          <p>
            {forecast.status === 'negative' && forecast.firstNegativeDate
              ? `Au rythme actuel, votre reste passe sous zéro le ${dayLabel(forecast.firstNegativeDate)}.`
              : forecast.daysLeft === 0
                ? 'Dernier jour du mois : voici où vous en êtes.'
                : `Ce qu'il devrait vous rester le ${dayLabel(forecast.points[forecast.points.length - 1].date)}, au rythme actuel.`}
          </p>
        </div>
        <strong className={`forecast-end ${forecast.endOfMonth < 0 ? 'negative' : 'positive'}`}>
          {forecast.endOfMonth >= 0 ? '+' : ''}
          {euroFormatter.format(forecast.endOfMonth)}
        </strong>
      </div>

      {forecast.daysLeft > 0 ? <Sparkline forecast={forecast} /> : null}

      <div className="forecast-figures">
        <div>
          <span className="forecast-figure__label">Charges fixes à venir</span>
          <strong className="negative">−{euroFormatter.format(forecast.fixedExpenses)}</strong>
        </div>
        <div>
          <span className="forecast-figure__label">Revenus à venir</span>
          <strong className="positive">+{euroFormatter.format(forecast.fixedIncomes)}</strong>
        </div>
        <div>
          <span className="forecast-figure__label">Dépenses courantes estimées</span>
          <strong className="negative">−{euroFormatter.format(forecast.variableTotal)}</strong>
        </div>
      </div>

      {upcoming.length > 0 ? (
        <ul className="forecast-upcoming">
          {upcoming.map((item) => (
            <li key={`${item.ruleId}-${item.date}`}>
              <span className="forecast-upcoming__date">{shortDay(item.date)}</span>
              <span className="forecast-upcoming__label">
                <MerchantLogo label={item.label} fallbackIcon={item.kind === 'depense' ? '🔁' : '💼'} className="forecast-upcoming__icon" />
                {item.label}
              </span>
              <span className={item.kind === 'depense' ? 'negative' : 'positive'}>
                {item.kind === 'depense' ? '−' : '+'}
                {euroFormatter.format(item.amount)}
              </span>
            </li>
          ))}
          {forecast.upcomingFixed.length > upcoming.length ? (
            <li className="forecast-upcoming__more">+ {forecast.upcomingFixed.length - upcoming.length} autres</li>
          ) : null}
        </ul>
      ) : (
        <p className="forecast-note">
          Aucune charge fixe à venir n'est programmée.{' '}
          <button type="button" className="forecast-link" onClick={onManageRecurring}>
            Ajoutez vos charges récurrentes
          </button>{' '}
          pour une prévision plus juste.
        </p>
      )}

      <p className="forecast-note">
        {forecast.historyDays >= 7
          ? `Dépenses courantes : ≈ ${euroFormatter.format(forecast.variableDailyRate)} / jour, d'après vos ${forecast.historyDays} derniers jours.`
          : forecast.historyDays > 0
            ? `Dépenses courantes estimées sur ${forecast.historyDays} jour${forecast.historyDays > 1 ? 's' : ''} seulement : la prévision s'affinera avec le temps.`
            : 'Pas encore assez d’historique pour estimer vos dépenses courantes : seules les charges fixes sont prises en compte.'}
      </p>
    </article>
  )
}
