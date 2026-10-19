// Landing (3:679): scrolling stirs the candies. The landing is one screen, so wheel / trackpad / touch drag /
// arrow + page keys feed a "push" that sends every candy drifting up or down by its depth (sharp = near =
// moves most, blurred = far = least) with a little extra spin, then eases back to its Figma pose.
// Tuning in content/landing-layout.json -> motion.scroll*. Nothing happens under prefers-reduced-motion.
// Listeners are bound once (the ClientRouter keeps scripts alive) and only act while the landing is shown.
type Slot = { el: HTMLElement; depth: number; dir: number };
let slots: Slot[] = [];
let cfg = { travel: 0, spin: 0, sensitivity: 0, returnPerSecond: 0 };
let push = 0, shown = 0, last = 0, raf = 0;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

function collect() {
  const stage = document.querySelector<HTMLElement>('[data-scroll-stir]');
  slots = stage ? [...stage.querySelectorAll<HTMLElement>('.slot')].map((el) => ({
    el, depth: Number(el.dataset.depth ?? 0), dir: Number(el.dataset.dir ?? 1),
  })) : [];
  if (stage) cfg = JSON.parse(stage.dataset.scrollStir!);
  push = shown = 0;
}

function frame(t: number) {
  const dt = Math.min((t - last) / 1000, 0.1); last = t;
  push *= Math.exp(-cfg.returnPerSecond * dt); // spring the target back home
  shown += (push - shown) * (1 - Math.exp(-8 * dt)); // the candies follow smoothly
  for (const s of slots) {
    s.el.style.setProperty('--sy', String(-shown * cfg.travel * s.depth));
    s.el.style.setProperty('--sr', `${shown * cfg.spin * s.depth * s.dir}deg`);
  }
  raf = Math.abs(shown) > 1e-3 || Math.abs(push) > 1e-3 ? requestAnimationFrame(frame) : 0;
}

function stir(delta: number) {
  if (!slots.length || reduce.matches) return;
  push = Math.max(-1, Math.min(1, push + delta * cfg.sensitivity));
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
}

addEventListener('wheel', (e) => stir(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY), { passive: true });
let touchY: number | null = null;
addEventListener('touchstart', (e) => { touchY = e.touches.length === 1 ? e.touches[0]!.clientY : null; }, { passive: true });
addEventListener('touchmove', (e) => {
  const y = e.touches[0]?.clientY;
  if (touchY === null || y === undefined) return;
  stir((touchY - y) * 2); touchY = y;
}, { passive: true });
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const d = ({ ArrowDown: 120, ArrowUp: -120, PageDown: 400, PageUp: -400, ' ': e.shiftKey ? -400 : 400 } as Record<string, number>)[e.key];
  if (d && slots.length) stir(d);
});
document.addEventListener('astro:page-load', collect);
document.addEventListener('astro:before-swap', () => { cancelAnimationFrame(raf); raf = 0; slots = []; });
