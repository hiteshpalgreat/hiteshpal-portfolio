# About section

First section after the room (inside `<main id="main">`). Modelled on the "Design to delight, inspire and engage" block of labs.noomoagency.com.

## What happens as you scroll

- While the room breaks into dust, the background behind the dust turns from the room's night to a pale blue, and the top of this section fades into it, so there is no hard edge.
- The stage pins: a pale background (white with a touch of blue) with a fine dot grid, and Hitesh's photo standing on the bottom edge with a soft blue glow behind him.
- The phrases "No layers." / "No handoffs." / "No diluted" / "vision." behave like the faces of a turning cube behind the photo. Each one rises in from the bottom right, turned about 50 degrees away, straightens as it settles in the middle and holds for a few scrolls, then slides out to the left turning only about 24 degrees. The next phrase waits low on the right while the previous one leaves, then rises and settles.
- The words always stay behind the photo.
- The line about him sits on a frosted glass card at the bottom (Inter Medium). The card tips in 3D toward the pointer and catches a soft highlight where the pointer is.
- After the last phrase: a few scrolls where nothing moves, then the Clients section's Ottrly mark starts drawing on top of this stage. A few scrolls later the last phrase slides out and a pale veil fades in under the mark, which then fills and dives in (see CLIENTS_SECTION.md).
- "Skip to main content" and the eye button (top right) belong to the room and leave as soon as the page scrolls.

## Files

- `src/sections/about/aboutConfig.ts`: the phrases, the line, the photo path, and `ABOUT_SCROLL` (how long the phrases take, when the logo starts, when the veil comes in and how long it takes, and how long this stage stays pinned under the Clients transition).
- `src/sections/about/AboutStage.ts`: the phrases' path and turn (`ENTER_TURN`, `EXIT_TURN`) and the photo.
- `src/App.tsx` (`useDustScroll`): the night-to-pale-blue background behind the dust.
- `src/sections/about/AboutSection.tsx`: scroll progress, the veil and the glass card.
- `src/sections/about/about.css`: background, dots, glow, glass card and veil.
- `public/about/hitesh.webp`: the transparent portrait, full resolution (1398 x 1800), WebP quality 92, about 230 KB.

## Changing the photo

Export a transparent PNG, convert it to WebP (quality 90 to 92 keeps it visually identical), put it in `public/about/` and update `photo` in `aboutConfig.ts`. The photo is drawn with the exact colours of the file.
