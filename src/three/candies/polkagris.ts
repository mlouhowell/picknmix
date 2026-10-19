// Polkagris pillow (port of assets/3d/polkagris/index.html; same configs, same look).
// Family: chalky / hard (3D_CANDY_GUIDELINES §5). Procedural superquadric + twist + lumps, stripe texture,
// powder material.
import * as THREE from 'three';
import { makeNoise3, mulberry32, type FloatConfig, type SceneConfig, type Stage } from '../candy-kit';
import { NOISE_GLSL, bumpGLSL } from '../lib/glsl';

export const slug = 'polkagris';
export const REAL_SIZE_MM = 20; // bite-size pillow piece, longest side (estimate, PLAN §1 table)
export const ARIA_LABEL = 'A chalky, sugar-dusted peppermint pillow candy with soft raspberry stripes, slowly spinning';

export const CANDY = {
  // Shape (world units). Width : length ≈ 1 : 1.3
  width: 1.0, // across the pillow
  length: 1.32, // end to end
  squareness: 0.84, // cross-section: 1 = round, lower = squarer "pillow" sides
  bluntness: 0.66, // lengthwise profile: 1 = egg/ellipsoid, lower = fuller barrel with rounded ends
  endPinch: 0.38, // how much the ends flatten into a pinched ridge (hand-cut look)
  twist: 0.6, // radians of twist from end to end
  lumpiness: 0.06, // irregular hand-made bumps (fraction of size)
  lumpScale: 1.6, // size of the bumps (higher = smaller, busier bumps)
  seed: 7, // change for a differently shaped piece
  segments: [192, 128] as [number, number], // [around, along] mesh resolution

  // Colours (sRGB hex)
  bodyColor: '#f3ebdf', // creamy off-white
  stripeColor: '#c22846', // raspberry / peppermint red stripe centre
  stripeEdgeColor: '#93122f', // slightly deeper stripe edges
  powderColor: '#fdfbf7', // icing-sugar dusting

  // Stripes (run lengthwise, follow the twist)
  stripeCount: 5,
  stripeWidth: 0.045, // fraction of the circumference per stripe
  stripeJitter: 0.12, // 0 = perfectly even spacing/width, higher = more hand-made
  stripeFuzz: 0.006, // soft, grainy stripe edges (fraction of circumference)

  // Chalky powder surface
  powder: 0.12, // how much the dusting veils the colours (0–1)
  stripePowder: 0.6, // powder multiplier on the red stripes (<1 lets the red read through)
  grain: 0.7, // strength of the fine sugar-grain bump
  grainScale: 70, // grain frequency (higher = finer)
  roughness: 1.0,
  sheen: 0.5, // soft velvety rim light typical of powdered surfaces
  warmth: 0.05, // faint warm glow in shadows (fake subsurface)
};
type Cfg = typeof CANDY;

export const SCENE: SceneConfig = { fov: 28, framePadding: 1.12, exposure: 0.92 };

export const FLOAT: FloatConfig = {
  seed: 1, speed: 1, loopSeconds: 22, spinTurns: 2, precessTurns: 1,
  drift: 0.05, driftCycles: [1, 2, 1],
  staticTime: 9.2, // pose shown with prefers-reduced-motion
};

// ---------- Pillow geometry (procedural superquadric + twist + lumps) -------
function createPillowGeometry(cfg: Cfg) {
  const [nu, nv] = cfg.segments;
  const noise = makeNoise3(cfg.seed);
  const R = cfg.width / 2, H = cfg.length / 2;
  const spow = (b: number, e: number) => Math.sign(b) * Math.pow(Math.abs(b), e);

  // Map u (0..1) to angle so equal u steps = equal arc length around the
  // squarish cross-section (keeps stripe widths even on flats and corners).
  const LUT_N = 2048, lut = new Float32Array(LUT_N + 1);
  {
    let acc = 0, px = spow(1, cfg.squareness), pz = 0;
    for (let k = 1; k <= LUT_N; k++) {
      const th = (k / LUT_N) * Math.PI * 2;
      const qx = spow(Math.cos(th), cfg.squareness), qz = spow(Math.sin(th), cfg.squareness);
      acc += Math.hypot(qx - px, qz - pz); lut[k] = acc; px = qx; pz = qz;
    }
    for (let k = 0; k <= LUT_N; k++) lut[k]! /= acc;
  }
  function angleFor(u: number) {
    const w = ((u % 1) + 1) % 1; let lo = 0, hi = LUT_N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lut[m]! < w) lo = m; else hi = m; }
    const f = (w - lut[lo]!) / Math.max(lut[hi]! - lut[lo]!, 1e-9);
    return ((lo + f) / LUT_N) * Math.PI * 2 + Math.floor(u) * Math.PI * 2;
  }

  // Surface point for u (around, 0..1) and v (end to end, 0..1)
  function point(u: number, v: number, out: THREE.Vector3) {
    const a = v * Math.PI; // 0 = bottom end, PI = top end
    const s = spow(Math.sin(a), cfg.bluntness); // radial scale along the length
    const y = -spow(Math.cos(a), cfg.bluntness) * H;
    const t = y / H; // -1..1
    const th = angleFor(u) + cfg.twist * t * 0.5;
    const x = spow(Math.cos(th), cfg.squareness) * R * s;
    let z = spow(Math.sin(th), cfg.squareness) * R * s;
    z *= 1 - cfg.endPinch * Math.pow(Math.abs(t), 3); // pinched ridge at the ends
    // low-frequency lumps (scaled radially from the centre axis)
    const k = cfg.lumpScale;
    const n = noise(x * k + 11, y * k + 3, z * k + 5) * 0.7 + noise(x * k * 2.3, y * k * 2.3, z * k * 2.3) * 0.3;
    const d = 1 + n * cfg.lumpiness * 2;
    return out.set(x * d, y * (1 + n * cfg.lumpiness * 0.6), z * d);
  }

  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
  const p = new THREE.Vector3(), pu = new THREE.Vector3(), pv = new THREE.Vector3(), n = new THREE.Vector3();
  const e = 1e-3;
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      point(u, v, p);
      // analytic-ish normal from finite differences (seam-free, pole-safe)
      const vc = Math.min(Math.max(v, 4 * e), 1 - 4 * e);
      point(u + e, vc, pu).sub(point(u - e, vc, n));
      point(u, vc + e, pv).sub(point(u, vc - e, n));
      n.crossVectors(pu, pv).normalize();
      if (j === 0) n.set(0, -1, 0); else if (j === nv) n.set(0, 1, 0);
      pos.push(p.x, p.y, p.z); nrm.push(n.x, n.y, n.z); uv.push(u, v);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + nu + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// ---------- Stripe texture (u = around, v = along) --------------------------
function createStripeTexture(cfg: Cfg, maxAniso: number) {
  const W = 2048, Hh = 512;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
  const ctx = cv.getContext('2d')!, img = ctx.createImageData(W, Hh);
  const rnd = mulberry32(cfg.seed * 977 + 1), noise = makeNoise3(cfg.seed + 31);
  const body = new THREE.Color(cfg.bodyColor), core = new THREE.Color(cfg.stripeColor), edge = new THREE.Color(cfg.stripeEdgeColor);
  // hand-made irregular stripe positions & widths
  const stripes = Array.from({ length: cfg.stripeCount }, (_, k) => ({
    c: (k + 0.5 + (rnd() - 0.5) * cfg.stripeJitter) / cfg.stripeCount,
    w: (cfg.stripeWidth * (1 + (rnd() - 0.5) * cfg.stripeJitter * 1.5)) / 2,
    ph: rnd() * 100,
  }));
  const sm = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  const col = new THREE.Color(), out = { r: 0, g: 0, b: 0 };
  for (let y = 0; y < Hh; y++) {
    const v = y / (Hh - 1);
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      let cov = 0, edgeMix = 0;
      for (const s of stripes) {
        // stripe centre wanders slightly along the length; width breathes
        const wob = noise(s.ph, v * 5, 0) * 0.004 + noise(s.ph, v * 19, 7) * 0.0012;
        let d = Math.abs(u - s.c - wob); d = Math.min(d, 1 - d);
        const w = s.w * (1 + noise(s.ph + 5, v * 9, 3) * 0.25);
        const grainEdge = (rnd() - 0.5) * cfg.stripeFuzz * 1.2; // sugary, speckled edge
        const c = 1 - sm(w - cfg.stripeFuzz, w + cfg.stripeFuzz, d + grainEdge);
        if (c > cov) { cov = c; edgeMix = sm(w * 0.15, w * 0.95, d); }
      }
      col.copy(core).lerp(edge, edgeMix * 0.85);
      col.lerp(body, 1 - cov).getRGB(out, THREE.SRGBColorSpace); // canvas pixels are sRGB
      const i = (y * W + x) * 4;
      img.data[i] = out.r * 255; img.data[i + 1] = out.g * 255; img.data[i + 2] = out.b * 255; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAniso; tex.flipY = false;
  return tex;
}

// ---------- Chalky powder material ----------------------------------------
function createPowderMaterial(cfg: Cfg, map: THREE.Texture) {
  const mat = new THREE.MeshPhysicalMaterial({
    map, roughness: cfg.roughness, metalness: 0,
    sheen: cfg.sheen, sheenRoughness: 0.9, sheenColor: new THREE.Color('#ffffff'),
    envMapIntensity: 0.45,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uPowder: { value: cfg.powder }, uStripePowder: { value: cfg.stripePowder }, uGrain: { value: cfg.grain }, uGrainScale: { value: cfg.grainScale },
      uWarmth: { value: cfg.warmth }, uPowderColor: { value: new THREE.Color(cfg.powderColor) },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj;
        ${NOISE_GLSL}
        uniform float uPowder, uStripePowder, uGrain, uGrainScale, uWarmth;
        uniform vec3 uPowderColor;`)
      // powder veils the colours with speckled icing sugar
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float s1 = vnoise(vObj * uGrainScale * 2.6);
          float s2 = vnoise(vObj * 7.0);
          float amt = uPowder * (0.45 + 0.55 * s1) * (0.75 + 0.5 * s2);
          float stripeMask = clamp((diffuseColor.r - diffuseColor.g) * 2.5, 0.0, 1.0);  // red areas
          amt *= mix(1.0, uStripePowder, stripeMask);
          diffuseColor.rgb = mix(diffuseColor.rgb, uPowderColor, clamp(amt, 0.0, 1.0));
          diffuseColor.rgb += (step(0.84, vnoise(vObj * uGrainScale * 4.5)) - step(vnoise(vObj * uGrainScale * 3.7 + 17.0), 0.12) * 0.6) * 0.05;  // tiny bright crystals
        }`)
      // fine sugar-grain bump from object-space noise
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + bumpGLSL(
        '(vnoise(vObj * uGrainScale) * 0.6 + vnoise(vObj * uGrainScale * 2.3) * 0.4 + vnoise(vObj * uGrainScale * 0.25) * 0.35) * uGrain * 0.005'))
      // faint warm glow (fake subsurface) lifting the shadow side
      .replace('#include <opaque_fragment>', `
        outgoingLight += diffuseColor.rgb * vec3(1.0, 0.82, 0.74) * uWarmth;
        #include <opaque_fragment>`);
  };
  return mat;
}

export function createCandy(stage: Stage): THREE.Mesh {
  const geo = createPillowGeometry(CANDY);
  const mat = createPowderMaterial(CANDY, createStripeTexture(CANDY, stage.renderer.capabilities.getMaxAnisotropy()));
  return new THREE.Mesh(geo, mat);
}
