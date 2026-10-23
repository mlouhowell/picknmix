// Timeline view (figma 138:397): contents highlight follows the era in view, contents links scroll without
// changing the URL's view, and eras fade up as they enter (CSS skips the motion under prefers-reduced-motion).
// Markup: components/Timeline.astro.
export {};

let cleanup: (() => void) | null = null;

function init() {
  cleanup?.();
  const root = document.querySelector<HTMLElement>('[data-timeline]');
  if (!root) return;
  const ac = new AbortController();
  const eras = [...root.querySelectorAll<HTMLElement>('.era')];
  const links = new Map([...root.querySelectorAll<HTMLAnchorElement>('[data-toc]')].map((a) => [a.dataset.toc!, a]));

  // contents: the era crossing the upper middle of the viewport is current
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      for (const [id, a] of links) a.setAttribute('aria-current', String(id === e.target.id));
    }
  }, { rootMargin: '-35% 0px -60% 0px' });

  // fade-up once per era
  root.setAttribute('data-reveal-ready', '');
  const reveal = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); }
  }, { rootMargin: '0px 0px -10% 0px' });

  for (const era of eras) { spy.observe(era); reveal.observe(era); }

  for (const [id, a] of links)
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const target = document.getElementById(id);
      if (!target) return;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }, { signal: ac.signal });

  cleanup = () => { ac.abort(); spy.disconnect(); reveal.disconnect(); };
}

init();
document.addEventListener('astro:page-load', init);
