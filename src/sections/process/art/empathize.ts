import { setup, shift, flat, scaleRing, type HLT, type Figure } from './common'

/**
 * Empathize: pawns on a game board. Every so often one of them speaks up: a ripple runs out across the
 * board and the others hop to listen, nearest first. Point at the board and the pawns near you stand tall,
 * the nearest one speaks.
 */
const N = 4, GAP = 26, FOOT = 11, SHOULDER = 6.5, HEAD = 3.8, LOW = 11, TALL = 30, NECK = 4.2, EXT = N * GAP, PAD = 12
const JIT = [[2, -3], [-3, 2], [3, 3], [-2, -2], [-3, -1], [2, 2], [-1, 3], [3, -2], [1, -3], [-3, 3], [2, 1], [-2, -3], [3, 1], [-1, -2], [2, -1], [-3, 2]]
const falloff = (u: number) => (u <= 0 ? 1 : u <= 1 ? 1 - u * 0.7 : Math.max(0.06, 0.3 - (u - 1) * 0.22))

export function empathize(HL: HLT, stage: HTMLElement): Figure {
  const c = setup(HL, stage, 1.75, [[-PAD, -PAD, -6], [EXT + PAD, EXT + PAD, -6], [EXT + PAD, -PAD, -6], [-PAD, EXT + PAD, -6], [EXT / 2, EXT / 2, TALL + NECK + 14]], 168)
  const { P, g } = c
  // a square game board with soft corners
  const pr = HL.rrect(-PAD, -PAD, EXT + PAD, EXT + PAD, 12, 8), pi = HL.rrect(-PAD + 2.2, -PAD + 2.2, EXT + PAD - 2.2, EXT + PAD - 2.2, 10, 8)
  HL.put(HL.solid(g), HL.prism(P, c.front, pr, pi, -6, 0))
  // the board: a faint grid of squares on top of the plinth
  const grid = HL.mk('path', { class: 'wire' }, g)
  let gd = ''
  for (let i = 0; i <= N; i++) {
    gd += HL.seg(P(i * GAP, 0, 0), P(i * GAP, EXT, 0)) + HL.seg(P(0, i * GAP, 0), P(EXT, i * GAP, 0))
  }
  grid.setAttribute('d', gd)
  const unit = HL.circ(1, 40)
  const ripples = [0, 1].map(() => ({ el: HL.mk('path', { class: 'ripple' }, g) as SVGPathElement, t0: -1e9, x: 0, y: 0 }))
  // a node that walks round the board's edge
  const node = HL.mk('circle', { r: 3.2, class: 'node' }, g)
  const halo = HL.mk('path', { class: 'halo' }, g)

  type Pawn = { i: number; j: number; cx: number; cy: number; h0: number; foot: HLT; top: HLT; inner: HLT; sp: HLT; b: HLT; hd: SVGEllipseElement; drawn: number }
  const people: Pawn[] = []
  for (let s = 0; s <= 2 * (N - 1); s++)
    for (let i = 0; i < N; i++) {
      const j = s - i
      if (j < 0 || j >= N) continue
      const [jx, jy] = JIT[i * N + j], cx = (i + 0.5) * GAP + jx, cy = (j + 0.5) * GAP + jy
      const u = i / (N - 1), v = j / (N - 1)
      const h0 = LOW + 12 * Math.exp(-((u - 0.2) ** 2 + (v - 0.35) ** 2) / 0.09) + 8 * Math.exp(-((u - 0.85) ** 2 + (v - 0.8) ** 2) / 0.05)
      const ring = (r: number, n: number) => HL.rrect(cx - r, cy - r, cx + r, cy + r, r - 0.01, n)
      const b = HL.solid(g)
      const hd = HL.mk('ellipse', { rx: HEAD * c.C.S, ry: HEAD * c.C.S, class: 'sil' }, g) as SVGEllipseElement
      people.push({ i, j, cx, cy, h0, foot: ring(FOOT / 2, 6), top: ring(SHOULDER / 2, 6), inner: ring(SHOULDER / 2 - 1, 6), sp: HL.spring(h0, { k: 140, c: 11, eps: 0.03 }), b, hd, drawn: NaN })
    }

  let over: [number, number] | null = null
  let speaker = people.reduce((a, b) => (b.h0 > a.h0 ? b : a))
  speaker.hd.classList.add('acc-dot')
  let nextTalk = performance.now() + 900

  function speak(p: Pawn, now: number) {
    if (p !== speaker) {
      speaker.hd.classList.remove('acc-dot')
      speaker = p
      speaker.hd.classList.add('acc-dot')
    }
    const r = ripples[0].t0 < ripples[1].t0 ? ripples[0] : ripples[1]
    r.t0 = now
    r.x = p.cx
    r.y = p.cy
    // the listeners hop, nearest first, as the ripple reaches them
    for (const q of people) {
      if (q === p) continue
      const d = Math.hypot(q.cx - p.cx, q.cy - p.cy)
      window.setTimeout(() => (q.sp.v += 55 * Math.max(0.35, 1 - d / 110)), d * 6)
    }
    p.sp.v += 70
  }

  function draw(p: Pawn) {
    const h = p.sp.x
    if (h === p.drawn) return
    p.drawn = h
    HL.put(p.b, { sil: HL.poly(HL.hull(HL.ringAt(P, p.foot, 0).concat(HL.ringAt(P, p.top, h)))), crease: HL.open(HL.ringAt(P, HL.run(p.inner, c.front), h)) })
    const q = P(p.cx, p.cy, h + NECK)
    p.hd.setAttribute('cx', String(q[0]))
    p.hd.setAttribute('cy', String(q[1]))
  }

  const B = HL.register(stage, (dt: number, now: number) => {
    if (!c.reduced && !over && now > nextTalk) {
      speak(people[Math.floor(Math.random() * people.length)], now)
      nextTalk = now + 1700 + Math.random() * 900
    }
    for (const p of people) {
      HL.stepS(p.sp, dt)
      draw(p)
    }
    for (const r of ripples) {
      const t = (now - r.t0) / 1500
      if (t < 0 || t > 1) {
        r.el.setAttribute('d', '')
        continue
      }
      r.el.setAttribute('d', flat(c, scaleRing(unit, 6 + t * 70, r.x, r.y), 0.2))
      r.el.style.opacity = String((1 - t) * 0.9)
    }
    // the travelling node, round the board's edge
    const per = (now / 5200) % 1, L = EXT + PAD
    const k = per * 4, side = Math.floor(k), f = k - side, lo = -PAD / 2
    const pts = [[lo, lo], [L - PAD / 2, lo], [L - PAD / 2, L - PAD / 2], [lo, L - PAD / 2]]
    const a = pts[side], b = pts[(side + 1) % 4]
    const q = P(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0)
    node.setAttribute('cx', String(q[0]))
    node.setAttribute('cy', String(q[1]))
    halo.setAttribute('d', flat(c, scaleRing(unit, 7 + Math.sin(now / 300) * 1.5, speaker.cx, speaker.cy), 0.1))
    return true
  })

  function retarget(now: number) {
    if (!over) {
      for (const p of people) p.sp.t = p.h0
      return
    }
    let near = people[0], best = Infinity
    for (const p of people) {
      const d = Math.hypot(p.cx - over[0], p.cy - over[1])
      p.sp.t = LOW + (TALL - LOW) * falloff(d / (1.6 * GAP))
      if (d < best) {
        best = d
        near = p
      }
    }
    if (near !== speaker) speak(near, now)
  }
  const off = HL.pointer(stage, {
    move: (pt: [number, number]) => {
      const w = HL.unproj(c.C, pt[0], pt[1], 0)
      over = w[0] < -PAD || w[1] < -PAD || w[0] > EXT + PAD || w[1] > EXT + PAD ? null : [HL.clamp(w[0], 0, EXT), HL.clamp(w[1], 0, EXT)]
      retarget(performance.now())
      B.wake()
    },
    leave: () => {
      over = null
      retarget(performance.now())
      nextTalk = performance.now() + 600
      B.wake()
    },
  })
  return { destroy: () => (B.unregister(), off(), c.svg.remove()) }
}
