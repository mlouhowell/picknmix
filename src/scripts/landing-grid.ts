// Landing grid (figma 109:27): Grid | Timeline toggle (?view=timeline, no reload), never-ending grid, candy drawer
// (opened from grid tiles and timeline candies).
// Markup: SiteHeader.astro (toggle), CandyGrid.astro (grid + sentinel), CandyDrawer.astro (dialog + JSON).
export {};

let cleanup: (() => void) | null = null;

function init() {
  cleanup?.();
  const grid = document.querySelector<HTMLUListElement>('[data-endless]');
  if (!grid) return;
  const ac = new AbortController();
  const { signal } = ac;

  // ---- Grid | Timeline toggle (?view=timeline keeps the choice in the URL)
  const segs = [...document.querySelectorAll<HTMLButtonElement>('.view-nav [data-view]')];
  const views = [...document.querySelectorAll<HTMLElement>('[data-view-panel]')];
  const show = (view: string) => {
    for (const s of segs) s.setAttribute('aria-pressed', String(s.dataset.view === view));
    for (const v of views) v.hidden = v.dataset.viewPanel !== view;
  };
  for (const s of segs)
    s.addEventListener('click', () => {
      const view = s.dataset.view!;
      if (s.getAttribute('aria-pressed') === 'true') return;
      show(view);
      scrollTo({ top: 0 });
      const url = new URL(location.href);
      if (view === 'grid') url.searchParams.delete('view'); else url.searchParams.set('view', view);
      history.replaceState(history.state, '', url);
    }, { signal });
  show(new URL(location.href).searchParams.get('view') === 'timeline' ? 'timeline' : 'grid');

  // ---- Never-ending grid: append another set of the 13 candies before the sentinel comes into view
  const count = document.querySelectorAll('[data-drawer] [data-panel]').length;
  const set = [...grid.children].slice(0, count);
  const sentinel = document.querySelector('[data-endless-sentinel]');
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    const frag = document.createDocumentFragment();
    for (const li of set) {
      const copy = li.cloneNode(true) as HTMLLIElement;
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelector('button')!.tabIndex = -1;
      copy.querySelectorAll('img').forEach((i) => (i.loading = 'lazy'));
      frag.append(copy);
    }
    grid.append(frag);
    // re-observe so a still-visible sentinel (tall screens, fast scrolls) triggers the next set too
    io.unobserve(entries[0]!.target); io.observe(entries[0]!.target);
  }, { rootMargin: '0px 0px 1200px 0px' });
  if (sentinel) io.observe(sentinel);

  // ---- Drawer (CandyDrawer.astro renders one panel + hero per candy; show the current one)
  const dialog = document.querySelector<HTMLDialogElement>('[data-drawer]');
  let current = 0;
  const render = (i: number) => {
    if (!dialog) return;
    current = ((i % count) + count) % count;
    dialog.querySelectorAll<HTMLElement>('[data-panel]').forEach((el) => (el.hidden = Number(el.dataset.panel) !== current));
    dialog.querySelectorAll<HTMLElement>('[data-hero]').forEach((el) => (el.hidden = Number(el.dataset.hero) !== current));
    dialog.querySelector('.panel')?.scrollTo({ top: 0 });
  };
  // grid tiles and timeline candies both carry data-index (position in content/grid/candies.json)
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('.tile[data-index], .tl-candy[data-index]');
    if (!btn || !dialog) return;
    render(Number(btn.dataset.index));
    dialog.showModal();
  }, { signal });
  dialog?.addEventListener('click', (e) => {
    const nav = (e.target as Element).closest<HTMLElement>('[data-nav]')?.dataset.nav;
    if (nav === 'close' || e.target === dialog || (e.target as Element).matches('[data-hero-area]')) dialog.close();
    else if (nav === 'next') render(current + 1);
    else if (nav === 'prev') render(current - 1);
  }, { signal });
  // keyboard like the old candy page: -> next, <- previous, Esc closes (native)
  dialog?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') render(current + 1);
    else if (e.key === 'ArrowLeft') render(current - 1);
  }, { signal });

  cleanup = () => { ac.abort(); io.disconnect(); };
}

init();
document.addEventListener('astro:page-load', init);
