// BUBS Bubblegum Skalle: pink/blue foam skull, sugar-dusted, embossed "BUBS".
// Family: foam + sugar dust (3D_CANDY_GUIDELINES §5). Modelled from assets/candies/bubs/hero.png:
// the front silhouette is the hero alpha (baked by scripts/bake-outline.mjs), extruded into a pillowy
// starch-moulded body: detailed moulded front (cranium dome, muzzle, crossbones, raised letters), flatter back.
import * as THREE from 'three';
import { makeNoise3, KEY_LIGHT_POS, type FloatConfig, type SceneConfig, type Stage } from '../candy-kit';
import { NOISE_GLSL, bumpGLSL } from '../lib/glsl';
import { sdfGeometry, type SDF } from '../lib/sdf';
import { decodeOutline, textHeightField, type OutlineFile } from '../lib/outline';
import {
  SUGAR_GLSL, SUGAR_COLOR_GLSL, SUGAR_ROUGHNESS_GLSL, SUGAR_BUMP_EXPR, SUGAR_FACET_GLSL, SUGAR_GLINT_GLSL,
  sugarUniforms, type SugarConfig,
} from '../lib/sugar';
import outlineFile from './bubs.outline.json';

export const slug = 'bubs';
export const REAL_SIZE_MM = 32; // skull height (estimate from PLAN §1; confirm against a real piece)
export const ARIA_LABEL = 'A pink and blue BUBS skull, sugar-dusted, slowly tumbling';

export const CANDY = {
  // Shape (world units: skull height = 1, width ≈ 0.81 from the hero outline)
  frontThickness: 0.13, // half-thickness of the moulded front side at the rim
  backThickness: 0.11, // half-thickness of the flatter poured back
  bevel: 0.1, // pillowy rounded edge radius
  craniumDome: 0.07, // extra height over the cranium
  muzzle: 0.035, // broad maxilla bulge below the eyes
  bones: 0.105, // crossbone relief (hero: chunky rounded tubes)
  boneRadius: 0.1,
  boneEnds: 0.05, // bulbous knuckles at the four bone ends
  cheeks: 0.04, // cheekbones beside the eyes
  letters: 0.03, // raised "BUBS" (hero: soft, rounded, across the forehead)
  letterSoftness: 8, // blur (px of a 512-wide raster): moulded, not engraved
  letterFont: '900 120px "Arial Rounded MT Bold", "Arial Black", "Helvetica Neue", Arial, sans-serif',
  letterBox: { cx: 0.004, cy: 0.325, w: 0.5, h: 0.17 }, // from hero px 82–285 x, 52–122 y
  eyeRim: 0.03, // soft raised rim round the eye holes
  eyes: [[-0.119, 0.062], [0.121, 0.062]] as [number, number][], // hero px (128,190), (225,190)
  lumpiness: 0.008, // moulded irregularity
  seed: 3,
  resolution: 0.0105, // mesh cell size

  // Colours (sRGB), sampled from hero.png (opaque pixels per half, luminance percentiles)
  pinkColor: '#e8386a', // deeper than hero p05 #de4e6b: ACES + the sugar veil lift it back to the photo's mid pink
  blueColor: '#1f9fb8', // deeper than hero p05 #4ba6b4, same reasoning
  splitX: 0.03, // pink | blue seam (hero split at px ~188 of a 176-centred skull)
  splitWobble: 0.008, // hand-poured seam irregularity
  seamSoftness: 0.018, // the two foams melt into each other (hero: ~10 px blend)

  // Foam body
  foamRoughness: 0.78,
  sheen: 0.25,
  poreScale: 170, // ~0.2 mm pores at 32 mm
  poreBump: 0.6,
  warmth: 0.06, // fake subsurface glow in the shadows

  // Sugar coating (lib/sugar.ts)
  sugarColor: '#fbfaf7',
  sugarScale: 120, // ≈ 0.27 mm cells at 32 mm (fine frost, as in the hero)
  sugarDensity: 0.5,
  sugarTopBias: 0.35,
  sugarCreaseBias: 0.6,
  sugarTint: 0.45,
  sugarDust: 0.07, // frosty haze, mostly on raised areas (scaled by AO in the shader)
  sugarRoughness: 0.28,
  sugarSparkle: 1.5,
  sugarBump: 0.7,
} satisfies Record<string, unknown> & SugarConfig;
type Cfg = typeof CANDY;

export const SCENE: SceneConfig = { fov: 28, framePadding: 1.12, exposure: 0.92 };

export const FLOAT: FloatConfig = {
  seed: 3, // seed 3 passes face-on and upright mid-loop (search over seeds 1/2/3/5/7, review/bubs/CHECKLIST.md)
  speed: 1, loopSeconds: 22, spinTurns: 2, precessTurns: 1,
  drift: 0.05, driftCycles: [1, 2, 1],
  staticTime: 16.0, // reduced-motion still: face 0.97 toward camera, upright 0.97, a touch of 3/4 depth
};

const bump = (dx: number, dy: number, rx: number, ry: number) => {
  const q = (dx / rx) ** 2 + (dy / ry) ** 2;
  return q >= 1 ? 0 : (1 - q) ** 2;
};
const segDist = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
  const vx = bx - ax, vy = by - ay, t = Math.min(Math.max(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0), 1);
  return Math.hypot(x - ax - vx * t, y - ay - vy * t);
};

function makeSkullSDF(cfg: Cfg): SDF {
  const outline = decodeOutline(outlineFile as OutlineFile);
  const noise = makeNoise3(cfg.seed);
  const L = cfg.letterBox, letters = textHeightField('BUBS', cfg.letterFont, { blur: cfg.letterSoftness });
  // crossbones (hero px 60,290 -> 290,390 and mirror), in world units
  const bones: [number, number, number, number][] = [[-0.287, -0.186, 0.282, -0.433], [0.282, -0.186, -0.287, -0.433]];
  const front = (x: number, y: number) => {
    let h = cfg.frontThickness;
    h += cfg.craniumDome * bump(x, y - 0.2, 0.36, 0.32);
    h += cfg.muzzle * bump(x, y + 0.12, 0.32, 0.11);
    for (const [ax, ay, bx, by] of bones) {
      const d = segDist(x, y, ax, ay, bx, by);
      if (d < cfg.boneRadius) h += cfg.bones * (1 - (d / cfg.boneRadius) ** 2) ** 2;
    }
    for (const [ax, ay, bx, by] of bones) for (const [px, py] of [[ax, ay], [bx, by]] as const)
      h += cfg.boneEnds * bump(x - px * 0.95, y - py, 0.11, 0.09);
    for (const [ex, ey] of cfg.eyes) {
      const r = Math.hypot(x - ex, y - ey);
      h += cfg.eyeRim * Math.exp(-(((r - 0.1) / 0.03) ** 2));
      h += cfg.cheeks * bump(x - ex * 2.1, y - ey + 0.04, 0.12, 0.14);
    }
    h += cfg.letters * letters((x - L.cx) / L.w + 0.5, 0.5 - (y - L.cy) / L.h);
    return h;
  };
  const r = cfg.bevel;
  const zFar = cfg.frontThickness + cfg.craniumDome + cfg.bones + cfg.boneEnds + cfg.letters + 0.02;
  return (x, y, z) => {
    const d2 = outline.sdf(x, y);
    // far from the surface only the sign matters to the mesher: skip the relief (build-time budget)
    if (d2 > r + 0.03) return d2;
    if (z > zFar) return Math.max(d2, z - zFar + 0.01);
    const hz = z >= 0 ? front(x, y) : cfg.backThickness;
    const wx = d2 + r, wy = Math.abs(z) - (hz - r);
    let d = Math.min(Math.max(wx, wy), 0) + Math.hypot(Math.max(wx, 0), Math.max(wy, 0)) - r;
    d += cfg.lumpiness * (noise(x * 6 + 3, y * 6, z * 6) * 0.7 + noise(x * 13, y * 13 + 5, z * 13) * 0.3);
    return d;
  };
}

function createFoamSugarMaterial(cfg: Cfg) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: cfg.foamRoughness, metalness: 0,
    sheen: cfg.sheen, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ffe8ee'),
    envMapIntensity: 0.4,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uPink: { value: new THREE.Color(cfg.pinkColor) }, uBlue: { value: new THREE.Color(cfg.blueColor) },
      uSplit: { value: cfg.splitX }, uWobble: { value: cfg.splitWobble }, uSeamSoft: { value: cfg.seamSoftness },
      uPoreScale: { value: cfg.poreScale }, uPoreBump: { value: cfg.poreBump }, uWarmth: { value: cfg.warmth },
      ...sugarUniforms(cfg, KEY_LIGHT_POS),
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vObjN; varying float vAO; varying float vEdge;\nattribute float aAO; attribute float aEdge;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position; vObjN = normal; vAO = aAO; vEdge = aEdge;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj; varying vec3 vObjN; varying float vAO; varying float vEdge;
        ${NOISE_GLSL}
        ${SUGAR_GLSL}
        uniform vec3 uPink, uBlue; uniform float uSplit, uWobble, uSeamSoft, uPoreScale, uPoreBump, uWarmth;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float seam = uSplit + (vnoise(vec3(0.0, vObj.y * 7.0, vObj.z * 3.0)) - 0.5) * 2.0 * uWobble;
          vec3 foam = mix(uPink, uBlue, smoothstep(seam - uSeamSoft, seam + uSeamSoft, vObj.x));
          foam *= 0.94 + 0.08 * vnoise(vObj * 23.0);                 // faint aeration mottling
          // creases: darker AND more saturated (foam colour multiplies itself, like light scattered deeper in)
          float open = smoothstep(0.2, 0.95, vAO);
          diffuseColor.rgb = mix(foam * foam * 0.95, foam, open);
        }
        ${SUGAR_COLOR_GLSL}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (vnoise(vObj * 9.0) - 0.5) * 0.2, 0.0, 1.0);   // ±0.1 variation
        ${SUGAR_ROUGHNESS_GLSL}`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n'
        + bumpGLSL(`(vnoise(vObj * uPoreScale) * 0.6 + vnoise(vObj * uPoreScale * 2.1) * 0.4) * uPoreBump * 0.0012 + ${SUGAR_BUMP_EXPR}`)
        + SUGAR_FACET_GLSL)
      .replace('#include <opaque_fragment>', `
        outgoingLight += diffuseColor.rgb * vec3(1.0, 0.85, 0.85) * uWarmth;
        ${SUGAR_GLINT_GLSL}
        #include <opaque_fragment>`);
  };
  return mat;
}

export function createCandy(_stage: Stage): THREE.Mesh {
  const halfW = (outlineFile as OutlineFile).aspect / 2 + 0.03;
  const zMax = CANDY.frontThickness + CANDY.craniumDome + CANDY.bones + CANDY.letters + 0.05;
  const geo = sdfGeometry(makeSkullSDF(CANDY), [-halfW, -0.53, -CANDY.backThickness - 0.05], [halfW, 0.53, zMax], CANDY.resolution);
  return new THREE.Mesh(geo, createFoamSugarMaterial(CANDY));
}
