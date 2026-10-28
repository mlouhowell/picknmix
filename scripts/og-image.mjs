#!/usr/bin/env node
// Share image (Open Graph / Twitter card): a 1200x630 shot of the candy grid with the header, saved to public/og.png.
// Run with the dev server up: `npx astro dev` then `node scripts/og-image.mjs [url]`.
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://localhost:4321/';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await p.emulateMedia({ reducedMotion: 'reduce' });
await p.goto(url, { waitUntil: 'networkidle' });
await p.addStyleTag({ content: '.site-footer{display:none!important}' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(500);
const png = await p.screenshot();
await b.close();
const sharp = (await import('sharp')).default;
await sharp(png).resize(1200, 630).png({ compressionLevel: 9 }).toFile('public/og.png');
console.log('og-image: public/og.png');
