/**
 * Work section content. Edit this file to change titles, subtitles and the pieces in each spiral.
 *
 * Each category gets `count` cards. Real work goes in `items` (in order):
 * { src: '/work/creatives/01.webp', ratio: 4 / 5 }. Any card without an item keeps its placeholder,
 * so `count` can be bigger than the list. Right now every card has real work.
 * Motion cards: `src` is a poster image, `video` an 8 second muted webm preview that plays on the card. Images are webp,
 * about 900 px on the long side (product screens 1000 to 1200), in public/work/<category>/.
 * Product design: desktop screens are cropped from the top to 16:10, phone screens to 9:19.5.
 */

export type WorkItem = {
  /** image path (put files in public/work/...) */
  src?: string
  /** width / height of the piece, e.g. 9 / 16 for a story, 16 / 10 for a website */
  ratio?: number
  /** optional link when clicked */
  href?: string
  /** a short muted clip (webm) that plays on the card while it's on screen; `src` is its poster */
  video?: string
}

export type WorkCategory = {
  id: string
  title: string
  sub: string
  /** "View all" link */
  href: string
  count: number
  /** aspect ratios the placeholders cycle through (width / height) */
  ratios: number[]
  /** placeholder colours [from, to] */
  tint: [string, string]
  items?: WorkItem[]
}

export const WORK_LABEL = { index: '04', text: 'My Skills' }

/** the heading that introduces the spiral, right after Selected work */
export const SKILLS_HEADING = {
  title: 'My Skills',
  lead: 'What I make, by craft. Keep scrolling to fly through each one.',
}

export const WORK_CATEGORIES: WorkCategory[] = [
  {
    id: 'creatives',
    title: 'Static creatives',
    sub: '( campaign strategy · ads · posts · stories )',
    href: '#',
    count: 46,
    ratios: [4 / 5, 9 / 16, 1, 4 / 5, 1.91, 9 / 16, 4 / 5, 1],
    tint: ['#f2b36b', '#c2410c'],
    items: [
      { src: '/work/creatives/1426x960-03.webp', ratio: 1.4851 },
      { src: '/work/creatives/2-rog-aero-cooler.webp', ratio: 1.4151 },
      { src: '/work/creatives/4-in-1-unit.webp', ratio: 1 },
      { src: '/work/creatives/4-product-yellowline.webp', ratio: 1 },
      { src: '/work/creatives/7-aviram-studios-twitter.webp', ratio: 1 },
      { src: '/work/creatives/ace-ventura-v7.webp', ratio: 0.6656 },
      { src: '/work/creatives/astro-talk.webp', ratio: 3.0 },
      { src: '/work/creatives/banner-01.webp', ratio: 1.7787 },
      { src: '/work/creatives/banner-2.webp', ratio: 1.7787 },
      { src: '/work/creatives/banner-v5.webp', ratio: 1.6071 },
      { src: '/work/creatives/bento-grid.webp', ratio: 1.3333 },
      { src: '/work/creatives/bharatbox-1.webp', ratio: 0.5 },
      { src: '/work/creatives/bharatbox-2.webp', ratio: 1.7787 },
      { src: '/work/creatives/bharatbox-3.webp', ratio: 0.5622 },
      { src: '/work/creatives/bharatbox-4.webp', ratio: 0.5622 },
      { src: '/work/creatives/bharatbox-5.webp', ratio: 0.5622 },
      { src: '/work/creatives/bharatbox-6.webp', ratio: 1.7822 },
      { src: '/work/creatives/cash-royale.webp', ratio: 1.6014 },
      { src: '/work/creatives/diwali-post.webp', ratio: 1 },
      { src: '/work/creatives/ga-banner.webp', ratio: 1.4975 },
      { src: '/work/creatives/gold-ahoy-app-store.webp', ratio: 2.3077 },
      { src: '/work/creatives/goldahoy-carousel-banner-mobile-and-desktop-1440x403-x1.webp', ratio: 3.5714 },
      { src: '/work/creatives/hitwicket-landscape-v1.webp', ratio: 1.7787 },
      { src: '/work/creatives/hitwicket-v1.webp', ratio: 1 },
      { src: '/work/creatives/hitwicket-v3.webp', ratio: 1 },
      { src: '/work/creatives/karamba-cms.webp', ratio: 1.7787 },
      { src: '/work/creatives/landeed.webp', ratio: 1.7787 },
      { src: '/work/creatives/layout.webp', ratio: 0.5478 },
      { src: '/work/creatives/meta-promotion-1080x1080-x2.webp', ratio: 1 },
      { src: '/work/creatives/metavisio.webp', ratio: 1 },
      { src: '/work/creatives/mga-1024x512-x2.webp', ratio: 1.7751 },
      { src: '/work/creatives/mobile-banner.webp', ratio: 1 },
      { src: '/work/creatives/monthly-completed.webp', ratio: 1.4446 },
      { src: '/work/creatives/mtf-grid.webp', ratio: 1.5464 },
      { src: '/work/creatives/promotion1.webp', ratio: 0.8 },
      { src: '/work/creatives/railway-banner.webp', ratio: 0.5 },
      { src: '/work/creatives/railway-post-jpg.webp', ratio: 1 },
      { src: '/work/creatives/re-hunter.webp', ratio: 1.7787 },
      { src: '/work/creatives/re-banner.webp', ratio: 1.7787 },
      { src: '/work/creatives/red-post.webp', ratio: 1 },
      { src: '/work/creatives/rush-nation-1.webp', ratio: 2.0737 },
      { src: '/work/creatives/rush-nation-2.webp', ratio: 2.0737 },
      { src: '/work/creatives/screen-3.webp', ratio: 1.6514 },
      { src: '/work/creatives/the-souled-store-wakanda.webp', ratio: 0.6689 },
      { src: '/work/creatives/vlcsnap-2025-05-11-22h00m35s656.webp', ratio: 1.7787 },
      { src: '/work/creatives/weekly-completed.webp', ratio: 1.4446 },
    ],
  },
  {
    id: 'product',
    title: 'Product design',
    sub: '( web apps · dashboards · websites )',
    href: '#',
    count: 25,
    ratios: [16 / 10, 16 / 10, 9 / 19.5, 16 / 10, 4 / 3],
    tint: ['#fca5a5', '#7f1d1d'],
    items: [
      { src: '/work/product/aurm.webp', ratio: 16 / 10 },
      { src: '/work/product/bestcity.webp', ratio: 16 / 10 },
      { src: '/work/product/bharatbox-sandbox-ext.webp', ratio: 16 / 10 },
      { src: '/work/product/bingo-home.webp', ratio: 9 / 19.5 },
      { src: '/work/product/bingo-play.webp', ratio: 9 / 19.5 },
      { src: '/work/product/bonus.webp', ratio: 9 / 19.5 },
      { src: '/work/product/capyra-desktop-1.webp', ratio: 16 / 10 },
      { src: '/work/product/dark.webp', ratio: 16 / 10 },
      { src: '/work/product/desktop.webp', ratio: 16 / 10 },
      { src: '/work/product/desktophomepage.webp', ratio: 16 / 10 },
      { src: '/work/product/flipkart.webp', ratio: 16 / 10 },
      { src: '/work/product/fram-home.webp', ratio: 16 / 10 },
      { src: '/work/product/fram-profile.webp', ratio: 16 / 10 },
      { src: '/work/product/furnitra.webp', ratio: 16 / 10 },
      { src: '/work/product/gold-ahoy.webp', ratio: 16 / 10 },
      { src: '/work/product/graduation-proj40.webp', ratio: 16 / 10 },
      { src: '/work/product/hike-rushnation.webp', ratio: 16 / 10 },
      { src: '/work/product/image-6.webp', ratio: 16 / 10 },
      { src: '/work/product/lifepath.webp', ratio: 16 / 10 },
      { src: '/work/product/metafusion-career.webp', ratio: 16 / 10 },
      { src: '/work/product/nestasia.webp', ratio: 16 / 10 },
      { src: '/work/product/noon-app.webp', ratio: 9 / 19.5 },
      { src: '/work/product/sentient-chat.webp', ratio: 16 / 10 },
      { src: '/work/product/titanos.webp', ratio: 16 / 10 },
      { src: '/work/product/vasitum-lp.webp', ratio: 16 / 10 },
    ],
  },
  {
    id: 'brand',
    title: 'Brand identity',
    sub: '( logos · identity systems · guidelines )',
    href: '#',
    count: 10,
    ratios: [4 / 3, 1, 3 / 4, 4 / 3],
    tint: ['#f9a8d4', '#9d174d'],
    items: [
      { src: '/work/brand/brand-01.webp', ratio: 1.7787 },
      { src: '/work/brand/bingo-banner.webp', ratio: 1.4151 },
      { src: '/work/brand/bradnding-v2-logo-breakdown.webp', ratio: 1.4151 },
      { src: '/work/brand/campaign-1.webp', ratio: 1.4965 },
      { src: '/work/brand/cover.webp', ratio: 1.5 },
      { src: '/work/brand/ebb7db206344385-y3jvccwxmdy1ncw4mzm0ldczocww.webp', ratio: 1.2785 },
      { src: '/work/brand/present-2.webp', ratio: 1.4965 },
      { src: '/work/brand/present-3.webp', ratio: 1.4965 },
      { src: '/work/brand/vlcsnap-2026-11-21-01h56m30s415.webp', ratio: 1.7787 },
      { src: '/work/brand/vlcsnap-2026-11-21-04h34m26s648.webp', ratio: 1.7787 },
    ],
  },
  {
    id: 'motion',
    title: 'Motion & animation',
    sub: '( motion graphics · animation · promo videos )',
    href: '#',
    count: 32,
    ratios: [16 / 9, 9 / 16, 16 / 9, 1],
    tint: ['#c4b5fd', '#5b21b6'],
    items: [
      { src: '/work/motion/9-16-draft-v6.webp', video: '/work/motion/9-16-draft-v6.webm', ratio: 9 / 16 },
      { src: '/work/motion/ad3-9-16-1.webp', video: '/work/motion/ad3-9-16-1.webm', ratio: 9 / 16 },
      { src: '/work/motion/as-4-video-draft3.webp', video: '/work/motion/as-4-video-draft3.webm', ratio: 16 / 9 },
      { src: '/work/motion/aurm.webp', video: '/work/motion/aurm.webm', ratio: 16 / 9 },
      { src: '/work/motion/aurm-locker-animation-loop.webp', video: '/work/motion/aurm-locker-animation-loop.webm', ratio: 16 / 9 },
      { src: '/work/motion/banner.webp', video: '/work/motion/banner.webm', ratio: 2.5714 },
      { src: '/work/motion/sentient-ai-explainer.webp', video: '/work/motion/sentient-ai-explainer.webm', ratio: 16 / 9 },
      { src: '/work/motion/bira-gamified.webp', video: '/work/motion/bira-gamified.webm', ratio: 16 / 9 },
      { src: '/work/motion/gemini-nano-banana-concept.webp', video: '/work/motion/gemini-nano-banana-concept.webm', ratio: 16 / 9 },
      { src: '/work/motion/comp-2.webp', video: '/work/motion/comp-2.webm', ratio: 16 / 9 },
      { src: '/work/motion/cryptowallet-desktop.webp', video: '/work/motion/cryptowallet-desktop.webm', ratio: 2.0217 },
      { src: '/work/motion/devcon-8-day-1.webp', video: '/work/motion/devcon-8-day-1.webm', ratio: 1.7774 },
      { src: '/work/motion/draft-3-female.webp', video: '/work/motion/draft-3-female.webm', ratio: 1.7222 },
      { src: '/work/motion/draft-3-1.webp', video: '/work/motion/draft-3-1.webm', ratio: 16 / 9 },
      { src: '/work/motion/fashion-factory.webp', video: '/work/motion/fashion-factory.webm', ratio: 9 / 16 },
      { src: '/work/motion/gler-intro-video.webp', video: '/work/motion/gler-intro-video.webm', ratio: 16 / 9 },
      { src: '/work/motion/igdc-v3.webp', video: '/work/motion/igdc-v3.webm', ratio: 1.7775 },
      { src: '/work/motion/instagram-2.webp', video: '/work/motion/instagram-2.webm', ratio: 16 / 9 },
      { src: '/work/motion/kyc-explainer-mastercomp.webp', video: '/work/motion/kyc-explainer-mastercomp.webm', ratio: 9 / 16 },
      { src: '/work/motion/my-eitv2-2.webp', video: '/work/motion/my-eitv2-2.webm', ratio: 16 / 9 },
      { src: '/work/motion/myversionfbh.webp', video: '/work/motion/myversionfbh.webm', ratio: 1.7222 },
      { src: '/work/motion/nitish-ad3-1-1.webp', video: '/work/motion/nitish-ad3-1-1.webm', ratio: 1 },
      { src: '/work/motion/okto-app-my-edit.webp', video: '/work/motion/okto-app-my-edit.webm', ratio: 1.7775 },
      { src: '/work/motion/playable-ad3-pick-extra-time-v2.webp', video: '/work/motion/playable-ad3-pick-extra-time-v2.webm', ratio: 9 / 16 },
      { src: '/work/motion/stellar-bento-rebrand.webp', video: '/work/motion/stellar-bento-rebrand.webm', ratio: 1 },
      { src: '/work/motion/latentforce-launch.webp', video: '/work/motion/latentforce-launch.webm', ratio: 16 / 9 },
      { src: '/work/motion/spotify-ripoff.webp', video: '/work/motion/spotify-ripoff.webm', ratio: 16 / 9 },
      { src: '/work/motion/towpath-rebrand.webp', video: '/work/motion/towpath-rebrand.webm', ratio: 16 / 9 },
      { src: '/work/motion/version-3-draft-4.webp', video: '/work/motion/version-3-draft-4.webm', ratio: 16 / 9 },
      { src: '/work/motion/video-2-with-intro.webp', video: '/work/motion/video-2-with-intro.webm', ratio: 9 / 16 },
      { src: '/work/motion/video-18188.webp', video: '/work/motion/video-18188.webm', ratio: 1.7722 },
      { src: '/work/motion/video1subbedv3.webp', video: '/work/motion/video1subbedv3.webm', ratio: 16 / 9 },
    ],
  },
  {
    id: 'three',
    title: '3D visualization',
    sub: '( product renders · scenes · animation )',
    href: '#',
    count: 13,
    ratios: [4 / 5, 1, 16 / 9, 4 / 5],
    tint: ['#86efac', '#047857'],
    items: [
      { src: '/work/three/cityscape.webp', ratio: 0.75 },
      { src: '/work/three/f7sjeq0wkaelhvy.webp', ratio: 1.0 },
      { src: '/work/three/f9b-lxea4aaex7d.webp', ratio: 1.0 },
      { src: '/work/three/floating-rocks.webp', ratio: 0.75 },
      { src: '/work/three/forest-magic.webp', ratio: 0.75 },
      { src: '/work/three/galactic-v2.webp', ratio: 0.75 },
      { src: '/work/three/temple.webp', ratio: 0.7867 },
      { src: '/work/three/turbine-final-render-custom.webp', ratio: 0.75 },
      { src: '/work/three/vlcsnap-2025-05-10-16h16m06s191.webp', ratio: 1.7787 },
      { src: '/work/three/vlcsnap-2025-05-14-04h03m54s213.webp', ratio: 1.7787 },
      { src: '/work/three/three-11.webp', ratio: 0.7178 },
      { src: '/work/three/three-12.webp', ratio: 0.75 },
      { src: '/work/three/three-13.webp', ratio: 1.5 },
    ],
  },
]
