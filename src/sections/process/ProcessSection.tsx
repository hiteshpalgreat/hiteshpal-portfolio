import { useEffect, useRef } from 'react'
import { mountFigure, type FigureName } from './hairline'
import './process.css'

/**
 * The design process as a bento of five tiles, each with a small living isometric scene that also answers
 * the pointer. Tiles drift in from their own offsets as they scroll into view and settle into a clean grid.
 */
const STEPS: { fig: FigureName; title: string; text: string; area: string; art: string; drift: number }[] = [
  {
    fig: 'empathize',
    title: 'Empathize',
    text: 'I start by listening: interviews, data and the product as its users live it, until their goals and frustrations feel like mine.',
    area: 'a',
    art: 'Pawns on a game board; one speaks up and the others hop to listen.',
    drift: -18,
  },
  {
    fig: 'define',
    title: 'Define',
    text: 'Everything I learned is narrowed down to one clear problem, with the constraints and the measure of success the team agrees on.',
    area: 'b',
    art: 'A stack of plates narrowing to a point, with ideas dropping onto it.',
    drift: 26,
  },
  {
    fig: 'ideate',
    title: 'Ideate',
    text: 'Wide and fast: sketches, moodboards and rough flows. Plenty of ideas first, so the strongest ones have room to stand out.',
    area: 'c',
    art: 'A board of hex tiles where ideas spark up and glow.',
    drift: 10,
  },
  {
    fig: 'refine',
    title: 'Refine',
    text: 'The chosen direction is shaped pass by pass, from wireframe to polished design, until type, spacing and detail line up.',
    area: 'd',
    art: 'A rough stack of slabs pulled into line by a glowing scan plane.',
    drift: -12,
  },
  {
    fig: 'iterate',
    title: 'Test & Iterate',
    text: 'Prototypes go in front of real people. What I learn feeds the next round, and every loop makes the product sharper.',
    area: 'e',
    art: 'A race circuit where every lap makes the pylons grow.',
    drift: 20,
  },
]

function Tile({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const tile = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stage.current
    const box = tile.current
    if (!el || !box) return
    const fig = mountFigure(step.fig, el, step.art)
    let settle = 0
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          box.classList.add('in')
          io.disconnect()
          // once it has landed, drop the slow transition so the parallax follows the scroll directly
          settle = window.setTimeout(() => box.classList.add('settled'), 1300 + index * 110)
        }
      },
      { threshold: 0.04, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(box)
    return () => {
      io.disconnect()
      window.clearTimeout(settle)
      fig.destroy()
    }
  }, [step, index])

  return (
    <article
      ref={tile}
      className={`pr-tile pr-${step.area}`}
      style={{ gridArea: step.area, '--i': index, '--drift': step.drift } as React.CSSProperties}
    >
      <div className="pr-fig">
        <div ref={stage} className="pr-stage" />
      </div>
      <div className="pr-copy">
        <h3 className="pr-title">{step.title}</h3>
        <p className="pr-text">{step.text}</p>
      </div>
    </article>
  )
}

export function ProcessSection() {
  return (
    <section className="process" id="process" aria-labelledby="pr-heading">
      {/* shared paints for the illustrations */}
      <svg className="pr-defs" aria-hidden="true" width="0" height="0">
        <defs>
          <linearGradient id="prTop" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb3c8" />
            <stop offset="0.55" stopColor="#ff5d8f" />
            <stop offset="1" stopColor="#e0386b" />
          </linearGradient>
          <linearGradient id="prSide" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e0386b" />
            <stop offset="1" stopColor="#8e1538" />
          </linearGradient>
          <linearGradient id="prLaser" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff5d8f" stopOpacity="0.05" />
            <stop offset="0.5" stopColor="#ff5d8f" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ff9a5d" stopOpacity="0.08" />
          </linearGradient>
        </defs>
      </svg>
      <div className="pr-intro">
        <span className="pr-eyebrow">( how I work )</span>
        <h2 className="pr-heading" id="pr-heading">
          Design <em>Process</em>
        </h2>
        <p className="pr-lede">Five steps, one loop. Each little world is alive; hover one to play with it.</p>
      </div>
      <div className="pr-grid">
        {STEPS.map((s, i) => (
          <Tile key={s.fig} step={s} index={i} />
        ))}
      </div>
    </section>
  )
}
