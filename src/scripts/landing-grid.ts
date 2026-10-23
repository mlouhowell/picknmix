// Landing grid (figma 109:27): Grid | Timeline toggle (?view=timeline, no reload), never-ending grid, candy drawer
// (opened from grid tiles and timeline candies).
// Markup: SiteHeader.astro (toggle), CandyGrid.astro (grid + sentinel), CandyDrawer.astro (dialog + JSON).
export {};

type DrawerCandy = {
  name: string; year: string; era: string; type: string; body: string; caption: string;
  webp: string; png: string; fallback: string;
};
type DrawerData = { candies: DrawerCandy[]; fields: Record<'year' | 'era' | 'type', string> };

let cleanup: (() => void) | null = null;

function init() {
  cleanup?.();
  const grid = document.querySelector<HTMLUListElement>('[data-endless]');
  if (!grid) return;
  const ac = new AbortController();
  const { signal } = ac;

  // ---- Grid | Timeline toggle (?view=timeline keeps the choice in the URL)
  const segs = [...document.querySelectorAll<HTMLButtonElement>('.toggle [data-view]')];
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
  const set = [...grid.children].slice(0, (JSON.parse(document.getElementById('grid-candies')!.textContent!) as DrawerData).candies.length);
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

  // ---- Drawer
  const dialog = document.querySelector<HTMLDialogElement>('[data-drawer]');
  const data = JSON.parse(document.getElementById('grid-candies')!.textContent!) as DrawerData;
  let current = 0;
  const render = (i: number) => {
    if (!dialog) return;
    const n = data.candies.length;
    current = ((i % n) + n) % n;
    const c = data.candies[current]!;
    const q = <T extends Element>(sel: string) => dialog.querySelector<T>(sel)!;
    // swap in a fresh <picture> so the browser re-picks the source for the new candy
    const pic = q<HTMLPictureElement>('picture');
    const next = pic.cloneNode(true) as HTMLPictureElement;
    next.querySelector<HTMLSourceElement>('[data-webp]')!.srcset = c.webp;
    const im = next.querySelector<HTMLImageElement>('[data-img]')!;
    im.srcset = c.png; im.src = c.fallback; im.alt = c.name;
    pic.replaceWith(next);
    q('[data-name]').textContent = c.name;
    const dl = q('[data-fields]');
    dl.replaceChildren();
    for (const k of ['year', 'era', 'type'] as const) {
      if (!c[k]) continue;
      const dt = document.createElement('dt'); dt.textContent = data.fields[k];
      const dd = document.createElement('dd'); dd.textContent = c[k];
      dl.append(dt, dd);
    }
    q('[data-text="body"]').textContent = c.body;
    q('[data-text="caption"]').textContent = c.caption;
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
    if (nav === 'close' || e.target === dialog) dialog.close();
    else if (nav === 'next') render(current + 1);
    else if (nav === 'prev') render(current - 1);
  }, { signal });
  dialog?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') render(current + 1);
    else if (e.key === 'ArrowLeft') render(current - 1);
  }, { signal });

  cleanup = () => { ac.abort(); io.disconnect(); };
}

init();
document.addEventListener('astro:page-load', init);
