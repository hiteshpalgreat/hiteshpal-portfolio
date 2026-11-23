import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { scrollToY } from '../../smoothScroll'
import { SELECTED, SELECTED_ARCHIVE, SELECTED_INTRO, SELECTED_LABEL } from './selectedConfig'
import './selected.css'

/**
 * Selected work: one long editorial strip, like a gallery wall. A thin line runs through the middle; titles
 * sit across it, pictures float above or below it, and outlined pills rest on it.
 *
 * The section pins for a while as the page scrolls, like the others, but scrolling never moves the strip. Visitors who want to see more grab it and drag (mouse or touch),
 * and it carries on with a little momentum and eases back at either end. Trackpads can also swipe it
 * sideways; arrow keys step through it when it has focus. The slider underneath shows how far along you
 * are, and can be dragged or clicked too.
 */
const ARROW = (
  <svg className="sel-ico" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 12 12 4M5.5 4H12v6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function SelectedWork() {
  const reduced = useStore((s) => s.reducedMotion)
  const section = useRef<HTMLElement>(null)
  const view = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const badge = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0) // which project is in the middle (0 = the intro)
  const [seen, setSeen] = useState(false)
  // shared with the handlers below
  const api = useRef<{ glideTo: (x: number) => void; stepBy: (n: number) => void; toFraction: (f: number) => void } | null>(null)

  useEffect(() => {
    const vw = view.current
    const tr = track.current
    if (!vw || !tr) return
    const panels = Array.from(tr.querySelectorAll<HTMLElement>('.sel-panel'))
    let x = 0 // track position (px, 0 .. -max)
    let v = 0 // px/s
    let max = 0
    let target: number | null = null // gliding to here (keys, slider)
    let drag: { id: number; startX: number; startPos: number; moved: boolean; samples: { t: number; x: number }[] } | null = null
    let suppressClick = false
    let raf = 0
    let last = performance.now()
    let running = false
    let visible = false
    let geo: { left: number; width: number }[] = []
    let entered = false
    // the first panels slide in from the right, one after another (script-driven so it always plays)
    const enter = () => {
      const first = panels.slice(0, 3)
      if (reduced) return setSeen(true)
      first.forEach((p) => {
        p.style.opacity = '0'
        p.style.transform = 'translateX(8vw)'
      })
      setSeen(true)
      const t0 = performance.now()
      const ease = (t: number) => 1 - Math.pow(1 - t, 3)
      const step = () => {
        let done = true
        first.forEach((p, i) => {
          const t = Math.min(1, Math.max(0, (performance.now() - t0 - i * 110) / 1000))
          if (t < 1) done = false
          const e = ease(t)
          p.style.opacity = String(Math.min(1, t * 1.6))
          p.style.transform = t >= 1 ? '' : `translateX(${((1 - e) * 8).toFixed(3)}vw)`
        })
        if (!done) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
      // never leave them hidden, whatever happens to the frames
      window.setTimeout(() => first.forEach((p) => ((p.style.opacity = ''), (p.style.transform = ''))), 2000)
    }

    const measure = () => {
      max = Math.max(0, tr.scrollWidth - vw.clientWidth)
      geo = panels.map((p) => ({ left: p.offsetLeft, width: p.offsetWidth }))
      x = Math.max(-max, Math.min(0, x))
    }
    // past either end it gives a little, like pulling elastic
    const rubber = (pos: number) => {
      if (pos > 0) return pos * 0.35
      if (pos < -max) return -max + (pos + max) * 0.35
      return pos
    }

    const render = () => {
      tr.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`
      const p = max > 0 ? Math.min(1, Math.max(0, -x / max)) : 0
      bar.current?.style.setProperty('--p', p.toFixed(4))
      bar.current?.setAttribute('aria-valuenow', String(Math.round(p * 100)))
      // depth: each panel's distance from the middle of the view moves its picture and title a touch
      const mid = vw.clientWidth / 2
      let best = 0
      let bestD = Infinity
      geo.forEach((g, i) => {
        const c = g.left + g.width / 2 + x
        const d = (c - mid) / vw.clientWidth
        if (!reduced) panels[i].style.setProperty('--d', Math.max(-1.5, Math.min(1.5, d)).toFixed(3))
        if (Math.abs(d) < bestD) {
          bestD = Math.abs(d)
          best = i
        }
      })
      setAt(Math.min(SELECTED.length, best)) // 0 intro, 1..n projects, archive counts as the last
    }

    const tick = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!drag) {
        if (target != null) {
          x += (target - x) * (1 - Math.exp(-dt * (reduced ? 30 : 7)))
          if (Math.abs(target - x) < 0.4) {
            x = target
            target = null
          }
        } else if (x > 0 || x < -max) {
          // spring back from past the ends
          const edge = x > 0 ? 0 : -max
          v += (edge - x) * 120 * dt
          v *= Math.exp(-dt * 14)
          x += v * dt
          if (Math.abs(edge - x) < 0.5 && Math.abs(v) < 20) {
            x = edge
            v = 0
          }
        } else if (Math.abs(v) > 4) {
          // carry on with momentum
          x += v * dt
          v *= Math.exp(-dt * (reduced ? 20 : 3.6))
        } else v = 0
      }
      render()
      const settled = !drag && target == null && v === 0 && x <= 0 && x >= -max
      if (settled) {
        running = false
        return
      }
      raf = requestAnimationFrame(tick)
    }
    const wake = () => {
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(tick)
    }

    // --- dragging
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      target = null
      v = 0
      drag = { id: e.pointerId, startX: e.clientX, startPos: x, moved: false, samples: [{ t: performance.now(), x: e.clientX }] }
      suppressClick = false
      vw.classList.add('is-down')
      wake()
    }
    const onMove = (e: PointerEvent) => {
      // the "Drag" badge follows the cursor over the strip
      if (badge.current && e.pointerType === 'mouse') {
        const r = vw.getBoundingClientRect()
        badge.current.style.transform = `translate3d(${e.clientX - r.left}px, ${e.clientY - r.top}px, 0)`
      }
      if (!drag || e.pointerId !== drag.id) return
      const dx = e.clientX - drag.startX
      if (!drag.moved && Math.abs(dx) > 6) {
        drag.moved = true
        suppressClick = true
        vw.classList.add('is-dragging')
      }
      if (!drag.moved) return
      x = rubber(drag.startPos + dx)
      const now = performance.now()
      drag.samples.push({ t: now, x: e.clientX })
      while (drag.samples.length > 2 && now - drag.samples[0].t > 90) drag.samples.shift()
    }
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const s = drag.samples
      if (drag.moved && s.length > 1) {
        const a = s[0]
        const b = s[s.length - 1]
        const dt = Math.max(16, b.t - a.t) / 1000
        v = Math.max(-5000, Math.min(5000, (b.x - a.x) / dt))
      }
      drag = null
      vw.classList.remove('is-down', 'is-dragging')
      wake()
    }
    // a drag that started on a link mustn't open it
    const onClick = (e: MouseEvent) => {
      if (suppressClick) {
        e.preventDefault()
        e.stopPropagation()
        suppressClick = false
      }
    }
    // trackpads swiping sideways; plain vertical scrolling is left to the page
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 1) return
      e.preventDefault()
      const base = target ?? x
      target = Math.max(-max, Math.min(0, base - e.deltaX))
      v = 0
      wake()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') api.current?.stepBy(1)
      else if (e.key === 'ArrowLeft') api.current?.stepBy(-1)
      else if (e.key === 'Home') api.current?.glideTo(0)
      else if (e.key === 'End') api.current?.glideTo(-max)
      else return
      e.preventDefault()
    }

    api.current = {
      glideTo: (to: number) => {
        target = Math.max(-max, Math.min(0, to))
        v = 0
        wake()
      },
      // to the next or previous panel's left edge (with a little breathing room)
      stepBy: (n: number) => {
        const pad = vw.clientWidth * 0.06
        const now = -(target ?? x)
        const edges = geo.map((g) => Math.max(0, Math.min(max, g.left - pad)))
        let i = edges.findIndex((e) => e > now + 4)
        if (n < 0) {
          i = -1
          edges.forEach((e, k) => {
            if (e < now - 4) i = k
          })
          if (i < 0) i = 0
        } else if (i < 0) i = edges.length - 1
        api.current?.glideTo(-edges[i])
      },
      toFraction: (f: number) => api.current?.glideTo(-Math.max(0, Math.min(1, f)) * max),
    }

    vw.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    vw.addEventListener('click', onClick, true)
    vw.addEventListener('wheel', onWheel, { passive: false })
    vw.addEventListener('keydown', onKey)
    const ro = new ResizeObserver(() => {
      measure()
      render()
    })
    ro.observe(vw)
    ro.observe(tr)
    // pictures load in late and change widths
    tr.querySelectorAll('img').forEach((im) => im.addEventListener('load', () => (measure(), render()), { once: true }))
    const io = new IntersectionObserver(
      ([en]) => {
        visible = en.isIntersecting
        if (visible && !entered) {
          entered = true
          enter()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(section.current!)
    measure()
    render()
    return () => {
      cancelAnimationFrame(raf)
      vw.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      vw.removeEventListener('click', onClick, true)
      vw.removeEventListener('wheel', onWheel)
      vw.removeEventListener('keydown', onKey)
      ro.disconnect()
      io.disconnect()
      void visible
    }
  }, [reduced])

  // The section is exactly one screen tall. When the page comes to rest with it mostly in view but a little
  // high or low, it eases the last bit so the whole strip sits squarely on the screen.
  useEffect(() => {
    const el = section.current
    if (!el) return
    let idle = 0
    let snapping = false
    let touching = false
    const settle = () => {
      if (touching || snapping) return
      const s = useStore.getState()
      if (s.focus || s.view || s.gallery || s.codeLab) return
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      // the stage is pinned while the section's top is above the screen and its bottom below it; outside
      // that, if it's close (coming in from above, or leaving from below), ease it the rest of the way
      let by = 0
      if (r.top > 3 && r.top < vh * 0.4) by = r.top // arriving from above
      else if (r.bottom < vh - 3 && r.bottom > vh * 0.6) by = r.bottom - vh // arriving from below
      if (!by) return
      snapping = true
      scrollToY(window.scrollY + by, s.reducedMotion, 0.75)
      window.setTimeout(() => (snapping = false), 900)
    }
    const onScroll = () => {
      window.clearTimeout(idle)
      idle = window.setTimeout(settle, 160)
    }
    const down = () => (touching = true)
    const up = () => {
      touching = false
      onScroll()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('touchstart', down, { passive: true })
    window.addEventListener('touchend', up, { passive: true })
    return () => {
      window.clearTimeout(idle)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('touchstart', down)
      window.removeEventListener('touchend', up)
    }
  }, [])

  // the slider: click or drag along it
  const fromBar = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    api.current?.toFraction((e.clientX - r.left) / r.width)
  }
  const total = SELECTED.length

  return (
    <section className={`sel ${seen ? 'is-seen' : ''}`} id="work" ref={section} aria-labelledby="sel-title">
      {/* the section is taller than the screen; this stage stays pinned while the page scrolls past it */}
      <div className="sel-stage">
      <p className="sel-note">
        <span>({SELECTED_LABEL.index})</span> {SELECTED_LABEL.text}
      </p>

      <div
        className="sel-view"
        ref={view}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Selected projects. Drag sideways, or use the arrow keys."
      >
        <span className="sel-line" aria-hidden="true" />
        <div className="sel-track" ref={track}>
          {/* the opening panel */}
          <div className="sel-panel sel-intro">
            <span className="sel-arc" aria-hidden="true" />
            <p className="sel-lead">{SELECTED_INTRO.lead}</p>
            <h2 className="sel-title sel-title-xl" id="sel-title">
              <span>{SELECTED_INTRO.title[0]}</span> <span>{SELECTED_INTRO.title[1]}</span>
            </h2>
            <span className="sel-pill sel-pill-hint" aria-hidden="true">
              <span className="sel-hint-arrows">←</span> {SELECTED_INTRO.hint} <span className="sel-hint-arrows">→</span>
            </span>
          </div>

          {SELECTED.map((p, i) => (
            <article className={`sel-panel sel-proj sel-${p.layout}`} key={p.title} aria-label={p.title}>
              <span className="sel-arc" aria-hidden="true" />
              <a className="sel-media" href={p.href} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" draggable={false}>
                <img src={p.img} alt="" loading="lazy" draggable={false} />
              </a>
              <div className="sel-meta">
                <span className="sel-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="sel-kicker">{p.kicker}</span>
              </div>
              <h3 className="sel-title">{p.title}</h3>
              <p className="sel-blurb">{p.blurb}</p>
              <a className="sel-pill" href={p.href} target="_blank" rel="noopener noreferrer" draggable={false}>
                {p.linkLabel}
                {ARROW}
              </a>
            </article>
          ))}

          {/* the closing panel */}
          <div className="sel-panel sel-end">
            <span className="sel-arc" aria-hidden="true" />
            <h3 className="sel-title sel-title-xl">
              <span>{SELECTED_ARCHIVE.title[0]}</span> <span>{SELECTED_ARCHIVE.title[1]}</span>
            </h3>
            <p className="sel-lead">{SELECTED_ARCHIVE.lead}</p>
            <a className="sel-pill" href={SELECTED_ARCHIVE.href} target="_blank" rel="noopener noreferrer" draggable={false}>
              {SELECTED_ARCHIVE.label}
              {ARROW}
            </a>
          </div>
        </div>
        <div className="sel-badge" ref={badge} aria-hidden="true">
          <span>
            {/* tail-less chevrons either side: it moves both ways */}
            <svg className="sel-chev l" viewBox="0 0 10 16" aria-hidden="true">
              <path d="M7.5 2 2 8l5.5 6" />
            </svg>
            Drag
            <svg className="sel-chev r" viewBox="0 0 10 16" aria-hidden="true">
              <path d="M2.5 2 8 8l-5.5 6" />
            </svg>
          </span>
        </div>
      </div>

      {/* how far along the strip you are */}
      <div className="sel-progress">
        <span className="sel-count">
          <b>{String(Math.max(1, at)).padStart(2, '0')}</b>
        </span>
        <div
          className="sel-bar"
          ref={bar}
          role="slider"
          tabIndex={0}
          aria-label="Position along the selected projects"
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            fromBar(e)
          }}
          onPointerMove={(e) => {
            if (e.buttons & 1) fromBar(e)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') api.current?.stepBy(1)
            else if (e.key === 'ArrowLeft') api.current?.stepBy(-1)
            else return
            e.preventDefault()
          }}
        >
          <span className="sel-bar-fill" />
          <span className="sel-bar-thumb" />
        </div>
        <span className="sel-count">{String(total).padStart(2, '0')}</span>
      </div>
      </div>
    </section>
  )
}
