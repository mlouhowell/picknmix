#!/usr/bin/env node
// Pixel diff of a 1400x1038 screenshot vs a Figma reference render (any size, same aspect).
// node scripts/visual-diff.mjs <shot.png> <reference.png> <out-diff.png> [regions]
// regions: "x,y,w,h;x,y,w,h" in 1400-canvas px (default: whole canvas). A pixel differs when any
// channel is off by > 32 (antialiasing / font hinting tolerance). Prints % differing per region.
import sharp from 'sharp';
const [, , shot, ref, out, regionArg] = process.argv;
const R = await sharp(ref).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = R.info.width, H = R.info.height, s = W / 1400;
const S = await sharp(shot).resize(W, H, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
const regions = (regionArg ?? `0,0,1400,1038`).split(';').map((r) => r.split(',').map(Number));
const diff = Buffer.from(R.data);
let worst = 0;
for (const [x, y, w, h] of regions) {
  let n = 0, bad = 0;
  for (let j = Math.round(y * s); j < Math.round((y + h) * s) && j < H; j++)
    for (let i = Math.round(x * s); i < Math.round((x + w) * s) && i < W; i++) {
      const k = (j * W + i) * 3; n++;
      const d = Math.max(Math.abs(R.data[k] - S[k]), Math.abs(R.data[k + 1] - S[k + 1]), Math.abs(R.data[k + 2] - S[k + 2]));
      if (d > 32) { bad++; diff[k] = 255; diff[k + 1] = 0; diff[k + 2] = 80; }
    }
  const pct = (100 * bad) / n; worst = Math.max(worst, pct);
  console.log(`region ${x},${y},${w},${h}: ${pct.toFixed(2)}% differ`);
}
await sharp(diff, { raw: { width: W, height: H, channels: 3 } }).png().toFile(out);
console.log(`worst ${worst.toFixed(2)}%  -> ${out}`);
process.exitCode = 0;
