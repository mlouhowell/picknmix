#!/usr/bin/env node
// Content pipeline checks (Phase 1 acceptance):
//  1. `npm run content` regenerates a byte-identical content/candies.json from the committed CSV.
//  2. The zod schema rejects broken entries (and accepts the real file).
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { CandiesFileSchema, SiteSchema, LandingLayoutSchema } from '../src/lib/schema.ts';

const read = (p) => readFile(p, 'utf8');
const before = await read('content/candies.json');
execFileSync('node', ['scripts/build-content.mjs'], { stdio: 'pipe' });
assert.equal(await read('content/candies.json'), before, 'candies.json changed after regeneration');
console.log('ok  content regenerates identically');

const good = JSON.parse(before);
assert.ok(CandiesFileSchema.safeParse(good).success, 'real candies.json must validate');
assert.ok(SiteSchema.safeParse(JSON.parse(await read('content/site.json'))).success, 'site.json must validate');
assert.ok(LandingLayoutSchema.safeParse(JSON.parse(await read('content/landing-layout.json'))).success, 'landing-layout.json must validate');
console.log('ok  real content validates');

const broken = [
  ['empty about', (d) => { d.candies[0].about = ''; }],
  ['bad figma id', (d) => { d.candies[1].figma.page = '8-121'; }],
  ['unknown licence', (d) => { d.candies[2].hero.license = 'stolen'; }],
  ['duplicate slug', (d) => { d.candies[3].slug = d.candies[0].slug; }],
  ['missing hero', (d) => { delete d.candies[4].hero; }],
];
for (const [name, mutate] of broken) {
  const d = structuredClone(good); mutate(d);
  assert.equal(CandiesFileSchema.safeParse(d).success, false, `schema should reject: ${name}`);
  console.log(`ok  schema rejects ${name}`);
}
