import Lenis from 'lenis'
import gsap from 'gsap'

/**
 * Smooth, eased page scrolling (the same gliding feel as the Framer site).
 * Wheel and trackpad input is eased toward the target instead of jumping.
 * Off for visitors who ask for reduced motion.
 */
let lenis: Lenis | null = null

export function initSmoothScroll(reducedMotion: boolean) {
  if (reducedMotion || lenis) return () => {}
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true })
  const tick = (time: number) => lenis?.raf(time * 1000)
  gsap.ticker.add(tick)
  return () => {
    gsap.ticker.remove(tick)
    lenis?.destroy()
    lenis = null
  }
}

/** Lock or unlock scrolling (door intro, something in focus, arcade or screens). */
export function setScrollEnabled(on: boolean) {
  if (!lenis) return
  if (on) lenis.start()
  else lenis.stop()
}

/** Glide to an element (skip link, "Scroll for more"). Uses its layout position, ignoring parallax transforms. */
export function scrollToElement(el: HTMLElement, reducedMotion: boolean) {
  let top = 0
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) top += n.offsetTop
  if (lenis && !reducedMotion) {
    lenis.scrollTo(top, { duration: 2.4, force: true })
  } else {
    window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' })
  }
}

/** Glide to a page position (used by the Work section dots). */
export function scrollToY(top: number, reducedMotion: boolean, duration = 1.8) {
  // a gentle ease in and out, so long glides (the iPad flying to the showreel) never feel rushed
  const easing = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  if (lenis && !reducedMotion) lenis.scrollTo(top, { duration, easing, force: true })
  else window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' })
}
