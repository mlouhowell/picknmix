// The candies the site actually builds: content/candies.json minus content/removed.json (same rule as src/lib/content.ts).
import data from '../content/candies.json' with { type: 'json' };
import removed from '../content/removed.json' with { type: 'json' };

const pieces = new Set(removed.pieces);
const noImage = new Set(removed.variantsWithoutImage);
export const siteCandies = [...data.candies]
  .filter((c) => !removed.candies.includes(c.slug))
  .sort((a, b) => a.order - b.order)
  .map((c) => ({ ...c, variants: c.variants.filter((v) => !(v.src && pieces.has(v.src)) && !noImage.has(`${c.slug}/${v.name}`)) }));
