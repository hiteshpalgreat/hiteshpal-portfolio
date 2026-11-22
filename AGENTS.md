# Hittu's Room: project rules

This is the home scene of Hittu's (Hitesh Pal) portfolio: a cosy, golden-hour 3D bedroom-studio. Visitors hover and click objects that tell his story. Desktop first; mobile comes later.

## Source of truth

- Full behaviour spec: `docs/INTERACTIONS_SPEC.md`. Read it before writing any 3D or interaction code, and follow it exactly.
- Look target: `docs/reference_web_target.png` (what the browser should look like) and `docs/reference_blender_render.jpg` (the original render).
- 3D model: `public/models/room_v9_baked.glb`. Glow overlay: `public/textures/haze_overlay.webp`. Text content: `src/content.json`.

## Stack

- Vite + React + TypeScript, `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `gsap`.
- Draco decoder is self-hosted in `public/draco/`.

## Non-negotiable rules

1. **The lighting is baked into the model's textures.** Never add lights, environment maps or shadows, and never swap or re-light materials. Renderer: `toneMapping = THREE.NoToneMapping`, `outputColorSpace = THREE.SRGBColorSpace`.
2. **Camera:** use the `CAM_Hero` camera from the GLB (find it by name). The visit starts at `CAM_Door` (door intro, spec section 11). No OrbitControls and no free rotation. In the room the only movement is the edge pan (max ±4° yaw); at the door the cursor look is max ±10° yaw.
3. **Interactive items** are the nodes with `userData.interactive === true` (27 of them). Never hard-code positions; read everything from the GLB `userData`.
4. Move items in world space (`scene.attach` / `parent.attach`) and always restore them exactly.
5. Every animation uses GSAP, and tweens on the same object are killed before new ones start.
6. Respect `prefers-reduced-motion`.
7. Keep 60 fps on a mid-range laptop. Raycast only against interactive meshes, once per animation frame.
8. Never use em dashes in UI copy.
9. Before saying a step is done, run the dev server, open it in the browser, and compare against `docs/reference_web_target.png`.

## Folder layout to keep

- `src/scene/` for 3D components (Room, CameraRig, HazeOverlay, Particles, Effects)
- `src/interaction/` for hover, focus, boarding-pass and arcade logic
- `src/ui/` for HTML overlays (label chip, description card)
- `src/content.json` for all text and screen video links
