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
  // ---- Open/close: the clicked candy grows out of the page into the hero spot, and shrinks back on close (FLIP).
  // The page's candy is hidden while the drawer is open so it reads as one object. Skipped under reduced motion.
  let source: { btn: HTMLElement; index: number } | null = null;
  let closing = false;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heroPicture = () => dialog?.querySelector<HTMLElement>(`[data-hero="${current}"] picture`) ?? null;
  const motion = () => {
    const cs = getComputedStyle(document.documentElement);
    return { duration: parseFloat(cs.getPropertyValue('--duration-hero')) || 0, easing: cs.getPropertyValue('--ease-hero').trim() || 'ease-out' };
  };
  /** Transform that puts the hero picture exactly over the page candy (centre, size, tilt). */
  const fromSource = (btn: HTMLElement, target: HTMLElement) => {
    const img = btn.querySelector('img')!;
    const r = img.getBoundingClientRect(), t = target.getBoundingClientRect();
    const scaleOf = (el: Element) => parseFloat(getComputedStyle(el).scale) || 1;
    const size = Math.min(img.offsetWidth, img.offsetHeight) * scaleOf(img) * scaleOf(btn);
    const rot = parseFloat(getComputedStyle(btn).rotate) || 0;
    const dx = r.left + r.width / 2 - (t.left + t.width / 2), dy = r.top + r.height / 2 - (t.top + t.height / 2);
    return `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${size / t.width})`;
  };
  const inView = (el: Element) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; };
  // load + decode a candy's hero before the click so the grow never waits on (or stutters over) the image.
  // Hover/focus warms that candy right away; all heroes warm in idle time after load.
  const decoded = new Map<HTMLImageElement, Promise<void>>();
  const warmImg = (img: HTMLImageElement | null | undefined) => {
    if (!img) return Promise.resolve();
    if (!decoded.has(img)) { img.loading = 'eager'; decoded.set(img, img.decode().catch(() => {})); }
    return decoded.get(img)!;
  };
  const heroImg = (i: number | string) => dialog?.querySelector<HTMLImageElement>(`[data-hero="${i}"] img`);
  const warm = (e: Event) => {
    const btn = (e.target as Element).closest<HTMLElement>('.tile[data-index], .tl-candy[data-index]');
    if (btn) warmImg(heroImg(btn.dataset.index!));
  };
  document.addEventListener('pointerover', warm, { signal });
  document.addEventListener('focusin', warm, { signal });
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1500));
  const warmAll = () => idle(() => { for (let i = 0; i < count; i++) warmImg(heroImg(i)); });
  if (document.readyState === 'complete') warmAll(); else addEventListener('load', warmAll, { once: true, signal });
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // panel and candy run as one WAAPI group so they stay in step; the scrim is a CSS opacity transition started the same frame
  const panel = () => dialog?.querySelector<HTMLElement>('.panel') ?? null;
  const phone = () => matchMedia('(max-width: 48em)').matches;
  const panelFrames = () => (phone() ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: 'translateX(100%)' }, { transform: 'none' }]);

  let opening = 0; // bumped per open, so a close during the waits below cancels the pending motion
  const openDrawer = async (btn: HTMLElement) => {
    if (!dialog || dialog.open) return;
    render(Number(btn.dataset.index));
    source = { btn, index: current };
    const pic = heroPicture();
    if (!pic || reduce()) { dialog.showModal(); return; }
    // open straight away (so Esc / close work at once) but hold everything at its start pose: candy over the page
    // candy, scrim and drawer not shown. Then wait for the image (a short wait beats an image that pops in
    // mid-flight) and one painted frame (layout, blur, image upload), and only then start the motion.
    const id = ++opening;
    dialog.classList.add('is-opening');
    dialog.showModal();
    const from = fromSource(btn, pic); // measured once the dialog has a layout
    pic.style.transform = from;
    btn.style.visibility = 'hidden';
    await Promise.race([warmImg(pic.querySelector('img')), new Promise((r) => setTimeout(r, 400))]);
    await nextFrame();
    if (id !== opening || !dialog.open) return;
    const { duration, easing } = motion();
    const opts = { duration, easing };
    pic.style.transform = '';
    dialog.classList.remove('is-opening');
    pic.animate([{ transform: from }, { transform: 'none' }], opts);
    panel()?.animate(panelFrames(), opts);
  };
  const closeDrawer = async () => {
    if (!dialog?.open || closing) return;
    closing = true;
    const pic = heroPicture();
    // still in its start pose (closed before the motion began): nothing to play back
    const back = source && source.index === current && pic && !reduce() && inView(source.btn) && !dialog.classList.contains('is-opening') ? source.btn : null;
    if (back && pic) {
      const { duration, easing } = motion();
      const opts = { duration: duration * 0.8, easing, fill: 'forwards' as const };
      const done = pic.animate([{ transform: 'none' }, { transform: fromSource(back, pic) }], opts).finished;
      panel()?.animate([...panelFrames()].reverse(), opts);
      dialog.classList.add('is-closing'); // scrim fades out (CSS transition)
      await done.catch(() => {});
    }
    dialog.close();
  };
  dialog?.addEventListener('close', () => {
    opening++;
    dialog.classList.remove('is-closing', 'is-opening');
    const pic = heroPicture(); if (pic) pic.style.transform = '';
    for (const el of [heroPicture(), panel()]) el?.getAnimations().forEach((a) => a.cancel());
    if (source) source.btn.style.visibility = '';
    source = null; closing = false;
  }, { signal });
  dialog?.addEventListener('cancel', (e) => { e.preventDefault(); closeDrawer(); }, { signal }); // Esc

  // next/prev: a different candy is shown, so the page candy reappears in its spot
  const browse = (i: number) => { if (source) source.btn.style.visibility = ''; render(i); };

  // grid tiles and timeline candies both carry data-index (position in content/grid/candies.json)
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('.tile[data-index], .tl-candy[data-index]');
    if (!btn || !dialog) return;
    openDrawer(btn);
  }, { signal });
  dialog?.addEventListener('click', (e) => {
    const nav = (e.target as Element).closest<HTMLElement>('[data-nav]')?.dataset.nav;
    if (nav === 'close' || e.target === dialog || (e.target as Element).matches('[data-hero-area]')) closeDrawer();
    else if (nav === 'next') browse(current + 1);
    else if (nav === 'prev') browse(current - 1);
  }, { signal });
  // keyboard like the old candy page: -> next, <- previous, Esc closes (native)
  dialog?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') browse(current + 1);
    else if (e.key === 'ArrowLeft') browse(current - 1);
  }, { signal });

  cleanup = () => { ac.abort(); io.disconnect(); };
}

init();
document.addEventListener('astro:page-load', init);
