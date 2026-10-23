# CLAUDE.md: Pick N Mix

A static site about Swedish candy (Astro 5 + vanilla TS + plain CSS + three.js). The owner is a product/brand designer who keeps refining the Figma file while you build. Keep things simple, data-driven and easy to restyle.

Read first: `PLAN.md` (phases + acceptance criteria), `3D_CANDY_GUIDELINES.md` (all 3D work), `reference/*.png` (visual targets).

## Sources of truth
- **Design:** Figma `jHQuCz5VUzOveyLVbn5jV9`. Landing = **109:27 Grid view** (desktop) + **109:234** (phones), page "Landing — Grid / Timeline"; Timeline view = **138:397** (built; 111:26 / 111:201 are older explorations). 3:679 is the old collage landing (modes collage/universe); 10:11, 10:155 and 3:226 are old explorations. Candy page = **8:192 Pastellfiskar** (reference template). Corner Ornament = 5:2. Candy pages: Polkagris 8:58, BUBS 8:121, Pastellfiskar 8:192, Kexchoklad 8:263, Ahlgrens bilar 8:322, Daim 8:389, Djungelvrål 8:452, Gott & Blandat 8:519, Cola 17:22.
- **Copy:** Google Sheet `1v2O18LwUW7YszRJD7LrXheRAQqyuLvKE3J-PQu7dUKY`, tab `Candy` → `content/source/candy-sheet.csv` → `npm run content` → `content/candies.json`.
- Treat Figma as read-only. Never write to Figma or the sheet.

## Where things live
| What | Where |
|---|---|
| Design tokens (colours, type, spacing, sizes) | `src/styles/tokens.css` (only place for raw values) |
| Candy copy + data | `content/candies.json` (generated, never hand-edit) |
| Landing grid candies (13 cut-outs in `public/candies/`, drawer text fields, timeline `era`) | `content/grid/candies.json` (hand-edited) |
| Timeline copy, sidenotes (sources per paragraph) + collage layout | `content/timeline.json` (hand-edited; images in `assets/timeline/<era>/`) |
| Non-sheet candy fields (slug, type, assets, credits, Figma IDs, model3d) | `content/candies.extra.json` |
| UI strings ("Similar Candies", labels, aria labels) + layout switches | `content/site.json` |
| Landing composition | `content/landing-layout.json` |
| Candies/photos cut from the whole site for now (reversible) | `content/removed.json` |
| 3D build list + owner's locked references (shape-by-shape) | `reference/3d-targets/README.md` |
| Original images | `assets/` (+ `assets/manifest.json` with licences) |
| Generated images | `public/img/` (`npm run images`) |
| 3D | `src/three/candy-kit.ts`, `src/three/candies/<slug>.ts`, previews in `public/3d/<slug>/` |

## Rules
1. **Never hardcode copy.** Every visible string comes from `candies.json` or `site.json`. A copy change must never require a code change.
2. **Never hardcode design values.** No hex colours, font names or magic px in components; use `var(--token)`. If a token is missing, add it to `tokens.css` with a Figma node comment.
3. **Keep Figma node IDs in comments** next to each component/element (`<!-- figma 8:231 Similar Candies grid -->`) and as `data-figma="8:231"` on the root element of each component.
4. Translate Figma's absolute positioning into flex/grid layout. Only the landing collage uses positioned elements (driven by `landing-layout.json`).
5. Open decisions stay switchable: display font (`--font-display`; Begum pending licence, Fraunces stand-in), ornament SVG (single file, flipped per corner), details layout + showMaker (`site.json`), `model3d` per candy (PNG fallback when null). Don't fork components for these.
6. Section name is **"Similar Candies"** (from `site.json`). Never "Other candies".
7. Similar-candy tile: 117×117, 1px **inside** stroke `--color-tile-stroke` (#DADADA, `box-sizing: border-box`), image 109px contain, caption Funnel Sans 12 `--color-text-muted`. Hide tiles with no image.
8. Images: reference via the logical `src` in content, rendered through `lib/img.ts` (webp srcset, png fallback). `loading="lazy"` except the hero.
9. Licensing: `license: "reference-only"` images must never ship in a public build (`PUBLIC_RELEASE=true` fails the build). Credit every open image on `/credits`.
10. Motion must respect `prefers-reduced-motion`. three.js is always lazy-loaded via dynamic `import()`, never in the initial bundle.
11. Accessibility: semantic HTML, `<dl>` for details, labelled icon buttons, visible focus, decorative art `aria-hidden`.
12. Small commits per phase; run `npm run build && npm test` before saying a phase is done; compare screenshots with `reference/`.

## 3D candies (summary; full rules in `3D_CANDY_GUIDELINES.md`)
- Reuse the candy-kit: `createStage` (shared lighting rig, ACES, transparent), `applyFloat` (zero-g tumble, 22 s seamless loop), `startCandy` (`?seed`, `?speed`, reduced-motion still, `window.candy` API: ready, pause, play, at, pose, loopSeconds, staticTime).
- One module per candy with `CANDY` / `SCENE` / `FLOAT` configs and `REAL_SIZE_MM` (true relative scale in shared scenes).
- Model from `assets/candies/<slug>/hero.png`; silhouette IoU ≥ 0.90 vs hero alpha.
- Materials by family (sugar-dusted gummy, clear gummy, chalky, foam, licorice, wrapped packet); saturated true colours; same lighting for all; micro-detail; budgets (≤ 60k tris, 80k for packets; ≤ 2k textures; DPR ≤ 2; one shared renderer for multi-candy scenes).
- Export with `capture.py` (PNG alpha poster, WebM alpha, MP4 preview). Fill in the review checklist.
- **Build one candy at a time. After the first new candy (BUBS), stop and ask the user to review before continuing.** Never mark a candy approved yourself.

## Commands
- `npm run content`: CSV → `content/candies.json` (`-- --fetch` to pull the sheet if link-shared)
- `npm run images`: generate `public/img` variants
- `npm run dev` / `npm run build` / `npm test` (Playwright visual + a11y + 3D loop checks)
- `python3 assets/3d/candy-kit/capture.py public/3d/<slug> still|video`: 3D exports (needs Playwright + Chrome + ffmpeg; edit `executable_path` in capture.py/pose.py for your machine)
