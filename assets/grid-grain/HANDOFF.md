# Pick N Mix — candy renders with film grain (handoff for Claude Code)

The 13 candy renders from the landing grid (Figma "Landing · Grid view", 109:27 / Final page copy 155:278) with a subtle monochrome film grain **baked in**.
Grain: luminance-only gaussian noise, softened with a 0.6px blur, multiplied by alpha (transparent background and clean edges; alpha channel untouched).

## Files
Default set = **medium** (sigma 7/255), in `web/`. Alternates in `web/light/` (4/255) and `web/strong/` (11/255), same names.

| name | 1x | @2x |
|---|---|---|
| blue-skull, pastellfiskar, pink-car, sura-colanappar, polkagris, djungelvral, cola-bottle, orange-fruit-disc, fried-egg, gummy-cherry, strawberry, rambo, pink-marshmallow | `<name>.png` / `<name>.webp` — 512×512 | `<name>@2x.png` / `<name>@2x.webp` — 1024×1024 |

- All square, transparent RGBA. Source = 1024×1024 (the exact files placed in Figma), so @2x is native res; 1x is a Lanczos downscale with grain re-applied at that size.
- WebP quality 85 with alpha (~2 MB for the whole default set); PNG is the fallback (~18 MB; grain makes PNGs large — prefer WebP).
- Grid tiles display at ~206 CSS px, so 1x covers 2× screens; @2x is for larger/zoomed layouts.

## Swap into the grid
Replace each tile's image with:

```html
<picture>
  <source type="image/webp" srcset="/candy/blue-skull.webp 1x, /candy/blue-skull@2x.webp 2x">
  <img src="/candy/blue-skull.png" srcset="/candy/blue-skull.png 1x, /candy/blue-skull@2x.png 2x"
       width="512" height="512" loading="lazy" decoding="async" alt="Blue sugared skull candy">
</picture>
```
Use CSS to size (e.g. `img { width: 100%; height: auto; }`); keep width/height attributes for aspect-ratio/no layout shift. Eager-load (`loading="eager"`, optionally `fetchpriority="high"`) only the first visible row.

**Grain is baked in — no CSS filter or overlay is needed.** Don't add `filter: contrast()` etc.; to change strength, swap folders (`web/light`, `web/strong`).

## Optional: CSS-only grain alternative (reference only)
If you'd rather keep clean images and add grain live, overlay SVG turbulence masked to the image's alpha:

```html
<svg width="0" height="0" style="position:absolute">
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/></filter>
</svg>
```
```css
.candy { position: relative; }
.candy::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: overlay; opacity: .25;
  -webkit-mask: var(--src) center / contain no-repeat; mask: var(--src) center / contain no-repeat;
}
/* <div class="candy" style="--src:url(/candy/blue-skull.png)"><img ...></div> */
```
Trade-off: costs paint per tile, and looks slightly different across browsers; baked files are recommended.
