import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import './stats.css'

/**
 * The numbers, between Clients and Selected work. Each one counts up from zero the first time the band
 * comes into view, one after another. Edit STATS to change them.
 */
export const STATS = [
  { value: 23, suffix: '+', label: 'Global clients' },
  { value: 72, suffix: '%', label: 'Repeat clients' },
  { value: 56, suffix: '+', label: 'Successful projects' },
  { value: 99, suffix: '%', label: 'Success rate' },
]

export function StatsSection() {
  const reduced = useStore((s) => s.reducedMotion)
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(STATS.map(() => 0))
  const [on, setOn] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        setOn(true)
        if (reduced) return setShown(STATS.map((s) => s.value))
        const t0 = performance.now()
        const ease = (t: number) => 1 - Math.pow(1 - t, 4)
        const step = () => {
          const now = performance.now()
          let done = true
          setShown(
            STATS.map((s, i) => {
              const t = Math.min(1, Math.max(0, (now - t0 - i * 160) / 1600))
              if (t < 1) done = false
              return Math.round(s.value * ease(t))
            }),
          )
          if (!done) raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [reduced])

  return (
    <section className={`stats ${on ? 'is-on' : ''}`} ref={ref} aria-label="In numbers">
      <ul className="stats-list">
        {STATS.map((s, i) => (
          <li className="stat" key={s.label} style={{ '--i': i } as React.CSSProperties}>
            {/* screen readers hear the final figure, not the count */}
            <span className="stat-num" aria-hidden="true">
              {shown[i]}
              <span className="stat-suffix">{s.suffix}</span>
            </span>
            <span className="visually-hidden">
              {s.value}
              {s.suffix}
            </span>
            <span className="stat-label">{s.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
