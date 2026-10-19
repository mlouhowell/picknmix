// Pastellfiskar (Malaco pastel fish): green translucent wine-gum jelly, frosted gloss, embossed "Malaco".
// Family: clear gummy / jelly (3D_CANDY_GUIDELINES §5). Modelled from assets/candies/pastellfiskar/hero.png:
// the side silhouette is the hero alpha (scripts/bake-outline.mjs), extruded into a plump moulded body.
// One 2D relief field (canvas: script lettering, dorsal knobs, tail-fin ridges, gill arc, mouth crease) drives
// both the geometry (coarse, so it reads in silhouette and shading) and a bump texture (crisp edges).
// Translucency is faked in the shader (no transmission pass: the canvas is transparent, so real transmission
// would refract nothing): thin rims and the tail glow bright yellow-green, thick parts absorb to deep green.
import * as THREE from 'three';
import { makeNoise3, type FloatConfig, type SceneConfig, type Stage } from '../candy-kit';
import { NOISE_GLSL, bumpGLSL } from '../lib/glsl';
import { sdfGeometry, type SDF } from '../lib/sdf';
import { decodeOutline, type Outline, type OutlineFile } from '../lib/outline';
import outlineFile from './pastellfiskar.outline.json';

export const slug = 'pastellfiskar';
export const REAL_SIZE_MM = 50; // fish length, nose to tail (estimate: Malaco pastellfiskar ~5 cm; confirm against a real piece)
export const ARIA_LABEL = 'A green Malaco pastel fish jelly candy, embossed with the Malaco name, slowly tumbling';

export const CANDY = {
  // Shape (world units: fish height = 1, length ≈ 2.72 from the hero outline)
  frontThickness: 0.12, // half-thickness of the moulded side at the rim
  backThickness: 0.12, // the poured side is just as plump (it is moulded both sides)
  bevel: 0.16, // pillowy rounded rim
  bellyDome: 0.9, // body centre is this fraction plumper than the rim thickness
  tailThin: 0.45, // tail is this fraction thinner than the body
  relief: 0.042, // raised moulded detail (lettering, knobs, fin ridges)
  grooves: 0.025, // pressed-in detail (mouth crease, gill line)
  reliefSoftness: 4,
  letterStroke: 7, // px of the 150px font: thickens the script strokes // blur (px of the 1024-wide relief raster): moulded, not engraved
  letterFont: '700 150px "Brush Script MT", "SignPainter", "Snell Roundhand", cursive', // stand-in for the Malaco script logotype
  // lettering box from hero px (753 wide): "Malaco" 161–565 x, 54–177 y, baseline tilts down to the tail
  letterBox: { cx: 0.02, cy: 0.15, w: 1.62, h: 0.42, rotDeg: -6 },
  lumpiness: 0.006,
  seed: 5,
  resolution: 0.0165, // mesh cell size (long fish: coarser cells keep ≤ 60k tris; fine detail is in the bump map)

  // Colours (sRGB), sampled from hero.png (opaque pixels, luminance percentiles)
  deepColor: '#284800', // thick body, absorbed (hero p02–p05 #456f00..#4a7907, a touch deeper for ACES)
  bodyColor: '#628600', // mid body (hero p30–p50 #729103..#83a70a)
  glowColor: '#b2cc00', // thin rims / tail, light shining through (hero p70–p85 #b4c103..#c7dc5a)
  frostColor: '#e9f2a8', // frosted highlight on the top back (hero p95 #e6ecb0)

  // Jelly surface
  roughness: 0.34, // frosted, not wet-glossy (hero highlights are broad and soft)
  clearcoat: 0.12,
  specularTint: '#dfe98a', // highlight tint (hero: yellow-white glints, never blue-white)
  clearcoatRoughness: 0.3,
  glow: 0.12, // fake translucency (self-lit thin parts)
  wrinkleScale: 30, // fine moulding wrinkles across the flank
  wrinkleBump: 4.5,
};
type Cfg = typeof CANDY;

export const SCENE: SceneConfig = { fov: 28, framePadding: 1.12, exposure: 0.92 };

export const FLOAT: FloatConfig = {
  seed: 4, // embossed side faces the camera for ~83% of the loop (search over seeds 1–9, review/pastellfiskar/CHECKLIST.md)
  speed: 1, loopSeconds: 22, spinTurns: 2, precessTurns: 1,
  drift: 0.05, driftCycles: [1, 2, 1],
  staticTime: 19.4, // reduced-motion still: side 0.93 toward camera, upright 0.98, level 0.91, head left like the hero
};

/** Relief raster: R = raised, G = pressed-in. Drawn in world units (y up). Browser only. */
function reliefField(cfg: Cfg, outline: Outline) {
  const W = 1024, hw = outline.halfW, hh = outline.halfH, H = Math.round((W * hh) / hw);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.filter = `blur(${cfg.reliefSoftness}px)`;
  const s = W / (2 * hw);
  ctx.setTransform(s, 0, 0, -s, W / 2, H / 2); // world -> px
  ctx.globalCompositeOperation = 'lighter';

  // "Malaco" script across the flank
  const L = cfg.letterBox;
  ctx.save();
  ctx.translate(L.cx, L.cy); ctx.rotate((L.rotDeg * Math.PI) / 180); ctx.scale(1, -1);
  ctx.font = cfg.letterFont; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const m = ctx.measureText('Malaco'), gh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  ctx.scale(L.w / m.width, L.h / gh);
  ctx.fillStyle = ctx.strokeStyle = '#f00'; ctx.lineWidth = cfg.letterStroke; ctx.lineJoin = 'round';
  const ty = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.fillText('Malaco', 0, ty); ctx.strokeText('Malaco', 0, ty); // stroke fattens the script to the hero's chunky moulded letters
  ctx.restore();

  const topEdge = (x: number) => { let y = hh; while (y > -hh && outline.sdf(x, y) > 0) y -= 0.004; return y; };
  // dorsal knobs along the back (hero px 258–484 x, just under the top edge)
  ctx.fillStyle = '#f00';
  for (let x = -0.44; x <= 0.52; x += 0.085) {
    const y = topEdge(x) - 0.07;
    ctx.beginPath(); ctx.ellipse(x, y, 0.034, 0.026, 0.2, 0, Math.PI * 2); ctx.fill();
  }
  // tail-fin ridges fanning out from the wrist of the tail (hero px > 592)
  ctx.strokeStyle = '#f00'; ctx.lineWidth = 0.032; ctx.lineCap = 'round';
  for (const y0 of [-0.2, -0.12, -0.04, 0.04, 0.12, 0.2]) {
    ctx.beginPath(); ctx.moveTo(0.98, y0 * 0.7); ctx.quadraticCurveTo(1.15, y0 * 1.0, 1.32, y0 * 1.45); ctx.stroke();
  }
  // gill arc behind the head (hero px ~156 x) and mouth crease at the nose
  ctx.strokeStyle = '#0f0'; ctx.lineWidth = 0.022;
  ctx.beginPath(); ctx.moveTo(-0.86, 0.3); ctx.quadraticCurveTo(-0.74, 0.02, -0.88, -0.28); ctx.stroke();
  ctx.lineWidth = 0.03;
  ctx.beginPath(); ctx.moveTo(-1.42, 0.03); ctx.quadraticCurveTo(-1.3, 0.0, -1.2, 0.05); ctx.stroke();
  // eye: a soft dimple ringed by a low rim
  ctx.fillStyle = '#0f0'; ctx.beginPath(); ctx.arc(-1.08, 0.13, 0.035, 0, Math.PI * 2); ctx.fill();

  const px = ctx.getImageData(0, 0, W, H).data;
  const sample = (x: number, y: number, ch: 0 | 1) => {
    const u = (x / (2 * hw) + 0.5) * (W - 1), v = (0.5 - y / (2 * hh)) * (H - 1);
    if (u < 0 || v < 0 || u >= W - 1 || v >= H - 1) return 0;
    const xi = Math.floor(u), yi = Math.floor(v), fx = u - xi, fy = v - yi;
    const a = (i: number, j: number) => px[(j * W + i) * 4 + ch]! / 255;
    return (a(xi, yi) * (1 - fx) + a(xi + 1, yi) * fx) * (1 - fy) + (a(xi, yi + 1) * (1 - fx) + a(xi + 1, yi + 1) * fx) * fy;
  };
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  return { raised: (x: number, y: number) => sample(x, y, 0), pressed: (x: number, y: number) => sample(x, y, 1), tex };
}

const bump = (dx: number, dy: number, rx: number, ry: number) => {
  const q = (dx / rx) ** 2 + (dy / ry) ** 2;
  return q >= 1 ? 0 : (1 - q) ** 2;
};

function makeFishSDF(cfg: Cfg, outline: Outline, relief: ReturnType<typeof reliefField>): SDF {
  const noise = makeNoise3(cfg.seed);
  const r = cfg.bevel;
  // body is plumpest just behind the head, thinning into the tail
  const body = (x: number, y: number) => {
    const tail = Math.min(Math.max((x - 0.75) / 0.4, 0), 1);
    return (1 - cfg.tailThin * tail) * (1 + cfg.bellyDome * bump(x + 0.15, y + 0.02, 1.15, 0.6));
  };
  const front = (x: number, y: number) =>
    cfg.frontThickness * body(x, y) + cfg.relief * relief.raised(x, y) - cfg.grooves * relief.pressed(x, y);
  const back = (x: number, y: number) => cfg.backThickness * body(x, y);
  const zFar = Math.max(cfg.frontThickness, cfg.backThickness) * (1 + cfg.bellyDome) + cfg.relief + 0.02;
  return (x, y, z) => {
    const d2 = outline.sdf(x, y);
    if (d2 > r + 0.03) return d2; // far outside: only the sign matters to the mesher
    if (Math.abs(z) > zFar) return Math.max(d2, Math.abs(z) - zFar + 0.01);
    const hz = z >= 0 ? front(x, y) : back(x, y);
    const wx = d2 + r, wy = Math.abs(z) - (hz - r);
    let d = Math.min(Math.max(wx, wy), 0) + Math.hypot(Math.max(wx, 0), Math.max(wy, 0)) - r;
    d += cfg.lumpiness * (noise(x * 5 + 3, y * 5, z * 5) * 0.7 + noise(x * 12, y * 12 + 5, z * 12) * 0.3);
    return d;
  };
}

function createJellyMaterial(cfg: Cfg, outline: Outline, relief: ReturnType<typeof reliefField>) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: cfg.roughness, metalness: 0,
    clearcoat: cfg.clearcoat, clearcoatRoughness: cfg.clearcoatRoughness,
    sheen: 0.0, sheenRoughness: 0.6, sheenColor: new THREE.Color(cfg.frostColor),
    envMapIntensity: 0.32,
    // jelly: reflections pick up the body colour (most light is transmitted), keeps highlights from going grey
    specularColor: new THREE.Color(cfg.specularTint), specularIntensity: 0.6,
  });
  mat.onBeforeCompile = (shader) => {
    const C = (h: string) => new THREE.Color(h);
    Object.assign(shader.uniforms, {
      uDeep: { value: C(cfg.deepColor) }, uBody: { value: C(cfg.bodyColor) }, uGlowC: { value: C(cfg.glowColor) },
      uFrost: { value: C(cfg.frostColor) }, uGlow: { value: cfg.glow },
      uRelief: { value: relief.tex }, uHalf: { value: new THREE.Vector2(outline.halfW, outline.halfH) },
      uWrinkle: { value: cfg.wrinkleScale }, uWrinkleBump: { value: cfg.wrinkleBump },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vObjN; varying float vAO; varying float vEdge; varying float vThin; varying float vCore;\nattribute float aAO; attribute float aEdge; attribute float aThin; attribute float aCore;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position; vObjN = normal; vAO = aAO; vEdge = aEdge; vThin = aThin; vCore = aCore;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj; varying vec3 vObjN; varying float vAO; varying float vEdge; varying float vThin; varying float vCore;
        ${NOISE_GLSL}
        uniform vec3 uDeep, uBody, uGlowC, uFrost; uniform float uGlow, uWrinkle, uWrinkleBump;
        uniform sampler2D uRelief; uniform vec2 uHalf;
        float gThin;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          // light travels through thin jelly (rim, tail, fins) and is absorbed in the thick body
          float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0);
          gThin = clamp(vThin + fres * 0.2, 0.0, 1.0);
          // thick core absorbs to deep olive (more so low in the belly); thin parts glow yellow-green
          vec3 c = mix(uBody, uDeep, vCore * (0.85 - 0.45 * smoothstep(-0.3, 0.4, vObj.y)));
          c = mix(c, uGlowC, smoothstep(0.35, 1.0, gThin));
          // refraction mottling: light focused and scattered unevenly through the jelly (hero: olive pools + yellow glows)
          float caus = fbm(vObj * vec3(2.6, 4.2, 3.0) + 7.0);
          c = mix(c, uDeep, smoothstep(0.45, 0.75, caus) * 0.55 * (0.3 + vCore));
          c = mix(c, uGlowC, smoothstep(0.5, 0.8, 1.0 - caus) * 0.22);
          c *= 0.95 + 0.1 * vnoise(vObj * 14.0);                         // slightly uneven pour
          // recesses round the lettering read deeper and more saturated (hero: #517d01 in the script)
          c = mix(c * c * 1.2, c, smoothstep(0.05, 0.55, vAO));
          diffuseColor.rgb = c;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (vnoise(vObj * 11.0) - 0.5) * 0.16, 0.0, 1.0);`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + bumpGLSL(`(
          (texture2D(uRelief, vObj.xy / (2.0 * uHalf) + 0.5).r - texture2D(uRelief, vObj.xy / (2.0 * uHalf) + 0.5).g) * 0.012
            * smoothstep(0.2, 0.6, vObjN.z)
          + (vnoise(vec3(vObj.x * uWrinkle * 0.35, vObj.y * uWrinkle, vObj.z * uWrinkle)) * 0.7 + vnoise(vObj * uWrinkle * 2.3) * 0.3)
            * uWrinkleBump * 0.0016)`))
      .replace('#include <opaque_fragment>', `
        outgoingLight += diffuseColor.rgb * uGlowC * uGlow * (0.35 + gThin);  // fake translucency glow
        #include <opaque_fragment>`);
  };
  return mat;
}

export function createCandy(_stage: Stage): THREE.Mesh {
  const outline = decodeOutline(outlineFile as OutlineFile);
  const relief = reliefField(CANDY, outline);
  const halfW = outline.halfW + 0.03, halfH = outline.halfH + 0.03;
  const zMax = Math.max(CANDY.frontThickness, CANDY.backThickness) * (1 + CANDY.bellyDome) + CANDY.relief + 0.05;
  const geo = sdfGeometry(makeFishSDF(CANDY, outline, relief), [-halfW, -halfH, -zMax], [halfW, halfH, zMax], CANDY.resolution);
  // thinness: 1 at the rim, 0 deep inside the body (fake translucency); the tail counts as thin
  const p = geo.attributes.position!, thin = new Float32Array(p.count), core = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), inside = -outline.sdf(x, y);
    core[i] = Math.min(Math.max((inside - 0.08) / 0.25, 0), 1) * (1 - Math.min(Math.max((x - 0.7) / 0.3, 0), 1));
    thin[i] = Math.max(1 - Math.min(Math.max(inside / 0.09, 0), 1), Math.min(Math.max((x - 0.9) / 0.4, 0), 1) * 0.6);
  }
  geo.setAttribute('aThin', new THREE.BufferAttribute(thin, 1));
  geo.setAttribute('aCore', new THREE.BufferAttribute(core, 1));
  return new THREE.Mesh(geo, createJellyMaterial(CANDY, outline, relief));
}
