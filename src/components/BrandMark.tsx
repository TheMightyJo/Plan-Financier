type Props = {
  /** Taille en pixels (carré). */
  size?: number
  /** Fond café arrondi derrière le P (sinon transparent, P en currentColor). */
  withBackground?: boolean
  className?: string
}

/**
 * Symbole Plan Financier (le « P » à courbe ambre), issu du pack de marque.
 * Sans fond, les traits prennent la couleur du texte : lisible en thème
 * clair (café) comme sombre (crème). Décoratif : aria-hidden.
 */
export function BrandMark({ size = 28, withBackground = false, className }: Props) {
  const stroke = withBackground ? '#FDFAF6' : 'currentColor'
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {withBackground ? <rect width="64" height="64" rx="14" fill="#2A1810" /> : null}
      <line x1="16" y1="12" x2="16" y2="56" stroke={stroke} strokeWidth="9" strokeLinecap="round" />
      <path d="M16 12 H30 A14 14 0 0 1 44 26" stroke={stroke} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M44 26 A14 14 0 0 1 30 40 H24" stroke="#B8963E" strokeWidth="9" strokeLinecap="round" fill="none" />
    </svg>
  )
}

/** Symbole + mot-symbole (« Plan » gras, « Financier » régulier), comme sur le logo. */
export function BrandLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={`brand-logo${className ? ` ${className}` : ''}`}>
      <BrandMark size={size} />
      <span className="brand-logo__word">
        <strong>Plan</strong> Financier
      </span>
    </span>
  )
}
