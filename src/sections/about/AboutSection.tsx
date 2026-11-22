import { useEffect, useMemo, useRef } from 'react'
import { AboutStage } from './AboutStage'
import { ABOUT, ABOUT_SCROLL } from './aboutConfig'
import './about.css'

/**
 * About section (first after the room), after Noomo Labs' "Design to delight" block:
 * Hitesh's photo in the middle of a pinned, pale blush dotted stage, with the phrases coming in
 * behind him one after another. His name sits above the photo and his title runs over it.
 *
 * After the last phrase (see ABOUT_SCROLL): a few scrolls where nothing moves, then the Clients
 * section's Ottrly mark starts drawing on top of this stage; a few scrolls later the last phrase
 * slides out and a pale veil fades in under the mark.
 */
const { length: LENGTH, veil: VEIL, fade: FADE, tail: TAIL } = ABOUT_SCROLL

export function AboutSection() {
  const section = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const line = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const veil = useRef<HTMLDivElement>(null)
  const stageEl = useRef<HTMLDivElement>(null)
  const hello = useRef<HTMLParagraphElement>(null)
  const title = useRef<HTMLParagraphElement>(null)
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useEffect(() => {
    const el = canvas.current!
    const stage = new AboutStage(el, ABOUT, reduced)
    const fit = () => stage.resize(el.clientWidth, el.clientHeight)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    const io = new IntersectionObserver(([e]) => stage.setRunning(e.isIntersecting), { rootMargin: '100px' })
    io.observe(section.current!)
    const clamp = (x: number) => Math.min(1, Math.max(0, x))
    const onScroll = () => {
      const r = section.current!.getBoundingClientRect()
      const vh = window.innerHeight
      const past = -r.top / vh // screens scrolled since the section reached the top
      // the first phrase rises as the stage pins, so "Design" lands just after the photo has settled
      stage.progress = clamp((past + 0.3) / (LENGTH + 0.3))
      // once the mark is drawing: the last phrase slides out while the pale veil comes over the stage
      const out = clamp((past - LENGTH - VEIL) / FADE)
      stage.exit = out
      if (veil.current) veil.current.style.opacity = (out * out * (3 - 2 * out)).toFixed(3)
      if (line.current) {
        const o = clamp((past + 0.1) / 0.4)
        line.current.style.opacity = o.toFixed(3)
        line.current.style.transform = `translate(-50%, ${((1 - o) * 14).toFixed(1)}px)`
      }
      // the name and the title come up with the card
      const h = clamp((past + 0.2) / 0.45)
      if (hello.current) {
        hello.current.style.opacity = h.toFixed(3)
        hello.current.style.marginTop = `${((1 - h) * 18).toFixed(1)}px`
      }
      // "Visual", "Communication", "Designer" come up one line after another
      if (title.current) {
        title.current.style.opacity = '1'
        title.current.querySelectorAll<HTMLElement>('.ab-row').forEach((row, i) => {
          const k = clamp((past + 0.1 - i * 0.16) / 0.3)
          const e = k * k * (3 - 2 * k)
          row.style.opacity = e.toFixed(3)
          row.style.transform = `translateY(${((1 - e) * 22).toFixed(1)}px)`
        })
      }
    }
    // "Visual Communication Designer": each letter warms from white to pink as the pointer comes near it
    const letters = Array.from(title.current?.querySelectorAll<HTMLElement>('.ch') ?? [])
    const PINK = [0xff, 0x59, 0x8b]
    let pending = false
    const mouse = { x: -1e4, y: -1e4 }
    const paint = () => {
      pending = false
      const reach = Math.max(34, window.innerWidth * 0.026) // only the letters right under the pointer warm up
      for (const ch of letters) {
        const b = ch.getBoundingClientRect()
        const dx = mouse.x - (b.left + b.width / 2)
        const dy = mouse.y - (b.top + b.height / 2)
        const k = Math.exp(-(dx * dx + dy * dy) / (2 * reach * reach))
        const c = PINK.map((v) => Math.round(255 + (v - 255) * k))
        ch.style.color = `rgb(${c[0]}, ${c[1]}, ${c[2]})`
      }
    }
    // parallax for the flat layers: the dots, the glow, the card and the label each drift by a different amount
    const onPointer = (e: PointerEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      if (!pending) {
        pending = true
        requestAnimationFrame(paint)
      }
      if (reduced || !stageEl.current) return
      stageEl.current.style.setProperty('--px', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3))
      stageEl.current.style.setProperty('--py', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3))
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('pointermove', onPointer)
      ro.disconnect()
      io.disconnect()
      stage.dispose()
    }
  }, [reduced])

  // the glass card tips toward the pointer
  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || !card.current) return
    const b = card.current.getBoundingClientRect()
    const x = (e.clientX - b.left) / b.width - 0.5
    const y = (e.clientY - b.top) / b.height - 0.5
    card.current.style.transform = `perspective(700px) rotateX(${(-y * 14).toFixed(2)}deg) rotateY(${(x * 14).toFixed(2)}deg) scale(1.03)`
    card.current.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`)
    card.current.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`)
  }
  const untilt = () => {
    if (card.current) card.current.style.transform = ''
  }

  return (
    <section className="about" id="about" ref={section} aria-labelledby="about-title" style={{ height: `${(LENGTH + TAIL + 1) * 100}vh` }}>
      <div className="ab-stage" ref={stageEl}>
        <div className="ab-dots" aria-hidden="true" />
        <div className="ab-glow" aria-hidden="true" />
        <canvas className="ab-gl" ref={canvas} aria-hidden="true" />
        <h2 className="ab-sr" id="about-title">
          About Hitesh Pal. {ABOUT.phrases.join(' ')}
        </h2>
        <p className="ab-hello" ref={hello} aria-hidden="true">
          {Array.from(ABOUT.hello).map((c, i) => (
            <span key={i} style={{ animationDelay: `${(i * 0.09).toFixed(2)}s` }}>
              {c === ' ' ? '\u00a0' : c}
            </span>
          ))}
        </p>
        <p className="ab-title" ref={title} aria-label={ABOUT.title.join(' ')}>
          {ABOUT.title.map((word, w) => (
            <span key={w} className={`ab-row ab-row-${w}`} aria-hidden="true">
              {Array.from(word).map((c, i) => (
                <span key={i} className={w === ABOUT.title.length - 1 && i === 0 ? 'ch ab-script' : 'ch'}>
                  {c}
                </span>
              ))}
            </span>
          ))}
        </p>
        <div className="ab-line" ref={line}>
          <div className="ab-card" ref={card} onPointerMove={tilt} onPointerLeave={untilt}>
            <p>
              {ABOUT.line.map((l, i) => (
                <span key={i} className={`ab-l ab-l-${i}`}>
                  {l}
                </span>
              ))}
            </p>
          </div>
        </div>
        <p className="ab-note">
          <span>({ABOUT.label.index})</span> {ABOUT.label.text}
        </p>
        <div className="ab-veil" ref={veil} aria-hidden="true" />
        {/* the Clients section draws the Ottrly mark here, so it can invert over the photo */}
        <canvas className="ab-mark" id="ab-mark" aria-hidden="true" />
      </div>
    </section>
  )
}
