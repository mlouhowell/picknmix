# Cola (sura colanapp): 3D review, round 1

Module: `src/three/candies/cola.ts` · preview page: `/3d/cola/` · status: **awaiting your review** (not enabled on the site; `model3d` stays `null` until you approve).

The hero (`assets/candies/cola/hero.png`) is a sour cola *pacifier* (colanapp): cola-brown ring with a hole, a collar knob, and a creamy white handle, all coated in sour sugar. It's flat-moulded, not a bottle, so it's built as an extruded outline (like BUBS), not a lathe.

| File | What |
|---|---|
| `compare.png` | Render at the hero pose (front, `pose(0,0,0)`) next to `hero.png`, on #ecebe7 (top) and white (bottom) |
| `silhouette.png` | hero mask · render mask · overlap (grey = both, red = hero only, blue = render only) |
| `set.png` | polkagris · djungelvrål · cola at their `staticTime`, same rig |
| `pose.png` | front · ¾ (y 40°) · oblique (35°, 55°, 10°) · back |
| `still-vs-hero.png` | reduced-motion still (`staticTime` 15.75) next to the hero |
| `swatches.png` | 4 sampled patches: hero (top) vs render (bottom) |
| `preview.mp4` | one 22 s loop on grey (also `preview.webm` VP9 alpha, `preview-transparent.webp`; git-ignored) |
| `metrics.json` | all numbers below |

## Checklist (3D_CANDY_GUIDELINES §11)

- [x] Side-by-side `compare.png` on #ecebe7 and white.
- [x] Silhouette IoU ≥ 0.90: **0.988** (outline baked from the hero alpha, `scripts/bake-outline.mjs cola`).
- [ ] "Would you want to eat it?": **your call.** Sugar-speckled cola ring, round creamy handle.
- [x] Colour swatches ≥ 85% chroma: cola ring **1.03** and **1.19**, collar **0.87**, handle **0.96**.
- [~] No washed-out or muddy areas: creases darken and saturate. But the brown reads lighter (milk-chocolate) than the hero's dark, blotchy cola (lightness ~160 vs ~100). Darker bases went grey under the shared env reflections; see known difference 1.
- [x] Lighting identical to the set: `set.png`, shared `createStage()` rig, no per-candy lights.
- [x] Loop seamless: `at(0)` = `at(22)` pixel-identical; `?speed=2` (11 s) also identical.
- [x] Reduced motion: single still at `staticTime` 15.75 (seed 3: face 1.0 toward camera, ring up, slight diagonal like the hero).
- [x] Performance: 60 fps (headless Chrome, indicative), **45,632 triangles** (≤ 60k), 1 draw call, 2 textures, geometry build **~140 ms** (≤ 300 ms).
- [~] Exports: `public/3d/cola/preview.png` + `hero-3d-512/1024.webp`. Videos are in `review/cola/` (WebM 9.5 MB, MP4 3.9 MB: too heavy to ship as-is; compress after approval).
- [ ] `content/candies.extra.json` → `model3d` + `REAL_SIZE_MM` (40 mm): **on approval** (one-line change).
- [ ] Your approval recorded in `review/APPROVALS.md`.

## How it's built
- **Shape:** the hero's alpha silhouette (ring, hole, collar, handle) as a 2D SDF, extruded. The ring is a softly domed band. The collar is a raised knob across the axis. The handle is a near-round rod (bigger bevel, thicker back), blending into the flatter ring past the collar. Seeded lumpiness throughout. The piece keeps the hero's diagonal: axis from the handle tip (hero px 95,700) to the ring centre (430,215).
- **Colour:** cola brown `#5e2a04` → cream `#b1a989`, split along that axis at 0.615 of its length, with a soft wobbling caramel transition that reaches the collar top, as in the hero. Brown has fbm blotches; thin rims get a little warm light bleed (fake translucency).
- **Material:** satin gummy (roughness 0.68 brown, 0.6 cream) under coarse sour sugar (`lib/sugar.ts`): about 0.42 mm grains, 40% coverage, tinted 78% by the gummy colour, so they read light-brown on the cola and cream on the handle, with key-light glints.
- **Size:** `REAL_SIZE_MM = 40` (estimate for a Malaco sura colanapp, tip to ring top; please confirm).
- **Pose:** FLOAT seed 3 (searched 1–8 for frames with the face toward camera and the ring up), `staticTime` 15.75.

## Known differences vs the hero
1. The hero's cola part is darker and blotchier (deep reddish-brown patches under heavy sugar). Ours is a lighter, more even milk-chocolate brown. Making the base darker turned it grey under the shared env reflections, so I kept the chroma right instead of the lightness.
2. The handle shows faint lengthwise lines where the round-rod bevel blends into the flatter ring section (visible in `compare.png` and `pose.png`).
3. The ring dome leaves a soft concentric crest; the hero's ring looks more uniformly pillowy.
4. The hero photo is soft and pixelated, so sugar grain size is a judgement call: ours are crisper, sparkly points.
