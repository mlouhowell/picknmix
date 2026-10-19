// Landing "candy universe" (doodle.mary-louise.com-style fly-through). Shared by CandyUniverse.astro (first
// frame, rendered at build time) and scripts/landing-universe.ts (every frame after that), so both agree.
// Each item sits in a lane (x, y) at its own depth; the scroll offset pushes every item toward the camera
// and wraps it to the back of the loop once it passes. Tuning lives in content/landing-layout.json -> universe.
export type UniverseCfg = {
  perspectivePx: number; itemPx: number; stepZ: number;
  fadeInPx: number; fadeOutStartZ: number; fadeOutEndZ: number;
  farBlurPx: number; blurStartZ: number; spinDeg: number;
};
export type Item = { x: number; y: number; z0: number; r: number };

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Depth of an item for a given scroll offset: always in (-cycle, 0]. */
export const depthAt = (z0: number, offset: number, cycle: number) => {
  const z = (z0 + offset) % cycle;
  return (z > 0 ? z - cycle : z <= -cycle ? z + cycle : z);
};

/** Transform / opacity / blur for one item at depth z. */
export function pose(it: Item, z: number, cycle: number, c: UniverseCfg) {
  const opacity = smooth(-cycle, -cycle + c.fadeInPx, z) * (1 - smooth(c.fadeOutStartZ, c.fadeOutEndZ, z));
  const blur = c.farBlurPx * smooth(c.blurStartZ, -cycle, z);
  const rot = it.r + c.spinDeg * (1 + z / cycle); // turns a little as it comes closer
  return {
    transform: `translate3d(${it.x}px, ${it.y}px, ${z.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`,
    opacity: +opacity.toFixed(3),
    blur: +blur.toFixed(2),
  };
}

/** Offset change that brings item z0 to depth `target` by the shortest way round the loop. */
export function offsetToBring(z0: number, offset: number, target: number, cycle: number) {
  let d = (target - depthAt(z0, offset, cycle)) % cycle;
  if (d > cycle / 2) d -= cycle;
  if (d < -cycle / 2) d += cycle;
  return d;
}
