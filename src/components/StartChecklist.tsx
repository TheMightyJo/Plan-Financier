/** Un geste de démarrage : fait ou non, avec l'action qui l'ouvre. */
export type StartChecklistItem = {
  id: string
  done: boolean
  title: string
  hint: string
  action: () => void
}

type Props = {
  items: StartChecklistItem[]
  done: number
  onDismiss: () => void
  /** Raccourci facultatif sous la liste (ex. import de relevé bancaire). */
  secondary?: { label: string; onClick: () => void }
}

/** Carte « Premiers pas » de l'Accueil : 3 gestes qui rendent l'app utile. */
export function StartChecklist({ items, done, onDismiss, secondary }: Props) {
  return (
          <section className="glass-card start-checklist" aria-label="Premiers pas">
            <div className="start-checklist__head">
              <div>
                <p className="eyebrow">Premiers pas</p>
                <h2>Votre budget en 3 gestes · {done}/3</h2>
              </div>
              <button type="button" className="start-checklist__dismiss" onClick={onDismiss} aria-label="Masquer les premiers pas">
                ✕
              </button>
            </div>
            <ul>
              {items.map((item) => (
                <li key={item.id} className={item.done ? 'start-checklist__item start-checklist__item--done' : 'start-checklist__item'}>
                  <button type="button" onClick={item.action} disabled={item.done}>
                    <span className="start-checklist__check" aria-hidden="true">{item.done ? '✓' : ''}</span>
                    <span className="start-checklist__text">
                      <strong>{item.title}</strong>
                      <small>{item.hint}</small>
                    </span>
                    {!item.done ? <span className="start-checklist__go" aria-hidden="true">→</span> : null}
                  </button>
                </li>
              ))}
            </ul>
            {secondary ? (
              <button type="button" className="start-checklist__secondary" onClick={secondary.onClick}>
                {secondary.label}
              </button>
            ) : null}
          </section>
  )
}
