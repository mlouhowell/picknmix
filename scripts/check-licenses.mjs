#!/usr/bin/env node
// Licence guard (PLAN.md §6). Lists every image the site references with license "reference-only".
// PUBLIC_RELEASE=true -> exit 1 if any are referenced. Otherwise just reports them.
import { readFile } from 'node:fs/promises';

const read = async (p) => JSON.parse(await readFile(p, 'utf8'));
const { candies } = await read('content/candies.json');
const landing = await read('content/landing-layout.json');
const manifest = await read('assets/manifest.json');
const fromManifest = Object.fromEntries(manifest.files.map((f) => [f.path, f.license]));

const used = [];
for (const c of candies) {
  used.push({ where: `${c.slug} hero`, src: c.hero.src, license: c.hero.license });
  for (const v of c.variants) if (v.src) used.push({ where: `${c.slug} variant "${v.name}"`, src: v.src, license: v.license });
}
for (const s of [landing.sharpHero, ...landing.blurredCandies]) if (s.src)
  used.push({ where: `landing ${s.figmaNode}`, src: s.src, license: fromManifest[s.src] });

const unknown = used.filter((u) => !u.license);
const refOnly = used.filter((u) => u.license === 'reference-only');
if (unknown.length) {
  console.error('check-licenses: images without a licence:\n' + unknown.map((u) => `  ${u.where}: ${u.src}`).join('\n'));
  process.exit(1);
}
const list = refOnly.map((u) => `  ${u.where}: ${u.src}`).join('\n');
if (process.env.PUBLIC_RELEASE === 'true' && refOnly.length) {
  console.error(`check-licenses: PUBLIC_RELEASE build references ${refOnly.length} reference-only image(s):\n${list}`);
  process.exit(1);
}
console.log(`check-licenses: ok (${used.length} images; ${refOnly.length} reference-only, allowed in preview builds)`);
