// Loads + validates content/*.json once per build. Components import from here, never the JSON directly.
import candiesJson from '../../content/candies.json';
import siteJson from '../../content/site.json';
import landingJson from '../../content/landing-layout.json';
import { CandiesFileSchema, SiteSchema, LandingLayoutSchema, type Candy } from './schema';
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
