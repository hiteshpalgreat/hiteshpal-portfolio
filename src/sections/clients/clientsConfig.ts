/**
 * Client logos for the Clients section. Files live in public/clients/ as white-on-transparent masks,
 * so the section can colour them (see --cl-ink in clients.css). To add one: put a white PNG or SVG
 * there and add a line here (ratio = width / height).
 */
export type ClientLogo = { src: string; name: string; ratio: number }

export const CLIENTS_LABEL = { index: '02', text: 'Clients' }

/** The big number and the line under it. */
export const CLIENTS_HEADLINE = { number: '23+', line1: 'brands and teams', line2: 'I’ve designed for.' }

export const CLIENT_LOGOS: ClientLogo[] = [
  { src: '/clients/aurm.png', name: 'Aurm', ratio: 2.767 },
  { src: '/clients/blockwee.png', name: 'Blockwee', ratio: 4.142 },
  { src: '/clients/ditto.png', name: 'Ditto', ratio: 2.967 },
  { src: '/clients/flybyhire.png', name: 'FlyByHire', ratio: 5.983 },
  { src: '/clients/elements91.png', name: 'elements91', ratio: 6.3 },
  { src: '/clients/hike.png', name: 'Hike', ratio: 2.325 },
  { src: '/clients/karamba.png', name: 'Karamba', ratio: 2.9 },
  { src: '/clients/bingo-champions.png', name: 'Bingo Champions', ratio: 1.883 },
  { src: '/clients/mfev.png', name: 'MFEV', ratio: 3.367 },
  { src: '/clients/okto.png', name: 'Okto', ratio: 2.983 },
  { src: '/clients/orel.png', name: 'Orel Group', ratio: 2.275 },
  { src: '/clients/qlux.png', name: 'QLUX', ratio: 3.825 },
  { src: '/clients/rush.png', name: 'Rush Pro', ratio: 5.567 },
  { src: '/clients/sandbox.png', name: 'The Sandbox', ratio: 3.35 },
  { src: '/clients/world-of-science.png', name: 'World of Science', ratio: 5.1 },
  { src: '/clients/gler.png', name: 'Gler', ratio: 7.117 },
  { src: '/clients/gold-ahoy.png', name: 'Gold Ahoy', ratio: 2.317 },
  { src: '/clients/trust.png', name: 'Trust', ratio: 3.625 },
  { src: '/clients/forvana.png', name: 'Forvana Gaming', ratio: 1.983 },
  { src: '/clients/and-payments.svg', name: 'And Payments', ratio: 2.596 },
  { src: '/clients/gamstop.svg', name: 'GAMSTOP', ratio: 3.141 },
]
