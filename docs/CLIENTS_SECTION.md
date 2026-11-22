# Clients section

Comes right after the About section (inside `<main id="main">`, in `MainContent` in `src/ui/Overlays.tsx`). Page order: Room, (01) About, (02) Clients, (03) Work. Modelled on the logo transition of learnwithzero.com.

## What happens as you scroll

1. The transition starts while the About section is still on screen. The Clients section is pulled up over the end of About (`marginTop` from `ABOUT_SCROLL` in `src/sections/about/aboutConfig.ts`) with a see-through stage, so a few scrolls after the last About phrase has settled, the Ottrly mark (the otter face) draws itself in navy as a thin outline over About's pale stage, face first, whiskers just after.
2. A few scrolls in, the About section's pale veil fades in underneath the mark (the last phrase and the photo go), and the mark fills in solid navy.
3. The view dives into the otter's nose until the navy covers the whole screen; that becomes this section's background, and the same blue glow as the Work section fades in.
4. Only once the dive is complete and the mark has gone, "23+ / brands and teams I've designed for." fades up, and three curved rows of client logos (pale blue) sweep in along a cylinder: the top and bottom rows fill in from the right and run round the curve to the left, the middle row from the left to the right. They arrive fast for about a second, ease down, then keep drifting slowly the same way. Logos always face straight; they only get smaller toward the sides.
   Each row has its own shuffled order and starts from a different part of the list, so the rows show different logos at the same time. A few logos appear twice in a row, but always on the far side of the cylinder, never on screen together.
5. The background fades to plain navy at the bottom edge, so it runs straight into the Work section.

Steps 1 to 3 follow the scroll position exactly and are drawn on a canvas, so scrolling back and forth stays clean. The rows replay their entrance if you scroll back above the section and down again.

## Files

- `src/sections/clients/ClientsSection.tsx`: the section (scroll timing at the top of the file).
- `src/sections/clients/clientsConfig.ts`: the logo list, the headline line and the "(02) Clients" label. The big number ("23+") is set there too, as `CLIENTS_HEADLINE.number`.
- `src/sections/clients/ottrlyMark.ts`: the otter paths from `Ottrly.svg`, and the point in the nose the zoom goes into.
- `src/sections/clients/clients.css`: colours and type (`--cl-navy`, `--cl-ink`, the glow in `.cl-glow`).
- `public/clients/`: the 21 logos, converted to white-on-transparent masks so they can be shown in one colour. Okto, Rush Pro and Gold Ahoy keep their inner details as cut-outs or shading.

## Adding or changing a logo

Export it as a white (or any colour) PNG or SVG on a transparent background, put it in `public/clients/`, and add a line to `clientsConfig.ts` with its width / height ratio.
