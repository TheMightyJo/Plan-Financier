import type { Forecast } from '../lib/forecast'
import { euroFormatter } from '../lib/format'

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
  const W = 320
  const H = 90
  const PAD = 6
  const values = forecast.points.map((p) => p.projected)
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const x = (i: number) => PAD + (i / Math.max(1, values.length - 1)) * (W - PAD * 2)
  const y = (v: number) => PAD + ((max - v) / span) * (H - PAD * 2)
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${x(0).toFixed(1)},${y(0).toFixed(1)} ${line} ${x(values.length - 1).toFixed(1)},${y(0).toFixed(1)}`
  const zero = y(0)
  return (
    <svg
      className={`forecast-spark forecast-spark--${forecast.status}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Solde projeté jour par jour"
    >
      <line x1={PAD} x2={W - PAD} y1={zero} y2={zero} className="forecast-spark__zero" />
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
            r={3}
            className={`forecast-spark__dot forecast-spark__dot--${item.kind}`}
          >
            <title>{`${shortDay(item.date)} · ${item.label} ${item.kind === 'depense' ? '−' : '+'}${euroFormatter.format(item.amount)}`}</title>
          </circle>
        )
      })}
    </svg>
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
              <span className="forecast-upcoming__label">{item.label}</span>
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
