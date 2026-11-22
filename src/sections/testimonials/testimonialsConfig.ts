/**
 * Client testimonials, taken from Hitesh's Framer portfolio (hiteshpalgreat.framer.website).
 * Photos (and the Metafusion and XO logos) live in public/testimonials/; the other logos are the
 * ones already used by the Clients section in public/clients/.
 *
 * Layout: each card sits at `x` (% of the section width) and `y` (vh from the section top), is `w` px
 * wide, and scrolls at its own `speed` (positive = faster than the page, negative = slower), which
 * gives the floating collage its depth. `depth` scales how much it drifts with the pointer.
 */
export type Testimonial = {
  name: string
  role: string
  quote: string
  photo: string
  logo: string
  x: number
  y: number
  w: number
  speed: number
  depth: number
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Yatin Kavishwar',
    role: 'CEO & Founder, Metafusion',
    quote:
      'Hitesh has been with us since the beginning and played a key role in our growth. His creativity, versatility, and ability to manage multiple responsibilities make him someone every team would value.',
    photo: '/testimonials/yatin.webp',
    logo: '/testimonials/metafusion.webp',
    x: 3, y: 10, w: 290, speed: 0.35, depth: 1.2,
  },
  {
    name: 'Kevin Bharti',
    role: 'CEO, Hike Pvt Ltd',
    quote:
      'Hitesh is an exceptionally quick learner. Within weeks, he was handling key projects with confidence. His creative judgment across UI/UX, animation, and storytelling consistently exceeded expectations.',
    photo: '/testimonials/kevin.webp',
    logo: '/clients/hike.png',
    x: 40, y: 70, w: 270, speed: -0.15, depth: 0.6,
  },
  {
    name: 'Bhushan Suda',
    role: 'Co-Founder, Blockwee',
    quote:
      "Hitesh is approachable, transparent, and always has a solution ready. If you have a last-minute deadline, he's probably the person to call. Just use that lifeline wisely because once you work with him, you'll keep coming back.",
    photo: '/testimonials/bhushan.webp',
    logo: '/clients/blockwee.png',
    x: 75, y: 4, w: 300, speed: 0.55, depth: 1.5,
  },
  {
    name: 'Saurabh Saggar',
    role: 'CMO, Orel Corporation',
    quote:
      'Hitesh transformed my idea into stunning 3D advertisements within a week. His attention to detail, speed, and professionalism made the entire process effortless. The final output was beyond what I had imagined.',
    photo: '/testimonials/saurabh.webp',
    logo: '/clients/orel.png',
    x: 6, y: 112, w: 280, speed: 0.25, depth: 1,
  },
  {
    name: 'Sami Waittinen',
    role: 'CMO, Trust Wallet',
    quote:
      'From planning and filming to editing and delivery, Hitesh handled our event flawlessly. His professionalism and ownership gave us complete confidence throughout the project. Highly recommended.',
    photo: '/testimonials/sami.webp',
    logo: '/clients/trust.png',
    x: 73, y: 100, w: 290, speed: 0.45, depth: 1.3,
  },
  {
    name: 'Suraj Sharma',
    role: 'Founder, XO',
    quote:
      'As a startup founder, trust is everything, and Hitesh earned it quickly. His storytelling, motion graphics, and editing helped us communicate our product with clarity and impact. I highly recommend working with him.',
    photo: '/testimonials/suraj.webp',
    logo: '/testimonials/xo.webp',
    x: 41, y: 150, w: 290, speed: 0.1, depth: 0.8,
  },
]

/** words that run around the spinning badge */
export const BADGE_TEXT = 'KIND WORDS FROM CLIENTS · CLIENT LOVE · '
