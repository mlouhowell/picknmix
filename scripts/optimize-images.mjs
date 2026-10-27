#!/usr/bin/env node
// assets/candies/**/*.png + assets/landing/*.png (not landing/figma/, the raw Figma exports) -> public/img/<same path>-<w>.{webp,png} at 256/512/1024 (never upscaled)
// + assets/timeline/<era>/*.png (timeline collages, content/timeline.json)
// + public/candies/*.png (the landing grid's 13 cut-outs, content/grid/candies.json) -> public/img/candies/<name>-<w>.{webp,png}, logical src "candies/<name>.png".
//   Film grain is baked into those renders: where assets/grid-grain/<name>-<w>.<fmt> exists (512 + 1024, grain applied at that size;
//   see assets/grid-grain/HANDOFF.md) it is copied as-is instead of resized, so the grain isn't softened.
// + public/img/index.json (dimensions + widths per logical src) consumed by src/lib/img.ts.
// Incremental: skips outputs newer than their source. PUBLIC_RELEASE=true skips reference-only files.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, stat, readdir, copyFile } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';

const SRC = 'assets', OUT = 'public/img', WIDTHS = [256, 512, 1024];
const PUBLIC = process.env.PUBLIC_RELEASE === 'true';
const manifest = JSON.parse(await readFile(`${SRC}/manifest.json`, 'utf8'));
const licenseOf = Object.fromEntries(manifest.files.map((f) => [f.path, f.license ?? null]));

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.png')) out.push(p);
  }
  return out;
}
const mtime = async (p) => (await stat(p).catch(() => null))?.mtimeMs ?? 0;

const index = {};
let made = 0, skipped = 0;
const GRID = 'public/candies', GRAIN = 'assets/grid-grain';
const gridFiles = (await readdir(GRID).catch(() => [])).filter((n) => n.endsWith('.png')).map((n) => join(GRID, n));
for (const file of [...(await walk(`${SRC}/candies`)), ...(await walk(`${SRC}/landing`)).filter((f) => !f.includes('/figma/')), ...(await walk(`${SRC}/timeline`)), ...gridFiles]) {
  const logical = relative(file.startsWith(GRID) ? 'public' : SRC, file);
  const license = licenseOf[logical] ?? null;
  if (PUBLIC && license === 'reference-only') { skipped++; continue; }
  const meta = await sharp(file).metadata();
  const widths = [...new Set(WIDTHS.map((w) => Math.min(w, meta.width)))];
  const base = join(OUT, logical.replace(/\.png$/, ''));
  await mkdir(dirname(base), { recursive: true });
  const srcTime = await mtime(file);
  for (const w of widths) {
    for (const fmt of ['webp', 'png']) {
      const out = `${base}-${w}.${fmt}`;
      const baked = file.startsWith(GRID) ? join(GRAIN, `${logical.slice('candies/'.length, -4)}-${w}.${fmt}`) : null;
      const bakedTime = baked ? await mtime(baked) : 0;
      if ((await mtime(out)) > Math.max(srcTime, bakedTime)) continue;
      if (bakedTime) { await copyFile(baked, out); made++; continue; }
      const img = sharp(file).resize({ width: w, withoutEnlargement: true });
      await (fmt === 'webp' ? img.webp({ quality: 82, alphaQuality: 90 }) : img.png({ compressionLevel: 9, palette: false })).toFile(out);
      made++;
    }
  }
  index[logical] = { w: meta.width, h: meta.height, widths, license };
}
await writeFile(`${OUT}/index.json`, JSON.stringify(index, null, 1) + '\n');
console.log(`images: ${Object.keys(index).length} sources, ${made} files written${skipped ? `, ${skipped} reference-only skipped` : ''}`);
