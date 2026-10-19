// Kexchoklad: chocolate wafer bar in its yellow flow-wrap packet with red crimped ends.
// Family: wrapped packet (3D_CANDY_GUIDELINES §5). Modelled from assets/candies/kexchoklad/hero.png:
// a pillow pack = the bar's rounded-rectangle cross-section swept along its length, collapsing into flat
// crimp seals at both ends (sawtooth edge + pleat ridges), shoulder wrinkles where the film gathers, and a
// folded fin seal along the back. The label is a stylised vector-like recreation drawn on a canvas at build
// time (check/wafer lattice, KEX lettering, ribbon, maker oval), not a copy of the photo's pixels (§5).
import * as THREE from 'three';
import { makeNoise3, type FloatConfig, type SceneConfig, type Stage } from '../candy-kit';
import { NOISE_GLSL, bumpGLSL } from '../lib/glsl';

export const slug = 'kexchoklad';
export const REAL_SIZE_MM = 150; // packet length incl. crimps (estimate for the 60 g bar; confirm against a real one)
export const ARIA_LABEL = 'A Kexchoklad bar in its yellow wrapper with red crimped ends, slowly tumbling';

// Hero frame: packet bbox in hero.png px (x 24..775, y 24..340). World: packet height (crimp) = 1.
const HERO = { x0: 24, y0: 24, w: 751, h: 316 };
const PX = 1 / HERO.h; // world units per hero px

export const CANDY = {
  // Shape (world units: crimp height = 1, length = 751 / 316 = 2.38 from the hero outline)
  length: HERO.w * PX,
  bodyHalfHeight: 0.473, // hero: yellow body spans y 34..333 (crimps 24..340)
  halfThickness: 0.13, // ≈ 17 mm bar at 63 mm packet height
  edgeRadius: 0.07, // film over the bar's rounded long edges
  sealHalfThickness: 0.004, // two films pressed together
  crimpPx: 54, // red crimp band width (hero px from each end)
  shoulderPx: [44, 118] as [number, number], // film rises from the flat seal to the bar (hero px from the end)
  taperPx: [18, 95] as [number, number], // packet narrows from crimp height to body height
  teeth: 15, // sawtooth teeth along each crimp edge (hero: ~21 px pitch)
  toothDepth: 8 * PX,
  pleat: 0.009, // crimp ridges (run along the length, one per tooth)
  dome: 0.012, // faint pillowing of the front/back faces
  wrinkles: 0.009, // diagonal creases on the shoulders
  finHalfWidth: 0.045, // back fin seal (folded flat)
  finHeight: 0.012,
  finY: 0.06,
  lumpiness: 0.003,
  seed: 5,

  // Colours (sRGB), sampled from hero.png (5x5 px means at the noted spots)
  yellow: '#e8c552', // body bg (100,150) #e7c652, (690,150) #eac852
  yellowLight: '#f2d873', // lattice highlight, bg (400,40) #ebd46a
  yellowDark: '#d9ad45', // lattice shade / lower-left (110,300) #e5bc59
  red: '#bb2f2c', // crimp band (50,180) #c93835, deepened: the flat seal faces the key light
  redDark: '#a82a28',
  panel: '#f0cf62', // raised panel behind KEX (400,75) #e9c752
  panelEdge: '#a8682a',
  wafer: '#a0501f', // KEX letter cells (200,200) #b05d29, deepened for the lit face
  waferLine: '#efc35c', // KEX lattice lines (520,170) #e4bd4d
  brown: '#5e2812', // letter extrusion / outline (250,280) #6a2d14
  cream: '#fff6dc',
  ribbon: '#c8312e', // CHOKLAD ribbon (540,268)
  makerRed: '#c8352e',
  makerOval: '#f3d77a',

  // Film
  roughness: 0.3,
  specular: 0.55, // film reflects the room less than bare glossy plastic at face-on angles
  envIntensity: 0.4,
  roughnessVariation: 0.07, // streaky: glossier along the length, duller across crinkles
  clearcoat: 0.15,
  clearcoatRoughness: 0.16,
  crinkleScale: 9,
  crinkleBump: 0.7,
  printSaturation: 1.35, // pre-compensates ACES + clearcoat veil so the print lands on the photo's chroma
  printGain: 0.66,
};
type Cfg = typeof CANDY;

export const SCENE: SceneConfig = { fov: 28, framePadding: 1.08, exposure: 0.92 };

export const FLOAT: FloatConfig = {
  seed: 25, // passes face-on and level at t≈12 (search over seeds 1–26, review/kexchoklad/CHECKLIST.md)
  speed: 1, loopSeconds: 22, spinTurns: 2, precessTurns: 1,
  drift: 0.05, driftCycles: [1, 2, 1],
  staticTime: 11.5, // reduced-motion still: print face-on (0.98), a slight tilt so it reads as a packet
};

// ---------- Label texture (2048², front in the top 862 rows, back from row 1024) ----------------------
const TEX = 2048, BAND = Math.round((TEX * HERO.h) / HERO.w); // 862

function lattice(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, pitch: number, color: string, width: number) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  for (let k = -h; k < w + h; k += pitch) {
    ctx.moveTo(x0 + k, y0); ctx.lineTo(x0 + k + h, y0 + h);
    ctx.moveTo(x0 + k, y0 + h); ctx.lineTo(x0 + k + h, y0);
  }
  ctx.stroke();
  ctx.restore();
}

function waferPattern(ctx: CanvasRenderingContext2D, c: Cfg) {
  const p = document.createElement('canvas'); p.width = p.height = 24;
  const g = p.getContext('2d')!;
  g.fillStyle = c.wafer; g.fillRect(0, 0, 24, 24);
  const shade = g.createLinearGradient(0, 0, 24, 24);
  shade.addColorStop(0, 'rgba(255,190,110,0.35)'); shade.addColorStop(1, 'rgba(70,25,5,0.35)');
  g.fillStyle = shade; g.beginPath(); g.moveTo(12, 2); g.lineTo(22, 12); g.lineTo(12, 22); g.lineTo(2, 12); g.fill();
  g.strokeStyle = c.waferLine; g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(24, 24); g.moveTo(24, 0); g.lineTo(0, 24); g.stroke();
  return ctx.createPattern(p, 'repeat')!;
}

function makerOval(ctx: CanvasRenderingContext2D, c: Cfg, cx: number, cy: number, s: number) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = c.makerOval; ctx.strokeStyle = c.makerRed; ctx.lineWidth = 3.2;
  for (const [ox, rx, ry] of [[-30, 26, 20], [30, 26, 20], [0, 56, 23]] as const) {
    ctx.beginPath(); ctx.ellipse(ox, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = c.makerOval; ctx.beginPath(); ctx.ellipse(0, 0, 54, 21, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c.makerRed; ctx.font = 'italic 700 29px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Cloetta', 0, 1);
  ctx.restore();
}

function crimpBands(ctx: CanvasRenderingContext2D, c: Cfg) {
  for (const x of [HERO.x0, HERO.x0 + HERO.w - c.crimpPx]) {
    ctx.fillStyle = c.red; ctx.fillRect(x, HERO.y0, c.crimpPx, HERO.h);
    // pleat ridges: one light/dark pair per tooth
    const pitch = HERO.h / c.teeth;
    for (let i = 0; i < c.teeth; i++) {
      const y = HERO.y0 + i * pitch;
      const g = ctx.createLinearGradient(0, y, 0, y + pitch);
      g.addColorStop(0, 'rgba(255,170,160,0.16)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(80,0,0,0.14)');
      ctx.fillStyle = g; ctx.fillRect(x, y, c.crimpPx, pitch);
    }
    // inner edge of the seal
    const inner = x === HERO.x0 ? x + c.crimpPx : x;
    ctx.fillStyle = c.redDark; ctx.fillRect(inner - 2, HERO.y0, 4, HERO.h);
  }
}

function drawFront(ctx: CanvasRenderingContext2D, c: Cfg) {
  // background + faint wafer lattice
  const bg = ctx.createLinearGradient(0, HERO.y0, 0, HERO.y0 + HERO.h);
  bg.addColorStop(0, c.yellowLight); bg.addColorStop(0.35, c.yellow); bg.addColorStop(1, c.yellowDark);
  ctx.fillStyle = bg; ctx.fillRect(HERO.x0, HERO.y0, HERO.w, HERO.h);
  lattice(ctx, HERO.x0, HERO.y0, HERO.w, HERO.h, 26, 'rgba(250,222,120,0.5)', 2.2);
  lattice(ctx, HERO.x0 + 1.5, HERO.y0 + 1.5, HERO.w, HERO.h, 26, 'rgba(190,140,40,0.18)', 1.2);

  // raised panel behind the lettering (curved top edge rising to the right)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(140, 128); ctx.quadraticCurveTo(380, 52, 660, 36);
  ctx.lineTo(682, 80); ctx.lineTo(664, 312); ctx.quadraticCurveTo(420, 306, 150, 314); ctx.closePath();
  const pg = ctx.createLinearGradient(0, 47, 0, 300);
  pg.addColorStop(0, '#f8de80'); pg.addColorStop(0.55, c.panel); pg.addColorStop(1, '#dcaa42');
  ctx.fillStyle = pg; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = c.panelEdge; ctx.stroke();
  ctx.clip();
  lattice(ctx, 140, 40, 540, 270, 26, 'rgba(255,232,140,0.3)', 2);
  ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(255,248,215,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(148, 137); ctx.quadraticCurveTo(380, 62, 656, 46); ctx.stroke(); ctx.restore();

  // KEX: wafer-filled slab letters with a chocolate extrusion and a cream rim, rising slightly to the right
  ctx.save();
  ctx.translate(386, 194); ctx.transform(1, -0.105, 0, 1, 0, 0); ctx.scale(1.34, 1.18);
  ctx.font = '900 196px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (let i = 9; i >= 1; i--) { ctx.fillStyle = c.brown; ctx.fillText('KEX', i * 0.55, i * 1.1); }
  ctx.strokeStyle = c.brown; ctx.lineWidth = 11; ctx.strokeText('KEX', 0, 0);
  ctx.strokeStyle = c.cream; ctx.lineWidth = 4; ctx.strokeText('KEX', -1.2, -1.6);
  ctx.fillStyle = waferPattern(ctx, c); ctx.fillText('KEX', 0, 0);
  ctx.restore();

  // CHOKLAD ribbon: curls up to the right from under the X
  ctx.save();
  ctx.translate(566, 262); ctx.rotate(-0.24);
  ctx.fillStyle = '#7d1715';
  ctx.beginPath(); ctx.moveTo(-100, -6); ctx.lineTo(-86, -14); ctx.lineTo(-86, 26); ctx.lineTo(-100, 30); ctx.closePath(); ctx.fill();
  const rg = ctx.createLinearGradient(0, -24, 0, 24);
  rg.addColorStop(0, '#e2534a'); rg.addColorStop(0.45, c.ribbon); rg.addColorStop(1, '#951d1b');
  ctx.fillStyle = rg;
  ctx.beginPath(); ctx.moveTo(-88, -14); ctx.bezierCurveTo(-20, -8, 40, -34, 98, -40);
  ctx.lineTo(102, 2); ctx.bezierCurveTo(40, 8, -20, 32, -88, 26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff8ee'; ctx.font = '800 23px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.save(); ctx.translate(8, -4); ctx.rotate(-0.12); ctx.fillText('CHOKLAD', 0, 0); ctx.restore();
  ctx.restore();

  ctx.fillStyle = c.brown; ctx.font = '700 15px Arial, sans-serif'; ctx.fillText('®', 627, 66);
  makerOval(ctx, c, 176, 72, 1);
  crimpBands(ctx, c);
}

function drawBack(ctx: CanvasRenderingContext2D, c: Cfg) {
  const bg = ctx.createLinearGradient(0, HERO.y0, 0, HERO.y0 + HERO.h);
  bg.addColorStop(0, c.yellow); bg.addColorStop(1, c.yellowDark);
  ctx.fillStyle = bg; ctx.fillRect(HERO.x0, HERO.y0, HERO.w, HERO.h);
  lattice(ctx, HERO.x0, HERO.y0, HERO.w, HERO.h, 26, 'rgba(255,236,150,0.5)', 2.2);
  // fin seal band (geometry raises it; print shows the overlap)
  const fy = HERO.y0 + (0.5 - c.finY) * HERO.h, fh = c.finHalfWidth * HERO.h;
  ctx.fillStyle = 'rgba(160,110,20,0.22)'; ctx.fillRect(HERO.x0, fy - fh, HERO.w, 2 * fh);
  ctx.fillStyle = 'rgba(255,240,170,0.5)'; ctx.fillRect(HERO.x0, fy - fh, HERO.w, 2);
  // small brand marks + an info panel (abstract lines, no copied text) + barcode
  makerOval(ctx, c, 170, 80, 0.8);
  ctx.save(); ctx.translate(560, 85); ctx.scale(1.3, 1);
  ctx.font = '900 54px "Arial Black", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = c.brown; ctx.lineWidth = 6; ctx.strokeText('KEX', 0, 0);
  ctx.fillStyle = waferPattern(ctx, c); ctx.fillText('KEX', 0, 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,250,235,0.92)';
  ctx.beginPath(); ctx.roundRect(110, 240, 300, 84, 8); ctx.fill();
  ctx.fillStyle = 'rgba(90,60,30,0.55)';
  for (let i = 0; i < 6; i++) ctx.fillRect(124, 252 + i * 11, 180 + ((i * 53) % 90), 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(560, 250, 120, 70);
  const rnd = THREE.MathUtils.seededRandom; rnd(7);
  ctx.fillStyle = '#1a1a1a';
  for (let x = 568; x < 672;) { const w = 1 + Math.floor(rnd() * 3.5); if (rnd() > 0.45) ctx.fillRect(x, 256, w, 50); x += w + 1; }
  crimpBands(ctx, c);
}

function makeLabelTexture(c: Cfg) {
  const cv = document.createElement('canvas'); cv.width = cv.height = TEX;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = c.yellow; ctx.fillRect(0, 0, TEX, TEX);
  const s = TEX / HERO.w;
  ctx.save(); ctx.scale(s, s); ctx.translate(-HERO.x0, -HERO.y0); drawFront(ctx, c); ctx.restore();
  ctx.save(); ctx.translate(0, 1024); ctx.scale(s, s); ctx.translate(-HERO.x0, -HERO.y0); drawBack(ctx, c); ctx.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---------- Geometry: two sheets (front z>=0, back z<=0), one draw call ----------------------------
const smooth = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const tri = (x: number) => 1 - Math.abs(2 * (x - Math.floor(x)) - 1); // 0..1..0 per period

/** Column positions as distance from the nearest end in hero px: dense at the crimps/shoulders, sparse mid-body. */
function columns(): number[] {
  const half: number[] = [];
  for (let d = 0; d < 20; d += 2.5) half.push(d);
  for (let d = 20; d < 150; d += 3) half.push(d);
  for (let d = 150; d < HERO.w / 2; d += 15) half.push(d);
  const mid = HERO.w / 2;
  return [...half, mid, ...half.slice().reverse().map((d) => HERO.w - d)]; // x in hero px from the left end
}

function buildGeometry(c: Cfg) {
  const noise = makeNoise3(c.seed);
  const xs = columns(); // hero px from the left end
  // rows along a half cross-section: wall (3) + arc (7) + flat face (101) + arc (7) + wall (3)
  const WALL = 3, ARC = 7, FLAT = 101;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const L = c.length;

  for (const side of [1, -1]) { // +1 front, -1 back
    const base = pos.length / 3;
    let rowsPerCol = 0;
    for (const xpx of xs) {
      const d = Math.min(xpx, HERO.w - xpx); // px from the nearest end
      const sx = xpx < HERO.w / 2 ? -1 : 1;
      const k = smooth(c.shoulderPx[0], c.shoulderPx[1], d); // 0 = flat seal, 1 = full bar
      const t = c.sealHalfThickness + (c.halfThickness - c.sealHalfThickness) * k;
      const w = 0.5 + (c.bodyHalfHeight - 0.5) * smooth(c.taperPx[0], c.taperPx[1], d);
      const r = Math.min(c.edgeRadius, t * 0.95);
      const crimp = 1 - smooth(c.crimpPx - 6, c.crimpPx + 4, d);
      const shoulder = smooth(c.shoulderPx[0] - 5, c.shoulderPx[0] + 25, d) * (1 - smooth(c.shoulderPx[1], c.shoulderPx[1] + 40, d));
      const rows: [number, number][] = []; // (y, z) before extras, z >= 0
      for (let i = 0; i < WALL; i++) rows.push([-w, ((t - r) * i) / WALL]);
      for (let i = 0; i < ARC; i++) { const a = Math.PI + (Math.PI / 2) * (i / ARC); rows.push([-w + r + r * Math.cos(a), t - r - r * Math.sin(a)]); }
      for (let i = 0; i < FLAT; i++) rows.push([-w + r + (2 * (w - r) * i) / (FLAT - 1), t]);
      for (let i = 1; i <= ARC; i++) { const a = (Math.PI / 2) * (1 - i / ARC); rows.push([w - r + r * Math.cos(a), t - r + r * Math.sin(a)]); }
      for (let i = WALL - 1; i >= 0; i--) rows.push([w, ((t - r) * i) / WALL]);
      rowsPerCol = rows.length;
      for (const [y0, z0] of rows) {
        let x = -L / 2 + xpx * PX, y = y0, z = z0;
        // sawtooth edge on the last few px of each crimp
        const ph = c.teeth * (y + 0.5);
        x -= sx * c.toothDepth * tri(ph) * Math.max(0, 1 - d / 12);
        const facing = Math.min(z0 / t, 1) ** 4; // ~1 on the flat face, fading down the rounded edge
        // pleat ridges across the seal (front and back move together so the seal stays closed)
        let zOff = c.pleat * Math.sin(2 * Math.PI * ph) * crimp;
        // pillowing, shoulder wrinkles, fin seal, lumpiness: outward from the face only
        let out = c.dome * k * facing * (1 - (y / w) ** 2);
        out += c.wrinkles * shoulder * Math.sin((d * PX * 9 + Math.abs(y) * 11 + noise(x * 3, y * 3, side) * 2) * Math.PI) * smooth(0.15, 0.4, Math.abs(y));
        if (side < 0) {
          const fy = Math.abs(y - c.finY);
          out += c.finHeight * k * (1 - smooth(c.finHalfWidth, c.finHalfWidth + 0.012, fy)) * facing;
        }
        out += c.lumpiness * noise(x * 7, y * 7, z * 7 + side * 3) * k;
        z = side * (z + out) + zOff;
        pos.push(x, y, z);
        // planar UV from the hero frame; back is mirrored and lives in the lower half of the texture
        const hx = xpx / HERO.w, hy = 0.5 - y;
        const u = side > 0 ? hx : 1 - hx;
        const vpx = (side > 0 ? 0 : 1024) + Math.min(Math.max(hy, 0), 1) * BAND;
        uv.push(u, 1 - vpx / TEX);
      }
    }
    const R = rowsPerCol;
    for (let ci = 0; ci < xs.length - 1; ci++) for (let ri = 0; ri < R - 1; ri++) {
      const a = base + ci * R + ri, b = a + R, cc = b + 1, dd = a + 1;
      if (side > 0) idx.push(a, b, dd, b, cc, dd); else idx.push(a, dd, b, b, dd, cc);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function createFilmMaterial(c: Cfg) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: makeLabelTexture(c), roughness: c.roughness, metalness: 0,
    clearcoat: c.clearcoat, clearcoatRoughness: c.clearcoatRoughness, envMapIntensity: c.envIntensity,
    specularIntensity: c.specular,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uRoughVar: { value: c.roughnessVariation }, uCrinkle: { value: c.crinkleScale },
      uCrinkleBump: { value: c.crinkleBump }, uSat: { value: c.printSaturation }, uGain: { value: c.printGain },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj;
        ${NOISE_GLSL}
        uniform float uRoughVar, uCrinkle, uCrinkleBump, uSat, uGain;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = max(mix(vec3(l), diffuseColor.rgb, uSat), 0.0) * uGain; }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        // film streaks run along the packet (glossy lanes), crinkles scatter
        float streak = vnoise(vec3(vObj.x * 2.5, vObj.y * 38.0, vObj.z * 38.0));
        roughnessFactor = clamp(roughnessFactor + (streak - 0.5) * uRoughVar + (fbm(vObj * uCrinkle) - 0.5) * uRoughVar, 0.04, 1.0);`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n'
        + bumpGLSL('(fbm(vObj * uCrinkle) * 0.7 + vnoise(vec3(vObj.x * 4.0, vObj.y * 60.0, vObj.z * 60.0)) * 0.3) * uCrinkleBump * 0.004'));
  };
  return mat;
}

export function createCandy(_stage: Stage): THREE.Mesh {
  return new THREE.Mesh(buildGeometry(CANDY), createFilmMaterial(CANDY));
}
