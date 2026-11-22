import * as THREE from 'three'
import gsap from 'gsap'
import { useStore } from '../store'

/**
 * Door intro: the visit starts in the corridor in front of the door.
 * Click the door -> three knocks -> the door swings open -> the camera walks
 * through the doorway to the hero pose -> stage becomes 'room'.
 */

export const introCtx: {
  camera: THREE.PerspectiveCamera | null
  pivot: THREE.Object3D | null
  door: THREE.Object3D | null
  tl: gsap.core.Timeline | null
} = { camera: null, pivot: null, door: null, tl: null }

export function isDoor(o: THREE.Object3D | null | undefined): boolean {
  let cur = o
  while (cur) {
    if (cur === introCtx.door || cur === introCtx.pivot || cur.userData?.door_hinge) return true
    cur = cur.parent
  }
  return false
}

/** when each knock lands in /audio/door-knock.mp3 (seconds from the start of the file) */
const KNOCKS = [0.05, 0.3, 0.52, 0.75]
const knockSound = typeof Audio !== 'undefined' ? new Audio('/audio/door-knock.mp3') : null
if (knockSound) knockSound.preload = 'auto'

/** Four knocks on the door, from the recorded sound. Returns how long they take. */
function playKnocks(): number {
  try {
    if (knockSound) {
      knockSound.currentTime = 0
      knockSound.volume = 0.9
      knockSound.play().catch(() => {})
    }
  } catch {
    /* audio is a nice-to-have */
  }
  return KNOCKS[KNOCKS.length - 1] + 0.35
}

/** Small shake of the door in sync with each knock. */
function knockShake(pivot: THREE.Object3D, base: number) {
  const tl = gsap.timeline()
  for (const dt of KNOCKS) {
    tl.to(pivot.rotation, { y: base + 0.006, duration: 0.04, ease: 'power2.out' }, dt)
    tl.to(pivot.rotation, { y: base, duration: 0.12, ease: 'power2.in' }, dt + 0.04)
  }
  return tl
}

export function onDoorClick() {
  const st = useStore.getState()
  const cam = introCtx.camera
  const pivot = introCtx.pivot
  if (st.stage !== 'door' || !cam) return
  st.set({ stage: 'entering' })
  document.body.dataset.introPlayed = '1'
  document.body.classList.remove('hover-cursor')

  const fast = st.reducedMotion
  const knockLen = playKnocks()
  const openDeg = (pivot?.userData.open_angle_deg as number) ?? 96
  const baseRot = pivot ? pivot.rotation.y : 0
  if (pivot) pivot.userData.closedY = baseRot
  const tl = gsap.timeline({
    onComplete: () => {
      useStore.getState().set({ stage: 'room' })
    },
  })
  introCtx.tl = tl
  if (pivot) tl.add(knockShake(pivot, baseRot), 0)

  const openAt = knockLen + 0.25
  if (pivot) {
    tl.to(pivot.rotation, { y: baseRot + THREE.MathUtils.degToRad(openDeg), duration: fast ? 0.6 : 1.6, ease: 'power2.inOut' }, openAt)
  }

  // walk in: from the current (cursor-tilted) door pose, through the doorway, to the hero pose
  const fromPos = cam.position.clone()
  const fromQuat = cam.quaternion.clone()
  const toPos = (cam.userData.basePos as THREE.Vector3).clone()
  const toQuat = (cam.userData.baseQuat as THREE.Quaternion).clone()
  const doorPos = cam.userData.doorPos as THREE.Vector3
  // a point just inside the doorway at eye height, then ease up to the hero pose
  const threshold = new THREE.Vector3(doorPos.x, doorPos.y, doorPos.z - 1.9)
  const inside = new THREE.Vector3((threshold.x + toPos.x) / 2, (doorPos.y + toPos.y) / 2, threshold.z - 0.9)
  const curve = new THREE.CatmullRomCurve3([fromPos, threshold, inside, toPos], false, 'centripetal')
  const p = { t: 0 }
  const fovFrom = cam.fov
  const fovTo = cam.userData.baseFov as number
  tl.to(
    p,
    {
      t: 1,
      duration: fast ? 1.2 : 3.4,
      ease: 'power2.inOut',
      onUpdate: () => {
        curve.getPoint(p.t, cam.position)
        // look ahead along the path early on, settle into the hero framing at the end
        const k = THREE.MathUtils.smoothstep(p.t, 0.35, 1)
        cam.quaternion.copy(fromQuat).slerp(toQuat, k)
        cam.fov = THREE.MathUtils.lerp(fovFrom, fovTo, k)
        cam.updateProjectionMatrix()
      },
    },
    openAt + (fast ? 0.2 : 0.65),
  )
}

/** Skip link: jump straight into the room (door open, hero pose), no welcome text. */
export function finishIntro() {
  const st = useStore.getState()
  if (st.stage === 'room') return
  const cam = introCtx.camera
  introCtx.tl?.kill()
  introCtx.tl = null
  if (introCtx.pivot) {
    gsap.killTweensOf(introCtx.pivot.rotation)
    const openDeg = (introCtx.pivot.userData.open_angle_deg as number) ?? 96
    const base = (introCtx.pivot.userData.closedY as number | undefined) ?? introCtx.pivot.rotation.y
    introCtx.pivot.rotation.y = base + THREE.MathUtils.degToRad(openDeg)
  }
  if (cam?.userData.basePos) {
    cam.position.copy(cam.userData.basePos)
    cam.quaternion.copy(cam.userData.baseQuat)
    cam.fov = cam.userData.baseFov
    cam.updateProjectionMatrix()
  }
  document.body.classList.remove('hover-cursor')
  st.set({ stage: 'room' })
}
