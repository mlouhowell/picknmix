// Shared GLSL chunks for candy materials (onBeforeCompile extensions of MeshPhysicalMaterial).

/** Object-space value noise: h31 hash, vnoise, fbm. Expects `varying vec3 vObj` declared by the caller. */
export const NOISE_GLSL = /* glsl */ `
  float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 p){
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){ return vnoise(p) * 0.55 + vnoise(p * 2.1 + 5.2) * 0.3 + vnoise(p * 4.3 + 1.7) * 0.15; }
`;

/** Screen-space derivative bump: perturbs `normal` by height `h` (a float expression in scope). */
export const bumpGLSL = (h: string) => /* glsl */ `
  {
    float h = ${h};
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
    float det = dot(sx, r1) * faceDirection;
    vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
    normal = normalize(abs(det) * normal - grad);
  }
`;
