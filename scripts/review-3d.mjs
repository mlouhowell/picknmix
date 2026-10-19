#!/usr/bin/env node
// 3D candy review package (3D_CANDY_GUIDELINES §4, §6, §9, §11). Needs `npm run preview` running.
//   node scripts/review-3d.mjs <slug> --pose=x,y,z --patches="u,v;u,v;u,v" [--base=URL]
// Writes review/<slug>/: render-pose.png, compare.png (render vs hero on #ecebe7 and white), silhouette.png
// (+ IoU), swatches.png (+ chroma ratios), set.png (with polkagris + djungelvral, same rig), metrics.json.
// patches: sample points in the hero's alpha bbox (0..1), mapped to the same spots in the render.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const slug = args.find((a) => !a.startsWith('--'));
const BASE = opt('base', 'http://localhost:4321'), SIZE = 800, GREY = '#ecebe7';
const pose = opt('pose', '0,0,0').split(',').map(Number);
const patches = opt('patches', '0.3,0.3;0.7,0.3;0.5,0.7').split(';').map((p) => p.split(',').map(Number));
const OUT = `review/${slug}`; mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
const open = async (s, q = '') => {
  await page.goto(`${BASE}/3d/${s}/${q}`);
  await page.waitForFunction(() => window.candy?.ready, null, { timeout: 60000 });
  await page.evaluate(() => window.candy.pause());
};
const alphaShot = () => page.screenshot({ omitBackground: true });

// ---- render at the hero pose + metrics
await open(slug);
await page.evaluate(([x, y, z]) => window.candy.pose(x, y, z), pose);
const render = await alphaShot();
writeFileSync(`${OUT}/render-pose.png`, render);
const info = await page.evaluate(() => {
  const c = window.candy, g = c.mesh.geometry, r = c.renderer;
  return { buildMs: Math.round(c.buildMs), triangles: (g.index ? g.index.count : g.attributes.position.count) / 3,
    drawCalls: r.info.render.calls, textures: r.info.memory.textures, loopSeconds: c.loopSeconds, staticTime: c.staticTime, realSizeMm: c.realSizeMm };
});
// seamless loop at speed 1 and 2
const loopOk = {};
for (const q of ['', '?speed=2']) {
  await open(slug, q);
  const L = await page.evaluate(() => window.candy.loopSeconds);
  await page.evaluate(() => window.candy.at(0)); const a = await page.screenshot();
  await page.evaluate((L) => window.candy.at(L), L); const b = await page.screenshot();
  loopOk[q || 'speed1'] = a.equals(b);
}
// fps over 3 s of real playback (headless Chrome: indicative only)
await open(slug);
const fps = await page.evaluate(async () => {
  window.candy.play(); let n = 0; const t0 = performance.now();
  await new Promise((res) => { const f = () => { n++; performance.now() - t0 < 3000 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
  return Math.round((n * 1000) / (performance.now() - t0));
});
await page.evaluate(() => window.candy.at(window.candy.staticTime));
await page.evaluate(() => window.candy.pause());
const still = await alphaShot();

// ---- set.png: same rig, staticTime stills next to the approved set
const set = [];
for (const s of ['polkagris', 'djungelvral']) { await open(s); await page.evaluate(() => window.candy.at(window.candy.staticTime)); set.push(await alphaShot()); }
set.push(still);
await sharp({ create: { width: SIZE * set.length, height: SIZE, channels: 4, background: GREY } })
  .composite(set.map((input, i) => ({ input, left: i * SIZE, top: 0 }))).flatten({ background: GREY }).png().toFile(`${OUT}/set.png`);
await browser.close();

// ---- masks, IoU
const hero = `assets/candies/${slug}/hero.png`;
async function maskBox(input) {
  const { data, info } = await sharp(input).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[y * info.width + x] >= 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}
const N = 400;
const crop = async (input, box, fit = 'fill') => sharp(input).ensureAlpha().extract(box).resize(N, N, { fit, background: { r: 0, g: 0, b: 0, alpha: 0 } });
const hb = await maskBox(hero), rb = await maskBox(render);
const hm = await (await crop(hero, hb)).extractChannel(3).raw().toBuffer();
const rm = await (await crop(render, rb)).extractChannel(3).raw().toBuffer();
let inter = 0, uni = 0; const vis = Buffer.alloc(N * N * 3, 255);
for (let i = 0; i < N * N; i++) {
  const a = hm[i] >= 128, b = rm[i] >= 128; if (a && b) inter++; if (a || b) uni++;
  if (a && b) vis.set([150, 150, 160], i * 3); else if (a) vis.set([230, 60, 60], i * 3); else if (b) vis.set([50, 110, 230], i * 3);
}
const iou = inter / uni;
const heroCrop = await (await crop(hero, hb, 'contain')).png().toBuffer(), renderCrop = await (await crop(render, rb, 'contain')).png().toBuffer();
await sharp({ create: { width: N * 3, height: N, channels: 3, background: '#ffffff' } })
  .composite([{ input: heroCrop, left: 0, top: 0 }, { input: renderCrop, left: N, top: 0 },
    { input: await sharp(vis, { raw: { width: N, height: N, channels: 3 } }).png().toBuffer(), left: 2 * N, top: 0 }])
  .png().toFile(`${OUT}/silhouette.png`);

// ---- compare.png: render | hero on #ecebe7 (top) and white (bottom)
const pair = async (bg) => sharp({ create: { width: N * 2 + 60, height: N + 40, channels: 4, background: bg } })
  .composite([{ input: renderCrop, left: 20, top: 20 }, { input: heroCrop, left: N + 40, top: 20 }]).flatten({ background: bg }).png().toBuffer();
await sharp({ create: { width: N * 2 + 60, height: (N + 40) * 2, channels: 3, background: '#fff' } })
  .composite([{ input: await pair(GREY), left: 0, top: 0 }, { input: await pair('#ffffff'), left: 0, top: N + 40 }]).png().toFile(`${OUT}/compare.png`);

// ---- swatches: mean colour of a 15px patch at the same bbox-relative spot, CIELab chroma ratio
const lab = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [f(r), f(g), f(b)];
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const L = 116 * t(Y) - 16, a = 500 * (t(X) - t(Y)), bb = 200 * (t(Y) - t(Z));
  return { L, C: Math.hypot(a, bb) };
};
const patchMean = async (buf, u, v) => {
  const { data } = await sharp(buf).ensureAlpha().extract({ left: Math.round(u * N) - 7, top: Math.round(v * N) - 7, width: 15, height: 15 }).raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  return n ? [r / n, g / n, b / n].map(Math.round) : [0, 0, 0];
};
const heroFill = await (await crop(hero, hb)).png().toBuffer(), renderFill = await (await crop(render, rb)).png().toBuffer();
const swatches = [];
for (const [u, v] of patches) {
  const hc = await patchMean(heroFill, u, v), rc = await patchMean(renderFill, u, v);
  swatches.push({ at: [u, v], hero: hc, render: rc, chromaRatio: +(lab(rc).C / Math.max(lab(hc).C, 1e-6)).toFixed(2) });
}
const S = 120;
await sharp({ create: { width: S * swatches.length, height: S * 2, channels: 3, background: '#fff' } })
  .composite(swatches.flatMap((s, i) => [
    { input: { create: { width: S, height: S, channels: 3, background: { r: s.hero[0], g: s.hero[1], b: s.hero[2] } } }, left: i * S, top: 0 },
    { input: { create: { width: S, height: S, channels: 3, background: { r: s.render[0], g: s.render[1], b: s.render[2] } } }, left: i * S, top: S },
  ])).png().toFile(`${OUT}/swatches.png`);

const metrics = { slug, pose, iou: +iou.toFixed(3), iouPass: iou >= 0.9, swatches, chromaPass: swatches.every((s) => s.chromaRatio >= 0.85), loopOk, fps, ...info };
writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 2) + '\n');
console.log(JSON.stringify(metrics, null, 1));
