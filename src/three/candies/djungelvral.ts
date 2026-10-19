// Djungelvrål salty licorice monkey (port of assets/3d/djungelvral/index.html; same configs, same look).
// Family: licorice with salmiak grains (3D_CANDY_GUIDELINES §5). SDF blobs + surface nets, salt shader.
import * as THREE from 'three';
import { makeNoise3, KEY_LIGHT_POS, type FloatConfig, type SceneConfig, type Stage } from '../candy-kit';
import { NOISE_GLSL, bumpGLSL } from '../lib/glsl';
import { prim, smin, sdfGeometry, type Prim, type SDF } from '../lib/sdf';

export const slug = 'djungelvral';
export const REAL_SIZE_MM = 22; // monkey, longest side (estimate, PLAN §1 table)
export const ARIA_LABEL = 'A Djungelvrål salty liquorice monkey dusted with salmiak salt, slowly tumbling';

export const CANDY = {
  // Shape: crouching monkey in profile, built from smooth-blended blobs (signed distance field)
  // Units: ~1 tall. Edit MONKEY_PARTS below to change the pose.
  blend: 0.10, // how soft/moulded the joins are (smooth-min radius)
  creaseBlend: 0.025, // tighter join between chin and arms so the head reads
  depthScale: 1.0, // scale the thickness (z)
  lumpiness: 0.012, // moulded irregularity
  seed: 4, // shape/salt noise seed
  resolution: 0.011, // mesh cell size (smaller = finer, slower to build)

  // Colours (sRGB hex)
  licoriceColor: '#151316', // near-black, slightly warm liquorice
  saltColor: '#eceef0', // white/silver salmiak salt
  saltShadeColor: '#9a9aa2', // greyer, thinner salt grains

  // Salt coating
  saltCoverage: 0.29, // overall amount of salt (0 = bare, 1 = fully coated)
  saltPatchScale: 4.4, // size of the patches (higher = smaller patches)
  saltStreaks: 0.8, // streaky gaps where the black shows through
  saltUpBias: 0.22, // thicker on top & bottom faces (sides stay streaky)
  saltEdgeBias: 0.40, // thicker on convex edges
  saltCavityBias: 0.45, // thinner in creases
  saltGrainScale: 150, // salt grain frequency
  saltBump: 1.6, // granular relief strength
  sparkle: 1.4, // tiny glints on salt crystals
  // Liquorice "gummy" satin underneath
  licoriceRoughness: 0.36,
  clearcoat: 0.25,
  clearcoatRoughness: 0.22,
};
type Cfg = typeof CANDY;

export const SCENE: SceneConfig = { fov: 28, framePadding: 1.12, exposure: 0.92 };

export const FLOAT: FloatConfig = {
  seed: 6, // 6 shows the monkey's profile well
  speed: 1, loopSeconds: 22, spinTurns: 2, precessTurns: 1,
  drift: 0.05, driftCycles: [1, 2, 1],
  staticTime: 18.0, // pose shown with prefers-reduced-motion
};

// Monkey blobs (x → tail/back, -x → face; y up; z thickness). Seated on a flared base.
// 'body' parts blend softly; 'head' joins arms with a tighter crease.
const MONKEY_PARTS: Prim[] = [
  { t: 'roundbox', c: [0.08, -0.45, 0], h: [0.50, 0.035, 0.19], r: 0.075, g: 'body' }, // base slab (pillowy)
  { t: 'ellipsoid', c: [0.56, -0.40, 0], r: [0.22, 0.10, 0.26], g: 'body' }, // flared base end (feet/tail)
  { t: 'ellipsoid', c: [0.33, -0.20, 0], r: [0.26, 0.22, 0.25], g: 'body' }, // haunch
  { t: 'capsule', a: [0.24, -0.08, 0], b: [-0.10, 0.14, 0], r: 0.275, g: 'body' }, // big hunched back
  { t: 'capsule', a: [0.20, -0.24, 0.12], b: [-0.30, -0.26, 0.12], r: 0.105, g: 'body' }, // knees/shins tucked
  { t: 'capsule', a: [0.20, -0.24, -0.12], b: [-0.30, -0.26, -0.12], r: 0.105, g: 'body' },
  { t: 'capsule', a: [-0.10, 0.02, 0.13], b: [-0.40, -0.30, 0.11], r: 0.09, g: 'body' }, // arms down to the base
  { t: 'capsule', a: [-0.10, 0.02, -0.13], b: [-0.40, -0.30, -0.11], r: 0.09, g: 'body' },
  { t: 'ellipsoid', c: [-0.30, 0.24, 0], r: [0.26, 0.24, 0.235], g: 'head' }, // big domed head, bowed forward
  { t: 'ellipsoid', c: [-0.37, 0.09, 0], r: [0.13, 0.13, 0.16], g: 'head' }, // blunt face tucked down
];

function makeMonkeySDF(cfg: Cfg): SDF {
  const noise = makeNoise3(cfg.seed);
  return (x, y, z) => {
    z /= cfg.depthScale;
    let body = 1e9, head = 1e9;
    for (const p of MONKEY_PARTS) {
      const d = prim(p, x, y, z);
      if (p.g === 'head') head = smin(head, d, cfg.blend * 0.8); else body = smin(body, d, cfg.blend);
    }
    let d = smin(body, head, cfg.creaseBlend);
    d += cfg.lumpiness * (noise(x * 5 + 3, y * 5, z * 5) * 0.7 + noise(x * 11, y * 11 + 7, z * 11) * 0.3);
    return d * Math.min(cfg.depthScale, 1);
  };
}

// ---------- Salted liquorice material --------------------------------------
function createSaltMaterial(cfg: Cfg) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: cfg.licoriceRoughness, metalness: 0,
    clearcoat: cfg.clearcoat, clearcoatRoughness: cfg.clearcoatRoughness,
    sheen: 0.4, sheenRoughness: 0.7, sheenColor: new THREE.Color('#ffffff'),
    envMapIntensity: 0.35,
  });
  mat.onBeforeCompile = (shader) => {
    const C = (h: string) => new THREE.Color(h);
    Object.assign(shader.uniforms, {
      uLicorice: { value: C(cfg.licoriceColor) }, uSalt: { value: C(cfg.saltColor) }, uSaltShade: { value: C(cfg.saltShadeColor) },
      uCoverage: { value: cfg.saltCoverage }, uPatch: { value: cfg.saltPatchScale }, uStreaks: { value: cfg.saltStreaks },
      uUp: { value: cfg.saltUpBias }, uEdgeB: { value: cfg.saltEdgeBias }, uCav: { value: cfg.saltCavityBias },
      uGrainScale: { value: cfg.saltGrainScale }, uBump: { value: cfg.saltBump }, uSparkle: { value: cfg.sparkle },
      uLicRough: { value: cfg.licoriceRoughness },
      uKeyDir: { value: KEY_LIGHT_POS.clone().normalize() },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vObjN; varying float vAO; varying float vEdge;\nattribute float aAO; attribute float aEdge;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position; vObjN = normal; vAO = aAO; vEdge = aEdge;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj; varying vec3 vObjN; varying float vAO; varying float vEdge;
        ${NOISE_GLSL}
        uniform vec3 uLicorice, uSalt, uSaltShade;
        uniform float uCoverage, uPatch, uStreaks, uUp, uEdgeB, uCav, uGrainScale, uBump, uSparkle, uLicRough;
        uniform vec3 uKeyDir;
        float gSalt;       // 0 = bare liquorice, 1 = thick salt (shared between shader chunks)
        float gGrain;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 p = vObj;
          float patches = fbm(p * uPatch);                                 // big uneven patches
          float streak = vnoise(vec3(p.x * 9.0, p.y * 3.0, p.z * 9.0));    // streaky bare runs
          gGrain = vnoise(p * uGrainScale);
          float D = uCoverage + (patches - 0.5) * 2.6 - (streak - 0.5) * uStreaks
                  + uUp * abs(vObjN.y) + uEdgeB * vEdge - uCav * (1.0 - vAO);
          float r = (vnoise(p * uGrainScale) * 0.6 + vnoise(p * uGrainScale * 2.3 + 9.1) * 0.4 - 0.5) * 1.3 + 0.5;
          gSalt = smoothstep(r - 0.035, r + 0.035, D);
          float thick = smoothstep(0.55, 1.1, D);
          float g2 = vnoise(p * uGrainScale * 1.7 + 3.3);
          vec3 saltCol = mix(uSaltShade, uSalt, clamp(0.25 + thick * 0.35 + g2 * 0.6 - (1.0 - gGrain) * 0.2, 0.0, 1.0));
          diffuseColor.rgb = mix(uLicorice, saltCol, gSalt);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(uLicRough, 1.0, gSalt);`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + bumpGLSL(
        '(vnoise(vObj * uGrainScale) * 0.6 + vnoise(vObj * uGrainScale * 2.2) * 0.4) * gSalt * uBump * 0.0035 + vnoise(vObj * 30.0) * 0.0015'))
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        material.clearcoat *= (1.0 - gSalt);
        material.sheenColor *= gSalt;   // velvety sheen only on the salt`)
      .replace('#include <opaque_fragment>', `
        {
          // tiny crystal glints that twinkle as the piece turns past the key light
          vec3 cell = floor(vObj * uGrainScale * 0.8);
          float crystal = step(0.965, h31(cell + 3.1));
          vec3 jitterN = normalize(normal + (vec3(h31(cell), h31(cell + 1.7), h31(cell + 4.3)) - 0.5) * 1.2);
          vec3 H = normalize(uKeyDir + normalize(vViewPosition));
          float glint = pow(max(dot(jitterN, H), 0.0), 40.0) * crystal * gSalt;
          outgoingLight += vec3(glint * uSparkle);
        }
        #include <opaque_fragment>`);
  };
  return mat;
}

export function createCandy(_stage: Stage): THREE.Mesh {
  const geo = sdfGeometry(makeMonkeySDF(CANDY), [-0.85, -0.6, -0.42], [0.9, 0.6, 0.42], CANDY.resolution);
  return new THREE.Mesh(geo, createSaltMaterial(CANDY));
}
