// ---------- candy-kit: shared stage, lighting, zero-g float, loop & API ----
// Source of truth: /workspace/candy-kit/candy-kit.js. Run `python3 /workspace/candy-kit/build.py`
// to inline it into every candy page (pages stay single-file).
// Expects `THREE` and `RoomEnvironment` to be imported by the page.

/** Seeded 3D value noise in [-1, 1]. */
function makeNoise3(seed) {
  const hash = (x, y, z) => {
    let h = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const fade = t => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    const L = (a, b, t) => a + (b - a) * t;
    const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
    return L(L(L(c(0,0,0), c(1,0,0), xf), L(c(0,1,0), c(1,1,0), xf), yf),
             L(L(c(0,0,1), c(1,0,1), xf), L(c(0,1,1), c(1,1,1), xf), yf), zf) * 2 - 1;
  };
}
/** Seeded PRNG in [0, 1). */
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** Transparent renderer + soft modern studio lighting shared by every candy.
 *  Lights are fixed in space, so tumbling candies appear to float past them. */
function createStage(container, { fov = 28, exposure = 0.92 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);                // transparent background
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // soft studio fill
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);

  const key = new THREE.DirectionalLight(0xffffff, 1.7);   // soft key, upper left-front
  key.position.set(-4, 4, 2.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff0e6, 0.3);  // warm fill from the right
  fill.position.set(4, 0.5, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7);   // back rim to separate from the page
  rim.position.set(1, 3, -4);
  scene.add(rim);
  return { container, renderer, scene, camera, lights: { key, fill, rim } };
}

/** Zero-gravity tumble for any Object3D: constant spin about a body axis + slow precession of
 *  that axis, plus a smooth Lissajous drift. Seeded so every candy starts, spins and drifts
 *  differently. Integer turns/cycles per loop => update(t) and update(t + loop) are identical.
 *  Returns { update(seconds), loop }. `size` scales the drift (world units). */
function applyFloat(object, { seed = 1, speed = 1, drift = 0.05, size = 1,
  loopSeconds = 22, spinTurns = 2, precessTurns = 1, driftCycles = [1, 2, 1] } = {}) {
  const rnd = mulberry32(seed * 7919 + 13);
  const randUnit = () => { const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    return new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a)); };
  const randQuat = () => new THREE.Quaternion().setFromAxisAngle(randUnit(), rnd() * Math.PI * 2);

  const base = randQuat();                         // random starting orientation
  // spin axis tilted 55–85° from the candy's local Y so it tumbles end over end (not just rolls)
  const tiltA = THREE.MathUtils.degToRad(55 + rnd() * 30), spinAz = rnd() * Math.PI * 2;
  const spinAxis = new THREE.Vector3(Math.sin(tiltA) * Math.cos(spinAz), Math.cos(tiltA), Math.sin(tiltA) * Math.sin(spinAz))
    .applyQuaternion(base).normalize();
  // precession axis: 20–40° off the spin axis (a lazy wobble, not a wild one)
  const off = randUnit().cross(spinAxis).normalize();
  const precAxis = spinAxis.clone().applyAxisAngle(off, THREE.MathUtils.degToRad(20 + rnd() * 20));
  const sSpin = rnd() < 0.5 ? -1 : 1, sPrec = rnd() < 0.5 ? -1 : 1;
  const phase = rnd();                             // time offset so candies are out of sync
  const dPh = [rnd(), rnd(), rnd()];
  const loop = loopSeconds / speed;
  const qs = new THREE.Quaternion(), qp = new THREE.Quaternion(), TAU = Math.PI * 2;
  const amp = drift * size;

  function update(seconds) {
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

/** Centres the mesh, frames it, starts the float loop (honours prefers-reduced-motion and
 *  ?seed= / ?speed= URL params) and exposes window.candy { pause, play, at, loopSeconds }. */
function startCandy(stage, mesh, FLOAT, SCENE) {
  const { container, renderer, scene, camera } = stage;
  const params = new URLSearchParams(location.search);
  const motionSeed = Number(params.get('seed') ?? FLOAT.seed) || FLOAT.seed;

  mesh.geometry.computeBoundingSphere();
  mesh.geometry.translate(...mesh.geometry.boundingSphere.center.clone().negate().toArray()); // spin about its centre
  mesh.geometry.computeBoundingSphere();
  scene.add(mesh);
  let maxR = 0;
  { const p = mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) maxR = Math.max(maxR, Math.hypot(p.getX(i), p.getY(i), p.getZ(i))); }
  const float = applyFloat(mesh, { ...FLOAT, seed: motionSeed, speed: Number(params.get('speed')) || FLOAT.speed, size: maxR });
  // frame the sphere the tumbling piece can reach, plus its drift
  const boundR = maxR * (1 + FLOAT.drift * 1.1) * SCENE.framePadding;

  function render() { renderer.render(scene, camera); }
  function resize() {
    const w = Math.max(container.clientWidth, 1), h = Math.max(container.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const dist = boundR / Math.sin(Math.min(vFov, hFov) / 2);
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    render();
  }
  new ResizeObserver(resize).observe(container);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let time = FLOAT.staticTime, last = performance.now(), running = false;
  function setTime(t) { float.update(t); render(); }
  function tick(now) {
    if (!running) return;
    time += Math.min((now - last) / 1000, 0.1); last = now;
    setTime(time);
    requestAnimationFrame(tick);
  }
  function updateMotion() {
    const shouldRun = !reduceMotion.matches && !window.__candyManual;
    if (shouldRun && !running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
    if (!shouldRun) { running = false; setTime(reduceMotion.matches ? FLOAT.staticTime : time); }
  }
  reduceMotion.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', () => { last = performance.now(); });

  resize();
  updateMotion();

  // Hook for screenshots / page integrations: pause and pose at a given time (seconds).
  window.candy = {
    pause() { window.__candyManual = true; updateMotion(); },
    play()  { window.__candyManual = false; updateMotion(); },
    at(seconds) { time = seconds; setTime(seconds); },
    loopSeconds: float.loop,           // exports: render exactly this long for a seamless loop
    staticTime: FLOAT.staticTime,
    mesh,                              // the THREE.Mesh (for integrations / debugging)
    /** Hold a fixed orientation (Euler degrees, XYZ), e.g. candy.pose(0, 0, 0) for the reference view. */
    pose(x = 0, y = 0, z = 0) {
      window.__candyManual = true; updateMotion();
      mesh.position.set(0, 0, 0); mesh.rotation.set(...[x, y, z].map(THREE.MathUtils.degToRad)); render();
    },
    ready: true,
  };
  return { float, render, maxR };
}
