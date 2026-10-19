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

  // ornaments: Figma vector 3:781 (306.8 x 310), rotated per corner, flush to the four corners
  for (const [id, x, y, w, h] of [['3:701', 0, 0, 310, 307], ['3:941', 1093, 0, 307, 310], ['3:781', 0, 728, 307, 310], ['3:861', 1090, 731, 310, 307]] as const) {
    const b = (await page.locator(`[data-figma="${id}"]`).boundingBox())!;
    expect([b.x, b.y, b.width, b.height].map(Math.round)).toEqual([x, y, w, h]);
  }

  // let load-time transitions (blur follows the stage size) settle
  await page.waitForFunction(() => document.getAnimations().every((a) => !(a instanceof CSSTransition)));
  // every slot with an image renders with its blur / opacity / rotation from landing-layout.json
  for (const s of layout.blurredCandies.filter((s) => s.src)) {
    const st = await page.locator(`.slot[data-figma="${s.figmaNode}"]`).evaluate((el) => {
      const c = getComputedStyle(el); return { filter: c.filter, opacity: c.opacity, rotate: c.rotate };
    });
    expect(Number(st.filter.match(/blur\(([\d.]+)px\)/)?.[1])).toBeCloseTo(s.blurPx, 1);
    expect(Number(st.opacity)).toBeCloseTo(s.opacity, 2);
    expect(st.rotate).toBe(`${s.rotateDeg}deg`);
  }
  // the sharp hero renders too (no blur)
  await expect(page.locator(`.slot.sharp[data-figma="${layout.sharpHero.figmaNode}"] img`)).toBeVisible();
  // candies are labelled links; any slot that isn't a link is hidden from assistive tech
  for (const el of await page.locator('.slot:not(a)').all()) await expect(el).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.ornaments')).toHaveAttribute('aria-hidden', 'true');
});

test('landing scales with the viewport (min(100vw/1400, 100vh/1038))', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 1038 });
  await page.goto('/');
  const b = (await page.locator('[data-figma="3:701"]').boundingBox())!;
  expect(Math.round(b.width)).toBe(155); // TL ornament: 310 canvas px wide at half scale
});

test('landing candies spin slowly and drift nearer/farther; still under reduced motion', async ({ page }) => {
  await page.goto('/');
  const pose = () => page.locator('.slot').first().evaluate((el) => {
    const d = getComputedStyle(el.querySelector('.depth')!), s = getComputedStyle(el.querySelector('.spin')!);
    return `${d.scale}|${s.rotate}`;
  });
  const a = await pose(); await page.waitForTimeout(500);
  expect(await pose()).not.toBe(a);
  expect(await page.locator('.spin').first().evaluate((el) => getComputedStyle(el).animationDuration))
    .not.toBe('0s');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const r = await page.locator('.spin').first().evaluate((el) => getComputedStyle(el).animationName);
  expect(r).toBe('none');
});

test('every landing candy links to its candy page (linksTo), with a readable label', async ({ page }) => {
  const slots = [layout.sharpHero, ...layout.blurredCandies].filter((s) => s.src && s.linksTo);
  expect(slots.length).toBeGreaterThan(0);
  for (const s of slots) {
    await page.goto('/');
    const a = page.locator(`a.slot[data-figma="${s.figmaNode}"]`);
    await expect(a).toHaveAttribute('href', `/candy/${s.linksTo}/`);
    await expect(a).toHaveAttribute('aria-label', /\S/);
    await a.click({ force: true }); // it's moving; force skips the stability wait
    await page.waitForURL(`**/candy/${s.linksTo}/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('scrolling stirs the landing candies (near ones move most), then they settle back home', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const sy = () => page.$$eval('.slot', (els) => els.map((e) => Number(getComputedStyle(e).getPropertyValue('--sy') || 0)));
  expect((await sy()).every((v) => v === 0)).toBe(true);
  await page.mouse.move(700, 300);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  const { moved, sharp } = await page.evaluate(() => {
    const v = (e: Element) => Math.abs(Number(getComputedStyle(e).getPropertyValue('--sy')));
    return { moved: [...document.querySelectorAll('.slot')].map(v), sharp: v(document.querySelector('.slot.sharp')!) };
  });
  expect(moved.some((v) => v > 5)).toBe(true);
  expect(sharp).toBe(Math.max(...moved)); // the sharp (nearest) candy travels farthest
  await page.waitForTimeout(4000);
  expect((await sy()).every((v) => Math.abs(v) < 2)).toBe(true);
});

test('reduced motion: scrolling leaves the landing candies still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.mouse.move(700, 300);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  const v = await page.$$eval('.slot', (els) => els.map((e) => getComputedStyle(e).getPropertyValue('--sy')));
  expect(v.every((x) => !x || Number(x) === 0)).toBe(true);
});
