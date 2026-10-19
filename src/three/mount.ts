// mountCandy(el, slug, opts): builds one candy into `el` (a positioned box) and returns the candy API.
// Loaded only through dynamic import() (see scripts/hero-3d.ts), so three.js never ships in the initial bundle.
import { createStage, startCandy, type CandyAPI, type CandyModule } from './candy-kit';

const modules = import.meta.glob<CandyModule>('./candies/*.ts');

export const has3d = (slug: string) => `./candies/${slug}.ts` in modules;

export async function loadCandyModule(slug: string): Promise<CandyModule> {
  const load = modules[`./candies/${slug}.ts`];
  if (!load) throw new Error(`No 3D module for "${slug}"`);
  return load();
}

export type MountOptions = { seed?: number; speed?: number; maxPixelRatio?: number };

export async function mountCandy(el: HTMLElement, slug: string, opts: MountOptions = {}): Promise<CandyAPI> {
  const mod = await loadCandyModule(slug);
  const box = document.createElement('div');
  box.className = 'candy-canvas';
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', mod.ARIA_LABEL);
  el.appendChild(box);
  try {
    const stage = createStage(box, mod.SCENE, { maxPixelRatio: opts.maxPixelRatio ?? 2 });
    const t0 = performance.now();
    const mesh = mod.createCandy(stage);
    const buildMs = performance.now() - t0; // budget: <= 300 ms (3D_CANDY_GUIDELINES §9)
    const api = startCandy(stage, mesh, mod.FLOAT, mod.SCENE, {
      seed: opts.seed ?? mod.FLOAT.seed,
      speed: opts.speed ?? mod.FLOAT.speed,
    });
    return Object.assign(api, { buildMs, realSizeMm: mod.REAL_SIZE_MM });
  } catch (e) {
    box.remove(); // WebGL unavailable: caller keeps the PNG poster
    throw e;
  }
}
