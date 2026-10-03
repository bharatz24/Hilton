/* =========================================================
   HILTON RENEWABLES — scroll experience
   GSAP + ScrollTrigger + Lenis. No build step.
   ========================================================= */
(() => {
'use strict';

/* ---------------------------------------------------------
   CONFIG — edit these, nothing else, to retune the site
--------------------------------------------------------- */
const CONFIG = {
  films: {
    a: { count: 150, dir: 'assets/frames',  eager: 34, canvas: '#filmCanvas',  poster: '#filmPoster',  fillPortrait: true },
    b: { count: 150, dir: 'assets/frames2', eager: 20, canvas: '#filmCanvasB', poster: '#filmPosterB' }
  },
  whatsapp: '918153980800',
  email: 'Inquiry@hiltonrenewables.com',
  // Backend endpoints (Spring Boot). Leave null to run fully client-side.
  api: { calculations: null, quotations: null },
  calc: {
    tariff: { RESIDENTIAL: 7.5, COMMERCIAL: 9.0, INDUSTRIAL: 8.5, SOLAR_FARM: 6.5, INSTITUTIONAL: 8.0 },
    genPerKwAvg: 120, genPerKwMin: 110, genPerKwMax: 130,
    roofPerKw: 100, roofPerKwMin: 90, roofPerKwMax: 110,
    savingsFactor: 0.90,
    co2PerUnitKg: 0.82,
    billMin: 500, billMax: 1000000,
    roundTo: 0.5
  }
};

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Conversion events — pushed to dataLayer for GA4 / GTM when present. */
function track(event, params){
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event }, params || {}));
    if (typeof window.gtag === 'function') window.gtag('event', event, params || {});
  } catch (_) {}
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-track]');
  if (el) track(el.dataset.track, { label: (el.textContent || '').trim().slice(0, 60) });
}, true);

gsap.registerPlugin(ScrollTrigger);

/* ---------------------------------------------------------
   1. SMOOTH SCROLL
--------------------------------------------------------- */
let lenis = null;
function initSmoothScroll(){
  if (REDUCED || typeof Lenis === 'undefined') return;
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, touchMultiplier: 1.6, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
}
function scrollToId(id){
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 10;
  if (lenis) lenis.scrollTo(y, { duration: 1.25 });
  else window.scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  if (!id || !document.getElementById(id)) return;
  e.preventDefault();
  if (document.body.classList.contains('menu-open')){
    document.body.classList.remove('menu-open');
    document.getElementById('burger')?.setAttribute('aria-expanded', 'false');
    lenis?.start();
  }
  requestAnimationFrame(() => scrollToId(id));
});

/* ---------------------------------------------------------
   2. FILM — canvas frame scrub (two sequences)
--------------------------------------------------------- */
function createFilm(cfg){
  const canvas = $(cfg.canvas);
  const f = {
    cfg, canvas, ctx: null, images: [], current: -1, lastIdx: 0, started: false, ready: false
  };
  if (!canvas) return f;
  f.ctx = canvas.getContext('2d', { alpha: true });

  f.src = i => `${cfg.dir}/f${String(i + 1).padStart(4, '0')}.webp`;

  f.load = i => new Promise(res => {
    if (f.images[i] !== undefined) return res();
    const img = new Image();
    img.decoding = 'async';
    img.onload = img.onerror = () => { f.images[i] = img.naturalWidth ? img : null; res(); };
    img.src = f.src(i);
  });

  f.draw = idx => {
    if (!f.ctx) return;
    let i = clamp(Math.round(idx), 0, cfg.count - 1);
    if (!f.images[i]) {
      let found = -1;
      for (let d = 1; d < cfg.count; d++){
        if (f.images[i - d]) { found = i - d; break; }
        if (f.images[i + d]) { found = i + d; break; }
      }
      if (found < 0) return;
      i = found;
    }
    f.lastIdx = idx;
    if (i === f.current) return;
    f.current = i;
    const img = f.images[i];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)){
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    f.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    f.ctx.clearRect(0, 0, w, h);
    // 16:9 footage letterboxes badly on phones — fill the viewport there instead
    const portrait = w / h < 1.05;
    const scale = (cfg.fillPortrait && portrait)
      ? Math.max(w / img.naturalWidth, h / img.naturalHeight) * 1.02
      : Math.min(w / img.naturalWidth, h / img.naturalHeight) * 1.02;
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    f.ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  };

  // eager batch -> first paint, then stream the remainder
  f.start = async onProgress => {
    if (f.started) return;
    f.started = true;
    const eager = Math.min(cfg.eager, cfg.count);
    let done = 0;
    await Promise.all(Array.from({ length: eager }, (_, i) =>
      f.load(i).then(() => { done++; onProgress && onProgress(done / eager); })
    ));
    f.ready = true;
    f.draw(0);
    const poster = $(cfg.poster);
    if (poster) gsap.to(poster, { opacity: 0, duration: .5, onComplete: () => poster.remove() });
    const queue = [];
    for (let i = eager; i < cfg.count; i++) queue.push(i);
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) await f.load(queue.shift());
    }));
    ScrollTrigger.refresh();
  };

  return f;
}

const films = {};

/* section, film, and the caption beats keyed to film progress */
function buildFilmScroll(sel, film, caps, opts = {}){
  const section = $(sel);
  if (!section || !film.canvas) return;

  if (REDUCED){
    film.start();
    $$('.cap', section).forEach(c => gsap.set(c, { autoAlpha: 1 }));
    return;
  }

  const layerItems = opts.layers ? $$(opts.layers) : [];

  ScrollTrigger.create({
    trigger: section, start: 'top top', end: 'bottom bottom', scrub: .45,
    onUpdate: self => {
      film.draw(self.progress * (film.cfg.count - 1));
      if (layerItems.length){
        const p = self.progress;
        layerItems.forEach(li => li.classList.toggle('on',
          p >= parseFloat(li.dataset.at) && p < parseFloat(li.dataset.at) + 0.055));
      }
    }
  });

  // pull the sequence in before the section arrives
  ScrollTrigger.create({
    trigger: section, start: 'top bottom+=120%',
    onEnter: () => film.start()
  });

  caps.forEach(c => {
    const el = $(c.el);
    if (!el) return;
    const inner = el.querySelector('.inner');
    if (c.hero){
      gsap.to(el, {
        autoAlpha: 0, y: -30, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + (window.innerHeight * 1.1), scrub: .4 }
      });
      return;
    }
    gsap.set(el, { autoAlpha: 0 });
    gsap.set(inner, { y: 40 });
    ScrollTrigger.create({
      trigger: section,
      start: () => `top+=${clamp(c.in, 0, 1) * section.offsetHeight} top`,
      end:   () => `top+=${clamp(c.out, 0, 1) * section.offsetHeight} top`,
      onEnter:     () => gsap.to([el, inner], { autoAlpha: 1, y: 0, duration: .7, ease: 'power3.out', overwrite: true }),
      onEnterBack: () => gsap.to([el, inner], { autoAlpha: 1, y: 0, duration: .7, ease: 'power3.out', overwrite: true }),
      onLeave:     () => gsap.to(el, { autoAlpha: 0, duration: .45, overwrite: true }),
      onLeaveBack: () => gsap.to(el, { autoAlpha: 0, duration: .45, overwrite: true })
    });
  });
}

function buildFilms(){
  buildFilmScroll('#home', films.a, [
    { el: '#cap1', hero: true },
    { el: '#cap2', in: 0.12, out: 0.30 },
    { el: '#cap3', in: 0.34, out: 0.50 },
    { el: '#cap4', in: 0.58, out: 0.76 },
    { el: '#cap5', in: 0.80, out: 1.02 }
  ]);
  buildFilmScroll('#module', films.b, [
    { el: '#capB1', in: 0.05, out: 0.46 },
    { el: '#capB2', in: 0.50, out: 0.72 },
    { el: '#capB3', in: 0.78, out: 1.02 }
  ], { layers: '#layerList li' });
}

/* ---------------------------------------------------------
   3. TEXT UTILITIES
--------------------------------------------------------- */
function splitWords(el){
  const html = el.innerHTML.split('<br>').map(line =>
    `<span class="rv-line"><span>${line.trim()}</span></span>`).join('');
  el.innerHTML = html;
  return $$('.rv-line > span', el);
}

function heroIntro(){
  const h = $('#cap1 .split');
  if (h && !h.querySelector('.rv-line')) splitWords(h);
  gsap.set('#cap1', { autoAlpha: 1 });
  gsap.set('#cap1 .inner', { y: 0 });
  const lines = $$('#cap1 .rv-line > span');
  const tl = gsap.timeline({ delay: .15 });
  if (lines.length) tl.from(lines, { yPercent: 115, duration: 1.15, ease: 'power4.out', stagger: .09 }, 0);
  tl.from('#cap1 .hero-kicker .chip', { y: 16, opacity: 0, duration: .7, stagger: .07, ease: 'power3.out' }, .15)
    .from('#cap1 .hero-sub', { y: 20, opacity: 0, duration: .8, ease: 'power3.out' }, .45)
    .from('#cap1 .hero-cta .btn', { y: 18, opacity: 0, duration: .7, stagger: .08, ease: 'power3.out' }, .6)
    .from('.scroll-hint', { opacity: 0, duration: .8 }, .9);
}

/* ---------------------------------------------------------
   4. GENERIC REVEALS
--------------------------------------------------------- */
function initReveals(){
  if (REDUCED){ gsap.set('.rv', { opacity: 1, y: 0 }); return; }
  $$('.rv').forEach(el => {
    gsap.to(el, {
      opacity: 1, y: 0, duration: .95, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  // manifesto word-by-word
  const m = $('#manifesto');
  if (m){
    m.innerHTML = m.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
    const words = $$('.w', m);
    ScrollTrigger.create({
      trigger: m, start: 'top 78%', end: 'bottom 55%', scrub: .4,
      onUpdate: self => {
        const n = Math.floor(self.progress * words.length * 1.12);
        words.forEach((w, i) => w.classList.toggle('on', i < n));
      }
    });
  }
}

/* ---------------------------------------------------------
   5. ENERGY FLOW
--------------------------------------------------------- */
function initEnergy(){
  const svg = $('#flowSvg');
  if (!svg) return;
  const nodes = ['#nSun', '#nPanel', '#nInv', '#nLoad', '#nGrid'].map(s => $(s, svg));
  const pulses = $$('.pulse', svg);

  pulses.forEach(u => {
    const id = u.getAttribute('href');
    const src = $(id, svg);
    const len = src.getTotalLength();
    u.style.strokeDasharray = `${len}`;
    u.style.strokeDashoffset = `${len}`;
    u._len = len;
  });

  if (REDUCED){
    nodes.forEach(n => gsap.set(n, { opacity: 1 }));
    pulses.forEach(u => u.style.strokeDashoffset = 0);
    return;
  }

  gsap.set(nodes, { opacity: .18 });
  gsap.set('.energy__legend', { opacity: .001, y: 14 });
  const tl = gsap.timeline({
    scrollTrigger: { trigger: '.energy', start: 'top top', end: 'bottom bottom', scrub: .6 }
  });
  tl.to(nodes[0], { opacity: 1, duration: .7 }, 0)
    .fromTo('#nSun .rays', { scale: .82, transformOrigin: '50% 50%' }, { scale: 1, duration: 1.4 }, 0)
    .to(pulses[0], { strokeDashoffset: 0, duration: 1.1, ease: 'none' }, .5)
    .to(nodes[1], { opacity: 1, duration: .5 }, 1.0)
    .to(pulses[1], { strokeDashoffset: 0, duration: 1, ease: 'none' }, 1.5)
    .to(nodes[2], { opacity: 1, duration: .5 }, 2.0)
    .to(pulses[2], { strokeDashoffset: 0, duration: 1, ease: 'none' }, 2.5)
    .to(nodes[3], { opacity: 1, duration: .5 }, 3.0)
    .to(pulses[3], { strokeDashoffset: 0, duration: 1, ease: 'none' }, 3.5)
    .to(nodes[4], { opacity: 1, duration: .5 }, 4.0)
    .to('.energy__legend', { opacity: 1, y: 0, duration: .5 }, .6);
}

/* ---------------------------------------------------------
   6. EPC TIMELINE
--------------------------------------------------------- */
function initEpc(){
  const steps = $$('.epc-step');
  const imgs  = $$('#epcMedia img');
  const fill  = $('#epcFill');
  const capTxt = $('#epcCapTxt');
  if (!steps.length) return;

  const activate = i => {
    steps.forEach((s, k) => s.classList.toggle('on', k === i));
    imgs.forEach((im, k) => im.classList.toggle('on', k === i));
    if (capTxt) capTxt.textContent = steps[i].querySelector('h3').textContent;
  };
  activate(0);
  if (REDUCED){ steps.forEach(s => s.classList.add('on')); return; }

  steps.forEach((s, i) => {
    ScrollTrigger.create({
      trigger: s, start: 'top 62%', end: 'bottom 46%',
      onEnter: () => activate(i), onEnterBack: () => activate(i)
    });
  });
  if (fill){
    ScrollTrigger.create({
      trigger: '#epcList', start: 'top 70%', end: 'bottom 60%', scrub: .5,
      onUpdate: self => { fill.style.height = (self.progress * 100).toFixed(2) + '%'; }
    });
  }
}

/* ---------------------------------------------------------
   7. FARM PARALLAX
--------------------------------------------------------- */
function initFarm(){
  const img = $('#farmImg');
  if (!img || REDUCED) return;
  gsap.fromTo(img,
    { scale: 1.22, yPercent: -5 },
    { scale: 1, yPercent: 5, ease: 'none',
      scrollTrigger: { trigger: '.farm', start: 'top bottom', end: 'bottom top', scrub: .5 } });
  gsap.from('.farm__stats div', {
    y: 24, opacity: 0, duration: .8, stagger: .1, ease: 'power3.out',
    scrollTrigger: { trigger: '.farm__stage', start: 'top 30%', once: true }
  });
}

/* ---------------------------------------------------------
   8. COUNTERS
--------------------------------------------------------- */
function initCounters(){
  $$('.count').forEach(el => {
    const to = parseFloat(el.dataset.to);
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => {
        if (REDUCED){ el.textContent = to; return; }
        gsap.to(o, { v: to, duration: 1.8, ease: 'power2.out',
          onUpdate: () => { el.textContent = Math.round(o.v).toString().padStart(String(to).length >= 2 ? 2 : 1, '0'); } });
      }
    });
  });
}

/* ---------------------------------------------------------
   9. HORIZONTAL PROJECTS
--------------------------------------------------------- */
function initHorizontal(){
  const section = $('#hscroll');
  const track = $('#htrack');
  if (!section || !track || REDUCED) return;

  const setup = () => {
    const distance = Math.max(0, track.scrollWidth - window.innerWidth + 40);
    section.style.height = (window.innerHeight + distance) + 'px';
    return distance;
  };
  let distance = setup();

  gsap.to(track, {
    x: () => -distance, ease: 'none',
    scrollTrigger: {
      trigger: section, start: 'top top', end: () => '+=' + distance, scrub: .5,
      invalidateOnRefresh: true
    }
  });
  ScrollTrigger.addEventListener('refreshInit', () => { distance = setup(); });
}

/* ---------------------------------------------------------
   10. CLIENT MARQUEE
--------------------------------------------------------- */
function initMarquee(){
  $$('.marquee__row').forEach(row => {
    row.innerHTML += row.innerHTML;             // seamless loop
    if (REDUCED) return;
    const dir = parseFloat(row.dataset.dir || 1);
    const tween = gsap.fromTo(row,
      { xPercent: dir > 0 ? 0 : -50 },
      { xPercent: dir > 0 ? -50 : 0, duration: 42, ease: 'none', repeat: -1 });
    row.addEventListener('mouseenter', () => tween.timeScale(.25));
    row.addEventListener('mouseleave', () => tween.timeScale(1));
  });
}

/* ---------------------------------------------------------
   11. CATALOG FLOAT + TILT
--------------------------------------------------------- */
function initCatalog(){
  const panel = $('#catalogPanel');
  if (!panel || REDUCED) return;
  gsap.to(panel, { y: -16, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  gsap.fromTo(panel, { rotationX: 14, rotationY: -12, scale: .92 },
    { rotationX: 2, rotationY: 6, scale: 1, ease: 'none',
      scrollTrigger: { trigger: '.catalog', start: 'top bottom', end: 'bottom top', scrub: .6 } });
  gsap.set(panel, { transformPerspective: 1100, transformOrigin: '50% 60%' });

  const sec = $('.catalog');
  sec.addEventListener('mousemove', e => {
    const r = sec.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - .5;
    const dy = (e.clientY - r.top) / r.height - .5;
    gsap.to(panel, { rotationY: 6 + dx * 12, rotationX: 2 - dy * 10, duration: .8, ease: 'power2.out', overwrite: 'auto' });
  });
}

/* ---------------------------------------------------------
   12. FINALE
--------------------------------------------------------- */
function initFinale(){
  const sec = $('.finale');
  if (!sec) return;
  if (REDUCED){ gsap.set(['#finaleLogo', '#finaleHead', '#finaleSub', '#finaleCta'], { opacity: 1 }); return; }
  gsap.set(['#finaleHead', '#finaleSub', '#finaleCta'], { opacity: 0, y: 24 });

  const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: .6 } });
  tl.fromTo('#finaleImg', { scale: 1.25, filter: 'brightness(1) saturate(1)' },
                          { scale: 1.02, filter: 'brightness(.45) saturate(.75)', ease: 'none', duration: 3 }, 0)
    .fromTo('#finaleScrim', { opacity: .35 }, { opacity: .96, ease: 'none', duration: 3 }, 0)
    .to('#finaleLogo', { opacity: 1, duration: .8 }, 1.1)
    .to('#finaleHead', { opacity: 1, y: 0, duration: .8 }, 1.5)
    .to('#finaleSub',  { opacity: 1, y: 0, duration: .8 }, 1.8)
    .to('#finaleCta',  { opacity: 1, y: 0, duration: .8 }, 2.0);
}

/* ---------------------------------------------------------
   13. NAV, CURSOR, MAGNETIC
--------------------------------------------------------- */
function initChrome(){
  const nav = $('#nav');
  const progress = $('#scroll-progress');

  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: self => { gsap.set(progress, { scaleX: self.progress }); }
  });

  // nav appears once the film is behind us
  ScrollTrigger.create({
    trigger: '.film', start: 'top+=22% top',
    onEnter: () => nav.classList.add('is-live'),
    onLeaveBack: () => nav.classList.remove('is-live')
  });
  ScrollTrigger.create({
    start: 80, end: 'max',
    onToggle: self => nav.classList.toggle('is-solid', self.isActive)
  });
  // scroll-spy: highlight the section currently in view
  $$('.nav__menu a[href^="#"]').forEach(a => {
    const sec = document.getElementById(a.getAttribute('href').slice(1));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 45%', end: 'bottom 45%',
      onToggle: self => a.classList.toggle('is-current', self.isActive)
    });
  });

  $$('.on-light').forEach(sec => {
    ScrollTrigger.create({
      trigger: sec, start: 'top 64px', end: 'bottom 64px',
      onToggle: self => {
        nav.classList.toggle('is-light', self.isActive);
        document.body.classList.toggle('cursor-light', self.isActive);
      }
    });
  });

  // mobile menu
  const burger = $('#burger');
  burger?.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', String(open));
    if (lenis) open ? lenis.stop() : lenis.start();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')){
      document.body.classList.remove('menu-open');
      burger?.setAttribute('aria-expanded', 'false');
      lenis?.start();
    }
  });

  if (REDUCED || window.matchMedia('(pointer:coarse)').matches) return;

  // sun cursor
  const cur = $('#cursor');
  if (cur){
    document.body.classList.add('sun-cursor');
    const half = cur.offsetWidth / 2 || 37;
    // 1:1 with the pointer — no easing, so the sun is exactly where you click
    let cx = -200, cy = -200, pending = null;
    const paint = () => { pending = null; cur.style.transform = `translate3d(${cx - half}px,${cy - half}px,0)`; };
    const move = e => {
      cx = e.clientX; cy = e.clientY;
      if (pending === null) pending = requestAnimationFrame(paint);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', () => cur.classList.add('is-down'), { passive: true });
    window.addEventListener('pointerup',   () => cur.classList.remove('is-down'), { passive: true });
    document.addEventListener('mouseleave', () => { cur.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { cur.style.opacity = '1'; });
  }
  $$('a, button, .sol-card, .hslide, .tile, .cl, input, select, textarea').forEach(el => {
    el.addEventListener('mouseenter', () => cur && cur.classList.add('is-big'));
    el.addEventListener('mouseleave', () => cur && cur.classList.remove('is-big'));
  });

  // magnetic buttons
  $$('.magnetic').filter(el => !el.closest('.modal')).forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      gsap.to(btn, { x: (e.clientX - r.left - r.width / 2) * .28, y: (e.clientY - r.top - r.height / 2) * .38,
        duration: .5, ease: 'power3.out' });
    });
    btn.addEventListener('mouseleave', () => gsap.to(btn, { x: 0, y: 0, duration: .7, ease: 'elastic.out(1,.4)' }));
  });

  // solution card depth
  $$('.sol-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
      gsap.to(card, { rotationY: dx * 6, rotationX: -dy * 6, transformPerspective: 900, duration: .6, ease: 'power2.out' });
    });
    card.addEventListener('mouseleave', () => gsap.to(card, { rotationY: 0, rotationX: 0, duration: .8, ease: 'power3.out' }));
  });
}

/* ---------------------------------------------------------
   14. CALCULATOR
--------------------------------------------------------- */
let lastCalc = null;

function roundKw(v){
  const step = CONFIG.calc.roundTo;
  return Math.max(step, Math.round(v / step) * step);
}

function calculate({ bill, ptype, roof }){
  const c = CONFIG.calc;
  const tariff = c.tariff[ptype] || c.tariff.RESIDENTIAL;
  const monthlyUnits = bill / tariff;
  let kw = monthlyUnits / c.genPerKwAvg;
  let limited = false;
  if (roof && roof > 0){
    const maxByRoof = roof / c.roofPerKw;
    if (maxByRoof < kw){ kw = maxByRoof; limited = true; }
  }
  kw = roundKw(kw);
  const genMin = kw * c.genPerKwMin, genMax = kw * c.genPerKwMax;
  const sMin = Math.min(bill, genMin * tariff) * c.savingsFactor;
  const sMax = Math.min(bill, genMax * tariff) * c.savingsFactor;
  const co2 = ((genMin + genMax) / 2) * 12 * c.co2PerUnitKg / 1000;
  return {
    capacityKw: kw, tariff,
    genMin: Math.round(genMin), genMax: Math.round(genMax),
    saveMin: sMin, saveMax: sMax,
    yearMin: sMin * 12, yearMax: sMax * 12,
    areaMin: Math.round(kw * c.roofPerKwMin), areaMax: Math.round(kw * c.roofPerKwMax),
    co2Tonnes: co2, roofLimited: limited,
    input: { bill, ptype, roof }
  };
}

function initCalculator(){
  const form = $('#calcForm');
  if (!form) return;
  const box = $('#calcResult');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const bill = parseFloat($('#bill').value);
    const city = $('#city').value.trim();
    const pin  = $('#pin').value.trim();
    const roof = parseFloat($('#roof').value) || 0;
    const ptype = $('#ptype').value;
    let ok = true;

    const setErr = (id, msg) => {
      const el = $(id); if (!el) return;
      el.textContent = msg;
      const ctl = el.parentElement && el.parentElement.querySelector('.f__ctl');
      if (ctl) ctl.classList.toggle('is-bad', !!msg);
      if (msg) ok = false;
    };
    setErr('#err-bill', !bill || bill < CONFIG.calc.billMin || bill > CONFIG.calc.billMax
      ? `Enter a bill between ${inr(CONFIG.calc.billMin)} and ${inr(CONFIG.calc.billMax)}` : '');
    setErr('#err-city', city ? '' : 'City is required');
    setErr('#err-pin', pin && !/^[1-9][0-9]{5}$/.test(pin) ? 'Enter a valid 6-digit PIN code' : '');
    setErr('#err-roof', roof && roof < 50 ? 'Roof area looks too small' : '');
    if (!ok) return;
    track('calculator_started', { propertyType: ptype, city });

    const btn = $('#calcBtnTxt'); const original = btn.textContent;
    btn.textContent = 'Calculating…';

    let r = null;
    if (CONFIG.api.calculations){
      try {
        const res = await fetch(CONFIG.api.calculations, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthlyBill: bill, propertyType: ptype, city, pinCode: pin, roofAreaSqFt: roof })
        });
        if (res.ok){
          const d = await res.json();
          r = { capacityKw: d.recommendedCapacityKw, genMin: d.monthlyGenerationMin, genMax: d.monthlyGenerationMax,
                saveMin: d.monthlySavingsMin, saveMax: d.monthlySavingsMax, yearMin: d.annualSavingsMin, yearMax: d.annualSavingsMax,
                areaMin: d.requiredRoofAreaMin, areaMax: d.requiredRoofAreaMax, roofLimited: false,
                co2Tonnes: ((d.monthlyGenerationMin + d.monthlyGenerationMax) / 2) * 12 * CONFIG.calc.co2PerUnitKg / 1000,
                input: { bill, ptype, roof } };
        }
      } catch (_) { /* fall through to local maths */ }
    }
    if (!r) r = calculate({ bill, ptype, roof });
    r.city = city; r.pin = pin;
    lastCalc = r;

    $('#rKw').textContent   = r.capacityKw + ' kW';
    $('#rGen').textContent  = `${r.genMin}–${r.genMax}`;
    $('#rSave').textContent = `${inr(r.saveMin)}–${inr(r.saveMax)}`;
    $('#rYear').textContent = `${inr(r.yearMin)}–${inr(r.yearMax)}`;
    $('#rArea').textContent = `${r.areaMin}–${r.areaMax} sq.ft.`;
    $('#rCo2').textContent  = r.co2Tonnes.toFixed(1) + ' t';
    $('#rWarn').classList.toggle('on', !!r.roofLimited);
    box.classList.add('on');
    btn.textContent = original;
    track('calculator_completed', { capacityKw: r.capacityKw, city, propertyType: ptype });
    ScrollTrigger.refresh();

    // prefill the quotation form — never ask twice for the same data
    $('#qbill').value = bill;
    $('#qcity').value = city;
    $('#qtype').value = ptype;
    $('#qkw').value   = r.capacityKw;
    if (roof) $('#qroof').value = roof;
    updateWaLink();
    gsap.from(box, { y: 18, opacity: 0, duration: .6, ease: 'power3.out' });
  });
}

/* ---------------------------------------------------------
   15. QUOTE FORM
--------------------------------------------------------- */
function quoteRef(){
  const y = new Date().getFullYear();
  const n = String(Math.floor(Math.random() * 900000) + 100000);
  return `HR-QT-${y}-${n}`;
}

function updateWaLink(){
  const name = $('#qname')?.value.trim();
  const city = $('#qcity')?.value.trim();
  const bill = $('#qbill')?.value;
  const kw   = $('#qkw')?.value;
  const type = $('#qtype')?.value?.toLowerCase();
  let msg = 'Hello, I am interested in installing a solar system.';
  if (name) msg += ` My name is ${name}.`;
  if (type) msg += ` Property type: ${type}.`;
  if (bill) msg += ` My monthly electricity bill is approximately ₹${bill}.`;
  if (kw)   msg += ` Suggested capacity: ${kw} kW.`;
  if (city) msg += ` City: ${city}.`;
  msg += ' Please share a quotation.';
  const a = $('#waQuote');
  if (a) a.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
}

function initQuote(){
  const form = $('#quoteForm');
  if (!form) return;
  ['#qname', '#qcity', '#qbill', '#qkw', '#qtype'].forEach(s => $(s)?.addEventListener('input', updateWaLink));
  updateWaLink();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#qname').value.trim();
    const wa   = $('#qwa').value.trim();
    const mail = $('#qemail').value.trim();
    const city = $('#qcity').value.trim();
    const bill = parseFloat($('#qbill').value);
    let ok = true;
    const setErr = (id, msg) => {
      const el = $(id); if (!el) return;
      el.textContent = msg;
      const ctl = el.parentElement && el.parentElement.querySelector('.f__ctl');
      if (ctl) ctl.classList.toggle('is-bad', !!msg);
      if (msg) ok = false;
    };
    setErr('#err-qname', name.length >= 2 && name.length <= 100 ? '' : 'Please enter your full name');
    setErr('#err-qwa', /^\+?[0-9\s-]{10,15}$/.test(wa) ? '' : 'Enter a valid WhatsApp number');
    setErr('#err-qemail', !mail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? '' : 'Enter a valid email address');
    setErr('#err-qcity', city ? '' : 'City is required');
    setErr('#err-qbill', bill > 0 ? '' : 'Enter your monthly electricity bill');
    if (!ok) return;

    const btn = $('#quoteBtnTxt'); const original = btn.textContent;
    btn.textContent = 'Submitting…';
    form.querySelector('button[type=submit]').disabled = true;

    const payload = {
      fullName: name, whatsappNumber: wa.replace(/[\s-]/g, ''), email: mail, city,
      pinCode: $('#pin')?.value.trim() || '', monthlyElectricityBill: bill,
      propertyType: $('#qtype').value, requiredCapacityKw: parseFloat($('#qkw').value) || null,
      roofAreaSqFt: parseFloat($('#qroof').value) || null, message: $('#qmsg').value.trim(),
      leadSource: lastCalc ? 'CALCULATOR' : 'GET_QUOTE',
      calculation: lastCalc ? { capacityKw: lastCalc.capacityKw, genMin: lastCalc.genMin, genMax: lastCalc.genMax,
        saveMin: Math.round(lastCalc.saveMin), saveMax: Math.round(lastCalc.saveMax) } : null,
      landingPage: location.href, referrer: document.referrer
    };

    let ref = null, sent = false;
    if (CONFIG.api.quotations){
      try {
        const res = await fetch(CONFIG.api.quotations, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (res.ok){ const d = await res.json(); ref = d.quotationReference; sent = true; }
      } catch (_) { /* handled below */ }
    }
    if (!ref) ref = quoteRef();

    const box = $('#quoteSuccess');
    box.innerHTML = sent
      ? `Thank you, ${name}. Your solar quotation request has been received — reference <b>${ref}</b>. Our solar expert will contact you shortly.`
      : `Thank you, ${name}. Your request is ready — reference <b>${ref}</b>. ` +
        `<a href="${$('#waQuote').href}" target="_blank" rel="noopener noreferrer"><b>Send it on WhatsApp</b></a> ` +
        `or email <a href="mailto:${CONFIG.email}?subject=${encodeURIComponent('Solar Quotation Request ' + ref)}&body=${encodeURIComponent(JSON.stringify(payload, null, 2))}"><b>${CONFIG.email}</b></a> and we will respond the same working day.`;
    box.classList.add('on');
    btn.textContent = original;
    form.querySelector('button[type=submit]').disabled = false;
    track('quotation_submitted', { reference: ref, leadSource: payload.leadSource, city });
    gsap.from(box, { y: 14, opacity: 0, duration: .5 });
  });
}

/* ---------------------------------------------------------
   15b. CONSULTATION BOOKING
--------------------------------------------------------- */
function initConsultation(){
  const form = $('#consultForm');
  if (!form) return;
  const date = $('#cdate');
  if (date){
    const t = new Date(); t.setDate(t.getDate() + 1);
    date.min = t.toISOString().slice(0, 10);
    date.value = t.toISOString().slice(0, 10);
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#cname').value.trim();
    const wa   = $('#cwa').value.trim();
    const mail = $('#cemail').value.trim();
    const city = $('#ccity').value.trim();
    const day  = $('#cdate').value;
    let ok = true;
    const setErr = (id, msg) => {
      const el = $(id); if (!el) return;
      el.textContent = msg;
      const ctl = el.parentElement && el.parentElement.querySelector('.f__ctl');
      if (ctl) ctl.classList.toggle('is-bad', !!msg);
      if (msg) ok = false;
    };
    setErr('#err-cname', name.length >= 2 ? '' : 'Please enter your full name');
    setErr('#err-cwa', /^\+?[0-9\s-]{10,15}$/.test(wa) ? '' : 'Enter a valid WhatsApp number');
    setErr('#err-cemail', !mail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? '' : 'Enter a valid email address');
    setErr('#err-ccity', city ? '' : 'City is required');
    setErr('#err-cdate', day ? '' : 'Pick a preferred date');
    if (!ok) return;

    const slot = $('#ctime').value;
    const type = $('#ctype').value.toLowerCase().replace('_', ' ');
    const msg = $('#cmsg').value.trim();
    const ref = 'HR-CS-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 900000) + 100000);
    const text = `Hello, I would like to book a free solar consultation.%0AName: ${name}%0ACity: ${city}` +
                 `%0AProperty: ${type}%0APreferred: ${day} (${slot})` + (msg ? `%0ANote: ${msg}` : '') +
                 `%0AReference: ${ref}`;
    const wurl = `https://wa.me/${CONFIG.whatsapp}?text=${text}`;
    const mailto = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Consultation Request ' + ref)}` +
                   `&body=${encodeURIComponent(`Name: ${name}\nWhatsApp: ${wa}\nEmail: ${mail}\nCity: ${city}\nProperty: ${type}\nPreferred: ${day} ${slot}\nNote: ${msg}\nReference: ${ref}`)}`;

    const box = $('#consultSuccess');
    box.innerHTML = `Thank you, ${name}. Your slot request for <b>${day}, ${slot}</b> is ready — reference <b>${ref}</b>. ` +
      `<a href="${wurl}" target="_blank" rel="noopener noreferrer"><b>Confirm on WhatsApp</b></a> or email ` +
      `<a href="${mailto}"><b>${CONFIG.email}</b></a>. We reply within one working day.`;
    box.classList.add('on');
    track('consultation_submitted', { city, propertyType: $('#ctype').value, slot });
    gsap.from(box, { y: 14, opacity: 0, duration: .5 });
  });
}


/* ---------------------------------------------------------
   MODALS — one dialog at a time, focus trapped
--------------------------------------------------------- */
const MODAL = { open: null, lastFocus: null };

function openModal(id, trigger){
  const el = document.getElementById(id);
  if (!el) return;
  if (MODAL.open && MODAL.open !== el) closeModal(true);
  MODAL.lastFocus = trigger || document.activeElement;
  MODAL.open = el;
  el.hidden = false;
  document.body.classList.add('modal-open');
  lenis && lenis.stop();
  const panel = el.querySelector('.modal__panel');
  const scrim = el.querySelector('.modal__scrim');
  const sheet = window.matchMedia('(max-width:860px)').matches;
  gsap.killTweensOf([panel, scrim]);
  gsap.to(scrim, { opacity: 1, duration: .35, ease: 'power2.out' });
  // x/y must be pinned to 0: GSAP reads the CSS translate(100%) as a pixel offset
  gsap.fromTo(panel,
    { x: 0, y: 0, xPercent: sheet ? 0 : 100, yPercent: sheet ? 100 : 0 },
    { x: 0, y: 0, xPercent: 0, yPercent: 0, duration: .55, ease: 'power3.out' });
  const body = el.querySelector('.modal__body');
  if (body) body.scrollTop = 0;
  const first = el.querySelector('input,select,textarea,button:not([data-close])');
  setTimeout(() => first && first.focus({ preventScroll: true }), 120);
  track('modal_opened', { id });
}

function closeModal(instant){
  const el = MODAL.open;
  if (!el) return;
  MODAL.open = null;
  const panel = el.querySelector('.modal__panel');
  const scrim = el.querySelector('.modal__scrim');
  const done = () => {
    el.hidden = true;
    if (!MODAL.open){ document.body.classList.remove('modal-open'); lenis && lenis.start(); }
  };
  const sheet = window.matchMedia('(max-width:860px)').matches;
  if (instant){
    gsap.set(scrim, { opacity: 0 });
    gsap.set(panel, { x: 0, y: 0, xPercent: sheet ? 0 : 100, yPercent: sheet ? 100 : 0 });
    done(); return;
  }
  gsap.to(scrim, { opacity: 0, duration: .3 });
  gsap.to(panel, Object.assign(
    { x: 0, y: 0, xPercent: sheet ? 0 : 100, yPercent: sheet ? 100 : 0 },
    { duration: .4, ease: 'power3.in', onComplete: done }));
  const back = MODAL.lastFocus;
  setTimeout(() => back && back.focus && back.focus({ preventScroll: true }), 60);
}

function initModals(){
  document.addEventListener('click', e => {
    const opener = e.target.closest('[data-modal]');
    if (opener){ e.preventDefault(); openModal(opener.dataset.modal, opener); return; }
    if (e.target.closest('[data-close]')){ e.preventDefault(); closeModal(); }
  });
  document.addEventListener('keydown', e => {
    if (!MODAL.open) return;
    if (e.key === 'Escape'){ e.preventDefault(); closeModal(); return; }
    if (e.key !== 'Tab') return;
    const f = [...MODAL.open.querySelectorAll('a[href],button,input,select,textarea')]
      .filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
}

/* ---------------------------------------------------------
   BOOT
--------------------------------------------------------- */
function boot(){
  $('#yr').textContent = new Date().getFullYear();
  initSmoothScroll();

  const fill = $('.pl-fill'), pct = $('#pl-pct');
  const done = () => {
    document.body.classList.add('loaded');
    heroIntro();
    buildFilms();
    initReveals();
    initEnergy();
    initEpc();
    initFarm();
    initCounters();
    initHorizontal();
    initMarquee();
    initCatalog();
    initFinale();
    initChrome();
    initCalculator();
    initModals();
    initQuote();
    initConsultation();
    ScrollTrigger.refresh();
  };

  films.a = createFilm(CONFIG.films.a);
  films.b = createFilm(CONFIG.films.b);

  films.a.start(p => {
    const v = Math.round(p * 100);
    if (fill) fill.style.width = v + '%';
    if (pct) pct.textContent = v;
  }).then(() => setTimeout(done, 200))
    .catch(() => done());

  // safety: never trap the user behind the preloader
  setTimeout(() => { if (!document.body.classList.contains('loaded')) done(); }, 8000);

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      Object.values(films).forEach(f => { if (f && f.ctx){ const at = f.lastIdx; f.current = -1; f.draw(at); } });
      ScrollTrigger.refresh();
    }, 180);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
