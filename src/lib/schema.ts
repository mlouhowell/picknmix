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
  landing: z.object({ eyebrow: text, title: text }),
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
});

export const LandingLayoutSchema = z.object({
  canvas: z.object({ w: z.number().positive(), h: z.number().positive() }),
  title: z.object({ figmaNode: figmaId, centerYPct: pct }),
  sharpHero: slot.extend({ linksTo: z.string().nullable() }),
  blurredCandies: z.array(slot.extend({ blurPx: z.number().min(0), opacity: z.number().min(0).max(1) })),
});

export type Candy = z.infer<typeof CandySchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Site = z.infer<typeof SiteSchema>;
export type LandingLayout = z.infer<typeof LandingLayoutSchema>;
export type License = z.infer<typeof license>;
