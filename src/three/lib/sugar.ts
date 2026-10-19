// Sparkling sugar-crystal coating (3D_CANDY_GUIDELINES §5, "sugar-dusted" families: BUBS, cola).
// Shader-generated grains: one jittered, cube-ish crystal per 3D cell (two interleaved layers), each specular
// and slightly translucent, with glints that twinkle as the candy turns past the key light. Coverage is
// denser on convex/top areas (aEdge) and thinner in creases (aAO), both baked by lib/sdf.ts.
// Requires: NOISE_GLSL (h31), varyings vObj, vObjN, vAO, vEdge.
import * as THREE from 'three';

export type SugarConfig = {
  sugarColor: string; // crystal colour (sRGB)
  sugarScale: number; // grain cells per world unit (world = candy height; ~1/0.6 mm at real scale)
  sugarDensity: number; // 0..1 fraction of cells holding a grain
  sugarTopBias: number; // extra density on convex edges / faces
  sugarCreaseBias: number; // less sugar in creases
  sugarTint: number; // 0 = pure white crystal, 1 = takes the candy colour (translucency)
  sugarDust: number; // fine powder veil between grains (pastel haze)
  sugarRoughness: number; // crystal roughness (low = sparkly)
  sugarSparkle: number; // glint strength
  sugarBump: number; // grain relief strength
};

export const SUGAR_GLSL = /* glsl */ `
  uniform vec3 uSugarColor;
  uniform float uSugarScale, uSugarDensity, uSugarTop, uSugarCrease, uSugarTint, uSugarDust, uSugarRough, uSugarSparkle, uSugarBump;
  uniform vec3 uKeyDir;
  float gSugar; vec3 gSugarJit;
  float sugarLayer(vec3 p, float density, out vec3 jit) {
    vec3 c = floor(p); float best = 0.0; jit = vec3(0.0);
    for (int dx = -1; dx <= 1; dx++) for (int dy = -1; dy <= 1; dy++) for (int dz = -1; dz <= 1; dz++) {
      vec3 cc = c + vec3(float(dx), float(dy), float(dz));
      if (h31(cc) > density) continue;
      vec3 ctr = cc + 0.5 + (vec3(h31(cc + 1.3), h31(cc + 2.7), h31(cc + 4.1)) - 0.5) * 0.7;
      float r = 0.26 + 0.24 * h31(cc + 7.7);
      vec3 d = p - ctr;
      // cube-ish crystal: blend of round and max-norm distance in a per-grain skewed frame
      vec3 ax = normalize(vec3(h31(cc + 21.0), h31(cc + 22.0), h31(cc + 23.0)) - 0.5);
      vec3 e = vec3(dot(d, ax), dot(d, normalize(cross(ax, vec3(0.3, 0.9, 0.1)))), 0.0);
      e.z = length(d - ax * e.x);
      float dist = mix(length(d), max(max(abs(e.x), abs(e.y)), abs(e.z)) * 1.2, 0.55);
      float m = 1.0 - smoothstep(r * 0.72, r, dist);
      if (m > best) { best = m; jit = vec3(h31(cc + 11.0), h31(cc + 13.0), h31(cc + 17.0)) - 0.5; }
    }
    return best;
  }
`;

/** color_fragment addition: sets gSugar / gSugarJit and veils diffuseColor. */
export const SUGAR_COLOR_GLSL = /* glsl */ `
  {
    float D = uSugarDensity + uSugarTop * max(vEdge, 0.0) - uSugarCrease * (1.0 - vAO);
    vec3 j1, j2;
    float g1 = sugarLayer(vObj * uSugarScale, D, j1);
    float g2 = sugarLayer(vObj * uSugarScale * 1.83 + 31.7, D * 0.85, j2) * 0.85;
    gSugar = max(g1, g2); gSugarJit = g1 >= g2 ? j1 : j2;
    vec3 crystal = mix(uSugarColor, diffuseColor.rgb, uSugarTint) * (0.92 + 0.16 * h31(floor(vObj * uSugarScale)));
    // frosty haze collects on raised areas; creases keep the candy's saturated colour
    diffuseColor.rgb = mix(diffuseColor.rgb, uSugarColor, uSugarDust * clamp(D, 0.0, 1.0) * smoothstep(0.3, 1.0, vAO) * (1.0 + max(vEdge, 0.0)));
    diffuseColor.rgb = mix(diffuseColor.rgb, crystal, gSugar);
  }
`;
export const SUGAR_ROUGHNESS_GLSL = /* glsl */ `roughnessFactor = mix(roughnessFactor, uSugarRough, gSugar);`;
/** Bump height expression (feed to bumpGLSL). */
export const SUGAR_BUMP_EXPR = `gSugar * uSugarBump * 0.004`;
/** normal_fragment_maps addition after the bump: per-grain facet tilt (shading speckle). */
export const SUGAR_FACET_GLSL = /* glsl */ `normal = normalize(normal + gSugarJit * gSugar * 0.9);`;
/** opaque_fragment addition: twinkling glints on grains facing the key light. */
export const SUGAR_GLINT_GLSL = /* glsl */ `
  {
    vec3 Hh = normalize(uKeyDir + normalize(vViewPosition));
    float glint = pow(max(dot(normalize(normal + gSugarJit * 0.6), Hh), 0.0), 60.0) * step(0.55, gSugar) * step(0.5, h31(gSugarJit * 91.0));
    outgoingLight += vec3(glint * uSugarSparkle);
  }
`;

export function sugarUniforms(c: SugarConfig, keyDir: THREE.Vector3) {
  return {
    uSugarColor: { value: new THREE.Color(c.sugarColor) },
    uSugarScale: { value: c.sugarScale }, uSugarDensity: { value: c.sugarDensity },
    uSugarTop: { value: c.sugarTopBias }, uSugarCrease: { value: c.sugarCreaseBias },
    uSugarTint: { value: c.sugarTint }, uSugarDust: { value: c.sugarDust },
    uSugarRough: { value: c.sugarRoughness }, uSugarSparkle: { value: c.sugarSparkle }, uSugarBump: { value: c.sugarBump },
    uKeyDir: { value: keyDir.clone().normalize() },
  };
}
