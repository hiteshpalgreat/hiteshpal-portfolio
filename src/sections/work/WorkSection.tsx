import { useEffect, useMemo, useRef, useState } from 'react'
import { WorkSpiral } from './WorkSpiral'
import { SKILLS_HEADING, WORK_CATEGORIES, WORK_LABEL } from './workConfig'
import { scrollToY } from '../../smoothScroll'
import './work.css'

/**
 * Work section: a sticky full-screen stage. Scrolling flies through one spiral of work per
 * category; each category's title sits in the middle of its spiral, then fades as its
 * cards stream past and the next spiral grows out of the dark.
 *
 * Drop <WorkSection /> anywhere in the page. Content lives in workConfig.ts.
 */

// scroll budget, in screen heights
const INTRO = 0.7 // the first spiral fills in while the circular reveal opens
const DWELL = 0.6 // title held still
const FLY_PER_UNIT = 0.3 // flying through a spiral, per world unit of depth
const TRAVEL = 1.0 // from the end of one spiral to the next title
const TAIL = 0.5 // after the last spiral

type Key = { s: number; z: number }

function buildKeys(stops: { approachZ: number; holdZ: number; endZ: number }[]) {
  const keys: Key[] = [{ s: 0, z: stops[0].approachZ }]
  const segStart: number[] = [] // where each category's part of the scroll begins
  let s = INTRO
  stops.forEach((st, k) => {
    if (k > 0) {
      segStart.push(s)
      s += TRAVEL
    } else segStart.push(0)
    keys.push({ s, z: st.holdZ })
    s += DWELL
    keys.push({ s, z: st.holdZ })
    s += (st.holdZ - st.endZ) * FLY_PER_UNIT
    keys.push({ s, z: st.endZ })
  })
  s += TAIL
  keys.push({ s, z: stops[stops.length - 1].endZ })
  // the scroll position where each title is fully shown (for the dots)
  const holdAt = keys.filter((_, i) => i % 3 === 1).map((k) => k.s)
  return { keys, total: s, segStart, holdAt }
}

function zAt(keys: Key[], s: number) {
  if (s <= keys[0].s) return keys[0].z
  for (let i = 1; i < keys.length; i++) {
    if (s <= keys[i].s) {
      const a = keys[i - 1]
      const b = keys[i]
      const t = (s - a.s) / Math.max(1e-6, b.s - a.s)
      const e = t * t * (3 - 2 * t) // ease each leg
      return a.z + (b.z - a.z) * e
    }
  }
  return keys[keys.length - 1].z
}

const smooth = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function WorkSection() {
  const section = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const copy = useRef<HTMLDivElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const engine = useRef<WorkSpiral | null>(null)
  const [active, setActive] = useState(0)
  const [shown, setShown] = useState(0)
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const plan = useRef<ReturnType<typeof buildKeys> | null>(null)
  const [heightVh, setHeightVh] = useState(1000)

  useEffect(() => {
    const el = canvas.current!
    const fx = new WorkSpiral(el, WORK_CATEGORIES, reduced)
    if (location.search.includes('test')) (window as any).__workFx = fx
    engine.current = fx
    const p = buildKeys(fx.stops)
    plan.current = p
    setHeightVh(Math.round((p.total + 1) * 100))

    const fit = () => fx.resize(el.clientWidth, el.clientHeight)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)

    // only render while the section is on screen
    const io = new IntersectionObserver(([e]) => fx.setRunning(e.isIntersecting), { rootMargin: '100px' })
    // start fetching the real images a couple of screens before the spiral is reached
    const near = new IntersectionObserver(([e]) => e.isIntersecting && (fx.loadImages(), near.disconnect()), { rootMargin: '200% 0px' })
    io.observe(section.current!)
    near.observe(section.current!)

    let lastShown = -1
    let lastActive = -1
    const onScroll = () => {
      const sec = section.current
      if (!sec || !plan.current) return
      const vh = window.innerHeight
      const s = Math.max(0, -sec.getBoundingClientRect().top / vh)
      const z = zAt(plan.current.keys, s)
      fx.setCameraZ(z)
      // which title is visible, and how much
      let best = 0
      let bestO = 0
      fx.stops.forEach((st, k) => {
        const d = z - st.holdZ // > 0 while approaching, < 0 once inside the spiral
        const o = d >= 0 ? 1 - smooth(d, 0.35, 2.3) : 1 - smooth(-d, 0.25, 1.1)
        if (o > bestO) {
          bestO = o
          best = k
        }
      })
      // entrance: a feathered circle opens from the middle, and the first title rises into place
      // starts opening while the stage is still sliding up into view, so the cards follow the heading closely
      const intro = smooth(s, -0.55, INTRO * 0.9)
      if (scene.current) {
        if (intro < 1) {
          const r = (intro * 120).toFixed(2)
          const m = `radial-gradient(circle at 50% 52%, #000 calc(${r}vmax - 14vmax), transparent ${r}vmax)`
          scene.current.style.maskImage = m
          scene.current.style.webkitMaskImage = m
        } else {
          scene.current.style.maskImage = ''
          scene.current.style.webkitMaskImage = ''
        }
      }
      let lift = (1 - bestO) * 18
      let o = bestO
      if (best === 0 && s < INTRO) {
        o = 0.08 + 0.92 * intro
        lift = (1 - intro) * vh * 0.42
      }
      if (copy.current) {
        copy.current.style.opacity = o.toFixed(3)
        copy.current.style.transform = `translate(-50%, -50%) translateY(${lift.toFixed(1)}px)`
        copy.current.style.pointerEvents = o > 0.5 ? 'auto' : 'none'
      }
      if (best !== lastShown) {
        lastShown = best
        setShown(best)
      }
      let a = 0
      plan.current.segStart.forEach((st, k) => {
        if (s >= st) a = k
      })
      if (a !== lastActive) {
        lastActive = a
        setActive(a)
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ro.disconnect()
      io.disconnect()
      near.disconnect()
      fx.dispose()
      engine.current = null
    }
  }, [reduced])

  const goTo = (k: number) => {
    const sec = section.current
    const p = plan.current
    if (!sec || !p) return
    const top = sec.getBoundingClientRect().top + window.scrollY
    scrollToY(top + p.holdAt[k] * window.innerHeight + 2, reduced)
  }

  const cat = WORK_CATEGORIES[shown]
  return (
    <section className="works" id="skills" ref={section} aria-labelledby="skills-heading" style={{ height: `${heightVh}vh` }}>
      <div className="works-stage">
        <div className="works-scene" ref={scene}>
          <canvas className="works-gl" ref={canvas} aria-hidden="true" />
        </div>
        <p className="works-note">
          <span>({WORK_LABEL.index})</span> {WORK_LABEL.text}
        </p>
        <div className="works-copy" ref={copy}>
          <h2 className="works-title" id="work-title" style={{ fontSize: `calc(min(10vw, 144px) * ${Math.min(1, 16 / cat.title.length).toFixed(3)})` }}>
            {cat.title}
          </h2>
          <p className="works-sub">{cat.sub}</p>
          <a className="works-btn" href={cat.href}>
            View all
            <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
        <nav className="works-dots" aria-label="Work categories">
          {WORK_CATEGORIES.map((c, k) => (
            <button key={c.id} type="button" className={k === active ? 'on' : ''} aria-label={c.title} aria-current={k === active} onClick={() => goTo(k)} />
          ))}
        </nav>
      </div>
    </section>
  )
}

/** "My Skills": the heading between Selected work and the spiral of skills below it. */
export function SkillsHeading() {
  return (
    <header className="skills-head">
      <span className="skills-line" aria-hidden="true" />
      <p className="skills-note">
        <span>({WORK_LABEL.index})</span> {WORK_LABEL.text}
      </p>
      <h2 className="skills-title" id="skills-heading">
        {SKILLS_HEADING.title}
      </h2>
      <p className="skills-lead">{SKILLS_HEADING.lead}</p>
    </header>
  )
}
