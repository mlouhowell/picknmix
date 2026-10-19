// Candy page navigation (Phase 4): -> next, <- previous, Esc close, horizontal swipe.
// Listeners are bound once (the ClientRouter keeps scripts alive) and read the current page's
// links at event time, so they work after every client-side navigation.
import { navigate } from 'astro:transitions/client';

const href = (rel: 'next' | 'prev' | 'close') =>
  document.querySelector<HTMLAnchorElement>(`[data-nav="${rel}"]`)?.getAttribute('href') ?? null;
const go = (rel: 'next' | 'prev' | 'close') => {
  const h = href(rel);
  if (h) navigate(h);
};

document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
  const t = e.target as HTMLElement | null;
  if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
  const rel = ({ ArrowRight: 'next', ArrowLeft: 'prev', Escape: 'close' } as const)[e.key as string];
  if (rel && href(rel)) {
    e.preventDefault();
    go(rel);
  }
});

// swipe: a mostly-horizontal touch drag of > 60px
let start: { x: number; y: number } | null = null;
document.addEventListener('touchstart', (e) => {
  const p = e.touches[0];
  start = e.touches.length === 1 && p ? { x: p.clientX, y: p.clientY } : null;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  const p = e.changedTouches[0];
  if (!start || !p) return;
  const dx = p.clientX - start.x, dy = p.clientY - start.y;
  start = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(dx < 0 ? 'next' : 'prev');
}, { passive: true });

// after a client-side navigation, move focus to the candy title (h1 has tabindex=-1)
let first = true;
document.addEventListener('astro:page-load', () => {
  if (first) { first = false; return; }
  document.querySelector<HTMLElement>('h1[tabindex="-1"]')?.focus({ preventScroll: true });
});
