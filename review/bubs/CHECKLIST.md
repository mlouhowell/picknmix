# BUBS (Bubblegum Skalle): 3D review, round 1

Module: `src/three/candies/bubs.ts` · preview page: `/3d/bubs/` · status: **awaiting your review** (not yet enabled on the site; `model3d` stays `null` until you approve).

| File | What |
|---|---|
| `compare.png` | Render at the hero pose (front, `pose(0,0,0)`) next to `hero.png`, on #ecebe7 (top) and white (bottom) |
| `silhouette.png` | hero mask · render mask · overlap (grey = both, red = hero only, blue = render only) |
| `set.png` | polkagris · djungelvrål · BUBS at their `staticTime`, same rig |
| `pose.png` | front · ¾ · oblique · back |
| `still-vs-hero.png` | reduced-motion still (`staticTime` 16.0) next to the hero |
| `swatches.png` | 3 sampled patches: hero (top) vs render (bottom) |
| `preview.mp4` | one 22 s loop on grey (also `preview.webm` VP9 alpha, `preview-transparent.webp`) |
| `metrics.json` | all numbers below |

## Checklist (3D_CANDY_GUIDELINES §11)

- [x] Side-by-side `compare.png` on #ecebe7 and white.
- [x] Silhouette IoU ≥ 0.90: **0.974** (outline baked from the hero alpha, `scripts/bake-outline.mjs`).
- [ ] "Would you want to eat it?": **your call.** Sugar-frosted foam, saturated creases, sparkling grains.
- [~] Colour swatches ≥ 85% chroma: cranium pink **1.08**, cranium blue **0.99**, lower-left jaw **0.69 (fails)**. In the photo that spot sits in a deep shadow between the bones; in the render it's a lit, raised bone. Fixing it means deeper recesses between the crossbones or more pink saturation overall. See question 2.
- [x] No washed-out or muddy areas: creases go darker *and* more saturated (no grey dead zones).
- [x] Lighting identical to the set: `set.png`, shared `createStage()` rig, no per-candy lights.
- [x] Loop seamless: `at(0)` = `at(22)` pixel-identical; `?speed=2` (11 s) also identical (`npm test`).
- [x] Reduced motion: single still at `staticTime` 16.0 (seed 3: face 0.97 toward camera, upright 0.97).
- [x] Performance: 60 fps (headless Chrome, indicative), **55,332 triangles** (≤ 60k), 1 draw call, 2 textures (env + letters raster is CPU-only), geometry build **218 ms** (≤ 300 ms).
- [~] Exports: `public/3d/bubs/preview.png` + `hero-3d-512/1024.webp`. Videos are in `review/bubs/` (too heavy to ship as-is: WebM 21 MB; I'll compress with a lighter profile after approval).
- [ ] `content/candies.extra.json` → `model3d` + `REAL_SIZE_MM` (32 mm): **on approval** (one-line change).
- [ ] Your approval recorded in `review/APPROVALS.md`.

## How it's built
- **Shape:** the hero's alpha silhouette as a 2D SDF, extruded with a pillowy 0.1 bevel. The moulded front has a cranium dome, cheekbones, a soft eye-hole rim, a maxilla bulge, crossbones with knuckle ends and raised "BUBS" lettering. The back is flatter, like the starch-poured side. Surface nets mesh, with seeded lumpiness.
- **Colour:** pink `#e8386a` | blue `#1f9fb8`, deeper than the hero's darkest 5% so that ACES plus the sugar veil land back on the photo's mid-tones. Soft, wobbling seam at x = 0.03.
- **Material:** foam (roughness 0.78 ± 0.1, ~0.2 mm pores, faint warm fake-SSS) under shader sugar (`src/three/lib/sugar.ts`): two layers of cube-ish crystals at about 0.27 mm, denser on convex areas and thinner in creases, slightly translucent, with key-light glints that twinkle as it turns.
- **Size:** `REAL_SIZE_MM = 32` (estimate; please confirm against a real skull).

## Known differences vs the hero
1. The hero's crossbones form a deeper X with darker grooves. Ours are rounder and shallower.
2. In the oblique view the bone ends jut out a little sharply at the rim (see `pose.png`, 3rd).
3. Letters use a system rounded bold font, stretched to the hero's letter box. It's a stylised recreation, not the BUBS logotype.
