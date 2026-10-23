// Loads + validates content/*.json once per build. Components import from here, never the JSON directly.
import candiesJson from '../../content/candies.json';
import siteJson from '../../content/site.json';
import landingJson from '../../content/landing-layout.json';
import removedJson from '../../content/removed.json';
import gridJson from '../../content/grid/candies.json';
import timelineJson from '../../content/timeline.json';
import { CandiesFileSchema, SiteSchema, LandingLayoutSchema, RemovedSchema, GridCandiesFileSchema, TimelineSchema, type Candy, type GridCandy } from './schema';
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
const removed = parse(RemovedSchema, removedJson, 'content/removed.json');
/** Every candy in the sheet, including removed ones (only for validating references). */
const allCandies: Candy[] = parse(CandiesFileSchema, candiesJson, 'content/candies.json').candies.sort(
  (a, b) => a.order - b.order,
);
for (const slug of removed.candies)
  if (!allCandies.some((c) => c.slug === slug)) throw new Error(`content/removed.json: unknown candy "${slug}"`);
for (const src of removed.pieces)
  if (!allCandies.some((c) => c.hero.src === src || c.variants.some((v) => v.src === src)))
    throw new Error(`content/removed.json: "${src}" is not a candy photo`);
for (const key of removed.variantsWithoutImage)
  if (!allCandies.some((c) => c.variants.some((v) => `${c.slug}/${v.name}` === key)))
    throw new Error(`content/removed.json: unknown variant "${key}"`);
const removedPieces = new Set(removed.pieces);
const removedVariants = new Set(removed.variantsWithoutImage);
/** Candies on the site, in sheet order (drives next/prev), minus content/removed.json. */
export const candies: Candy[] = allCandies
  .filter((c) => !removed.candies.includes(c.slug))
  .map((c) => ({
    ...c,
    variants: c.variants.filter((v) => !(v.src && removedPieces.has(v.src)) && !removedVariants.has(`${c.slug}/${v.name}`)),
  }));

for (const e of landing.extraPieces)
  if (!allCandies.some((c) => c.slug === e.linksTo))
    throw new Error(`content/landing-layout.json: extraPieces "${e.src}" links to unknown candy "${e.linksTo}"`);

for (const src of landing.hidePieces)
  if (!allCandies.some((c) => c.hero.src === src || c.variants.some((v) => v.src === src)))
    throw new Error(`content/landing-layout.json: hidePieces "${src}" is not a candy photo`);

for (const s of [landing.sharpHero, ...landing.blurredCandies])
  if (s.linksTo && !allCandies.some((c) => c.slug === s.linksTo))
    throw new Error(`content/landing-layout.json: slot ${s.figmaNode} links to unknown candy "${s.linksTo}"`);

/** Landing grid candies (content/grid/candies.json), in grid order. */
export const gridCandies: GridCandy[] = parse(GridCandiesFileSchema, gridJson, 'content/grid/candies.json').candies;
for (const c of gridCandies) if (!hasImg(gridSrc(c))) throw new Error(`content/grid/candies.json: no image for ${c.slug} (${c.image}); run \`npm run images\``);
/** Logical src for lib/img.ts ("/candies/01-blue-skull.png" -> "candies/01-blue-skull.png"). */
export function gridSrc(c: Pick<GridCandy, 'image'>) { return c.image.slice(1); }

/** Timeline view (content/timeline.json). Each era's candies = grid candies whose era is that era's id. */
export const timeline = parse(TimelineSchema, timelineJson, 'content/timeline.json');
const eraIds = new Set(timeline.eras.map((e) => e.id));
for (const c of gridCandies)
  if (c.era && !eraIds.has(c.era)) throw new Error(`content/grid/candies.json: ${c.slug} has unknown era "${c.era}" (not in content/timeline.json)`);
for (const e of timeline.eras) for (const s of [e.scrap, ...e.photos])
  if (!hasImg(s.src)) throw new Error(`content/timeline.json: no image for ${s.src}; run \`npm run images\``);
/** Candies for an era's slots: that era's candies (grid order) repeated to fill every slot; none if the era has no candies. */
export function eraCandies(eraId: string, slots: number): { candy: GridCandy; index: number }[] {
  const mine = gridCandies.map((candy, index) => ({ candy, index })).filter((c) => c.candy.era === eraId);
  return mine.length ? Array.from({ length: slots }, (_, i) => mine[i % mine.length]!) : [];
}

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
 *  minus landing.hidePieces and removed pieces. A candy whose photos are all hidden drops off the landing. */
export function pieceFamilies(variants: boolean): Piece[][] {
  const hidden = new Set([...landing.hidePieces, ...removedPieces]);
  return candies.map((c) => [
    ...(hasImg(c.hero.src) ? [{ candy: c, src: c.hero.src, name: c.name, hero: true }] : []),
    ...(variants ? c.variants.filter((v) => hasImg(v.src)).map((v) => ({ candy: c, src: v.src!, name: v.name, hero: false })) : []),
    ...landing.extraPieces.filter((e) => e.linksTo === c.slug && hasImg(e.src)).map((e) => ({ candy: c, src: e.src, name: e.name, hero: false })),
  ].filter((p) => !hidden.has(p.src))).filter((f) => f.length);
}
