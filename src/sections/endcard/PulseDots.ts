/**
 * A field of dots, after 1Centre's: brighter in a ring around the middle, with soft waves pulsing out
 * from the centre every couple of seconds. Dots near the pointer swell and brighten.
 * `rgb` is the dots' colour, so the same field works on paper or on the pink of the stamp.
 */
export class PulseDots {
  private g: CanvasRenderingContext2D
  private raf = 0
  private running = false
  private w = 1
  private h = 1
  private dpr = 1
  private pts: { x: number; y: number; d: number; base: number }[] = []
  private mouse = { x: -1e4, y: -1e4 }
  private t0 = performance.now()

  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement, private reduced: boolean, private rgb: [number, number, number] = [176, 92, 112]) {
    this.g = canvas.getContext('2d')!
    host.addEventListener('pointermove', this.onMove, { passive: true })
    host.addEventListener('pointerleave', this.onLeave)
  }

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect()
    this.mouse.x = e.clientX - r.left
    this.mouse.y = e.clientY - r.top
  }
  private onLeave = () => {
    this.mouse.x = this.mouse.y = -1e4
  }

  resize() {
    const r = this.canvas.getBoundingClientRect()
    this.w = Math.max(1, r.width)
    this.h = Math.max(1, r.height)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(this.w * this.dpr)
    this.canvas.height = Math.round(this.h * this.dpr)
    const gap = this.w < 700 ? 18 : 22
    const cx = this.w / 2, cy = this.h / 2, R = Math.hypot(cx, cy)
    this.pts = []
    for (let y = gap / 2; y < this.h; y += gap)
      for (let x = gap / 2; x < this.w; x += gap) {
        const d = Math.hypot(x - cx, (y - cy) * 1.25) / R
        // a bright ring hugging the card, fading out towards the edges and thinning in the very middle
        const ring = Math.exp(-(((d - 0.42) / 0.2) ** 2))
        const base = 0.16 + 0.55 * ring
        this.pts.push({ x, y, d, base })
      }
    this.draw(performance.now())
  }

  setRunning(on: boolean) {
    if (on === this.running) return
    this.running = on
    if (on && !this.reduced) this.loop()
    else cancelAnimationFrame(this.raf)
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    this.draw(performance.now())
  }

  private draw(now: number) {
    const { g, w, h, dpr, mouse } = this
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    const t = this.reduced ? 0 : (now - this.t0) / 1000
    const PERIOD = 2.6
    for (const p of this.pts) {
      // two waves in flight at once, each a soft band moving outward and fading as it goes
      let wave = 0
      for (let k = 0; k < 2; k++) {
        const ph = ((t / PERIOD + k / 2) % 1) * 1.15
        wave += Math.exp(-(((p.d - ph) / 0.07) ** 2)) * (1 - ph / 1.15)
      }
      const md = Math.hypot(p.x - mouse.x, p.y - mouse.y)
      const near = md < 160 ? (1 - md / 160) ** 1.5 : 0
      const a = Math.min(1, p.base + wave * 0.8 + near * 0.5)
      const r = 1.15 + wave * 1.4 + near * 2.4
      const [cr, cg, cb] = this.rgb
      g.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${(a * 0.75).toFixed(3)})`
      g.beginPath()
      g.arc(p.x, p.y, r, 0, Math.PI * 2)
      g.fill()
    }
  }

  dispose() {
    this.setRunning(false)
    this.host.removeEventListener('pointermove', this.onMove)
    this.host.removeEventListener('pointerleave', this.onLeave)
  }
}
