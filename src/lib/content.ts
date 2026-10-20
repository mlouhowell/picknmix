// Loads + validates content/*.json once per build. Components import from here, never the JSON directly.
import candiesJson from '../../content/candies.json';
import siteJson from '../../content/site.json';
import landingJson from '../../content/landing-layout.json';
import { CandiesFileSchema, SiteSchema, LandingLayoutSchema, type Candy } from './schema';
import { hasImg } from './img';
import type { z } from 'zod';

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown, file: string): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid ${file}:\n${issues}`);
  }
  return r.data;
}

export const site = parse(SiteSchema, siteJson, 'content/site.json');
export const landing = parse(LandingLayoutSchema, landingJson, 'content/landing-layout.json');
/** All candies in sheet order (drives next/prev). */
export const candies: Candy[] = parse(CandiesFileSchema, candiesJson, 'content/candies.json').candies.sort(
  (a, b) => a.order - b.order,
);

for (const e of landing.extraPieces)
  if (!candies.some((c) => c.slug === e.linksTo))
    throw new Error(`content/landing-layout.json: extraPieces "${e.src}" links to unknown candy "${e.linksTo}"`);

for (const src of landing.hidePieces)
  if (!candies.some((c) => c.hero.src === src || c.variants.some((v) => v.src === src)))
    throw new Error(`content/landing-layout.json: hidePieces "${src}" is not a candy photo`);

for (const s of [landing.sharpHero, ...landing.blurredCandies])
  if (s.linksTo && !candies.some((c) => c.slug === s.linksTo))
    throw new Error(`content/landing-layout.json: slot ${s.figmaNode} links to unknown candy "${s.linksTo}"`);

export function getCandy(slug: string): Candy {
  const c = candies.find((c) => c.slug === slug);
  if (!c) throw new Error(`Unknown candy slug "${slug}"`);
  return c;
}

/** Next/previous in sheet order, wrapping (Cola -> Polkagris). */
export function neighbours(slug: string): { prev: Candy; next: Candy } {
  const i = candies.findIndex((c) => c.slug === slug);
  const n = candies.length;
  return { prev: candies[(i - 1 + n) % n]!, next: candies[(i + 1) % n]! };
}

/** Variants shown as Similar Candies tiles (placeholders hidden per site.json). */
export function visibleVariants(c: Candy) {
  return site.candyPage.layout.hidePlaceholderTiles ? c.variants.filter((v) => v.src) : c.variants;
}

export const candyHref = (c: Pick<Candy, 'slug'>) => `/candy/${c.slug}/`;

/** A photo on the landing: a candy's hero or one of its variants (links to the candy's page). */
export type Piece = { candy: Candy; src: string; name: string; hero: boolean };

/** Landing pieces grouped by candy (sheet order): hero first, then variants with an image if `variants`,
 *  minus landing.hidePieces. A candy whose photos are all hidden drops off the landing. */
export function pieceFamilies(variants: boolean): Piece[][] {
  const hidden = new Set(landing.hidePieces);
  return candies.map((c) => [
    ...(hasImg(c.hero.src) ? [{ candy: c, src: c.hero.src, name: c.name, hero: true }] : []),
    ...(variants ? c.variants.filter((v) => hasImg(v.src)).map((v) => ({ candy: c, src: v.src!, name: v.name, hero: false })) : []),
    ...landing.extraPieces.filter((e) => e.linksTo === c.slug && hasImg(e.src)).map((e) => ({ candy: c, src: e.src, name: e.name, hero: false })),
  ].filter((p) => !hidden.has(p.src))).filter((f) => f.length);
}
