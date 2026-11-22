/**
 * About section content. Edit the phrases, the line and the photo here.
 *
 * `phrases` ride round the turning drum one after another, like Noomo Labs'
 * "Design to / delight / inspire / and engage". Keep each one short (about 12 letters at most).
 */
export const ABOUT = {
  label: { index: '01', text: 'About' },
  phrases: ['Design', 'to solve', 'real-world', 'problems'],
  /** the name above the photo, and the title over it (the D of Designer is set in a script face) */
  hello: "I'm Hitesh Pal",
  title: ['Visual', 'Communication', 'Designer'],
  /** the glass card under the photo, one entry per line */
  line: ['4+ years across branding, motion, UI/UX and AI-driven creative', 'Building brands from scratch.'],
  /** transparent portrait, full resolution webp */
  photo: '/about/hitesh.webp',
}

/**
 * Scroll budget, in screen heights (all measured from when the About stage pins).
 *  length: the phrases come in one after another while the stage is pinned
 *  lead:   a few scrolls with the last phrase in place, then the Ottrly mark starts drawing on top
 *          (the Clients section starts at length + lead)
 *  veil:   a few scrolls after the mark has started, the last phrase slides out and a pale veil
 *          fades in under the mark (starts at length + veil, takes `fade`)
 *  tail:   how long the About stage stays pinned underneath while the Clients transition plays over it
 * The Clients section is pulled up over this section by (tail + 1 - lead) screens.
 */
export const ABOUT_SCROLL = { length: 4, lead: 0.5, veil: 1.0, fade: 0.8, tail: 2.95 }
