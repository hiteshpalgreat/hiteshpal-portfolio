import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import content from '../content.json'

/**
 * The photo frame's photos, as a stack of prints on the table.
 * Click the top print (or press →) and it slides off and tucks in at the back; ← brings the last one back.
 * Photos come from content.json → photo_frame.photos: a path ("/photos/01.webp") or { src, title, caption }.
 * The title is written on the print; the caption of the photo on top shows under the stack.
 * Until there are photos, numbered placeholder prints stand in.
 */
type Photo = { src?: string; title?: string; caption?: string; tint?: string }

const PLACEHOLDER_TINTS = ['#6e2a3c', '#3d2a52', '#7a3b2e', '#2c3f4f', '#5a2a48']

function readPhotos(): Photo[] {
  const list = ((content as any).photo_frame?.photos ?? []) as (string | Photo)[]
  if (list.length) return list.map((p) => (typeof p === 'string' ? { src: p } : p))
  return PLACEHOLDER_TINTS.map((tint) => ({ tint }))
}

// a fixed, slightly messy lean for each depth in the stack
const LEAN = [-2, 3.5, -5, 4.5, -3, 6, -6.5, 2]

export function PhotoStack() {
  const open = useStore((s) => s.gallery)
  const reduced = useStore((s) => s.reducedMotion)
  const [photos] = useState(readPhotos)
  const [order, setOrder] = useState(() => photos.map((_, i) => i))
  const [leaving, setLeaving] = useState<number | null>(null) // the print sliding off the top
  const [arriving, setArriving] = useState<number | null>(null) // the print coming back onto the top
  const busy = useRef(false)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const swipe = useRef<{ x: number; id: number } | null>(null)
  // the prints are dealt in once when the stack opens; after that only flips animate
  const [dealt, setDealt] = useState(false)
  useEffect(() => {
    if (!open) return setDealt(false)
    const t = window.setTimeout(() => setDealt(true), 700 + photos.length * 70)
    return () => window.clearTimeout(t)
  }, [open, photos.length])

  const close = () => useStore.getState().set({ gallery: false })

  const next = () => {
    if (busy.current || photos.length < 2 || !dealt) return
    busy.current = true
    const top = order[0]
    setLeaving(top)
    window.setTimeout(
      () => {
        setOrder((o) => [...o.slice(1), o[0]])
        setLeaving(null)
        busy.current = false
      },
      reduced ? 0 : 420,
    )
  }

  const prev = () => {
    if (busy.current || photos.length < 2 || !dealt) return
    busy.current = true
    const last = order[order.length - 1]
    setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)])
    setArriving(last)
    window.setTimeout(
      () => {
        setArriving(null)
        busy.current = false
      },
      reduced ? 0 : 420,
    )
  }

  // keyboard: arrows flip, Esc closes (before the room's own Esc handler sees it)
  useEffect(() => {
    if (!open) return
    closeBtn.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        close()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const top = order[0]
  const n = photos.length
  const at = top + 1

  return (
    <div
      className={`photos ${open ? 'show' : ''} ${dealt ? 'dealt' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Photos from the frame on the desk"
      aria-hidden={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="ph-stack"
        onPointerDown={(e) => (swipe.current = { x: e.clientX, id: e.pointerId })}
        onPointerUp={(e) => {
          const s = swipe.current
          swipe.current = null
          if (!s || s.id !== e.pointerId) return
          const dx = e.clientX - s.x
          if (dx < -40) prev()
          else next()
        }}
      >
        {order.map((idx, depth) => {
          const p = photos[idx]
          const isLeaving = idx === leaving
          const isArriving = idx === arriving
          const d = Math.min(depth, 5)
          const lean = LEAN[idx % LEAN.length]
          const style = {
            zIndex: n - depth,
            '--lean': `${lean}deg`,
            '--dx': `${d * 7}px`,
            '--dy': `${d * -5}px`,
            '--s': `${1 - d * 0.035}`,
            '--deal': `${depth * 70}ms`,
            opacity: depth > 5 ? 0 : 1,
          } as React.CSSProperties
          return (
            <figure
              key={idx}
              className={`ph-print ${depth === 0 ? 'top' : ''} ${isLeaving ? 'leaving' : ''} ${isArriving ? 'arriving' : ''}`}
              style={style}
              aria-hidden={depth !== 0}
            >
              <div className="ph-img" style={p.tint ? { background: `radial-gradient(120% 90% at 30% 20%, ${p.tint}, #1a1018)` } : undefined}>
                {p.src ? (
                  <img src={p.src} alt={p.title ? `${p.title}. ${p.caption ?? ''}` : (p.caption ?? `Photo ${idx + 1}`)} draggable={false} loading="lazy" />
                ) : (
                  <span className="ph-placeholder">
                    Photo {String(idx + 1).padStart(2, '0')}
                    <small>your photo goes here</small>
                  </span>
                )}
              </div>
              <figcaption>{p.title ?? p.caption ?? ''}</figcaption>
            </figure>
          )
        })}
      </div>

      {photos[top]?.title && photos[top]?.caption && (
        <p className="ph-note" key={top} aria-live="polite">
          {photos[top].caption}
        </p>
      )}

      <div className="ph-bar">
        <button type="button" className="ph-btn" onClick={prev} aria-label="Previous photo" disabled={n < 2}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 5.5 8 12l6.5 6.5" />
          </svg>
        </button>
        <span className="ph-count" aria-live="polite">
          {String(at).padStart(2, '0')} <i>/</i> {String(n).padStart(2, '0')}
        </span>
        <button type="button" className="ph-btn" onClick={next} aria-label="Next photo" disabled={n < 2}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 5.5 16 12l-6.5 6.5" />
          </svg>
        </button>
      </div>

      <button type="button" ref={closeBtn} className="ph-close" onClick={close} aria-label="Close photos">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  )
}
