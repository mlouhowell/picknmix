# Pastellfiskar (Malaco pastel fish): 3D review, round 1

Module: `src/three/candies/pastellfiskar.ts` · preview page: `/3d/pastellfiskar/` · status: **awaiting your review** (not yet enabled on the site; `model3d` stays `null` until you approve).

| File | What |
|---|---|
| `compare.png` | Render at the hero pose (side, `pose(0,0,0)`) next to `hero.png`, on #ecebe7 (top) and white (bottom) |
| `silhouette.png` | hero mask · render mask · overlap (grey = both, red = hero only, blue = render only) |
| `set.png` | polkagris · djungelvrål · pastellfisk at their `staticTime`, same rig |
| `pose.png` | side · ¾ (40°) · oblique (35°, 55°, 10°) · back |
| `swatches.png` | 3 sampled patches: hero (top) vs render (bottom) |
| `preview.mp4` | one 22 s loop on grey (also `preview.webm` VP9 alpha, `preview-transparent.webp`) |
| `metrics.json` | all numbers below |

## Checklist (3D_CANDY_GUIDELINES §11)

- [x] Side-by-side `compare.png` on #ecebe7 and white.
- [x] Silhouette IoU ≥ 0.90: **0.964** (outline baked from the hero alpha, `scripts/bake-outline.mjs pastellfiskar 140 2`).
- [ ] "Would you want to eat it?": **your call.** Glossy-frosted jelly, olive core, yellow-green glow at the rims and tail.
- [x] Colour swatches ≥ 85% chroma: mid-body **0.85** (just at the line), head **1.04**, tail **1.00**. The head patch renders lighter than the photo (the shared key light comes from the upper left, which lights the nose; in the photo the head sits in shade).
- [x] No washed-out or muddy areas: thick parts absorb to a saturated olive (never grey), and highlights are tinted yellow-white (`specularColor`), not blue-white.
- [x] Lighting identical to the set: `set.png`, shared `createStage()` rig, no per-candy lights.
- [x] Loop seamless: `at(0)` = `at(22)` pixel-identical; `?speed=2` (11 s) also identical.
- [x] Reduced motion: single still at `staticTime` 19.4 (seed 4: side 0.93 toward camera, upright 0.98, level 0.91, head left as in the hero).
- [x] Performance: 60 fps (headless Chrome, indicative), **47,980 triangles** (≤ 60k), 1 draw call, 3 textures (env, relief bump map 1024×404, + one kit texture), geometry build **153–276 ms** across runs (≤ 300 ms; the long fish needs more cells than BUBS).
- [~] Exports: `public/3d/pastellfiskar/preview.png` + `hero-3d-512/1024.webp`. Videos in `review/pastellfiskar/` (WebM 3.5 MB, MP4 1.2 MB; git-ignored).
- [ ] `content/candies.extra.json` → `model3d`: **on approval**.
- [ ] Your approval recorded in `review/APPROVALS.md`.

## How it's built
- **Shape:** the hero's side silhouette as a 2D SDF, extruded with a 0.16 pillowy bevel and a belly dome (plumpest just behind the head, 45% thinner through the tail). Same moulded thickness on both sides.
- **Relief:** one 2D canvas field draws the raised "Malaco" script, a row of dorsal knobs under the top edge, six fanned tail-fin ridges, a pressed gill arc, a mouth crease and an eye dimple. It feeds both the mesh (so relief catches light and silhouette) and a bump texture (crisp edges at a 0.0165 mesh cell).
- **Material:** `MeshPhysicalMaterial` + `onBeforeCompile`. Translucency is **faked** in the shader: per-vertex thinness (rim distance + tail) glows yellow-green `#b2cc00`, the thick core absorbs to olive `#284800`, body `#628600`, with fbm "refraction mottling" pools. Frosted gloss: roughness 0.34 ± 0.08, light clearcoat 0.12, yellow-tinted specular, fine moulding wrinkles as bump noise.
- **Why not real `transmission`:** the canvas is transparent and the candy floats alone, so the transmission pass would refract an empty (black/transparent) scene and the jelly would read dark. The fake keeps the hero's look and costs one draw call.
- **Size:** `REAL_SIZE_MM = 50` nose to tail (estimate; please confirm against a real fish).

## Known differences vs the hero
1. Lettering uses Brush Script MT (system font, thickened with a stroke) as a stand-in for the Malaco script logotype; the photo's letters are rounder and slightly more upright.
2. The photo's surface has a strong crumpled, crystalline micro-texture and deeper olive shadows; ours is smoother and a little lighter overall (mid-body chroma sits exactly at 0.85).
3. The back side is plain (no lettering or relief beyond the fins' silhouette); I had no reference for the back of the fish.
4. No real refraction: the lettering doesn't "read through" the jelly from the back.
