import { setup, block, drawBlock, lit, order, flat, type HLT, type Figure } from './common'

/**
 * Test & Iterate: a little race circuit. A glowing car laps it and leaves a trail; every lap the pylons in
 * the infield grow one step, like results improving round after round, and after a few laps they ease back
 * down and the next season starts. Hover the circuit and the car pushes into a faster lap; point at a pylon
 * and it rises and lights up.
 */
const W = 70, D = 42, TR = 34, LANE = 13, M = 5, CAR = 6, TRAIL = 22, LAPS = 4

export function iterate(HL: HLT, stage: HTMLElement): Figure {
  const c = setup(HL, stage, 2.05, [[-W - 6, -D - 6, -6], [W + 6, D + 6, -6], [W + 6, -D - 6, -6], [-W - 6, D + 6, -6], [0, 0, 44]], 170)
  const { P, g } = c
  const outer = HL.rrect(-W - 6, -D - 6, W + 6, D + 6, TR + 6, 12), outerIn = HL.rrect(-W - 4, -D - 4, W + 4, D + 4, TR + 4, 12)
  HL.put(HL.solid(g), HL.prism(P, c.front, outer, outerIn, -6, 0))
  const infield = HL.rrect(-W + LANE, -D + LANE, W - LANE, D - LANE, TR - LANE, 12)
  const lane = HL.rrect(-W + LANE / 2, -D + LANE / 2, W - LANE / 2, D - LANE / 2, TR - LANE / 2, 24)
  HL.mk('path', { class: 'wire-s', d: flat(c, infield, 0) }, g)
  HL.mk('path', { class: 'wire', d: flat(c, lane, 0) }, g)
  // start line
  HL.mk('path', { class: 'startline', d: HL.seg(P(W - LANE, 0, 0), P(W + 4, 0, 0)) }, g)
  const trail = HL.mk('path', { class: 'trail' }, g) as SVGPathElement
  const items = HL.mk('g', {}, g) as SVGGElement

  // the lane as a closed path, measured so the car moves at an even speed
  const pts = lane.map((q: { u: number; v: number }) => [q.u, q.v])
  const len: number[] = [0]
  for (let i = 1; i <= pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i % pts.length][0] - pts[i - 1][0], pts[i % pts.length][1] - pts[i - 1][1]))
  const total = len[len.length - 1]
  const at = (s: number) => {
    s = ((s % total) + total) % total
    let i = 1
    while (len[i] < s) i++
    const f = (s - len[i - 1]) / (len[i] - len[i - 1]), a = pts[i - 1], b = pts[i % pts.length]
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  }
  // the start line sits at the right-hand straight, where the lane crosses y = 0
  let s0 = 0, bd = Infinity
  for (let i = 0; i < pts.length; i++) if (pts[i][0] > 0 && Math.abs(pts[i][1]) < bd) ((bd = Math.abs(pts[i][1])), (s0 = len[i]))

  const pylons = Array.from({ length: M }, (_, k) => {
    const x = -34 + k * 17, y = (k % 2 ? 4 : -4)
    const [ring, inner] = HL.rings(x - 6, y - 6, x + 6, y + 6, 3, 1.4)
    return { k, x, y, ring, inner, b: block(HL, items), sp: HL.spring(7 + k * 2, { k: 70, c: 17, eps: 0.03 }), h: 7 + k * 2, drawn: NaN }
  })
  const car = block(HL, items)
  const carRing = HL.rings(-CAR, -CAR * 0.75, CAR, CAR * 0.75, 3, 1.2)
  lit(car, true)

  let s = s0 + 1, speed = HL.spring(52, { k: 18, c: 9 }), laps = 0, hover = -1
  const hist: number[][] = []
  function grow() {
    laps = (laps + 1) % (LAPS + 1)
    // each pylon's own height this lap; the springs (and the hover lift) take it from there
    pylons.forEach((p) => window.setTimeout(() => (p.h = 7 + p.k * 2 + laps * (3 + p.k * 1.8)), p.k * 90))
  }

  const B = HL.register(stage, (dt: number) => {
    HL.stepS(speed, dt)
    if (!c.reduced) {
      const before = Math.floor((s - s0) / total)
      s += speed.x * dt
      if (Math.floor((s - s0) / total) > before) grow()
    }
    const [x, y] = at(s)
    hist.unshift([x, y])
    if (hist.length > TRAIL) hist.pop()
    trail.setAttribute('d', HL.open(hist.map((h) => P(h[0], h[1], 1.2))))
    drawBlock(c, car, carRing[0].map((q: HLT) => ({ ...q, u: q.u + x, v: q.v + y })), carRing[1].map((q: HLT) => ({ ...q, u: q.u + x, v: q.v + y })), 0, 6)
    let tallest = pylons[0]
    for (const p of pylons) {
      p.sp.t = p.h + (p.k === hover ? 12 : 0)
      HL.stepS(p.sp, dt)
      if (p.h > tallest.h) tallest = p
      if (p.sp.x !== p.drawn) {
        p.drawn = p.sp.x
        drawBlock(c, p.b, p.ring, p.inner, 0, p.sp.x)
      }
    }
    pylons.forEach((p) => lit(p.b, hover >= 0 ? p.k === hover : p === tallest))
    order(items, [...pylons.map((p) => ({ el: p.b.g, d: p.x + p.y })), { el: car.g, d: x + y }])
    return true
  })
  const off = HL.pointer(stage, {
    move: (pt: [number, number]) => {
      speed.t = 118
      // the pylon under the pointer, tested on the ground where they stand
      const w = HL.unproj(c.C, pt[0], pt[1], 0)
      let best = -1, bd = 11
      for (const p of pylons) {
        const d = Math.hypot(w[0] - p.x, w[1] - p.y)
        if (d < bd) ((bd = d), (best = p.k))
      }
      hover = best
      B.wake()
    },
    leave: () => ((speed.t = 52), (hover = -1)),
  })
  return { destroy: () => (B.unregister(), off(), c.svg.remove()) }
}
