import { MusicToggle } from './ui/MusicToggle'
import { RoomPan } from './ui/RoomPan'
import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Bvh } from '@react-three/drei'
import { Room } from './scene/Room'
import { CameraRig, HazeOverlay, Dimmer } from './scene/CameraRig'
import { Particles } from './scene/Particles'
import { Effects } from './scene/Effects'
import { FocusController } from './interaction/FocusController'
import { initHover } from './interaction/hover'
import { travelBack } from './interaction/travel'
import { SectionNav } from './ui/SectionNav'
import { PhotoStack } from './ui/PhotoStack'
import { LabelChip, DescriptionCard, Loader, ViewHint, DoorHint, Welcome, TopBar, FocusNav, ScrollHint, MainContent, ReelControls, ReelCover } from './ui/Overlays'
import { useStore } from './store'
import gsap from 'gsap'
import { IpadFly, ipadFly } from './scene/IpadFly'
import { showreel } from './showreel'
import { initSmoothScroll, setScrollEnabled } from './smoothScroll'

// in automated tests the frame rate is tiny; keep tweens on real time there
if (typeof location !== 'undefined' && location.search.includes('test')) gsap.ticker.lagSmoothing(0)

/**
 * Scroll after entering: the room stays put while the iPad lifts off the desk and floats to the camera
 * until its screen (playing the showreels) fills the view. Then the next section scrolls up over it.
 * Everything is driven by the scroll position, so it holds still when you stop.
 */
// phones have far less memory for a page: render the room a touch below full retina sharpness there
const LOW_MEM =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600)
const NIGHT = new THREE.Color('#120b16')
const PALE = new THREE.Color('#f3e3e7')
const BACK = new THREE.Color()
import { FLY, HOLD } from './scrollPlan'

function useRoomScroll(track: React.RefObject<HTMLDivElement>) {
  useEffect(() => {
    const reel = showreel()
    const onScroll = () => {
      const el = track.current
      if (!el) return
      const vh = window.innerHeight
      const y = Math.max(0, window.scrollY)
      // the room is pinned in place with CSS (position: fixed), so it never lags the scroll; the track only makes room.
      // The iPad flies in over FLY screens, the full-window reel then holds for HOLD screens, and the next
      // section (right after the track) slides up over it
      const end = (FLY + HOLD + 1) * vh
      const st = useStore.getState()
      ipadFly.p = st.reducedMotion ? 0 : THREE.MathUtils.clamp(y / (FLY * vh), 0, 1)
      // once the next section covers the room, stop drawing it and keep the reel silent
      const covered = y >= end - 2
      if (covered !== st.dispersing) st.set({ dispersing: covered })
      reel.setAway(covered)
      reel.setHidden(y > (FLY + HOLD + 0.5) * vh)
      // behind everything: the night of the room turns into the pale blush of the sections below
      const t = THREE.MathUtils.smoothstep(y / vh, FLY + HOLD, FLY + HOLD + 1)
      BACK.copy(NIGHT).lerp(PALE, t)
      document.body.style.backgroundColor = `#${BACK.getHexString()}`
      if (st.hovered && y > 24) st.set({ hovered: null })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [track])
}

function SceneRoot() {
  const ready = useStore((s) => s.ready)
  const scene = useThree((s) => s.scene)
  return (
    <>
      <Bvh firstHitOnly>
        <Room />
      </Bvh>
      {ready && (
        <>
          <CameraRig />
          <HazeOverlay />
          <Dimmer />
          <Particles />
          <FocusController root={scene} />
          <Effects />
          <IpadFly />
        </>
      )}
    </>
  )
}

export default function App() {
  const track = useRef<HTMLDivElement>(null)
  const dispersing = useStore((s) => s.dispersing)
  useRoomScroll(track)
  // pointer tracking for the edge pan and the label chip
  useEffect(() => {
    const st = useStore.getState()
    const onMove = (e: PointerEvent) => {
      st.set({
        pointer: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, inside: true, px: e.clientX, py: e.clientY },
      })
    }
    const onLeave = () => st.set({ pointer: { ...useStore.getState().pointer, inside: false }, hovered: null })
    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)
    const stopSmooth = initSmoothScroll(useStore.getState().reducedMotion)
    const unsub = initHover()
    // the page may scroll (to the content below the room) only once inside, and not while something is open
    const syncScroll = () => {
      const s = useStore.getState()
      const on = s.stage === 'room' && !s.focus && !s.view && !s.gallery
      document.documentElement.classList.toggle('can-scroll', on)
      setScrollEnabled(on)
    }
    syncScroll()
    const unsubScroll = useStore.subscribe(syncScroll)
    // handy for debugging in the browser console
    ;(window as any).__room = useStore
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
      unsub()
      unsubScroll()
      stopSmooth()
    }
  }, [])

  return (
    <>
      <div className="hero-track" ref={track}>
      <div className={`hero ${dispersing ? 'gone' : ''}`}>
      <Canvas
        frameloop={dispersing ? 'never' : 'always'}
        dpr={[1, LOW_MEM ? 1.5 : 2]}
        gl={{ antialias: false, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace, powerPreference: 'high-performance' }}
        flat
        onPointerMissed={() => {
          useStore.getState().set({ hovered: null })
          if (useStore.getState().stage !== 'room') return
          if (useStore.getState().view) travelBack()
        }}
      >
        <color attach="background" args={['#120b16']} />
        <Suspense fallback={null}>
          <SceneRoot />
        </Suspense>
      </Canvas>
      </div>
      </div>
      <ReelCover />
      <MainContent />
      <LabelChip />
      <DescriptionCard />
      <ViewHint />
      <DoorHint />
      <Welcome />
      <FocusNav />
      <ScrollHint />
      <ReelControls />
      <TopBar />
      <SectionNav />
      <PhotoStack />
      <MusicToggle />
      <RoomPan />
      <Loader />
    </>
  )
}
