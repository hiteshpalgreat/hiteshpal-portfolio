import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { ParticleGlobe, type GlobeTone } from '../sections/globe/ParticleGlobe'
import source from '../sections/globe/ParticleGlobe.ts?raw'

/**
 * The vertical screen's code view: like an editor split in two, the full source on the left and the
 * piece it draws running on the right (the Ottrly particle globe). On phones the output sits on top
 * and the code scrolls under it. Esc, the close button or a click outside closes it.
 */
const FILE = 'ParticleGlobe.ts'

// --- a small TypeScript highlighter: comments, strings, numbers, keywords, types, calls ---
const KEYWORDS = new Set(
  'import export from const let var function return if else for while do break continue new class private public protected readonly static extends implements type interface of in as typeof instanceof void null undefined true false this super try catch finally throw async await default switch case'.split(
    ' ',
  ),
)
const TOKEN =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?(?:e[-+]?\d+)?\b)|([A-Za-z_$][\w$]*)|([^\sA-Za-z_$\d'"`/]+|\/)/g

type Tok = { t: string; c: string }

function highlight(code: string): Tok[][] {
  const lines: Tok[][] = [[]]
  const push = (text: string, c: string) => {
    const parts = text.split('\n')
    parts.forEach((p, i) => {
      if (i > 0) lines.push([])
      if (p) lines[lines.length - 1].push({ t: p, c })
    })
  }
  let last = 0
  for (const m of code.matchAll(TOKEN)) {
    const i = m.index ?? 0
    if (i > last) push(code.slice(last, i), '')
    const [text, comment, str, num, word] = m
    let c = ''
    if (comment) c = 'lab-com'
    else if (str) c = 'lab-str'
    else if (num) c = 'lab-num'
    else if (word) {
      if (KEYWORDS.has(word)) c = 'lab-kw'
      else if (/^[A-Z]/.test(word)) c = 'lab-type'
      else if (code[i + word.length] === '(') c = 'lab-fn'
    }
    push(text, c)
    last = i + text.length
  }
  if (last < code.length) push(code.slice(last), '')
  return lines
}

const TONES: GlobeTone[] = ['pink', 'blue', 'white']

export function CodeLab() {
  const open = useStore((s) => s.codeLab)
  const out = useRef<HTMLDivElement>(null)
  const globe = useRef<ParticleGlobe | null>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const win = useRef<HTMLDivElement>(null)
  const [tone, setTone] = useState<GlobeTone>('pink')
  const [copied, setCopied] = useState(false)
  const lines = useMemo(() => highlight(source.replace(/\s+$/, '')), [])

  const close = () => useStore.getState().set({ codeLab: false })

  // the globe runs only while the view is open
  useEffect(() => {
    if (!open || !out.current) return
    const g = new ParticleGlobe(out.current, { tone })
    globe.current = g
    // move focus into the dialog (the window itself, so no button lights up)
    win.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      g.destroy()
      globe.current = null
    }
    // the tone is passed on below without rebuilding
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => globe.current?.setTone(tone), [tone])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div
      className={`codelab ${open ? 'open' : ''}`}
      // the page's smooth scroll is paused while this is open and would swallow the wheel: let the code scroll natively
      data-lenis-prevent
      role="dialog"
      aria-modal="true"
      aria-label="Ottrly particle globe: code and output"
      aria-hidden={!open}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      {open && (
        <div className="lab-win" ref={win} tabIndex={-1}>
          <div className="lab-pane lab-code">
            <div className="lab-bar">
              <span className="lab-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="lab-tab on">{FILE}</span>
              <span className="lab-meta">{lines.length} lines · TypeScript</span>
              <button type="button" className="lab-copy" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="lab-src" tabIndex={0} aria-label={`${FILE} source`}>
              <code>
                {lines.map((toks, i) => (
                  <span className="lab-line" key={i}>
                    <span className="lab-ln" aria-hidden>
                      {i + 1}
                    </span>
                    <span className="lab-txt">
                      {toks.length
                        ? toks.map((tk, j) =>
                            tk.c ? (
                              <span key={j} className={tk.c}>
                                {tk.t}
                              </span>
                            ) : (
                              tk.t
                            ),
                          )
                        : ' '}
                    </span>
                  </span>
                ))}
              </code>
            </pre>
          </div>
          <div className="lab-pane lab-out">
            <div className="lab-bar">
              <span className="lab-tab on">Output</span>
              <span className="lab-live" aria-hidden>
                <i /> live
              </span>
              <div className="lab-tones" role="group" aria-label="Colour">
                {TONES.map((t) => (
                  <button key={t} type="button" aria-pressed={tone === t} onClick={() => setTone(t)}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <button ref={closeBtn} type="button" className="lab-close" onClick={close} aria-label="Close">
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className={`lab-stage tone-${tone}`} ref={out} aria-hidden />
            <p className="lab-note">Move your pointer over the globe. The dots part around it and flow back.</p>
          </div>
        </div>
      )}
    </div>
  )
}
