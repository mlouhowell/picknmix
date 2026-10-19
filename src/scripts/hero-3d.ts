// Candy page hero (Phase 5): PNG poster first; when the hero is visible and the poster has painted,
// import() three + the candy module, then cross-fade to the canvas. Pauses off-screen / in hidden tabs.
// Keeps the poster on WebGL failure or with ?no3d. Ships in the initial bundle, so keep it tiny.
type API = { setVisible(v: boolean): void; dispose(): void };
let current: { api?: API; io: IntersectionObserver; onVis: () => void } | null = null;

function teardown() {
  if (!current) return;
  current.io.disconnect();
  document.removeEventListener('visibilitychange', current.onVis);
  current.api?.dispose();
  current = null;
  delete (window as unknown as { candy?: unknown }).candy; // never leave a disposed API behind
}

function init() {
  teardown();
  const hero = document.querySelector<HTMLElement>('[data-model3d]');
  if (!hero || new URLSearchParams(location.search).has('no3d')) return;
  const { seed } = JSON.parse(hero.dataset.model3d!) as { seed: number };
  const slug = hero.dataset.slug!;
  let inView = false, started = false;
  const state: NonNullable<typeof current> = {
    io: new IntersectionObserver(([e]) => {
      inView = !!e?.isIntersecting;
      state.api?.setVisible(inView && !document.hidden);
      if (inView && !started) { started = true; void start(); }
    }),
    onVis: () => state.api?.setVisible(inView && !document.hidden),
  };
  current = state;
  document.addEventListener('visibilitychange', state.onVis);
  state.io.observe(hero);

  async function start() {
    try {
      await hero!.querySelector('img')?.decode().catch(() => {}); // poster painted first
      const { mountCandy } = await import('../three/mount');
      if (current !== state) return; // navigated away meanwhile
      const small = matchMedia('(max-width: 700px)').matches;
      const api = await mountCandy(hero!, slug, { seed, maxPixelRatio: small ? 1.5 : 2 });
      if (current !== state) { api.dispose(); return; }
      state.api = api;
      api.setVisible(inView && !document.hidden);
      hero!.classList.add('is-3d');
      (window as unknown as { candy: unknown }).candy = api; // same hook as the standalone previews
    } catch (e) {
      console.warn('[candy] 3D unavailable, keeping the poster', e);
    }
  }
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardown);
