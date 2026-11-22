import { useEffect, useMemo, useRef, useState } from 'react'
import { APPROACH } from './approachConfig'
import './approach.css'

/**
 * My Approach: a pinned stage with the quote in the middle, set in light grey. Scrolling fills it in ink,
 * letter by letter, while a Threads-style wavy line draws itself around the quote (never across it),
 * carrying a line of words about the work.
 */
/**
 * The ribbons: two dark tapes that come in from opposite sides and frame the quote like a rectangle.
 * One enters from the left along the top, turns down the right edge, crosses under the other and slips
 * off the right. The other is the same route turned half a circle: in from the right along the bottom,
 * up the left edge, under the first and off the left. Both are built in real stage px, held in from the
 * stage's edges so the tape is never cut, and well clear of the quote in the middle.
 */
type Ribbon = { d: string; text: string } // d draws it (in reveal order); text is the same route laid so the words read upright
function ribbons(w: number, h: number, band: number): Ribbon[] {
  const m = Math.max(band * 1.15, w * 0.04) // tape centre to the side edges
  const T = Math.max(band * 2.4, h * 0.13) // top line
  const B = h - T // bottom line
  const E = B + band * 1.55 // where the first tape slips off, under the bottom line
  const r = Math.min(110, w * 0.08, h * 0.12) // the frame's corners
  const r2 = band * 0.75 // the small turn out
  const out = band * 4 // off screen
  // the first tape as points, then rotated 180 degrees for the second
  const A = (f: (x: number, y: number) => string) =>
    `M ${f(-out, T)} L ${f(w - m - r, T)} Q ${f(w - m, T)} ${f(w - m, T + r)} ` +
    `L ${f(w - m, E - r2)} Q ${f(w - m, E)} ${f(w - m + r2, E)} L ${f(w + out, E)}`
  const fmt = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`
  const rot = (x: number, y: number) => fmt(w - x, h - y)
  // reversed route for the words: read left to right along the bottom instead of upside down
  const Arev = (f: (x: number, y: number) => string) =>
    `M ${f(w + out, E)} L ${f(w - m + r2, E)} Q ${f(w - m, E)} ${f(w - m, E - r2)} ` +
    `L ${f(w - m, T + r)} Q ${f(w - m, T)} ${f(w - m - r, T)} L ${f(-out, T)}`
  return [
    { d: A(fmt), text: A(fmt) },
    { d: A(rot), text: Arev(rot) },
  ]
}

export function ApproachSection() {
  const root = useRef<HTMLElement>(null)
  const quote = useRef<HTMLParagraphElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [size, setSize] = useState({ w: 1440, h: 900 })
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const fit = () => setSize({ w: el.clientWidth || 1440, h: el.clientHeight || 900 })
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const band = Math.round(Math.min(40, Math.max(20, Math.min(size.h * 0.042, size.w * 0.05))))
  const tapes = useMemo(() => ribbons(size.w, size.h, band), [size, band])
  const d = tapes[0].d + tapes[1].d
  const lines = useRef<(SVGPathElement | null)[]>([])
  const masks = useRef<(SVGPathElement | null)[]>([])

  useEffect(() => {
    const chars = Array.from(quote.current?.querySelectorAll<HTMLElement>('.ap-ch') ?? [])
    const paths = [...lines.current, ...masks.current].filter(Boolean) as SVGPathElement[]
    const len = lines.current[0]?.getTotalLength() ?? 5000
    for (const p of paths) {
      p.style.strokeDasharray = `${len}`
      p.style.strokeDashoffset = `${len}`
    }
    let lit = -1
    const onScroll = () => {
      const el = root.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = reduced ? 1 : Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)))
      // letters: fill from 6% to 78% of the way through
      const f = Math.min(1, Math.max(0, (p - 0.06) / 0.72))
      const n = Math.round(f * chars.length)
      if (n !== lit) {
        const from = Math.min(n, lit < 0 ? 0 : lit)
        const to = Math.max(n, lit < 0 ? chars.length : lit)
        for (let i = from; i < to; i++) chars[i].classList.toggle('on', i < n)
        lit = n
      }
      // thread: draws from the moment the section arrives (a bit before it pins) to 90%
      const arrive = Math.min(1, Math.max(0, (vh - r.top) / vh)) // 0..1 while it slides up over the iPad
      const t = Math.min(1, Math.max(0, 0.12 * arrive + p / 0.9))
      const off = `${(len * (1 - Math.min(1, t))).toFixed(1)}`
      for (const path of paths) path.style.strokeDashoffset = off
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [reduced, d])

  const full = APPROACH.quote.map((s) => s.text).join(' ')
  return (
    <section className="approach" ref={root} aria-labelledby="ap-eyebrow" style={{ height: `${APPROACH.length * 100}vh` }}>
      <div className="ap-stage" ref={stage}>
        <div className="ap-dots" aria-hidden="true" />
        <svg className="ap-thread" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
          <defs>
            {tapes.map((t, i) => (
              <path key={i} id={`ap-path-${i}`} d={t.text} />
            ))}
            {tapes.map((t, i) => (
              <mask key={i} id={`ap-reveal-${i}`} maskUnits="userSpaceOnUse">
                <path ref={(el) => (masks.current[i] = el)} d={t.d} fill="none" stroke="#fff" strokeWidth={band + 12} strokeLinecap="butt" />
              </mask>
            ))}
          </defs>
          {/* drawn in order, so the second tape passes over the first where they cross */}
          {tapes.map((t, i) => (
            <g key={i}>
              <path ref={(el) => (lines.current[i] = el)} className="ap-band" d={t.d} strokeWidth={band} />
              <g mask={`url(#ap-reveal-${i})`}>
                <text className="ap-words" style={{ fontSize: `${Math.round(band * 0.42)}px` }}>
                  <textPath href={`#ap-path-${i}`} dominantBaseline="central">
                    {(i ? APPROACH.thread.split(' ✦ ').reverse().join(' ✦ ') + ' ✦ ' : APPROACH.thread).repeat(3)}
                  </textPath>
                </text>
              </g>
            </g>
          ))}
        </svg>
        <div className="ap-copy">
          <p className="ap-eyebrow" id="ap-eyebrow">
            <span className="ap-dot" aria-hidden="true" />
            {APPROACH.eyebrow}
          </p>
          <p className="ap-quote" ref={quote} aria-label={full}>
            {APPROACH.quote.map((s, si) => (
              <span key={si} className={s.accent ? 'ap-s ap-accent' : 'ap-s'} aria-hidden="true">
                {s.text.split(' ').map((w, wi) => (
                  <span key={wi}>
                    {wi > 0 && ' '}
                    <span className="ap-w">
                      {Array.from(w).map((c, ci) => (
                        <span key={ci} className="ap-ch">
                          {c}
                        </span>
                      ))}
                    </span>
                  </span>
                ))}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  )
}
