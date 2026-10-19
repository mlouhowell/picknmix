#!/usr/bin/env node
// Landing 3:679 cut-outs, rebuilt from the Figma frame's own image fills (read-only export via the Figma MCP,
// saved in assets/landing/figma/). Each slot's inner box is re-rendered in Chrome exactly as Figma crops it
// (image offsets, masking white rects), WITHOUT the slot's rotation/blur/opacity (the site applies those from
// content/landing-layout.json so they can animate). The white screenshot background is keyed out by a flood
// fill from the edges, so white highlights inside a candy stay opaque.
//   node scripts/extract-landing-figma.mjs  -> assets/landing/<figma-node>.png
// Crop numbers below are copied from get_design_context(3:679); re-export if the Figma frame changes.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const SPRITE = 'assets/landing/figma/4ee35.png'; // "Screenshot 2026-10-18 at 5.10.44 PM" (shared contact sheet)
const SCALE = 3; // render at 3x canvas px (hero is 312 canvas px wide)

// w,h: inner box (canvas px). img: [box l,t,w,h] + image [l%,t%,w%,h%] inside it. masks: white rects [l,t,w,h,rotDeg] (outer box, inner w,h)
const SLOTS = [
  { node: '3:680', w: 102.634, h: 128.032, src: SPRITE, box: [0, -3.76, 105.325, 131.794], img: [-863.2, -258.66, 1557.77, 588.98],
    masks: [[60.51, -33.65, 53.645, 73.31, -105, 65.734, 37.924]] },
  { node: '3:683', w: 72.194, h: 90.06, src: SPRITE, box: [0, -2.65, 74.087, 92.706], img: [-842.34, -65.9, 1557.77, 588.98] },
  { node: '3:685', w: 140.066, h: 106.8, src: SPRITE, box: [-0.38, -44.54, 144.126, 180.346], img: [-1018.48, -60.07, 1557.77, 588.98] },
  { node: '3:687', w: 133, h: 124.6, src: SPRITE, box: [-0.75, -51.97, 168.147, 210.404], img: [-1164.19, -59.41, 1557.77, 588.98] },
  { node: '3:691', w: 128.7, h: 54.9, src: 'assets/landing/figma/38db1.png', box: [0, 0, 128.7, 54.9], img: [-155.72, -221.31, 446.07, 1033.84] },
  { node: '3:692', w: 121.25, h: 151.255, src: SPRITE, box: [0, -4.44, 124.43, 155.7], img: [-1240.81, -78.93, 1557.77, 588.98],
    masks: [[22.03, 134.79, 43.489, 47.666, 15, 34.26, 40.167]] },
  { node: '3:695', w: 190.964, h: 114.815, src: 'assets/landing/figma/044a7.png', cover: true },
  { node: '3:696', w: 127.171, h: 235.375, src: SPRITE, box: [0, 47.71, 114.507, 187.664], img: [-1019.44, -82.2, 2040.28, 588.98],
    masks: [[71.95, 29.17, 68.729, 126.005, -105, 120, 39]] },
  { node: '3:700', w: 312, h: 315.2, src: 'assets/landing/figma/c16c5.png', cover: true },
];

const dataUrl = async (p) => `data:image/png;base64,${(await readFile(p)).toString('base64')}`;
const px = (v) => `${v}px`;
function html(s, url) {
  const inner = s.cover
    ? `<img src="${url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
    : `<div style="position:absolute;left:${px(s.box[0])};top:${px(s.box[1])};width:${px(s.box[2])};height:${px(s.box[3])};overflow:hidden">
         <img src="${url}" style="position:absolute;max-width:none;left:${s.img[0]}%;top:${s.img[1]}%;width:${s.img[2]}%;height:${s.img[3]}%"></div>`;
  const masks = (s.masks ?? []).map(([l, t, ow, oh, r, iw, ih]) =>
    `<div style="position:absolute;left:${px(l)};top:${px(t)};width:${px(ow)};height:${px(oh)};display:flex;align-items:center;justify-content:center">
       <div style="flex:none;width:${px(iw)};height:${px(ih)};background:#fff;rotate:${r}deg"></div></div>`).join('');
  return `<body style="margin:0;background:#fff"><div id="b" style="position:relative;overflow:hidden;background:#fff;width:${px(s.w)};height:${px(s.h)}">${inner}${masks}</div></body>`;
}

// Flood-fill near-white from the border; alpha ramps with distance from white so edges stay soft.
async function keyWhite(buf, out) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info, T = 42;
  const dist = (i) => 255 - Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const seen = new Uint8Array(W * H), stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || dist(i) >= T) continue;
    seen[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W);
  }
  for (let i = 0; i < W * H; i++) if (seen[i]) data[i * 4 + 3] = Math.round((dist(i) / T) * 255);
  await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toFile(out);
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: SCALE, viewport: { width: 400, height: 400 } });
const urls = {};
for (const s of SLOTS) {
  urls[s.src] ??= await dataUrl(s.src);
  await page.setContent(html(s, urls[s.src]));
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth));
  const shot = await page.locator('#b').screenshot();
  const out = `assets/landing/${s.node.replace(':', '-')}.png`;
  await keyWhite(shot, out);
  console.log('wrote', out);
}
await browser.close();
