# Work section

A sticky, full-screen section modelled on the Work section of helloworlddsgn.com, placed on the home page right after the room (inside `<main id="main">`, so the skip link and "Scroll for more" lead to it).

- Entrance: the section starts dark; a feathered circle opens from the middle revealing the navy glow, while the first title rises from the bottom into place and the first spiral fills in card by card.
- Each category is a circular 3D spiral of work around a big title. Its cards pop in one after another, then scrolling flies through it (the cards stream past and swirl) and the next spiral fills in out of the dark, also card by card.
- Dots on the right show the category and jump to it.

## Files

- `src/sections/work/workConfig.ts`: titles, subtitles, "View all" links, how many pieces each category has, and your real images (`items`). The only file you need to edit for content.
- `src/sections/work/WorkSection.tsx`: the section (sticky stage, title block, dots, scroll mapping).
- `src/sections/work/WorkSpiral.ts`: the 3D spirals (three.js, own small renderer).
- `src/sections/work/work.css`: styles.
- Placed in the page by `MainContent` in `src/ui/Overlays.tsx`.

## Categories (placeholders)

| Category | Placeholders |
|---|---|
| Static creatives (campaign strategy · ads · posts · stories) | 66 |
| Product design | 24 |
| Brand identity | 12 |
| Motion & animation | 24 |
| 3D visualization | 12 |

## Adding real work

Put images in `public/work/<category>/`, then in `workConfig.ts` add them in order to that category's `items`:

```ts
items: [
  { src: '/work/creatives/01.webp', ratio: 4 / 5 },
  { src: '/work/creatives/02.webp', ratio: 9 / 16 },
],
```

Use webp, about 700 px on the long side. Slots without an item keep their placeholder.

## Typography

- Title: Coolvetica Heavy Compressed (the font Hello World uses). It is not bundled: if you have a licence for it, put the web font at `public/fonts/coolvetica-hv-comp.woff2`. Until then the title uses Anton (free, Google Fonts), which is very close.
- Everything else: Inter (13 px uppercase label with 0.14em tracking, 18.7 px subtitle, 16 px uppercase button).
- Colours: section `#051727` with a lighter navy glow in the middle; title and subtitle filled with a white to `#d0e8ff` gradient; button gradient `#1f52f6` to `#3b0de7`.

## Moving it

It currently sits right after the room, in `MainContent` (`src/ui/Overlays.tsx`). To move it, move `<WorkSection />` and keep `id="main"` on whatever comes right after the room. Change `WORK_LABEL` in `workConfig.ts` to its section number.
