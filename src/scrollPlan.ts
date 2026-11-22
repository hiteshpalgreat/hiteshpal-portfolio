/**
 * The scroll plan after the room (in screen heights):
 * FLY  - the iPad flies to the camera and the showreel grows to the full window
 * HOLD - the full-window showreel stays put
 * then the next section (My Approach) slides up over it.
 * Keep (FLY + HOLD + 1) in sync with .hero-track in styles.css.
 */
export const FLY = 1.3
export const HOLD = 1.1
/** where the showreel is fully on screen (used when the iPad is clicked) */
export const REEL_AT = FLY + 0.35
