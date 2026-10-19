#!/usr/bin/env node
// node scripts/side-by-side.mjs out.png bg a.png b.png [...]  -> images (alpha) composited side by side on bg
import sharp from 'sharp';
const [, , out, bg, ...files] = process.argv;
const H = 600;
const tiles = await Promise.all(files.map((f) => sharp(f).resize(H, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()));
await sharp({ create: { width: H * files.length, height: H, channels: 4, background: bg } })
  .composite(tiles.map((input, i) => ({ input, left: i * H, top: 0 }))).flatten({ background: bg }).png().toFile(out);
console.log('wrote', out);
