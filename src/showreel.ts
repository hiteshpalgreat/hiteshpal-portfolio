/**
 * The showreels that play on the iPad in the room (and full screen as the iPad flies to the camera).
 * One shared <video>: muted by default, each reel plays through and the next one follows, in a loop.
 * Viewers can pause, skip between reels, seek, and switch the sound on from the controls.
 */
const REELS = [
  'https://res.cloudinary.com/jneg05aj/video/upload/v1785935706/_Showreel_v2__5_m1oufm.webm',
  'https://res.cloudinary.com/jneg05aj/video/upload/v1785239794/Showreel_2023_Hitesh_Pal_rc5tk2.webm',
  'https://res.cloudinary.com/jneg05aj/video/upload/v1795285606/Cardboard_2_2_xvszrp.webm',
]

// Safari (older versions) can't play WebM; Cloudinary serves the same reel as MP4 when the extension changes
const canWebm = typeof document !== 'undefined' && document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== ''
const src = (i: number) => (canWebm ? REELS[i] : REELS[i].replace(/\.webm$/, '.mp4'))

export type ReelState = { index: number; count: number; muted: boolean; paused: boolean; volume: number; rate: number }
type Listener = (s: ReelState) => void

class Showreel {
  readonly video: HTMLVideoElement
  private index = 0
  private wantSound = false // what the viewer chose
  private wantPaused = false
  private hidden = false // the room is off screen: stay silent whatever the choice
  private listeners = new Set<Listener>()

  constructor() {
    const v = document.createElement('video')
    Object.assign(v, { muted: true, playsInline: true, autoplay: true, crossOrigin: 'anonymous', preload: 'auto' })
    v.setAttribute('playsinline', '')
    v.src = src(0)
    v.addEventListener('ended', () => this.next())
    for (const ev of ['play', 'pause', 'volumechange', 'ratechange']) v.addEventListener(ev, () => this.emit())
    this.video = v
    document.addEventListener('visibilitychange', () => (document.hidden ? v.pause() : this.resume()))
  }

  /** keep playing unless the viewer paused it */
  resume() {
    if (!this.wantPaused) this.video.play().catch(() => {})
  }

  togglePlay() {
    this.wantPaused = !this.wantPaused
    if (this.wantPaused) this.video.pause()
    else this.video.play().catch(() => {})
    this.emit()
  }

  private load(i: number) {
    const rate = this.video.playbackRate
    this.index = (i + REELS.length) % REELS.length
    this.video.src = src(this.index)
    this.video.playbackRate = rate // the chosen speed carries over to the next reel
    this.wantPaused = false
    this.resume()
    this.emit()
  }

  next() {
    this.load(this.index + 1)
  }

  prev() {
    // like most players: back to the start if we're a few seconds in, else the previous reel
    if (this.video.currentTime > 3) this.video.currentTime = 0
    else this.load(this.index - 1)
  }

  seek(fraction: number) {
    const d = this.video.duration
    if (Number.isFinite(d) && d > 0) this.video.currentTime = Math.max(0, Math.min(d - 0.05, fraction * d))
  }

  /** jump by some seconds (negative goes back) */
  seekBy(seconds: number) {
    const v = this.video
    const d = Number.isFinite(v.duration) ? v.duration : 0
    v.currentTime = Math.max(0, Math.min(Math.max(0, d - 0.05), v.currentTime + seconds))
  }

  setRate(rate: number) {
    this.video.playbackRate = rate
    this.emit()
  }

  toggleSound() {
    this.wantSound = !this.wantSound
    if (this.wantSound && this.video.volume === 0) this.video.volume = 0.8
    this.apply()
  }

  setVolume(v: number) {
    this.video.volume = Math.max(0, Math.min(1, v))
    this.wantSound = v > 0
    this.apply()
  }

  /** silence the reel while the room is scrolled away, without forgetting the viewer's choice */
  setHidden(hidden: boolean) {
    if (hidden === this.hidden) return
    this.hidden = hidden
    this.apply()
  }

  private apply() {
    this.video.muted = !this.wantSound || this.hidden
    if (!this.video.muted) this.resume()
    this.emit()
  }

  get state(): ReelState {
    return { index: this.index, count: REELS.length, muted: !this.wantSound, paused: this.wantPaused, volume: this.video.volume, rate: this.video.playbackRate }
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.state)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit() {
    const s = this.state
    this.listeners.forEach((fn) => fn(s))
  }
}

let instance: Showreel | null = null
export function showreel() {
  if (!instance) instance = new Showreel()
  return instance
}
