import { createContext } from 'react'
import type { ViewId, ViewLayouts } from './viewLayout'

export type ViewLayoutApi = {
  layouts: ViewLayouts
  move: (view: ViewId, id: string, direction: -1 | 1) => void
  hide: (view: ViewId, id: string, hidden: boolean) => void
  reset: (view: ViewId) => void
}

/** Disposition des cartes (ordre / masquage) fournie par App aux ViewCard. */
export const ViewLayoutContext = createContext<ViewLayoutApi>({
  layouts: {},
  move: () => {},
  hide: () => {},
  reset: () => {},
})
