import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

/**
 * As the page starts scrolling from the room, the iPad lifts off the desk and floats to the middle of the
 * view, screen facing you. From there the showreel on it grows to fill the whole window (ReelCover in
 * Overlays.tsx), which is the segue into the next section.
 *
 * `ipadFly.p` (0..1) is set from the scroll handler in App.tsx. At 0 the iPad is left alone (hover and
 * click-to-focus work as usual); above 0 this takes over its pose each frame. `ipadFly.rect` is the
 * screen's outline on the page (CSS px), for the full-window reel to grow from.
 */
export const ipadFly = { p: 0, rect: { x: 0, y: 0, w: 0, h: 0, ok: false } }

/** share of the scroll the 3D flight takes; the rest is the reel growing to full window */
export const FLY_SHARE = 0.7

const GROUP = 'HOVER_iPad'
const SCREEN = 'Screen_iPad'

type Rig = {
  group: THREE.Object3D
  screen: THREE.Mesh
  restPos: THREE.Vector3
  restQuat: THREE.Quaternion
  screenInGroup: THREE.Matrix4 // the screen's matrix relative to the group (fixed)
  center: THREE.Vector3 // screen centre, screen-local
  u: THREE.Vector3 // screen-local unit direction of the picture's "right" (texture +u)
  v: THREE.Vector3 // and "up" (texture +v)
  hu: number // half the picture's size along u / v, in screen-local units
  hv: number
  width: number // world size of the picture
  height: number
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** the picture's right/up directions and size, read from the screen's texture mapping
 *  (the screen is tilted inside its own mesh, so its bounding box can't tell us this) */
function measureScreen(screen: THREE.Mesh) {
  const g = screen.geometry
  const pos = g.attributes.position as THREE.BufferAttribute
  const uv = g.attributes.uv as THREE.BufferAttribute
  const idx = g.index
  const at = (k: number) => (idx ? idx.getX(k) : k)
  const p = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, at(k)))
  const t = [0, 1, 2].map((k) => new THREE.Vector2().fromBufferAttribute(uv, at(k)))
  const e1 = p[1].clone().sub(p[0])
  const e2 = p[2].clone().sub(p[0])
  const du1 = t[1].x - t[0].x
  const dv1 = t[1].y - t[0].y
  const du2 = t[2].x - t[0].x
  const dv2 = t[2].y - t[0].y
  const r = 1 / (du1 * dv2 - du2 * dv1 || 1e-6)
  // local length per unit of u and of v
  const T = e1.clone().multiplyScalar(dv2).sub(e2.clone().multiplyScalar(dv1)).multiplyScalar(r)
  const B = e2.clone().multiplyScalar(du1).sub(e1.clone().multiplyScalar(du2)).multiplyScalar(r)
  let umin = Infinity
  let umax = -Infinity
  let vmin = Infinity
  let vmax = -Infinity
  const center = new THREE.Vector3()
  const q = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    umin = Math.min(umin, uv.getX(i))
    umax = Math.max(umax, uv.getX(i))
    vmin = Math.min(vmin, uv.getY(i))
    vmax = Math.max(vmax, uv.getY(i))
    center.add(q.fromBufferAttribute(pos, i))
  }
  center.divideScalar(pos.count)
  const ws = new THREE.Vector3()
  screen.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), ws)
  const hu = (T.length() * (umax - umin)) / 2
  const hv = (B.length() * (vmax - vmin)) / 2
  const width = T.clone().multiply(ws).length() * (umax - umin)
  const height = B.clone().multiply(ws).length() * (vmax - vmin)
  // glTF's texture v runs top-down, so the picture's "up" is along -v: flip it, so the front of the
  // screen is what turns to face the camera, upright
  return { u: T.normalize(), v: B.normalize().negate(), center, hu, hv, width, height }
}

export function IpadFly() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      m2: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      q2: new THREE.Quaternion(),
      v: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      s: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      scl: new THREE.Vector3(),
      camPos: new THREE.Vector3(),
      camQuat: new THREE.Quaternion(),
      corner: new THREE.Vector3(),
    }),
    [],
  )
  const rig = useMemo<{ r: Rig | null; fitted: boolean }>(() => ({ r: null, fitted: false }), [])

  const setup = (): Rig | null => {
    const group = scene.getObjectByName(GROUP)
    const screen = scene.getObjectByName(SCREEN) as THREE.Mesh | undefined
    if (!group || !screen?.isMesh || !screen.geometry.attributes.uv) return null
    scene.updateMatrixWorld(true)
    const rest = (group.userData.restPos as THREE.Vector3 | undefined) ?? group.position
    const screenInGroup = new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(screen.matrixWorld)
    return { group, screen, restPos: rest.clone(), restQuat: group.quaternion.clone(), screenInGroup, ...measureScreen(screen) }
  }

  /** crop the reel to the screen's shape (like object-fit: cover) so it isn't squashed */
  const fitTexture = (r: Rig) => {
    const map = (r.screen.material as THREE.MeshBasicMaterial)?.map as THREE.Texture | null | undefined
    const video = map?.image as HTMLVideoElement | undefined
    if (!map || !video?.videoWidth) return false
    const va = video.videoWidth / video.videoHeight
    const sa = r.width / r.height
    map.repeat.set(1, 1)
    if (sa < va) map.repeat.x = sa / va
    else map.repeat.y = va / sa
    map.offset.set((1 - map.repeat.x) / 2, (1 - map.repeat.y) / 2)
    return true
  }

  /** the screen's outline on the page, in CSS px */
  const measureRect = (r: Rig) => {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const c = tmp.corner.copy(r.center).addScaledVector(r.u, a * r.hu).addScaledVector(r.v, b * r.hv)
      c.applyMatrix4(r.screen.matrixWorld).project(camera)
      const sx = (c.x * 0.5 + 0.5) * size.width
      const sy = (1 - (c.y * 0.5 + 0.5)) * size.height
      x0 = Math.min(x0, sx)
      x1 = Math.max(x1, sx)
      y0 = Math.min(y0, sy)
      y1 = Math.max(y1, sy)
    }
    Object.assign(ipadFly.rect, { x: x0, y: y0, w: x1 - x0, h: y1 - y0, ok: true })
  }

  useFrame(() => {
    if (!rig.r) {
      rig.r = setup()
      if (!rig.r) return
      if (typeof location !== 'undefined' && location.search.includes('test')) (window as any).__ipadRig = { rig: rig.r, camera }
    }
    const r = rig.r
    if (!rig.fitted) rig.fitted = fitTexture(r)
    const p = ipadFly.p
    const mat = r.screen.material as THREE.MeshBasicMaterial
    if (p <= 0) {
      if (r.group.userData.flying) {
        r.group.position.copy(r.restPos)
        r.group.quaternion.copy(r.restQuat)
        r.group.userData.flying = false
        if (mat?.color) mat.color.setScalar(0.85)
      }
      // where the iPad sits on screen (the compact reel controls sit under it), or wherever it floats when hovered
      r.screen.updateWorldMatrix(true, false)
      measureRect(r)
      return
    }
    r.group.userData.flying = true
    const t = ease(Math.min(1, p / FLY_SHARE))

    // --- where the screen goes: centred in front of the camera, filling most of the view
    camera.updateMatrixWorld()
    camera.getWorldPosition(tmp.camPos)
    camera.getWorldQuaternion(tmp.camQuat)
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const fill = 0.8 // share of the view the screen takes; the DOM reel then grows it to the full window
    const d = Math.max(r.height / (2 * tan * fill), r.width / (2 * tan * camera.aspect * fill), camera.near * 3)
    // orientation: picture right -> camera right, picture up -> camera up, facing the camera
    const n = tmp.v.copy(r.u).cross(r.v)
    tmp.m.makeBasis(r.u, r.v, n)
    tmp.q.setFromRotationMatrix(tmp.m)
    const screenQuat = tmp.q2.copy(tmp.camQuat).multiply(tmp.q.invert())
    r.screen.matrixWorld.decompose(tmp.pos, tmp.quat, tmp.scl)
    const target = tmp.v2.set(0, 0, -d).applyQuaternion(tmp.camQuat).add(tmp.camPos)
    const centerOffset = tmp.s.copy(r.center).multiply(tmp.scl).applyQuaternion(screenQuat)
    tmp.m2.compose(target.sub(centerOffset), screenQuat, tmp.scl) // target screen world matrix
    tmp.m.copy(r.screenInGroup).invert()
    tmp.m2.multiply(tmp.m) // -> group world matrix
    if (r.group.parent) {
      r.group.parent.updateMatrixWorld()
      tmp.m.copy(r.group.parent.matrixWorld).invert()
      tmp.m2.premultiply(tmp.m)
    }
    tmp.m2.decompose(tmp.pos, tmp.quat, tmp.scl)

    // --- blend from the desk to the camera
    // it turns to face you in the first part of the flight, while still small, then comes forward
    const turn = ease(Math.min(1, p / (FLY_SHARE * 0.55)))
    r.group.position.lerpVectors(r.restPos, tmp.pos, t)
    r.group.quaternion.slerpQuaternions(r.restQuat, tmp.quat, turn)
    r.group.updateMatrixWorld(true)
    if (mat?.color) mat.color.setScalar(0.85 + 0.15 * t)

    // --- the screen's outline on the page, for the full-window reel to grow from
    measureRect(r)
  })

  return null
}
