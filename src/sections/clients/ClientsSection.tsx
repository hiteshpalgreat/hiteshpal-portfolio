import { useEffect, useMemo, useRef } from 'react'
import { CLIENT_LOGOS, CLIENTS_HEADLINE, CLIENTS_LABEL, type ClientLogo } from './clientsConfig'
import { OTTRLY_NOSE, OTTRLY_PATHS, OTTRLY_VIEWBOX } from './ottrlyMark'
import { ABOUT_SCROLL } from '../about/aboutConfig'
import './clients.css'

/**
 * Clients section, entered through the Ottrly mark:
 *  1. while the About stage is still pinned, the otter face draws itself on top of it as a wine outline
 *     (this section is pulled up over the end of the About section, see ABOUT_SCROLL),
 *  2. fills in,
 *  3. the view dives into its nose until the wine covers the screen and becomes this section's
 *     background (the same wine and burgundy glow as the Work section that follows),
 *  4. the headline comes in and three curved rows of client logos sweep in along a cylinder:
 *     top row from the right, middle row from the left, bottom row from the right. They arrive fast,
 *     ease down, then keep drifting slowly in the same direction.
 * Steps 1 to 3 follow the scroll position exactly (drawn on a canvas, so scrolling back is clean).
 */

// scroll budget in screen heights (while the stage is pinned)
const DRAW = [0.05, 0.95]
const FILL = [0.95, 1.35]
const ZOOM = [1.35, 2.35]
// the headline and logos only come in once the dive is complete and the mark has gone
const REVEAL = [2.45, 2.95]
const TOTAL = 4.2

const VB = OTTRLY_VIEWBOX.split(' ').map(Number)
const MAX_ZOOM = 90
// With "difference" blending this warm off-white comes out as the site's dark wine over the pale
// About background and veil, and as a light line wherever it crosses the dark photo.
const MARK_INK = '#dbdedb' // the veil's #f5e8eb minus it gives the wine #1a0a10
// pulled up over the end of the About section so the mark draws on top of it
const OVERLAP = ABOUT_SCROLL.tail + 1 - ABOUT_SCROLL.lead

const clamp = (x: number) => Math.min(1, Math.max(0, x))
const ease = (x: number) => x * x * (3 - 2 * x)
const range = (s: number, [a, b]: number[]) => clamp((s - a) / (b - a))
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -9 * x))

/** dir -1: logos travel right to left; +1: left to right */
const ROWS = [
  { y: 0.62, dir: -1, speed: 0.03, seed: 11 },
  { y: 0.72, dir: 1, speed: 0.024, seed: 23 },
  { y: 0.82, dir: -1, speed: 0.028, seed: 37 },
]
// the rows spin half a turn in: same starting speed as a full turn over 2.2 s, but the fast part is over in half the time
const ENTRY_SECONDS = 1.1
const ENTRY_TURN = Math.PI

/** Small seeded shuffle so every visit gets the same, well-mixed order. */
function shuffled<T>(list: T[], seed: number) {
  const a = [...list]
  let x = seed
  const rnd = () => {
    x = (x * 16807) % 2147483647
    return x / 2147483647
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * One row: every logo once in its own order, plus a few from the middle of that order,
 * so any repeat sits on the far side of the cylinder and never shows twice at once.
 */
function buildRow(seed: number, rowIndex: number) {
  const n = CLIENT_LOGOS.length
  // each row starts from a different third of the list, so the rows show different logos at a time
  const base = shuffled(CLIENT_LOGOS, seed)
  const rotated = base.slice((rowIndex * n) / 3).concat(base.slice(0, (rowIndex * n) / 3))
  const extra = rotated.slice(Math.floor(n * 0.3), Math.floor(n * 0.3) + Math.round(n * 0.43))
  return rotated.concat(extra)
}

export function ClientsSection() {
  const section = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const markCanvas = useRef<HTMLCanvasElement>(null)
  const copy = useRef<HTMLDivElement>(null)
  const band = useRef<HTMLDivElement>(null)
  const glow = useRef<HTMLDivElement>(null)
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const rows = useMemo(() => ROWS.map((r, i) => buildRow(r.seed, i)), [])

  useEffect(() => {
    let raf = 0
    let visible = false
    let s = 0
    let drift = 0
    let entry = 0 // seconds since the rows started coming in
    let entering = false
    let driftAtEntry = 0
    let last = performance.now()
    const items = Array.from(band.current!.querySelectorAll<HTMLElement>('.cl-logo'))

    // the mark as canvas paths, with their lengths for the drawing-on effect
    const paths = OTTRLY_PATHS.map((d) => new Path2D(d))
    const ns = 'http://www.w3.org/2000/svg'
    const probe = document.createElementNS(ns, 'svg')
    probe.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden')
    document.body.appendChild(probe)
    const lengths = OTTRLY_PATHS.map((d) => {
      const p = document.createElementNS(ns, 'path')
      p.setAttribute('d', d)
      probe.appendChild(p)
      return p.getTotalLength()
    })
    probe.remove()

    // The mark is drawn on a canvas inside the About stage (#ab-mark) with "difference" blending, so
    // it can blend with what is underneath: the About photo and words. This section's own stage is a
    // separate layer and cannot blend with them. Falls back to this section's canvas if it is missing.
    const cv = (document.getElementById('ab-mark') as HTMLCanvasElement | null) ?? markCanvas.current!
    const g = cv.getContext('2d')!
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      cv.width = Math.round(cv.clientWidth * dpr)
      cv.height = Math.round(cv.clientHeight * dpr)
    }
    fit()

    const drawMark = (vw: number, vh: number) => {
      const dpr = cv.width / Math.max(1, vw)
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, cv.width, cv.height)
      if (s > ZOOM[1] + 0.05) return
      const draw = ease(range(s, DRAW))
      const fill = ease(range(s, FILL))
      if (draw <= 0) return
      const z = range(s, ZOOM)
      const k = Math.exp(Math.log(MAX_ZOOM) * z * z)
      const W = Math.min(vw * 0.34, 520)
      const H = (W * VB[3]) / VB[2]
      const ny = OTTRLY_NOSE.y / VB[3]
      // the nose: starts where it sits in the centred logo, moves to the middle of the screen as we dive in
      const px = vw / 2 + (OTTRLY_NOSE.x / VB[2] - 0.5) * W
      const py = vh / 2 + (ny - 0.5) * H * (1 - ease(clamp(z * 1.6)))
      const unit = (W / VB[2]) * k // screen px per viewBox unit
      g.setTransform(dpr * unit, 0, 0, dpr * unit, dpr * px, dpr * py)
      g.translate(-OTTRLY_NOSE.x, -OTTRLY_NOSE.y)
      g.lineJoin = 'round'
      g.lineCap = 'round'
      g.lineWidth = 2.6 / unit
      g.fillStyle = MARK_INK
      g.strokeStyle = MARK_INK
      // the outline draws on stroke by stroke at full strength (whiskers a little after the face)
      // and stays until the fill is complete; the fill fades in over it
      paths.forEach((p, i) => {
        const local = clamp(draw * 1.25 - (i >= 3 ? 0.25 : 0))
        if (local > 0 && fill < 1) {
          g.globalAlpha = 1
          g.setLineDash([lengths[i] * local, lengths[i]])
          g.stroke(p)
        }
      })
      g.setLineDash([])
      if (fill > 0) {
        g.globalAlpha = fill
        paths.forEach((p) => g.fill(p))
      }
      g.globalAlpha = 1
    }

    const frame = (now: number) => {
      raf = visible ? requestAnimationFrame(frame) : 0
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!reduced) drift += dt
      const vw = window.innerWidth
      const vh = window.innerHeight

      drawMark(vw, vh)
      const z = range(s, ZOOM)
      stage.current!.classList.toggle('is-on', z > 0.92)
      glow.current!.style.opacity = ease(range(s, [ZOOM[1] - 0.15, REVEAL[1]])).toFixed(3)

      // headline and logo rows
      const on = z > 0.92
      const rv = on ? ease(range(s, REVEAL)) : 0
      const c = copy.current!
      c.style.opacity = rv.toFixed(3)
      c.style.transform = `translate(-50%, 0) translateY(${((1 - rv) * 40).toFixed(1)}px)`

      // the rows sweep in once the section is revealed, and reset if you scroll back up
      if (rv > 0.35 && !entering) {
        entering = true
        entry = 0
        driftAtEntry = drift
      } else if (rv < 0.05 && entering) {
        entering = false
        entry = 0
      }
      if (entering) entry += dt
      const arrive = reduced ? 1 : easeOutExpo(clamp(entry / ENTRY_SECONDS))
      band.current!.style.opacity = entering ? '1' : '0'

      if (!entering) return
      const narrow = vw < 720
      const bend = vh * (narrow ? 0.07 : 0.12) // how much the rows lift toward the sides
      // logo height at the front; phones get a bit more so the marks stay readable
      const lh = narrow ? Math.min(40, Math.max(32, vw * 0.09)) : Math.min(38, Math.max(24, vh * 0.034))
      const maxW = lh * 2.8 // very wide wordmarks are shown a little smaller
      let idx = 0
      rows.forEach((list, r) => {
        const row = ROWS[r]
        const minGap = lh * 1.4
        let ws = list.map((l: ClientLogo) => Math.min(lh * l.ratio, maxW))
        let total = ws.reduce((a, w) => a + w, 0)
        // cylinder radius: small enough that the rows visibly wrap around. On a phone the screen is
        // too narrow to fit a whole row around it, so the cylinder grows (and reaches past the edges)
        // instead of the logos shrinking to specks
        const R = Math.max(vw * 0.56, narrow ? (total + minGap * list.length) / (Math.PI * 2) : 0)
        const circ = Math.PI * 2 * R
        const fitK = (circ - minGap * list.length) / total
        if (fitK < 1) {
          ws = ws.map((w) => w * fitK)
          total *= fitK
        }
        const gap = (circ - total) / list.length
        // arrival: the ring spins half a turn in, fast at first and easing out, then keeps drifting
        // the same way. A logo only shows once it has come round past the row's entry side
        // (the right for the top and bottom rows, the left for the middle one), so each row fills in
        // from that side and completes the curve to the other.
        const TAU = Math.PI * 2
        const away = (1 - arrive) * ENTRY_TURN
        const moved = (drift - driftAtEntry) * row.speed
        const turn = row.dir * (moved - away)
        const travelled = ENTRY_TURN - away + moved
        const edge = row.dir < 0 ? Math.PI / 2 : -Math.PI / 2
        let acc = 0
        for (let i = 0; i < list.length; i++) {
          const el = items[idx++]
          const w = ws[i]
          const base = (acc + w / 2) / R
          acc += w + gap
          // how far this logo has to travel, from where it starts, before it reaches the entry side
          const from = base - row.dir * ENTRY_TURN
          const need = ((((row.dir < 0 ? from - edge : edge - from) % TAU) + TAU) % TAU)
          let a = base + turn
          a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI // -pi..pi
          const cos = Math.cos(a)
          if (cos < 0.08 || travelled < need) {
            el.style.visibility = 'hidden'
            continue
          }
          el.style.visibility = 'visible'
          const x = vw / 2 + R * Math.sin(a)
          const y = vh * row.y - bend * (1 - cos)
          const sc = 0.55 + 0.45 * cos // smaller toward the sides, but always facing straight
          const h = w / list[i].ratio
          el.style.width = `${w.toFixed(1)}px`
          el.style.height = `${h.toFixed(1)}px`
          el.style.opacity = clamp((cos - 0.08) / 0.4).toFixed(3)
          el.style.transform = `translate(${(x - w / 2).toFixed(1)}px, ${(y - h / 2).toFixed(1)}px) scale(${sc.toFixed(3)})`
        }
      })
    }

    const start = () => {
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) start()
    })
    io.observe(section.current!)
    const readScroll = () => {
      s = Math.max(0, -section.current!.getBoundingClientRect().top / window.innerHeight)
    }
    const onScroll = () => {
      readScroll()
      if (visible) start()
    }
    const onResize = () => {
      fit()
      onScroll()
    }
    readScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [rows, reduced])

  return (
    <section className="clients" ref={section} aria-labelledby="clients-title" style={{ height: `${(TOTAL + 1) * 100}vh`, marginTop: `${-OVERLAP * 100}vh` }}
    >
      <div className="cl-stage" ref={stage}>
        <div className="cl-glow" ref={glow} aria-hidden="true" />
        <canvas className="cl-mark" ref={markCanvas} aria-hidden="true" />

        <div className="cl-copy" ref={copy}>
          <h2 className="cl-number" id="clients-title">
            {CLIENTS_HEADLINE.number}
          </h2>
          <p className="cl-line">
            {CLIENTS_HEADLINE.line1}
            <br />
            {CLIENTS_HEADLINE.line2}
          </p>
        </div>

        <div className="cl-band" ref={band} aria-hidden="true">
          {rows.map((list, r) =>
            list.map((logo, i) => (
              <span
                key={`${r}-${i}`}
                className="cl-logo"
                style={{ WebkitMaskImage: `url("${logo.src}")`, maskImage: `url("${logo.src}")` }}
              />
            )),
          )}
        </div>
        <ul className="cl-sr">
          {CLIENT_LOGOS.map((l) => (
            <li key={l.src}>{l.name}</li>
          ))}
        </ul>

        <p className="cl-note">
          <span>({CLIENTS_LABEL.index})</span> {CLIENTS_LABEL.text}
        </p>
      </div>
    </section>
  )
}
