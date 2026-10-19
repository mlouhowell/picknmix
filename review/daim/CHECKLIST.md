# Daim (wrapped 28 g bar): 3D review, round 1

Module: `src/three/candies/daim.ts` (+ print: `src/three/lib/daim-print.ts`) · preview page: `/3d/daim/` · status: **awaiting your review** (not enabled on the site; `model3d` stays `null` until you approve).

| File | What |
|---|---|
| `compare.png` | Render at the hero pose (front, `pose(0,0,0)`) next to `hero.png`, on #ecebe7 (top) and white (bottom) |
| `silhouette.png` | hero mask · render mask · overlap (grey = both, red = hero only, blue = render only) |
| `set.png` | polkagris · djungelvrål · Daim at their `staticTime`, same rig |
| `pose.png` | front · ¾ · oblique · back (shows the fin seal + small back logo) |
| `swatches.png` | 3 sampled patches: hero (top) vs render (bottom) |
| `preview.mp4` | one 22 s loop on grey (also `preview.webm` VP9 alpha, `preview-transparent.webp`) |
| `metrics.json` | all numbers below |

## Checklist (3D_CANDY_GUIDELINES §11)

- [x] Side-by-side `compare.png` on #ecebe7 and white.
- [x] Silhouette IoU ≥ 0.90: **0.989** (outline baked from the hero alpha, `scripts/bake-outline.mjs`; only the outline is stored).
- [ ] "Would you want to eat it?": **your call.** Glossy red film, crimped pleated seals, navy logo with white outline.
- [~] Colour swatches ≥ 85% chroma: red body **1.26**, navy "D" **1.12**, yellow streak **0.84 (just under)**. The yellow sits on the lit upper-left of the packet; ACES compresses a bright, fully saturated yellow toward white. I tried deeper yellows (#e38a00 → #b07400), less clearcoat/specular/env: it plateaus at 0.83–0.84 (deeper bases turn orange). Fixing it properly means a less-lit spot for the band or accepting a slightly orange yellow. See question 1.
- [x] No washed-out or muddy areas: tight glossy highlights (roughness 0.15, low env/specular) instead of a milky film haze.
- [x] Lighting identical to the set: `set.png`, shared `createStage()` rig, no per-candy lights.
- [x] Loop seamless: `at(0)` = `at(22)` pixel-identical; `?speed=2` (11 s) also identical.
- [x] Reduced motion: single still at `staticTime` 16.0 (seed 3: face 0.97 toward camera, upright 0.97, long axis level 0.97; mid-loop it passes a near-square logo view, face 0.997 at 15.75 s). Seeds 1–9 searched.
- [x] Performance: 60 fps (headless Chrome, indicative), **71,608 triangles** (≤ 80k packet budget), 1 draw call, 1 print texture 2048×1715 (≤ 2k), geometry build **119 ms** (≤ 300 ms).
- [x] Exports: `public/3d/daim/preview.png` + `hero-3d-512/1024.webp`. Videos in `review/daim/` (git-ignored).
- [ ] `content/candies.extra.json` → `model3d`: **on approval**. `REAL_SIZE_MM = 115` (wrapper, longest side; estimate from the guidelines table, please confirm).
- [ ] Your approval recorded in `review/APPROVALS.md`.

## How it's built
- **Shape:** the hero's alpha silhouette as a 2D SDF (keeps the photo's slight perspective, so IoU is high). Inside it a pillow packet: half-thickness 0.12 (≈ 9 mm bar + film at ≈ 44 mm per unit), rounding over the bar 0.13 in from the long edges, pinching over 0.11 into flat 0.016 crimped seals at hero px 95 and 717. Film crinkles from seeded noise. Surface nets.
- **Print (licensing):** the hero is a **reference-only** brand photo, so **no photo pixels are used**. `daim-print.ts` redraws the wrapper on a canvas in the hero's pixel space: red base, dark-red rays behind the logo, yellow/orange streaks, 8 stylised chocolate-toffee shards, a stand-in "Daim" logotype (Georgia Bold, stretched to the hero's letter box, white outline + white swoosh + dark-red drop edge, navy gradient fill), a stylised nutrition panel (pale rounded box with bars, no copied text), pleat lines on the seals. Back: red, darker fin-seal band, faint ingredient lines, small logo. Planar projection front/back.
- **Material:** glossy film (roughness 0.15 ± 0.08 crinkle, specular 0.35, clearcoat 0.2, env 0.2), seals more matte (0.5) with less clearcoat; bump: horizontal seal pleats (0.031 pitch, as in the hero) + film crinkle fbm.
- **Size:** `REAL_SIZE_MM = 115` (estimate).

## Known differences vs the hero
1. **Logo** is a stand-in serif (Georgia Bold), not the Daim logotype: thinner, more regular letters, a lighter "i" dot, and less tilt than the hero's dynamic skew. The real wordmark needs your sign-off or a licensed asset.
2. The hero's white "lightning" rays and big yellow sweep behind the logo are simplified to a few flat streaks; shards are flat polygons (the hero's have glossy chocolate shading).
3. Yellow chroma 0.84 (see above).
4. The packet is a little flatter in oblique views than a real filled wrapper (no end-to-end fin seal ridge on the back, only printed).
5. Back face shows faint crinkle glints that read as speckle at small sizes.
