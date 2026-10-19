import { test, expect } from '@playwright/test';

test('/dev/tokens renders every token group', async ({ page }) => {
  await page.goto('/dev/tokens/');
  for (const h of ['Colour', 'Type', 'Spacing', 'Sizes']) await expect(page.getByRole('heading', { name: h })).toBeVisible();
  // the brand swatch resolves through the live CSS variable
  const bg = await page.locator('.swatch').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(49, 133, 147)');
  await expect(page.getByText('--color-tile-stroke', { exact: true })).toBeVisible();
});
