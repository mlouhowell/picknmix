# Gott & Blandat (licorice cat): 3D review, round 1

Module: `src/three/candies/gott-blandat.ts` · preview page: `/3d/gott-blandat/` · status: **awaiting your review** (not yet enabled on the site; `model3d` stays `null` until you approve).

| File | What |
|---|---|
| `compare.png` | Render at the hero pose (front, `pose(0,0,0)`) next to `hero.png`, on #ecebe7 (top) and white (bottom) |
| `silhouette.png` | hero mask · render mask · overlap (grey = both, red = hero only, blue = render only) |
| `set.png` | polkagris · djungelvrål · cat at their `staticTime`, same rig |
| `pose.png` | front · ¾ (40°) · oblique (25°, 65°, 5°) · back |
| `swatches.png` | 3 sampled patches: hero (top) vs render (bottom) |
| `preview.mp4` | one 22 s loop on grey (also `preview.webm` VP9 alpha, `preview-transparent.webp`); git-ignored |
| `metrics.json` | all numbers below |

## Checklist (3D_CANDY_GUIDELINES §11)

- [x] Side-by-side `compare.png` on #ecebe7 and white.
- [x] Silhouette IoU ≥ 0.90: **0.989** (outline baked from the hero alpha, `scripts/bake-outline.mjs`).
- [ ] "Would you want to eat it?": **your call.** Matte-satin licorice with a pebbly mould texture and a few hairline cracks.
- [~] Colour: the candy is neutral near-black, so chroma ratios are meaningless (hero chroma ≈ 1–2; the script reports 0.68 / 0.75 / 0.79 and "fails"). Lightness (CIELAB L*) is the useful check:
  head 21.7 → **16.8**, haunch 26.2 → **44.2**, chest 22.3 → **27.7**. Head and chest are within ~5 L*; the haunch patch lands on the key-light highlight of the rounded hip, which is broader than in the photo (see known differences).
- [x] No washed-out or muddy areas: creases go blacker (`creaseColor` by AO); starch sheen only on open areas, so it never reads as flat grey plastic.
- [x] Lighting identical to the set: shared `createStage()` rig, no per-candy lights.
- [x] Loop seamless: `at(0)` = `at(22)` pixel-identical; `?speed=2` (11 s) also identical.
- [x] Reduced motion: single still at `staticTime` **17.0** with FLOAT seed **6** (seeds 1–8 searched; 6 has the longest face-on + upright window, t 17–20 s; 17.0 keeps a touch of ¾ like the photo).
- [x] Performance: 60 fps (headless Chrome, indicative), **47,260 triangles** (≤ 60k), 1 draw call, 2 textures, geometry build **246–275 ms** (≤ 300 ms; measured while other candies were building on the same machine).
- [x] Exports: `public/3d/gott-blandat/preview.png` + `hero-3d-512/1024.webp`. Videos in `review/gott-blandat/` (git-ignored, 2–4.5 MB).
- [ ] `content/candies.extra.json` → `model3d`: **on approval** (one-line change).
- [ ] Your approval recorded in `review/APPROVALS.md`.

## How it's built
- **Shape:** the hero's alpha silhouette as a 2D SDF, inflated with a deep 0.14 round bevel (licorice figures are poured into deep moulds, so the cat is round, not a flat cookie). The front carries a head dome that overhangs a soft neck seam, pointed ears with shallow hollows, almond half-closed eyes, a small muzzle and nose, a broad hip on the left, the chest, a faint front-leg line, and the crescent tail curling round the front (thin at both ends, with a shadowed hollow inside the curl). The back is a plainer double dome. Surface nets, seeded lumpiness.
- **Colour:** licorice `#232122` (photo median `#353334`; ACES + the satin highlights lift it back), crease `#0e0d0d`.
- **Material:** licorice satin (roughness 0.68 ± 0.18, faint clearcoat 0.05), a pale starch sheen on the open areas, a ~0.2 mm pebbly mould bump and a few sparse hairline cracks.
- **Size:** `REAL_SIZE_MM = 24` (estimate: Malaco licorice cats are about 2–2.5 cm tall; please confirm against a real one).

## Known differences vs the hero
1. The photo is a ¾ view with the head turned; the model is moulded facing front (the silhouette matches the photo's outline, so the head reads a little wide when seen straight on).
2. The hip catches a broader highlight than in the photo (L* 44 vs 26 at that patch).
3. The face is simpler than the photo's (no cheek dots or mouth line); eyes are soft almond dents.
4. In the oblique view the tail stands proud of the body like a flap; in the photo it's lower and blends into the hip.
5. The photo's white starch specks aren't modelled.
