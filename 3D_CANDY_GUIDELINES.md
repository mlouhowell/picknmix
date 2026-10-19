# 3D candy guidelines — Pick N Mix

Every 3D candy must follow this file. Goal: **vibrant, delicious, realistic**, and all candies look like one set.
Existing references: `assets/3d/polkagris/index.html` (powdered hard candy) and `assets/3d/djungelvral/index.html` (salted licorice). Shared kit: `assets/3d/candy-kit/candy-kit.js`.

The user approves each candy's look. **Build one candy at a time. After the first new candy, stop and ask for review** before starting the next.

## 1. Build order and hero match

Match each candy to its current hero image in `assets/candies/<slug>/hero.png` (copied from `/workspace/candy-cutouts/<slug>/hero.png`).

| # | Slug | Model | Family (see §5) | Approx. real size, longest side* |
|---|------|-------|-----------------|------------------------|
| done | polkagris | Striped pillow piece | Chalky/hard | ~20 mm |
| done | djungelvral | Monkey, salmiak-dusted | Licorice | ~22 mm |
| 1 | bubs | Bubblegum Skalle, pink/blue halves, sugar-dusted skull | Foam + sugar dust | ~32 mm tall |
| 2 | pastellfiskar | Green Malaco fish, "Malaco" embossed | Clear gummy | ~45 mm |
| 3 | cola | Sour sugared cola bottle (brown top, white base) | Sugar-dusted sour gummy | ~40 mm |
| 4 | gott-blandat | Black licorice cat | Licorice | ~25 mm |
| 5 | ahlgrens-bilar | Green car (pink and white via config) | Foam | ~35 mm |
| 6 | kexchoklad | Wrapped packet, red/yellow check wrapper | Wrapped packet | ~155 mm |
| 7 | daim | Wrapped 28 g bar | Wrapped packet | ~115 mm |

*Sizes are estimates. Check them against a real product or packaging spec, then record the value in each module as `REAL_SIZE_MM`. Order: start with BUBS (high impact, uses the shared sugar-grain material). The order can change if the user asks.

## 2. Structure (reuse, don't reinvent)

- One self-contained module per candy: `src/three/candies/<slug>.ts`. It exports `{ slug, REAL_SIZE_MM, CANDY, FLOAT, SCENE, createCandy(stage) }`, using the same config sections as polkagris/djungelvral (`CANDY` = shape + colours + material knobs, `SCENE`, `FLOAT`).
- Shared code lives in `src/three/candy-kit.ts`, a TS module port of `candy-kit.js`: `makeNoise3`, `mulberry32`, `createStage`, `applyFloat`, `startCandy`. Shared helpers (SDF mesher from djungelvral, sugar/salt grain shader, wrapper material) go in `src/three/lib/`. Never copy-paste kit code into a candy.
- Each candy also gets a standalone preview page `public/3d/<slug>/index.html` (transparent background, importmap or Vite build) for capture and review. `build.py` keeps the legacy single-file pages in sync.
- Transparent background (`alpha: true`, clear alpha 0). Never bake a background colour into the canvas.
- Motion: `applyFloat` zero-gravity tumble. `loopSeconds: 22`, integer `spinTurns`, `precessTurns` and `driftCycles` so `update(t) === update(t + loop)`.
- URL params: `?seed=N` (motion seed) and `?speed=N` (loop = 22/speed, still seamless).
- Reduced motion: under `prefers-reduced-motion: reduce`, render one still frame at `FLOAT.staticTime`, chosen as the pose that best shows the candy's silhouette. Re-check when the media query changes.
- `window.candy` API (same as existing): `ready`, `pause()`, `play()`, `at(seconds)`, `pose(x,y,z)`, `loopSeconds`, `staticTime`. In the site, `mountCandy(el, slug, opts)` returns the same API object.
- Accessibility: the container has `role="img"` and an `aria-label` describing the candy (e.g. "A pink and blue BUBS skull, sugar-dusted, slowly tumbling").

## 3. Real-world scale

- Model in millimetres, or normalise to 1 unit = longest side, and export `REAL_SIZE_MM`.
- Single-candy views (candy page hero) auto-frame: the candy fills the 512px hero with `framePadding` 1.1–1.15, as the kit does now.
- Shared scenes (landing, space demo) scale every candy by `REAL_SIZE_MM / reference` so relative sizes are true. A wrapped Kexchoklad bar must look about 7× a Djungelvrål monkey. A clamp for art direction is allowed, but write it down in `content/landing-layout.json`.
- Test: `scripts/check-scale.mjs` renders all candies in one row at true scale. The longest-side pixel ratios must be within ±10% of the `REAL_SIZE_MM` ratios.

## 4. Modelling from the hero reference

- Build from `hero.png` plus 2–3 extra reference angles if available (originals are on the design box in `/workspace/candy-cutouts/src`; ask the user). Get proportions, thickness, embossing (BUBS letters, "Malaco" on the fish, Kex check pattern) and bevels right.
- Geometry: SDF blobs plus marching cubes (djungelvral approach) for organic shapes; parametric surfaces (polkagris approach) for pillows, bottles and bars; displaced/crinkled planes for wrappers.
- **Silhouette check (required):** `pose()` the candy to match the hero's view, render alpha at 800px, and compare its mask with the hero.png alpha mask, both cropped and scaled to the same bounding box. Pass = IoU ≥ 0.90. Save the side-by-side to `review/<slug>/silhouette.png`. Script to write: `scripts/check-silhouette.py <slug> "x,y,z"` (reuse `assets/3d/candy-kit/pose.py`).

## 5. Materials by candy family

All materials use `MeshPhysicalMaterial` (or a small `onBeforeCompile` extension) under the shared lighting. Values are starting points; tune them against the hero.

| Family | Candies | Recipe |
|---|---|---|
| Sugar-dusted sour gummy | cola, BUBS (dust layer) | Gummy body: `transmission` 0.3–0.6, `thickness` ≈ candy depth, `attenuationColor` = body colour, roughness 0.35. Sugar layer: instanced or shader-generated **sparkling crystal grains** (cube-ish, 0.3–0.6 mm at real scale, dense, random rotation), each grain specular and slightly translucent, with tiny glints that twinkle as the candy turns. Coverage is denser on top faces and thinner in creases. |
| Clear gummy / jelly | pastellfiskar | `transmission` 0.85–1, `ior` 1.40–1.50, `thickness` from real depth, `attenuationColor` + `attenuationDistance` for slight colour absorption (deeper colour in thick parts), roughness 0.15–0.25, light clearcoat. Embossed lettering must read through refraction. |
| Chalky / hard | polkagris | Matte powder: roughness 0.8–0.9, sheen for the powdery edge, fine grain normal noise (existing polkagris recipe). |
| Foam | BUBS (body), ahlgrens-bilar | Soft matte: roughness 0.7–0.85, light subsurface look (sheen + small transmission ≤ 0.1, warm `attenuationColor`), **fine pores** via normal/roughness noise at ~0.2 mm scale. Slightly squashed, pillowy edges. Ahlgrens: subtle sugar-free satin top with a matte underside. |
| Licorice | djungelvral, gott-blandat | Deep black (#121014–#1a1618, never pure #000), roughness 0.35–0.45, clearcoat 0.2–0.3 for a subtle sheen, moulded lumpiness. Salt/salmiak grains where the product has them (djungelvral recipe); the Gott & Blandat cat is bare, glossy licorice. |
| Wrapped packet / chocolate | kexchoklad, daim | Wrapper: crinkled geometry (displacement + normal noise), **crimped sealed ends** (sawtooth pleats), metallised foil or glossy plastic, roughness 0.15–0.35 varying by crinkle, strong sharp highlights. **Printed label texture** recreated as vector-like art at 2048px max (check pattern, logo shape). Do not copy brand artwork pixel-for-pixel from retailer photos (see licensing in PLAN.md); recreate a faithful stylised version and get user sign-off. |

## 6. Colour

- Saturated, true-to-product colours sampled from the hero (record the hex values in `CANDY`, with a comment saying where each was sampled).
- `outputColorSpace = SRGBColorSpace`. Tone mapping: keep the kit's `ACESFilmicToneMapping` at exposure ≈ 0.92 for all candies. AgX is allowed only if switched kit-wide for every candy at once.
- No washed-out pastels: rendered mid-tone chroma must be ≥ 85% of the hero's (check in `review/<slug>/swatches.png`: 3 sampled patches render vs photo).
- No muddy shadows: the darkest non-licorice areas must keep their hue (no grey/brown dead zones). Fill and environment must lift them.

## 7. Shared lighting rig (identical for every candy)

Use only `createStage()` from the kit: RoomEnvironment PMREM (soft studio reflections), key light upper left-front (1.7), warm fill right (0.3), back rim (0.7) for edge glow. Lights stay fixed in world space, so a tumbling candy moves through the light. Per-candy light changes are **not allowed**. If a candy looks wrong, fix its material. Kit-wide changes need a re-render of every approved candy.

## 8. Surface micro-detail

No perfect CG smoothness. Every candy has: normal-map or shader noise (pores, grains, mould marks), roughness variation (±0.1), small asymmetry/lumpiness (seeded, `lumpiness` 0.005–0.015), soft edge bevels (no razor edges), and for gummies, faint mould seam lines.

## 9. Performance budgets (per candy)

- Triangles: ≤ 60k (foam/gummy/licorice), ≤ 80k (wrapped packets). Instanced sugar grains count as 1 draw call; ≤ 8k instances.
- Textures: ≤ 2048² for labels, ≤ 1024² for others; KTX2 (Basis) preferred, webp fallback; generate procedural noise in the shader where possible.
- Geometry build time ≤ 300 ms on a laptop (pre-bake SDF meshes to `.glb` with Draco/meshopt if slower).
- `setPixelRatio(min(devicePixelRatio, 2))`; candy pages use 1.5 on mobile.
- Lazy load: `three` and the candy module load via dynamic `import()` only when the hero is in view, after the PNG poster has painted. No three.js in the initial bundle.
- Several candies on one page (landing): **one shared renderer and scene**, candies added as objects, never one WebGL context per candy (the iframe space demo is a prototype only).
- Pause rendering when off-screen (IntersectionObserver) or when the tab is hidden.
- Target: 60 fps on a 2020+ laptop with the integrated GPU; ≥ 30 fps on a mid-range phone.

## 10. Exports (via `capture.py`)

For each candy, run `python3 assets/3d/candy-kit/capture.py public/3d/<slug> still` and `... video` (Playwright + Chrome + ffmpeg; set `executable_path` for your machine):
- `preview.png` (alpha, 800px, at `staticTime`): this becomes the PNG fallback / poster, also as `hero-3d.webp` in 512/1024px.
- `preview.webm` (VP9 alpha) and `preview-transparent.webp` (animated) of one full 22 s loop, for places where WebGL is unavailable.
- `preview.mp4` (grey background) for sharing in reviews.

## 11. Review checklist (attach to each candy's review request)

- [ ] Side-by-side `review/<slug>/compare.png`: render at the hero pose next to hero.png on #ecebe7 and on white.
- [ ] Silhouette IoU ≥ 0.90 (§4).
- [ ] Passes the "would you want to eat it?" check: looks juicy, sugary or glossy as appropriate, not plastic.
- [ ] Colour swatches pass (§6); no washed-out or muddy areas.
- [ ] Lighting identical to the set: render next to polkagris and djungelvral in one frame (`review/<slug>/set.png`).
- [ ] Loop seamless: frame 0 and frame at `loopSeconds` match pixel-for-pixel (`candy.at(0)` vs `candy.at(loopSeconds)`), and `?speed=2` still loops.
- [ ] Reduced motion shows a single good still.
- [ ] 60 fps on a laptop (Chrome performance panel, 10 s); triangle/texture budgets met (log `renderer.info`).
- [ ] Exports produced (§10); `content/candies.extra.json` updated with `model3d` and `REAL_SIZE_MM`.
- [ ] User approval recorded in `review/APPROVALS.md` (date, candy, comments). Don't start the next candy before the first new one is approved.
