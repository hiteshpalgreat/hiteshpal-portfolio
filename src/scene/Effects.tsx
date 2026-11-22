import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, DepthOfField, ChromaticAberration, Bloom } from '@react-three/postprocessing'
import { useStore } from '../store'
import { DesaturateBackgroundEffect } from './DesaturateBackground'

export function Effects() {
  const dofRef = useRef<any>(null)

  const caOffset = useMemo(() => new THREE.Vector2(0.0015, 0.0015), [])
  const dof = useRef({ dist: 2.45, range: 1.8, bokeh: 0.9 })
  const desat = useMemo(() => new DesaturateBackgroundEffect(), [])

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 5)
    ;(window as any).__fx = { dof: dofRef.current }
    const { focus, view, stage } = useStore.getState()
    const focused = !!focus && focus.phase !== 'out'
    const tgt = stage === 'door'
      ? { dist: 1.15, range: 1.4, bokeh: 0.6 }
      : stage === 'entering'
        ? { dist: 2.0, range: 3, bokeh: 0.3 }
        : focused
      ? { dist: focus!.distance, range: Math.max(0.15, focus!.radius * 1.8), bokeh: 9 }
      : view
        ? { dist: 1.0, range: 3, bokeh: 0.0 }
        : { dist: 2.45, range: 1.8, bokeh: 0.9 }
    // background loses 50% of its colour while an item is in focus
    desat.amount += ((focused ? 0.5 : 0) - desat.amount) * k
    if (focus) desat.focusDist = focus.distance + focus.radius
    const s = dof.current
    s.dist += (tgt.dist - s.dist) * k
    s.range += (tgt.range - s.range) * k
    s.bokeh += (tgt.bokeh - s.bokeh) * k
    const d = dofRef.current
    if (d) {
      if (d.cocMaterial) {
        d.cocMaterial.worldFocusDistance = s.dist
        d.cocMaterial.worldFocusRange = s.range
      }
      d.bokehScale = s.bokeh
    }
  })

  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <DepthOfField ref={dofRef} worldFocusDistance={2.45} worldFocusRange={1.8} bokehScale={0.9} />
      <primitive object={desat} />
      <Bloom mipmapBlur intensity={0.22} luminanceThreshold={0.9} luminanceSmoothing={0.2} />
      <ChromaticAberration offset={caOffset} radialModulation modulationOffset={0.35} />
    </EffectComposer>
  )
}
