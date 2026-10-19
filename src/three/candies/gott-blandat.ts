// Gott & Blandat licorice cat (Malaco): a seated black licorice cat, head turned a little, tail curled round
// its front. Family: licorice, no coating (3D_CANDY_GUIDELINES §5; djungelvral's liquorice satin without salt).
// Modelled from assets/candies/gott-blandat/hero.png: the front silhouette is the hero alpha (baked by
// scripts/bake-outline.mjs), inflated into a round moulded figure with a pillowy edge. The moulded front carries
// the head dome, ears, almond eyes, muzzle and nose, the neck seam, a haunch, the chest and the curled tail;
// the back is a plainer dome. Pebbly starch-mould texture and fine cracks are shader detail.
import * as THREE from 'three';
import { makeNoise3, KEY_LIGHT_POS, type FloatConfig, type SceneConfig, type Stage } from '../candy-kit';
import { NOISE_GLSL, bumpGLSL } from '../lib/glsl';
import { sdfGeometry, type SDF } from '../lib/sdf';
import { decodeOutline, type OutlineFile } from '../lib/outline';
import outlineFile from './gott-blandat.outline.json';

export const slug = 'gott-blandat';
export const REAL_SIZE_MM = 24; // cat height (estimate: Malaco licorice cats are ~2–2.5 cm; confirm against a real piece)
export const ARIA_LABEL = 'A black licorice cat from Gott & Blandat, sitting with its tail curled round, slowly tumbling';

// hero px -> world (bbox 31,29 474x677; height = 1, origin at the bbox centre, y up)
const W = (px: number, py: number): [number, number] => [(px - 268) / 677, (367.5 - py) / 677];

export const CANDY = {
  // Shape (world units: cat height = 1, width ≈ 0.70 from the hero outline)
  frontThickness: 0.17, // half-thickness of the moulded front at the rim
  backThickness: 0.15, // half-thickness of the plainer back
  bevel: 0.14, // round, pillowy edge (licorice figures are poured into deep moulds)
  headDome: 0.07, // the head is a separate round mass
  haunch: 0.07, // big rounded hip on the left (broad and soft, not a stuck-on dome)
  chest: 0.05,
  backDome: 0.06, // the back swells a little too
  ears: -0.035, // shallow hollows inside the ears
  eyeLids: 0.014, // almond eyes: soft raised lids round a small, half-closed sunken eye
  eyes: [W(290, 215), W(380, 210)],
  muzzle: 0.02, nose: 0.012,
  neckSeam: 0.011, // soft groove where head meets body (hero: a crease line at y ≈ 345 px)
  tail: 0.08, // curled tail round the front: a crescent, thin at both ends (hero px 248,470 -> 332,600 -> 290,675)
  tailRadius: 0.055,
  tailGroove: 0.05, // shadowed hollow inside the tail curl
  legSeam: 0.009, // the front leg's moulded line on the right
  lumpiness: 0.009,
  seed: 5,
  resolution: 0.0105,

  // Colours (sRGB), sampled from hero.png (opaque px luminance p05 #1e1c1d, median #353334, p95 #686667)
  licoriceColor: '#232122', // near-black, very slightly warm; the satin highlights lift it to the photo's mid-grey
  creaseColor: '#0e0d0d',

  // Licorice satin (moulded, slightly dusty starch finish: not glassy)
  roughness: 0.68,
  roughnessVariation: 0.18,
  clearcoat: 0.05,
  clearcoatRoughness: 0.4,
  sheen: 0.18, // the pale starch bloom on the raised areas (hero: grey-ish highlights)
  pebbleScale: 110, // pebbly mould texture (~0.2 mm at 24 mm)
  pebbleBump: 1.8,
  crackScale: 4.5, // a few long hairline cracks (hero: crazing on the body)
  crackBump: 0.5,
};
type Cfg = typeof CANDY;

export const SCENE: SceneConfig = { fov: 28, framePadding: 1.12, exposure: 0.92 };

export const FLOAT: FloatConfig = {
  seed: 6, // longest face-on + upright window (t 17–20 s) of seeds 1–8 (review/gott-blandat/CHECKLIST.md)
  speed: 1, loopSeconds: 22, spinTurns: 2, precessTurns: 1,
  drift: 0.05, driftCycles: [1, 2, 1],
  staticTime: 17.0, // reduced-motion still: face toward camera, upright, a touch of 3/4 like the hero photo
};

const bump = (dx: number, dy: number, rx: number, ry: number) => {
  const q = (dx / rx) ** 2 + (dy / ry) ** 2;
  return q >= 1 ? 0 : (1 - q) ** 2;
};
const segDist = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
  const vx = bx - ax, vy = by - ay, t = Math.min(Math.max(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0), 1);
  return Math.hypot(x - ax - vx * t, y - ay - vy * t);
};
const polyDist = (x: number, y: number, pts: [number, number][]) => {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(x, y, pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1]));
  return d;
};
/** distance to a polyline + arc-length parameter t in [0, 1] of the closest point */
const polyDistT = (x: number, y: number, pts: [number, number][]) => {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  const total = lens.reduce((a, b) => a + b, 0);
  let best = 1e9, bt = 0, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]!, [bx, by] = pts[i + 1]!, vx = bx - ax, vy = by - ay;
    const u = Math.min(Math.max(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0), 1);
    const d = Math.hypot(x - ax - vx * u, y - ay - vy * u);
    if (d < best) { best = d; bt = (acc + u * lens[i]!) / total; }
    acc += lens[i]!;
  }
  return [best, bt] as const;
};

function makeCatSDF(cfg: Cfg): SDF {
  const outline = decodeOutline(outlineFile as OutlineFile);
  const noise = makeNoise3(cfg.seed);
  const head = W(330, 195), haunch = W(150, 520), chest = W(370, 430), muzzle = W(318, 285), nose = W(308, 288);
  const earL = W(200, 85), earR = W(440, 80);
  const tailPts = [W(248, 470), W(292, 500), W(325, 550), W(332, 600), W(318, 645), W(290, 675)];
  const groovePts = [W(240, 500), W(272, 545), W(288, 600), W(278, 648)];
  const neckPts = [W(195, 330), W(260, 345), W(340, 350), W(420, 340), W(480, 320)];
  const legPts = [W(432, 420), W(436, 560), W(440, 690)];
  const front = (x: number, y: number) => {
    let h = cfg.frontThickness;
    h += cfg.headDome * bump(x - head[0], y - head[1], 0.27, 0.22);
    h += cfg.headDome * 0.5 * bump(x - head[0], y - head[1] + 0.02, 0.33, 0.27); // head overhangs the neck a little
    h += cfg.haunch * Math.exp(-(((x - haunch[0]) / 0.2) ** 2 + ((y - haunch[1]) / 0.22) ** 2));
    h += cfg.chest * Math.exp(-(((x - chest[0]) / 0.16) ** 2 + ((y - chest[1]) / 0.16) ** 2));
    h += cfg.ears * (bump(x - earL[0], y - earL[1], 0.06, 0.07) + bump(x - earR[0], y - earR[1], 0.06, 0.07));
    for (const [ex, ey] of cfg.eyes) {
      const q = Math.hypot((x - ex) / 1.6, y - ey); // almond: wider than tall
      h += cfg.eyeLids * Math.exp(-(((q - 0.02) / 0.012) ** 2)) - cfg.eyeLids * 0.8 * bump(x - ex, y - ey, 0.03, 0.012);
    }
    h += cfg.muzzle * bump(x - muzzle[0], y - muzzle[1], 0.09, 0.06);
    h += cfg.nose * bump(x - nose[0], y - nose[1] - 0.004, 0.022, 0.016);
    h -= cfg.neckSeam * Math.exp(-((polyDist(x, y, neckPts) / 0.013) ** 2));
    h -= cfg.legSeam * Math.exp(-((polyDist(x, y, legPts) / 0.01) ** 2));
    h -= cfg.tailGroove * Math.exp(-(((polyDist(x, y, groovePts)) / 0.032) ** 2));
    if (y > W(0, 450)[1] || x < W(200, 0)[0] || x > W(380, 0)[0]) return h; // tail region only (build budget)
    const [td, tt] = polyDistT(x, y, tailPts);
    const tr = cfg.tailRadius * (0.35 + 0.65 * Math.sin(Math.PI * tt) ** 0.7); // crescent: thin ends, fat middle
    h += cfg.tail * Math.sin(Math.PI * tt) ** 0.5 * Math.exp(-2.2 * (td / tr) ** 2); // smooth rounded tube
    return h;
  };
  const back = (x: number, y: number) =>
    cfg.backThickness + cfg.backDome * (bump(x - head[0], y - head[1], 0.28, 0.24) + bump(x + 0.02, y + 0.22, 0.34, 0.3));
  const r = cfg.bevel;
  const zFar = cfg.frontThickness + cfg.haunch + cfg.tail + 0.03;
  return (x, y, z) => {
    const d2 = outline.sdf(x, y);
    if (d2 > r + 0.03) return d2; // far outside: only the sign matters (build-time budget)
    if (Math.abs(z) > zFar) return Math.max(d2, Math.abs(z) - zFar + 0.01);
    const hz = z >= 0 ? front(x, y) : back(x, y);
    const wx = d2 + r, wy = Math.abs(z) - (hz - r);
    let d = Math.min(Math.max(wx, wy), 0) + Math.hypot(Math.max(wx, 0), Math.max(wy, 0)) - r;
    d += cfg.lumpiness * (noise(x * 6 + 3, y * 6, z * 6) * 0.7 + noise(x * 14, y * 14 + 5, z * 14) * 0.3);
    return d;
  };
}

function createLicoriceMaterial(cfg: Cfg) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: cfg.roughness, metalness: 0,
    clearcoat: cfg.clearcoat, clearcoatRoughness: cfg.clearcoatRoughness,
    sheen: cfg.sheen, sheenRoughness: 0.6, sheenColor: new THREE.Color('#b9b4b2'),
    envMapIntensity: 0.4,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uLic: { value: new THREE.Color(cfg.licoriceColor) }, uCrease: { value: new THREE.Color(cfg.creaseColor) },
      uRoughVar: { value: cfg.roughnessVariation },
      uPebScale: { value: cfg.pebbleScale }, uPebBump: { value: cfg.pebbleBump },
      uCrackScale: { value: cfg.crackScale }, uCrackBump: { value: cfg.crackBump },
      uKeyDir: { value: KEY_LIGHT_POS.clone().normalize() },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vObjN; varying float vAO; varying float vEdge;\nattribute float aAO; attribute float aEdge;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position; vObjN = normal; vAO = aAO; vEdge = aEdge;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj; varying vec3 vObjN; varying float vAO; varying float vEdge;
        ${NOISE_GLSL}
        uniform vec3 uLic, uCrease, uKeyDir; uniform float uRoughVar, uPebScale, uPebBump, uCrackScale, uCrackBump;
        float crack(vec3 p) { float n = vnoise(p) * 0.7 + vnoise(p * 2.3 + 7.0) * 0.3; return 1.0 - smoothstep(0.0, 0.012, abs(n - 0.5)); } // sparse hairlines`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 lic = uLic * (0.9 + 0.2 * vnoise(vObj * 17.0));             // uneven mould colour
          lic = mix(uCrease, lic, smoothstep(0.15, 0.9, vAO));              // creases go blacker
          lic *= 1.0 - 0.25 * crack(vObj * uCrackScale) * smoothstep(0.4, 1.0, vAO);
          diffuseColor.rgb = lic;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (vnoise(vObj * 8.0) - 0.5) * 2.0 * uRoughVar - 0.12 * max(vEdge, 0.0), 0.05, 1.0);`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n'
        + bumpGLSL('(vnoise(vObj * uPebScale) * 0.6 + vnoise(vObj * uPebScale * 2.3 + 4.0) * 0.4) * uPebBump * 0.0012 - crack(vObj * uCrackScale) * uCrackBump * 0.0015'))
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        material.sheenColor *= smoothstep(0.3, 1.0, vAO);   // starch bloom only on open areas`);
  };
  return mat;
}

export function createCandy(_stage: Stage): THREE.Mesh {
  const halfW = (outlineFile as OutlineFile).aspect / 2 + 0.04;
  const zMax = CANDY.frontThickness + CANDY.haunch + CANDY.tail + 0.05;
  const zMin = -(CANDY.backThickness + CANDY.backDome * 2 + 0.05);
  const geo = sdfGeometry(makeCatSDF(CANDY), [-halfW - 0.02, -0.54, zMin], [halfW + 0.02, 0.54, zMax], CANDY.resolution);
  return new THREE.Mesh(geo, createLicoriceMaterial(CANDY));
}
