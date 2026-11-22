import * as THREE from 'three'
import { useStore } from '../store'
import { ctx, focusItem, focusBoardingPasses, closeFocus } from './focus'

/**
 * Previous / next while an object is in focus.
 * Walks every interactive object except the arcade and the screens (those are only
 * reached by clicking them). The boarding passes count as one stop.
 * Order: left to right as seen from the hero camera, so the arrows feel spatial.
 */
type Entry = { key: string; open: () => void }

let cache: { items: THREE.Object3D[]; entries: Entry[] } | null = null

function entries(): Entry[] {
  const { items } = useStore.getState()
  if (cache && cache.items === items) return cache.entries
  const cam = ctx.camera
  const probe = new THREE.PerspectiveCamera()
  if (cam?.userData.basePos) {
    probe.copy(cam)
    probe.position.copy(cam.userData.basePos)
    probe.quaternion.copy(cam.userData.baseQuat)
    probe.fov = cam.userData.baseFov
    probe.updateProjectionMatrix()
    probe.updateMatrixWorld(true)
  }
  const screenX = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()).project(probe).x

  const list: { key: string; x: number; open: () => void }[] = []
  const passes = items.filter((i) => i.userData.group === 'boarding_passes')
  for (const it of items) {
    const d = it.userData
    if (d.item_id === 'arcade' || d.kind === 'screen' || d.group === 'boarding_passes') continue
    list.push({ key: d.item_id, x: screenX(it), open: () => focusItem(it) })
  }
  if (passes.length) {
    const x = passes.reduce((a, p) => a + screenX(p), 0) / passes.length
    list.push({ key: 'boarding_passes', x, open: () => focusBoardingPasses([...passes]) })
  }
  list.sort((a, b) => a.x - b.x)
  cache = { items, entries: list }
  return list
}

let busy = false

export function stepFocus(dir: 1 | -1) {
  const st = useStore.getState()
  const f = st.focus
  if (busy || !f || f.phase !== 'open') return
  const list = entries()
  if (!list.length) return
  const idx = list.findIndex((e) => e.key === f.key)
  const next = list[(idx + dir + list.length) % list.length]
  busy = true
  closeFocus({ fast: true })
  // open the next one as soon as the current copy is back in its place
  const unsub = useStore.subscribe((s) => {
    if (s.focus) return
    unsub()
    busy = false
    next.open()
  })
}
