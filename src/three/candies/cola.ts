// Sura colanappar: sour cola "pacifier" gummy, cola-brown ring + creamy white handle, coated in sour sugar.
// Family: sugar-dusted gummy (3D_CANDY_GUIDELINES §5). Modelled from assets/candies/cola/hero.png:
// the front silhouette (ring with hole, collar knob, handle) is the hero alpha (scripts/bake-outline.mjs),
// extruded into a chunky moulded gummy: domed ring, raised collar, rounded handle; flatter poured back.
// The piece lies diagonally in the hero, so the model keeps that orientation (axis tip -> ring centre).
import * as THREE from 'three';
import { makeNoise3, KEY_LIGHT_POS, type FloatConfig, type SceneConfig, type Stage } from '../candy-kit';
import { NOISE_GLSL, bumpGLSL } from '../lib/glsl';
import { sdfGeometry, type SDF } from '../lib/sdf';
import { decodeOutline, type OutlineFile } from '../lib/outline';
import {
  SUGAR_GLSL, SUGAR_COLOR_GLSL, SUGAR_ROUGHNESS_GLSL, SUGAR_BUMP_EXPR, SUGAR_FACET_GLSL, SUGAR_GLINT_GLSL,
  sugarUniforms, type SugarConfig,
} from '../lib/sugar';
import outlineFile from './cola.outline.json';

export const slug = 'cola';
export const REAL_SIZE_MM = 40; // tip to ring top (estimate for a Malaco sura colanapp; confirm against a real piece)
export const ARIA_LABEL = 'A sour cola pacifier gummy, brown and white, coated in sugar, slowly tumbling';

export const CANDY = {
  // Shape (world units: silhouette height = 1, width ≈ 0.78; hero px -> world: x=(px-319)/729, y=(400-py)/729)
  frontThickness: 0.062, // half-thickness of the moulded front at the rim
  backThickness: 0.055, // flatter poured back
  bevel: 0.05, // rounded gummy edge
  ringCentre: [0.152, 0.254] as [number, number], // hole centre, hero px (430,215)
  ringMid: 0.15, // radius of the ring's crest
  ringWidth: 0.09, // half-width of the domed ring band
  ringDome: 0.02,
  holeLip: 0.0, // hero: no separate lip, the ring is one pillowy band
  collar: [-0.03, -0.015] as [number, number], // knob between ring and handle, hero px (~297,411)
  collarDome: 0.04,
  handleDome: 0.025, // the handle is rounder and fuller than the ring
  handleBevel: 0.082, // ≈ handle half-width: a rounded rod (hero)
  handleBack: 0.085,
  axisTip: [-0.307, -0.412] as [number, number], // handle tip, hero px (95,700)
  lumpiness: 0.006,
  seed: 5,
  resolution: 0.0075,

  // Colours (sRGB), sampled from hero.png (brown ring p20 ≈ #5a3c2e, handle median ≈ #d4d0bf)
  brownColor: '#5e2a04', // mid cola brown: darker bases turn grey under the env reflections // deeper than the hero: ACES + the sugar veil lift it back to the photo's cola brown
  creamColor: '#b1a989', // milky white gummy (hero handle reads warm cream, not white)
  splitAt: 0.615, // fraction along tip -> ring centre where cola turns to cream (hero: collar top)
  splitSoftness: 0.065, // hero: ~40 px gradient
  splitWobble: 0.02,

  // Gummy body
  brownRoughness: 0.68, // sugar-coated: satin, not glossy
  creamRoughness: 0.6,
  translucency: 0.08, // fake light bleed: lighter where thin (rim), warmer in the shadows

  // Sour sugar coating (lib/sugar.ts): coarse, dense, sparkly
  sugarColor: '#f7f5ef',
  sugarScale: 95, // ≈ 0.42 mm grains at 40 mm (sour sugar is coarser than BUBS frost)
  sugarDensity: 0.4,
  sugarTopBias: 0.3,
  sugarCreaseBias: 0.5,
  sugarTint: 0.78, // grains take the gummy colour: light-brown speckles on the cola, cream on the handle
  sugarDust: 0.04,
  sugarRoughness: 0.25,
  sugarSparkle: 1.6,
  sugarBump: 0.8,
} satisfies Record<string, unknown> & SugarConfig;
type Cfg = typeof CANDY;

export const SCENE: SceneConfig = { fov: 28, framePadding: 1.12, exposure: 0.92 };

export const FLOAT: FloatConfig = {
  seed: 3, // 3 passes face-on with the ring up mid-loop (search over seeds 1–8, review/cola/CHECKLIST.md)
  speed: 1, loopSeconds: 22, spinTurns: 2, precessTurns: 1,
  drift: 0.05, driftCycles: [1, 2, 1],
  staticTime: 15.75, // reduced-motion still: face 1.0 toward camera, ring up (axis 0.93 vertical), slight diagonal
};

const bump = (dx: number, dy: number, rx: number, ry: number) => {
  const q = (dx / rx) ** 2 + (dy / ry) ** 2;
  return q >= 1 ? 0 : (1 - q) ** 2;
};

/** unit axis from the handle tip to the ring centre, and its length */
function axisOf(cfg: Cfg) {
  const [tx, ty] = cfg.axisTip, [cx, cy] = cfg.ringCentre;
  const L = Math.hypot(cx - tx, cy - ty);
  return { tx, ty, ux: (cx - tx) / L, uy: (cy - ty) / L, L };
}

function makeColaSDF(cfg: Cfg): SDF {
  const outline = decodeOutline(outlineFile as OutlineFile);
  const noise = makeNoise3(cfg.seed);
  const A = axisOf(cfg);
  const [rcx, rcy] = cfg.ringCentre, [ccx, ccy] = cfg.collar;
  // 1 along the handle, fading to 0 past the collar into the ring
  const handleW = (x: number, y: number) => {
    const t = (x - A.tx) * A.ux + (y - A.ty) * A.uy, k = Math.min(Math.max((t - A.L * 0.48) / (A.L * 0.16), 0), 1);
    return 1 - k * k * (3 - 2 * k);
  };
  const front = (x: number, y: number) => {
    let h = cfg.frontThickness;
    const rr = Math.hypot(x - rcx, y - rcy);
    const band = (rr - cfg.ringMid) / cfg.ringWidth;
    if (Math.abs(band) < 1) h += cfg.ringDome * (1 - band * band) ** 2;
    h += cfg.holeLip * Math.exp(-(((rr - 0.095) / 0.02) ** 2));
    // collar knob: an ellipse across the axis
    const dx = x - ccx, dy = y - ccy, along = dx * A.ux + dy * A.uy, across = -dx * A.uy + dy * A.ux;
    h += cfg.collarDome * bump(along, across, 0.1, 0.17);
    h += cfg.handleDome * handleW(x, y);
    return h;
  };
  const zFar = cfg.frontThickness + Math.max(cfg.ringDome + cfg.holeLip, cfg.collarDome + cfg.handleDome) + 0.02;
  return (x, y, z) => {
    const d2 = outline.sdf(x, y);
    if (d2 > cfg.handleBevel + 0.03) return d2; // far from the surface only the sign matters (build-time budget)
    if (z > zFar) return Math.max(d2, z - zFar + 0.01);
    // the handle is a near-round rod (big bevel, thicker back); the ring is a flatter moulded band
    const w = handleW(x, y), r = cfg.bevel + (cfg.handleBevel - cfg.bevel) * w;
    const hz = z >= 0 ? front(x, y) : cfg.backThickness + (cfg.handleBack - cfg.backThickness) * w;
    const wx = d2 + r, wy = Math.abs(z) - (hz - r);
    let d = Math.min(Math.max(wx, wy), 0) + Math.hypot(Math.max(wx, 0), Math.max(wy, 0)) - r;
    d += cfg.lumpiness * (noise(x * 7 + 3, y * 7, z * 7) * 0.7 + noise(x * 15, y * 15 + 5, z * 15) * 0.3);
    return d;
  };
}

function createSourGummyMaterial(cfg: Cfg) {
  const A = axisOf(cfg);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: cfg.brownRoughness, metalness: 0,
    sheen: 0.1, sheenRoughness: 0.7, sheenColor: new THREE.Color('#fff4ea'),
    envMapIntensity: 0.3,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uBrown: { value: new THREE.Color(cfg.brownColor) }, uCream: { value: new THREE.Color(cfg.creamColor) },
      uTip: { value: new THREE.Vector2(A.tx, A.ty) }, uAxis: { value: new THREE.Vector2(A.ux, A.uy) },
      uSplit: { value: cfg.splitAt * A.L }, uSplitSoft: { value: cfg.splitSoftness }, uWobble: { value: cfg.splitWobble },
      uRoughB: { value: cfg.brownRoughness }, uRoughC: { value: cfg.creamRoughness }, uTrans: { value: cfg.translucency },
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
        uniform vec3 uBrown, uCream; uniform vec2 uTip, uAxis; uniform float uSplit, uSplitSoft, uWobble, uRoughB, uRoughC, uTrans;
        float gCola;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 q = vObj.xy - uTip;
          float t = dot(q, uAxis), off = dot(q, vec2(-uAxis.y, uAxis.x));
          float split = uSplit + (vnoise(vec3(off * 9.0, vObj.z * 4.0, 1.7)) - 0.5) * 2.0 * uWobble;
          gCola = smoothstep(split - uSplitSoft, split + uSplitSoft, t);
          vec3 base = mix(uCream, uBrown, gCola);
          base *= 0.93 + 0.1 * vnoise(vObj * 21.0);                       // cloudy gummy mottling
          // the cola part is blotchy: darker reddish patches under the sugar (hero)
          base *= mix(1.0, 0.45 + 0.9 * fbm(vObj * 14.0 + 2.3), gCola);
          // thin rim lets light through: lighter, warmer cola at the edges (fake translucency)
          base = mix(base, base * vec3(1.9, 1.45, 1.2), uTrans * gCola * smoothstep(0.0, 1.0, vEdge));
          float open = smoothstep(0.2, 0.95, vAO);
          diffuseColor.rgb = mix(base * base * 0.95, base, open);
        }
        ${SUGAR_COLOR_GLSL}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(uRoughC, uRoughB, gCola) + (vnoise(vObj * 9.0) - 0.5) * 0.15;
        ${SUGAR_ROUGHNESS_GLSL}`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n'
        + bumpGLSL(`vnoise(vObj * 60.0) * 0.0008 + ${SUGAR_BUMP_EXPR}`)
        + SUGAR_FACET_GLSL)
      .replace('#include <opaque_fragment>', `
        outgoingLight += diffuseColor.rgb * vec3(1.0, 0.8, 0.65) * uTrans * 0.35 * gCola;   // warm inner glow
        ${SUGAR_GLINT_GLSL}
        #include <opaque_fragment>`);
  };
  return mat;
}

export function createCandy(_stage: Stage): THREE.Mesh {
  const o = outlineFile as OutlineFile;
  const halfW = o.aspect / 2 + 0.03;
  const zMax = CANDY.frontThickness + CANDY.collarDome + CANDY.handleDome + CANDY.ringDome + 0.04;
  const geo = sdfGeometry(makeColaSDF(CANDY), [-halfW, -0.53, -CANDY.handleBack - 0.04], [halfW, 0.53, zMax], CANDY.resolution);
  return new THREE.Mesh(geo, createSourGummyMaterial(CANDY));
}
