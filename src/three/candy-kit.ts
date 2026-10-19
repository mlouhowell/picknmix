// candy-kit (TS module port of assets/3d/candy-kit/candy-kit.js): shared stage + lighting rig, zero-g float,
// seamless loop, reduced motion and the candy API. Every candy module builds a mesh; this file does the rest.
// Lighting is identical for every candy (3D_CANDY_GUIDELINES §7): fix materials, never per-candy lights.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export type Noise3 = (x: number, y: number, z: number) => number;

/** Seeded 3D value noise in [-1, 1]. */
export function makeNoise3(seed: number): Noise3 {
  const hash = (x: number, y: number, z: number) => {
    let h = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    const L = (a: number, b: number, t: number) => a + (b - a) * t;
    const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), xf), L(c(0, 1, 0), c(1, 1, 0), xf), yf),
             L(L(c(0, 0, 1), c(1, 0, 1), xf), L(c(0, 1, 1), c(1, 1, 1), xf), yf), zf) * 2 - 1;
  };
}

/** Seeded PRNG in [0, 1). */
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SceneConfig = { fov: number; framePadding: number; exposure: number };
export type FloatConfig = {
  seed: number; speed: number; loopSeconds: number; spinTurns: number; precessTurns: number;
  drift: number; driftCycles: [number, number, number]; staticTime: number;
};
export type Stage = {
  container: HTMLElement; renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  lights: { key: THREE.DirectionalLight; fill: THREE.DirectionalLight; rim: THREE.DirectionalLight };
  dispose(): void;
};

/** World-space key light direction (for glint shaders; the camera is unrotated so view = world). */
export const KEY_LIGHT_POS = new THREE.Vector3(-4, 4, 2.5);

/** Transparent renderer + soft modern studio lighting shared by every candy.
 *  Lights are fixed in space, so tumbling candies appear to float past them. */
export function createStage(container: HTMLElement, { fov = 28, exposure = 0.92 }: Partial<SceneConfig> = {},
  { maxPixelRatio = 2 } = {}): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  renderer.setClearColor(0x000000, 0); // transparent background
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04); // soft studio fill
  scene.environment = envRT.texture;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);

  const key = new THREE.DirectionalLight(0xffffff, 1.7); // soft key, upper left-front
  key.position.copy(KEY_LIGHT_POS);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff0e6, 0.3); // warm fill from the right
  fill.position.set(4, 0.5, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7); // back rim to separate from the page
  rim.position.set(1, 3, -4);
  scene.add(rim);

  const dispose = () => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        for (const mat of ([] as THREE.Material[]).concat(m.material)) {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
          mat.dispose();
        }
      }
    });
    envRT.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
  return { container, renderer, scene, camera, lights: { key, fill, rim }, dispose };
}

/** Zero-gravity tumble for any Object3D: constant spin about a body axis + slow precession of
 *  that axis, plus a smooth Lissajous drift. Seeded so every candy starts, spins and drifts
 *  differently. Integer turns/cycles per loop => update(t) and update(t + loop) are identical.
 *  `size` scales the drift (world units). */
export function applyFloat(object: THREE.Object3D, { seed = 1, speed = 1, drift = 0.05, size = 1,
  loopSeconds = 22, spinTurns = 2, precessTurns = 1, driftCycles = [1, 2, 1] as [number, number, number] } = {}) {
  const rnd = mulberry32(seed * 7919 + 13);
  const randUnit = () => {
    const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    return new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a));
  };
  const randQuat = () => new THREE.Quaternion().setFromAxisAngle(randUnit(), rnd() * Math.PI * 2);

  const base = randQuat(); // random starting orientation
  // spin axis tilted 55–85° from the candy's local Y so it tumbles end over end (not just rolls)
  const tiltA = THREE.MathUtils.degToRad(55 + rnd() * 30), spinAz = rnd() * Math.PI * 2;
  const spinAxis = new THREE.Vector3(Math.sin(tiltA) * Math.cos(spinAz), Math.cos(tiltA), Math.sin(tiltA) * Math.sin(spinAz))
    .applyQuaternion(base).normalize();
  // precession axis: 20–40° off the spin axis (a lazy wobble, not a wild one)
  const off = randUnit().cross(spinAxis).normalize();
  const precAxis = spinAxis.clone().applyAxisAngle(off, THREE.MathUtils.degToRad(20 + rnd() * 20));
  const sSpin = rnd() < 0.5 ? -1 : 1, sPrec = rnd() < 0.5 ? -1 : 1;
  const phase = rnd(); // time offset so candies are out of sync
  const dPh = [rnd(), rnd(), rnd()] as const;
  const loop = loopSeconds / speed;
  const qs = new THREE.Quaternion(), qp = new THREE.Quaternion(), TAU = Math.PI * 2;
  const amp = drift * size;

  function update(seconds: number) {
    const tau = seconds / loop + phase;
    qs.setFromAxisAngle(spinAxis, sSpin * spinTurns * TAU * tau);
    qp.setFromAxisAngle(precAxis, sPrec * precessTurns * TAU * tau);
    object.quaternion.copy(qp).multiply(qs).multiply(base);
    object.position.set(
      amp * Math.sin(TAU * (driftCycles[0] * tau + dPh[0])),
      amp * Math.sin(TAU * (driftCycles[1] * tau + dPh[1])) * 0.8,
      amp * Math.sin(TAU * (driftCycles[2] * tau + dPh[2])) * 0.6);
  }
  update(0);
  return { update, loop };
}

/** The candy API (same shape as the legacy window.candy). */
export type CandyAPI = {
  ready: boolean;
  pause(): void; play(): void; at(seconds: number): void;
  pose(x?: number, y?: number, z?: number): void;
  loopSeconds: number; staticTime: number;
  mesh: THREE.Mesh;
  /** Site integration: suspend rendering (off-screen / hidden tab) without touching pause/play. */
  setVisible(visible: boolean): void;
  renderer: THREE.WebGLRenderer;
  dispose(): void;
};

/** Centres the mesh, frames it and starts the float loop (honours prefers-reduced-motion, live).
 *  seed/speed default to FLOAT; standalone previews pass ?seed= / ?speed= through. */
export function startCandy(stage: Stage, mesh: THREE.Mesh, FLOAT: FloatConfig, SCENE: SceneConfig,
  { seed = FLOAT.seed, speed = FLOAT.speed }: { seed?: number; speed?: number } = {}): CandyAPI {
  const { container, renderer, scene, camera } = stage;

  mesh.geometry.computeBoundingSphere();
  const c = mesh.geometry.boundingSphere!.center.clone().negate();
  mesh.geometry.translate(c.x, c.y, c.z); // spin about its centre
  mesh.geometry.computeBoundingSphere();
  scene.add(mesh);
  let maxR = 0;
  {
    const p = mesh.geometry.attributes.position!;
    for (let i = 0; i < p.count; i++) maxR = Math.max(maxR, Math.hypot(p.getX(i), p.getY(i), p.getZ(i)));
  }
  const float = applyFloat(mesh, { ...FLOAT, seed, speed, size: maxR });
  // frame the sphere the tumbling piece can reach, plus its drift
  const boundR = maxR * (1 + FLOAT.drift * 1.1) * SCENE.framePadding;

  const render = () => renderer.render(scene, camera);
  function resize() {
    const w = Math.max(container.clientWidth, 1), h = Math.max(container.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    camera.position.set(0, 0, boundR / Math.sin(Math.min(vFov, hFov) / 2));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    render();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let time = FLOAT.staticTime, last = performance.now(), running = false, manual = false, visible = true, raf = 0;
  const setTime = (t: number) => { float.update(t); render(); };
  function tick(now: number) {
    if (!running) return;
    time += Math.min((now - last) / 1000, 0.1); last = now;
    setTime(time);
    raf = requestAnimationFrame(tick);
  }
  function updateMotion() {
    const shouldRun = !reduceMotion.matches && !manual && visible;
    if (shouldRun && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(tick); }
    if (!shouldRun && running) { running = false; cancelAnimationFrame(raf); }
    if (!shouldRun && reduceMotion.matches && !manual) setTime(FLOAT.staticTime);
  }
  reduceMotion.addEventListener('change', updateMotion);
  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);

  resize();
  updateMotion();
  if (reduceMotion.matches) setTime(FLOAT.staticTime);

  return {
    ready: true,
    pause() { manual = true; updateMotion(); },
    play() { manual = false; updateMotion(); },
    at(seconds) { time = seconds; setTime(seconds); },
    /** Hold a fixed orientation (Euler degrees, XYZ), e.g. pose(0, 0, 0) for the reference view. */
    pose(x = 0, y = 0, z = 0) {
      manual = true; updateMotion();
      mesh.position.set(0, 0, 0);
      mesh.rotation.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z));
      render();
    },
    loopSeconds: float.loop, // exports: render exactly this long for a seamless loop
    staticTime: FLOAT.staticTime,
    mesh,
    setVisible(v) { visible = v; updateMotion(); },
    renderer,
    dispose() {
      running = false; cancelAnimationFrame(raf); ro.disconnect();
      reduceMotion.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', onVis);
      stage.dispose();
    },
  };
}

/** What every candy module exports (3D_CANDY_GUIDELINES §2). */
export type CandyModule = {
  slug: string;
  REAL_SIZE_MM: number;
  CANDY: Record<string, unknown>;
  SCENE: SceneConfig;
  FLOAT: FloatConfig;
  /** Accessible description for the role="img" container. */
  ARIA_LABEL: string;
  createCandy(stage: Stage): THREE.Mesh;
};
