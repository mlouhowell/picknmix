// Ahlgrens bilar: pale green foam candy car (skumgodis), soft and pillowy, satin top skin, matte underside.
// Family: foam (3D_CANDY_GUIDELINES §5). Modelled from assets/candies/ahlgrens-bilar/hero.png: the hero is a
// side profile, so its alpha silhouette (baked by scripts/bake-outline.mjs) is the car's SIDE outline (x = length,
// y = height). The width (z) is estimated: a full-width body that narrows into the cabin hump, with very soft
// rounded edges, shallow side-window dimples, wheel-arch swellings and moulded lumpiness.
import * as THREE from 'three';
import { makeNoise3, type FloatConfig, type SceneConfig, type Stage } from '../candy-kit';
import { NOISE_GLSL, bumpGLSL } from '../lib/glsl';
import { sdfGeometry, type SDF } from '../lib/sdf';
import { decodeOutline, type OutlineFile } from '../lib/outline';
import outlineFile from './ahlgrens-bilar.outline.json';

export const slug = 'ahlgrens-bilar';
export const REAL_SIZE_MM = 36; // car length, longest side (estimate; confirm against a real piece)
export const ARIA_LABEL = 'A pale green Ahlgrens bilar foam candy car, slowly tumbling';

export const CANDY = {
  // Shape (world units: car height = 1, length ≈ 1.58 from the hero outline)
  bodyHalfWidth: 0.3, // half the car's width at the body (real ≈ 16 mm wide on a ≈ 23 mm tall car)
  cabinHalfWidth: 0.2, // narrower at the top of the cabin hump
  cabinFrom: -0.05, // y where the body starts narrowing into the cabin
  bevel: 0.13, // soft foam edges (≤ half the cabin hump's width, or the hump would be eroded away)
  sideDome: 0.06, // the sides bulge mid-height (pillowy poured foam, not a flat slab)
  windowDepth: 0.025, // shallow side-window dimples on the cabin
  window: { x: -0.17, y: 0.18, rx: 0.2, ry: 0.11 }, // hero px ≈ 210–420 x, 70–150 y (cabin)
  archBulge: 0, // swollen wheel arches near the bottom
  arches: [-0.5, 0.48] as number[], // front / rear wheel x (hero px ≈ 130 and 520)
  sag: 0.03, // the poured foam slumps a little wider at the base
  lumpiness: 0.02, // moulded irregularity (hero: wrinkly, uneven skin)
  seed: 5,
  resolution: 0.0145, // mesh cell size

  // Colour (sRGB): hero median #cee5b7, p25 #c2d0b7; deeper so ACES + sheen land on the photo's mint
  foamColor: '#8fcf60',
  shadeColor: '#6cae46', // slightly greener, denser foam in creases

  // Foam
  topRoughness: 0.55, // satin skin on top
  bottomRoughness: 0.88, // matte underside
  sheen: 0.15,
  poreScale: 150, // ≈ 0.25 mm pores at 36 mm
  poreBump: 0.7,
  wrinkleBump: 1.5, // low-frequency skin wrinkles seen on the hero
  warmth: 0.05,
};
type Cfg = typeof CANDY;

export const SCENE: SceneConfig = { fov: 28, framePadding: 1.12, exposure: 0.92 };

export const FLOAT: FloatConfig = {
  seed: 6, // seed search 1–8: 6 passes side-on and upright late in the loop (review/ahlgrens-bilar/CHECKLIST.md)
  speed: 1, loopSeconds: 22, spinTurns: 2, precessTurns: 1,
  drift: 0.05, driftCycles: [1, 2, 1],
  staticTime: 18.0, // reduced-motion still: side 0.97 toward the camera, upright 0.99
};

const bump = (dx: number, dy: number, rx: number, ry: number) => {
  const q = (dx / rx) ** 2 + (dy / ry) ** 2;
  return q >= 1 ? 0 : (1 - q) ** 2;
};
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

function makeCarSDF(cfg: Cfg): SDF {
  const outline = decodeOutline(outlineFile as OutlineFile);
  const noise = makeNoise3(cfg.seed);
  const W = cfg.window;
  // top / bottom of the side outline per column x (scanned once from the baked silhouette)
  const N = 400, x0 = -outline.halfW, dx = (2 * outline.halfW) / (N - 1);
  const top = new Float32Array(N), bot = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = x0 + i * dx;
    let t = -1, b = 1;
    for (let y = outline.halfH; y >= -outline.halfH; y -= 0.002) if (outline.sdf(x, y) < 0) { t = y; break; }
    for (let y = -outline.halfH; y <= outline.halfH; y += 0.002) if (outline.sdf(x, y) < 0) { b = y; break; }
    top[i] = t; bot[i] = b;
  }
  const col = (arr: Float32Array, x: number) => {
    const u = Math.min(Math.max((x - x0) / dx, 0), N - 1.001), i = Math.floor(u), f = u - i;
    return arr[i]! * (1 - f) + arr[i + 1]! * f;
  };
  const halfWidth = (x: number, y: number, yt: number, yb: number) => {
    const f = Math.min(Math.max((y - yb) / Math.max(yt - yb, 1e-3), 0), 1);
    let h = cfg.bodyHalfWidth + cfg.sideDome * 4 * f * (1 - f); // sides bulge mid-height
    h += (cfg.cabinHalfWidth - cfg.bodyHalfWidth) * smooth(cfg.cabinFrom, 0.5, y);
    h += cfg.sag * smooth(-0.2, -0.5, y);
    h -= cfg.windowDepth * bump(x - W.x, y - W.y, W.rx, W.ry);
    for (const ax of cfg.arches) h += cfg.archBulge * bump(x - ax, y + 0.32, 0.2, 0.2);
    return h;
  };
  const zMax = cfg.bodyHalfWidth + cfg.sideDome + cfg.sag + cfg.archBulge + 0.03;
  const r = cfg.bevel;
  return (x, y, z) => {
    const d2 = outline.sdf(x, y);
    if (d2 > r + 0.03) return d2; // far from the surface only the sign matters (build-time budget)
    if (Math.abs(z) > zMax) return Math.max(d2, Math.abs(z) - zMax + 0.01);
    // rounded extrusion of the side outline (exact for a constant half-width; hz varies slowly so it stays clean)
    const hz = halfWidth(x, y, col(top, x), col(bot, x));
    const wx = d2 + r, wy = Math.abs(z) - (hz - r);
    let d = Math.min(Math.max(wx, wy), 0) + Math.hypot(Math.max(wx, 0), Math.max(wy, 0)) - r;
    d += cfg.lumpiness * (noise(x * 5 + 3, y * 5, z * 5) * 0.7 + noise(x * 12, y * 12 + 5, z * 12) * 0.3);
    return d;
  };
}

function createFoamMaterial(cfg: Cfg) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: cfg.bottomRoughness, metalness: 0,
    sheen: cfg.sheen, sheenRoughness: 0.75, sheenColor: new THREE.Color('#dff5c8'),
    envMapIntensity: 0.3,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uFoam: { value: new THREE.Color(cfg.foamColor) }, uShade: { value: new THREE.Color(cfg.shadeColor) },
      uTopRough: { value: cfg.topRoughness }, uBottomRough: { value: cfg.bottomRoughness },
      uPoreScale: { value: cfg.poreScale }, uPoreBump: { value: cfg.poreBump }, uWrinkle: { value: cfg.wrinkleBump },
      uWarmth: { value: cfg.warmth },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vObjN; varying float vAO; varying float vEdge;\nattribute float aAO; attribute float aEdge;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position; vObjN = normal; vAO = aAO; vEdge = aEdge;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj; varying vec3 vObjN; varying float vAO; varying float vEdge;
        ${NOISE_GLSL}
        uniform vec3 uFoam, uShade; uniform float uTopRough, uBottomRough, uPoreScale, uPoreBump, uWrinkle, uWarmth;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 foam = uFoam * (0.95 + 0.08 * vnoise(vObj * 19.0));       // faint aeration mottling
          float open = mix(1.0, smoothstep(0.1, 0.9, vAO), 0.35);   // gentle: strong AO tint bands on the flat sides
          diffuseColor.rgb = mix(uShade * uShade / max(uFoam, vec3(0.01)) * 0.95, foam, open);  // creases: denser, greener
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(uBottomRough, uTopRough, smoothstep(-0.2, 0.6, vObjN.y));     // satin top, matte underside
        roughnessFactor = clamp(roughnessFactor + (vnoise(vObj * 9.0) - 0.5) * 0.16, 0.0, 1.0);`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n'
        + bumpGLSL('(vnoise(vObj * uPoreScale) * 0.6 + vnoise(vObj * uPoreScale * 2.1) * 0.4) * uPoreBump * 0.0012'
          + ' + (fbm(vObj * vec3(4.0, 9.0, 6.0)) - 0.5) * uWrinkle * 0.006'))
      .replace('#include <opaque_fragment>', `
        outgoingLight += diffuseColor.rgb * vec3(1.0, 0.95, 0.85) * uWarmth;
        #include <opaque_fragment>`);
  };
  return mat;
}

export function createCandy(_stage: Stage): THREE.Mesh {
  const o = outlineFile as OutlineFile;
  const halfL = o.aspect / 2 + 0.03;
  const zMax = CANDY.bodyHalfWidth + CANDY.sideDome + CANDY.sag + CANDY.archBulge + 0.05;
  const geo = sdfGeometry(makeCarSDF(CANDY), [-halfL, -0.53, -zMax], [halfL, 0.53, zMax], CANDY.resolution);
  return new THREE.Mesh(geo, createFoamMaterial(CANDY));
}
