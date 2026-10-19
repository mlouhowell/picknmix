# Ahlgrens bilar (foam car): 3D review, round 1

Module: `src/three/candies/ahlgrens-bilar.ts` · preview page: `/3d/ahlgrens-bilar/` · status: **awaiting your review** (not enabled on the site; `model3d` stays `null` until you approve).

| File | What |
|---|---|
| `compare.png` | Render at the hero pose (side view, `pose(0,0,0)`) next to `hero.png`, on #ecebe7 (top) and white (bottom) |
| `silhouette.png` | hero mask · render mask · overlap (grey = both, red = hero only, blue = render only) |
| `set.png` | polkagris · djungelvrål · Ahlgrens bil at their `staticTime`, same rig |
| `pose.png` | side · ¾ front · from above · other side (`pose` 0,0,0 · 20,35,0 · 50,-60,15 · 0,180,0) |
| `swatches.png` | 3 sampled patches: hero (top) vs render (bottom) |
| `preview.mp4` | one 22 s loop on grey (also `preview.webm` VP9 alpha, `preview-transparent.webp`; 640 px, git-ignored) |
| `metrics.json` | all numbers below |

## Checklist (3D_CANDY_GUIDELINES §11)

- [x] Side-by-side `compare.png` on #ecebe7 and white.
- [x] Silhouette IoU ≥ 0.90: **0.980** (side outline baked from the hero alpha, `scripts/bake-outline.mjs`).
- [ ] "Would you want to eat it?": **your call.** Soft pale-mint foam, satin top, matte underside, fine pores.
- [x] Colour swatches ≥ 85% chroma: cabin side **0.90**, rear body **1.05**, front lower body **1.03**.
- [x] No washed-out or muddy areas. Crease tint kept gentle on purpose (see note 3).
- [x] Lighting identical to the set: `set.png`, shared `createStage()` rig, no per-candy lights.
- [x] Loop seamless: `at(0)` = `at(22)` pixel-identical; `?speed=2` (11 s) also identical.
- [x] Reduced motion: single still at `staticTime` 18.0 (seed 6: side 0.97 toward the camera, upright 0.99). Seed search over 1–8; 6 and 3 scored best.
- [x] Performance: 60 fps (headless Chrome, indicative), **53,320 triangles** (≤ 60k), 1 draw call, 2 textures, geometry build **139 ms** (≤ 300 ms).
- [x] Exports: `public/3d/ahlgrens-bilar/preview.png` + `hero-3d-512/1024.webp`. Videos in this folder.
- [ ] `content/candies.extra.json` → `model3d`: **on approval**.
- [ ] Your approval recorded in `review/APPROVALS.md`.

## How it's built
- **Shape:** the hero is a side view, so its alpha silhouette is the car's side outline (length × height). It's extruded across the width with a soft 0.13 rounded edge. The body is 0.6 wide (in car-height units), narrowing to 0.4 at the cabin hump, with a slight mid-height side bulge, a slumped wider base and shallow side-window dimples. Seeded lumpiness gives the poured-foam irregularity. Surface nets mesh.
- **Material:** foam `#8fcf60` (deeper than the hero median `#cee5b7`, so ACES lands on the photo's mint) with a greener crease shade. Roughness 0.55 on top, 0.88 underneath, plus ±0.08 noise. Low green sheen, ~0.25 mm pores, low-frequency skin wrinkles and a faint warm fake-SSS.
- **Size:** `REAL_SIZE_MM = 36`, the car's length (estimate; please confirm against a real piece).

## Known differences vs the hero
1. The width is a guess: only the side view exists. Real cars may be a bit narrower or wider. Extra reference angles would pin this down.
2. The hero has deeper lumps and folds (wheel-arch bulges, a crease down the side). Ours is smoother. I removed wheel-arch bulges because they showed as round blotches.
3. The baked AO tint gave visible contour bands on the broad flat sides, so crease darkening is only 35% strength. Crevices read a little lighter than in the photo.
4. No moulded lettering: none is visible in the hero.
