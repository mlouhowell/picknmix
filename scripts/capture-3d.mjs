#!/usr/bin/env node
// Node port of assets/3d/candy-kit/capture.py for this repo (installed Chrome, no Python deps).
// Renders the standalone preview page /3d/<slug>/ served by `npm run preview` (default http://localhost:4321).
//   node scripts/capture-3d.mjs <slug> still            -> public/3d/<slug>/preview.png (alpha, 800px, at staticTime)
//                                                         + hero-3d-512.webp / hero-3d-1024.webp
//   node scripts/capture-3d.mjs <slug> video            -> preview.mp4 (grey), preview.webm (VP9 alpha),
//                                                         preview-transparent.webp (needs ffmpeg)
//   node scripts/capture-3d.mjs <slug> pose x,y,z ...   -> review/<slug>/pose.png (fixed orientations on #ecebe7)
// Options: --base=URL  --out=DIR  --size=800
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const [slug, mode = 'still', ...rest] = args.filter((a) => !a.startsWith('--'));
const BASE = opt('base', 'http://localhost:4321'), SIZE = Number(opt('size', 800)), FPS = 30, GREY = '#ecebe7';
const OUT = opt('out', `public/3d/${slug}`);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
const logs = [];
page.on('console', (m) => logs.push(m.text()));
page.on('pageerror', (e) => logs.push('ERR ' + e));
await page.goto(`${BASE}/3d/${slug}/`);
await page.waitForFunction(() => window.candy?.ready, null, { timeout: 60000 });
await page.evaluate(() => window.candy.pause());
const shot = (path) => page.screenshot({ path, omitBackground: true });

if (mode === 'still') {
  await page.evaluate(() => window.candy.at(window.candy.staticTime));
  const png = `${OUT}/preview.png`;
  await shot(png);
  for (const w of [512, 1024].filter((w) => w <= SIZE * 1.3))
    await sharp(png).resize(w).webp({ quality: 86, alphaQuality: 95 }).toFile(`${OUT}/hero-3d-${w}.webp`);
  console.log('wrote', png);
} else if (mode === 'pose') {
  mkdirSync(`review/${slug}`, { recursive: true });
  const tiles = [];
  for (const p of rest) {
    const [x, y, z] = p.split(',').map(Number);
    await page.evaluate(([x, y, z]) => window.candy.pose(x, y, z), [x, y, z]);
    tiles.push(await page.screenshot({ omitBackground: true }));
  }
  const out = `review/${slug}/pose.png`;
  await sharp({ create: { width: SIZE * tiles.length, height: SIZE, channels: 4, background: GREY } })
    .composite(tiles.map((input, i) => ({ input, left: i * SIZE, top: 0 }))).png().toFile(out);
  console.log('wrote', out);
} else if (mode === 'video') {
  const fr = `/tmp/frames_${slug}`; rmSync(fr, { recursive: true, force: true }); mkdirSync(fr);
  const secs = await page.evaluate(() => window.candy.loopSeconds);
  const n = Math.round(FPS * secs);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.candy.at(t), i / FPS);
    await shot(`${fr}/f${String(i).padStart(4, '0')}.png`);
  }
  const FFMPEG = (await import('ffmpeg-static').catch(() => null))?.default ?? 'ffmpeg';
  const ff = (...a) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' });
  const src = ['-framerate', String(FPS), '-i', `${fr}/f%04d.png`];
  ff('-f', 'lavfi', '-i', `color=c=0xecebe7:s=${SIZE}x${SIZE}:r=${FPS}`, ...src, '-filter_complex',
    '[0][1]overlay=format=auto:shortest=1,scale=640:640', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', `${OUT}/preview.mp4`);
  ff(...src, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30', '-row-mt', '1', '-auto-alt-ref', '0', `${OUT}/preview.webm`);
  ff(...src, '-vf', 'fps=15,scale=400:-1:flags=lanczos', '-c:v', 'libwebp_anim', '-lossless', '0', '-quality', '80', '-loop', '0', `${OUT}/preview-transparent.webp`);
  console.log('wrote', `${OUT}/preview.{mp4,webm}`, `${OUT}/preview-transparent.webp`);
}
if (logs.length) console.log(logs.join('\n'));
await browser.close();
