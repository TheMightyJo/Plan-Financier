/**
 * Illustrations de la vitrine — dessinées maison en SVG (aucune photo ni
 * image tierce : libres de droit par construction). Les couleurs passent
 * par les jetons du thème pour rester lisibles en clair comme en sombre.
 */

const TERRACOTTA = '#C05C2A'
const GREEN = '#3A7D44'
const AMBER = '#B8963E'

const svgProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 320 200',
  role: 'img' as const,
  fontFamily: 'inherit',
}

/** Calendrier mensuel : montants par jour, jour courant mis en avant. */
export function CalendarIllustration() {
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  // Septembre 2026 commence un mardi → 1 case vide.
  const cells = Array.from({ length: 35 }, (_, index) => {
    const day = index // 0 = case vide, puis 1…30
    return day >= 1 && day <= 30 ? day : null
  })
  const amounts: Record<number, { text: string; color: string }> = {
    2: { text: '+2 450', color: GREEN },
    3: { text: '−850', color: TERRACOTTA },
    5: { text: '−86', color: TERRACOTTA },
    9: { text: '−142', color: TERRACOTTA },
    15: { text: '−65', color: TERRACOTTA },
    22: { text: '−62', color: TERRACOTTA },
  }
  return (
    <svg {...svgProps} aria-label="Calendrier des dépenses du mois">
      <rect x="1" y="1" width="318" height="198" rx="14" fill="var(--surface)" stroke="var(--border-soft)" />
      <text x="16" y="26" fontSize="13" fontWeight="800" fill="var(--text-1)">Septembre 2026</text>
      <text x="278" y="26" fontSize="13" fontWeight="700" fill="var(--text-2)">‹  ›</text>
      {days.map((label, index) => (
        <text key={index} x={34 + index * 44} y="46" fontSize="9" fontWeight="700" textAnchor="middle" fill="var(--text-2)">
          {label}
        </text>
      ))}
      {cells.map((day, index) => {
        const col = index % 7
        const row = Math.floor(index / 7)
        const x = 16 + col * 44
        const y = 54 + row * 28
        if (day === null) return null
        const isToday = day === 2
        const amount = amounts[day]
        return (
          <g key={index}>
            <rect
              x={x}
              y={y}
              width="36"
              height="24"
              rx="6"
              fill={isToday ? 'rgba(184, 150, 62, 0.18)' : 'var(--surface-soft)'}
              stroke={isToday ? AMBER : 'var(--border-soft)'}
              strokeWidth={isToday ? 1.5 : 1}
            />
            <text x={x + 5} y={y + 10} fontSize="7.5" fontWeight="700" fill="var(--text-2)">{day}</text>
            {amount ? (
              <text x={x + 33} y={y + 20} fontSize="7.5" fontWeight="800" textAnchor="end" fill={amount.color}>
                {amount.text}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

/** Poches (enveloppes) avec météo et jauge d'objectif. */
export function EnvelopesIllustration() {
  const pockets = [
    { name: 'Courses', weather: '☀️', amount: '320 €', ratio: 0.42, color: GREEN },
    { name: 'Maison', weather: '⛅', amount: '95 €', ratio: 0.78, color: AMBER },
    { name: 'Vacances', weather: '⛈️', amount: '−40 €', ratio: 1, color: TERRACOTTA },
  ]
  return (
    <svg {...svgProps} aria-label="Poches budgétaires avec leur météo">
      <rect x="1" y="1" width="318" height="198" rx="14" fill="var(--surface)" stroke="var(--border-soft)" />
      <text x="16" y="26" fontSize="13" fontWeight="800" fill="var(--text-1)">✉️ Mes poches</text>
      {pockets.map((pocket, index) => {
        const x = 14 + index * 100
        const y = 40
        return (
          <g key={pocket.name}>
            <rect x={x} y={y} width="92" height="144" rx="12" fill="var(--surface-soft)" stroke="var(--border-soft)" />
            {/* Rabat d'enveloppe */}
            <path d={`M${x} ${y + 12} L${x + 46} ${y + 44} L${x + 92} ${y + 12}`} fill="none" stroke="var(--border)" strokeWidth="1.5" />
            <text x={x + 10} y={y + 66} fontSize="11" fontWeight="800" fill="var(--text-1)">{pocket.name}</text>
            <text x={x + 82} y={y + 67} fontSize="14" textAnchor="end">{pocket.weather}</text>
            <text x={x + 10} y={y + 92} fontSize="15" fontWeight="800" fill={pocket.color}>{pocket.amount}</text>
            <text x={x + 10} y={y + 106} fontSize="7.5" fill="var(--text-2)">disponible</text>
            <rect x={x + 10} y={y + 120} width="72" height="7" rx="4" fill="rgba(128, 128, 128, 0.18)" />
            <rect x={x + 10} y={y + 120} width={72 * pocket.ratio} height="7" rx="4" fill={pocket.color} />
          </g>
        )
      })}
    </svg>
  )
}

/** Courbe hebdomadaire dépenses vs revenus, avec les statuts de semaine. */
export function WeeklyChartIllustration() {
  const xs = [36, 84, 132, 180, 228, 276]
  const incomes = [118, 116, 62, 120, 112, 54]
  const expenses = [128, 96, 102, 84, 138, 92]
  const toPoints = (values: number[]) => values.map((v, i) => `${xs[i]},${v}`).join(' ')
  const badges = [
    { label: 'Danger', color: TERRACOTTA, x: 24 },
    { label: 'Normal', color: 'var(--text-2)', x: 92 },
    { label: 'Up', color: GREEN, x: 160 },
    { label: 'Record', color: AMBER, x: 208 },
  ]
  return (
    <svg {...svgProps} aria-label="Courbe des semaines : dépenses et revenus">
      <rect x="1" y="1" width="318" height="198" rx="14" fill="var(--surface)" stroke="var(--border-soft)" />
      <text x="16" y="26" fontSize="13" fontWeight="800" fill="var(--text-1)">📊 Semaine par semaine</text>
      <circle cx="222" cy="22" r="4" fill={GREEN} />
      <text x="230" y="25" fontSize="8" fill="var(--text-2)">Revenus</text>
      <circle cx="274" cy="22" r="4" fill={TERRACOTTA} />
      <text x="282" y="25" fontSize="8" fill="var(--text-2)">Dépenses</text>
      {[60, 90, 120, 150].map((y) => (
        <line key={y} x1="24" x2="296" y1={y} y2={y} stroke="var(--border-soft)" strokeDasharray="3 4" />
      ))}
      <polyline points={toPoints(incomes)} fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinejoin="round" />
      <polyline points={toPoints(expenses)} fill="none" stroke={TERRACOTTA} strokeWidth="2.5" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={incomes[i]} r="3.5" fill={GREEN} stroke="var(--surface)" strokeWidth="1.5" />
          <circle cx={x} cy={expenses[i]} r="3.5" fill={TERRACOTTA} stroke="var(--surface)" strokeWidth="1.5" />
        </g>
      ))}
      {badges.map((badge) => (
        <g key={badge.label}>
          <rect x={badge.x} y="166" width={badge.label.length * 6.2 + 14} height="18" rx="9" fill="var(--surface-soft)" stroke={badge.color} />
          <text x={badge.x + 7 + (badge.label.length * 6.2) / 2} y="178" fontSize="8.5" fontWeight="800" textAnchor="middle" fill={badge.color}>
            {badge.label}
          </text>
        </g>
      ))}
      <text x="296" y="178" fontSize="8" textAnchor="end" fill="var(--text-2)">lun. → dim.</text>
    </svg>
  )
}
