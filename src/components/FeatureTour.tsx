import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { TourStep } from '../lib/featureTourSteps'

/**
 * Tour guidé des fonctionnalités (première connexion, puis à la demande).
 * Chaque étape met en lumière un élément marqué `data-tour="…"` avec un
 * projecteur (découpe dans un voile) et une bulle explicative. L'utilisateur
 * peut passer à tout moment (bouton, croix, Échap).
 */


type Props = {
  steps: TourStep[]
  onNavigate: (section: string) => void
  onFinish: (completed: boolean) => void
}

type Rect = { top: number; left: number; width: number; height: number }

const PADDING = 8

const measure = (target: string | null): Rect | null => {
  if (!target) return null
  const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
  if (!element) return null
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  return {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  }
}

export function FeatureTour({ steps, onNavigate, onFinish }: Props) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const step = steps[index]
  const last = index === steps.length - 1

  // Affiche la section voulue, fait défiler jusqu'à la cible puis la mesure.
  useLayoutEffect(() => {
    if (step.section) onNavigate(step.section)
    let frame = 0
    let attempts = 0
    // Pas de projecteur périmé : on repart du voile tant que la cible n'est pas mesurée.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRect(null)
    const locate = () => {
      const element = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
      if (element) {
        element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' as ScrollBehavior })
        setRect(measure(step.target))
        return
      }
      if (!step.target) {
        setRect(null)
        return
      }
      // La cible peut apparaître au rendu suivant (changement de section).
      if (attempts++ < 20) {
        frame = window.requestAnimationFrame(locate)
        return
      }
      // Cible absente (ex. assistant non configuré) : on saute l'étape.
      if (index < steps.length - 1) setIndex(index + 1)
      else onFinish(true)
    }
    frame = window.requestAnimationFrame(locate)
    return () => window.cancelAnimationFrame(frame)
    // onNavigate est stable (setState) ; on ne veut relancer qu'au changement d'étape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // Suit la cible si la fenêtre bouge.
  useEffect(() => {
    const update = () => setRect(measure(step.target))
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step.target])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFinish(false)
      if (event.key === 'ArrowRight' || event.key === 'Enter') setIndex((i) => Math.min(steps.length - 1, i + 1))
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onFinish, steps.length])

  // Position de la bulle : sous la cible si la place le permet, sinon au-dessus ; centrée sans cible.
  const viewportH = (typeof window !== 'undefined' && (window.innerHeight || document.documentElement.clientHeight)) || 800
  const viewportW = (typeof window !== 'undefined' && (window.innerWidth || document.documentElement.clientWidth)) || 1200
  const bubbleStyle: React.CSSProperties = {}
  let placement: 'below' | 'above' | 'center' = 'center'
  if (rect) {
    const spaceBelow = viewportH - (rect.top + rect.height)
    placement = spaceBelow > 220 || rect.top < 220 ? 'below' : 'above'
    const left = Math.min(Math.max(12, rect.left), Math.max(12, viewportW - 12 - 360))
    bubbleStyle.left = left
    if (placement === 'below') bubbleStyle.top = rect.top + rect.height + 12
    else bubbleStyle.bottom = viewportH - rect.top + 12
  }

  // Portail vers <body> : un ancêtre avec backdrop-filter/transform ferait
  // de lui le référent du position:fixed (projecteur décalé).
  return createPortal(
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="Tour guidé">
      {rect ? (
        <div
          className="tour-spotlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          aria-hidden="true"
        />
      ) : (
        <div className="tour-veil" aria-hidden="true" />
      )}

      <div className={placement === 'center' ? 'tour-center' : undefined}>
      <div className={`tour-bubble tour-bubble--${placement}`} style={bubbleStyle}>
        <button type="button" className="tour-close" onClick={() => onFinish(false)} aria-label="Passer le tour">
          <X size={16} />
        </button>
        <span className="tour-progress">
          {index + 1} / {steps.length}
        </span>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={() => onFinish(false)}>
            Passer le tour
          </button>
          <span className="tour-actions__spacer" />
          {index > 0 ? (
            <button type="button" className="ghost-button" onClick={() => setIndex((i) => i - 1)}>
              Précédent
            </button>
          ) : null}
          <button
            type="button"
            className="hero-cta-button"
            onClick={() => (last ? onFinish(true) : setIndex((i) => i + 1))}
            autoFocus
          >
            {last ? "C'est parti !" : 'Suivant'}
          </button>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  )
}
