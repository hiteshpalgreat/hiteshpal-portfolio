import { setup, block, drawBlock, lit, flat, scaleRing, type HLT, type Figure } from './common'

/**
 * Define: a stack of plates narrowing from a broad base to a small, sharp point. Ideas drop in from above
 * and settle on the point; a scan walks up the stack level by level, lifting the plates above it apart.
 * Point at a level to hold the scan there.
 */
const SIZES = [120, 94, 70, 48, 28], TH = 10, R = 10, STEP = 45, LIFT = 12, DROPS = 4
const OFF = [0, 1, 2, 3, 4].map((k) => [k * 4, k * 4])

export function define(HL: HLT, stage: HTMLElement): Figure {
  const H = SIZES.length * TH, top = H + (SIZES.length - 1) * LIFT
  const c = setup(HL, stage, 1.55, [[-60, -60, 0], [60, 60, 0], [60, -60, 0], [-60, 60, 0], [16, 16, top + 34]], 168)
  const { P, g } = c
  const plates = SIZES.map((s, k) => {
    const [ox, oy] = OFF[k], h = s / 2
    const [ring, inner] = HL.rings(ox - h, oy - h, ox + h, oy + h, Math.min(R, h * 0.45), 1.8)
    return { k, s, ox, oy, ring, inner, z0: k * TH, b: block(HL, g), z: HL.tween(0), drawn: NaN }
  })
  const TOP = plates.length - 1
  const [tx, ty] = OFF[TOP]
  // the axis the ideas fall down, and the ideas themselves
  const axis = HL.mk('path', { class: 'wire' }, g)
  const halo = HL.mk('path', { class: 'halo' }, g)
  const unit = HL.circ(1, 32)
  const drops = Array.from({ length: DROPS }, () => HL.mk('circle', { r: 2.6, class: 'spark' }, g) as SVGCircleElement)
  const orbit = HL.mk('circle', { r: 3, class: 'node' }, g)

  let act = -1, held = false, nextScan = performance.now() + 700, scanAt = -1
  function setActive(a: number) {
    if (a === act) return
    const now = performance.now(), from = a >= 0 ? a : act
    act = a
    for (const p of plates) HL.tset(p.z, a < 0 || p.k <= a ? 0 : (p.k - a) * LIFT, now, Math.abs(p.k - from) * STEP)
    plates.forEach((p) => lit(p.b, p.k === (a < 0 ? TOP : a)))
    B.wake()
  }

  const B = HL.register(stage, (_dt: number, now: number) => {
    if (!c.reduced && !held && now > nextScan) {
      // the scan: up one level at a time, then a breath with the stack closed
      scanAt = scanAt >= TOP ? -1 : scanAt + 1
      setActive(scanAt)
      nextScan = now + (scanAt < 0 ? 1300 : 900)
    }
    let topZ = 0
    for (const p of plates) {
      const z = p.z0 + HL.tval(p.z, now)
      if (p.k === TOP) topZ = z + TH
      if (z === p.drawn) continue
      p.drawn = z
      drawBlock(c, p.b, p.ring, p.inner, z, z + TH)
    }
    const a = P(tx, ty, topZ), b = P(tx, ty, topZ + 46)
    axis.setAttribute('d', HL.seg(a, b))
    halo.setAttribute('d', flat(c, scaleRing(unit, 9 + Math.sin(now / 260) * 2, tx, ty), topZ + 0.2))
    drops.forEach((d, i) => {
      const t = ((now / 1800 + i / DROPS) % 1)
      const q = P(tx, ty, topZ + 46 * (1 - t * t))
      d.setAttribute('cx', String(q[0]))
      d.setAttribute('cy', String(q[1]))
      d.style.opacity = String(Math.min(1, (1 - t) * 3) * Math.min(1, t * 5))
    })
    // a node circling the base plate
    const ang = now / 1400, rr = SIZES[0] / 2 + 6
    const o = P(Math.cos(ang) * rr, Math.sin(ang) * rr, 0)
    orbit.setAttribute('cx', String(o[0]))
    orbit.setAttribute('cy', String(o[1]))
    // round the back it passes behind the stack
    orbit.style.opacity = Math.cos(ang) + Math.sin(ang) < -0.2 ? '0' : '1'
    return true
  })
  setActive(-1)
  lit(plates[TOP].b, true)

  function hit(pt: [number, number]) {
    let best = -1, bd = 1.08
    for (const p of plates) {
      const w = HL.unproj(c.C, pt[0], pt[1], p.z0 + TH)
      const d = Math.max(Math.abs(w[0] - p.ox), Math.abs(w[1] - p.oy)) / (p.s / 2)
      if (d <= bd) {
        bd = d
        best = p.k
      }
    }
    return best
  }
  const off = HL.pointer(stage, {
    move: (pt: [number, number]) => {
      held = true
      setActive(hit(pt))
    },
    leave: () => {
      held = false
      scanAt = -1
      setActive(-1)
      nextScan = performance.now() + 900
    },
  })
  return { destroy: () => (B.unregister(), off(), c.svg.remove()) }
}
