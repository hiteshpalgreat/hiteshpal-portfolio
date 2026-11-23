import { OTTRLY_PATHS, OTTRLY_VIEWBOX } from '../clients/ottrlyMark'

/**
 * A globe of dots rising from the bottom edge, with the Ottrly mark drawn in denser dots at its heart
 * (after the footer of 1centre.com).
 *
 * How it works:
 * - The globe is a few thousand points spread evenly over a sphere (a Fibonacci spiral). It turns
 *   slowly about its vertical axis and is drawn in perspective; dots on the near side are bigger and
 *   brighter, the far side faint, and the rim gets a little extra light so the outline reads.
 * - The mark is the logo rasterised once to an offscreen canvas and sampled on a jittered grid; dots
 *   on its outline are brighter and larger than the fill, so the shape stays crisp. It faces the
 *   viewer, breathes very slightly and drifts against the globe with the pointer (parallax).
 * - The pointer tilts the globe toward itself, lifts the brightness and speeds the spin a little,
 *   and pushes every dot near it away. Each dot has its own offset and velocity, pulled back home by
 *   a spring and damped, so the dots part around the cursor and flow back after it.
 * - Drawing is plain 2D canvas: the dots are sorted into 16 opacity buckets per colour and each
 *   bucket is filled as one path, a few dozen fills per frame however many dots there are.
 * - It only runs while on screen, and draws a single still frame for reduced motion.
 */

export type GlobeTone = 'pink' | 'blue' | 'white'

const TONES: Record<GlobeTone, string[]> = {
  // white for the globe, the brand pink and a pale pink mixed in
  pink: ['255, 255, 255', '255, 89, 139', '255, 196, 214'],
  blue: ['255, 255, 255', '74, 176, 255', '170, 218, 255'],
  white: ['255, 255, 255'],
}
const LEVELS = 16 // opacity buckets per colour

export type GlobeOptions = {
  tone?: GlobeTone
  /** how much of the globe shows above the bottom edge, 0..1 (fraction of its radius above centre) */
  rise?: number
}

/** Points evenly over a unit sphere. */
function fibonacciSphere(n: number) {
  const out = new Float32Array(n * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const a = golden * i
    out[i * 3] = Math.cos(a) * r
    out[i * 3 + 1] = y
    out[i * 3 + 2] = Math.sin(a) * r
  }
  return out
}

/**
 * The Ottrly mark as dots: x, y in -1..1 across its width (y scaled by the mark's aspect), plus
 * whether each dot lies on the outline.
 */
function markDots(step: number) {
  const [, , vbW, vbH] = OTTRLY_VIEWBOX.split(/\s+/).map(Number)
  const W = 640
  const H = Math.round((W * vbH) / vbW)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return { xy: new Float32Array(0), edge: new Uint8Array(0) }
  g.scale(W / vbW, H / vbH)
  g.fillStyle = '#000'
  for (const d of OTTRLY_PATHS) g.fill(new Path2D(d))
  const data = g.getImageData(0, 0, W, H).data
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && data[(Math.round(y) * W + Math.round(x)) * 4 + 3] > 128
  const xs: number[] = []
  const ys: number[] = []
  const edges: number[] = []
  const e = Math.max(2, step * 0.9) // how far to look for the outline
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (!inside(x, y)) continue
      const edge = !inside(x - e, y) || !inside(x + e, y) || !inside(x, y - e) || !inside(x, y + e)
      // a little jitter so the grid doesn't show
      xs.push(((x + (Math.random() - 0.5) * step * 0.7) / W) * 2 - 1)
      ys.push(((y + (Math.random() - 0.5) * step * 0.7) / W) * 2 - H / W)
      edges.push(edge ? 1 : 0)
    }
  }
  const xy = new Float32Array(xs.length * 2)
  for (let i = 0; i < xs.length; i++) {
    xy[i * 2] = xs[i]
    xy[i * 2 + 1] = ys[i]
  }
  return { xy, edge: Uint8Array.from(edges) }
}

export class ParticleGlobe {
  private canvas: HTMLCanvasElement
  private g: CanvasRenderingContext2D
  private colors: string[]
  private rise: number
  private calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  private W = 0
  private H = 0
  private compact = false
  private sphere = new Float32Array(0)
  private nSphere = 0
  private mark = { xy: new Float32Array(0), edge: new Uint8Array(0) }
  private nMark = 0
  // per dot: offset from home and velocity (pushed by the pointer, sprung back)
  private ox = new Float32Array(0)
  private oy = new Float32Array(0)
  private vx = new Float32Array(0)
  private vy = new Float32Array(0)
  private buckets: Float32Array[] = []
  private counts = new Int32Array(0)
  private pushR = 220

  // motion state
  private spin = 0
  private tilt = 0
  private tiltTo = 0
  private turn = 0
  private turnTo = 0
  private energy = 0
  private energyTo = 0
  private px = -1e4
  private py = -1e4
  private pointerIn = false

  private raf = 0
  private last = 0
  private running = false
  private io: IntersectionObserver
  private ro: ResizeObserver

  constructor(private host: HTMLElement, opts: GlobeOptions = {}) {
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'pg-canvas'
    this.canvas.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:pan-y'
    host.appendChild(this.canvas)
    this.g = this.canvas.getContext('2d')!
    this.colors = TONES[opts.tone ?? 'pink']
    this.rise = opts.rise ?? 0.42
    this.counts = new Int32Array(LEVELS * this.colors.length)

    this.resize()
    this.ro = new ResizeObserver(() => {
      this.resize()
      if (!this.running) this.draw(0)
    })
    this.ro.observe(host)
    this.io = new IntersectionObserver(([e]) => (e.isIntersecting ? this.start() : this.stop()), { threshold: 0.02 })
    if (this.calm) this.draw(0)
    else {
      this.io.observe(host)
      host.addEventListener('pointermove', this.onMove)
      host.addEventListener('pointerleave', this.onLeave)
    }
  }

  setTone(tone: GlobeTone) {
    this.colors = TONES[tone]
    this.counts = new Int32Array(LEVELS * this.colors.length)
    this.allocBuckets()
    if (!this.running) this.draw(0)
  }

  /** globe radius, centre height and the mark's half width, for the current size */
  private layout() {
    const rise = this.compact ? 0.5 : this.rise
    const r = Math.min(this.W * 0.46, this.H / (1 + rise))
    const cy = this.H - rise * r
    const markR = Math.min(r * 0.62, this.W * 0.42)
    return { r, cy, markR }
  }

  private resize() {
    const rect = this.host.getBoundingClientRect()
    this.W = rect.width
    this.H = rect.height
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(this.W * dpr)
    this.canvas.height = Math.round(this.H * dpr)
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.compact = this.W < 640

    // fewer dots on small screens; enough that the globe reads as a surface on large ones
    this.nSphere = this.compact
      ? Math.round(Math.max(520, this.W * 1.7))
      : Math.round(Math.min(4200, Math.max(1600, this.W * 2.6)))
    this.sphere = fibonacciSphere(this.nSphere)
    this.pushR = Math.min(280, Math.max(this.compact ? 90 : 150, this.W * 0.17))

    // sample the mark so its dots land about 3 px apart on screen (a bit sparser on phones)
    const { markR } = this.layout()
    const spacing = this.compact ? 3.6 : 3
    const step = Math.max(3, Math.round((640 * spacing) / (2 * markR)))
    this.mark = markDots(step)
    this.nMark = this.mark.xy.length / 2

    const n = this.nSphere + this.nMark
    this.ox = new Float32Array(n)
    this.oy = new Float32Array(n)
    this.vx = new Float32Array(n)
    this.vy = new Float32Array(n)
    this.allocBuckets()
  }

  private allocBuckets() {
    const n = this.nSphere + this.nMark
    this.buckets = []
    for (let i = 0; i < LEVELS * this.colors.length; i++) this.buckets.push(new Float32Array(n * 3))
  }

  private onMove = (e: PointerEvent) => {
    const r = this.host.getBoundingClientRect()
    this.px = e.clientX - r.left
    this.py = e.clientY - r.top
    this.pointerIn = true
    this.tiltTo = -(this.py / r.height - 0.5) * 0.45
    this.turnTo = (this.px / r.width - 0.5) * 0.8
    this.energyTo = 1
  }

  private onLeave = () => {
    this.pointerIn = false
    this.px = this.py = -1e4
    this.tiltTo = this.turnTo = this.energyTo = 0
  }

  private start() {
    if (this.running) return
    this.running = true
    this.last = 0
    this.raf = requestAnimationFrame(this.loop)
  }

  private stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  private loop = (now: number) => {
    if (!this.running) return
    // in 60 fps frames, so the feel is the same at any refresh rate
    const k = this.last ? Math.min((now - this.last) / 16.67, 3) : 1
    this.last = now
    this.spin += 0.0019 * k * (1 + 0.5 * this.energy)
    this.tilt += (this.tiltTo - this.tilt) * 0.05 * k
    this.turn += (this.turnTo - this.turn) * 0.045 * k
    this.energy += (this.energyTo - this.energy) * 0.06 * k
    this.draw(k)
    this.raf = requestAnimationFrame(this.loop)
  }

  /** push a dot away from the pointer, spring it home, then move it */
  private physics(i: number, x: number, y: number, k: number) {
    if (this.pointerIn) {
      const dx = x + this.ox[i] - this.px
      const dy = y + this.oy[i] - this.py
      const d2 = dx * dx + dy * dy
      const R = this.pushR
      if (d2 < R * R && d2 > 0.01) {
        const d = Math.sqrt(d2)
        const f = 1 - d / R
        const s = ((f * f * 8.3) / d) * k
        this.vx[i] += dx * s
        this.vy[i] += dy * s
      }
    }
    this.vx[i] = (this.vx[i] - this.ox[i] * 0.075 * k) * 0.84
    this.vy[i] = (this.vy[i] - this.oy[i] * 0.075 * k) * 0.84
    this.ox[i] += this.vx[i] * k
    this.oy[i] += this.vy[i] * k
  }

  private put(alpha: number, x: number, y: number, size: number, color: number) {
    const level = Math.min(LEVELS - 1, Math.max(0, Math.round(alpha * (LEVELS - 1))))
    const b = color * LEVELS + level
    const o = this.counts[b] * 3
    const arr = this.buckets[b]
    arr[o] = x
    arr[o + 1] = y
    arr[o + 2] = size
    this.counts[b]++
  }

  private draw(k: number) {
    const { W, H, g } = this
    g.clearRect(0, 0, W, H)
    this.counts.fill(0)
    const { r, cy, markR } = this.layout()
    const cx = W / 2
    const accent = this.colors.length > 1
    const big = this.compact ? 1.35 : 1

    // the globe
    const sa = Math.sin(this.spin + this.turn)
    const ca = Math.cos(this.spin + this.turn)
    const st = Math.sin(this.tilt)
    const ct = Math.cos(this.tilt)
    const s = this.sphere
    for (let i = 0; i < this.nSphere; i++) {
      const x0 = s[i * 3]
      const y0 = s[i * 3 + 1]
      const z0 = s[i * 3 + 2]
      // turn about the vertical axis, then tip toward the pointer
      const x1 = x0 * ca + z0 * sa
      const z1 = z0 * ca - x0 * sa
      const y2 = y0 * ct - z1 * st
      const z2 = z1 * ct + y0 * st // +1 nearest the viewer
      const persp = 1 / (1.3 - 0.3 * z2)
      const x = cx + x1 * r * persp
      const y = cy + y2 * r * persp
      if (x < -24 || x > W + 24 || y < -24 || y > H + 24) continue
      this.physics(i, x, y, k)
      const near = (z2 + 1) / 2
      const rim = 1 - Math.abs(z2)
      const a = (0.035 + 0.16 * near + rim * rim * 0.06) * (1 + 0.45 * this.energy) * big
      const size = this.compact ? 0.7 + 1.5 * near : 0.9 + 1.9 * near
      // one dot in three takes the accent colour
      this.put(Math.min(accent ? a * 1.25 : a, accent ? 0.6 : 0.5), x + this.ox[i], y + this.oy[i], size, accent && i % 3 === 0 ? 1 : 0)
    }

    // the mark, facing the viewer, at the globe's centre
    const breathe = 1 + 0.012 * Math.sin(this.spin * 2.2)
    const mx = cx + this.turn * 18
    const my = cy - this.tilt * 26
    const m = this.mark
    for (let j = 0; j < this.nMark; j++) {
      const i = this.nSphere + j
      const x = mx + m.xy[j * 2] * markR * breathe
      const y = my + m.xy[j * 2 + 1] * markR * breathe
      if (y > H + 12) continue
      this.physics(i, x, y, k)
      const edge = m.edge[j] === 1
      const a = (edge ? 0.86 : this.compact ? 0.62 : 0.5) * (1 + 0.18 * this.energy)
      const size = this.compact ? (edge ? 1.45 : 1.15) : edge ? 1.9 : 1.5
      // the outline in the accent, the fill in the pale tint
      this.put(Math.min(a, 1), x + this.ox[i], y + this.oy[i], size, accent ? (edge ? 1 : 2) : 0)
    }

    // one fill per colour and opacity
    for (let b = 0; b < this.buckets.length; b++) {
      const n = this.counts[b]
      if (!n) continue
      const color = this.colors[Math.floor(b / LEVELS)]
      g.fillStyle = `rgba(${color}, ${((b % LEVELS) / (LEVELS - 1)).toFixed(3)})`
      const arr = this.buckets[b]
      g.beginPath()
      for (let q = 0; q < n; q++) {
        const x = arr[q * 3]
        const y = arr[q * 3 + 1]
        const rr = arr[q * 3 + 2]
        g.moveTo(x + rr, y)
        g.arc(x, y, rr, 0, Math.PI * 2)
      }
      g.fill()
    }
  }

  destroy() {
    this.stop()
    this.io.disconnect()
    this.ro.disconnect()
    this.host.removeEventListener('pointermove', this.onMove)
    this.host.removeEventListener('pointerleave', this.onLeave)
    this.canvas.remove()
  }
}
