/* Shared bits for the process illustrations: the Hairline kernel's camera and rounded solids,
   plus a few lively extras of our own (accent fills, glows, travelling nodes, ripples). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HLT = any
export type Pt = [number, number]
export type Ring = { u: number; v: number; nu: number; nv: number }[]

export type Ctx = {
  HL: HLT
  stage: HTMLElement
  svg: SVGSVGElement
  P: (x: number, y: number, z: number) => Pt
  C: HLT
  front: HLT
  g: SVGGElement
  reduced: boolean
}

export function setup(HL: HLT, stage: HTMLElement, S: number, box: number[][], cy = 160): Ctx {
  const svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, stage) as SVGSVGElement
  const C = HL.Cam(45, 0.5, S)
  HL.fit(C, box, 200, cy)
  const g = HL.mk('g', {}, svg) as SVGGElement
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return { HL, stage, svg, P: HL.proj(C), C, front: HL.facing(C), g, reduced }
}

export const shift = (ring: Ring, x: number, y: number): Ring => ring.map((q) => ({ ...q, u: q.u + x, v: q.v + y }))
export const scaleRing = (ring: Ring, s: number, x: number, y: number): Ring => ring.map((q) => ({ ...q, u: q.u * s + x, v: q.v * s + y }))

/** a rounded solid that can light up: silhouette, crease, and a top face that takes the accent fill */
export type Block = { g: SVGGElement; sil: SVGPathElement; cr: SVGPathElement; top: SVGPathElement; on: boolean }
export function block(HL: HLT, parent: Element): Block {
  const s = HL.solid(parent)
  const top = HL.mk('path', { class: 'top' }, null) as SVGPathElement
  s.g.insertBefore(top, s.cr)
  return { g: s.g, sil: s.sil, cr: s.cr, top, on: false }
}
export function drawBlock(c: Ctx, b: Block, ring: Ring, inner: Ring | null, z0: number, z1: number) {
  const { HL, P, front } = c
  HL.put(b, HL.prism(P, front, ring, inner, z0, z1))
  b.top.setAttribute('d', HL.poly(HL.ringAt(P, ring, z1)))
}
export function lit(b: Block, on: boolean) {
  if (b.on === on) return
  b.on = on
  b.g.classList.toggle('acc', on)
}

/** a flat ring on the ground (or any height): a ripple, a halo, a track line */
export function flat(c: Ctx, ring: Ring, z: number) {
  return c.HL.poly(c.HL.ringAt(c.P, ring, z))
}

/** keep a list of elements painted back to front by a depth key (bigger = nearer) */
export function order(parent: Element, items: { el: Element; d: number }[]) {
  items.sort((a, b) => a.d - b.d)
  let prev: Element | null = null
  for (const it of items) {
    const want: ChildNode | null = prev ? prev.nextSibling : parent.firstChild
    if (want !== it.el) parent.insertBefore(it.el, want)
    prev = it.el
  }
}

export type Figure = { destroy: () => void }
