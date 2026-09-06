/** Petite bulle d'information (ℹ️) dépliable, utilisée dans les titres de cartes. */
export function InfoHint({ text }: { text: string }) {
  return (
    <details className="info-hint">
      <summary aria-label="Plus d'informations" title="Plus d'informations">ℹ️</summary>
      <span className="info-hint__pop" role="note">{text}</span>
    </details>
  )
}
