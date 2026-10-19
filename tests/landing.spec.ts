import { test, expect } from '@playwright/test';
import layout from '../content/landing-layout.json' with { type: 'json' };
import site from '../content/site.json' with { type: 'json' };

test('landing 3:679: copy, centred title, flush ornaments, slots driven by data', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-figma="3:690"]')).toHaveText(site.landing.eyebrow);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(site.landing.title);

  const vp = page.viewportSize()!;
  const g = (await page.locator('[data-figma="3:1021"]').boundingBox())!;
  expect(Math.abs(g.x + g.width / 2 - vp.width / 2)).toBeLessThan(2);
  expect(Math.abs(g.y + g.height / 2 - (vp.height * layout.title.centerYPct) / 100)).toBeLessThan(4);

  // ornaments: 310 canvas px, flush to the four corners
  for (const [id, x, y] of [['3:701', 0, 0], ['3:941', 1090, 0], ['3:781', 0, 728], ['3:861', 1090, 728]] as const) {
    const b = (await page.locator(`[data-figma="${id}"]`).boundingBox())!;
    expect([Math.round(b.x), Math.round(b.y), Math.round(b.width)]).toEqual([x, y, 310]);
  }

  // every slot with an image renders with its blur / opacity / rotation from landing-layout.json
  for (const s of layout.blurredCandies.filter((s) => s.src)) {
    const st = await page.locator(`.slot[data-figma="${s.figmaNode}"]`).evaluate((el) => {
      const c = getComputedStyle(el); return { filter: c.filter, opacity: c.opacity, rotate: c.rotate };
    });
    expect(st.filter).toBe(`blur(${s.blurPx}px)`);
    expect(Number(st.opacity)).toBeCloseTo(s.opacity, 2);
    expect(st.rotate).toBe(`${s.rotateDeg}deg`);
  }
  // decorative art is hidden from assistive tech
  await expect(page.locator('.slots')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.ornaments')).toHaveAttribute('aria-hidden', 'true');
});

test('landing scales with the viewport (min(100vw/1400, 100vh/1038))', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 1038 });
  await page.goto('/');
  const b = (await page.locator('[data-figma="3:701"]').boundingBox())!;
  expect(Math.round(b.width)).toBe(155);
});
