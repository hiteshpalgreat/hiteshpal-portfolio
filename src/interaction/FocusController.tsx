import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '../store'
import { ctx, flights, closeFocus } from './focus'
import { travelBack } from './travel'
import { stepFocus } from './nav'

/** Wires the focus module to the live camera/scene and adds the gentle float. */
export function FocusController({ root }: { root: THREE.Object3D }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const q = useMemo(() => new THREE.Quaternion(), [])
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useEffect(() => {
    ctx.camera = camera
    ctx.root = root
    ctx.aspect = size.width / size.height
    ;(window as any).__ctx = ctx
  }, [camera, root, size])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && useStore.getState().focus) {
        e.preventDefault()
        stepFocus(e.key === 'ArrowRight' ? 1 : -1)
        return
      }
      if (e.key === 'Escape' && !useStore.getState().gallery) {
        closeFocus()
        travelBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // hover float: the hovered item lifts a little and bobs until the cursor leaves
  const up = useMemo(() => new THREE.Vector3(), [])
  const pq = useMemo(() => new THREE.Quaternion(), [])
  const ps = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (const item of useStore.getState().items) {
      const amt = (item.userData.floatAmt as number) || 0
      const rest = item.userData.restPos as THREE.Vector3 | undefined
      if (!rest) continue
      if (amt <= 0.0005) {
        if (item.userData.floating) {
          item.position.copy(rest)
          item.userData.floating = false
        }
        continue
      }
      item.userData.floating = true
      // world "up" expressed in the parent's local space (parents can be rotated or scaled)
      item.parent!.getWorldQuaternion(pq)
      item.parent!.getWorldScale(ps)
      up.set(0, 1, 0).applyQuaternion(pq.invert()).divide(ps)
      const lift = 0.014 * amt + 0.005 * amt * Math.sin(t * 2.4)
      item.position.copy(rest).addScaledVector(up, lift)
    }
  })

  useFrame(({ clock }) => {
    const { focus, reducedMotion } = useStore.getState()
    if (!focus || focus.phase !== 'open' || reducedMotion) return
    const t = clock.getElapsedTime()
    flights.forEach((f, i) => {
      const s = Math.sin((t / 4) * Math.PI * 2 + i * 0.7)
      f.item.position.copy(f.targetPos)
      f.item.position.y += s * 0.01
      f.item.quaternion.copy(f.targetQuat)
    })
  })
  return null
}
