# Hittu's Room: Interaction Spec (for Antigravity)

This file goes next to `room_v6_baked.glb` and tells the agent exactly how the 3D room on the portfolio home screen should behave. Desktop first; mobile comes later.

## 1. Stack

- Vite + React + TypeScript
- `three`, `@react-three/fiber`, `@react-three/drei`
- `@react-three/postprocessing` (Outline, Bloom, DepthOfField, ChromaticAberration)
- `gsap` for all tweens
- Load the model with `useGLTF('/models/room_v6_baked.glb')` and enable the Draco decoder (`useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')`).

## 2. The model and the look (IMPORTANT)

- File: `room_v6_baked.glb` (about 4 MB, Draco-compressed, WebP textures).
- **All lighting is baked into the textures.** Every material is unlit (`KHR_materials_unlit`, three.js loads them as `MeshBasicMaterial`). This is what makes the site look exactly like the Blender render, so:
  - **add no lights** to the scene and no environment map
  - renderer: `toneMapping = THREE.NoToneMapping`, `outputColorSpace = THREE.SRGBColorSpace` (the Blender colour grading is already inside the textures)
  - do not replace or re-light the materials
- It contains one camera named `CAM_Hero`. Use it as the default camera (same position and field of view). **No orbit controls and no 360° rotation.** See section 2b for the only camera movement allowed.
- **Haze and light glow overlay:** `haze_overlay.webp` is the volumetric glow from the Blender render (pendant light glow, jersey spotlights, window haze). Draw it as a full-screen quad after the scene, with `AdditiveBlending`, `depthTest: false`, texture in sRGB, material colour `(1.6, 1.6, 1.6)`. Because the camera turns slightly (section 2b), slide the overlay sideways with it: shift the quad's UVs horizontally by `yaw / horizontalFov` (horizontal FOV of `CAM_Hero` is about 73.7°), so the lamp glow stays on the lamp. Fade it to 30% while an item is focused.
- **Lens finish (matches the Blender compositor):** `ChromaticAberration` with offset about `0.0015` at the screen edges, and a gentle `DepthOfField` focused on the desk (focus distance about 2.45 m, small bokeh) in the idle state.
- **Dreamy particles:** about 110 tiny warm motes (colour `#FF9E4D`, size 2 to 4 px, additive, soft round sprite) drifting slowly (brownian motion, max 1 cm/s) inside the room volume in front of the window. They should glow softly, not look like dots. Add a light bloom pass only for them.
- Each interactive item contains one baked mesh named `BK_<item_id>`. The static room is two meshes: `BK_room_shell` (walls, floor, ceiling, window) and `BK_room_props` (everything else). These are never interactive.

## 2b. Edge pan (the only camera movement)

- The camera stays where `CAM_Hero` is. It only **turns a little left or right** when the cursor goes near the screen edges.
- Map the cursor's horizontal position to a target yaw:
  - the middle 60% of the screen is a dead zone: yaw target 0
  - from 20% of the width down to the left edge, ease the target from 0 to **+4°** (turns left)
  - from 80% of the width to the right edge, ease the target from 0 to **−4°** (turns right)
  - use a smoothstep on that ramp so it starts gently
- Every frame, move the actual yaw towards the target with damping (`yaw += (target - yaw) * 0.06`), so it glides and settles instead of snapping.
- Rotate around the camera's own vertical axis only (yaw). Add a tiny vertical drift of up to ±0.6° from the cursor's height for life, but no more.
- **Never exceed ±4° yaw.** The room is baked only for what the camera sees plus a small margin. Turning further would show unbaked or missing areas.
- When the cursor leaves the window, ease back to 0.
- Pause the edge pan while an item is focused (section 5) and while the user is dragging or hovering an item.

## 2c. Screens that can play video

The wide monitor, the vertical monitor and the iPad each have an extra screen surface: `Screen_Wide`, `Screen_Vertical` and `Screen_iPad`. Each sits 1 mm in front of the baked screen, with clean 0 to 1 UVs.

- On load, set all three to `visible = false`. The baked screen underneath shows the default design.
- If `content.json.screens.<screen_id>.video` has a URL (`screen_id` is `monitor_wide`, `monitor_vertical` or `ipad`; it is also in each screen's `userData.screen_id`):
  - create a `<video>` with `muted`, `loop`, `playsInline`, `autoplay` and `crossOrigin = "anonymous"`
  - set `material.map = new THREE.VideoTexture(video)`, colour space sRGB, `material.toneMapped = false`
  - dim it slightly so it sits in the scene: `material.color.setScalar(0.85)`
  - fade the screen in over 0.6 s once the video can play
- The video must be a direct `.mp4` or `.webm` file (in `/public/videos/` or on a host that allows CORS). YouTube or Vimeo page links can't be drawn onto a 3D surface; if one is given, show the baked screen and play that link in the description card instead.
- Pause any screen video while it is off-screen or the tab is hidden.

## 3. Finding interactive objects

Blender custom properties come through as `userData` on the node (glTF `extras`). The 27 interactive items are the nodes where `userData.interactive === true`. Each one has:

| key | meaning |
|---|---|
| `item_id` | stable id, used to look up the text in `content.json` |
| `label` | display title |
| `kind` | `book`, `wall`, `boardgame`, `desk`, `instrument`, `floating`, `arcade`, `boarding`, `screen` |
| `click` | `focus` (default), `gather_boarding_passes`, or `arcade` |
| `group` | only on boarding passes: `boarding_passes` |
| `size` | bounding box size in metres (Blender axes), useful for framing |

Rules:

- The node's origin is already the **centre of its bounding box**, so scaling the node zooms it in place.
- On raycast hits, walk up `object.parent` until you find a node with `userData.interactive`. That node is the item.
- Only raycast against meshes that belong to interactive items (build that list once after load). This keeps it fast.
- Some items sit under a parent called `PRP_Desk_Pivot`. Always work in world space when moving them (`scene.attach(node)` before flying, then `originalParent.attach(node)` when returning).

### The interactive items

| item_id | label |
|---|---|
| book_game_changer | Game Changer |
| book_chess_swindler | The Complete Chess Swindler |
| book_death_note | Death Note |
| book_designing_products | Designing Products People Love |
| book_dont_make_me_think | Don't Make Me Think |
| book_one_piece | One Piece |
| jersey_messi | Messi Jersey |
| poster_avengers | Avengers: Endgame |
| poster_jjk | Jujutsu Kaisen |
| poster_f1 | F1 Poster |
| game_7_wonders | 7 Wonders |
| game_splendor | Splendor |
| game_catan | Catan |
| game_scotland_yard | Scotland Yard |
| mclaren_f1 | McLaren F1 Car |
| guitar | Guitar |
| piano | Piano |
| cloak_dr_strange | Dr Strange's Cape |
| arcade | Arcade Machine |
| deadpool | Deadpool Figurine |
| rubiks_cube | Rubik's Cube |
| playing_cards | Playing Cards |
| boarding_pass_1 to boarding_pass_4 | Boarding Pass (four objects, one shared group) |
| monitor_wide | Wide Monitor |
| monitor_vertical | Vertical Monitor |
| ipad | iPad |
| photo_frame | Photo Frame |

## 4. Hover behaviour

Accent colour: `#F2B36B` (warm gold). Cursor becomes `pointer` over any item.

1. **Enter (instant):** a thin outline (2px, accent colour, about 60% strength) appears around the item. Use the postprocessing `Outline` effect with the item's meshes as the selection.
2. **Dwell (cursor stays on it for 250 ms):**
   - the outline brightens into a soft glow: outline strength to 100%, plus a gentle bloom halo (pulse the outline `edgeStrength` from 3 to 6 over 300 ms)
   - the item scales from `1.0` to `1.06` over 300 ms, `power3.out`
   - a small label chip with `label` fades in next to the cursor
3. **Leave:** glow fades and scale returns to `1.0` over 250 ms, `power2.out`. Kill any running tweens on the item first so quick in/out movements never stack.
4. Only one item can be hovered at a time. While an item is focused (section 5), hover is disabled for everything else.
5. `prefers-reduced-motion`: keep the outline, skip the scale and glow pulses.

### Arcade extra

The arcade contains a child mesh `Arcade_Logo`: an unlit copy of the PAC-MAN marquee sitting 3 mm in front of the baked one. On load, make its material `transparent`, `blending: AdditiveBlending`, `opacity: 0`. On dwell, flicker it on like a neon sign (opacity 0 → 1 → 0.3 → 1, over about 400 ms) and let the bloom pass catch it. On leave, fade the opacity back to 0.

## 5. Click: focus mode (`click: "focus"`)

1. Store the item's original parent, world position, rotation and scale.
2. Fly the item towards the camera:
   - target position = camera position + camera forward × `d`, where `d` makes the item's bounding sphere fill about 55% of the viewport height: `d = radius / Math.tan((fov * Math.PI / 180) * 0.55 / 2)`
   - shift the target slightly left (about 15% of the viewport width) so the description card fits on the right
   - rotate the item so its front faces the camera (flat items like books, posters, passes and screens: their face normal points at the camera)
   - duration 0.9 s, `power3.inOut`, with a slight arc (lift it a little at mid-flight)
3. **Background:** at the same time, blur everything except the focused item and dim it by about 35%. Do it with two render passes: render the room with a blur (or DepthOfField with a very wide bokeh focused on the item) and darken it, then render the focused item sharp on top (use a separate layer for the item while it is focused).
4. Once it arrives: the item floats gently (±1 cm bob, ±3 degrees of yaw, 4 s loop, `sine.inOut`).
5. **Description card** slides in from the right (HTML overlay, 0.4 s): title = `label`, body = text from `content.json[item_id].description`. If the description is empty, show only the title (the descriptions are added later).
6. **Close:** Esc key, a close button, or a click on the blurred background. Reverse everything: card out, blur off, item flies back to its stored transform (0.8 s), then re-attach it to its original parent.

## 6. Click on any boarding pass (`click: "gather_boarding_passes"`)

- Clicking any of the four passes brings **all four** (`group: "boarding_passes"`) to the centre of the screen together.
- Lay them out as a fanned row facing the camera, each tilted a few degrees, with a 30 ms stagger so they arrive one after another.
- Same blur, dim and close behaviour as focus mode. The card uses `content.json.boarding_passes`.

## 7. Arcade click (`click: "arcade"`), phase 2, build later

- For now, treat it like `focus`.
- Later: the camera dollies to the arcade, the `Arcade_Screen` mesh (it has its own clean 0 to 1 UVs, aspect about 1.1:1) gets a `CanvasTexture` running a small Pac-Man-style game, and fades from invisible to fully visible so the screen "switches on". Until then keep `Arcade_Screen.visible = false` (the baked arcade underneath already shows the dark screen). Keyboard arrows control the game; Esc exits.

## 8. Content file

Create `src/content.json`:

```json
{
  "book_game_changer": { "description": "" },
  "boarding_passes": { "description": "" },
  "screens": {
    "monitor_wide": { "video": "" },
    "monitor_vertical": { "video": "" },
    "ipad": { "video": "" }
  }
}
```

with one entry for every `item_id` above plus `boarding_passes` and `screens`. Hittu will fill in the descriptions and, later, the screen videos (for example `"/videos/showreel.mp4"`). An empty `video` keeps the baked screen design.

## 9. Performance

- Raycast only on pointer move, throttled to animation frames.
- Use `drei`'s `<Preload all />` and show the existing preloader until the GLB has loaded.
- Target 60 fps on a mid-range laptop GPU. The model is about 4 MB, with no real-time lights, so it is cheap to render.


## 10. Update: camera travel, arcade game, focus look (built)

These replace the matching parts of sections 5 and 7.

- **Small items float to the camera** (books, board games, figurines, jersey, guitar, posters, cape, cards, Rubik's cube, McLaren, photo frame, piano, boarding passes). Flat items turn their face to the viewer; solid items keep showing the side the visitor was looking at; the McLaren turns side-on. The card sits on the right.
- **Focus look:** the background blurs strongly (depth of field, bokeh about 7.5) and loses 50% of its colour. Desaturation is depth-based (`src/scene/DesaturateBackground.ts`), so the floating item keeps full colour.
- **Arcade:** a click flies the camera along a gentle arc to the front of the arcade screen (`src/interaction/travel.ts`). The screen flickers on and **Otter Chomp** starts: a small original maze game drawn on a canvas (`src/arcade/OtterChomp.ts`, a few KB, no assets). Arrow keys or WASD to play. Esc, or a click anywhere outside the arcade, flies the camera back.
- **Screens:** clicking the wide monitor, the vertical monitor or the iPad flies the camera to a spot where all three screens are visible. Esc, or a click anywhere else, flies back. Videos from `content.json` play on them (section 2c).
- **Floating copies:** a click floats a duplicate of the object; the original stays in place with its baked shadow, and the copy flies back and disappears on close.
- **Close to the camera:** every floating copy sits 0.95 m from the camera (in front of everything in the room) and is scaled to fill about 70% of the screen height, so nothing blocks it. The depth of field focuses tightly on it, so the whole room behind blurs.
- **Two Splendor boxes:** each box is its own item (`game_splendor` and `game_splendor_2`, both reading the `game_splendor` text through `content_id`), so only the clicked box floats.
- **Straight, no tilt:** floating items come out square to the screen and upright (flat items are straightened from their own edges, so askew posters or passes come out level), and they only bob gently, without rotating.
- **Hover float:** while the cursor rests on an object it lifts about 1.5 cm and bobs softly, settling back when the cursor leaves.
- While the camera is away from the hero spot, the edge pan, the hover glow and the haze overlay are switched off.

## 11. Door intro (built)

- **Start:** after the preloader the visitor stands in a short corridor, face to face with a mahogany door engraved "Creative Room" (camera `CAM_Door` in the GLB, human eye height 1.62 m). Store `stage` is `'door'`.
- **Look around:** in front of the door the view follows the cursor over the whole screen, up to 10 degrees left and right and about 4 degrees up and down. The corridor walls are built wide enough that the edges never show.
- **Instruction:** "Click at your own curiosity" sits under the door, gently breathing, until the door is clicked.
- **Click the door:** three knocks (synthesized in WebAudio, no audio file), the door shakes slightly on each knock, then swings 96 degrees inward on its hinge (`DOOR_Pivot`, `userData.open_angle_deg`). Stage becomes `'entering'`.
- **Walk in:** the camera walks along a curved path through the doorway to the hero pose (`CAM_Hero`), easing its framing and lens into the hero view (about 3.4 s). Then stage becomes `'room'` and everything in sections 2 to 10 switches on. Hover, edge pan, haze and focus are off until then.
- **Welcome:** "Welcome to my headspace" fades in letter by letter, holds, then evaporates (each letter drifts up, blurs and fades in a random order).
- Reduced motion: shorter knocks-to-room timing and no letter stagger.
- Door model: "Interior Wood Doors Pack 1" by Toni Garcia Vilche, CC BY 4.0. Keep the credit in `CREDITS.md`.

## 12. Top-right controls, browse arrows, scroll hint (built)

- **Top right:** a "Skip to main content" pill and an eye button. The skip link works at any time: it finishes the door intro instantly if needed, closes anything open, scrolls to `#main` and moves keyboard focus there. The eye button appears once you are inside the room and toggles `highlightAll`: every interactive object gets a soft version of the hover glow (it switches off by itself while something is in focus or the camera is at the arcade or the screens).
- **Browse arrows:** while an object is in focus, two tail-less chevron buttons sit either side of it. They step to the previous or next object (the Left and Right arrow keys do the same). The order is left to right as seen from the hero camera. The arcade and the three screens are skipped (they are only opened by clicking them); the four boarding passes count as one stop. Switching sends the current copy back quickly (0.5 s) and flies the next one in.
- **Scroll hint:** 10 seconds after entering the room, "Scroll for more" fades in at the bottom over a soft dark gradient, with a wide tail-less chevron below it. Both drift down a few pixels and back on a slow 2.8 s loop (the arrow a little further than the text). It hides while something is open and once the page is scrolled. Clicking it scrolls to the content.
- **Scrolling:** the page only scrolls once you are inside the room and nothing is open. Below the room sits `<main id="main">`, currently a placeholder for the rest of the portfolio. The scrollbar is hidden.

## 13. Scroll transition: the room turns to dust (built)

- As you scroll, the room slides up slowly (20% of the scroll speed) while the next section (`#main`) rises right under it a little faster (45%), so there is never an empty gap and the two move with a parallax. The next section fills the screen after about 2.2 screens of scroll (`.hero-track` is 220vh, `TRACK` in `App.tsx`), then scrolls normally. Its top edge is a soft gradient so it blends into the dust. After a small first scroll (8% of the viewport) the room dissolves from the top of the frame down to the bottom into soft glowing dots of mixed sizes that rise and sway upward like dust in the window light, warming toward amber.
- The dissolve front follows the scroll position exactly. Once a part of the room has dissolved it keeps evaporating: each dot rises from its spot, fades, and a fresh one takes its place on a loop, so the dust keeps streaming upward even when you stop scrolling. Scroll back up and the room fills back in from the bottom up.
- The cursor gently pushes nearby dots aside (a smoothed, trailing cursor so they ease back). The looser the dots, the stronger the push, and dots near the cursor catch a little amber.
- How it works (`src/scene/DustTransition.ts`): when the transition starts, one snapshot of the finished frame is taken (`SnapshotTap` in `App.tsx`). A grid of ~25k dots (one per ~9 css px; about half on modest machines, capped at 30k / 16k) samples its colour from that snapshot. All motion happens in the vertex shader from scroll amount, time and a per-dot random seed: no simulation, no per-frame CPU work. The clean snapshot sits under the dots at the start so the hand-over is invisible.
- Fewer dots as the room leaves: the dots are stored in random order and only the first N are drawn, where N follows the share of the room still on screen (not scrolled off the top, not under the next section). The count eases toward that number, so dots thin out evenly and smoothly, and the GPU does less and less.
- Smooth scrolling: wheel and trackpad scrolling glides with easing (Lenis, `src/smoothScroll.ts`, lerp 0.085), similar to the Framer site. It is paused whenever the page is locked (door intro, focus, arcade, screens) and off for reduced motion. The skip link and "Scroll for more" glide to the content.
- Performance: while the dust is showing, the 3D room stops rendering (`frameloop="never"`) and is hidden, so the transition replaces the room's GPU work rather than adding to it. The dust canvas only renders while the transition is partly done, and pauses in background tabs.
- Reduced motion: no dust, the room simply fades out with the scroll.
