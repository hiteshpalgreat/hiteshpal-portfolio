import { useEffect, useState } from 'react'
import gsap from 'gsap'
import { useStore } from '../store'
import { roomPan } from '../scene/CameraRig'

/**
 * Phones and other portrait screens only see a slice of the room. Drag sideways on the room
 * (vertical swipes still scroll the page) or tap the side arrows to look left and right.
 */
const STEP = 0.5

function panTo(v: number) {
  gsap.to(roomPan, { v: Math.max(-1, Math.min(1, v)), duration: 0.7, ease: 'power3.out', overwrite: true })
}

export function RoomPan() {
  const stage = useStore((s) => s.stage)
  const focus = useStore((s) => s.focus)
  const view = useStore((s) => s.view)
  const gallery = useStore((s) => s.gallery)
  const [narrow, setNarrow] = useState(false)
  const [top, setTop] = useState(true)
  const [pos, setPos] = useState(0)

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth / window.innerHeight < 1.2)
    const onScroll = () => setTop(window.scrollY < 40)
    onResize()
    onScroll()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    // keep the arrows in step with the view (drags and taps both move roomPan.v)
    const tick = () => setPos((p) => (Math.abs(p - roomPan.v) > 0.02 ? roomPan.v : p))
    gsap.ticker.add(tick)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
      gsap.ticker.remove(tick)
    }
  }, [])

  const active = narrow && stage === 'room' && !focus && !view && !gallery && top

  // sideways drags on the room turn the view
  useEffect(() => {
    if (!active) return
    const hero = document.querySelector('.hero') as HTMLElement | null
    if (!hero) return
    let id = -1
    let lastX = 0
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      id = e.pointerId
      lastX = e.clientX
      gsap.killTweensOf(roomPan)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      // a drag across about two thirds of the screen goes from the middle to one end
      roomPan.v = Math.max(-1, Math.min(1, roomPan.v - dx / (window.innerWidth * 0.66)))
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId === id) id = -1
    }
    hero.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      hero.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [active])

  return (
    <div className={`room-pan ${active ? 'show' : ''}`} aria-hidden={!active}>
      <button
        className="rp-btn left"
        aria-label="Look left"
        tabIndex={active ? 0 : -1}
        disabled={pos <= -0.98}
        onClick={() => panTo(roomPan.v - STEP)}
      >
        <svg viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <button
        className="rp-btn right"
        aria-label="Look right"
        tabIndex={active ? 0 : -1}
        disabled={pos >= 0.98}
        onClick={() => panTo(roomPan.v + STEP)}
      >
        <svg viewBox="0 0 24 24" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  )
}
