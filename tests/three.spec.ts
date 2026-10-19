import { test, expect, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import data from '../content/candies.json' with { type: 'json' };

const with3d = data.candies.filter((c) => c.model3d).map((c) => c.slug);
/** every 3D module, including ones awaiting approval (not yet enabled via model3d) */
const modules = readdirSync('src/three/candies').filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, ''));
const without3d = data.candies.filter((c) => !c.model3d).map((c) => c.slug);
type W = { candy: { ready: boolean; pause(): void; at(t: number): void; loopSeconds: number; staticTime: number } };
const ready = (page: Page) => page.waitForFunction(() => (window as unknown as W).candy?.ready, null, { timeout: 30000 });

for (const slug of with3d) {
  test(`${slug}: poster first, then lazy 3D cross-fade`, async ({ page }) => {
    const three: string[] = [];
    page.on('request', (r) => { if (/mount\.|three/.test(r.url())) three.push(r.url()); });
    await page.goto(`/candy/${slug}/`);
    await expect(page.locator('.hero .poster img')).toBeVisible();
    await ready(page);
    await expect(page.locator('.hero')).toHaveClass(/is-3d/);
    await expect(page.locator('.hero .candy-canvas')).toHaveAttribute('role', 'img');
    expect(three.length).toBeGreaterThan(0);
  });

}

for (const slug of modules) {
  test(`${slug}: loop is seamless (at(0) == at(loopSeconds)), also at ?speed=2`, async ({ page }) => {
    for (const q of ['', '?speed=2']) {
      await page.goto(`/3d/${slug}/${q}`);
      await ready(page);
      const frame = async (t: number) => {
        await page.evaluate((t) => { const c = (window as unknown as W).candy; c.pause(); c.at(t); }, t);
        return page.screenshot();
      };
      const loop = await page.evaluate(() => (window as unknown as W).candy.loopSeconds);
      expect(loop).toBeCloseTo(q ? 11 : 22, 5);
      expect((await frame(loop)).equals(await frame(0))).toBe(true);
    }
  });
}

for (const slug of without3d.slice(0, 3)) {
  test(`${slug}: no 3D model -> PNG only, three.js never requested`, async ({ page }) => {
    const three: string[] = [];
    page.on('request', (r) => { if (/mount\.|three/.test(r.url())) three.push(r.url()); });
    await page.goto(`/candy/${slug}/`);
    await page.waitForLoadState('networkidle');
    expect(three).toEqual([]);
    await expect(page.locator('.hero canvas')).toHaveCount(0);
  });
}

test('?no3d keeps the poster and loads no three.js', async ({ page }) => {
  const three: string[] = [];
  page.on('request', (r) => { if (/mount\./.test(r.url())) three.push(r.url()); });
  await page.goto(`/candy/${with3d[0]}/?no3d`);
  await page.waitForLoadState('networkidle');
  expect(three).toEqual([]);
  await expect(page.locator('.hero canvas')).toHaveCount(0);
});

test('reduced motion: 3D holds a single still at staticTime', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/candy/${with3d[0]}/`);
  await ready(page);
  const a = await page.locator('.hero').screenshot();
  await page.waitForTimeout(600);
  const b = await page.locator('.hero').screenshot();
  expect(a.equals(b)).toBe(true);
});

test('3D is torn down when navigating away (no leaked WebGL contexts)', async ({ page }) => {
  await page.goto(`/candy/${with3d[0]}/`);
  await ready(page);
  await page.locator('[data-nav="next"]').click();
  await page.waitForURL(/candy\//);
  await page.locator('[data-nav="prev"]').evaluate((a: HTMLAnchorElement) => a.click());
  await ready(page);
  expect(await page.locator('canvas').count()).toBe(1);
});
