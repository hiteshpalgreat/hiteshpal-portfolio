/**
 * The two hands of Michelangelo's "Creation of Adam" (1512, public domain), drawn in ASCII.
 * Adam's hand comes in from the left, God's from the right, fingertips almost touching.
 *
 * How it works: a small greyscale brightness map of the two hands (public/footer/hands-map.png)
 * is read cell by cell. Each cell's brightness picks a character from a density ramp
 * (".:-=+*#%@") and a strength of the site's pink-red. Every character is a little particle
 * tied to its home: the pointer flings nearby ones outward and they spring back.
 *
 * As the footer scrolls in, Adam's hand slides in from the left edge and God's from the right
 * (`enter`, 0..1, set from the scroll). Once in, both hands drift very gently, as if floating.
 */

const MAP_URL = '/footer/hands-map.png'
const RAMP = '.:-=+*#%@'

export class AsciiHands {
  private g: CanvasRenderingContext2D
  private map: ImageData | null = null
  private n = 0
  private hx = new Float32Array(0)
  private hy = new Float32Array(0)
  private x = new Float32Array(0)
  private y = new Float32Array(0)
  private vx = new Float32Array(0)
  private vy = new Float32Array(0)
  private lum = new Float32Array(0)
  private kicked = new Float32Array(0)
  private ch: string[] = []
  private side = new Int8Array(0) // -1 = Adam's hand (left), 1 = God's hand (right)
  /** 0..1: how far the hands have slid in from the sides */
  enter = 0
  private shift = { lx: 0, ly: 0, rx: 0, ry: 0 }
  private mouse = { x: -1e4, y: -1e4, on: false }
  private size = { w: 1, h: 1, dpr: 1, cell: 14, cw: 9 }
  /** where the hands should sit inside the canvas, and whether they run across (x) or down (y) */
  private box = { x: 0, y: 0, w: 1, h: 1 }
  /** the hands' direction: cos and sin of the tilt (0 = flat; positive = rising to the right) */
  private dir = { c: 1, s: 0 }
  private raf = 0
  private running = false
  private last = 0

  constructor(private canvas: HTMLCanvasElement, private reduced: boolean) {
    this.g = canvas.getContext('2d')!
    canvas.addEventListener('pointermove', this.onMove, { passive: true })
    canvas.addEventListener('pointerleave', this.onLeave)
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const o = c.getContext('2d')!
      o.drawImage(img, 0, 0)
      this.map = o.getImageData(0, 0, c.width, c.height)
      this.build()
      this.draw()
    }
    img.src = MAP_URL
  }

  private onMove = (e: PointerEvent) => {
    const b = this.canvas.getBoundingClientRect()
    this.mouse.x = e.clientX - b.left
    this.mouse.y = e.clientY - b.top
    this.mouse.on = true
  }
  private onLeave = () => {
    this.mouse.on = false
    this.mouse.x = this.mouse.y = -1e4
  }

  /** w, h: the canvas; box: the area the hands should fill (defaults to the whole canvas) */
  resize(w: number, h: number, box?: { x: number; y: number; w: number; h: number }) {
    this.box = box ?? { x: 0, y: 0, w, h }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cell = w < 700 ? 10 : w < 1200 ? 12 : 14
    this.size = { w, h, dpr, cell, cw: cell * 0.62 }
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.build()
    this.draw()
  }

  /** reads the brightness map and turns every lit cell into a character */
  private build() {
    const map = this.map
    if (!map) return
    const { w, h, cell, cw } = this.size
    // The hands themselves only fill a band of the map (rows BAND0..BAND1); that band is centred on the box.
    const BAND0 = 0.29, BAND1 = 0.8, band = BAND1 - BAND0, mid = (BAND0 + BAND1) / 2
    const ratio = map.height / map.width
    const box = this.box
    // The hands always start at the screen's left and right edges. Flat when the box is wide; when it is
    // taller than a flat pair needs, they tilt and rise to the right so they fill it corner to corner.
    const tilt = Math.min(0.75, Math.max(0, Math.atan(box.h / w - band * ratio * 1.02)))
    this.dir = { c: Math.cos(tilt), s: Math.sin(tilt) }
    const L = w / this.dir.c
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2
    const cols = Math.ceil(w / cw)
    const rows = Math.ceil(h / cell)
    const hx: number[] = []
    const hy: number[] = []
    const lum: number[] = []
    const side: number[] = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const sx = (c + 0.5) * cw
        const sy = (r + 0.5) * cell
        // along: 0..1 from Adam's hand to God's; across: map rows, measured from the band's middle
        const dx = sx - cx, dy = sy - cy, { c: dc, s: ds } = this.dir
        const along = (dx * dc - dy * ds) / L + 0.5
        const across = (dx * ds + dy * dc) / (L * ratio)
        const u = along * map.width
        const v = (mid + across) * map.height
        if (u < 0 || v < 0 || u >= map.width || v >= map.height) continue
        const l = map.data[((v | 0) * map.width + (u | 0)) * 4] / 255
        if (l < 0.12) continue
        hx.push(sx)
        hy.push(sy)
        lum.push(l)
        side.push(along < 0.5 ? -1 : 1)
      }
    this.n = hx.length
    this.hx = Float32Array.from(hx)
    this.hy = Float32Array.from(hy)
    const out = (1 - this.enter) * L * 0.65
    this.side = Int8Array.from(side)
    this.x = Float32Array.from(hx, (v, i) => v + side[i] * out * this.dir.c)
    this.y = Float32Array.from(hy, (v, i) => v - side[i] * out * this.dir.s)
    this.vx = new Float32Array(this.n)
    this.vy = new Float32Array(this.n)
    this.kicked = new Float32Array(this.n).fill(-10)
    this.lum = Float32Array.from(lum)
    this.ch = lum.map((l) => this.pick(l))
  }

  private pick(l: number) {
    const i = Math.min(RAMP.length - 1, Math.floor(l * RAMP.length))
    // now and then a neighbour on the ramp, so the texture shimmers a little
    const j = Math.max(0, Math.min(RAMP.length - 1, i + (Math.random() < 0.2 ? (Math.random() < 0.5 ? -1 : 1) : 0)))
    return RAMP[j]
  }

  setRunning(on: boolean) {
    if (on === this.running) return
    this.running = on
    if (on) {
      this.last = performance.now()
      this.loop()
    } else cancelAnimationFrame(this.raf)
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.step(dt)
    this.draw()
  }

  private step(dt: number) {
    const { x, y, vx, vy, hx, hy, n } = this
    const reach = Math.max(46, this.size.w * 0.038)
    const t = performance.now() / 1000
    const m = this.mouse
    const flicker = this.reduced ? 0 : dt * 0.25 // share of characters that change per second
    const damp = Math.exp(-dt * 7)
    // where each hand should be right now: slid in from its side, plus a slow floating drift
    const e = this.enter
    const slide = 1 - e * e * (3 - 2 * e)
    const span = this.size.w / this.dir.c
    const drift = this.reduced ? 0 : 1
    const sh = this.shift
    // along the hands' axis: the slide in plus a slow drift; across it: a gentle float
    const la = -slide * span * 0.65 + drift * (Math.sin(t * 0.55) * 5 + Math.sin(t * 0.23) * 4)
    const lc = drift * Math.sin(t * 0.7 + 0.6) * 4
    const ra = slide * span * 0.65 + drift * (-Math.sin(t * 0.55 + 1.3) * 5 + Math.sin(t * 0.19) * 4)
    const rc = drift * Math.sin(t * 0.62 + 2.1) * 5
    // along the tilted axis (dc, -ds) and across it (ds, dc)
    const { c: dc, s: ds } = this.dir
    sh.lx = la * dc + lc * ds
    sh.ly = -la * ds + lc * dc
    sh.rx = ra * dc + rc * ds
    sh.ry = -ra * ds + rc * dc
    for (let i = 0; i < n; i++) {
      const tx = hx[i] + (this.side[i] < 0 ? sh.lx : sh.rx)
      const ty = hy[i] + (this.side[i] < 0 ? sh.ly : sh.ry)
      if (m.on && !this.reduced) {
        const dx = x[i] - m.x
        const dy = y[i] - m.y
        const d2 = dx * dx + dy * dy
        // a character the pointer touches gets flung outward (once, then it springs back home)
        if (d2 < reach * reach && t - this.kicked[i] > 0.5) {
          this.kicked[i] = t
          const d = Math.sqrt(d2) || 1
          const a = Math.atan2(dy / d, dx / d) + (Math.random() - 0.5) * 1.6
          const sp = (320 + Math.random() * 640) * (1.2 - d / reach)
          vx[i] += Math.cos(a) * sp
          vy[i] += Math.sin(a) * sp
          this.ch[i] = RAMP[(Math.random() * RAMP.length) | 0]
        }
      }
      // a stiff spring home with strong damping (velocities in px per second): quick, no wobble
      vx[i] = (vx[i] + (tx - x[i]) * 30 * dt) * damp
      vy[i] = (vy[i] + (ty - y[i]) * 30 * dt) * damp
      x[i] += vx[i] * dt
      y[i] += vy[i] * dt
      if (Math.random() < flicker) this.ch[i] = this.pick(this.lum[i])
    }
  }

  private draw() {
    const { g } = this
    const { w, h, dpr, cell } = this.size
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    g.font = `600 ${Math.round(cell * 0.95)}px ui-monospace, 'SF Mono', Menlo, Consolas, monospace`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const { x, y, hx, hy, lum, ch, n, shift: sh } = this
    for (let i = 0; i < n; i++) {
      const L = this.side[i] < 0
      const off = Math.min(1, Math.hypot(x[i] - hx[i] - (L ? sh.lx : sh.rx), y[i] - hy[i] - (L ? sh.ly : sh.ry)) / 80)
      if (x[i] < -20 || x[i] > w + 20 || y[i] < -20 || y[i] > h + 20) continue
      // the site's pink-red, brighter where the hands are lit; scattered characters warm up a touch
      const l = lum[i]
      g.fillStyle = `rgba(255, ${Math.round(82 + 40 * off)}, ${Math.round(110 + 30 * off)}, ${(0.25 + 0.75 * l).toFixed(3)})`
      g.fillText(ch[i], x[i], y[i])
    }
  }

  dispose() {
    this.setRunning(false)
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerleave', this.onLeave)
  }
}
