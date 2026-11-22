import { setup, block, drawBlock, lit, order, shift, type HLT, type Figure } from './common'

/**
 * Ideate: a board of hex tiles, like a game of Catan in progress. Ideas spark up on their own here and
 * there, rise with a glow, throw off a few sparks and settle back. Sweep the pointer across and the tiles
 * you pass light up and trail behind you.
 */
const HS = 12.5, GAPS = HS + 1.6, LOW = 3, LIFT = 24, GLOW = 1300

export function ideate(HL: HLT, stage: HTMLElement): Figure {
  const cells: [number, number][] = []
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) cells.push([q, r])
  const R0 = GAPS * 4.6
  const c = setup(HL, stage, 1.6, [[-R0, -R0, -5], [R0, R0, -5], [R0, -R0, -5], [-R0, R0, -5], [0, 0, LOW + LIFT + 8]], 170)
  const { P, g } = c
  const base = HL.circ(R0, 64), baseIn = HL.circ(R0 - 2.2, 64)
  HL.put(HL.solid(g), HL.prism(P, c.front, base, baseIn, -5, 0))
  const items = HL.mk('g', {}, g) as SVGGElement
  const hex = HL.circ(HS, 6), hexIn = HL.circ(HS - 1.6, 6)
  // a fixed, slightly uneven board at rest
  const REST = [0, 2, 0, 5, 1, 0, 3, 0, 1, 7, 0, 2, 0, 4, 0, 1, 0, 3, 0]
  const tiles = cells.map(([q, r], i) => {
    const x = GAPS * 1.5 * q, y = GAPS * Math.sqrt(3) * (r + q / 2)
    const b = block(HL, items)
    return { x, y, ring: shift(hex, x, y), inner: shift(hexIn, x, y), h0: LOW + REST[i], e: 0, t0: 0, sp: HL.spring(LOW + REST[i], { k: 120, c: 13, eps: 0.03 }), b, drawn: NaN }
  })
  order(items, tiles.map((t) => ({ el: t.b.g, d: t.x + t.y })))
  const sparks = Array.from({ length: 12 }, () => ({ el: HL.mk('circle', { r: 1.8, class: 'spark' }, g) as SVGCircleElement, t0: -1e9, x: 0, y: 0, z: 0, dx: 0, dy: 0 }))
  let si = 0
  const heat = (t: (typeof tiles)[number], now: number) => (t.e ? t.e * Math.exp(-(now - t.t0) / GLOW) : 0)
  function spark(t: (typeof tiles)[number], f: number, now: number) {
    if (f <= heat(t, now)) return
    const fresh = heat(t, now) < 0.4 && f > 0.6
    t.e = f
    t.t0 = now
    if (fresh)
      for (let k = 0; k < 3; k++) {
        const s = sparks[si++ % sparks.length]
        s.t0 = now + k * 60
        s.x = t.x
        s.y = t.y
        s.z = t.h0 + LIFT * f
        s.dx = (Math.random() - 0.5) * 18
        s.dy = (Math.random() - 0.5) * 18
      }
  }
  let over: [number, number] | null = null, next = performance.now() + 500
  const B = HL.register(stage, (dt: number, now: number) => {
    if (!c.reduced && now > next) {
      spark(tiles[Math.floor(Math.random() * tiles.length)], 0.75 + Math.random() * 0.25, now)
      next = now + (over ? 1400 : 520) + Math.random() * 400
    }
    if (over)
      for (const t of tiles) {
        const f = Math.max(0, 1 - Math.hypot(t.x - over[0], t.y - over[1]) / (GAPS * 1.7))
        if (f > 0.05) spark(t, f, now)
      }
    for (const t of tiles) {
      const e = heat(t, now)
      if (e < 0.02) t.e = 0
      t.sp.t = t.h0 + LIFT * e
      HL.stepS(t.sp, dt)
      lit(t.b, e > 0.38)
      if (t.sp.x !== t.drawn) {
        t.drawn = t.sp.x
        drawBlock(c, t.b, t.ring, t.inner, 0, t.sp.x)
      }
    }
    for (const s of sparks) {
      const u = (now - s.t0) / 900
      if (u < 0 || u > 1) {
        s.el.style.opacity = '0'
        continue
      }
      const q = P(s.x + s.dx * u, s.y + s.dy * u, s.z + 4 + u * 26)
      s.el.setAttribute('cx', String(q[0]))
      s.el.setAttribute('cy', String(q[1]))
      s.el.style.opacity = String(1 - u)
    }
    return true
  })
  const off = HL.pointer(stage, {
    move: (pt: [number, number]) => {
      const w = HL.unproj(c.C, pt[0], pt[1], 0)
      over = Math.hypot(w[0], w[1]) > R0 ? null : [w[0], w[1]]
      B.wake()
    },
    leave: () => (over = null),
  })
  return { destroy: () => (B.unregister(), off(), c.svg.remove()) }
}
