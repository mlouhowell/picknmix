import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { diffPct } from './visual-diff';
import { siteCandies } from './site-candies';

const REF = 'reference/candy-pastellfiskar_8-192_REFERENCE.png';
mkdirSync('review/shots', { recursive: true });

async function settle(page: import('@playwright/test').Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].filter((i) => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight).every((i) => i.complete));
}

test('Pastellfiskar matches Figma 8:192 (panel + hero, background ignored) within 2%', async ({ page }) => {
  await page.goto('/candy/pastellfiskar/');
  await settle(page);
  const shot = await page.screenshot({ path: 'review/shots/pastellfiskar.png' });

  // the Similar Candies tiles are data-driven (content/removed.json can drop some), so compare the panel above and
  // below them; tile size + stroke are checked per candy page below
  const g = (await page.locator('[data-figma="8:231"]').boundingBox())!;
  const top = Math.floor(g.y), bottom = Math.ceil(g.y + g.height);
  const panel = await diffPct(shot, REF, [[0, 0, 429, top], [0, bottom, 429, 1038 - bottom]]);
  // hero: hide the blurred background so we only compare pixels the hero image covers
  await page.addStyleTag({ content: '[data-figma="3:679"]{display:none!important}' });
  const heroOnly = await page.screenshot();
  const plain = await page.screenshot({ clip: { x: 1390, y: 1028, width: 1, height: 1 } });
  const { data } = await sharp(plain).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const hero = await diffPct(shot, REF, [[658, 263, 512, 512]], { shot: heroOnly, bg: [data[0]!, data[1]!, data[2]!] });

  console.log(`panel ${panel.pct.toFixed(2)}% @${panel.offset}  hero ${hero.pct.toFixed(2)}% @${hero.offset} (${hero.compared} px)`);
  expect(panel.pct).toBeLessThanOrEqual(2);
  // the hero is the film-grain render (assets/grid-grain), the Figma reference is the clean one: the grain alone is ~13%
  expect(hero.pct).toBeLessThanOrEqual(15);
});

for (const c of siteCandies) {
  test(`candy page ${c.slug}: content from JSON, structure from Figma`, async ({ page }) => {
    await page.goto(`/candy/${c.slug}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.name);
    await expect(page.locator('[data-figma="8:221"]')).toHaveText(c.about);
    await expect(page.locator('dd').first()).toHaveText(c.year);
    for (const id of ['8:211', '8:219', '8:236', '8:212', '8:214']) await expect(page.locator(`[data-figma="${id}"]`).first()).toBeAttached();
    const tiles = page.locator('[data-figma="8:231"] > li');
    await expect(tiles).toHaveCount(c.variants.filter((v) => v.src).length);
    if (await tiles.count()) {
      const box = await tiles.first().locator('.box').boundingBox();
      expect([box?.width, box?.height]).toEqual([117, 117]);
      const border = await tiles.first().locator('.box').evaluate((el) => getComputedStyle(el).border);
      expect(border).toBe('1px solid rgb(218, 218, 218)');
    }
    await expect(page.getByText(/other candies/i)).toHaveCount(0);
    await page.screenshot({ path: `review/shots/${c.slug}.png` });
  });
}
