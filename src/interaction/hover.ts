import gsap from 'gsap'
import * as THREE from 'three'
import { useStore } from '../store'

/** Shared, tweenable values (kept for effects that want to react to hover). */
export const outlineFx = { strength: 0, pulse: 0 }

const ACCENT = new THREE.Color('#f2b36b')

/**
 * Glow outline built from "inverted hull" shells: a slightly inflated copy of each mesh,
 * drawn back-faces-only, so only a warm rim shows around the silhouette.
 * Two shells (tight + wide) give a soft glowing edge. Built lazily on first hover.
 */
function getHull(item: THREE.Object3D) {
  if (item.userData.hull) return item.userData.hull as { group: THREE.Group[]; mats: THREE.MeshBasicMaterial[] }
  const layers = [
    { t: 0.004, op: 1.0, mul: 1.35 },
    { t: 0.011, op: 0.35, mul: 1.0 },
  ]
  const mats = layers.map(
    (l) =>
      new THREE.MeshBasicMaterial({
        color: ACCENT.clone().multiplyScalar(l.mul),
        side: THREE.BackSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
  )
  const groups: THREE.Group[] = []
  const meshes: THREE.Mesh[] = []
  item.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && m.visible && m.name !== 'Arcade_Logo' && !m.userData.isHull) meshes.push(m)
  })
  meshes.forEach((m) => {
    const g = new THREE.Group()
    g.userData.isHull = true
    m.geometry.computeBoundingBox()
    const bb = m.geometry.boundingBox!
    const c = bb.getCenter(new THREE.Vector3())
    const size = bb.getSize(new THREE.Vector3())
    const ws = m.getWorldScale(new THREE.Vector3())
    layers.forEach((l, i) => {
      const h = new THREE.Mesh(m.geometry, mats[i])
      h.userData.isHull = true
      h.raycast = () => {}
      // inflate around the mesh centre by a constant world thickness
      const maxDim = Math.max(size.x * ws.x, size.y * ws.y, size.z * ws.z, 1e-4)
      const sx = 1 + (2 * l.t) / maxDim
      const sy = sx
      const sz = sx
      h.position.copy(c).multiply(new THREE.Vector3(1 - sx, 1 - sy, 1 - sz))
      h.scale.set(sx, sy, sz)
      h.renderOrder = 3
      g.add(h)
    })
    g.visible = false
    m.add(g)
    groups.push(g)
  })
  const hull = { group: groups, mats }
  item.userData.hull = hull
  return hull
}

function setGlow(item: THREE.Object3D, level: number, duration: number) {
  const hull = getHull(item)
  hull.mats.forEach((mat, i) => {
    gsap.killTweensOf(mat)
    const target = level * (i === 0 ? 1 : 0.35)
    if (target > 0) hull.group.forEach((g) => (g.visible = true))
    gsap.to(mat, {
      opacity: target,
      duration,
      ease: 'power2.out',
      onComplete: () => {
        if (level === 0) hull.group.forEach((g) => (g.visible = false))
      },
    })
  })
}

const DWELL_MS = 250
let dwellTimer: number | undefined
let current: THREE.Object3D | null = null

function logoOf(item: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null
  item.traverse((o) => {
    if (o.name === 'Arcade_Logo') found = o as THREE.Mesh
  })
  return found
}

function setLogo(item: THREE.Object3D, on: boolean) {
  const logo = logoOf(item)
  if (!logo) return
  const mat = logo.material as THREE.MeshBasicMaterial
  gsap.killTweensOf(mat)
  if (on) {
    // neon sign flicker on
    gsap
      .timeline()
      .to(mat, { opacity: 1, duration: 0.08 })
      .to(mat, { opacity: 0.3, duration: 0.07 })
      .to(mat, { opacity: 1, duration: 0.1 })
      .to(mat, { opacity: 0.55, duration: 0.05 })
      .to(mat, { opacity: 1, duration: 0.12 })
  } else {
    gsap.to(mat, { opacity: 0, duration: 0.25, ease: 'power2.out' })
  }
}

function scaleTo(item: THREE.Object3D, factor: number, duration: number, ease: string) {
  const base = item.userData.baseScale as THREE.Vector3
  gsap.killTweensOf(item.scale)
  gsap.to(item.scale, { x: base.x * factor, y: base.y * factor, z: base.z * factor, duration, ease })
}

function setFloat(item: THREE.Object3D, on: boolean) {
  gsap.killTweensOf(item.userData, 'floatAmt')
  if (useStore.getState().reducedMotion) return
  gsap.to(item.userData, { floatAmt: on ? 1 : 0, duration: on ? 0.45 : 0.35, ease: on ? 'power2.out' : 'power2.inOut' })
}

/** Glow level every item rests at while the eye toggle is on. */
const ALL_LEVEL = 0.5
let allOn = false
function restLevel() {
  return allOn ? ALL_LEVEL : 0
}

function leave(item: THREE.Object3D) {
  window.clearTimeout(dwellTimer)
  setFloat(item, false)
  setGlow(item, restLevel(), 0.25)
  if (!useStore.getState().reducedMotion) scaleTo(item, 1, 0.25, 'power2.out')
  setLogo(item, false)
}

function enter(item: THREE.Object3D) {
  setGlow(item, 0.55, 0.15)
  gsap.killTweensOf(outlineFx)
  gsap.to(outlineFx, { strength: 0.6, duration: 0.15, ease: 'power2.out' })
  dwellTimer = window.setTimeout(() => {
    const st = useStore.getState()
    if (st.hovered !== item || st.focus) return
    st.set({ dwell: true })
    gsap.to(outlineFx, { strength: 1, duration: 0.3, ease: 'power3.out' })
    setGlow(item, 1, 0.3)
    setFloat(item, true)
    if (!st.reducedMotion) {
      scaleTo(item, 1.06, 0.3, 'power3.out')
      gsap.fromTo(outlineFx, { pulse: 0 }, { pulse: 1, duration: 0.3, ease: 'power2.out' })
    }
    if (item.userData.item_id === 'arcade') setLogo(item, true)
  }, DWELL_MS)
}

/** Eye toggle: every interactive object glows softly (only in the room, not while something is open). */
function syncHighlightAll() {
  const s = useStore.getState()
  const on = s.highlightAll && s.stage === 'room' && !s.focus && !s.view
  if (on === allOn) return
  allOn = on
  for (const item of s.items) {
    if (item === current) continue
    setGlow(item, on ? ALL_LEVEL : 0, on ? 0.5 : 0.3)
  }
}

/** Up close on the screens: whatever leads somewhere glows under the cursor (no lift, no zoom). */
let viewLit: THREE.Object3D | null = null
function syncViewHover(s: ReturnType<typeof useStore.getState>) {
  const want = s.view?.kind === 'screens' && s.view.phase === 'open' && !s.gallery ? s.viewHover : null
  if (!want && s.viewHover) queueMicrotask(() => useStore.getState().set({ viewHover: null }))
  if (want === viewLit) return
  if (viewLit) setGlow(viewLit, 0, 0.25)
  viewLit = want
  // the photo frame is flat and pale: a softer glow, so its photo still shows
  if (viewLit) setGlow(viewLit, viewLit.userData.item_id === 'photo_frame' ? 0.4 : 0.9, 0.2)
  document.body.classList.toggle('hover-cursor', !!viewLit)
}

/** React to hover changes (subscribed once from App). */
export function initHover() {
  return useStore.subscribe((s, prev) => {
    if (s.viewHover !== prev.viewHover || s.view !== prev.view || s.gallery !== prev.gallery) syncViewHover(s)
    if (s.highlightAll !== prev.highlightAll || s.focus !== prev.focus || s.view !== prev.view || s.stage !== prev.stage) syncHighlightAll()
    if (s.hovered === prev.hovered) return
    if (current) leave(current)
    current = s.hovered
    document.body.classList.toggle('hover-cursor', !!current)
    if (current) enter(current)
    else {
      gsap.killTweensOf(outlineFx)
      gsap.to(outlineFx, { strength: 0, pulse: 0, duration: 0.25, ease: 'power2.out' })
    }
  })
}

/** Called when focus starts so hover state is dropped cleanly. */
export function clearHover() {
  const st = useStore.getState()
  if (st.hovered) {
    leave(st.hovered)
    current = null
  }
  document.body.classList.remove('hover-cursor')
  gsap.killTweensOf(outlineFx)
  gsap.to(outlineFx, { strength: 0, pulse: 0, duration: 0.2 })
  st.set({ hovered: null, dwell: false })
}
