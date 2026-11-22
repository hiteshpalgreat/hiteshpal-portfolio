import { useEffect, useRef, useState } from 'react'
import { PulseDots } from './PulseDots'
import { SOCIALS, type Social } from './socials'
import { EMAIL } from '../contact/contactConfig'
import { scrollToElement } from '../../smoothScroll'
import './endcard.css'

const RING = 'SENT WITH LOVE · HITESH PAL · 2026 · '
const NAMES = [
  ['Hitesh', 'Pal'],
  ['Ottrly', 'Co'],
]

const ICONS: Record<Social['id'], JSX.Element> = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.4 8.6h3.1V19H5.4zM6.9 4a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6ZM10.4 8.6h3v1.4h.1c.4-.8 1.4-1.7 3-1.7 3.2 0 3.8 2.1 3.8 4.8V19h-3.1v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V19h-3.1z" />
    </svg>
  ),
  behance: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.6 11.4c.9-.4 1.4-1.2 1.4-2.2C10 7.1 8.5 6 6.4 6H2v12h4.6c2.2 0 3.9-1.1 3.9-3.3 0-1.4-.7-2.8-1.9-3.3ZM4.6 8.1h1.7c.7 0 1.3.3 1.3 1.1 0 .8-.6 1.1-1.3 1.1H4.6V8.1Zm1.9 7.8H4.6v-2.6h2c.9 0 1.5.4 1.5 1.3 0 1-.7 1.3-1.6 1.3ZM16.9 9.4c-2.5 0-4.2 1.9-4.2 4.4 0 2.6 1.6 4.4 4.2 4.4 2 0 3.3-.9 3.9-2.8h-2.1c-.2.6-1 1-1.7 1-1.2 0-1.9-.7-2-2h6c.1-2.7-1.4-5-4.1-5Zm-1.9 3.4c.1-1 .8-1.6 1.8-1.6s1.6.6 1.7 1.6H15ZM14.6 6.8h4.6V8h-4.6z" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),
}

/** "Hitesh Pal", which turns letter by letter into "Ottrly Co" while the pointer is over it */
function SwapName() {
  const [alt, setAlt] = useState(false)
  return (
    <h2
      className={`ec-name ${alt ? 'alt' : ''}`}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setAlt(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setAlt(false)}
      onClick={() => setAlt((a) => !a)}
      aria-label="Hitesh Pal, of Ottrly Co"
    >
      {NAMES[0].map((word, li) => (
        // both words share one cell; each keeps its own natural letter widths
        <span className="ec-line" key={li} aria-hidden="true">
          {[word, NAMES[1][li]].map((w, k) => (
            <span className={`ec-word ${k ? 'b' : 'a'}`} key={k}>
              {Array.from(w).map((ch, i) => (
                <span className="ec-ch" key={i} style={{ '--d': `${(li * 3 + i) * 16}ms` } as React.CSSProperties}>
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </span>
      ))}
    </h2>
  )
}

/**
 * The site's sign-off, after FOG's footer card: once the contact screen is in place, scrolling on brings
 * a big postage stamp up from below, tilted, straightening as it rises and settling in the middle of the
 * screen, while the contact screen behind it blurs and dims. Dots pulse across the stamp's pink face.
 */
export function EndCard() {
  const wrap = useRef<HTMLDivElement>(null)
  const veil = useRef<HTMLDivElement>(null)
  const face = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dots = new PulseDots(canvas.current!, face.current!, reduced, [255, 226, 234])
    const ro = new ResizeObserver(() => dots.resize())
    ro.observe(canvas.current!)
    const io = new IntersectionObserver(([e]) => dots.setRunning(e.isIntersecting))
    io.observe(face.current!)
    const finale = wrap.current!.closest('.finale') as HTMLElement
    let raf = 0
    const tick = () => {
      raf = 0
      const r = finale.getBoundingClientRect()
      const vh = window.innerHeight
      // the contact screen first rests on its own for a while (the hold); then 0..1 over the rest of the room
      const hold = vh * 0.7
      const p = Math.min(1, Math.max(0, (-r.top - hold) / Math.max(1, r.height - vh - hold)))
      const e = reduced ? (p > 0.05 ? 1 : 0) : 1 - Math.pow(1 - p, 3)
      const w = wrap.current!
      w.style.transform = `translate3d(0, ${((1 - e) * (vh * 0.95)).toFixed(1)}px, 0) rotate(${((1 - e) * -16).toFixed(2)}deg)`
      w.style.visibility = p <= 0 ? 'hidden' : 'visible'
      const v = veil.current!
      const b = Math.min(1, p * 1.4)
      v.style.opacity = b.toFixed(3)
      v.style.pointerEvents = b > 0.5 ? 'auto' : 'none'
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    tick()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      ro.disconnect()
      io.disconnect()
      dots.dispose()
    }
  }, [])

  const toContact = () => {
    const el = document.querySelector('.finale') as HTMLElement | null
    if (el) scrollToElement(el, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }
  const links: Social[] = [...SOCIALS, { id: 'email', label: 'Email', url: `mailto:${EMAIL}` }]

  return (
    <div className="endcard" aria-label="Sign-off" role="region">
      <div className="ec-veil" ref={veil} aria-hidden="true" />
      <div className="ec-wrap" ref={wrap}>
        <div className="ec-stamp">
          <div className="ec-face" ref={face}>
            <canvas className="ec-dots" ref={canvas} aria-hidden="true" />
            <div className="ec-top">
              <span className="ec-kicker">
                Visual Communication Designer
                <br />
                Brand · Product · Motion · 3D
              </span>
              <span className="ec-value">
                since
                <b>2019</b>
              </span>
            </div>
            <div className="ec-postmark" aria-hidden="true">
              <svg viewBox="0 0 200 200">
                <defs>
                  <path id="ec-ring-path" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
                </defs>
                <g className="ring">
                  <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="3" />
                  <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeWidth="2" />
                  <text>
                    <textPath href="#ec-ring-path" textLength="488" lengthAdjust="spacing">
                      {RING}
                    </textPath>
                  </text>
                </g>
                <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  {[-14, 0, 14].map((y) => (
                    <path key={y} d={`M-40 ${100 + y} q 18 -10 36 0 t 36 0 t 36 0 t 36 0 t 36 0 t 36 0 t 36 0`} />
                  ))}
                </g>
              </svg>
            </div>
            <SwapName />
            <div className="ec-side">
              <p className="ec-tag">I make brands, campaigns, products and motion for people building something worth looking at.</p>
              <button type="button" className="ec-cta" onClick={toContact}>
                Start a project
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 12h15M13 5l7 7-7 7" />
                </svg>
              </button>
              <div className="ec-links">
                <span>Find me</span>
                {links.map((l) =>
                  l.url ? (
                    <a key={l.id} href={l.url} target={l.id === 'email' ? undefined : '_blank'} rel="noopener noreferrer" aria-label={l.label} title={l.label}>
                      {ICONS[l.id]}
                    </a>
                  ) : (
                    <a key={l.id} className="soon" aria-label={`${l.label} (coming soon)`} title={`${l.label}: add the link in socials.ts`} aria-disabled="true">
                      {ICONS[l.id]}
                    </a>
                  ),
                )}
              </div>
              <span className="ec-copy">© {new Date().getFullYear()} Hitesh Pal. All rights reserved.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
