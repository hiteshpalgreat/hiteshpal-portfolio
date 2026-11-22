import { setup, block, drawBlock, lit, shift, type HLT, type Figure } from './common'

/**
 * Refine: a rough stack of slabs and a glowing scan plane. The plane sweeps up through the stack and every
 * slab it passes slides true and flashes; then the stack roughens up again for the next pass. Point at a
 * slab to bring the plane there and pull it and its neighbours into line.
 */
const K = 6, W = 84, D = 58, TH = 9, R = 9
const JAGS = [
  [[0, 0], [9, -6], [-8, 5], [6, 8], [-9, -4], [5, -8]],
  [[0, 0], [-7, 6], [8, -3], [-5, -8], [9, 5], [-6, 4]],
  [[0, 0], [6, 7], [-9, -5], [7, -6], [-4, 8], [8, -2]],
]

export function refine(HL: HLT, stage: HTMLElement): Figure {
  const c = setup(HL, stage, 1.95, [[-W / 2 - 12, -D / 2 - 12, 0], [W / 2 + 12, D / 2 + 12, 0], [W / 2 + 12, -D / 2 - 12, 0], [-W / 2 - 12, D / 2 + 12, 0], [0, 0, K * TH + 12]], 162)
  const { g } = c
  const [ring, inner] = HL.rings(-W / 2, -D / 2, W / 2, D / 2, R, 1.8)
  const plane = HL.rrect(-W / 2 - 10, -D / 2 - 10, W / 2 + 10, D / 2 + 10, R + 6, 6)
  let jag = 0
  const slabs = JAGS[0].map(([jx, jy], k) => ({ k, jx, jy, sx: HL.spring(jx, { eps: 0.03 }), sy: HL.spring(jy, { eps: 0.03 }), b: block(HL, g), flash: -1e9, dx: NaN, dy: NaN }))
  const laser = HL.mk('path', { class: 'laser' }, g) as SVGPathElement
  let lz = -4, over = -1, phase = 0, phaseT = performance.now()

  const B = HL.register(stage, (dt: number, now: number) => {
    let target: number
    if (over >= 0) {
      target = (over + 0.5) * TH
      for (const s of slabs) {
        const f = Math.max(0, 1 - Math.abs(s.k - over) / 2.2)
        s.sx.t = s.jx * (1 - f)
        s.sy.t = s.jy * (1 - f)
      }
    } else if (c.reduced) {
      target = -4
    } else {
      // 0: sweep up, aligning; 1: hold true; 2: roughen again, plane drops away
      const t = now - phaseT
      if (phase === 0) {
        target = -4 + (t / 2600) * (K * TH + 8)
        for (const s of slabs) if (lz > (s.k + 0.5) * TH && s.sx.t !== 0) ((s.sx.t = 0), (s.sy.t = 0), (s.flash = now))
        if (t > 2600) ((phase = 1), (phaseT = now))
      } else if (phase === 1) {
        target = K * TH + 4
        if (t > 1200) {
          phase = 2
          phaseT = now
          jag = (jag + 1) % JAGS.length
          slabs.forEach((s, k) => {
            ;[s.jx, s.jy] = JAGS[jag][k]
            window.setTimeout(() => ((s.sx.t = s.jx), (s.sy.t = s.jy)), (K - k) * 90)
          })
        }
      } else {
        target = -4
        if (t > 1500) ((phase = 0), (phaseT = now))
      }
    }
    lz += (target - lz) * Math.min(1, dt * (over >= 0 ? 10 : 9))
    for (const s of slabs) {
      HL.stepS(s.sx, dt)
      HL.stepS(s.sy, dt)
      lit(s.b, now - s.flash < 650 || (over >= 0 && s.k === over))
      const x = s.sx.x, y = s.sy.x
      if (x === s.dx && y === s.dy) continue
      s.dx = x
      s.dy = y
      drawBlock(c, s.b, shift(ring, x, y), shift(inner, x, y), s.k * TH, (s.k + 1) * TH)
    }
    // the plane is painted between the slab under it and the one over it
    const above = Math.max(0, Math.min(K, Math.ceil(lz / TH)))
    const want = above < K ? slabs[above].b.g : null
    if (laser.nextSibling !== want) g.insertBefore(laser, want)
    laser.setAttribute('d', HL.poly(HL.ringAt(c.P, plane, lz)))
    laser.style.opacity = String(lz < 0 ? 0 : 1)
    return true
  })

  function hit(pt: [number, number]) {
    let best = -1
    for (const s of slabs) {
      const w = HL.unproj(c.C, pt[0], pt[1], (s.k + 1) * TH)
      if (Math.abs(w[0] - s.jx) <= W / 2 + 2 && Math.abs(w[1] - s.jy) <= D / 2 + 2) best = s.k
    }
    return best
  }
  const off = HL.pointer(stage, {
    move: (pt: [number, number]) => {
      over = hit(pt)
      if (over < 0) for (const s of slabs) ((s.sx.t = s.jx), (s.sy.t = s.jy))
      B.wake()
    },
    leave: () => {
      over = -1
      phase = 2
      phaseT = performance.now()
      for (const s of slabs) ((s.sx.t = s.jx), (s.sy.t = s.jy))
    },
  })
  return { destroy: () => (B.unregister(), off(), c.svg.remove()) }
}
