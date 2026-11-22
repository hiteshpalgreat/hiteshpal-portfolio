import { clearHover } from '../interaction/hover'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useProgress } from '@react-three/drei'
import { useStore } from '../store'
import { closeFocus, ctx } from '../interaction/focus'
import { stepFocus } from '../interaction/nav'
import { finishIntro } from '../interaction/intro'
import { travelBack } from '../interaction/travel'
import { scrollToElement } from '../smoothScroll'
import { SelectedWork } from '../sections/selected/SelectedWork'
import { StatsSection } from '../sections/stats/StatsSection'
import { SkillsHeading, WorkSection } from '../sections/work/WorkSection'
import { Footer } from '../sections/footer/Footer'
import { TestimonialsSection } from '../sections/testimonials/TestimonialsSection'
import { ClientsSection } from '../sections/clients/ClientsSection'
import { AboutSection } from '../sections/about/AboutSection'
import { ProcessSection } from '../sections/process/ProcessSection'
import { PricingSection } from '../sections/pricing/PricingSection'
import { FaqSection } from '../sections/faq/FaqSection'
import { EndCard } from '../sections/endcard/EndCard'
import { ApproachSection } from '../sections/approach/ApproachSection'
import { showreel } from '../showreel'
import { ipadFly, FLY_SHARE } from '../scene/IpadFly'
import { FLY, HOLD } from '../scrollPlan'
import content from '../content.json'

/** where each screen leads, shown by the cursor up close on the screens */
const LEADS: Record<string, string> = {
  ipad: 'Watch the showreel',
  monitor_wide: 'Open my Framer site ↗',
  photo_frame: 'Flip through the photos',
}

/** Small label that follows the cursor while an item is hovered (after the dwell). */
export function LabelChip() {
  const ref = useRef<HTMLDivElement>(null)
  const hovered = useStore((s) => s.hovered)
  const dwell = useStore((s) => s.dwell)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const { pointer } = useStore.getState()
      if (ref.current) ref.current.style.transform = `translate3d(${pointer.px + 18}px, ${pointer.py + 16}px, 0)`
      raf = requestAnimationFrame(tick)
    }
    tick()
    // once the page scrolls away from the room, nothing in it is under the cursor any more:
    // drop the hover so its label doesn't ride along with the pointer into the sections below
    const onScroll = () => {
      if (window.scrollY > 24 && useStore.getState().hovered) clearHover()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
  const viewHover = useStore((s) => s.viewHover)
  const lead = viewHover ? LEADS[viewHover.userData.item_id as string] : undefined
  const label = lead ?? (hovered?.userData.label as string | undefined)
  const view = useStore((s) => s.view)
  // the arcade is playable: say so while it's hovered from the room (not once you're already at it)
  const playHint = !lead && !view && hovered?.userData.item_id === 'arcade'
  return (
    <div ref={ref} className={`chip ${(hovered && dwell) || lead ? 'show' : ''} ${lead ? 'lead' : ''}`} aria-hidden>
      {label}
      {playHint && <span className="chip-sub">Click to start playing</span>}
    </div>
  )
}

const KIND_EYEBROW: Record<string, string> = {
  book: 'On the shelf',
  wall: 'On the wall',
  boardgame: 'Game night',
  desk: 'On the desk',
  instrument: 'Music corner',
  floating: 'Floating by the window',
  arcade: 'Player one',
  boarding: 'Places I have been',
  screen: 'On the screen',
}

/** Description card + click-anywhere-to-close backdrop (section 5). */
export function DescriptionCard() {
  const focus = useStore((s) => s.focus)
  const card = useRef<HTMLDivElement>(null)
  const open = !!focus && focus.phase !== 'out'
  const item = focus?.items[0]
  const key = focus?.key ?? ''
  const contentKey = (item?.userData.content_id as string) || key
  const text = ((content as any)[contentKey]?.description as string) || ''
  const title = key === 'boarding_passes' ? 'Boarding Passes' : (item?.userData.label as string) ?? ''
  const eyebrow = KIND_EYEBROW[(item?.userData.kind as string) ?? ''] ?? ''

  useEffect(() => {
    if (!card.current) return
    gsap.killTweensOf(card.current)
    if (open) gsap.to(card.current, { opacity: 1, x: 0, duration: 0.45, delay: 0.35, ease: 'power3.out' })
    else gsap.to(card.current, { opacity: 0, x: 40, duration: 0.3, ease: 'power2.in' })
  }, [open, key])

  return (
    <>
      {open && <div className="backdrop" onClick={closeFocus} />}
      <div ref={card} className={`card ${open ? 'show' : ''}`} role="dialog" aria-label={title}>
        <button className="close" onClick={closeFocus} aria-label="Close">
          ×
        </button>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {text && <p>{text}</p>}
        <div className="hint">Arrows to browse · Esc or click anywhere to put it back</div>
      </div>
    </>
  )
}

/** Minimal preloader that fades into the room. */
export function Loader() {
  const { progress, active } = useProgress()
  const ready = useStore((s) => s.ready)
  // once the room is in, the loader is gone for good: later sections load their own textures through the
  // same three.js loading manager, and that must not bring the door screen back for a flash
  const latched = useRef(false)
  if (ready && !active && progress >= 100) latched.current = true
  const done = latched.current
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = window.setTimeout(() => setGone(true), 1000) // after the fade-out
    return () => window.clearTimeout(t)
  }, [done])
  if (gone) return null
  return (
    <div className={`loader ${done ? 'done' : ''}`}>
      <div className="inner">
        <div className="title">Opening the door</div>
        <div className="bar">
          <i style={{ width: `${Math.round(progress)}%` }} />
        </div>
        <div className="pct">{Math.round(progress)}%</div>
      </div>
    </div>
  )
}

/** Small hint at the bottom while the camera is at the arcade or the screens. */
export function ViewHint() {
  const view = useStore((s) => s.view)
  const show = !!view && view.phase === 'open'
  const text =
    view?.kind === 'arcade'
      ? 'Arrow keys to play · Esc or click outside the arcade to step back'
      : 'The glowing screens open things · Esc or click anywhere else to step back'
  return <div className={`view-hint ${show ? 'show' : ''}`}>{text}</div>
}

/** "Click at your own curiosity": shown while standing in front of the door. */
export function DoorHint() {
  const stage = useStore((s) => s.stage)
  const ready = useStore((s) => s.ready)
  const show = ready && stage === 'door'
  return (
    <div className={`door-hint ${show ? 'show' : ''}`} aria-live="polite">
      <span>Click at your own curiosity</span>
    </div>
  )
}

/** "Welcome to my headspace": appears once inside, then evaporates. */
export function Welcome() {
  const stage = useStore((s) => s.stage)
  const ref = useRef<HTMLDivElement>(null)
  const played = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el || stage !== 'room' || played.current) return
    if (!document.body.dataset.introPlayed) return
    played.current = true
    const letters = el.querySelectorAll('i')
    const reduced = useStore.getState().reducedMotion
    gsap.killTweensOf([el, letters])
    const tl = gsap.timeline()
    if (location.search.includes('test')) (window as any).__wtl = tl
    tl.set(el, { opacity: 1 })
    tl.fromTo(
      letters,
      { opacity: 0, y: 14, filter: 'blur(10px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: reduced ? 0.3 : 1.1, ease: 'power3.out', stagger: reduced ? 0 : 0.035 },
    )
    // hold, then evaporate letter by letter: drift up, blur out, fade
    tl.to(
      letters,
      { opacity: 0, y: -26, filter: 'blur(14px)', duration: reduced ? 0.3 : 1.6, ease: 'power2.in', stagger: reduced ? 0 : { each: 0.03, from: 'random' } },
      '+=1.6',
    )
    tl.set(el, { opacity: 0 })
  }, [stage])
  const text = 'Welcome to my headspace'
  return (
    <div ref={ref} className="welcome" aria-hidden={stage !== 'room'}>
      {text.split('').map((c, i) => (
        <i key={i}>{c === ' ' ? '\u00a0' : c}</i>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Top-right controls: skip link + "show everything I can explore"    */
/* ------------------------------------------------------------------ */

export function skipToMain() {
  finishIntro()
  closeFocus()
  travelBack()
  const reduced = useStore.getState().reducedMotion
  // wait a frame so the page is allowed to scroll again
  requestAnimationFrame(() => {
    const main = document.getElementById('main')
    if (!main) return
    scrollToElement(main, reduced)
    main.focus({ preventScroll: true })
  })
}

export function TopBar() {
  const ready = useStore((s) => s.ready)
  const stage = useStore((s) => s.stage)
  const on = useStore((s) => s.highlightAll)
  const inRoom = stage === 'room'
  // both controls belong to the room: they leave as soon as you start scrolling away from it
  const [away, setAway] = useState(false)
  useEffect(() => {
    const onScroll = () => setAway(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <nav className={`topbar ${ready ? 'show' : ''} ${away ? 'away' : ''}`} aria-label="Site">
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          skipToMain()
        }}
      >
        Skip to main content
      </a>
      <button
        className={`eye ${on ? 'on' : ''} ${inRoom ? '' : 'hidden'}`}
        aria-pressed={on}
        aria-label={on ? 'Hide highlights' : 'Highlight everything you can explore'}
        title={on ? 'Hide highlights' : 'Highlight everything you can explore'}
        tabIndex={inRoom ? 0 : -1}
        onClick={() => useStore.getState().set({ highlightAll: !on })}
      >
        <svg viewBox="0 0 24 24" aria-hidden width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {on && <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />}
        </svg>
      </button>
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* Previous / next arrows on both sides of the focused object          */
/* ------------------------------------------------------------------ */

const Chevron = ({ dir }: { dir: 'left' | 'right' | 'down' }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {dir === 'left' && <path d="M14.5 5.5 8 12l6.5 6.5" />}
    {dir === 'right' && <path d="M9.5 5.5 16 12l-6.5 6.5" />}
  </svg>
)

export function FocusNav() {
  const focus = useStore((s) => s.focus)
  const [pos, setPos] = useState<{ l: number; r: number; y: number } | null>(null)
  const show = !!focus && focus.phase === 'open'
  const key = focus?.key

  useEffect(() => {
    const place = () => {
      const f = useStore.getState().focus
      if (!f || !ctx.camera) return
      const W = window.innerWidth
      const H = window.innerHeight
      const passes = f.key === 'boarding_passes'
      // same framing maths as focus.ts: the copy sits left of centre, clear of the card
      const cx = W * (0.5 - (passes ? 0.12 : 0.13))
      // focus.ts scales the copy so its bounding sphere spans min(80% height, 50% width);
      // the visible object is a little narrower than that sphere
      const half = passes ? 0.25 * W : Math.min(0.4 * H, 0.25 * W) * 0.85
      const card = document.querySelector('.card') as HTMLElement | null
      const cardLeft = card ? card.getBoundingClientRect().left : W
      const gap = 36
      const l = Math.max(28, cx - half - gap)
      const r = Math.min(cardLeft - 28, cx + half + gap)
      setPos({ l, r, y: H / 2 })
    }
    if (show) place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [show, key])

  return (
    <div className={`focus-nav ${show && pos ? 'show' : ''}`}>
      <button
        className="nav-arrow"
        style={pos ? { left: pos.l, top: pos.y } : undefined}
        aria-label="Previous object"
        tabIndex={show ? 0 : -1}
        onClick={() => stepFocus(-1)}
      >
        <Chevron dir="left" />
      </button>
      <button
        className="nav-arrow"
        style={pos ? { left: pos.r, top: pos.y } : undefined}
        aria-label="Next object"
        tabIndex={show ? 0 : -1}
        onClick={() => stepFocus(1)}
      >
        <Chevron dir="right" />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* "Scroll for more": appears after 10 s in the room                  */
/* ------------------------------------------------------------------ */

export function ScrollHint() {
  const stage = useStore((s) => s.stage)
  const busy = useStore((s) => !!s.focus || !!s.view)
  const [due, setDue] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (stage !== 'room') return
    const t = window.setTimeout(() => setDue(true), 10000)
    return () => window.clearTimeout(t)
  }, [stage])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const show = due && !busy && !scrolled
  return (
    <div className={`scroll-hint ${show ? 'show' : ''}`} aria-hidden={!show}>
      <button
        className="scroll-hint-inner"
        tabIndex={show ? 0 : -1}
        onClick={() => {
          const main = document.getElementById('main')
          if (main) scrollToElement(main, useStore.getState().reducedMotion)
        }}
      >
        <span className="scroll-hint-text">Scroll for more</span>
        <svg className="scroll-hint-arrow" viewBox="0 0 44 12" width="44" height="12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 2 22 10 42 2" />
        </svg>
      </button>
    </div>
  )
}

/** What the skip link and the scroll hint lead to: the content right after the room. */
export function MainContent() {
  return (
    <main id="main" tabIndex={-1} className="main">
      <ApproachSection />
      <AboutSection />
      <ClientsSection />
      <StatsSection />
      <SelectedWork />
      <SkillsHeading />
      <WorkSection />
      <ProcessSection />
      <TestimonialsSection variant="light" />
      <PricingSection />
      <FaqSection />
      {/* the contact screen holds still while the stamp card rises over it */}
      <div className="finale">
        <div className="finale-stage">
          <Footer />
          <EndCard />
        </div>
      </div>
    </main>
  )
}

const fmt = (t: number) => {
  if (!Number.isFinite(t) || t < 0) return '0:00'
  const m = Math.floor(t / 60)
  return `${m}:${String(Math.floor(t % 60)).padStart(2, '0')}`
}

const Icon = {
  play: <path d="M7 4.5v15l12-7.5-12-7.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  prev: <path d="m19 20-10-8 10-8v16zM5 19V5" />,
  next: <path d="m5 4 10 8-10 8V4zM19 5v14" />,
  muted: (
    <>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="m23 9-6 6M17 9l6 6" />
    </>
  ),
  sound: (
    <>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
    </>
  ),
  full: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  unfull: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
}
const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

/**
 * Showreel controls.
 * - In the room: a compact set right under the iPad (previous, play/pause, next, sound), shown while the
 *   iPad is hovered or opened, and for a few seconds after the cursor leaves it.
 * - Full window, a player that works like YouTube's:
 *   click anywhere to play or pause (double-click for fullscreen); click the far left or right edge for the
 *   previous or next reel. Along the bottom: the timeline (hover shows the time under the cursor), previous,
 *   play/pause, next, sound and volume, the time, speed and fullscreen. Everything hides a few seconds after
 *   the mouse stops and comes back as soon as it moves.
 *   Keys: Space or K play/pause, J and L back/forward 10s, ← → 5s, ↑ ↓ volume, M mute, F fullscreen,
 *   0 to 9 jump to 0%..90%, Home/End, Shift+N / Shift+P next/previous reel, < and > speed.
 */
type Flash = { kind: 'play' | 'pause' | 'back' | 'fwd' | 'prev' | 'next' | 'info'; text?: string; key: number }

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]
const EDGE = 0.14 // share of the width on each side that changes the reel

function toggleFullscreen() {
  const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void }
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  if (doc.fullscreenElement || doc.webkitFullscreenElement) (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())
  else (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())?.catch?.(() => {})
}

export function ReelControls() {
  const ref = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const time = useRef<HTMLSpanElement>(null)
  const [state, setState] = useState(() => showreel().state)
  const [full, setFull] = useState(false)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [speedOpen, setSpeedOpen] = useState(false)
  const [isFs, setIsFs] = useState(false)
  const [edge, setEdge] = useState<'left' | 'right' | null>(null) // edge under the cursor
  const fullRef = useRef(false)
  const clickTimer = useRef(0)
  useEffect(() => showreel().subscribe(setState), [])
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const reel = showreel()
  const show = (f: Omit<Flash, 'key'>) => setFlash({ ...f, key: performance.now() })

  // the actions, each with its little on-screen echo
  const act = {
    toggle: () => {
      reel.togglePlay()
      show({ kind: reel.state.paused ? 'pause' : 'play' })
    },
    back: (s: number) => {
      reel.seekBy(-s)
      show({ kind: 'back', text: `${s} seconds` })
    },
    fwd: (s: number) => {
      reel.seekBy(s)
      show({ kind: 'fwd', text: `${s} seconds` })
    },
    prev: () => {
      reel.prev()
      show({ kind: 'prev', text: 'Previous reel' })
    },
    next: () => {
      reel.next()
      show({ kind: 'next', text: 'Next reel' })
    },
    volume: (d: number) => {
      // muted: up unmutes at the volume it had, like YouTube
      const from = reel.state.muted && d > 0 ? reel.video.volume - d : reel.state.muted ? 0 : reel.video.volume
      const v = Math.round(Math.max(0, Math.min(1, from + d)) * 20) / 20
      reel.setVolume(v)
      show({ kind: 'info', text: v === 0 ? 'Muted' : `${Math.round(v * 100)}%` })
    },
    mute: () => {
      reel.toggleSound()
      show({ kind: 'info', text: reel.state.muted ? 'Muted' : `${Math.round(reel.video.volume * 100)}%` })
    },
    rate: (r: number) => {
      reel.setRate(r)
      show({ kind: 'info', text: r === 1 ? 'Normal speed' : `${r}x` })
    },
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    let until = 0 // compact: stay shown until this time
    let lastMove = performance.now() // full: last pointer activity
    let over = false
    let isFull = false
    const enter = () => (over = true)
    const leave = () => {
      over = false
      until = performance.now() + 2500
    }
    const wake = () => (lastMove = performance.now())
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)
    window.addEventListener('pointermove', wake, { passive: true })
    window.addEventListener('pointerdown', wake, { passive: true })
    window.addEventListener('keydown', wake)
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const s = useStore.getState()
      const now = performance.now()
      const vh = window.innerHeight
      const y = window.scrollY
      const id = (o: any) => o?.userData?.item_id
      const inRoom = s.stage === 'room' && !s.dispersing
      // full window: the reel has grown to fill the screen and the next section hasn't come up yet
      const nowFull = inRoom && ipadFly.p >= 0.99 && y < (FLY + HOLD + 0.35) * vh
      if (nowFull !== isFull) {
        isFull = nowFull
        fullRef.current = nowFull
        setFull(nowFull)
        lastMove = now
      }
      let shown = false
      if (isFull) {
        // the bar spans the bottom of the window: drop the position used for the pill under the iPad
        if (el.style.left) {
          el.style.left = ''
          el.style.top = ''
        }
        shown = over || now - lastMove < 2600 || reel.video.paused
        document.documentElement.classList.toggle('reel-idle', !shown)
      } else {
        document.documentElement.classList.remove('reel-idle')
        const onIpad = s.stage === 'room' && (id(s.hovered) === 'ipad' || s.focus?.key === 'ipad' || s.view?.kind === 'screens')
        if (onIpad) until = now + 2500
        shown = inRoom && y < vh * 0.3 && (onIpad || over || now < until)
        // sit just under the iPad on screen
        const r = ipadFly.rect
        if (r.ok) {
          const w = el.offsetWidth || 220
          const x = Math.min(window.innerWidth - w / 2 - 12, Math.max(w / 2 + 12, r.x + r.w / 2))
          const top = Math.min(vh - 64, r.y + r.h + 14)
          el.style.left = `${x.toFixed(0)}px`
          el.style.top = `${top.toFixed(0)}px`
        }
      }
      el.classList.toggle('show', shown)
      // timeline and what's loaded
      const v = reel.video
      const d = v.duration
      const ok = Number.isFinite(d) && d > 0
      if (bar.current) {
        bar.current.style.setProperty('--p', ok ? String(v.currentTime / d) : '0')
        let buf = 0
        for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime) buf = Math.max(buf, v.buffered.end(i))
        bar.current.style.setProperty('--b', ok ? String(buf / d) : '0')
        bar.current.setAttribute('aria-valuenow', ok ? String(Math.round((v.currentTime / d) * 100)) : '0')
        bar.current.setAttribute('aria-valuetext', `${fmt(v.currentTime)} of ${fmt(d)}`)
      }
      if (time.current) time.current.textContent = `${fmt(v.currentTime)} / ${fmt(d)}`
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerleave', leave)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
      document.documentElement.classList.remove('reel-idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keyboard, like YouTube, while the reel fills the window
  useEffect(() => {
    if (!full) {
      setSpeedOpen(false)
      setEdge(null)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        if (!(t as HTMLInputElement).classList?.contains('reel-vol')) return
      }
      // a focused button already answers Space/Enter itself
      if ((e.key === ' ' || e.key === 'Enter') && t?.tagName === 'BUTTON') return
      const k = e.key
      let done = true
      if (k === ' ' || k === 'k' || k === 'K') act.toggle()
      else if (k === 'j' || k === 'J') act.back(10)
      else if (k === 'l' || k === 'L') {
        if (e.shiftKey) done = false
        else act.fwd(10)
      } else if (k === 'ArrowLeft') act.back(5)
      else if (k === 'ArrowRight') act.fwd(5)
      else if (k === 'ArrowUp') act.volume(0.05)
      else if (k === 'ArrowDown') act.volume(-0.05)
      else if (k === 'm' || k === 'M') act.mute()
      else if (k === 'f' || k === 'F') toggleFullscreen()
      else if (k === 'N' && e.shiftKey) act.next()
      else if (k === 'P' && e.shiftKey) act.prev()
      else if (k === 'Home') reel.seek(0)
      else if (k === 'End') reel.seek(0.999)
      else if (k === '>' || k === '<') {
        const i = RATES.indexOf(reel.video.playbackRate)
        const j = Math.max(0, Math.min(RATES.length - 1, (i < 0 ? 2 : i) + (k === '>' ? 1 : -1)))
        act.rate(RATES[j])
      } else if (/^[0-9]$/.test(k)) reel.seek(Number(k) / 10)
      else done = false
      if (done) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full])

  // the flash fades by itself
  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 650)
    return () => window.clearTimeout(t)
  }, [flash])

  const seekFrom = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    reel.seek((e.clientX - r.left) / r.width)
  }
  const hoverTime = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    e.currentTarget.style.setProperty('--h', String(f))
    if (tip.current) tip.current.textContent = fmt(f * (reel.video.duration || 0))
  }

  // clicks on the picture: edges change the reel, anywhere else plays/pauses (double-click: fullscreen)
  const zoneOf = (x: number) => (x < window.innerWidth * EDGE ? 'left' : x > window.innerWidth * (1 - EDGE) ? 'right' : null)
  const onPictureClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (speedOpen) return setSpeedOpen(false)
    const zone = zoneOf(e.clientX)
    if (zone === 'left') return act.prev()
    if (zone === 'right') return act.next()
    if (e.detail === 2) {
      window.clearTimeout(clickTimer.current)
      toggleFullscreen()
      return
    }
    window.clearTimeout(clickTimer.current)
    clickTimer.current = window.setTimeout(act.toggle, 220)
  }

  const flashIcon =
    flash?.kind === 'play' ? Icon.play : flash?.kind === 'pause' ? Icon.pause : flash?.kind === 'prev' ? Icon.prev : flash?.kind === 'next' ? Icon.next : null
  const flashSide = flash?.kind === 'back' || flash?.kind === 'prev' ? 'left' : flash?.kind === 'fwd' || flash?.kind === 'next' ? 'right' : 'mid'

  return (
    <>
      {full && (
        <div
          className={`reel-hit ${edge ? `edge-${edge}` : ''}`}
          onClick={onPictureClick}
          onPointerMove={(e) => setEdge(zoneOf(e.clientX))}
          onPointerLeave={() => setEdge(null)}
          aria-hidden="true"
        >
          <span className="reel-edge left">
            <Svg>{Icon.prev}</Svg>
            <em>Previous reel</em>
          </span>
          <span className="reel-edge right">
            <em>Next reel</em>
            <Svg>{Icon.next}</Svg>
          </span>
          {flash && (
            <span key={flash.key} className={`reel-flash ${flashSide} ${flash.kind}`}>
              {flashIcon ? (
                <span className="reel-flash-disc">
                  <Svg>{flashIcon}</Svg>
                </span>
              ) : flash.kind === 'back' || flash.kind === 'fwd' ? (
                <span className="reel-flash-disc arrows" aria-hidden="true">
                  {flash.kind === 'back' ? '‹‹‹' : '›››'}
                </span>
              ) : null}
              {flash.text && <span className="reel-flash-text">{flash.text}</span>}
            </span>
          )}
        </div>
      )}
      <div ref={ref} className={`reel-ctl ${full ? 'full' : 'compact'}`} role="group" aria-label="Showreel controls">
        {full && (
          <div
            ref={bar}
            className="reel-track"
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={100}
            tabIndex={0}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              seekFrom(e)
            }}
            onPointerMove={(e) => {
              hoverTime(e)
              if (e.buttons & 1) seekFrom(e)
            }}
          >
            <span className="reel-track-buf" />
            <span className="reel-track-fill" />
            <span className="reel-track-knob" />
            <span className="reel-tip" ref={tip} />
          </div>
        )}
        <div className="reel-row">
          <button type="button" onClick={full ? act.prev : () => reel.prev()} aria-label="Previous showreel" title={full ? 'Previous (Shift+P)' : undefined}>
            <Svg>{Icon.prev}</Svg>
          </button>
          <button type="button" className="reel-play" onClick={() => reel.togglePlay()} aria-label={state.paused ? 'Play' : 'Pause'} title={full ? (state.paused ? 'Play (K)' : 'Pause (K)') : undefined}>
            <Svg>{state.paused ? Icon.play : Icon.pause}</Svg>
          </button>
          <button type="button" onClick={full ? act.next : () => reel.next()} aria-label="Next showreel" title={full ? 'Next (Shift+N)' : undefined}>
            <Svg>{Icon.next}</Svg>
          </button>
          {full ? (
            <>
              <span className="reel-sound">
                <button type="button" onClick={() => reel.toggleSound()} aria-label={state.muted ? 'Turn sound on' : 'Mute'} title={state.muted ? 'Unmute (M)' : 'Mute (M)'}>
                  <Svg>{state.muted ? Icon.muted : Icon.sound}</Svg>
                </button>
                <input
                  className="reel-vol"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={state.muted ? 0 : state.volume}
                  onChange={(e) => reel.setVolume(Number(e.target.value))}
                  aria-label="Volume"
                />
              </span>
              <span className="reel-time" ref={time} />
              <span className="reel-label">
                <span className="reel-dot" aria-hidden="true" />
                Showreel <span className="reel-count">{state.index + 1}/{state.count}</span>
              </span>
              <span className="reel-right">
                <span className="reel-speed">
                  <button
                    type="button"
                    className="reel-speed-btn"
                    onClick={() => setSpeedOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={speedOpen}
                    aria-label={`Playback speed, ${state.rate === 1 ? 'normal' : `${state.rate}x`}`}
                    title="Playback speed (< >)"
                  >
                    {state.rate === 1 ? '1x' : `${state.rate}x`}
                  </button>
                  {speedOpen && (
                    <span className="reel-speed-menu" role="menu">
                      {RATES.map((r) => (
                        <button
                          key={r}
                          type="button"
                          role="menuitemradio"
                          aria-checked={state.rate === r}
                          className={state.rate === r ? 'on' : ''}
                          onClick={() => {
                            act.rate(r)
                            setSpeedOpen(false)
                          }}
                        >
                          {r === 1 ? 'Normal' : `${r}x`}
                        </button>
                      ))}
                    </span>
                  )}
                </span>
                <button type="button" onClick={toggleFullscreen} aria-label={isFs ? 'Exit full screen' : 'Full screen'} title={isFs ? 'Exit full screen (F)' : 'Full screen (F)'}>
                  <Svg>{isFs ? Icon.unfull : Icon.full}</Svg>
                </button>
              </span>
            </>
          ) : (
            <>
              <span className="reel-label">
                <span className="reel-dot" aria-hidden="true" />
                Showreel <span className="reel-count">{state.index + 1}/{state.count}</span>
              </span>
              <span className="reel-sound">
                <button type="button" onClick={() => reel.toggleSound()} aria-label={state.muted ? 'Turn sound on' : 'Mute'}>
                  <Svg>{state.muted ? Icon.muted : Icon.sound}</Svg>
                </button>
              </span>
            </>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * The showreel growing out of the iPad screen to fill the window. Same <video> as the one on the iPad,
 * so it carries on without a cut. It starts once the iPad has reached the middle of the view.
 */
export function ReelCover() {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const video = showreel().video
    video.className = 'reel-cover-video'
    el.appendChild(video)
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const s = useStore.getState()
      const r = ipadFly.rect
      const raw = (ipadFly.p - FLY_SHARE * 0.94) / (1 - FLY_SHARE * 0.94)
      const k = Math.min(1, Math.max(0, raw))
      if (k <= 0 || !r.ok || s.dispersing) {
        if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden'
        return
      }
      const e = k * k * (3 - 2 * k)
      const W = window.innerWidth
      const H = window.innerHeight
      el.style.visibility = 'visible'
      el.style.left = `${(r.x * (1 - e)).toFixed(1)}px`
      el.style.top = `${(r.y * (1 - e)).toFixed(1)}px`
      el.style.width = `${(r.w + (W - r.w) * e).toFixed(1)}px`
      el.style.height = `${(r.h + (H - r.h) * e).toFixed(1)}px`
      el.style.borderRadius = `${(14 * (1 - e)).toFixed(1)}px`
      el.style.opacity = `${Math.min(1, k * 8).toFixed(3)}`
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      if (video.parentElement === el) el.removeChild(video)
    }
  }, [])
  return <div ref={box} className="reel-cover" aria-hidden="true" />
}
