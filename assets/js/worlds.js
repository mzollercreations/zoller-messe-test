// Messe-App – Startseite, Produktwelten, Produktseiten (alle Produkte des Katalogs) und »Alle Produkte«.
// Bühne statt Liste: freigestellte Fotos im Spot, 3D aus den CAD-Daten, Filme, Galerie; Texte aus dem Katalog in 18 Sprachen.
import { ptx, wtx, product, shown, worlds, shownFilms, liveMap, isLive, filmsOf, prodId } from './catalog.js';

let C = null;   // Kontext aus app.js
export function initWorlds(ctx) { C = ctx; }

const esc = (s) => C.esc(s);
const plain = (s) => String(s || '').replace(/[»«]/g, '');
const dur = (f) => `${Math.floor(f.dur / 60)}:${String(Math.round(f.dur % 60)).padStart(2, '0')}`;

/** Name eines Produkts: Katalog, bei kuratierten Geräten die gepflegte Schreibweise */
export function pname(p) { return ptx(p.id).name || p.id; }
function pclaim(p) {
  const dev = p.dev && C.D.devices.find((d) => d.id === p.dev);
  const k = dev ? 'claim.' + dev.id : null;
  const c = k ? C.t(k) : '';
  return c && c !== k ? c : (ptx(p.id).teaser || ptx(p.id).claim || '');
}
function tags(p) {
  const live = liveMap();
  return [
    p.id in live ? `<span class="tag tag--live">${esc(C.t('live.tag'))}</span>` : '',
    filmsOf(p).length ? `<span class="tag">${C.ICON.film}${esc(C.t('tag.film'))}</span>` : '',
    p.model ? `<span class="tag">${C.ICON.cube}3D</span>` : '',
    C.ses.saved.has(p.id) ? `<span class="tag tag--saved">${C.ICON.heartOn}</span>` : '',
  ].join('');
}
/** Produktkarte: Foto im Spot, Name, Satz, Kennzeichen */
export function pcard(p, cls = '') {
  return `<button class="pc ${cls}" data-dev="${esc(p.id)}" data-rv>
    ${p.img ? `<span class="pc__stage"><img src="${esc(p.img)}" alt="" draggable="false" loading="lazy"></span>`
    : `<span class="pc__stage pc__stage--type"><i>${C.ICON.grid}</i><em>${esc(ptx(p.id).sub || '')}</em></span>`}
    <span class="pc__txt"><b>${esc(pname(p))}</b><span>${esc(pclaim(p))}</span></span>
    <span class="pc__tags">${tags(p)}</span>
  </button>`;
}
function fcard(f) {
  return `<button class="wf" data-play="${esc(f.id)}" data-rv>
    <span class="wf__img"><img src="${esc(f.thumb || f.poster)}" alt="" draggable="false" loading="lazy"><span class="wf__dur">${dur(f)}</span>
      <span class="wf__play">${C.ICON.play}</span></span>
    <span class="wf__txt"><b>${esc(C.t('film.' + f.id))}</b><span>${esc((f.products || []).map((id) => product(id)).filter(Boolean).slice(0, 3).map(pname).join(' · '))}</span></span>
  </button>`;
}

// ================================================================== Startseite
export function renderHome(el) {
  const ws = worlds();
  const live = liveMap();
  const liveP = shown().filter((p) => p.id in live);
  const films = shownFilms();
  const feat = films.find((f) => f.story) || films[0];
  const n = shown().length;
  const ev = C.eventLine();
  el.innerHTML = `<div class="wh">
    <section class="wh-hero">
      <video class="wh-hero__v" data-hero muted playsinline loop preload="auto" ${C.D.hero.posterLand ? `poster="${esc(C.abs(C.D.hero.posterLand))}"` : ''}></video>
      <div class="wh-hero__shade"></div>
      <div class="wh-hero__txt">
        <p class="kicker" data-rv>${esc(ev || 'ZOLLER')}</p>
        <h1 data-rv>${esc(C.t('home.h1'))}</h1>
        <p class="wh-hero__lead" data-rv>${esc(C.t('w.lead', { n }))}</p>
        <div class="row" data-rv>
          <button class="btn btn--yellow" data-scroll="worlds">${esc(C.t('w.explore'))}${C.ICON.right}</button>
          ${feat ? `<button class="btn btn--glass" data-play="${esc(feat.id)}">${C.ICON.play}${esc(C.t('film.' + feat.id))}</button>` : ''}
        </div>
      </div>
      <div class="wh-hero__scroll" aria-hidden="true"><i></i></div>
    </section>
    ${liveP.length ? `<section class="wh-sec">
      <header class="wh-sec__head"><div><p class="kicker" data-rv><i class="dot"></i>${esc(C.t('live.tag'))}</p><h2 data-rv>${esc(C.t('w.live.h'))}</h2></div></header>
      <div class="wh-rail wh-rail--live">${liveP.map((p) => pcard(p, 'pc--big')).join('')}</div>
    </section>` : ''}
    <section class="wh-sec" id="worlds">
      <header class="wh-sec__head"><div><p class="kicker" data-rv>${esc(C.t('w.worlds.k'))}</p><h2 data-rv>${esc(C.t('w.worlds.h'))}</h2></div>
        <button class="btn btn--sm btn--ghost" data-go="all">${C.ICON.grid}${esc(C.t('w.all'))}</button></header>
      <div class="wh-worlds" data-n="${ws.length}">${ws.map((w, i) => {
        const pics = w.items.filter((p) => p.img).slice(0, 3);
        return `<button class="ww ww--${i}" data-world="${esc(w.id)}" data-rv>
          ${w.wall ? `<span class="ww__bg" style="background-image:url('${esc(w.wall)}')"></span>` : ''}
          <span class="ww__pics">${pics.map((p) => `<img src="${esc(p.img)}" alt="" draggable="false" loading="lazy">`).join('')}</span>
          <span class="ww__txt"><b>${esc(wtx(w.id).name)}</b><small>${esc(wtx(w.id).text)}</small>
            <em>${esc(C.t(w.items.length === 1 ? 'w.n1' : 'w.n', { n: w.items.length }))}${C.ICON.right}</em></span>
        </button>`;
      }).join('')}</div>
    </section>
    ${films.length ? `<section class="wh-sec">
      <header class="wh-sec__head"><div><p class="kicker" data-rv>${esc(C.t('films.kicker'))}</p><h2 data-rv>${esc(C.t('w.films.h'))}</h2></div>
        <button class="btn btn--sm btn--ghost" data-go="films">${esc(C.t('w.films.all', { n: films.length }))}${C.ICON.right}</button></header>
      <div class="wh-rail">${films.slice(0, 10).map(fcard).join('')}</div>
    </section>` : ''}
    <section class="wh-sec">
      <header class="wh-sec__head"><div><p class="kicker" data-rv>${esc(C.t('w.more.k'))}</p><h2 data-rv>${esc(C.t('w.more.h'))}</h2></div></header>
      <div class="wh-tools">
        ${tool('cycle', C.ICON.cycle, C.t('w.cycle'), C.t('w.cycle.s'))}
        ${tool('calc', C.ICON.calc, C.t('home.calc'), C.t('home.calc.s'))}
        ${tool('planer', C.ICON.plan, C.t('home.planer'), C.t('home.planer.s'))}
        ${tool('contact', C.ICON.phone, C.t('home.contact'), C.t('home.contact.s'), true)}
      </div>
    </section>
    <footer class="wh-foot"><img src="assets/img/zoller.svg" alt="ZOLLER"><span>${esc([ev, 'expect great measures'].filter(Boolean).join(' · '))}</span></footer>
  </div>`;
  // Kamerafahrt durch den Werkzeugraum als Bühne (dieselbe wie auf der Webseite, nahtlos)
  const v = el.querySelector('[data-hero]');
  const src = innerWidth < innerHeight ? (C.D.hero.port || C.D.hero.land) : C.D.hero.land;
  if (src) C.mediaUrl(src).then((u) => { if (!v.isConnected) return; v.src = u; v.play().catch(() => {}); });
  // Bühne bleibt beim Scrollen zurück (Parallaxe), der Text blendet aus; außer Sicht steht der Film still (Akku, Wärme)
  if (!el.dataset.heroFx) {
    el.dataset.heroFx = '1';
    let r = 0;
    el.addEventListener('scroll', () => {
      if (r) return;
      r = requestAnimationFrame(() => {
        r = 0;
        const hero = el.querySelector('.wh-hero');
        if (!hero) return;
        const y = el.scrollTop, h = hero.offsetHeight;
        const vid = hero.querySelector('video'), txt = hero.querySelector('.wh-hero__txt');
        if (y < h) {
          vid.style.transform = `translate3d(0, ${y * 0.4}px, 0)`;
          txt.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
          txt.style.opacity = String(Math.max(0, 1 - y / (h * 0.55)));
          if (vid.paused && vid.src && C.ses.view === 'home') vid.play().catch(() => {});
        } else if (!vid.paused) vid.pause();
      });
    }, { passive: true });
  }
  el.querySelectorAll('[data-scroll]').forEach((b) => b.addEventListener('click', () => {
    el.querySelector('#' + b.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  el.querySelectorAll('[data-world]').forEach((b) => b.addEventListener('click', () => C.go('world', b.dataset.world)));
}
function tool(go, icon, title, sub, yellow) {
  return `<button class="wt${yellow ? ' wt--yellow' : ''}" data-go="${go}" data-rv><span class="wt__ic">${icon}</span>
    <span class="wt__txt"><b>${esc(title)}</b><small>${esc(sub)}</small></span><span class="wt__go">${C.ICON.right}</span></button>`;
}

// ================================================================== Produktwelt
export function renderWorld(el, id) {
  const w = worlds().find((x) => x.id === id);
  if (!w) return C.go('home');
  C.bump('world', id);
  const subs = [...new Set(w.items.map((p) => ptx(p.id).sub).filter(Boolean))];
  const st = C.ses.world && C.ses.world.id === id ? C.ses.world : (C.ses.world = { id, sub: '' });
  const list = st.sub ? w.items.filter((p) => ptx(p.id).sub === st.sub) : w.items;
  el.innerHTML = `<div class="wp">
    <header class="wp-head head">
      ${w.wall ? `<span class="wp-head__bg" style="background-image:url('${esc(w.wall)}')"></span>` : ''}
      <div><p class="kicker" data-rv>${esc(C.t('w.worlds.k'))}</p><h1 data-rv>${esc(wtx(id).name)}</h1><p data-rv>${esc(wtx(id).text)}</p></div>
    </header>
    ${subs.length > 1 ? `<nav class="chips wp-subs" data-rv><button data-sub="" class="${st.sub ? '' : 'is-on'}">${esc(C.t('w.all.short'))}</button>
      ${subs.map((s) => `<button data-sub="${esc(s)}" class="${st.sub === s ? 'is-on' : ''}">${esc(s)}</button>`).join('')}</nav>` : ''}
    <div class="wp-grid">${list.map((p) => pcard(p)).join('')}</div>
  </div>`;
  el.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => { st.sub = b.dataset.sub; renderWorld(el, id); C.reveal(el); }));
}

// ================================================================== Alle Produkte
export function renderAll(el) {
  const q = (C.ses.q || '').trim().toLowerCase();
  const ws = worlds();
  const hit = (p) => !q || [pname(p), ptx(p.id).teaser, ptx(p.id).claim, ptx(p.id).sub].join(' ').toLowerCase().replace(/[»«]/g, '').includes(q);
  const blocks = ws.map((w) => ({ w, items: w.items.filter(hit) })).filter((b) => b.items.length);
  el.innerHTML = `<div class="wrap wa">
    <div class="head"><div><p class="kicker" data-rv>ZOLLER</p><h1 data-rv>${esc(C.t('w.all'))}</h1></div>
      <label class="wa-search" data-rv>${C.ICON.search}<input data-q type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false"
        placeholder="${esc(C.t('w.search'))}" value="${esc(C.ses.q || '')}"></label></div>
    ${blocks.length ? blocks.map(({ w, items }) => `<section class="wa-sec"><h2>${esc(wtx(w.id).name)} <small>${items.length}</small></h2>
      <div class="wa-list">${items.map((p) => `<button class="wa-item" data-dev="${esc(p.id)}">
        <span class="wa-item__img">${p.thumb || p.img ? `<img src="${esc(p.thumb || p.img)}" alt="" loading="lazy">` : ''}</span>
        <span><b>${esc(pname(p))}</b><small>${esc(ptx(p.id).teaser || ptx(p.id).claim || '')}</small></span>
        <span class="wa-item__tags">${tags(p)}</span></button>`).join('')}</div></section>`).join('')
      : `<p class="wa-none">${esc(C.t('w.none'))}</p>`}
  </div>`;
  const inp = el.querySelector('[data-q]');
  inp.addEventListener('input', () => {
    C.ses.q = inp.value;
    clearTimeout(inp.t);
    inp.t = setTimeout(() => { const pos = inp.selectionStart; renderAll(el); const i2 = el.querySelector('[data-q]'); i2.focus(); i2.setSelectionRange(pos, pos); }, 180);
  });
}

// ================================================================== Produktseite
export function renderProduct(el, rawId) {
  const p = product(rawId);
  if (!p) return C.go('home');
  const id = p.id;
  const tx = ptx(id);
  const dev = p.dev ? C.D.devices.find((d) => d.id === p.dev) : null;
  const variants = dev?.variants?.length > 1 ? dev.variants : null;
  if (!C.ses.dev || C.ses.dev.id !== id) { C.ses.dev = { id, vi: 0, mode: p.model ? '3d' : 'photo' }; C.bump('device', id); }
  const st = C.ses.dev;
  const v = dev?.variants?.[variants ? st.vi : 0] || null;     // Baureihe (venturion 450|600|800 …) mit eigenen Kennzahlen
  const model = v?.model ? { model: v.model, screen: v.screen, size: v.size, ar: v.ar } : p.model;
  const films = filmsOf(p);
  const gallery = [p.header, ...(p.gallery || [])].filter(Boolean);
  if (st.mode === '3d' && !model) st.mode = 'photo';
  if (st.mode === 'gallery' && !gallery.length) st.mode = 'photo';
  const live = liveMap();
  const saved = C.ses.saved.has(id);
  const ar = model?.ar && C.arOK();
  const world = wtx(p.cat);
  const specsK = [...(v?.specs || []), ...(dev?.specs || [])];
  const facts = dev?.facts || [];
  const same = shown().filter((x) => x.cat === p.cat && x.id !== id);
  const similar = [...same.filter((x) => ptx(x.id).sub === tx.sub), ...same.filter((x) => ptx(x.id).sub !== tx.sub)].slice(0, 8);
  const list = shown(), idx = list.findIndex((x) => x.id === id);
  const prev = list[(idx - 1 + list.length) % list.length], next = list[(idx + 1) % list.length];
  const title = variants ? C.t('prod.' + dev.prod) : pname(p);
  el.innerHTML = `<div class="dev pp">
    <div class="dev__stage pp-stage pp-stage--${st.mode}" data-stage>
      <div class="dev__modes">
        ${p.img ? `<button data-mode="photo" class="${st.mode === 'photo' ? 'is-on' : ''}">${C.ICON.photo}${esc(C.t('dev.photo'))}</button>` : ''}
        ${model ? `<button data-mode="3d" class="${st.mode === '3d' ? 'is-on' : ''}">${C.ICON.cube}3D</button>` : ''}
        ${gallery.length ? `<button data-mode="gallery" class="${st.mode === 'gallery' ? 'is-on' : ''}">${C.ICON.gallery}${esc(C.t('w.gallery'))}</button>` : ''}
        ${films.length ? `<button data-mode="film">${C.ICON.film}${esc(C.t('dev.film'))}</button>` : ''}
      </div>
      ${st.mode === 'photo' && p.img ? `<div class="pp-photo"><img src="${esc(p.img)}" alt="" draggable="false"></div>` : ''}
      ${st.mode === 'gallery' ? `<div class="pp-gal" data-gal>${gallery.map((g) => `<figure><img src="${esc(g)}" alt="" draggable="false" loading="lazy"></figure>`).join('')}</div>
        <div class="pp-gal__dots">${gallery.map((_, i) => `<i class="${i === 0 ? 'is-on' : ''}"></i>`).join('')}</div>` : ''}
      ${st.mode === '3d' ? `<div class="dev__loader" data-loader><i></i></div><div class="dev__hint" data-hint>${C.ICON.rotate}${esc(C.t('dev.hint'))}</div>` : ''}
      ${variants && st.mode !== 'gallery' ? `<div class="dev__variants">${variants.map((x, i) => `<button data-vi="${i}" class="${i === st.vi ? 'is-on' : ''}">${esc(x.name)}</button>`).join('')}</div>` : ''}
    </div>
    <div class="dev__info">
      <div class="meter"><i data-meter></i></div>
      <div class="dev__scroll" data-dev-scroll>
        <div class="dev__chips" data-rv><button class="tag" data-world="${esc(p.cat)}"><b style="color:var(--yellow)">${esc(world.name)}</b>${tx.sub ? '&nbsp;· ' + esc(tx.sub) : ''}</button>
          ${id in live ? `<span class="tag tag--live">${esc(C.t('live.tag'))}${live[id] ? ' · ' + esc(live[id]) : ''}</span>` : ''}</div>
        <h1 data-rv>${esc(title)}</h1>
        <p class="dev__claim" data-rv>${esc(pclaim(p))}</p>
        ${tx.claim && tx.claim !== pclaim(p) ? `<p class="dev__role" data-rv>${esc(tx.claim)}</p>` : ''}
        ${specsK.length ? `<div class="specs">${specsK.map(([val, unit, key]) => `<div class="spec" data-rv><b>${esc(C.fmtVal(val))}${unit ? `<small>${esc(unit)}</small>` : ''}</b><span>${esc(C.t(key))}</span></div>`).join('')}</div>` : ''}
        ${tx.highlights?.length ? `<ul class="pp-hl">${tx.highlights.map((h) => `<li class="rv">${C.ICON.check}<span>${esc(h)}</span></li>`).join('')}</ul>` : ''}
        ${tx.headline || tx.intro?.length ? `<div class="pp-intro rv">${tx.headline ? `<h3>${esc(tx.headline)}</h3>` : ''}${(tx.intro || []).map((x) => `<p>${esc(x)}</p>`).join('')}</div>` : ''}
        ${facts.length ? `<ul class="facts">${facts.map((k) => `<li class="rv">${esc(C.t('fact.' + k))}<small>${esc(C.t('dev.source'))}: ${esc(C.t('src.' + k))}</small></li>`).join('')}</ul>` : ''}
        ${tx.features?.length ? `<h2 class="pp-h rv">${esc(C.t('w.features'))}</h2><div class="pp-feat">${tx.features.map((f) => `<div class="rv"><b>${esc(f.title)}</b>${f.text ? `<span>${esc(f.text)}</span>` : ''}</div>`).join('')}</div>` : ''}
        ${!tx.features?.length && tx.sections?.length ? `<div class="pp-feat">${tx.sections.map((f) => `<div class="rv"><b>${esc(f.title)}</b><span>${esc(f.text)}</span></div>`).join('')}</div>` : ''}
        ${tx.specs?.length ? `<h2 class="pp-h rv">${esc(C.t('w.specs'))}</h2>${tx.specs.map((s) => `<div class="pp-specs rv">${s.title ? `<b>${esc(s.title)}</b>` : ''}
          <table>${(s.head || []).filter(Boolean).length > 1 ? `<tr class="pp-specs__head">${s.head.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>` : ''}
          ${s.rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>`).join('')}</table></div>`).join('')}` : ''}
        ${films.length ? `<h2 class="pp-h rv">${esc(C.t('w.films.h'))}</h2><div class="pp-films">${films.map(fcard).join('')}</div>` : ''}
        ${similar.length ? `<h2 class="pp-h rv">${esc(C.t('w.similar'))}</h2><div class="pp-sim">${similar.map((x) => pcard(x, 'pc--mini')).join('')}</div>` : ''}
        <nav class="dev__nav rv">
          <button data-dev="${esc(prev.id)}">${C.ICON.left}<span><span>${esc(C.t('dev.prev'))}</span><b>${esc(pname(prev))}</b></span></button>
          <button data-dev="${esc(next.id)}"><span><span>${esc(C.t('dev.next'))}</span><b>${esc(pname(next))}</b></span>${C.ICON.right}</button>
        </nav>
      </div>
      <div class="dev__cta">
        ${films.length ? `<button class="btn btn--yellow" data-play="${esc(films[0].id)}">${C.ICON.play}${esc(C.t('dev.watch'))}</button>` : ''}
        <button class="btn" data-save="${esc(id)}">${saved ? C.ICON.heartOn : C.ICON.heart}${esc(C.t(saved ? 'dev.saved' : 'dev.save'))}</button>
        ${ar ? `<button class="btn" data-ar>${C.ICON.ar}${esc(C.t('dev.ar'))}</button>` : ''}
        <button class="btn" data-mobile="${esc(id)}">${C.ICON.phone}${esc(C.t('dev.mobile'))}</button>
      </div>
    </div>
  </div>`;
  const scroller = el.querySelector('[data-dev-scroll]');
  scroller.scrollTop = 0;
  C.scrollMeter(scroller, el.querySelector('[data-meter]'));
  scroller.addEventListener('scroll', () => document.querySelector('.bar').classList.toggle('is-scrolled', scroller.scrollTop > 8), { passive: true });
  el.querySelectorAll('.spec b').forEach((b, i) => C.countUp(b, { delay: 260 + i * 90 }));
  el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.mode === 'film') return C.playFilm(films[0].id);
    st.mode = b.dataset.mode; renderProduct(el, id); C.reveal(el);
  }));
  el.querySelectorAll('[data-vi]').forEach((b) => b.addEventListener('click', () => { st.vi = +b.dataset.vi; renderProduct(el, id); C.reveal(el); }));
  el.querySelectorAll('[data-world]').forEach((b) => b.addEventListener('click', () => C.go('world', b.dataset.world)));
  el.querySelector('[data-ar]')?.addEventListener('click', async () => {
    C.bump('ar', id);
    try { const { openAR } = await import('./viewer.js'); await openAR(model.ar); } catch (e) { C.toast(C.t('dev.ar.fail')); console.warn(e); }
  });
  const gal = el.querySelector('[data-gal]');
  if (gal) {
    const dots = [...el.querySelectorAll('.pp-gal__dots i')];
    gal.addEventListener('scroll', () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); dots.forEach((d, j) => d.classList.toggle('is-on', i === j)); C.poke(); }, { passive: true });
  }
  const stage = el.querySelector('[data-stage]');
  if (st.mode === '3d') {
    C.getViewer().then(async (vw) => {
      if (C.ses.view !== 'device' || C.ses.dev?.id !== id) return;
      vw.attach(stage);
      const ok = await vw.show(model, { reset: true }).catch((e) => { console.warn(e); return false; });
      el.querySelector('[data-loader]')?.classList.add('is-done');
      stage.classList.add('is-ready');
      if (!ok && C.ses.dev?.mode === '3d' && p.img) { st.mode = 'photo'; renderProduct(el, id); }
    });
  } else C.viewerDetach();
}

/** Titel in der Kopfleiste für eine Produktseite */
export function productBarTitle(id) {
  const p = product(id);
  return p ? wtx(p.cat).name : '';
}
export { prodId };
