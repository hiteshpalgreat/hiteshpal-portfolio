import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useStore } from '../store'

/**
 * Dreamy warm motes in front of the window (same volume as the Blender emitter).
 * Blender (x, y, z) becomes three.js (x, z, -y).
 */
const COUNT = 110
const CENTER = new THREE.Vector3(0.2, 1.35, -0.75)
const SIZE = new THREE.Vector3(3.4, 1.8, 2.3)

const vert = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute vec3 aSeed;
  varying float vTwinkle;
  void main() {
    vec3 p = position;
    float t = uTime;
    // slow brownian-like drift (max ~1 cm/s)
    p.x += sin(t * 0.21 + aSeed.x * 6.28) * 0.06 + sin(t * 0.07 + aSeed.y * 3.1) * 0.05;
    p.y += sin(t * 0.17 + aSeed.y * 6.28) * 0.05 + t * 0.004 * (aSeed.z - 0.4);
    p.z += cos(t * 0.19 + aSeed.z * 6.28) * 0.06;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (2.2 / -mv.z);
    vTwinkle = 0.65 + 0.35 * sin(t * (0.6 + aSeed.x) + aSeed.z * 10.0);
  }
`
const frag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vTwinkle;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(1.0, 0.0, r);
    float a = pow(core, 2.2) * vTwinkle * uOpacity;
    gl_FragColor = vec4(uColor * (0.9 + core * 0.6), a);
  }
`

export function Particles() {
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(COUNT * 3)
    const seed = new Float32Array(COUNT * 3)
    const size = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = CENTER.x + (Math.random() - 0.5) * SIZE.x
      pos[i * 3 + 1] = CENTER.y + (Math.random() - 0.5) * SIZE.y
      pos[i * 3 + 2] = CENTER.z + (Math.random() - 0.5) * SIZE.z
      seed[i * 3] = Math.random()
      seed[i * 3 + 1] = Math.random()
      seed[i * 3 + 2] = Math.random()
      size[i] = 2 + Math.random() * 2.5
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uColor: { value: new THREE.Color('#ff9e4d') },
        uOpacity: { value: 1 },
      },
    })
    return { geometry: g, material: m }
  }, [])

  useFrame(({ clock }, dt) => {
    const { focus, reducedMotion } = useStore.getState()
    material.uniforms.uTime.value = reducedMotion ? 0 : clock.getElapsedTime()
    const target = focus ? 0.35 : 1
    material.uniforms.uOpacity.value += (target - material.uniforms.uOpacity.value) * (1 - Math.exp(-Math.min(dt, 0.1) * 4))
  })

  return <points geometry={geometry} material={material} renderOrder={5} frustumCulled={false} />
}
