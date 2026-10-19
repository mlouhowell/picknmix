# Kexchoklad: 3D review, round 1

Module: `src/three/candies/kexchoklad.ts` · preview page: `/3d/kexchoklad/` · status: **awaiting your review** (not enabled on the site; `model3d` stays `null` until you approve).

| File | What |
|---|---|
| `compare.png` | Render at the hero pose (front, `pose(0,0,0)`) next to `hero.png`, on #ecebe7 (top) and white (bottom) |
| `silhouette.png` | hero mask · render mask · overlap (grey = both, red = hero only, blue = render only) |
| `set.png` | polkagris · djungelvrål · Kexchoklad at their `staticTime`, same rig |
| `pose.png` | front · ¾ · oblique · back |
| `swatches.png` | 3 sampled patches: hero (top) vs render (bottom) |
| `preview.mp4` | one 22 s loop on grey (also `preview.webm` VP9 alpha, `preview-transparent.webp`; git-ignored) |
| `metrics.json` | all numbers below |

## Checklist (3D_CANDY_GUIDELINES §11)

- [x] Side-by-side `compare.png` on #ecebe7 and white.
- [x] Silhouette IoU ≥ 0.90: **0.982** (packet length/height, crimp flare, body taper and sawtooth edges measured from the hero alpha).
- [ ] "Would you want to eat it?": **your call.** Glossy printed film with crinkle detail, pleated red crimps.
- [x] Colour swatches ≥ 85% chroma: yellow body **0.88**, red crimp **1.20**, KEX wafer cell **0.97**. The crimp red runs a little hot: the flat seal faces the key light (base already deepened to `#bb2f2c`).
- [x] No washed-out or muddy areas: the print is pre-compensated (`printGain` 0.66, `printSaturation` 1.35) and the film's face-on reflection is kept low (`specularIntensity` 0.55, env 0.4, clearcoat 0.15) so the room doesn't veil the label. Glossy streaks still appear as it turns.
- [x] Lighting identical to the set: `set.png`, shared `createStage()` rig, no per-candy lights.
- [x] Loop seamless: `at(0)` = `at(22)` pixel-identical; `?speed=2` (11 s) also identical.
- [x] Reduced motion: single still at `staticTime` 11.5 (seed 25: print face-on 0.98, level, slight tilt).
- [x] Performance: 60 fps (headless Chrome, indicative), **65,280 triangles** (≤ 80k for packets), 1 draw call, one 2048² label texture (canvas, drawn at build time; the other 2 textures counted are the shared env), geometry + texture build **≈ 30 ms** (≤ 300 ms).
- [x] Exports: `public/3d/kexchoklad/preview.png` + `hero-3d-512/1024.webp`. Videos in `review/kexchoklad/` (mp4 1.8 MB, webm 4.7 MB).
- [ ] `content/candies.extra.json` → `model3d`: **on approval**. `REAL_SIZE_MM = 150` (packet length incl. crimps) is an estimate; please confirm against a real bar.
- [ ] Your approval recorded in `review/APPROVALS.md`.

## How it's built
- **Shape:** a flow-wrap pillow pack. The bar's rounded-rectangle cross-section (half-thickness 0.13 ≈ 17 mm, edge radius 0.07) is swept along the length and collapses into flat seals at both ends: 15 sawtooth teeth on the edge with matching pleat ridges, the packet flaring from body height (0.946) to crimp height (1.0) like the hero, diagonal wrinkles on the shoulders, and a folded fin seal along the back. Two sheets (front/back), one draw call; columns are dense at the crimps and shoulders, sparse mid-body.
- **Label:** a stylised recreation drawn on a canvas at build time (§5: no photo pixels are copied): wafer-lattice yellow ground, a raised gold panel, slanted "KEX" in a heavy system font filled with a wafer pattern, chocolate extrusion and cream rim, a curled "CHOKLAD" ribbon, the maker's oval, ®, and red crimp bands. The back has the lattice, the fin-seal overlap, small brand marks, an abstract info panel (no copied text) and a barcode block.
- **Material:** printed plastic film: roughness 0.3 with streaks running along the packet and crinkle scatter, low clearcoat, fine crinkle bump.
- **Colours** (sampled from the hero, noted in `CANDY`): yellow `#e8c552`, red `#bb2f2c` (photo `#c93835`), wafer `#a0501f` (photo `#b05d29`), chocolate outline `#5e2812`.

## Known differences vs the hero
1. Lettering uses a system heavy sans (Arial Black) slanted and stretched, not the real KEX logotype; the 3D bevel on the letters is flatter and the extrusion thinner.
2. The maker oval is a simplified two-lobe shape with a system serif italic, not the real script logo.
3. The red crimps are a touch brighter and more saturated than the photo's (chroma 1.20).
4. The back print is invented (we have no reference for it).
5. Mid-body the film is smooth; real packets show more random creasing. Shoulder wrinkles are subtle.
