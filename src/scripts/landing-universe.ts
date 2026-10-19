// Landing "candy universe" motion (components/CandyUniverse.astro). The landing is one screen, so wheel /
// trackpad / touch drag / arrow + page keys move a target scroll offset; the camera eases toward it and also
// drifts slowly forward on its own. Every frame each candy's depth wraps round the loop (lib/universe.ts).
// Keyboard focus flies the focused candy to universe.focusZ. Under prefers-reduced-motion nothing drifts or
// flies; focus jumps the candy into view instantly. Tuning: content/landing-layout.json -> universe.
// Listeners are bound once (the ClientRouter keeps scripts alive) and only act while the universe is shown.
import { pose, depthAt, offsetToBring, type Item, type UniverseCfg } from '../lib/universe';

type Cfg = UniverseCfg & { cycle: number; scrollSpeed: number; ease: number; driftPxPerSecond: number; focusZ: number };
let els: { el: HTMLElement; it: Item }[] = [];
let cfg: Cfg | null = null;
let offset = 0, target = 0, last = 0, raf = 0, hovering = false; // hover holds the drift so a candy is easy to click
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

function render() {
  if (!cfg) return;
  for (const { el, it } of els) {
    const p = pose(it, depthAt(it.z0, offset, cfg.cycle), cfg.cycle, cfg);
    el.style.transform = p.transform;
    el.style.opacity = String(p.opacity);
    el.style.setProperty('--b', `${p.blur}px`);
    el.classList.toggle('gone', p.opacity < 0.05);
  }
}

function frame(t: number) {
  const dt = Math.min((t - last) / 1000, 0.1); last = t;
  if (!cfg) { raf = 0; return; }
  if (!hovering) target += cfg.driftPxPerSecond * dt;
  offset += (target - offset) * (1 - Math.exp(-cfg.ease * dt));
  render();
  raf = requestAnimationFrame(frame);
}

function start() {
  if (raf || !cfg || reduce.matches) return;
  last = performance.now(); raf = requestAnimationFrame(frame);
}

function fly(delta: number) {
  if (!cfg || reduce.matches) return;
  target += delta * cfg.scrollSpeed;
}

function collect() {
  const root = document.querySelector<HTMLElement>('[data-universe]');
  cfg = root ? JSON.parse(root.dataset.universe!) : null;
  els = root ? [...root.querySelectorAll<HTMLElement>('.item')].map((el) => ({ el, it: JSON.parse(el.dataset.item!) })) : [];
  offset = target = 0; hovering = false;
  if (!root) return;
  root.addEventListener('pointerover', (e) => { hovering = !!(e.target as Element).closest('.item'); });
  root.addEventListener('pointerleave', () => { hovering = false; });
  root.addEventListener('focusin', (e) => {
    const hit = els.find((x) => x.el === e.target);
    if (!hit || !cfg) return;
    target += offsetToBring(hit.it.z0, target, cfg.focusZ, cfg.cycle);
    if (reduce.matches) { offset = target; render(); }
  });
  start();
}

addEventListener('wheel', (e) => fly(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY), { passive: true });
let touchY: number | null = null;
addEventListener('touchstart', (e) => { touchY = e.touches.length === 1 ? e.touches[0]!.clientY : null; }, { passive: true });
addEventListener('touchmove', (e) => {
  const y = e.touches[0]?.clientY;
  if (touchY === null || y === undefined) return;
  fly((touchY - y) * 2); touchY = y;
}, { passive: true });
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const d = ({ ArrowDown: 120, ArrowUp: -120, PageDown: 400, PageUp: -400, ' ': e.shiftKey ? -400 : 400 } as Record<string, number>)[e.key];
  if (d) fly(d);
});
reduce.addEventListener('change', () => { if (reduce.matches) { cancelAnimationFrame(raf); raf = 0; } else start(); });
document.addEventListener('astro:page-load', collect);
document.addEventListener('astro:before-swap', () => { cancelAnimationFrame(raf); raf = 0; els = []; cfg = null; });
