import { useContext, type ReactNode } from 'react'
import { ViewLayoutContext } from '../lib/viewLayoutContext'
import { ChevronDown, ChevronUp, EyeOff, RotateCcw } from 'lucide-react'
import {
  cardPosition,
  cardTitle,
  hiddenCards,
  isCardHidden,
  visibleCards,
  type ViewId,
} from '../lib/viewLayout'

type CardProps = {
  view: ViewId
  id: string
  /** Carte sur deux colonnes dans une grille (reprend .wide-card). */
  wide?: boolean
  className?: string
  children: ReactNode
}

/**
 * Enveloppe une carte configurable : ordre via CSS `order` (le parent est
 * une grille), masquage, et petite barre ▲ ▼ ⨯ au survol.
 */
export function ViewCard({ view, id, wide = false, className, children }: CardProps) {
  const api = useContext(ViewLayoutContext)
  if (isCardHidden(view, id, api.layouts)) return null
  const visible = visibleCards(view, api.layouts)
  const index = visible.indexOf(id)
  const title = cardTitle(view, id)
  return (
    <div
      className={`view-card${wide ? ' wide-card' : ''}${className ? ` ${className}` : ''}`}
      style={{ order: cardPosition(view, id, api.layouts) }}
      data-view-card={id}
    >
      <div className="view-card__tools" role="group" aria-label={`Disposition : ${title}`}>
        <button type="button" onClick={() => api.move(view, id, -1)} disabled={index <= 0} title="Monter" aria-label={`Monter ${title}`}>
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={() => api.move(view, id, 1)}
          disabled={index < 0 || index >= visible.length - 1}
          title="Descendre"
          aria-label={`Descendre ${title}`}
        >
          <ChevronDown size={14} />
        </button>
        <button type="button" onClick={() => api.hide(view, id, true)} title="Masquer cette carte" aria-label={`Masquer ${title}`}>
          <EyeOff size={14} />
        </button>
      </div>
      {children}
    </div>
  )
}

/** Barre « cartes masquées » en bas d'une vue : un clic réaffiche. */
export function HiddenCardsBar({ view }: { view: ViewId }) {
  const api = useContext(ViewLayoutContext)
  const hidden = hiddenCards(view, api.layouts)
  const customized = Boolean(api.layouts[view])
  if (hidden.length === 0 && !customized) return null
  return (
    <div className="hidden-cards-bar" style={{ order: 999 }}>
      {hidden.length > 0 ? (
        <>
          <span className="hidden-cards-bar__label">Cartes masquées :</span>
          {hidden.map((id) => (
            <button key={id} type="button" onClick={() => api.hide(view, id, false)} title="Réafficher">
              + {cardTitle(view, id)}
            </button>
          ))}
        </>
      ) : null}
      {customized ? (
        <button type="button" className="hidden-cards-bar__reset" onClick={() => api.reset(view)} title="Revenir à la disposition d'origine">
          <RotateCcw size={12} /> Disposition d'origine
        </button>
      ) : null}
    </div>
  )
}
