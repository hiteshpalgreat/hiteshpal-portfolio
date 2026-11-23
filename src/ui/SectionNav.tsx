import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { scrollToY } from '../smoothScroll'

/**
 * The site's sections as a column of dots in the top-left corner, from About onwards, with the name of the
 * section you're in beside its dot. Hover it (or tab into it) and it opens into the full list with more room
 * between the rows; it folds back by itself a moment after the cursor leaves, and right after a click.
 * The ink follows whatever is behind the list: dark over light backgrounds, light over dark ones.
 * Three looks: passive (dimmed), hovered or keyboard-focused (full strength, nudged, ring dot) and active,
 * the section you're in (full strength, lit dot).
 */
type Section = { id: string; label: string; top: () => number | null; hidden?: boolean }

const vh = () => window.innerHeight
const docTop = (sel: string) => () => {
  const el = document.querySelector(sel) as HTMLElement | null
  return el ? el.getBoundingClientRect().top + window.scrollY : null
}

const SECTIONS: Section[] = [
  // the room is reached from the door in the top-right corner, not from the list
  { id: 'room', label: 'Room', top: () => 0, hidden: true },
  { id: 'about', label: 'About', top: docTop('#about') },
  { id: 'work', label: 'Work', top: docTop('#work') },
  { id: 'skills', label: 'Skills', top: docTop('.skills-head') },
  { id: 'testimonials', label: 'Testimonials', top: docTop('.testimonials') },
  { id: 'pricing', label: 'Pricing', top: docTop('#pricing') },
  { id: 'contact', label: 'Contact', top: docTop('.finale') },
]

/** how bright the page is right behind the list (0 dark .. 1 light), read from the backgrounds under it */
function brightnessBehind(nav: HTMLElement) {
  const r = nav.getBoundingClientRect()
  const xs = [r.left + 10, r.left + Math.min(r.width, 120) * 0.7]
  const ys = [r.top + 10, r.top + r.height * 0.5, r.bottom - 10]
  let sum = 0
  let n = 0
  for (const x of xs)
    for (const y of ys) {
      const l = brightnessAt(x, y, nav)
      if (l != null) {
        sum += l
        n++
      }
    }
  return n ? sum / n : null
}

const COLOR = /rgba?\(([^)]+)\)/g
function lum(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}
/** the first solid-ish background at this point, below the list itself */
function brightnessAt(x: number, y: number, nav: HTMLElement): number | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (nav.contains(el)) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.opacity === '0') continue
    // gradients: average their colour stops
    if (cs.backgroundImage.includes('gradient')) {
      let t = 0
      let k = 0
      for (const m of cs.backgroundImage.matchAll(COLOR)) {
        const [r, g, b, a = 1] = m[1].split(',').map(Number)
        if (a < 0.3) continue
        t += lum(r, g, b)
        k++
      }
      if (k) return t / k
    }
    const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/)
    if (m) {
      const [r, g, b, a = 1] = m[1].split(',').map(Number)
      if (a >= 0.5) return lum(r, g, b)
    }
  }
  return null
}

/** where a section counts as "the one you're in" */
function startOf(s: Section) {
  if (s.id === 'room') return 0
  const t = s.top()
  return t == null ? Infinity : t - vh() * 0.35
}

export function SectionNav() {
  const ready = useStore((s) => s.ready)
  const free = useStore((s) => s.ready && s.stage === 'room' && !s.focus && !s.view && !s.gallery && !s.codeLab)
  const [active, setActive] = useState('room')
  // the list only joins once the page reaches About; the room and the reel above it stay uncluttered
  const [reached, setReached] = useState(false)
  const visible = free && reached
  const target = useRef<string | null>(null) // while gliding to a section, keep it lit
  const nav = useRef<HTMLElement>(null)
  const [onLight, setOnLight] = useState(false)
  // open while hovered or tabbed into; folds back by itself a moment after the cursor leaves
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(0)
  const openNow = () => {
    window.clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const closeSoon = (ms = 280) => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), ms)
  }

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const y = window.scrollY
      const atEnd = y + vh() >= document.documentElement.scrollHeight - 4
      let id = 'room'
      for (const s of SECTIONS) if (y >= startOf(s)) id = s.id
      if (atEnd) id = 'contact'
      setReached(id !== 'room')
      // light or dark behind the list right now (with a little hysteresis so it doesn't flicker)
      if (nav.current) {
        const b = brightnessBehind(nav.current)
        if (b != null) setOnLight((was) => (was ? b > 0.45 : b > 0.58))
      }
      if (target.current) {
        if (target.current === id) target.current = null
        else return
      }
      setActive(id)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    // sections animate their own backgrounds while pinned, so look again now and then too
    const poll = window.setInterval(onScroll, 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    // the visitor grabbing the wheel mid-glide hands control back
    const release = () => (target.current = null)
    window.addEventListener('wheel', release, { passive: true })
    window.addEventListener('touchstart', release, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(poll)
      window.clearTimeout(closeTimer.current)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('wheel', release)
      window.removeEventListener('touchstart', release)
    }
  }, [])

  const go = (s: Section) => {
    const top = s.top()
    if (top == null) return
    const y = top
    const dist = Math.abs(y - window.scrollY) / vh()
    // unhurried, a little longer for longer trips
    const duration = Math.min(3.2, 1.1 + dist * 0.12)
    target.current = s.id
    setActive(s.id)
    // fold away straight after choosing
    setOpen(false)
    ;(document.activeElement as HTMLElement | null)?.blur()
    scrollToY(y, useStore.getState().reducedMotion, duration)
  }

  if (!ready) return null
  const room = SECTIONS[0]
  return (
    <>
    <button
      type="button"
      className={`room-door ${visible ? 'show' : ''} ${onLight ? 'on-light' : ''}`}
      onClick={() => go(room)}
      tabIndex={visible ? 0 : -1}
      aria-label="Back to the room"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path className="frame" d="M7 28V5.5A1.5 1.5 0 0 1 8.5 4h15A1.5 1.5 0 0 1 25 5.5V28" />
        <path d="M4 28h24" />
        <path className="leaf" d="M10 27.5V7l11-1.6v23.6Z" />
        <circle className="knob" cx="18.2" cy="17.5" r="1" fill="currentColor" stroke="none" />
      </svg>
      <span>Room</span>
    </button>
    <nav
      ref={nav}
      className={`secnav ${visible ? 'show' : ''} ${open && visible ? 'open' : ''} ${onLight ? 'on-light' : ''}`}
      aria-label="Sections"
      onPointerEnter={(e) => e.pointerType === 'mouse' && openNow()}
      onPointerLeave={(e) => e.pointerType === 'mouse' && closeSoon()}
      onFocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && openNow()}
      onBlur={(e) => !nav.current?.contains(e.relatedTarget as Node) && closeSoon(0)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false)
          ;(document.activeElement as HTMLElement | null)?.blur()
        }
      }}
    >
      <ul>
        {SECTIONS.filter((s) => !s.hidden).map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={active === s.id ? 'active' : ''}
              aria-current={active === s.id ? 'true' : undefined}
              aria-label={s.label}
              tabIndex={visible ? 0 : -1}
              onClick={() => go(s)}
            >
              <span className="dot" aria-hidden />
              <span className="label">{s.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
    </>
  )
}
