import { create } from 'zustand'
import type { Object3D } from 'three'

export type FocusState = {
  items: Object3D[]
  key: string // item_id, or "boarding_passes"
  distance: number
  radius: number
  phase: 'in' | 'open' | 'out'
}

export type ViewState = { kind: 'arcade' | 'screens'; phase: 'in' | 'open' | 'out' }

/** door: standing in front of the door; entering: knock, door opens, walk in; room: the normal experience */
export type Stage = 'door' | 'entering' | 'room'

type State = {
  ready: boolean
  stage: Stage
  /** camera travel modes (arcade / the three screens); null = hero view */
  view: ViewState | null
  items: Object3D[]
  hovered: Object3D | null
  dwell: boolean
  focus: FocusState | null
  pointer: { x: number; y: number; inside: boolean; px: number; py: number }
  reducedMotion: boolean
  /** eye toggle: glow every interactive object */
  highlightAll: boolean
  /** up close on the screens: the screen under the cursor that leads somewhere (glows, no float) */
  viewHover: Object3D | null
  /** the photo frame's stack of photos is open */
  gallery: boolean
  /** the next section fully covers the room after the iPad fly-in: 3D rendering is paused */
  dispersing: boolean
  set: (p: Partial<State>) => void
}

export const useStore = create<State>((set) => ({
  ready: false,
  stage: 'door',
  view: null,
  items: [],
  hovered: null,
  dwell: false,
  focus: null,
  pointer: { x: 0.5, y: 0.5, inside: false, px: 0, py: 0 },
  reducedMotion:
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  highlightAll: false,
  dispersing: false,
  viewHover: null,
  gallery: false,
  set: (p) => set(p),
}))

/** Walk up from a hit object to the interactive item node, if any. */
export function findItem(o: Object3D | null | undefined): Object3D | null {
  let cur: Object3D | null | undefined = o
  while (cur) {
    if (cur.userData?.interactive) return cur
    cur = cur.parent
  }
  return null
}
