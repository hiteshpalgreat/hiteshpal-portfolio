import gsap from 'gsap'
import * as THREE from 'three'
import { useStore } from '../store'
import { ctx, faceNormal } from './focus'
import { clearHover } from './hover'
import { OtterChomp } from '../arcade/OtterChomp'

/**
 * Camera travel modes:
 *  - "arcade": fly to the front of the arcade screen and start the game
 *  - "screens": fly to a spot where the wide monitor, the vertical monitor and the iPad are all visible
 * Esc, or a click anywhere else, flies back to the hero view.
 */

let game: OtterChomp | null = null
let gameTex: THREE.CanvasTexture | null = null

function findMesh(name: string): THREE.Mesh | null {
  let found: THREE.Mesh | null = null
  ctx.root?.traverse((o) => {
    if (!found && o.name === name) found = o as THREE.Mesh
  })
  return found
}

function worldBox(objs: THREE.Object3D[]) {
  const box = new THREE.Box3()
  objs.forEach((o) => box.expandByObject(o, true))
  return box
}

function lookQuat(eye: THREE.Vector3, target: THREE.Vector3) {
  const m = new THREE.Matrix4().lookAt(eye, target, new THREE.Vector3(0, 1, 0))
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

/** Where the camera should stand for each mode. */
function poseFor(kind: 'arcade' | 'screens', cam: THREE.PerspectiveCamera) {
  const heroPos = cam.userData.basePos as THREE.Vector3
  const vfov = THREE.MathUtils.degToRad(cam.fov)
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect)

  if (kind === 'arcade') {
    const screen = findMesh('Arcade_Screen')!
    const wasVisible = screen.visible
    screen.visible = true
    const box = worldBox([screen])
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const n = faceNormal(screen, heroPos) ?? heroPos.clone().sub(center).setY(0).normalize()
    screen.visible = wasVisible
    const h = size.y
    const w = Math.hypot(size.x, size.z)
    // screen fills ~78% of the frame height (or width on narrow windows)
    const d = Math.max(h / 2 / Math.tan((vfov * 0.78) / 2), w / 2 / Math.tan((hfov * 0.78) / 2))
    const eye = center.clone().add(n.clone().multiplyScalar(d))
    return { eye, target: center }
  }

  const screens = ['Screen_Wide', 'Screen_Vertical', 'Screen_iPad'].map(findMesh).filter(Boolean) as THREE.Mesh[]
  const vis = screens.map((s) => s.visible)
  screens.forEach((s) => (s.visible = true))
  const box = worldBox(screens)
  const n = faceNormal(screens[0], heroPos) ?? new THREE.Vector3(-1, 0, 0)
  screens.forEach((s, i) => (s.visible = vis[i]))
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const nH = n.clone().setY(0).normalize()
  const side = new THREE.Vector3(-nH.z, 0, nH.x) // horizontal axis across the screens
  const corners = [
    new THREE.Vector3(box.min.x, 0, box.min.z),
    new THREE.Vector3(box.max.x, 0, box.max.z),
    new THREE.Vector3(box.min.x, 0, box.max.z),
    new THREE.Vector3(box.max.x, 0, box.min.z),
  ].map((c) => c.sub(new THREE.Vector3(center.x, 0, center.z)).dot(side))
  const w = Math.max(...corners) - Math.min(...corners)
  const h = size.y
  const d = Math.max(w / 2 / Math.tan((hfov * 0.82) / 2), h / 2 / Math.tan((vfov * 0.7) / 2))
  const eye = center.clone().add(nH.multiplyScalar(d)).add(new THREE.Vector3(0, 0.08, 0))
  return { eye, target: center.clone().add(new THREE.Vector3(0, -0.02, 0)) }
}

function flyCamera(toPos: THREE.Vector3, toQuat: THREE.Quaternion, duration: number, onDone: () => void) {
  const cam = ctx.camera!
  const fromPos = cam.position.clone()
  const fromQuat = cam.quaternion.clone()
  // a gentle arc so the move feels like walking over, not a straight zoom
  const mid = fromPos.clone().lerp(toPos, 0.5).add(new THREE.Vector3(0, 0.12, 0))
  const curve = new THREE.CatmullRomCurve3([fromPos, mid, toPos])
  const p = { t: 0 }
  const reduced = useStore.getState().reducedMotion
  gsap.killTweensOf(p)
  gsap.to(p, {
    t: 1,
    duration: reduced ? 0.01 : duration,
    ease: 'power2.inOut',
    onUpdate: () => {
      cam.position.copy(curve.getPoint(p.t))
      // look ahead a little faster than we move, so the camera "turns towards" the target first
      const look = Math.min(1, p.t * 1.25)
      cam.quaternion.slerpQuaternions(fromQuat, toQuat, look * look * (3 - 2 * look))
    },
    onComplete: onDone,
  })
}

function setupGame() {
  if (game) return
  const screen = findMesh('Arcade_Screen')
  if (!screen) return
  game = new OtterChomp()
  gameTex = new THREE.CanvasTexture(game.canvas)
  gameTex.colorSpace = THREE.SRGBColorSpace
  gameTex.flipY = false // the screen quad's UVs run top-down
  gameTex.minFilter = THREE.LinearFilter
  gameTex.magFilter = THREE.NearestFilter
  game.onFrame = () => {
    if (gameTex) gameTex.needsUpdate = true
  }
  // the arcade glass is curved, so draw the game on top of it instead of fighting the bulge
  const mat = new THREE.MeshBasicMaterial({ map: gameTex, toneMapped: false, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
  screen.material = mat
  screen.renderOrder = 50
}

function screenOn(on: boolean) {
  const screen = findMesh('Arcade_Screen')
  if (!screen) return
  const mat = screen.material as THREE.MeshBasicMaterial
  gsap.killTweensOf(mat)
  if (on) {
    screen.visible = true
    // CRT-ish switch on: quick flash then settle
    gsap.timeline().set(mat, { opacity: 0 }).to(mat, { opacity: 1, duration: 0.12 }).to(mat, { opacity: 0.4, duration: 0.06 }).to(mat, { opacity: 1, duration: 0.25 })
  } else {
    gsap.to(mat, { opacity: 0, duration: 0.3, onComplete: () => { screen.visible = false } })
  }
}

export function travelTo(kind: 'arcade' | 'screens') {
  const st = useStore.getState()
  if (st.view || st.focus || !ctx.camera || !ctx.root) return
  clearHover()
  const cam = ctx.camera
  const { eye, target } = poseFor(kind, cam)
  st.set({ view: { kind, phase: 'in' } })
  if (kind === 'arcade') setupGame()
  flyCamera(eye, lookQuat(eye, target), 1.7, () => {
    useStore.getState().set({ view: { kind, phase: 'open' } })
    if (kind === 'arcade' && game) {
      screenOn(true)
      game.start()
    }
  })
}

export function travelBack(onDone?: () => void) {
  const st = useStore.getState()
  const v = st.view
  if (!v || v.phase === 'out' || !ctx.camera) return
  st.set({ view: { ...v, phase: 'out' } })
  if (v.kind === 'arcade' && game) {
    game.stop()
    screenOn(false)
  }
  const cam = ctx.camera
  flyCamera((cam.userData.basePos as THREE.Vector3).clone(), (cam.userData.baseQuat as THREE.Quaternion).clone(), 1.5, () => {
    useStore.getState().set({ view: null })
    onDone?.()
  })
}

/** For the arcade: is this object part of the arcade? For screens: one of the three devices? */
export function belongsToView(item: THREE.Object3D | null) {
  const v = useStore.getState().view
  if (!v || !item) return false
  if (v.kind === 'arcade') return item.userData.item_id === 'arcade'
  return item.userData.kind === 'screen'
}
