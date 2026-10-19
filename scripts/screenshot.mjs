#!/usr/bin/env node
// Screenshot a page for comparison with reference/. Needs a running server (npm run preview).
// node scripts/screenshot.mjs <url> <out.png> [width=1400] [height=1038] [full]
import { chromium } from '@playwright/test';
const [, , url, out, w = 1400, h = 1038, full = ''] = process.argv;
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto(url, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: out, fullPage: !!full });
await b.close();
console.log('wrote', out);
