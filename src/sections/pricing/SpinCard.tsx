import { useEffect, useRef } from 'react'
import { OTTRLY_PATHS, OTTRLY_VIEWBOX } from '../clients/ottrlyMark'

/**
 * The card from the Framer site: it floats and sways on a slow loop, rocking side to side with a little
 * 3D tilt while light slides across the chrome otter. Hold it and it freezes; drag it and it spins with
 * your throw, slows down, settles face on again and goes back to swaying.
 */
const PERIOD = 4.6 // seconds for one full sway
const FRICTION = 2.1 // how quickly a throw dies away

export function SpinCard() {
  const card = useRef<HTMLDivElement>(null)
  const chrome = useRef<SVGLinearGradientElement>(null)
  useEffect(() => {
    const el = card.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let t = 0, extra = 0, vel = 0, dir = 1, held = false, lastX = 0, lastT = 0, raf = 0, prev = performance.now(), visible = true
    const w = (Math.PI * 2) / PERIOD
    const apply = () => {
      const s = reduced ? 0 : 1
      const rz = -2.5 + 5.5 * Math.sin(w * t) * s
      const ry = 11 * Math.sin(w * t + 1.1) * s
      const rx = 6 + 4 * Math.sin(w * t + 2.2) * s
      const y = -6 * Math.sin(w * t * 2) * s
      el.style.transform = `translateY(${y.toFixed(2)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${(ry + extra).toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`
      // the light on the chrome follows the turn
      el.style.setProperty('--sheen', `${(50 + ry * 2.2 + (extra % 360) * 0.15).toFixed(1)}%`)
      chrome.current?.setAttribute('gradientTransform', `rotate(${(ry * 3 + rz * 2).toFixed(1)} 0.5 0.5)`)
    }
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      if (!visible || held) return
      t += dt
      if (Math.abs(vel) > 70) {
        extra += vel * dt
        dir = Math.sign(vel)
        vel *= Math.exp(-dt * FRICTION)
      } else {
        // the throw is spent: carry on the same way round to face front, then just sway
        vel = 0
        const turns = extra / 360
        const home = (Math.abs(turns - Math.round(turns)) < 0.02 ? Math.round(turns) : dir > 0 ? Math.ceil(turns) : Math.floor(turns)) * 360
        extra += (home - extra) * (1 - Math.exp(-dt * 3.5))
        if (Math.abs(home - extra) < 0.05) ((extra = 0), (dir = 1))
      }
      apply()
    }
    raf = requestAnimationFrame(tick)
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(el)

    const down = (e: PointerEvent) => {
      held = true
      vel = 0
      lastX = e.clientX
      lastT = performance.now()
      el.setPointerCapture(e.pointerId)
      el.classList.add('held')
    }
    const move = (e: PointerEvent) => {
      if (!held) return
      const now = performance.now()
      const d = (e.clientX - lastX) * 0.6
      extra += d
      const dt = Math.max(0.008, (now - lastT) / 1000)
      vel = vel * 0.6 + (d / dt) * 0.4
      lastX = e.clientX
      lastT = now
      apply()
    }
    const up = (e: PointerEvent) => {
      if (!held) return
      held = false
      if (performance.now() - lastT > 90) vel = 0
      vel = Math.max(-2400, Math.min(2400, vel))
      el.releasePointerCapture?.(e.pointerId)
      el.classList.remove('held')
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    apply()
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [])

  return (
    <div className="pc-scene">
      <div className="pc-card" ref={card} role="img" aria-label="A floating card: subscription design services for brands who move fast. Drag it to spin.">
        <div className="pc-face pc-front">
          <span className="pc-pill">Pause or cancel anytime</span>
          <svg className="pc-mark" viewBox={OTTRLY_VIEWBOX} aria-hidden="true">
            <defs>
              <linearGradient id="pcChrome" ref={chrome} x1="0" y1="0" x2="0.4" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="0.35" stopColor="#9a9aa3" />
                <stop offset="0.55" stopColor="#f2f2f5" />
                <stop offset="0.8" stopColor="#5d5d66" />
                <stop offset="1" stopColor="#d8d8de" />
              </linearGradient>
            </defs>
            {OTTRLY_PATHS.map((d) => (
              <path key={d.slice(0, 16)} d={d} fill="url(#pcChrome)" />
            ))}
          </svg>
          <p className="pc-line">
            Subscription design services
            <br />
            for brands who move fast.
          </p>
        </div>
        <div className="pc-face pc-back">
          <svg className="pc-mark pc-mark-back" viewBox={OTTRLY_VIEWBOX} aria-hidden="true">
            {OTTRLY_PATHS.map((d) => (
              <path key={d.slice(0, 16)} d={d} fill="currentColor" />
            ))}
          </svg>
          <div className="pc-back-copy">
            <strong>Hitesh Pal</strong>
            <span>Visual Communication Designer</span>
          </div>
        </div>
      </div>
      <span className="pc-hint" aria-hidden="true">
        hold to stop · drag to spin
      </span>
    </div>
  )
}
