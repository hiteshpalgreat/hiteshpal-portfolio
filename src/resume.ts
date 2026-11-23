import { useStore } from './store'
import { finishIntro } from './interaction/intro'
import { jumpToY } from './smoothScroll'

/**
 * Reloading the page continues from where the visitor was, instead of starting over at the door.
 * Only a reload does this: a new visit (typed URL, link, new tab) still starts at the door.
 * The position lives in sessionStorage, so it belongs to this tab only.
 */
const KEY = 'hp-resume'
let resumeY: number | null = null

function isReload() {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav) return nav.type === 'reload'
    return (performance as any).navigation?.type === 1
  } catch {
    return false
  }
}

/** Called once at startup, before anything renders. */
export function readResume() {
  try {
    const saved = sessionStorage.getItem(KEY)
    if (saved !== null && isReload()) resumeY = Math.max(0, Number(saved) || 0)
  } catch {
    /* storage can be blocked; then every load starts at the door */
  }
  startSaving()
}

function save() {
  try {
    // only once inside the room: before that there is nothing to come back to
    if (useStore.getState().stage === 'room') sessionStorage.setItem(KEY, String(Math.round(window.scrollY)))
  } catch {
    /* ignore */
  }
}

function startSaving() {
  let pending = false
  window.addEventListener(
    'scroll',
    () => {
      if (pending) return
      pending = true
      window.setTimeout(() => {
        pending = false
        save()
      }, 200)
    },
    { passive: true },
  )
  window.addEventListener('pagehide', save)
  // entering the room counts as a place to come back to, even before scrolling
  useStore.subscribe((s, prev) => {
    if (s.stage === 'room' && prev.stage !== 'room') save()
  })
  // once the room has loaded: step straight in and scroll back to where the visitor was
  const unsub = useStore.subscribe((s) => {
    if (!s.ready || resumeY === null) return
    unsub()
    const y = resumeY
    resumeY = null
    finishIntro()
    // wait for the page to allow scrolling and lay out, then jump; once more a little later in case
    // anything above the spot was still settling
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        jumpToY(y)
        window.setTimeout(() => jumpToY(y), 500)
      }),
    )
  })
}

/** true while a reload is about to resume (lets the door hint stay hidden) */
export function isResuming() {
  return resumeY !== null
}
