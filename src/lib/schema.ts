// Zod schemas for everything in content/. Validation runs at build time (content.ts),
// so a broken entry in candies.json / site.json / landing-layout.json fails `npm run build`.
import { z } from 'zod';

const license = z.enum(['open', 'own', 'user-supplied', 'reference-only']);
const figmaId = z.string().regex(/^\d+:\d+$/, 'Figma node id like "8:192"');
/** Logical asset path relative to assets/, e.g. "candies/bubs/hero.png". */
const assetSrc = z.string().regex(/^[\w./-]+\.(png|jpe?g|webp|html)$/, 'logical asset path');
const text = z.string().trim().min(1);

export const VariantSchema = z.object({
  name: text,
  src: assetSrc.nullable(),
  figmaNode: figmaId,
  credit: z.string().nullable(),
  license: license.nullable(),
});

export const CandySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  order: z.number().int().positive(),
  name: text,
  year: text,
  type: text,
  maker: text,
  about: text,
  hero: z.object({ src: assetSrc, alt: text, credit: text, license }),
  model3d: z.object({ src: assetSrc, seed: z.number().int() }).nullable(),
  variants: z.array(VariantSchema),
  credits: z.object({
    sheetImage: z.object({ url: z.string().url().nullable(), credit: z.string().nullable() }),
    hero: z.string().nullable(),
    variants: z.array(z.object({ name: text, credit: z.string().nullable(), license: license.nullable() })),
  }),
  figma: z.object({ page: figmaId, hero: figmaId }),
});

export const CandiesFileSchema = z
  .object({ _generated: z.string(), candies: z.array(CandySchema).min(1) })
  .superRefine((f, ctx) => {
    const slugs = new Set<string>();
    f.candies.forEach((c, i) => {
      if (slugs.has(c.slug)) ctx.addIssue({ code: 'custom', path: ['candies', i, 'slug'], message: `duplicate slug ${c.slug}` });
      slugs.add(c.slug);
    });
  });

export const SiteSchema = z.object({
  siteName: text,
  landing: z.object({ eyebrow: text, title: text, candyLinkLabel: text }), // {name} = candy name
  candyPage: z.object({
    detailsHeading: text,
    labels: z.object({ year: text, type: text, maker: text }),
    similarHeading: text,
    close: text,
    next: text,
    prev: text,
    credits: text,
    layout: z.object({
      details: z.enum(['stacked', 'row']),
      showMaker: z.boolean(),
      hidePlaceholderTiles: z.boolean(),
    }),
  }),
});

const pct = z.number().min(-50).max(150);
const slot = z.object({
  figmaNode: figmaId,
  candy: text,
  src: assetSrc.nullable(),
  leftPct: pct,
  topPct: pct,
  widthPct: pct,
  heightPct: pct,
  rotateDeg: z.number(),
  linksTo: z.string().nullable(), // candy slug opened on click (null = decorative only)
  // optional per-slot motion overrides (defaults in landing.motion)
  spinSeconds: z.number().positive().optional(),
  depthSeconds: z.number().positive().optional(),
});

export const LandingLayoutSchema = z.object({
  mode: z.enum(['universe', 'collage']), // OPEN: universe fly-through (doodle-style) vs the still 3:679 collage
  canvas: z.object({ w: z.number().positive(), h: z.number().positive() }),
  title: z.object({ figmaNode: figmaId, centerYPct: pct }),
  sharpHero: slot,
  blurredCandies: z.array(slot.extend({ blurPx: z.number().min(0), opacity: z.number().min(0).max(1) })),
  // slow spin + drift nearer/farther (scale); off under prefers-reduced-motion
  motion: z.object({
    spinSeconds: z.number().positive(),
    depthSeconds: z.number().positive(),
    scaleNear: z.number().positive(),
    scaleFar: z.number().positive(),
    // scrolling stirs the candies (landing only): travel in canvas px for the nearest candy, extra spin,
    // push per wheel px, and how fast they ease back home
    scrollTravel: z.number().min(0),
    scrollSpinDeg: z.number(),
    scrollSensitivity: z.number().min(0),
    scrollReturnPerSecond: z.number().positive(),
  }),
  // mode "universe": every candy floats in depth; scrolling flies through them (lib/universe.ts)
  universe: z.object({
    copies: z.number().int().min(1),
    lanes: z.array(z.tuple([z.number(), z.number()])).min(1),
    jitterPx: z.number().min(0),
    itemPx: z.number().positive(),
    perspectivePx: z.number().positive(),
    stepZ: z.number().positive(),
    fadeInPx: z.number().positive(),
    fadeOutStartZ: z.number().max(0),
    fadeOutEndZ: z.number().max(0),
    farBlurPx: z.number().min(0),
    blurStartZ: z.number().max(0),
    spinDeg: z.number(),
    scrollSpeed: z.number().min(0),
    ease: z.number().positive(),
    driftPxPerSecond: z.number().min(0),
    focusZ: z.number().max(0),
  }),
});

export type Candy = z.infer<typeof CandySchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Site = z.infer<typeof SiteSchema>;
export type LandingLayout = z.infer<typeof LandingLayoutSchema>;
export type License = z.infer<typeof license>;
