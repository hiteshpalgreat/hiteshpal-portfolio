import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AsciiHands } from './AsciiHands'
import { ContactModal } from '../contact/ContactModal'
import { CAL_LINK, EMAIL } from '../contact/contactConfig'
import './footer.css'

/**
 * Footer and contact, in one dark screen: the question on top, the two ways to reach out right under it,
 * and below them the two hands of "The Creation of Adam" in ASCII reaching for each other, edge to edge. The hands slide in from
 * the edges as the footer scrolls up and then float; hovering scatters the characters.
 */
export function Footer() {
  const root = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const art = useRef<HTMLDivElement>(null)
  const [modal, setModal] = useState(false)
  const close = useCallback(() => setModal(false), [])
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useEffect(() => {
    const el = canvas.current!
    const hands = new AsciiHands(el, reduced)
    // the canvas covers the whole footer; the hands are fitted to the space between the words and the buttons
    const fit = () => {
      const f = root.current!.getBoundingClientRect()
      const a = art.current!.getBoundingClientRect()
      hands.resize(el.clientWidth, el.clientHeight, { x: a.left - f.left, y: a.top - f.top, w: a.width, h: a.height })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    ro.observe(art.current!)
    const io = new IntersectionObserver(([e]) => hands.setRunning(e.isIntersecting), { rootMargin: '100px' })
    io.observe(root.current!)
    const onScroll = () => {
      const r = root.current!.getBoundingClientRect()
      const vh = window.innerHeight
      hands.enter = reduced ? 1 : Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.85)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ro.disconnect()
      io.disconnect()
      hands.dispose()
    }
  }, [reduced])

  const book = () => {
    if (CAL_LINK) window.open(CAL_LINK, '_blank', 'noopener')
    else window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Booking a call')}&body=${encodeURIComponent('Hi Hitesh, I would like to book a call. Times that work for me:\n\n')}`
  }

  return (
    <footer className="site-footer" id="contact" ref={root} aria-labelledby="ft-heading">
      <div className="ft-top">
        <span className="ft-eyebrow">( let's collaborate )</span>
        <h2 className="ft-heading" id="ft-heading">
          Got a project <em>in mind?</em>
        </h2>
        <p className="ft-lede">Let's make something happen together.</p>
      </div>

      <canvas className="ft-hands" ref={canvas} aria-label="The hands of The Creation of Adam, drawn in ASCII characters" role="img" />

      <div className="ft-bottom">
        <div className="ft-actions">
          <button type="button" className="ft-choice ft-mail" onClick={() => setModal(true)} aria-haspopup="dialog">
            <span className="ft-choice-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="m4 7 8 6 8-6" />
              </svg>
            </span>
            <span className="ft-choice-text">
              <strong>Send me a message</strong>
              <small>Straight to my inbox</small>
            </span>
            <span className="ft-arrow" aria-hidden="true">→</span>
          </button>
          <button type="button" className="ft-choice ft-cal" onClick={book}>
            <span className="ft-choice-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M3 10h18M8 3v4M16 3v4" />
                <circle cx="12" cy="15" r="1.6" fill="currentColor" />
              </svg>
            </span>
            <span className="ft-choice-text">
              <strong>Book a call</strong>
              <small>Pick a time that suits you</small>
            </span>
            <span className="ft-arrow" aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
      <div className="ft-art" ref={art} aria-hidden="true" />
      <ContactModal open={modal} onClose={close} />
    </footer>
  )
}
