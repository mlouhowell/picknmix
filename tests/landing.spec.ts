import { test, expect, type Page } from '@playwright/test';
import layout from '../content/landing-layout.json' with { type: 'json' };
import site from '../content/site.json' with { type: 'json' };
import grid from '../content/grid/candies.json' with { type: 'json' };
import timeline from '../content/timeline.json' with { type: 'json' };

test('landing 3:679: copy, centred title, flush ornaments', async ({ page }) => {
  test.skip(layout.mode === 'grid', 'grid mode: title + ornaments sit in the intro block (see grid tests)');
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

  await expect(page.locator('.ornaments')).toHaveAttribute('aria-hidden', 'true');
});

test('landing scales with the viewport (min(100vw/1400, 100vh/1038))', async ({ page }) => {
  test.skip(layout.mode === 'grid', 'grid mode: see grid tests');
  await page.setViewportSize({ width: 700, height: 1038 });
  await page.goto('/');
  const b = (await page.locator('[data-figma="3:701"]').boundingBox())!;
  expect(Math.round(b.width)).toBe(155); // TL ornament: 310 canvas px wide at half scale
});

test.describe('grid mode', () => {
  test.skip(layout.mode !== 'grid', 'landing-layout.json mode is not "grid"');

  test('intro: copy and the four ornaments framing the title (or just the grid when grid.intro is off)', async ({ page }) => {
    await page.goto('/');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toContainText(site.landing.title);
    if (!layout.grid.intro) {
      await expect(page.locator('.ornaments')).toHaveCount(0);
      await expect(page.locator('[data-figma="3:690"]')).toHaveCount(0);
      expect(await h1.evaluate((e) => e.getBoundingClientRect().width)).toBeLessThanOrEqual(1); // visually hidden
      return;
    }
    await expect(page.locator('[data-figma="3:690"]')).toHaveText(site.landing.eyebrow);
    const intro = (await page.locator('.intro').boundingBox())!;
    for (const id of ['3:701', '3:941', '3:781', '3:861']) {
      const b = (await page.locator(`[data-figma="${id}"]`).boundingBox())!;
      expect(b.y).toBeGreaterThanOrEqual(intro.y - 1);
      expect(b.y + b.height).toBeLessThanOrEqual(intro.y + intro.height + 1);
    }
    await expect(page.locator('.ornaments')).toHaveAttribute('aria-hidden', 'true');
  });

  test('grid 109:27: 13 candies repeating, 5 per row at 1440, image only (no caption or tile background)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const tiles = page.locator('.candy-grid .tile');
    expect(await tiles.count()).toBeGreaterThanOrEqual(grid.candies.length * 2);
    // first set in content/grid/candies.json order, named; repeats hidden from assistive tech
    const alts = await page.locator('.candy-grid img').evaluateAll((els) => els.map((e) => (e as HTMLImageElement).alt));
    expect(alts.slice(0, grid.candies.length)).toEqual(grid.candies.map((c) => c.name));
    expect(alts[grid.candies.length]).toBe(grid.candies[0]!.name);
    await expect(page.locator('.candy-grid li').nth(grid.candies.length)).toHaveAttribute('aria-hidden', 'true');
    // Figma 109:48: first candy image box 206x230 at x 108 (row x 96 + tile padding 12)
    const b = (await page.locator('.candy-grid img').first().boundingBox())!;
    expect([b.x, b.width, b.height].map(Math.round)).toEqual([108, 206, 230]);
    const xs = await page.locator('.candy-grid li').evaluateAll((els) => new Set(els.slice(0, 10).map((e) => Math.round(e.getBoundingClientRect().x))).size);
    expect(xs).toBe(5);
    expect(await page.locator('.candy-grid .caption').count()).toBe(0);
    expect(await tiles.first().evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    expect(await page.locator('.candy-grid img').first().getAttribute('src')).toMatch(/^\/img\/candies\/01-blue-skull-\d+\.png$/);
  });

  test('never-ending: scrolling to the end appends another set', async ({ page }) => {
    await page.goto('/');
    const before = await page.locator('.candy-grid li').count();
    await page.locator('[data-endless-sentinel]').scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('.candy-grid li').count()).toBeGreaterThan(before);
  });

  test('a candy opens the side drawer (147:1415, no 3D); next/<-/-> wrap; close, Esc and the backdrop close it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const drawer = page.locator('[data-drawer]');
    const title = drawer.locator('.content:not([hidden]) .title');
    await page.locator('.candy-grid .tile').first().click();
    await expect(drawer).toBeVisible();
    await expect(title).toHaveText(grid.candies[0]!.name);
    await expect(drawer.locator('.hero:not([hidden]) img')).toHaveAttribute('alt', grid.candies[0]!.name);
    expect(await drawer.locator('canvas').count()).toBe(0); // no 3D
    // side drawer 147:1416: 432 wide, on the right
    await expect.poll(async () => { const b = (await drawer.locator('.panel').boundingBox())!; return [b.x, b.width].map(Math.round); }).toEqual([1440 - 432, 432]);
    await page.keyboard.press('ArrowLeft');
    await expect(title).toHaveText(grid.candies.at(-1)!.name);
    await drawer.locator('[data-nav="next"]').click();
    await page.keyboard.press('ArrowRight');
    await expect(title).toHaveText(grid.candies[1]!.name);
    await drawer.locator('[data-nav="close"]').click();
    await expect(drawer).toBeHidden();
    await page.locator('.candy-grid .tile').nth(2).click();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await page.locator('.candy-grid .tile').nth(2).click();
    await page.mouse.click(140, 120); // empty area beside the candy
    await expect(drawer).toBeHidden();
  });

  test('Grid / Timeline links switch the view without reloading; the URL reflects it', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
    const tl = page.getByRole('button', { name: site.header.timeline });
    await tl.click();
    await expect(tl).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/\?view=timeline$/);
    await expect(page.locator('.timeline .kicker')).toHaveText(timeline.intro.kicker);
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1); // no reload
    await expect(page.locator('.candy-grid')).toBeHidden();
    await page.getByRole('button', { name: site.header.grid }).click();
    await expect(page.locator('.candy-grid')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('the page scrolls to the grid; two columns on a phone', async ({ page }) => {
    await page.goto('/');
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0); // normal page scroll, not hijacked
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const xs = await page.locator('.candy-grid li').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().x))).size);
    expect(xs).toBe(2);
  });
});

test.describe('timeline view (figma 179:27)', () => {
  test.skip(layout.mode !== 'grid', 'timeline lives in grid mode');
  const parts = timeline.eras.flatMap((e) => e.story.map((p) => ({ era: e.id, texts: 'text' in p ? [p.text] : p.items.map((i) => i.text) })));

  test('1440: contents | 624 text centred; eras 48 apart; every paragraph from content', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?view=timeline');
    const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
    expect(Math.round((await box('.toc')).x)).toBe(96);
    const body = await box('#beginnings .part >> nth=1 >> .body');
    expect([body.x, body.width].map(Math.round)).toEqual([408, 624]);
    const e1 = await box('#beginnings'), e2 = await box('#factories');
    expect(Math.round(e2.y - (e1.y + e1.height))).toBe(48);
    expect(await page.locator('.timeline .body').count()).toBe(parts.length);
    await expect(page.locator('.toc a')).toHaveCount(timeline.eras.length);
  });

  test('a footnote marker opens its source under the paragraph', async ({ page }) => {
    await page.goto('/?view=timeline');
    const refs = parts.flatMap((p) => p.texts.flatMap((t) => [...(t ?? "").matchAll(/\[(\d+)\]/g)].map((m) => m[1]!)));
    await expect(page.locator('.timeline [data-fn]')).toHaveCount(refs.length);
    const part = page.locator('#war-and-rationing .part').nth(1);
    const fn = part.locator('#fn-5');
    await expect(fn).toBeHidden();
    await part.getByRole('button', { name: site.timeline.footnoteLabel.replace('{n}', '5') }).click();
    await expect(fn).toBeVisible();
    await expect(fn).toContainText(timeline.footnotes['5']!);
    const body = (await part.locator('.body').boundingBox())!, note = (await fn.boundingBox())!;
    expect(note.y).toBeGreaterThan(body.y + body.height - 1);
    await part.getByRole('button', { name: site.timeline.footnoteLabel.replace('{n}', '5') }).click();
    await expect(fn).toBeHidden();
  });

  test('390: no contents column; no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?view=timeline');
    await expect(page.locator('.toc')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('era candies are the named grid candies and open the drawer', async ({ page }) => {
    await page.goto('/?view=timeline');
    for (const e of timeline.eras) {
      const names = e.candySlots.map((s) => grid.candies.find((c) => c.slug === s.candy)!.name);
      const alts = await page.locator(`#${e.id} .tl-candy img`).evaluateAll((els) => els.map((i) => (i as HTMLImageElement).alt));
      expect(alts).toEqual(names);
    }
    const candy = page.locator('#boom .tl-candy').first();
    const name = await candy.locator('img').getAttribute('alt');
    await candy.click();
    await expect(page.locator('[data-drawer] .content:not([hidden]) .title')).toHaveText(name!);
  });

  test('contents follows the era in view', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?view=timeline');
    await page.locator('[data-toc="boom"]').click();
    await expect(page.locator('[data-toc="boom"]')).toHaveAttribute('aria-current', 'true');
    await expect(page).toHaveURL(/\?view=timeline$/);
  });
});

test.describe('collage mode', () => {
  test.skip(layout.mode !== 'collage', 'landing-layout.json mode is not "collage"');

  test('collage: slots driven by data', async ({ page }) => {
    await page.goto('/');
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
});

test.describe('universe mode', () => {
  test.skip(layout.mode !== 'universe', 'landing-layout.json mode is not "universe"');
  const u = layout.universe;
  const pose = (page: Page) => page.$$eval('.item', (els) => els.map((e) => (e as HTMLElement).style.transform));

  test('every candy (and its variants) floats in the universe; one labelled tab stop per candy', async ({ page }) => {
    await page.goto('/');
    const items = page.locator('.universe .item');
    const slugs = await items.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.slug!));
    const unique = [...new Set(slugs)];
    expect(slugs.length).toBeGreaterThanOrEqual(unique.length * u.copies);
    if (u.variants) for (const s of unique) expect(slugs.filter((x) => x === s).length).toBeGreaterThan(u.copies); // hero + variants
    const tabbable = page.locator('.universe .item:not([tabindex="-1"])');
    await expect(tabbable).toHaveCount(unique.length);
    for (const el of await tabbable.all()) await expect(el).toHaveAttribute('aria-label', /\S/);
    for (const el of await page.locator('.universe .item[tabindex="-1"]').all()) await expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  test('scrolling flies through the universe and candies wrap round; hover holds the drift', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const a = await pose(page);
    await page.mouse.move(700, 450); // on the title: not on a candy
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 200);
    await page.waitForTimeout(1200);
    const b = await pose(page);
    const z = (t: string) => Number(t.match(/translate3d\([^,]+,[^,]+, (-?[\d.]+)px/)![1]);
    const moved = a.map((t, i) => z(b[i]!) - z(t));
    expect(moved.some((d) => d > 1000)).toBe(true); // flew forward
    expect(moved.some((d) => d < 0)).toBe(true); // ...and some passed the camera and wrapped to the back
  });

  test('clicking a candy opens its page', async ({ page }) => {
    await page.goto('/');
    const a = page.locator('.universe .item:not(.gone)').first();
    const href = (await a.getAttribute('href'))!;
    await a.click({ force: true });
    await page.waitForURL(`**${href}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('keyboard focus flies a candy into view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // jump, so the test needn't wait for the ease
    await page.goto('/');
    const slug = await page.locator('.universe .item.gone:not([tabindex="-1"])').first().getAttribute('data-slug');
    const gone = page.locator(`.universe .item[data-slug="${slug}"]:not([tabindex="-1"])`);
    await gone.focus();
    await expect(gone).not.toHaveClass(/gone/);
    expect(Number(await gone.evaluate((e) => (e as HTMLElement).style.opacity))).toBeGreaterThan(0.9);
  });

  test('reduced motion: no drift, scrolling leaves the universe still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const a = await pose(page);
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(600);
    expect(await pose(page)).toEqual(a);
  });
});
