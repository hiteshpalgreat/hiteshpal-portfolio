import gsap from 'gsap'
import * as THREE from 'three'
import { useStore } from '../store'
import { clearHover } from './hover'

/** Filled in by <FocusController/> once the canvas exists. */
export const ctx: { camera: THREE.PerspectiveCamera | null; root: THREE.Object3D | null; aspect: number } = {
  camera: null,
  root: null,
  aspect: 16 / 9,
}

type Saved = {
  parent: THREE.Object3D
  pos: THREE.Vector3
  quat: THREE.Quaternion
  scale: THREE.Vector3
  worldPos: THREE.Vector3
  worldQuat: THREE.Quaternion
}

type Flight = { item: THREE.Object3D; targetPos: THREE.Vector3; targetQuat: THREE.Quaternion; phase: number }
export const flights: Flight[] = []

const tmpBox = new THREE.Box3()
const tmpV = new THREE.Vector3()

function camBasis(cam: THREE.PerspectiveCamera) {
  cam.updateMatrixWorld()
  const pos = cam.getWorldPosition(new THREE.Vector3())
  const q = cam.getWorldQuaternion(new THREE.Quaternion())
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q)
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
  return { pos, fwd, right, up }
}

/**
 * Make a floating duplicate of an item. The original (and its baked shadow) stays where it is,
 * only the copy flies to the camera and is removed again when it returns.
 */
function save(item: THREE.Object3D): THREE.Object3D {
  gsap.killTweensOf(item.scale)
  item.scale.copy(item.userData.baseScale as THREE.Vector3)
  if (item.userData.restPos) item.position.copy(item.userData.restPos as THREE.Vector3)
  item.userData.floatAmt = 0
  item.updateMatrixWorld(true)
  // clone without the hover-glow shells and heavy userData
  const ud = item.userData
  item.userData = {}
  const copy = item.clone(true)
  item.userData = ud
  copy.userData = { item_id: ud.item_id, content_id: ud.content_id, label: ud.label, kind: ud.kind, group: ud.group, isCopy: true }
  const shells: THREE.Object3D[] = []
  copy.traverse((o) => {
    if (o.userData?.isHull) shells.push(o)
    o.raycast = () => {}
  })
  shells.forEach((h) => h.removeFromParent())
  item.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale)
  const s: Saved = {
    parent: ctx.root!,
    pos: copy.position.clone(),
    quat: copy.quaternion.clone(),
    scale: copy.scale.clone(),
    worldPos: copy.position.clone(),
    worldQuat: copy.quaternion.clone(),
  }
  copy.userData.saved = s
  ctx.root!.add(copy)
  return copy
}

/** World-space size of an item at its resting scale. */
function measure(item: THREE.Object3D) {
  tmpBox.setFromObject(item, true)
  const size = tmpBox.getSize(new THREE.Vector3())
  const radius = tmpBox.getBoundingSphere(new THREE.Sphere()).radius
  return { size, radius }
}

/**
 * The main flat face of an item and its "up" direction, so a hung-askew poster or a tilted pass
 * comes out perfectly straight: the largest group of same-facing triangles gives the face normal,
 * and the spread of those triangles (PCA) gives the edge directions.
 */
export function faceFrame(item: THREE.Object3D, towards: THREE.Vector3) {
  const buckets = new Map<string, { area: number; n: THREE.Vector3; pts: THREE.Vector3[] }>()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3(), mid = new THREE.Vector3()
  item.updateMatrixWorld(true)
  item.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.visible || m.userData.isHull) return
    const pos = m.geometry.attributes.position
    const idx = m.geometry.index
    const tris = idx ? idx.count / 3 : pos.count / 3
    const step = Math.max(1, Math.floor(tris / 4000))
    for (let t = 0; t < tris; t += step) {
      const i0 = idx ? idx.getX(t * 3) : t * 3
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
      a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld)
      b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld)
      c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld)
      n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a))
      const area = n.length() / 2
      if (area < 1e-9) continue
      n.normalize()
      mid.copy(a).add(b).add(c).divideScalar(3)
      if (n.dot(towards.clone().sub(mid)) <= 0) continue
      const key = `${Math.round(n.x * 8)},${Math.round(n.y * 8)},${Math.round(n.z * 8)}`
      let bk = buckets.get(key)
      if (!bk) buckets.set(key, (bk = { area: 0, n: new THREE.Vector3(), pts: [] }))
      bk.area += area
      bk.n.addScaledVector(n, area)
      bk.pts.push(a.clone(), b.clone(), c.clone())
    }
  })
  let best: { area: number; n: THREE.Vector3; pts: THREE.Vector3[] } | null = null
  buckets.forEach((v) => {
    if (!best || v.area > best.area) best = v
  })
  if (!best) return null
  const bb = best as { area: number; n: THREE.Vector3; pts: THREE.Vector3[] }
  const normal = bb.n.clone().normalize()
  // in-plane axes
  const ref = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const e1 = ref.clone().sub(normal.clone().multiplyScalar(ref.dot(normal))).normalize()
  const e2 = new THREE.Vector3().crossVectors(normal, e1)
  const cen = bb.pts.reduce((acc, v) => acc.add(v), new THREE.Vector3()).divideScalar(bb.pts.length)
  let sxx = 0, sxy = 0, syy = 0
  bb.pts.forEach((v) => {
    const d = v.clone().sub(cen)
    const x = d.dot(e1), y = d.dot(e2)
    sxx += x * x; sxy += x * y; syy += y * y
  })
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const axis = e1.clone().multiplyScalar(Math.cos(th)).add(e2.clone().multiplyScalar(Math.sin(th))).normalize()
  const other = new THREE.Vector3().crossVectors(normal, axis).normalize()
  return { n: normal, axes: [axis, other, axis.clone().negate(), other.clone().negate()] }
}

/**
 * Orientation that turns a flat item's face towards the camera and keeps it upright.
 * Non-flat items keep their pose (they already face the room camera).
 */
/** Area-weighted normal of the faces that look towards a point (the item's visible face). */
export function faceNormal(item: THREE.Object3D, towards: THREE.Vector3) {
  const sum = new THREE.Vector3()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3(), mid = new THREE.Vector3()
  item.updateMatrixWorld(true)
  item.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.visible || m.userData.isHull) return
    const pos = m.geometry.attributes.position
    const idx = m.geometry.index
    const tris = idx ? idx.count / 3 : pos.count / 3
    const step = Math.max(1, Math.floor(tris / 4000))
    for (let t = 0; t < tris; t += step) {
      const i0 = idx ? idx.getX(t * 3) : t * 3
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
      a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld)
      b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld)
      c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld)
      n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)) // length = 2 * area
      mid.copy(a).add(b).add(c).divideScalar(3)
      if (n.dot(towards.clone().sub(mid)) > 0) sum.add(n)
    }
  })
  return sum.lengthSq() > 0 ? sum.normalize() : null
}

/**
 * Orientation that turns a flat item's face towards the camera and keeps it upright.
 * Non-flat items keep their pose (they already face the room camera).
 */
function faceCamera(item: THREE.Object3D, size: THREE.Vector3, target: THREE.Vector3, cam: ReturnType<typeof camBasis>) {
  const dims = [size.x, size.y, size.z]
  const max = Math.max(...dims)
  const min = Math.min(...dims)
  if (item.userData.item_id === 'mclaren_f1') {
    // the car: turn it side-on to the viewer and tip it slightly so the livery reads
    const long = new THREE.Vector3(1, 0, 0)
    const rightH = cam.right.clone().setY(0).normalize()
    // true long axis of the car from its geometry, flattened to the floor plane
    const pts: THREE.Vector3[] = []
    item.updateMatrixWorld(true)
    item.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || m.userData.isHull) return
      const p = m.geometry.attributes.position
      for (let i = 0; i < p.count; i += 23) pts.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld))
    })
    const c = pts.reduce((acc, v) => acc.add(v), new THREE.Vector3()).divideScalar(pts.length)
    let xx = 0, xz = 0, zz = 0
    pts.forEach((v) => {
      const dx = v.x - c.x, dz = v.z - c.z
      xx += dx * dx; xz += dx * dz; zz += dz * dz
    })
    const theta = 0.5 * Math.atan2(2 * xz, xx - zz)
    long.set(Math.cos(theta), 0, Math.sin(theta))
    let ang = Math.atan2(long.clone().cross(rightH).y, long.dot(rightH))
    if (Math.abs(ang) > Math.PI / 2) ang -= Math.sign(ang) * Math.PI
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang)
    return yawQ.multiply(item.quaternion.clone())
  }
  if (min > max * 0.3) {
    // solid objects (figurine, cape, cube, piano...): keep showing the side the visitor was looking at.
    // Turn around the vertical by the change in viewing angle between the shelf spot and the float spot.
    const from = cam.pos.clone().sub(item.getWorldPosition(new THREE.Vector3())).setY(0).normalize()
    const to = cam.pos.clone().sub(target).setY(0).normalize()
    const ang = Math.atan2(from.clone().cross(to).y, from.dot(to))
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang).multiply(item.quaternion.clone())
  }
  const frame = faceFrame(item, cam.pos)
  if (!frame) return item.quaternion.clone()
  const n = frame.n
  // which edge direction should become "up": the one closest to the world up (or, for things lying flat,
  // the one pointing away from the viewer), so the item comes out straight with no tilt
  const want = Math.abs(n.y) > 0.7 ? cam.fwd.clone().setY(0).normalize() : new THREE.Vector3(0, 1, 0)
  const u = frame.axes.reduce((bestAx, ax) => (ax.dot(want) > bestAx.dot(want) ? ax : bestAx)).clone()
  const r = new THREE.Vector3().crossVectors(u, n)
  const from = new THREE.Matrix4().makeBasis(r, u, n)
  // where it should end up: square to the screen and upright, no tilt
  const n2 = cam.fwd.clone().negate()
  const u2 = cam.up.clone().sub(n2.clone().multiplyScalar(cam.up.dot(n2))).normalize()
  const r2 = new THREE.Vector3().crossVectors(u2, n2)
  const to = new THREE.Matrix4().makeBasis(r2, u2, n2)
  const delta = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.invert()))
  return delta.multiply(item.quaternion.clone())
}

function fly(item: THREE.Object3D, targetPos: THREE.Vector3, targetQuat: THREE.Quaternion, lift: number, delay: number, onDone?: () => void, scaleBy = 1) {
  const startPos = item.position.clone()
  const startQuat = item.quaternion.clone()
  const startScale = item.scale.clone()
  const endScale = startScale.clone().multiplyScalar(scaleBy)
  const f: Flight = { item, targetPos, targetQuat, phase: 0 }
  const p = { t: 0 }
  const reduced = useStore.getState().reducedMotion
  gsap.to(p, {
    t: 1,
    duration: reduced ? 0.01 : 0.9,
    delay,
    ease: 'power3.inOut',
    onUpdate: () => {
      item.position.lerpVectors(startPos, targetPos, p.t)
      item.position.y += Math.sin(p.t * Math.PI) * lift
      item.quaternion.slerpQuaternions(startQuat, targetQuat, p.t)
      item.scale.lerpVectors(startScale, endScale, p.t)
    },
    onComplete: () => {
      flights.push(f)
      onDone?.()
    },
  })
}

/** How far in front of the camera floating copies sit: closer than anything in the room. */
const FOCUS_DIST = 0.95

export function focusItem(item: THREE.Object3D) {
  const st = useStore.getState()
  if (st.focus || !ctx.camera || !ctx.root) return
  clearHover()
  item = save(item)
  const cam = camBasis(ctx.camera)
  const { size, radius } = measure(item)
  const vfov = THREE.MathUtils.degToRad(ctx.camera.fov)
  const d = FOCUS_DIST
  const viewH = 2 * d * Math.tan(vfov / 2)
  const viewW = viewH * ctx.aspect
  // scale the copy so it fills ~70% of the height (and stays clear of the card on the right)
  const scaleBy = THREE.MathUtils.clamp(Math.min(0.8 * viewH, 0.5 * viewW) / (2 * radius), 0.15, 3)
  const target = cam.pos.clone().add(cam.fwd.clone().multiplyScalar(d)).add(cam.right.clone().multiplyScalar(-0.13 * viewW))
  const quat = faceCamera(item, size, target, cam)
  st.set({ focus: { items: [item], key: item.userData.item_id, distance: d, radius: radius * scaleBy, phase: 'in' } })
  fly(item, target, quat, 0.08, 0, () => {
    const f = useStore.getState().focus
    if (f) useStore.getState().set({ focus: { ...f, phase: 'open' } })
  }, scaleBy)
}

export function focusBoardingPasses(passes: THREE.Object3D[]) {
  const st = useStore.getState()
  if (st.focus || !ctx.camera || !ctx.root || !passes.length) return
  clearHover()
  passes.sort((a, b) => String(a.userData.item_id).localeCompare(String(b.userData.item_id)))
  const cam = camBasis(ctx.camera)
  const vfov = THREE.MathUtils.degToRad(ctx.camera.fov)
  passes = passes.map((p) => save(p))
  const sizes = passes.map((p) => measure(p))
  // each pass's width is its largest dimension
  const widths = sizes.map((s) => Math.max(s.size.x, s.size.y, s.size.z))
  const d = FOCUS_DIST
  const viewH = 2 * d * Math.tan(vfov / 2)
  const viewW = viewH * ctx.aspect
  const gapRaw = 0.012
  const totalRaw = widths.reduce((a, b) => a + b, 0) + gapRaw * (passes.length - 1)
  // the row of passes spans ~50% of the screen width (room for the browse arrows and the card)
  const scaleBy = THREE.MathUtils.clamp((0.5 * viewW) / totalRaw, 0.15, 3)
  const total = totalRaw * scaleBy
  const center = cam.pos.clone().add(cam.fwd.clone().multiplyScalar(d)).add(cam.right.clone().multiplyScalar(-0.12 * viewW))
  let x = -total / 2
  const radius = Math.max(...sizes.map((s) => s.radius)) * scaleBy
  st.set({ focus: { items: passes, key: 'boarding_passes', distance: d, radius, phase: 'in' } })
  passes.forEach((p, i) => {
    const w = widths[i] * scaleBy
    const pos = center.clone().add(cam.right.clone().multiplyScalar(x + w / 2))
    x += w + gapRaw * scaleBy
    const q = faceCamera(p, sizes[i].size, pos, cam)
    fly(p, pos, q, 0.04, i * 0.03, i === passes.length - 1 ? () => {
      const f = useStore.getState().focus
      if (f) useStore.getState().set({ focus: { ...f, phase: 'open' } })
    } : undefined, scaleBy)
  })
}

export function closeFocus(opts?: { fast?: boolean } | unknown) {
  const fast = !!(opts && (opts as { fast?: boolean }).fast)
  const st = useStore.getState()
  const f = st.focus
  if (!f || f.phase === 'out') return
  st.set({ focus: { ...f, phase: 'out' } })
  flights.length = 0
  const reduced = st.reducedMotion
  f.items.forEach((item, i) => {
    gsap.killTweensOf(item.position)
    const s = item.userData.saved as Saved
    const startPos = item.position.clone()
    const startQuat = item.quaternion.clone()
    const startScale = item.scale.clone()
    const p = { t: 0 }
    gsap.to(p, {
      t: 1,
      duration: reduced ? 0.01 : fast ? 0.5 : 0.8,
      delay: fast ? 0 : i * 0.03,
      ease: 'power3.inOut',
      onUpdate: () => {
        item.position.lerpVectors(startPos, s.worldPos, p.t)
        item.position.y += Math.sin(p.t * Math.PI) * 0.03
        item.quaternion.slerpQuaternions(startQuat, s.worldQuat, p.t)
        item.scale.lerpVectors(startScale, s.scale, p.t)
      },
      onComplete: () => {
        item.removeFromParent()
        if (i === f.items.length - 1) useStore.getState().set({ focus: null })
      },
    })
  })
}
