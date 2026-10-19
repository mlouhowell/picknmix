// Daim 28 g bar in its wrapper. Family: wrapped packet (3D_CANDY_GUIDELINES §5).
// Modelled from assets/candies/daim/hero.png: the front silhouette is the hero alpha (baked by
// scripts/bake-outline.mjs), extruded into a pillow packet (bar inside, rounded long edges) that pinches into flat
// crimped seals at both ends. The print is recreated procedurally (lib/daim-print.ts): the hero is a
// reference-only brand image, so no photo pixels are used.
import * as THREE from 'three';
import { makeNoise3, type FloatConfig, type SceneConfig, type Stage } from '../candy-kit';
import { NOISE_GLSL, bumpGLSL } from '../lib/glsl';
import { sdfGeometry, type SDF } from '../lib/sdf';
import { decodeOutline, type OutlineFile } from '../lib/outline';
import { createDaimPrint, HERO_W, HERO_H, type PrintColors } from '../lib/daim-print';
import outlineFile from './daim.outline.json';

export const slug = 'daim';
export const REAL_SIZE_MM = 115; // wrapper, longest side (estimate, 3D_CANDY_GUIDELINES §1 table; confirm against a real bar)
export const ARIA_LABEL = 'A wrapped Daim chocolate bar, red with the blue Daim logo, slowly tumbling';

// hero px -> world: silhouette height 1, origin at the alpha bbox centre (bbox 24..775 x 24..310)
const HERO = { cx: 399.5, cy: 167, pxPerUnit: 287 };

export const CANDY = {
  // Shape (world units: packet height = 1, length ≈ 2.62 from the hero outline)
  thickness: 0.12, // half-thickness of the filled packet (bar ≈ 9 mm + film, at ≈ 44 mm per unit)
  edgeRound: 0.13, // how far in from the long edges the wrapper rounds over the bar
  sealThickness: 0.016, // half-thickness of the flat crimped seals
  crimpLeft: -1.061, // inner edge of the left seal (hero px 95)
  crimpRight: 1.106, // inner edge of the right seal (hero px 717)
  shoulder: 0.11, // length over which the packet pinches into each seal
  crinkle: 0.006, // film crinkles
  seed: 7,
  resolution: 0.0125, // mesh cell size (wrapped packet budget: ≤ 80k tris)

  // Print colours (sRGB), picked from hero.png regions, a touch deeper so ACES lands on the photo's mid-tones
  colors: {
    red: '#b20a24', redDark: '#86061a', redLight: '#e0363f', navy: '#0e2152', navyLight: '#2b4b92', white: '#f4f1ec',
    yellow: '#b86c00', orange: '#e86a0a', choc: '#b98656', chocDark: '#7a4a28', toffee: '#d0782e', panel: '#e9b4a4',
  } satisfies PrintColors,
  logoFont: 'bold 120px Georgia, "Times New Roman", serif', // stand-in for the Daim logotype

  // Film
  roughness: 0.15, // glossy film: tight highlights instead of a milky env haze
  specularIntensity: 0.35,
  clearcoat: 0.2,
  envMapIntensity: 0.2,
  clearcoatRoughness: 0.12,
  crimpRoughness: 0.5, // the seals are pressed, more matte
  pleatPitch: 0.031, // seal pleats (hero: one every ~9 px)
  pleatBump: 0.9,
  crinkleBump: 0.45,
};
type Cfg = typeof CANDY;

export const SCENE: SceneConfig = { fov: 28, framePadding: 1.12, exposure: 0.92 };

export const FLOAT: FloatConfig = {
  seed: 3,
  speed: 1, loopSeconds: 22, spinTurns: 2, precessTurns: 1,
  drift: 0.05, driftCycles: [1, 2, 1],
  staticTime: 16.0,
};

const smooth = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

function makePacketSDF(cfg: Cfg): SDF {
  const outline = decodeOutline(outlineFile as OutlineFile);
  const noise = makeNoise3(cfg.seed);
  const zFar = cfg.thickness + cfg.crinkle + 0.02;
  return (x, y, z) => {
    const d2 = outline.sdf(x, y);
    if (d2 > 0.04) return d2; // far outside: only the sign matters (build-time budget)
    if (Math.abs(z) > zFar) return Math.max(d2, Math.abs(z) - zFar + 0.01);
    // filled body: rounds over the bar near the long edges, pinches into the seals at both ends
    const fill = smooth(cfg.crimpLeft, cfg.crimpLeft + cfg.shoulder, x) * (1 - smooth(cfg.crimpRight - cfg.shoulder, cfg.crimpRight, x));
    const round = Math.sqrt(Math.min(Math.max(-d2 / cfg.edgeRound, 0), 1));
    let h = Math.max(cfg.thickness * round * fill, cfg.sealThickness);
    h += cfg.crinkle * fill * (noise(x * 7, y * 7, z > 0 ? 1 : 9) * 0.7 + noise(x * 17 + 3, y * 17, z > 0 ? 4 : 12) * 0.3);
    return Math.max(d2, Math.abs(z) - h);
  };
}

function createWrapperMaterial(cfg: Cfg) {
  const print = createDaimPrint(cfg.colors, cfg.logoFont);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: cfg.roughness, metalness: 0, specularIntensity: cfg.specularIntensity,
    clearcoat: cfg.clearcoat, clearcoatRoughness: cfg.clearcoatRoughness, envMapIntensity: cfg.envMapIntensity,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uPrint: { value: print },
      uHero: { value: new THREE.Vector4(HERO.cx, HERO.cy, HERO.pxPerUnit, 0) },
      uHeroSize: { value: new THREE.Vector2(HERO_W, HERO_H) },
      uCrimp: { value: new THREE.Vector2(cfg.crimpLeft, cfg.crimpRight) },
      uCrimpRough: { value: cfg.crimpRoughness }, uPleat: { value: cfg.pleatPitch },
      uPleatBump: { value: cfg.pleatBump }, uCrinkleBump: { value: cfg.crinkleBump },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj;
        ${NOISE_GLSL}
        uniform sampler2D uPrint; uniform vec4 uHero; uniform vec2 uHeroSize, uCrimp;
        uniform float uCrimpRough, uPleat, uPleatBump, uCrinkleBump;
        float seal() { return max(smoothstep(uCrimp.x, uCrimp.x - 0.01, vObj.x), smoothstep(uCrimp.y, uCrimp.y + 0.01, vObj.x)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          // planar print projection in hero px; back half of the canvas, mirrored, for the back face
          vec2 hp = vec2(vObj.x * uHero.z + uHero.x, uHero.y - vObj.y * uHero.z) / uHeroSize;
          vec2 uv = vObj.z >= 0.0 ? vec2(hp.x, hp.y * 0.5) : vec2(1.0 - hp.x, 0.5 + hp.y * 0.5);
          diffuseColor.rgb = texture2D(uPrint, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor + (vnoise(vObj * 11.0) - 0.5) * 0.16, uCrimpRough, seal());`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + bumpGLSL(
        `seal() * (0.5 + 0.5 * cos(6.2832 * vObj.y / uPleat)) * uPleatBump * 0.004
         + (1.0 - seal()) * fbm(vObj * vec3(5.0, 9.0, 5.0)) * uCrinkleBump * 0.006`))
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        material.clearcoat *= 1.0 - 0.7 * seal();`);
  };
  mat.addEventListener('dispose', () => print.dispose()); // the print is a uniform, not a material map
  return mat;
}

export function createCandy(_stage: Stage): THREE.Mesh {
  const o = outlineFile as OutlineFile;
  const halfW = o.aspect / 2 + 0.03, z = CANDY.thickness + CANDY.crinkle + 0.04;
  const geo = sdfGeometry(makePacketSDF(CANDY), [-halfW, -0.56, -z], [halfW, 0.56, z], CANDY.resolution);
  return new THREE.Mesh(geo, createWrapperMaterial(CANDY));
}
