// Signed-distance-field modelling (djungelvral approach): primitives + smooth min, a surface-nets
// mesher, and a geometry builder that snaps vertices to the surface and bakes AO + convexity attributes
// (aAO: 0 in creases .. 1 open; aEdge: -1 concave .. +1 convex) for coating shaders.
import * as THREE from 'three';

export type SDF = (x: number, y: number, z: number) => number;
type V3 = [number, number, number];
export type Prim =
  | { t: 'sphere'; c: V3; r: number; g?: string }
  | { t: 'ellipsoid'; c: V3; r: V3; g?: string }
  | { t: 'capsule'; a: V3; b: V3; r: number; g?: string }
  | { t: 'roundbox'; c: V3; h: V3; r: number; g?: string };

/** Polynomial smooth minimum (soft moulded joins). */
export const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

export function prim(p: Prim, x: number, y: number, z: number): number {
  switch (p.t) {
    case 'sphere': return Math.hypot(x - p.c[0], y - p.c[1], z - p.c[2]) - p.r;
    case 'ellipsoid': { // iq's ellipsoid approximation
      const qx = (x - p.c[0]) / p.r[0], qy = (y - p.c[1]) / p.r[1], qz = (z - p.c[2]) / p.r[2];
      const k0 = Math.hypot(qx, qy, qz), k1 = Math.hypot(qx / p.r[0], qy / p.r[1], qz / p.r[2]);
      return (k0 * (k0 - 1)) / Math.max(k1, 1e-6);
    }
    case 'capsule': {
      const [ax, ay, az] = p.a, bx = p.b[0] - ax, by = p.b[1] - ay, bz = p.b[2] - az;
      const px = x - ax, py = y - ay, pz = z - az;
      const h = Math.min(Math.max((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz), 0), 1);
      return Math.hypot(px - bx * h, py - by * h, pz - bz * h) - p.r;
    }
    case 'roundbox': {
      const qx = Math.abs(x - p.c[0]) - p.h[0], qy = Math.abs(y - p.c[1]) - p.h[1], qz = Math.abs(z - p.c[2]) - p.h[2];
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - p.r;
    }
  }
}

/** Surface nets mesher (SDF -> smooth triangle mesh). */
export function meshSDF(sdf: SDF, min: V3, max: V3, step: number) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1, ny = Math.ceil((max[1] - min[1]) / step) + 1, nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const V = new Float32Array(nx * ny * nz);
  const id = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    V[id(i, j, k)] = sdf(min[0] + i * step, min[1] + j * step, min[2] + k * step);

  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const pos: number[] = [];
  const corners: V3[] = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
  const edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]] as const;
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const [a, b, d] = corners[c]!; cv[c] = V[id(i + a, j + b, k + d)]!; if (cv[c]! < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [e0, e1] of edges) {
      if ((cv[e0]! < 0) === (cv[e1]! < 0)) continue;
      const t = cv[e0]! / (cv[e0]! - cv[e1]!), A = corners[e0]!, B = corners[e1]!;
      sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; n++;
    }
    cellVert[id(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * step, min[1] + (j + sy / n) * step, min[2] + (k + sz / n) * step);
  }
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  };
  const cvx = (i: number, j: number, k: number) => cellVert[id(i, j, k)]!;
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = V[id(i, j, k)]! < 0;
    if (v0 !== V[id(i + 1, j, k)]! < 0) quad(cvx(i, j - 1, k - 1), cvx(i, j, k - 1), cvx(i, j, k), cvx(i, j - 1, k), !v0); // x edge
    if (v0 !== V[id(i, j + 1, k)]! < 0) quad(cvx(i - 1, j, k - 1), cvx(i - 1, j, k), cvx(i, j, k), cvx(i, j, k - 1), !v0); // y edge
    if (v0 !== V[id(i, j, k + 1)]! < 0) quad(cvx(i - 1, j - 1, k), cvx(i, j - 1, k), cvx(i, j, k), cvx(i - 1, j, k), !v0); // z edge
  }
  return { pos, idx };
}

/** Mesh an SDF and bake normals (from the field), aAO and aEdge. */
export function sdfGeometry(sdf: SDF, min: V3, max: V3, step: number): THREE.BufferGeometry {
  const { pos, idx } = meshSDF(sdf, min, max, step);
  const e = 1e-3, n = pos.length / 3;
  const nrm = new Float32Array(n * 3), ao = new Float32Array(n), edge = new Float32Array(n);
  const grad = (x: number, y: number, z: number): V3 => {
    const gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    return [gx / l, gy / l, gz / l];
  };
  const t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), N = new THREE.Vector3();
  for (let v = 0; v < n; v++) {
    let x = pos[3 * v]!, y = pos[3 * v + 1]!, z = pos[3 * v + 2]!;
    for (let it = 0; it < 2; it++) { const d = sdf(x, y, z), g = grad(x, y, z); x -= g[0] * d; y -= g[1] * d; z -= g[2] * d; } // snap to surface
    pos[3 * v] = x; pos[3 * v + 1] = y; pos[3 * v + 2] = z;
    const g = grad(x, y, z);
    nrm.set(g, 3 * v);
    // ambient occlusion-ish: how open the space is along the normal (creases -> low)
    let o = 0;
    for (const s of [0.03, 0.07, 0.14]) o += Math.min(Math.max(sdf(x + g[0] * s, y + g[1] * s, z + g[2] * s) / s, 0), 1);
    ao[v] = o / 3;
    // convexity: sample the field a little inside along tangent directions
    N.set(g[0], g[1], g[2]); t1.set(1, 0, 0); if (Math.abs(N.x) > 0.9) t1.set(0, 1, 0);
    t1.cross(N).normalize(); t2.crossVectors(N, t1);
    let c = 0; const r = 0.05;
    for (let a = 0; a < 6; a++) {
      const ca = Math.cos((a * Math.PI) / 3) * r, sa = Math.sin((a * Math.PI) / 3) * r;
      c += sdf(x + t1.x * ca + t2.x * sa, y + t1.y * ca + t2.y * sa, z + t1.z * ca + t2.z * sa);
    }
    edge[v] = Math.min(Math.max(c / 6 / (r * 0.35), -1), 1); // + convex edge, - concave crease
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
  geo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}
