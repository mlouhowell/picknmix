#!/usr/bin/env node
// Builds content/candies.json from the Google Sheet (tab "Candy") + content/candies.extra.json.
// Sheet = source of truth for copy (name, year, maker, about, sheet image credit).
// extra.json = slug, Figma node IDs, candy type (until the sheet has a "Candy type" column), assets, credits.
//
// Usage:
//   node scripts/build-content.mjs                 # uses content/source/candy-sheet.csv (committed snapshot)
//   node scripts/build-content.mjs --fetch         # downloads the sheet as CSV first (sheet must be
//                                                  # "Anyone with the link can view", or set SHEET_CSV_URL)
// Manual export alternative: Sheets > File > Download > CSV (tab "Candy") -> save as content/source/candy-sheet.csv
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SHEET_ID = '1v2O18LwUW7YszRJD7LrXheRAQqyuLvKE3J-PQu7dUKY';
const CSV_URL = process.env.SHEET_CSV_URL ??
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Candy`;
const CSV_PATH = 'content/source/candy-sheet.csv';
const ASSET_ROOT = process.env.ASSET_ROOT ?? 'assets'; // in the app repo: public/assets

/** RFC 4180 CSV parser (quotes, escaped quotes, newlines in cells). */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}
const clean = s => (s ?? '').replace(/\s+/g, ' ').trim();
const imageUrl = s => (s.match(/IMAGE\("([^"]+)"/i)?.[1] ?? s).trim() || null;

if (process.argv.includes('--fetch')) {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status}). Share the sheet as view-only link or export CSV manually.`);
  await writeFile(CSV_PATH, await res.text());
  console.log('fetched', CSV_URL);
}

const [header, ...rows] = parseCSV(await readFile(CSV_PATH, 'utf8'));
const col = name => header.findIndex(h => clean(h).toLowerCase() === name.toLowerCase());
const C = { name: col('Candy'), image: col('Image'), year: col('Year it began'), maker: col('Maker'),
  about: col('About'), credit: col('Image credit'), type: col('Candy type') };
for (const k of ['name', 'year', 'maker', 'about']) if (C[k] < 0) throw new Error(`Sheet column missing: ${k}`);

const extra = JSON.parse(await readFile('content/candies.extra.json', 'utf8'));
const bySheetName = Object.fromEntries(Object.entries(extra).filter(([k]) => !k.startsWith('_')).map(([slug, e]) => [e.sheetName, { slug, ...e }]));

const warnings = [];
const candies = rows.map((r, i) => {
  const name = clean(r[C.name]);
  const e = bySheetName[name];
  if (!e) throw new Error(`Row ${i + 2}: "${name}" has no entry in candies.extra.json (add one with sheetName "${name}")`);
  const check = p => { if (p && !existsSync(`${ASSET_ROOT}/${p}`)) warnings.push(`${e.slug}: missing asset ${p}`); return p; };
  check(e.hero?.src); e.model3d && check(e.model3d.src);
  return {
    slug: e.slug,
    order: i + 1,
    name,
    year: clean(r[C.year]),
    type: C.type >= 0 && clean(r[C.type]) ? clean(r[C.type]) : e.type,
    maker: clean(r[C.maker]),
    about: clean(r[C.about]),
    hero: e.hero,
    model3d: e.model3d ?? null,
    variants: e.variants.map(v => ({ ...v, src: check(v.src) })),
    credits: {
      sheetImage: { url: C.image >= 0 ? imageUrl(r[C.image]) : null, credit: C.credit >= 0 ? clean(r[C.credit]) : null },
      hero: e.hero?.credit ?? null,
      variants: e.variants.filter(v => v.src).map(v => ({ name: v.name, credit: v.credit, license: v.license }))
    },
    figma: { page: e.figmaNode, hero: e.heroNode }
  };
});

await writeFile('content/candies.json', JSON.stringify({
  _generated: `by scripts/build-content.mjs from Google Sheet ${SHEET_ID} tab "Candy" + candies.extra.json. Do not edit by hand.`,
  candies
}, null, 2) + '\n');
console.log(`wrote content/candies.json (${candies.length} candies)`);
warnings.forEach(w => console.warn('WARN', w));
