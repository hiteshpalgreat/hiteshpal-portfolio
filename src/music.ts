import { showreel } from './showreel'

/**
 * Background music for the experience: one track, looping quietly. Browsers only allow sound after the
 * visitor has interacted with the page, so it starts (with a slow fade-in) on the first click, tap or key
 * press, if the visitor hasn't switched it off. The choice is remembered on this browser.
 * While the showreel on the iPad is playing with its sound on, the music dips out of the way.
 */
const SRC = '/audio/music.mp3'
const VOLUME = 0.16 // quiet: it's there for the mood, not to be listened to
const DUCKED = 0.025
const KEY = 'hp-music'

type Listener = (on: boolean) => void

class Music {
  private audio: HTMLAudioElement | null = null
  private wantOn = true
  private started = false
  private ducked = false
  private raf = 0
  private listeners = new Set<Listener>()

  constructor() {
    try {
      this.wantOn = localStorage.getItem(KEY) !== 'off'
    } catch {
      /* storage can be blocked; default to on */
    }
    const first = () => {
      window.removeEventListener('pointerdown', first, true)
      window.removeEventListener('keydown', first, true)
      this.started = true
      if (this.wantOn) this.play()
    }
    window.addEventListener('pointerdown', first, true)
    window.addEventListener('keydown', first, true)
    document.addEventListener('visibilitychange', () => {
      if (!this.audio) return
      if (document.hidden) this.audio.pause()
      else if (this.wantOn && this.started) this.audio.play().catch(() => {})
    })
  }

  private el() {
    if (!this.audio) {
      const a = new Audio(SRC)
      a.loop = true
      a.preload = 'auto'
      a.volume = 0
      this.audio = a
      // dip under the showreel's sound
      showreel().subscribe(() => {
        const v = showreel().video
        const duck = !v.muted && !v.paused
        if (duck !== this.ducked) {
          this.ducked = duck
          if (this.wantOn) this.fadeTo(duck ? DUCKED : VOLUME, 900)
        }
      })
    }
    return this.audio
  }

  private fadeTo(target: number, ms: number, then?: () => void) {
    const a = this.el()
    cancelAnimationFrame(this.raf)
    const from = a.volume
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      a.volume = Math.max(0, Math.min(1, from + (target - from) * p * p * (3 - 2 * p)))
      if (p < 1) this.raf = requestAnimationFrame(step)
      else then?.()
    }
    this.raf = requestAnimationFrame(step)
  }

  private play() {
    const a = this.el()
    a.play()
      .then(() => this.fadeTo(this.ducked ? DUCKED : VOLUME, 3500))
      .catch(() => {})
  }

  get on() {
    return this.wantOn
  }

  toggle() {
    this.wantOn = !this.wantOn
    try {
      localStorage.setItem(KEY, this.wantOn ? 'on' : 'off')
    } catch {
      /* not remembered, still works */
    }
    this.started = true
    if (this.wantOn) this.play()
    else if (this.audio) this.fadeTo(0, 600, () => this.audio?.pause())
    this.listeners.forEach((fn) => fn(this.wantOn))
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.wantOn)
    return () => {
      this.listeners.delete(fn)
    }
  }
}

let instance: Music | null = null
export function music() {
  if (!instance) instance = new Music()
  return instance
}
