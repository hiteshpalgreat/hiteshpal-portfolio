import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { useStore } from '../store'

const MAX_YAW = THREE.MathUtils.degToRad(4)
const MAX_PITCH = THREE.MathUtils.degToRad(0.6)
// in front of the door the view follows the cursor across the whole screen
const DOOR_YAW = THREE.MathUtils.degToRad(10)
const DOOR_PITCH = THREE.MathUtils.degToRad(4)
const UP = new THREE.Vector3(0, 1, 0)
const RIGHT = new THREE.Vector3(1, 0, 0)

const smooth = (e0: number, e1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Section 2b: the only camera movement. Small yaw near the screen edges. */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const yaw = useRef(0)
  const pitch = useRef(0)
  const qYaw = useMemo(() => new THREE.Quaternion(), [])
  const qPitch = useMemo(() => new THREE.Quaternion(), [])

  useFrame((_, dt) => {
    const base = camera.userData.baseQuat as THREE.Quaternion | undefined
    if (!base) return
    const { pointer, focus, reducedMotion, view, stage } = useStore.getState()
    if (stage === 'door') {
      const dq = camera.userData.doorQuat as THREE.Quaternion | undefined
      if (!dq) return
      let yT = 0
      let pT = 0
      if (pointer.inside && !reducedMotion) {
        yT = (0.5 - pointer.x) * 2 * DOOR_YAW
        pT = (0.5 - pointer.y) * 2 * DOOR_PITCH
      }
      const kd = 1 - Math.pow(1 - 0.05, Math.min(dt, 0.1) * 60)
      yaw.current += (yT - yaw.current) * kd
      pitch.current += (pT - pitch.current) * kd
      qYaw.setFromAxisAngle(UP, yaw.current)
      qPitch.setFromAxisAngle(RIGHT, pitch.current)
      camera.quaternion.copy(qYaw).multiply(dq).multiply(qPitch)
      camera.userData.yaw = 0
      return
    }
    if (view || stage === 'entering') {
      // the travel animation owns the camera; start from a neutral pan when we come back
      yaw.current = 0
      pitch.current = 0
      camera.userData.yaw = 0
      return
    }
    let yawT = 0
    let pitchT = 0
    if (pointer.inside && !focus && !reducedMotion) {
      const x = pointer.x
      if (x < 0.2) yawT = MAX_YAW * smooth(0.2, 0, x)
      else if (x > 0.8) yawT = -MAX_YAW * smooth(0.8, 1, x)
      pitchT = (0.5 - pointer.y) * 2 * MAX_PITCH
    }
    const k = 1 - Math.pow(1 - 0.06, Math.min(dt, 0.1) * 60)
    yaw.current += (yawT - yaw.current) * k
    pitch.current += (pitchT - pitch.current) * k
    qYaw.setFromAxisAngle(UP, yaw.current)
    qPitch.setFromAxisAngle(RIGHT, pitch.current)
    camera.quaternion.copy(qYaw).multiply(base).multiply(qPitch)
    camera.userData.yaw = yaw.current
  })
  return null
}

/** Haze and light-glow layer from the Blender render, locked to the camera. */
export function HazeOverlay() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const tex = useTexture('/textures/haze_overlay.webp')
  const mesh = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color: new THREE.Color(1.35, 1.35, 1.35),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
    m.renderOrder = 1000
    m.frustumCulled = false
    m.name = 'HazeOverlay'
    m.raycast = () => {}
    return m
  }, [tex])

  useEffect(() => {
    camera.add(mesh)
    return () => {
      camera.remove(mesh)
    }
  }, [camera, mesh])

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * (useStore.getState().stage === 'room' ? 5 : 2))
    const dist = 0.2
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const aspect = size.width / size.height
    mesh.position.set(0, 0, -dist)
    mesh.scale.set(h * aspect, h, 1)
    // the overlay was rendered at 16:9; keep its vertical framing and crop/extend sideways
    const rep = aspect / (16 / 9)
    tex.repeat.set(rep, 1)
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * (16 / 9))
    const yaw = (camera.userData.yaw as number) || 0
    tex.offset.set((1 - rep) / 2 - yaw / hfov, 0)
    const { focus, view, stage } = useStore.getState()
    const target = stage !== 'room' || view ? 0 : focus ? 0.3 : 1
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.opacity += (target - mat.opacity) * k
  })
  return null
}

/** Dark veil between the focused item and the room (section 5). */
export function Dimmer() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: '#0b0610', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    )
    m.renderOrder = 10
    m.frustumCulled = false
    m.name = 'Dimmer'
    m.raycast = () => {}
    return m
  }, [])
  useEffect(() => {
    camera.add(mesh)
    return () => {
      camera.remove(mesh)
    }
  }, [camera, mesh])
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 6)
    const { focus } = useStore.getState()
    const mat = mesh.material as THREE.MeshBasicMaterial
    const dist = focus ? focus.distance + focus.radius + 0.05 : 1
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 1.2
    mesh.position.set(0, 0, -dist)
    mesh.scale.set(h * 3, h, 1)
    const target = focus && focus.phase !== 'out' ? 0.38 : 0
    mat.opacity += (target - mat.opacity) * k
    mesh.visible = mat.opacity > 0.002
  })
  return null
}
