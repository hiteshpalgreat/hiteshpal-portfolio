import { useEffect, useMemo, useRef } from 'react'
import { BADGE_TEXT, TESTIMONIALS } from './testimonialsConfig'
import { OTTRLY_PATHS, OTTRLY_VIEWBOX } from '../clients/ottrlyMark'
import './testimonials.css'

/**
 * Client testimonials as a floating collage (after danilodemarco.com's "Other Projects"):
 * a big title stays centred while the cards drift past it at different speeds. Each card also
 * leans with the pointer by its own depth. Cards rest dimmed and come into focus on hover. Clicking
 * the badge spins the Ottrly mark and cycles its colour.
 */
export function TestimonialsSection({ variant = 'dark' }: { variant?: 'dark' | 'light' } = {}) {
  const sfx = variant === 'light' ? '-light' : ''
  const root = useRef<HTMLElement>(null)
  const cards = useRef<(HTMLDivElement | null)[]>([])
  const mark = useRef<SVGSVGElement>(null)
  const turns = useRef(0)
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useEffect(() => {
    if (reduced) return
    let raf = 0
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 }
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = root.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      if (r.bottom < -vh || r.top > vh * 2) return
      // -1 when the section's top meets the screen bottom, 1 when its bottom meets the screen top
      const p = ((vh - r.top) / (r.height + vh)) * 2 - 1
      ptr.x += (ptr.tx - ptr.x) * 0.08
      ptr.y += (ptr.ty - ptr.y) * 0.08
      const narrow = window.innerWidth < 760
      TESTIMONIALS.forEach((t, i) => {
        const c = cards.current[i]
        if (!c) return
        const y = narrow ? -p * t.speed * vh * 0.25 : -p * t.speed * vh
        const mx = ptr.x * 18 * t.depth
        const my = ptr.y * 12 * t.depth
        c.style.transform = `translate3d(${mx.toFixed(1)}px, ${(y + my).toFixed(1)}px, 0)`
      })
    }
    const onPointer = (e: PointerEvent) => {
      ptr.tx = (e.clientX / window.innerWidth) * 2 - 1
      ptr.ty = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    tick()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
    }
  }, [reduced])

  // clicking the badge flings the Ottrly mark round and moves it to the next colour in a loop
  const BADGE_COLORS = ['#1a0a10', '#ffffff', '#8e1538', '#ffd9e3']
  const spin = () => {
    const el = mark.current
    if (!el) return
    turns.current += 1
    const n = turns.current
    el.style.transform = `rotate(${n * 720}deg)`
    el.style.color = BADGE_COLORS[n % BADGE_COLORS.length]
    el.animate(
      [{ scale: 1 }, { scale: 1.35, offset: 0.35 }, { scale: 0.9, offset: 0.75 }, { scale: 1 }],
      { duration: 1100, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
  }

  return (
    <section className={`testimonials ${variant === 'light' ? 'testimonials--light' : ''}`} ref={root} aria-labelledby={`tm-title${sfx}`}>
      <div className="tm-sticky">
        <h2 className="tm-title" id={`tm-title${sfx}`}>
          <span className="tm-eyebrow">( what clients say )</span>
          <span>Client</span>
          <span>Testimonials</span>
        </h2>
      </div>
      <div className="tm-field">
        {TESTIMONIALS.map((t, i) => (
          <div
            key={t.name}
            className="tm-par"
            ref={(el) => (cards.current[i] = el)}
            style={{ left: `${t.x}%`, top: `${t.y}vh`, width: `${t.w}px`, zIndex: t.depth > 1 ? 3 : 1 }}
          >
            <figure className="tm-card">
              <div className="tm-photo">
                <img src={t.photo} alt={t.name} loading="lazy" decoding="async" />
              </div>
              <div className="tm-body">
                <span className="tm-qmark" aria-hidden="true">“</span>
                <blockquote className="tm-quote">{t.quote}</blockquote>
                <figcaption className="tm-foot">
                  <span className="tm-who">
                    <span className="tm-name">{t.name}</span>
                    <span className="tm-role">{t.role}</span>
                  </span>
                  <img className="tm-logo" src={t.logo} alt="" loading="lazy" decoding="async" />
                </figcaption>
              </div>
            </figure>
          </div>
        ))}
        <div className="tm-badge">
          <svg className="tm-ring" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <path id={`tm-ring${sfx}`} d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
            </defs>
            <text>
              <textPath href={`#tm-ring${sfx}`} textLength="462" lengthAdjust="spacing">{BADGE_TEXT}</textPath>
            </text>
          </svg>
          <button className="tm-badge-mark" onClick={spin} aria-label="Spin the Ottrly mark">
            <svg ref={mark} viewBox={OTTRLY_VIEWBOX} aria-hidden="true">
              {OTTRLY_PATHS.map((d) => (
                <path key={d.slice(0, 16)} d={d} fill="currentColor" />
              ))}
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
