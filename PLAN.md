# Pick N Mix: build plan

A small site about Swedish candy: a landing page and one page per candy (9 candies), with floating 3D candies.
Design: Figma `jHQuCz5VUzOveyLVbn5jV9` (still being refined). Copy: Google Sheet `1v2O18LwUW7YszRJD7LrXheRAQqyuLvKE3J-PQu7dUKY`, tab `Candy`.
This folder is the hand-off kit: tokens, content, assets, references, and instructions for Claude Code.

## 0. What's in this kit

| Path | What |
|---|---|
| `PLAN.md` | This plan |
| `CLAUDE.md` | Repo rules for Claude Code (copy to repo root) |
| `KICKOFF_PROMPT.md` | Prompt to paste into Claude Code |
| `3D_CANDY_GUIDELINES.md` | Rules every 3D candy must meet (Phase 6) |
| `tokens.css` | Design tokens extracted from Figma |
| `content/candies.json` | All 9 candies, generated from the sheet + `candies.extra.json` |
| `content/candies.extra.json` | Fields not in the sheet: slug, candy type, assets, credits, Figma node IDs |
| `content/site.json` | UI strings ("Similar Candies", labels) and layout switches |
| `content/landing-layout.json` | Landing composition (blurred candies, sharp hero, ornaments) from 3:679 |
| `content/source/candy-sheet.csv` | Snapshot of the sheet (Oct 18, 2026) |
| `scripts/build-content.mjs` | Sheet CSV → `content/candies.json` |
| `assets/` | Cut-out PNGs, 3D candies, candy-kit, ornament SVG, `manifest.json` (sizes, licences) |
| `reference/` | Figma screenshots: `landing_3-679_REFERENCE.png`, `candy-pastellfiskar_8-192_REFERENCE.png`, other candy pages, ornament; `explorations/` = old landing variants |

## 1. Stack

**Astro 5 + vanilla TypeScript + plain CSS (custom properties), three.js from npm, deployed as a static site on Vercel or Netlify.**

- Astro: static HTML by default, file-based routes (`/candy/[slug]`) generated from JSON, and JS only where needed (the 3D hero). This suits a designer-owned content site.
- Vanilla TS (no React): the interactivity is small (nav arrows, keyboard, one 3D mount), and the existing candy-kit is already vanilla.
- Plain CSS + `tokens.css`: one file mirrors Figma, with no Tailwind translation layer, so Figma changes map one-to-one.
- three.js via npm with dynamic `import()`: tree-shaken and lazy-loaded, unlike the unpkg importmap in the prototypes.
- Astro View Transitions: smooth candy-to-candy navigation that respects reduced motion.
- Tooling: `sharp` (image variants), Playwright (visual and 3D checks), `@axe-core/playwright` (a11y), zod (content validation).

Vite + vanilla TS was the alternative. It would need hand-written routing for 9 pages and a static-generation step that Astro already provides.

## 2. Repo structure

```
pick-n-mix/
  CLAUDE.md
  astro.config.mjs  package.json  tsconfig.json
  content/
    candies.json            # GENERATED, do not edit
    candies.extra.json      # slug, type, hero/variants/model3d, credits, Figma IDs
    site.json               # UI strings + layout switches
    landing-layout.json     # landing composition (from Figma 3:679)
    source/candy-sheet.csv  # sheet export
  assets/                   # originals (PNG cut-outs, ornament SVG), committed as-is
  public/
    img/                    # GENERATED webp/png variants (npm run images)
    3d/<slug>/index.html    # standalone 3D preview pages (capture + review)
    fonts/                  # self-hosted fonts (Begum once licensed)
  scripts/
    build-content.mjs  optimize-images.mjs  check-scale.mjs  check-silhouette.py
  src/
    styles/tokens.css  styles/global.css
    lib/content.ts          # loads + zod-validates JSON, typed Candy, next/prev helpers
    lib/img.ts              # logical src -> srcset
    components/
      IconButton.astro      # 45px close/next buttons (8:212/8:214)
      CandyPanel.astro      # 429px info panel (8:211/8:219)
      DetailsList.astro     # stacked details (8:222); 'row' variant (8:151)
      SimilarCandies.astro  # heading + grid (8:230/8:231)
      SimilarTile.astro     # 117px box, 1px inside stroke, caption (12:58)
      CandyHero.astro       # 512px hero: PNG poster + optional 3D mount (8:236)
      BackgroundCandies.astro  # blurred candies (landing + behind candy pages)
      Backdrop.astro        # white 60% + black 10% + 21px blur (8:210)
      CornerOrnaments.astro # 4 corners, one SVG flipped/rotated (5:2)
      Credits.astro
    three/
      candy-kit.ts          # TS port of assets/3d/candy-kit/candy-kit.js
      mount.ts              # mountCandy(el, slug, opts): lazy, poster, pause offscreen
      lib/                  # sdf mesher, sugar grains, wrapper material
      candies/<slug>.ts     # one module per candy
    pages/
      index.astro           # landing (3:679)
      candy/[slug].astro    # candy template (8:192)
      credits.astro
      dev/tokens.astro      # token swatches/type specimens for Figma sync checks
      dev/3d.astro          # all 3D candies side by side at real scale
  tests/  visual.spec.ts  a11y.spec.ts  three.spec.ts
  review/                   # 3D review renders + APPROVALS.md
```

## 3. Content (data-driven)

- **Sheet = source of truth for copy**: name, year, maker, about, sheet image credit. Never hand-edit copy in code or in `candies.json`.
- `candies.extra.json` holds what the sheet doesn't: `slug`, `type` (candy type is **not in the sheet**; values were taken from Figma), `hero`, `variants[]` (name, src, figmaNode, credit, license), `model3d`, `figmaNode`. If a `Candy type` column is added to the sheet, the script uses it automatically.
- Update flow: Sheets → File → Download → CSV (tab Candy) → save as `content/source/candy-sheet.csv` → `npm run content`. Alternatively, `npm run content -- --fetch` downloads the CSV directly if the sheet is shared "anyone with link can view" (or set `SHEET_CSV_URL`). The script fails on unknown candy names and warns about missing assets.
- `candies.json` shape (per candy): `slug, order, name, year, type, maker, about, hero{src,alt,credit,license}, model3d{src,seed}|null, variants[{name,src|null,figmaNode,credit,license}], credits{sheetImage,hero,variants[]}, figma{page,hero}`.
- Order on the site = sheet row order (it drives next/prev).
- Variants with `src: null` are placeholders. The reference page removed its placeholders, so they're hidden (`site.json → candyPage.layout.hidePlaceholderTiles`).
- Sheet copy is used verbatim. Typos to fix **in the sheet**: "skiiers" (Kexchoklad), "The brand has long associated with" (missing "been"), "swedish" lowercase (Djungelvrål), trailing spaces.

## 4. Design tokens and open Figma decisions

`tokens.css` is the only place for colours, type, spacing and sizes. Components use `var(--…)` only. Each token comments its Figma node ID. The Figma file has **no variables** yet (`get_variable_defs` returned `{}`), so tokens are raw values. If variables are added later, rename the tokens to match them. Sync loop: change in Figma → update `tokens.css` → check `/dev/tokens` → visual test against `reference/`.

Extracted highlights: brand teal `#318593`; text `#000`; muted `#77746E`; button bg `#F2F1F1`; tile stroke `#DADADA` (1px inside); body Funnel Sans 14/24; section headings Funnel Sans SemiBold 15/27; labels Medium 15 muted; values 14; tile labels Regular 12 muted; candy title Fraunces SemiBold 24 teal (stand-in); landing title Begum Medium 50 / −0.05em teal; eyebrow Funnel Sans 14. Layout: canvas 1400×1038, panel 429, content 375 at x24/y96, stack gap 12, tile 117 (image 109), grid gap 12, buttons 45 round, hero 512 centred in the area right of the panel, backdrop white 60% + black 10% + blur 21px.

Open decisions, and how the code stays flexible:

| Open | Current | Flex point |
|---|---|---|
| Display font | Intended **Begum** (commercial, needs a webfont licence). Figma uses **Fraunces** as a stand-in on candy titles. | `--font-display` + `--font-display-variation` only. Add `@font-face` for Begum in `public/fonts` later; nothing else changes. |
| Corner ornament | Component 5:2 still being refined. The landing uses vectorized traced corners (3:701 etc.). | `CornerOrnaments.astro` loads a single SVG (`assets/ornament/corner-ornament-traced.svg`) and flips it per corner. Replacing the file updates everything. Colour comes from `--color-brand` (inline SVG `fill: currentColor`). |
| 3D for all candies | Polkagris and Djungelvrål exist. The other 7 are built in Phase 6, each pending user approval. | `model3d` per candy in `candies.extra.json`. `CandyHero` shows the PNG when it's `null`. |
| Details layout | Reference 8:192 is stacked (Date of invention, Candy type). BUBS 8:121 tried a row with Maker. | `site.json → candyPage.layout.details: "stacked"/"row"`, `showMaker`. |
| Landing art | Figma uses screenshot crops; the sharp hero is a red raspberry gummy that isn't in the candy list; cherry and pink foam aren't either. | `content/landing-layout.json` maps each slot to a cut-out, so it's easy to swap. |
| Mobile | No mobile frames in Figma. | Breakpoint tokens; layout in Phase 7 is a proposal for the user to review. |

Landing is decided: **3:679**. Variants A (10:11), B (10:155) and the original (3:226) are past explorations only. Don't build them.

## 5. Phases and acceptance criteria

Work in order. Each phase ends with `npm run build` passing, a short demo note, and screenshots compared to `reference/`.

**Phase 1: Scaffold + tokens + content pipeline**
- Astro + TS strict, Prettier, Playwright. Copy `tokens.css`, `content/`, `assets/`, `scripts/`. Add npm scripts `content`, `images`, `dev`, `build`, `test`.
- `scripts/optimize-images.mjs` (sharp): every PNG → webp and png at 256/512/1024 widths (no upscaling) in `public/img/`, plus `lib/img.ts` for srcset.
- `/dev/tokens` page shows every colour, type style and spacing token.
- Accept: `npm run content` regenerates an identical `candies.json`; zod validation fails on a broken entry; no hex/px literals in components (lint grep check); `/dev/tokens` renders.

**Phase 2: Candy page template, all 9 candies** (reference 8:192)
- `/candy/[slug]` for all 9. Panel: close button (left), next button (right), title, about, Details, "Similar Candies" grid. Hero 512px PNG on the right. Blurred background candies behind the `Backdrop`.
- `SimilarTile`: 117×117 box, `border: 1px solid #DADADA` with `box-sizing: border-box` (inside stroke), image 109px `object-fit: contain` inset 4px, caption below with 6px gap, Funnel Sans 12 #77746E.
- Accept: at 1400×1038 each page matches its Figma screenshot (Pastellfiskar pixel diff ≤ 2% vs `reference/candy-pastellfiskar_8-192_REFERENCE.png`, ignoring the background area); every string comes from JSON; every element carries `data-figma="<node id>"` or a comment.

**Phase 3: Landing page** (reference 3:679)
- Centred eyebrow "A short history of" + title "Swedish Candy" (group 3:1021, vertically centred). Four 310px corner ornaments flush to the corners. 8 blurred, rotated candies and 1 sharp hero from `landing-layout.json`, positioned in % of a 1400×1038 stage that scales with the viewport (`min(100vw/1400, 100vh/1038)`).
- Accept: pixel diff ≤ 3% vs `reference/landing_3-679_REFERENCE.png` with cut-outs swapped in; blur/opacity/rotation per slot come from data.

**Phase 4: Navigation**
- Close (X) → `/`. Next arrow → next candy in sheet order (wraps from Cola to Polkagris). Keyboard: → next, ← previous, Esc close. Swipe left/right on touch. View Transitions between candies (hero cross-fade). Landing candies and the sharp hero link to their candy pages (**open question**: confirm the landing should be clickable).
- Accept: all 9 reachable in a loop; back button works; focus lands on the title after navigation; reduced motion = no animated transition.

**Phase 5: Three.js hero integration**
- Port `candy-kit.js` to `src/three/candy-kit.ts`, and polkagris and djungelvral to `src/three/candies/*.ts` (same configs, same look). `mountCandy()`: show the PNG poster first, `import()` three + the module when the hero is visible, cross-fade to the canvas when `ready`, pause off-screen or when the tab is hidden, and keep the PNG on WebGL failure or `?no3d`.
- Accept: polkagris and djungelvral pages animate; other pages show PNGs with no three.js download (check the network panel); initial JS on a candy page < 15 kB before 3D; renders match the existing `preview.png` (side-by-side check).

**Phase 6: Build the remaining 3D candies** (follow `3D_CANDY_GUIDELINES.md`)
- Order: BUBS, Pastellfiskar, Cola, Gott & Blandat, Ahlgrens bilar, Kexchoklad, Daim, each matched to its `hero.png`.
- **Stop for user review after BUBS** (the first new one). After that, one candy at a time with a review package (§11 of the guidelines). Record approvals in `review/APPROVALS.md`.
- Accept per candy: the full checklist in the guidelines (silhouette IoU ≥ 0.9, seamless loop, shared lighting, budgets, exports, user approval). `model3d` added to `candies.extra.json`; `/dev/3d` shows all candies at true relative scale.

**Phase 7: Motion and reduced motion**
- Background candies drift gently (CSS transforms, slow, out of sync). Hero tumble from the kit. Page transitions.
- Accept: under `prefers-reduced-motion: reduce` nothing moves (3D shows its `staticTime` still, no drift, no transitions); toggling the OS setting updates live.

**Phase 8: Responsive / mobile**
- ≥ 1100px: Figma layout. 700–1100px: narrower panel (min 360px), smaller hero. < 700px: hero on top (~55vh, blurred candies behind it), panel below at full width, buttons fixed top, tiles in a 3-column fluid grid. Landing: fewer, smaller blurred candies, ornaments scaled to ~35vw.
- Accept: no horizontal scroll at 320–1920px; tap targets ≥ 44px; screenshots at 390, 768, 1280 and 1440 widths reviewed by the user.

**Phase 9: Accessibility**
- Semantic landmarks; `h1` = candy name; Details as `<dl>`; Similar Candies as a list with alt text = variant name; buttons with `aria-label` from `site.json`; visible focus ring in `--color-brand`; decorative blurred candies and ornaments `aria-hidden`; 3D canvas `role="img"` with a label; muted #77746E on white is 4.66:1 (passes AA); brand teal #318593 is 4.28:1, fine for the 24px+ titles and focus ring but not for small body text.
- Accept: axe has no serious/critical issues on all pages; keyboard-only run-through works; screen reader announces page changes.

**Phase 10: Performance**
- webp + srcset; `loading="lazy"` except the hero; preload the hero poster; fonts self-hosted, subset, `font-display: swap`; three.js lazy-loaded; one shared renderer if several 3D candies share a page; DPR cap 2.
- Accept: Lighthouse mobile ≥ 90 performance, ≥ 95 a11y; LCP < 2.5 s on Fast 3G emulation; total image weight on a candy page < 600 kB before 3D.

**Phase 11: Deploy**
- Vercel (or Netlify) from GitHub, preview deploy per PR, `npm run build` output `dist/`. Add a `/credits` page. Set `noindex` until reference-only images are replaced (see §6).
- Accept: production URL live; previews on PRs; 404 page styled.

## 6. Asset licensing

`assets/manifest.json` classifies every file: **open** (CC BY-SA / CC0 / PD: credit required; CC BY-SA cut-outs are derivatives, so share-alike applies to those images), **own** (3D renders, user's photo, ornament), **user-supplied** (confirm rights: BUBS, Kexchoklad and Cola heroes), and **reference-only** (15 files: retailer/brand images, e.g. BUBS variants, Daim hero, Pastellfiskar hero, Cola variants; see `assets/candies/credits.md`).
- Reference-only images may be used in local/preview builds but **must not go public** without permission or replacement. Add a build flag `PUBLIC_RELEASE=true` that fails the build if any `license: "reference-only"` image is referenced.
- Brand names and wrapper designs (Kexchoklad, Daim, Haribo, BUBS) are trademarks. 3D wrappers should be faithful but stylised recreations, approved by the user.
- `/credits` lists every image credit from `candies.json`.

## 7. Open questions for the user

1. Display font: buy a Begum webfont licence (which weights), or keep Fraunces?
2. BUBS title: Figma 8:121 says "Lemon Raspberry Skalle"; the sheet says "BUBS". Plan uses the sheet.
3. Should "Maker" (in the sheet) appear on candy pages? The reference 8:192 doesn't show it.
4. Landing: should the blurred candies and the sharp hero link to candy pages? The sharp hero (a raspberry gummy), cherry and pink foam aren't among the 9 candies. Which candies go in those slots?
5. Is a landing body paragraph wanted (explorations had lorem ipsum; 3:679 has none)?
6. Add a "Candy type" column to the sheet so all copy lives there?
7. Mobile layout: OK to start from the Phase 8 proposal?
8. Replacement plan for the 15 reference-only images before public launch.
9. Domain and host (Vercel vs Netlify).
