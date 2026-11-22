import { useEffect, useState } from 'react'
import { music } from '../music'
import { useStore } from '../store'

/** Bottom-left: the music switch. A little live waveform while it plays, flat bars when it's off. */
export function MusicToggle() {
  const ready = useStore((s) => s.ready)
  const [on, setOn] = useState(() => music().on)
  useEffect(() => music().subscribe(setOn), [])
  if (!ready) return null
  return (
    <button
      type="button"
      className={`music-toggle ${on ? 'on' : ''}`}
      onClick={() => music().toggle()}
      aria-pressed={on}
      aria-label={on ? 'Music on. Turn the music off' : 'Music off. Turn the music on'}
    >
      <span className="mt-wave" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} style={{ '--i': i } as React.CSSProperties} />
        ))}
      </span>
      <span className="mt-label">{on ? 'Music On' : 'Music Off'}</span>
    </button>
  )
}
