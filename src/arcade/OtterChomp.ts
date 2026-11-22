/**
 * OTTER CHOMP: a tiny original maze game drawn on a canvas (no images, no sound files).
 * The otter eats fish pellets and dodges crabs. Golden fish make the crabs scared for a while.
 * The canvas is shown on the arcade screen as a texture. Adds only a few KB to the site.
 */

const MAZE = [
  '......#.......#......',
  '#o.......#.#.......o#',
  '#.##.###.#.#.###.##.#',
  '#...................#',
  '#.##.#.#######.#.##.#',
  '#....#....#....#....#',
  '####.####.#.####.####',
  '####.#....C....#.####',
  '......#.......#......',
  '####.#.#######.#.####',
  '#.........P.........#',
  '#.##.###.#.#.###.##.#',
  '#o.#.....#.#.....#.o#',
  '##.#.#.#######.#.#.##',
  '#....#....#....#....#',
  '......#.......#......',
  '#...................#',
  '......#.......#......',
]
const COLS = MAZE[0].length
const ROWS = MAZE.length
const T = 13 // tile size in px
const HUD = 18
export const GAME_H = ROWS * T + HUD // 252
/** the arcade glass is about 1.45:1, so the maze sits in the middle with side panels */
export const GAME_W = 366
const MX = Math.round((GAME_W - COLS * T) / 2)
const MAZE_W = COLS * T

type Dir = { x: number; y: number }
const DIRS: Record<string, Dir> = {
  ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 }, KeyS: { x: 0, y: 1 }, KeyA: { x: -1, y: 0 }, KeyD: { x: 1, y: 0 },
}
const ALL: Dir[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]

type Mover = { x: number; y: number; dir: Dir; next: Dir; speed: number }
type Crab = Mover & { color: string; home: { x: number; y: number }; delay: number; eaten: boolean }

const COL = {
  bg: '#120b16', wall: '#3a2350', wallEdge: '#f2b36b', pellet: '#ffd9a0', power: '#ffb347',
  otter: '#8a5a3c', otterFace: '#f1d2a8', text: '#f6efe4', dim: '#9a8fa8', scared: '#5ba4db',
}

export class OtterChomp {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private grid: string[][] = []
  private otter!: Mover
  private crabs: Crab[] = []
  private pellets = 0
  private score = 0
  private best = 0
  private lives = 3
  private state: 'title' | 'play' | 'dead' | 'over' | 'win' = 'title'
  private stateT = 0
  private scared = 0
  private t = 0
  private running = false
  private raf = 0
  private last = 0
  /** called after every drawn frame (the 3D side sets texture.needsUpdate there) */
  onFrame: () => void = () => {}

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = GAME_W
    this.canvas.height = GAME_H
    this.ctx = this.canvas.getContext('2d')!
    try { this.best = Number(localStorage.getItem('otterchomp.best') || 0) } catch { /* storage may be blocked */ }
    this.reset(true)
    this.draw()
  }

  private reset(full: boolean) {
    if (full) {
      this.grid = MAZE.map((r) => r.split(''))
      this.pellets = this.grid.flat().filter((c) => c === '.' || c === 'o').length
      this.score = 0
      this.lives = 3
    }
    const find = (ch: string) => {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (MAZE[y][x] === ch) return { x, y }
      return { x: 1, y: 1 }
    }
    const p = find('P')
    const c = find('C')
    this.otter = { x: p.x, y: p.y, dir: { x: 0, y: 0 }, next: { x: 0, y: 0 }, speed: 6.2 }
    const colors = ['#ff5a5f', '#ff8fb1', '#4fd1c5']
    this.crabs = colors.map((color, i) => ({
      x: c.x, y: c.y, dir: { x: i % 2 ? 1 : -1, y: 0 }, next: { x: 0, y: 0 }, speed: 4.6,
      color, home: { ...c }, delay: 1 + i * 2.2, eaten: false,
    }))
    this.scared = 0
  }

  private walkable(x: number, y: number) {
    const wx = ((x % COLS) + COLS) % COLS
    if (y < 0 || y >= ROWS) return false
    return this.grid[y][wx] !== '#'
  }

  start() {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    window.addEventListener('keydown', this.onKey)
    const loop = (now: number) => {
      if (!this.running) return
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.update(dt)
      this.draw()
      this.onFrame()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKey)
    if (this.state === 'play') this.state = 'title'
    this.draw()
    this.onFrame()
  }

  private onKey = (e: KeyboardEvent) => {
    const d = DIRS[e.code]
    if (!d) {
      if ((e.code === 'Enter' || e.code === 'Space') && this.state !== 'play') this.begin()
      return
    }
    e.preventDefault()
    if (this.state === 'title' || this.state === 'over' || this.state === 'win') this.begin()
    this.otter.next = d
  }

  private begin() {
    if (this.state !== 'dead') this.reset(this.state !== 'play')
    this.state = 'play'
  }

  private step(m: Mover, dt: number, choose: (m: Mover) => void) {
    // movers travel tile to tile; decisions are made on tile centres
    let dist = m.speed * dt
    while (dist > 0) {
      const tx = Math.round(m.x), ty = Math.round(m.y)
      const atCentre = Math.abs(m.x - tx) < 1e-3 && Math.abs(m.y - ty) < 1e-3
      if (atCentre) {
        m.x = tx; m.y = ty
        // wrap through the side tunnel
        if (m.x < 0) m.x = COLS - 1
        if (m.x > COLS - 1) m.x = 0
        choose(m)
        if (!this.walkable(m.x + m.dir.x, m.y + m.dir.y)) { m.dir = { x: 0, y: 0 }; return }
      }
      const toNext = m.dir.x !== 0 ? Math.abs((m.dir.x > 0 ? Math.floor(m.x + 1e-4) + 1 : Math.ceil(m.x - 1e-4) - 1) - m.x)
        : m.dir.y !== 0 ? Math.abs((m.dir.y > 0 ? Math.floor(m.y + 1e-4) + 1 : Math.ceil(m.y - 1e-4) - 1) - m.y) : 0
      if (toNext === 0) return
      const s = Math.min(dist, toNext)
      m.x += m.dir.x * s
      m.y += m.dir.y * s
      dist -= s
    }
  }

  private update(dt: number) {
    this.t += dt
    if (this.state === 'dead' || this.state === 'win') {
      this.stateT -= dt
      if (this.stateT <= 0) {
        if (this.state === 'win') { this.reset(true); this.state = 'play'; return }
        if (this.lives <= 0) { this.state = 'over'; return }
        this.reset(false)
        this.state = 'play'
      }
      return
    }
    if (this.state !== 'play') return
    this.scared = Math.max(0, this.scared - dt)

    const o = this.otter
    this.step(o, dt, (m) => {
      if ((m.next.x || m.next.y) && this.walkable(m.x + m.next.x, m.y + m.next.y)) m.dir = m.next
      const c = this.grid[m.y]?.[m.x]
      if (c === '.' || c === 'o') {
        this.grid[m.y][m.x] = ' '
        this.pellets--
        this.score += c === 'o' ? 50 : 10
        if (c === 'o') { this.scared = 7; this.crabs.forEach((k) => (k.eaten = false)) }
        if (this.pellets <= 0) { this.state = 'win'; this.stateT = 2 }
      }
    })
    // allow instant reversal
    if (o.next.x === -o.dir.x && o.next.y === -o.dir.y && (o.next.x || o.next.y)) o.dir = o.next

    for (const k of this.crabs) {
      if (k.delay > 0) { k.delay -= dt; continue }
      k.speed = this.scared > 0 && !k.eaten ? 3.2 : k.eaten ? 9 : 4.6 + Math.min(1.4, this.t / 60)
      this.step(k, dt, (m) => {
        const crab = m as Crab
        if (crab.eaten && m.x === crab.home.x && m.y === crab.home.y) crab.eaten = false
        const options = ALL.filter((d) => this.walkable(m.x + d.x, m.y + d.y) && !(d.x === -m.dir.x && d.y === -m.dir.y))
        const pool = options.length ? options : ALL.filter((d) => this.walkable(m.x + d.x, m.y + d.y))
        if (!pool.length) return
        const target = crab.eaten ? crab.home : { x: o.x, y: o.y }
        const scaredNow = this.scared > 0 && !crab.eaten
        if (scaredNow || Math.random() < 0.25) {
          m.dir = pool[Math.floor(Math.random() * pool.length)]
        } else {
          pool.sort((a, b) => Math.hypot(m.x + a.x - target.x, m.y + a.y - target.y) - Math.hypot(m.x + b.x - target.x, m.y + b.y - target.y))
          m.dir = pool[0]
        }
      })
      // collision
      if (Math.hypot(k.x - o.x, k.y - o.y) < 0.6) {
        if (k.eaten) continue
        if (this.scared > 0) { k.eaten = true; this.score += 200 }
        else {
          this.lives--
          this.state = 'dead'
          this.stateT = 1.4
          if (this.score > this.best) {
            this.best = this.score
            try { localStorage.setItem('otterchomp.best', String(this.best)) } catch { /* ignore */ }
          }
          return
        }
      }
    }
  }

  private draw() {
    const g = this.ctx
    g.fillStyle = COL.bg
    g.fillRect(0, 0, GAME_W, GAME_H)
    this.sidePanels()
    g.save()
    g.translate(MX, HUD)
    // walls
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const c = this.grid[y][x]
        const px = x * T, py = y * T
        if (c === '#') {
          g.fillStyle = COL.wall
          g.fillRect(px, py, T, T)
          g.fillStyle = COL.wallEdge
          if (!this.isWall(x, y - 1)) g.fillRect(px, py, T, 1.5)
          if (!this.isWall(x, y + 1)) g.fillRect(px, py + T - 1.5, T, 1.5)
          if (!this.isWall(x - 1, y)) g.fillRect(px, py, 1.5, T)
          if (!this.isWall(x + 1, y)) g.fillRect(px + T - 1.5, py, 1.5, T)
        } else if (c === '.') {
          g.fillStyle = COL.pellet
          g.fillRect(px + T / 2 - 1.5, py + T / 2 - 1.5, 3, 3)
        } else if (c === 'o') {
          const pulse = 0.75 + 0.25 * Math.sin(this.t * 6)
          this.fish(px + T / 2, py + T / 2, 4.5 * pulse, COL.power)
        }
      }
    // crabs
    for (const k of this.crabs) this.crab(k)
    // otter
    this.drawOtter()
    g.restore()
    // HUD
    g.fillStyle = COL.text
    g.font = 'bold 10px monospace'
    g.textBaseline = 'middle'
    g.fillText(`SCORE ${this.score}`, MX + 4, HUD / 2)
    g.fillStyle = COL.dim
    g.fillText(`BEST ${Math.max(this.best, this.score)}`, MX + MAZE_W / 2 - 24, HUD / 2)
    for (let i = 0; i < this.lives; i++) this.heart(MX + MAZE_W - 10 - i * 12, HUD / 2)
    // overlays
    const msg =
      this.state === 'title' ? ['OTTER CHOMP', 'press an arrow key'] :
      this.state === 'over' ? ['GAME OVER', 'press an arrow key'] :
      this.state === 'win' ? ['ALL FISH EATEN', 'next round...'] : null
    if (msg && (this.state !== 'title' || Math.floor(this.t * 2) % 2 === 0 || true)) {
      g.fillStyle = 'rgba(18, 11, 22, 0.78)'
      g.fillRect(MX + 30, GAME_H / 2 - 28, MAZE_W - 60, 52)
      g.strokeStyle = COL.wallEdge
      g.strokeRect(MX + 30.5, GAME_H / 2 - 27.5, MAZE_W - 61, 51)
      g.textAlign = 'center'
      g.fillStyle = COL.wallEdge
      g.font = 'bold 16px monospace'
      g.fillText(msg[0], GAME_W / 2, GAME_H / 2 - 10)
      g.fillStyle = COL.text
      g.font = '10px monospace'
      if (Math.floor(this.t * 2.5) % 2 === 0 || this.state !== 'title') g.fillText(msg[1], GAME_W / 2, GAME_H / 2 + 10)
      g.textAlign = 'left'
    }
    if (this.state === 'title') this.t += 1 / 60
  }

  /** decorative cabinet-style side panels */
  private sidePanels() {
    const g = this.ctx
    for (const x0 of [0, MX + MAZE_W]) {
      const grad = g.createLinearGradient(0, 0, 0, GAME_H)
      grad.addColorStop(0, '#2a1638')
      grad.addColorStop(1, '#170d1f')
      g.fillStyle = grad
      g.fillRect(x0, 0, MX, GAME_H)
    }
    g.fillStyle = COL.wallEdge
    g.fillRect(MX - 2, 0, 1, GAME_H)
    g.fillRect(MX + MAZE_W + 1, 0, 1, GAME_H)
    // little legend: otter, fish, crab
    const cx = MX / 2
    g.save()
    g.translate(0, 0)
    this.fish(cx + 3, 60, 5, COL.power)
    g.fillStyle = COL.dim
    g.font = '8px monospace'
    g.textAlign = 'center'
    g.fillText('EAT', cx, 78)
    g.fillStyle = '#ff5a5f'
    g.beginPath(); g.ellipse(cx, 120, 5, 3.6, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = COL.dim
    g.fillText('AVOID', cx, 136)
    const rx = MX + MAZE_W + MX / 2
    g.fillStyle = COL.wallEdge
    g.font = 'bold 9px monospace'
    ;['O', 'T', 'T', 'E', 'R'].forEach((ch, i) => g.fillText(ch, rx, 50 + i * 13))
    g.fillStyle = COL.dim
    g.font = '8px monospace'
    g.fillText('ARROWS', rx, 140)
    g.fillText('ESC', rx, 156)
    g.textAlign = 'left'
    g.restore()
  }

  private isWall(x: number, y: number) {
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return true
    return this.grid[y][x] === '#'
  }

  private fish(cx: number, cy: number, r: number, color: string) {
    const g = this.ctx
    g.fillStyle = color
    g.beginPath()
    g.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.moveTo(cx - r * 0.8, cy)
    g.lineTo(cx - r * 1.6, cy - r * 0.6)
    g.lineTo(cx - r * 1.6, cy + r * 0.6)
    g.fill()
  }

  private heart(cx: number, cy: number) {
    const g = this.ctx
    g.fillStyle = '#ff5a5f'
    g.beginPath()
    g.arc(cx - 2, cy - 1, 2.5, 0, Math.PI * 2)
    g.arc(cx + 2, cy - 1, 2.5, 0, Math.PI * 2)
    g.moveTo(cx - 4.5, cy)
    g.lineTo(cx, cy + 4.5)
    g.lineTo(cx + 4.5, cy)
    g.fill()
  }

  private drawOtter() {
    const g = this.ctx
    const o = this.otter
    const cx = o.x * T + T / 2, cy = o.y * T + T / 2
    const blink = this.state === 'dead' && Math.floor(this.t * 10) % 2 === 0
    if (blink) return
    // ears
    g.fillStyle = COL.otter
    g.beginPath(); g.arc(cx - 4, cy - 4.5, 2, 0, Math.PI * 2); g.arc(cx + 4, cy - 4.5, 2, 0, Math.PI * 2); g.fill()
    // head
    g.beginPath(); g.arc(cx, cy, 5.6, 0, Math.PI * 2); g.fill()
    // face
    g.fillStyle = COL.otterFace
    g.beginPath(); g.ellipse(cx, cy + 1.4, 4, 3, 0, 0, Math.PI * 2); g.fill()
    // eyes + nose
    g.fillStyle = '#1a0f12'
    g.fillRect(cx - 2.6, cy - 2, 1.4, 1.6); g.fillRect(cx + 1.2, cy - 2, 1.4, 1.6)
    g.fillRect(cx - 0.8, cy + 0.2, 1.6, 1.1)
    // chomp
    const open = Math.abs(Math.sin(this.t * 14)) > 0.5 && (o.dir.x || o.dir.y)
    if (open) { g.fillStyle = '#5a1d1d'; g.fillRect(cx - 1.2, cy + 2, 2.4, 1.6) }
  }

  private crab(k: Crab) {
    const g = this.ctx
    const cx = k.x * T + T / 2, cy = k.y * T + T / 2
    const scared = this.scared > 0 && !k.eaten
    const flash = scared && this.scared < 2 && Math.floor(this.t * 8) % 2 === 0
    if (!k.eaten) {
      g.fillStyle = scared ? (flash ? '#f6efe4' : COL.scared) : k.color
      // claws
      const snap = Math.sin(this.t * 10) * 0.6
      g.beginPath(); g.arc(cx - 5.5, cy - 3 + snap, 2.2, 0, Math.PI * 2); g.arc(cx + 5.5, cy - 3 - snap, 2.2, 0, Math.PI * 2); g.fill()
      // body
      g.beginPath(); g.ellipse(cx, cy + 1, 5, 3.6, 0, 0, Math.PI * 2); g.fill()
      // legs
      g.fillRect(cx - 6, cy + 2, 2, 1); g.fillRect(cx + 4, cy + 2, 2, 1)
    }
    // eyes (also shown alone while an eaten crab hurries home)
    g.fillStyle = '#f6efe4'
    g.fillRect(cx - 2.5, cy - 3, 2, 2); g.fillRect(cx + 0.5, cy - 3, 2, 2)
    g.fillStyle = '#1a0f12'
    g.fillRect(cx - 2, cy - 2.5, 1, 1); g.fillRect(cx + 1, cy - 2.5, 1, 1)
  }
}
