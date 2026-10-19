#!/usr/bin/env node
// Lint: no raw design values outside src/styles/tokens.css (CLAUDE.md rule 2).
// Flags hex colours, px literals and literal font-family names in components, layouts, pages and styles.
// Comments are ignored, so Figma notes like "117px tile (12:58)" are fine. 3D configs (src/three) are exempt.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOTS = ['src/components', 'src/layouts', 'src/pages', 'src/styles'];
const EXEMPT = new Set(['src/styles/tokens.css']);
const RULES = [
  [/#[0-9a-fA-F]{3,8}\b(?![\w-])/g, 'hex colour'],
  [/(?<![\w-])-?\d*\.?\d+px\b/g, 'px literal'],
  [/font-family\s*:(?!\s*(?:var\(|inherit|\$\{))[^;`]+/g, 'font name'],
  [/rgba?\(/g, 'rgb() colour'],
];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"])\/\/.*$/gm, '$1');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(astro|css|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}
const problems = [];
for (const root of ROOTS) for (const file of await walk(root)) {
  if (EXEMPT.has(file)) continue;
  const lines = strip(await readFile(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    for (const [re, what] of RULES) for (const m of line.matchAll(re)) problems.push(`${file}:${i + 1}  ${what}: ${m[0].trim()}`);
  });
}
if (problems.length) {
  console.error(`check-tokens: ${problems.length} raw design value(s); move them to src/styles/tokens.css:\n` + problems.join('\n'));
  process.exit(1);
}
console.log('check-tokens: ok (no raw design values outside tokens.css)');
