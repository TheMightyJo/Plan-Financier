/**
 * Disposition des cartes par vue : ordre et cartes masquées, choisis par
 * l'utilisateur (flèches ▲▼ et « masquer » sur chaque carte). Stocké dans
 * une clé localStorage suivie par la synchro documents.
 */

export type ViewId = 'overview' | 'operations' | 'budget'
export type ViewLayout = { order: string[]; hidden: string[] }
export type ViewLayouts = Partial<Record<ViewId, ViewLayout>>

export const VIEW_LAYOUT_KEY = 'plan-financier-view-layout-v1'

/** Cartes configurables, dans l'ordre par défaut, avec leur libellé. */
export const VIEW_CARDS: Record<ViewId, Array<{ id: string; title: string }>> = {
  overview: [
    { id: 'starter', title: 'Premiers pas / suggestions' },
    { id: 'kpis', title: 'Indicateurs du mois' },
    { id: 'forecast', title: 'Fin de mois prévue' },
    { id: 'calendar', title: 'Mon calendrier' },
    { id: 'recent', title: 'Dernières opérations' },
    { id: 'summary', title: 'Bilan du mois' },
  ],
  operations: [
    { id: 'transactions', title: 'Opérations du mois' },
    { id: 'categories', title: 'Dépenses par catégorie' },
    { id: 'yoy', title: 'Comparaison avec l’an dernier' },
    { id: 'detailed', title: 'Formulaire détaillé' },
  ],
  budget: [
    { id: 'envelopes', title: 'Mes poches' },
    { id: 'alerts', title: 'Alertes' },
    { id: 'caps', title: 'Budgets par catégorie' },
    { id: 'recurring', title: 'Charges récurrentes' },
    { id: 'savings', title: 'Projets d’épargne' },
    { id: 'accounts', title: 'Comptes' },
    { id: 'coaching', title: 'Coaching financier' },
  ],
}

export const cardTitle = (view: ViewId, id: string): string =>
  VIEW_CARDS[view].find((card) => card.id === id)?.title ?? id

const isViewId = (value: string): value is ViewId => value in VIEW_CARDS

export const loadViewLayouts = (storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null): ViewLayouts => {
  if (!storage) return {}
  try {
    const raw = storage.getItem(VIEW_LAYOUT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (!parsed || typeof parsed !== 'object') return {}
    const result: ViewLayouts = {}
    for (const [view, layout] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isViewId(view) || !layout || typeof layout !== 'object') continue
      const candidate = layout as Partial<ViewLayout>
      result[view] = {
        order: Array.isArray(candidate.order) ? candidate.order.filter((id): id is string => typeof id === 'string') : [],
        hidden: Array.isArray(candidate.hidden) ? candidate.hidden.filter((id): id is string => typeof id === 'string') : [],
      }
    }
    return result
  } catch {
    return {}
  }
}

export const saveViewLayouts = (layouts: ViewLayouts, storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null): void => {
  if (!storage) return
  try {
    storage.setItem(VIEW_LAYOUT_KEY, JSON.stringify(layouts))
  } catch {
    /* stockage indisponible */
  }
}

/** Ordre effectif : cartes de `layout.order` connues d'abord, puis les autres dans l'ordre par défaut. */
export const effectiveOrder = (view: ViewId, layout?: ViewLayout): string[] => {
  const defaults = VIEW_CARDS[view].map((card) => card.id)
  const known = (layout?.order ?? []).filter((id) => defaults.includes(id))
  return [...known, ...defaults.filter((id) => !known.includes(id))]
}

export const isCardHidden = (view: ViewId, id: string, layouts: ViewLayouts): boolean =>
  (layouts[view]?.hidden ?? []).includes(id)

/** Position (index CSS `order`) d'une carte dans l'ordre effectif. */
export const cardPosition = (view: ViewId, id: string, layouts: ViewLayouts): number =>
  effectiveOrder(view, layouts[view]).indexOf(id)

/** Cartes visibles dans l'ordre effectif (pour savoir si ▲ / ▼ ont un sens). */
export const visibleCards = (view: ViewId, layouts: ViewLayouts): string[] =>
  effectiveOrder(view, layouts[view]).filter((id) => !isCardHidden(view, id, layouts))

export const hiddenCards = (view: ViewId, layouts: ViewLayouts): string[] =>
  effectiveOrder(view, layouts[view]).filter((id) => isCardHidden(view, id, layouts))

/** Déplace une carte d'un cran parmi les cartes visibles (les masquées gardent leur place relative). */
export const moveCard = (view: ViewId, id: string, direction: -1 | 1, layouts: ViewLayouts): ViewLayouts => {
  const current = layouts[view] ?? { order: [], hidden: [] }
  const order = effectiveOrder(view, current)
  const visible = order.filter((cardId) => !current.hidden.includes(cardId))
  const index = visible.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= visible.length) return layouts
  const swapWith = visible[target]
  const next = [...order]
  const a = next.indexOf(id)
  const b = next.indexOf(swapWith)
  next[a] = swapWith
  next[b] = id
  return { ...layouts, [view]: { order: next, hidden: current.hidden } }
}

export const setCardHidden = (view: ViewId, id: string, hidden: boolean, layouts: ViewLayouts): ViewLayouts => {
  const current = layouts[view] ?? { order: [], hidden: [] }
  const nextHidden = hidden
    ? current.hidden.includes(id) ? current.hidden : [...current.hidden, id]
    : current.hidden.filter((cardId) => cardId !== id)
  return { ...layouts, [view]: { order: effectiveOrder(view, current), hidden: nextHidden } }
}

export const resetViewLayout = (view: ViewId, layouts: ViewLayouts): ViewLayouts => {
  const next = { ...layouts }
  delete next[view]
  return next
}
