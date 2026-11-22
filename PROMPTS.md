# Working on the site in Antigravity

Steps 1 to 8 of the original plan are **already built** and tested:
- the baked room through the Blender camera, with the haze glow
- the ±4° edge pan
- hover glow outline, a 1.06 zoom and the label chip
- the Pac-Man neon flicker on the arcade
- click to focus, with blur, dim and the description card
- the boarding-pass gather
- particles, depth of field and chromatic aberration
- screen videos from `src/content.json`
- the preloader

## First time

Paste this into the Antigravity agent:

> Read `AGENTS.md`. Run `npm install`, then `npm run dev`, and open the site in the browser. Hover a few objects, click one, press Esc, and click a boarding pass. Tell me if anything errors in the console.

## Useful follow-up prompts

- **Descriptions:** "Fill `src/content.json` with these descriptions: …" (paste your text per item).
- **Bigger boarding passes:** "In `src/interaction/focus.ts`, make the boarding-pass row fill about 65% of the screen width instead of 50%."
- **Glow colour or thickness:** "In `src/interaction/hover.ts`, change the hover glow colour to … and make the rim a little thicker."
- **Calmer or busier particles:** "In `src/scene/Particles.tsx`, change COUNT to … and make them a bit larger or smaller."
- **Stronger or weaker haze:** "In `src/scene/CameraRig.tsx`, change the haze overlay colour multiplier from 1.35 to …"
- **Screen video:** put an mp4 in `public/videos/` and set `"monitor_wide": { "video": "/videos/your-file.mp4" }` in `src/content.json`.
- **Arcade game (later):** "Implement section 7 of `docs/INTERACTIONS_SPEC.md`."
- **Deploy:** "Build the site with `npm run build` and deploy the `dist` folder to Vercel."

Always ask the agent to check the result in the browser against `docs/reference_web_target.png`.
