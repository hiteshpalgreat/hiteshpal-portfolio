/**
 * Selected projects, taken from the Framer site (hiteshpalgreat.framer.website).
 * Edit freely: order here is the order on the strip.
 *
 * layout picks how each panel is composed on the strip's centre line:
 *   'above'  - picture above the line, title across the line, words below
 *   'below'  - picture below the line, title across the line, words above
 *   'circle' - picture in a round frame sitting on the line
 */
export type SelectedProject = {
  title: string
  /** small line above the title: sector or client */
  kicker: string
  blurb: string
  img: string
  /** where "View project" goes */
  href: string
  linkLabel: string
  layout: 'above' | 'below' | 'circle'
}

export const SELECTED_LABEL = { index: '03', text: 'Selected work' }

export const SELECTED_INTRO = {
  title: ['Selected', 'Work'],
  lead: 'Five projects where brand, motion and product met a live audience.',
  hint: 'Drag to explore',
}

export const SELECTED_ARCHIVE = {
  title: ['The full', 'archive'],
  lead: 'Campaigns, identities, product work and motion: everything else lives on the archive.',
  href: 'https://hiteshpalgreat.framer.website/projects_hp',
  label: 'Explore the archive',
}

export const SELECTED: SelectedProject[] = [
  {
    title: 'Bingo Champions',
    kicker: 'Mobile game',
    blurb: 'Brand identity, UI animation, micro-interactions, game animations, and UGC ad production.',
    img: '/work/selected/bingo-champions.webp',
    href: 'https://hiteshpalgreat.framer.website/bingo-champion',
    linkLabel: 'View case study',
    layout: 'above',
  },
  {
    title: 'Gold Ahoy',
    kicker: 'iGaming platform',
    blurb: 'Complete rebranding across website, game skins, OOH, meta ads, and ongoing promotional creative for a live iGaming platform.',
    img: '/work/selected/gold-ahoy.webp',
    href: 'https://canva.link/1hke7sswwwi3af1',
    linkLabel: 'View project',
    layout: 'below',
  },
  {
    title: 'POCSO Awareness',
    kicker: 'Arunachal Pradesh Police',
    blurb: 'AI-generated awareness film series for Arunachal Pradesh Police, with full ownership across script, character design, and video production.',
    img: '/work/selected/pocso-awareness.webp',
    href: 'https://hiteshpalgreat.framer.website/pocso-awareness',
    linkLabel: 'View case study',
    layout: 'above',
  },
  {
    title: 'Karamba',
    kicker: 'iGaming platform',
    blurb: 'Dashboard design, website redesign, new brand mascot creation, and ongoing live campaign creative for an established iGaming platform.',
    img: '/work/selected/karamba.webp',
    href: 'https://drive.google.com/file/d/1Q8ZsogkDHT3cVjSr33RZiZ6A2BxO1A13/view?usp=drive_link',
    linkLabel: 'View project',
    layout: 'circle',
  },
  {
    title: 'Okto',
    kicker: 'Web3 investing',
    blurb: "Okto is a Web3 investment platform where I solved one of fintech's hardest UX problems.",
    img: '/work/selected/okto.webp',
    href: 'https://www.behance.net/gallery/197167795/Okto-App-UIUX-Case-Study-Promo-Video',
    linkLabel: 'View on Behance',
    layout: 'below',
  },
]
