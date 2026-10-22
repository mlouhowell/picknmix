import { test, expect } from '@playwright/test';
import { siteCandies } from './site-candies';

const order = siteCandies;

test('next arrow visits every candy in sheet order and wraps', async ({ page }) => {
  await page.goto(`/candy/${order[0]!.slug}/`);
  for (let i = 1; i <= order.length; i++) {
    await page.locator('[data-nav="next"]').click();
    const c = order[i % order.length]!;
    await expect(page).toHaveURL(new RegExp(`/candy/${c.slug}/$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.name);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused(); // focus lands on the title
  }
});

test('browser back returns to the previous candy', async ({ page }) => {
  await page.goto(`/candy/${order[0]!.slug}/`);
  await page.locator('[data-nav="next"]').click();
  await expect(page).toHaveURL(new RegExp(order[1]!.slug));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/candy/${order[0]!.slug}/$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(order[0]!.name);
});

test('keyboard: -> next, <- previous (wraps), Esc closes to landing', async ({ page }) => {
  await page.goto(`/candy/${order[0]!.slug}/`);
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(new RegExp(order[1]!.slug));
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(new RegExp(`/candy/${order[0]!.slug}/$`));
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(new RegExp(order[order.length - 1]!.slug));
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('close button goes to the landing page', async ({ page }) => {
  await page.goto(`/candy/${order[3]!.slug}/`);
  await page.locator('[data-nav="close"]').click();
  await expect(page).toHaveURL(/\/$/);
});

test('reduced motion: view transitions do not animate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/candy/${order[0]!.slug}/`);
  const dur = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--duration-page').trim());
  expect(dur).toBe('0ms');
  const t0 = Date.now();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(order[1]!.name);
  expect(Date.now() - t0).toBeLessThan(1500);
});

test('swipe left = next, swipe right = previous', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1400, height: 1038 } });
  const page = await ctx.newPage();
  await page.goto(`/candy/${order[0]!.slug}/`);
  const swipe = (dx: number) => page.evaluate((dx) => {
    const t = (x: number) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 500 });
    document.dispatchEvent(new TouchEvent('touchstart', { touches: [t(700)], changedTouches: [t(700)] }));
    document.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(700 + dx)] }));
  }, dx);
  await swipe(-200);
  await expect(page).toHaveURL(new RegExp(`/candy/${order[1]!.slug}/$`));
  await swipe(200);
  await expect(page).toHaveURL(new RegExp(`/candy/${order[0]!.slug}/$`));
  await ctx.close();
});
