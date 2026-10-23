// ZOLLER Messe-App – Steuerung: Dauerschleife, Sitzung, Ansichten, Rückfrage bei Inaktivität, Personalbereich.
import { setLang, t, lang, apply, TOUCH, num, money, intl } from './i18n.js';
import { loadSettings, saveSettings, bump } from './store.js';
import { useData, startSync, saveLead, newLead, hubspotConfig, purgeSent } from './leads.js';
import { BASE, abs, mediaUrl, json, registerSW } from './media.js';
import { Player, captions, bindCaptions, filmSrc } from './player.js';
import { qrSvg } from './qr.js';
import { swapViews, reveal, countUp, tween, fly, ripples, railFx, scrollMeter, REDUCED } from './motion.js';
import { useCatalog, settings as catalogSettings, loadText, product, shownFilms, liveMap, interestKey } from './catalog.js';
import * as W from './worlds.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/></svg>',
  film: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/></svg>',
  calc: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8.5 7.5h7M8.5 12h1M12 12h1M15 12h.5M8.5 15.5h1M12 15.5h1M15 15.5h.5"/></svg>',
  cube: '<svg viewBox="0 0 24 24"><path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z"/><path d="M4 7.4l8 4.6 8-4.6M12 12v9.2"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  heartOn: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  ar: '<svg viewBox="0 0 24 24"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M12 7.5l4 2.3v4.4l-4 2.3-4-2.3V9.8z"/></svg>',
  qr: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  photo: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 8"/></svg>',
  rotate: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6"/><path d="M18 3v4h-4M6 21v-4h4"/></svg>',
  plan: '<svg viewBox="0 0 24 24"><path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  cycle: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9"/><path d="M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2"/><circle cx="12" cy="12" r="2.2"/></svg>',
  gallery: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="14" height="13" rx="2.5"/><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V15"/><path d="M3 16l4-4 4 4 2-2 4 4"/></svg>',
};

let D = null;          // data/kiosk.json
let S = loadSettings();
let reg = null;        // Service Worker
const ses = { on: false, lang: 'de', saved: new Set(), films: new Set(), calc: null, plan: null, dev: null, stack: [], view: null, form: null };
let player, viewer = null, staff = null, railOff = null;

const film = (id) => D.films.find((f) => f.id === id);
const stepKey = (n) => D.steps.find((s) => s.n === n)?.key;
const site = (code = S.site) => D.sites[code] || D.sites['de-DE'];
const langInfo = (c) => D.langs.find((l) => l.code === c);

function name(d, v) {
  const p = v?.prod || d.prod || d.variants?.[0]?.prod;
  return p ? t('prod.' + p) : t('prod.' + d.id);
}
const role = (d, v) => t('role.' + (v?.prod || d.prod || d.id));
const filmTitle = (f) => t('film.' + f.id);
const filmDevices = (f) => (f.products || []).map(product).filter(Boolean).slice(0, 4).map(W.pname).join(' · ');

function fmtVal(v) {
  const dec = num(1.5).replace(/\d/g, '');
  if (/^\d+$/.test(v)) return num(+v);
  return v.replace(/(\d),(\d)/g, `$1${dec}$2`);
}
function eventLine(withBooth = true) {
  const e = S.event;
  if (!e) return withBooth ? S.booth : '';
  const city = typeof e.city === 'string' ? e.city : (e.city?.[lang()] || e.city?.[lang().split('-')[0]] || e.city?.en || e.city?.de || '');
  // »EMO Hannover · Hannover« → Ort nur, wenn er nicht schon im Namen steht
  return [e.title, city && !(e.title || '').toLowerCase().includes(city.toLowerCase()) ? city : '', withBooth ? S.booth : ''].filter(Boolean).join(' · ');
}
// Sprache der Oberfläche und der Katalogtexte (Produkte, Welten) zusammen wechseln
const setLangAll = (l) => Promise.all([setLang(l), loadText(l)]);
function toast(msg, ms = 2600) {
  const el = $('[data-toast]');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, ms);
}

// ================================================================== Start
async function boot() {
  try {
    reg = await registerSW();
    D = await json('data/kiosk.json');
  } catch (e) {
    $('[data-boot]').innerHTML += `<p style="color:#ff6b5e;padding:20px;text-align:center">Daten konnten nicht geladen werden (${esc(e.message)}).<br>Bitte einmal mit Internet öffnen.</p>`;
    return;
  }
  if (!D.langs.some((l) => l.code === S.lang)) S.lang = 'de';
  // Leads: Warteschlange auf dem iPad, Übertragung an HubSpot sobald Netz da ist (ersetzt Captello/snapADDY)
  useData(D);
  startSync({ config: () => hubspotConfig(S.hubspot), lang: () => (S.lang === 'de' ? 'de' : 'en') });
  purgeSent(30).catch(() => {});      // übertragene Leads nach 30 Tagen vom iPad löschen (sie sind in HubSpot)
  useCatalog(D, S);
  initWorlds();
  await setLangAll(S.lang);
  ses.lang = S.lang;
  player = new Player($('[data-player]'), {
    t, onEnd: filmEnd, onState: () => poke(),
  });
  player.onClose = () => poke();
  wire();
  idleLoop();
  setInterval(() => { if (navigator.onLine) reg?.update().catch(() => {}); }, 30 * 60 * 1000);
  $('[data-boot]').classList.add('is-out');
  setTimeout(() => $('[data-boot]').remove(), 700);
  if (!S.setup) { await openStaff(true); if (!staff?.isOpen?.()) startAttract(); return; }
  if (locked()) { lockApp(true); return; }
  startAttract();
}

// ================================================================== Dauerschleife
const A = { on: false, i: 0, cur: 0, timer: null, unbind: null, touchI: 0 };

function attractItems() {
  const vis = new Set(shownFilms().map((f) => f.id));
  const ids = (S.attract.films || [...vis]).filter((id) => vis.has(id));
  const list = ids.map(film).filter(Boolean);
  const out = [];
  list.forEach((f) => { if (D.hero.land) out.push({ hero: true }); out.push({ film: f }); });
  if (!out.length && D.hero.land) out.push({ hero: true });
  return out;
}

function startAttract() {
  if (locked()) return;          // App gesperrt: keine Dauerschleife hinter dem Hinweis
  A.on = true; A.items = attractItems(); A.i = 0;
  const el = $('[data-attract]');
  el.hidden = false;
  $('[data-app]').hidden = true;
  if (D.hero.posterLand) el.style.background = `#000 url("${abs(innerWidth < innerHeight ? D.hero.posterPort : D.hero.posterLand)}") center/cover`;
  const ev = eventLine(false);
  $('[data-a-event]').innerHTML = ev || S.booth ? `<b>${esc(ev || '')}</b>${esc(S.booth || '')}` : '';
  const live = Object.entries(liveMap()).filter(([id]) => product(id));
  $('[data-a-live]').innerHTML = live.map(([id, where]) => `<span>${esc(t('live.short', { name: W.pname(product(id)) }))}${where ? ' · ' + esc(where) : ''}</span>`).join('');
  const chips = [...new Set([S.lang, 'en', 'fr', 'es', 'it', 'pl', 'zh', 'ja'])].slice(0, 7);
  $('[data-a-langs]').innerHTML = chips.map((c) => `<button data-a-lang="${c}">${esc(langInfo(c)?.name || c)}</button>`).join('')
    + `<button data-a-lang="*">+${D.langs.length - chips.length}</button>`;
  A.touchI = 0; touchCycle();
  clearInterval(A.touchT); A.touchT = setInterval(touchCycle, 2600);
  attractNext();
}
function touchCycle() {
  const order = [...new Set([S.lang, 'en', ...D.langs.map((l) => l.code)])];
  const el = $('[data-a-touch]');
  el.style.opacity = 0;
  setTimeout(() => { el.textContent = TOUCH[order[A.touchI++ % order.length]] || TOUCH.en; el.style.opacity = 1; }, 300);
}
async function attractNext() {
  if (!A.on) return;
  clearTimeout(A.timer);
  A.unbind?.(); A.unbind = null;
  const item = A.items[A.i++ % A.items.length];
  if (!item) return;
  const vids = $$('[data-attract] video');
  A.cur ^= 1;
  const v = vids[A.cur], other = vids[A.cur ^ 1];
  v.onended = null; v.onerror = null;
  const portrait = innerWidth < innerHeight;
  const path = item.hero ? (portrait && D.hero.port ? D.hero.port : D.hero.land) : filmSrc(item.film, S.lang);
  try {
    v.src = await mediaUrl(path, [other.src]);
  } catch { A.timer = setTimeout(attractNext, 5000); return; }
  if (!A.on) return;
  v.muted = true; v.loop = !!item.hero; v.playsInline = true;
  try { v.currentTime = 0; await v.play(); } catch (e) { console.warn('Schleife', e); A.timer = setTimeout(attractNext, 6000); return; }
  if (!A.on) { v.pause(); return; }
  v.classList.add('is-on'); other.classList.remove('is-on');
  setTimeout(() => { if (!other.classList.contains('is-on')) other.pause(); }, 1300);
  const now = $('[data-a-now]');
  if (item.hero) {
    now.innerHTML = '';
    A.timer = setTimeout(attractNext, 26000);
  } else {
    const f = item.film;
    now.innerHTML = `<b>${esc(filmTitle(f))}</b> · ${esc(filmDevices(f))}`;
    const cues = S.attract.captions ? await captions(f, S.lang) : null;
    A.unbind = bindCaptions(v, $('[data-a-cap]'), cues);
    v.onended = () => attractNext();
    v.onerror = () => attractNext();
    A.timer = setTimeout(attractNext, ((f.dur || 120) + 8) * 1000);   // Sicherheitsnetz, falls »ended« ausbleibt
  }
}
function stopAttract() {
  A.on = false;
  clearTimeout(A.timer); clearInterval(A.touchT);
  A.unbind?.(); A.unbind = null;
  $$('[data-attract] video').forEach((v) => { v.pause(); v.onended = null; });
  $('[data-attract]').hidden = true;
}

// ================================================================== Sitzung
async function startSession(l = S.lang) {
  // die Schleife zoomt sanft weg, darunter baut sich die Startseite auf
  const a = $('[data-attract]');
  const leaving = !a.hidden && !REDUCED;
  if (leaving) { A.on = false; clearTimeout(A.timer); clearInterval(A.touchT); a.classList.add('is-leaving'); } else stopAttract();
  ses.on = true; ses.saved = new Set(); ses.films = new Set(); ses.calc = null; ses.calcShown = null; ses.plan = null; ses.dev = null; ses.stack = []; ses.form = null;
  ses.calcCounted = false; ses.planerCounted = false; ses.qrCounted = false; ses.world = null; ses.q = '';
  await useLang(l, false);
  $('[data-app]').hidden = false;
  bump('sessions'); bump('lang', l);
  go('home', null, { push: false });
  if (leaving) setTimeout(() => { a.classList.remove('is-leaving'); stopAttract(); }, 750);
  poke();
}

async function endSession() {
  closeSheet(); hideIdle();
  if (player.open) player.close();
  viewer?.detach();
  const fr = $('[data-planer]');
  if (fr.src) fr.src = 'about:blank';
  fr.removeAttribute('src');
  ses.on = false; ses.view = null; ses.param = null;
  ses.saved = new Set();
  Z?.set(null);   // nächster Besucher: wieder die Währung des Messelandes
  $$('.view').forEach((v) => { v.classList.remove('is-on', 'v-in', 'v-out', 'v-back'); if (v.dataset.view !== 'planer') v.innerHTML = ''; });
  // wartendes Update jetzt einspielen (niemand nutzt das iPad gerade)
  if (reg?.waiting) {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    reg.waiting.postMessage('skipWaiting');
    return;
  }
  if (lang() !== S.lang) await setLangAll(S.lang);
  startAttract();
}

async function useLang(l, rerender = true) {
  ses.lang = l;
  await setLangAll(l);
  apply();
  $('[data-lang-label]').textContent = (l.split('-')[0]).toUpperCase() + (l.includes('-') ? '-' + l.split('-')[1] : '');
  if (rerender && ses.view) {
    render(ses.view, ses.param);
    if (ses.view === 'planer') openPlaner(true);
  }
}

// ================================================================== Navigation
function go(view, param = null, { push = true, dir = 1 } = {}) {
  if (push && ses.view && !(ses.view === view && ses.param === param)) ses.stack.push([ses.view, ses.param]);
  if (view === 'home') ses.stack = [];
  const from = ses.view ? $(`[data-view="${ses.view}"]`) : null;
  ses.view = view; ses.param = param;
  if (view !== 'device') viewer?.detach();
  if (view !== 'home') $$('[data-view="home"] video').forEach((v) => v.pause());
  render(view, param);
  const cur = $(`[data-view="${view}"]`);
  if (cur && view !== 'planer' && view !== 'device') cur.scrollTop = 0;
  swapViews(from, cur, dir);
  reveal(cur);
  if (cur && !cur.dataset.fx) {
    cur.dataset.fx = '1';
    let r = 0;
    cur.addEventListener('scroll', () => {
      if (r) return;
      r = requestAnimationFrame(() => {
        r = 0;
        const y = cur.scrollTop;
        $('.bar').classList.toggle('is-scrolled', y > 8);
        const head = $('.head', cur);
        if (head && !REDUCED) { head.style.transform = `translate3d(0, ${Math.min(y, 400) * 0.35}px, 0)`; head.style.opacity = String(Math.max(0, 1 - y / 320)); }
      });
    }, { passive: true });
  }
  $('[data-back]').hidden = view === 'home';
  $('.bar').classList.remove('is-scrolled');
  poke();
}
function back() {
  const p = ses.stack.pop();
  if (p) go(p[0], p[1], { push: false, dir: -1 }); else go('home', null, { push: false, dir: -1 });
}

function render(view, param) {
  const el = $(`[data-view="${view}"]`);
  const titles = { home: '', world: '', all: '', cycle: t('w.cycle'), films: t('films.h'), calc: t('calc.kicker'), planer: t('planer.h'), contact: t('contact.h'), thanks: '' };
  $('[data-bar-title]').textContent = view === 'device' ? W.productBarTitle(param) : (titles[view] ?? '');
  if (view === 'home') W.renderHome(el);
  else if (view === 'world') W.renderWorld(el, param);
  else if (view === 'all') W.renderAll(el);
  else if (view === 'cycle') renderCycle(el);
  else if (view === 'device') W.renderProduct(el, param);
  else if (view === 'films') renderFilms(el);
  else if (view === 'calc') renderCalc(el);
  else if (view === 'planer') openPlaner();
  else if (view === 'contact') renderContact(el);
  else if (view === 'thanks') renderThanks(el, param);
  updateSaved();
}

function updateSaved(bumpIt) {
  const b = $('.bar__saved');
  const n = ses.saved.size + (ses.calc ? 1 : 0) + (ses.plan ? 1 : 0);
  $('[data-saved-n]').textContent = n;
  b.classList.toggle('has', n > 0);
  if (bumpIt) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
}
function toggleSave(id) {
  if (ses.saved.has(id)) ses.saved.delete(id); else { ses.saved.add(id); bump('saved', id); }
  updateSaved(true);
  return ses.saved.has(id);
}

// ================================================================== Seiten aus worlds.js (Start, Welten, Produkte) – Kontext
function initWorlds() {
  W.initWorlds({
    get D() { return D; }, ses, t, esc, ICON, go, playFilm, getViewer, viewerDetach: () => viewer?.detach(), bump, arOK, reveal, countUp,
    scrollMeter, fmtVal, name, eventLine, abs, mediaUrl, toast, poke,
  });
}

// ================================================================== Werkzeugkreislauf (die neun Geräte entlang des Kreislaufs)
function renderCycle(el) {
  el.innerHTML = `<div class="home">
    <div class="home__top home__top--cycle">
      <div class="home__intro">
        <p class="kicker" data-rv>${esc(t('w.cycle'))}</p>
        <h1 data-rv>${esc(t('w.cycle.h'))}</h1>
        <p class="lead" data-rv>${esc(t('home.lead'))}</p>
      </div>
    </div>
    <nav class="steps" data-steps data-rv><i class="steps__pill" data-pill></i>${D.steps.map((s) => `<button data-step="${s.n}"><em>0${s.n}</em>${esc(t('step.' + s.key))}</button>`).join('')}</nav>
    <div class="rail" data-rail>${D.devices.map(card).join('')}</div>
  </div>`;
  const rail = $('[data-rail]', el), nav = $('[data-steps]', el), pill = $('[data-pill]', el);
  // Rastpunkte der Reihe (je Karte links bündig, hinten aufs Reihenende gekappt) mit ihrem Schritt.
  // Die letzten Karten kommen nie nach links – ohne Ausgleich bliebe die Marke ganz rechts auf 05 stehen.
  // Darum von hinten auffüllen: Reihenende = letzter Schritt, davor höchstens ein Schritt Abstand je Rastpunkt.
  const stops = () => {
    const cards = $$('.dcard', rail);
    if (!cards.length) return [];
    const x0 = cards[0].offsetLeft, max = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const pos = [...new Set(cards.map((c) => Math.round(Math.min(c.offsetLeft - x0, max))))];
    const vorne = (p) => +(cards.find((c) => c.offsetLeft - x0 + c.offsetWidth > p + 40) || cards.at(-1)).dataset.stepN;
    const n = pos.map(vorne);
    n[n.length - 1] = +cards.at(-1).dataset.stepN;
    for (let j = n.length - 2; j >= 0; j--) n[j] = Math.min(n[j + 1], Math.max(n[j], n[j + 1] - 1));
    n[0] = vorne(0);
    return pos.map((p, j) => ({ p, n: n[j] }));
  };
  // gelbe Marke gleitet unter den Schritt des nächstgelegenen Rastpunkts
  const mark = () => {
    const S = stops(), s = rail.scrollLeft;
    if (!S.length) return;
    const n = String(S.reduce((a, b) => (Math.abs(b.p - s) < Math.abs(a.p - s) ? b : a)).n);
    let on = null;
    $$('[data-step]', el).forEach((b) => { const is = b.dataset.step === n; b.classList.toggle('is-on', is); if (is) on = b; });
    if (on) {
      pill.style.width = `${on.offsetWidth}px`;
      pill.style.transform = `translateX(${on.offsetLeft}px)`;
      const want = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
      if (Math.abs(nav.scrollLeft - want) > 4 && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: want, behavior: REDUCED ? 'auto' : 'smooth' });
    }
  };
  rail.addEventListener('scroll', () => { cancelAnimationFrame(mark.r); mark.r = requestAnimationFrame(mark); }, { passive: true });
  requestAnimationFrame(() => { mark(); requestAnimationFrame(() => pill.classList.add('is-ready')); });
  railOff?.(); railOff = railFx(rail);
  $$('[data-step]', el).forEach((b) => b.addEventListener('click', () => {
    const k = +b.dataset.step, S = stops();
    const z = S.find((x) => x.n === k) || S.find((x) => x.n > k) || S.at(-1);
    if (z) rail.scrollTo({ left: z.p, behavior: 'smooth' });
  }));
}

function card(d) {
  const v0 = d.variants[0];
  const tags = [
    S.live && d.id in S.live ? `<span class="tag tag--live">${esc(t('live.tag'))}</span>` : '',
    d.films.length ? `<span class="tag">${ICON.film}${esc(t('tag.film'))}</span>` : '',
    v0.model ? `<span class="tag">${ICON.cube}3D</span>` : '',
    ses.saved.has(d.id) ? `<span class="tag tag--saved">${ICON.heartOn}${esc(t('tag.saved'))}</span>` : '',
  ].join('');
  return `<button class="dcard" data-dev="${d.id}" data-step-n="${d.step}" data-rv>
    <span class="dcard__step"><em>0${d.step}</em>${esc(t('step.' + stepKey(d.step)))}</span>
    <span class="dcard__img">${d.img ? `<img src="${esc(d.img)}" alt="" class="${d.photo ? 'photo' : ''}" draggable="false">` : ''}</span>
    <span class="dcard__txt"><b>${esc(name(d))}</b><span>${esc(t('claim.' + d.id))}</span></span>
    <span class="dcard__tags">${tags}</span>
  </button>`;
}

// ================================================================== Gerät
async function getViewer() {
  if (!viewer) {
    const { Viewer } = await import('./viewer.js');
    viewer = new Viewer();
    viewer.onTouch = () => { poke(); $('.dev__hint')?.classList.add('is-gone'); };
  }
  return viewer;
}

// Produktbild fliegt von der Karte auf die Bühne der Geräteseite (offsetLeft/Top: unabhängig vom Einblenden der Seite)
function flyToStage(img) {
  fly(img, () => {
    const view = $('[data-view="device"]'), stage = $('[data-stage]', view);
    if (!stage) return null;
    const v = $('.views').getBoundingClientRect();
    const ph = $('.pp-photo img, .dev__photo img', stage);
    if (ph) {
      const pr = ph.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      return { left: v.left + stage.offsetLeft + (pr.left - sr.left), top: v.top + stage.offsetTop + (pr.top - sr.top), width: pr.width, height: pr.height };
    }
    const w = stage.offsetWidth, h = stage.offsetHeight;
    return { left: v.left + stage.offsetLeft + w * .14, top: v.top + stage.offsetTop + h * .16, width: w * .72, height: h * .62 };
  }, { dur: 620, fade: 420 });
}
function arOK() {
  const a = document.createElement('a');
  return !!(a.relList?.supports?.('ar'));
}

// ================================================================== Filme
function renderFilms(el) {
  const list = [...shownFilms()].sort((a, b) => (b.story ? 1 : 0) - (a.story ? 1 : 0));
  el.innerHTML = `<div class="wrap">
    <div class="head"><div><p class="kicker" data-rv>${esc(t('films.kicker'))}</p><h1 data-rv>${esc(t('films.h'))}</h1><p data-rv>${esc(t('films.p'))}</p></div></div>
    <div class="films">${list.map((f) => {
      const dur = `${Math.floor(f.dur / 60)}:${String(Math.round(f.dur % 60)).padStart(2, '0')}`;
      const sub = (f.story ? dur + ' · ' : '') + esc(filmDevices(f)) + (f.captions && f.capLangs?.includes(lang()) ? ' · ' + esc(t('films.subs')) : '');
      return `<button class="fcard rv${f.story ? ' fcard--story' : ''}" data-play="${f.id}">
      <span class="fcard__img"><img src="${esc(f.poster || f.thumb)}" alt="" draggable="false">
        <span class="fcard__dur">${dur}</span>
        ${ses.films.has(f.id) ? `<span class="fcard__seen tag">${ICON.check}${esc(t('films.seen'))}</span>` : ''}</span>
      <span class="fcard__txt"><b>${esc(filmTitle(f))}</b><span>${sub}</span>
        ${f.story ? `<span class="btn btn--yellow fcard__watch">${ICON.play}${esc(t('dev.watch'))}</span>` : ''}</span>
      ${f.story ? '' : `<span class="fcard__play">${ICON.play}</span>`}
    </button>`;
    }).join('')}</div>
  </div>`;
}

function playFilm(id, fromImg) {
  const f = film(id);
  if (!f) return;
  // Vorschaubild wächst auf Bildschirmgröße, dann übernimmt der Film
  if (fromImg) fly(fromImg, { left: 0, top: 0, width: innerWidth, height: innerHeight }, { fit: 'contain', z: 65, radius: 0, dur: 520, fade: 500 });
  ses.films.add(id);
  bump('film', id);
  const list = [...shownFilms()].sort((a, b) => (b.story ? 1 : 0) - (a.story ? 1 : 0));
  const next = list[(list.indexOf(f) + 1) % list.length];
  player.play(f, { lang: lang(), title: esc(filmTitle(f)), sub: esc(filmDevices(f)), next });
}
function filmEnd(f, next) {
  const p = (f.products || []).map(product).find(Boolean);
  return `<h2>${esc(filmTitle(f))}</h2>
    <div class="row">
      <button class="btn" data-p-again>${ICON.rotate}${esc(t('player.again'))}</button>
      ${p && !f.story ? `<button class="btn" data-p-dev="${esc(p.id)}">${esc(t('player.more', { name: W.pname(p) }))}</button>` : ''}
      ${next && next !== f ? `<button class="btn btn--yellow" data-p-next="${next.id}">${ICON.play}${esc(t('player.next', { title: filmTitle(next) }))}</button>` : ''}
    </div>`;
}

// ================================================================== Rechner
// Währung des Landes, in dem das iPad steht (Zeitzone), oder die Wahl am Währungs-Knopf (planer/assets/js/currency.js,
// gemeinsam mit Webseite und Planer). Die ZOLLER-Zahlen (15.000 € = 200 h × 75 €/h, Vorgabe 95 €/h) werden umgerechnet
// und aufgerundet; ein eigener Stundensatz aus den Einstellungen (S.rate) gilt in der Währung des Messelandes.
const Z = window.ZCurrency;
const curNow = () => (Z ? Z.get() : 'EUR');
const eurTo = (eur, cur, base) => (Z ? Z.amount(eur, cur, base) : eur);
function calcState() {
  if (!ses.calc) {
    const cur = curNow();
    ses.calc = { machines: 10, shifts: 2, days: 220, rate: S.rate || eurTo(95, cur), touched: false, cur };
  }
  return ses.calc;
}
const curSym = (cur) => { try { return new Intl.NumberFormat(intl(), { style: 'currency', currency: cur }).formatToParts(0).find((p) => p.type === 'currency').value; } catch { return cur; } };
function calcResult(c) {
  const cur = c.cur || curNow();
  const save = eurTo(15000, cur, 75) * c.machines * c.shifts;
  const hours = 4.52 / 60 * 8 * c.shifts * c.days * c.machines;
  return { save, hours, cost: hours * c.rate, cur };
}
// feste Euro-Beträge in Texten (»mindestens 15.000 €«) in die angezeigte Währung
const moneyText = (s, cur) => (cur === 'EUR' || !Z ? s : s.replace(/(\d{1,3}(?:[.,\u00a0\u202f ]\d{3})+|\d+)\s?€|€\s?(\d{1,3}(?:[.,\u00a0\u202f ]\d{3})+|\d+)/g,
  (m, a, b) => { const eur = +(a || b).replace(/\D/g, ''); return money(eurTo(eur, cur, eur === 15000 ? 75 : 0), cur); }));
if (Z) {
  window.addEventListener(Z.event, () => {
    const c = ses.calc, to = curNow();
    if (c && c.cur !== to) {
      c.rate = c.touched ? Math.round(c.rate / (Z.rates[c.cur] || 1) * (Z.rates[to] || 1)) : (S.rate || eurTo(95, to));
      c.cur = to;
    }
    const el = $('.view[data-view="calc"]');
    if (ses.view === 'calc' && el) renderCalc(el);
  });
}
function renderCalc(el) {
  const c = calcState();
  const r = calcResult(c);
  const stepper = (k, val, unit, label, small) => `<div class="field"><span>${esc(label)}${small ? `<small>${esc(small)}</small>` : ''}</span>
    <div class="stepper"><button data-dec="${k}" aria-label="−">${ICON.minus}</button><output>${esc(num(val))}${unit ? `<small>${esc(unit)}</small>` : ''}</output><button data-inc="${k}" aria-label="+">${ICON.plus}</button></div></div>`;
  el.innerHTML = `<div class="wrap">
    <div class="head"><div><p class="kicker" data-rv>${esc(t('calc.kicker'))}</p><h1 data-rv>${esc(t('calc.h'))}</h1><p data-rv>${esc(t('calc.p'))}</p></div>
      ${Z ? '<button class="btn cur-btn" data-currency-btn><span data-currency-code></span></button>' : ''}</div>
    <div class="calc">
      <div class="calc__in" data-rv>
        ${stepper('machines', c.machines, '', t('calc.machines'))}
        <div class="field"><span>${esc(t('calc.shifts'))}</span><div class="seg">${[1, 2, 3].map((n) => `<button data-shifts="${n}" class="${c.shifts === n ? 'is-on' : ''}">${n}</button>`).join('')}</div></div>
        ${stepper('days', c.days, '', t('calc.days'))}
        ${stepper('rate', c.rate, curSym(r.cur) + '/h', t('calc.rate'), t('calc.rate.s'))}
      </div>
      <div class="calc__out" data-rv>
        <div class="big"><small>${esc(t('calc.save'))}</small><span data-big>${esc(money(r.save, r.cur))}</span></div>
        <div class="calc__rows">
          <div class="calc__row"><b data-hours>${esc(num(Math.round(r.hours)))} h</b><span>${esc(t('calc.hours'))}</span></div>
          <div class="calc__row"><b>${esc(money(r.cost, r.cur))}</b><span>${esc(t('calc.cost', { rate: money(c.rate, r.cur) }))}</span></div>
          <div class="calc__row"><b>−40 %</b><span>${esc(t('fact.setup40'))}</span></div>
        </div>
        <p class="src">${esc(t('dev.source'))}: ${esc(moneyText(t('fact.calc15k'), r.cur))} ${esc(t('fact.min452'))} – ${esc(t('src.calc15k'))}. ${esc(t('calc.note'))}</p>
        <div class="calc__cta">
          <button class="btn btn--yellow" data-go="planer">${ICON.plan}${esc(t('calc.planer'))}</button>
          <button class="btn" data-calc-keep>${ICON.phone}${esc(t('calc.keep'))}</button>
        </div>
      </div>
    </div>
  </div>`;
  if (Z) $$('[data-currency-btn]', el).forEach((b) => Z.bind(b));
  // Zahlen laufen vom alten zum neuen Wert (beim ersten Öffnen von null an)
  const was = ses.calcShown && ses.calcShown.cur === r.cur ? ses.calcShown : { save: 0, hours: 0 };
  tween($('[data-big]', el), was.save, r.save, (x) => money(x, r.cur), was.save ? 520 : 1300);
  tween($('[data-hours]', el), was.hours, r.hours, (x) => `${num(Math.round(x))} h`, was.hours ? 520 : 1300);
  ses.calcShown = { save: r.save, hours: r.hours, cur: r.cur };
  const lim = { machines: [1, 500, 1], days: [100, 365, 5], rate: [5, 10000000, 5] };
  const stepBy = (k, dir) => {
    const [lo, hi, st] = lim[k];
    const big = k === 'rate' && c.rate >= 1000 ? Math.pow(10, Math.floor(Math.log10(c.rate)) - 1) : st;
    c[k] = Math.min(hi, Math.max(lo, c[k] + dir * big));
    c.touched = true; bumpCalc(); renderCalc(el);
  };
  $$('[data-inc]', el).forEach((b) => holdRepeat(b, () => stepBy(b.dataset.inc, 1)));
  $$('[data-dec]', el).forEach((b) => holdRepeat(b, () => stepBy(b.dataset.dec, -1)));
  $$('[data-shifts]', el).forEach((b) => b.addEventListener('click', () => { c.shifts = +b.dataset.shifts; c.touched = true; bumpCalc(); renderCalc(el); }));
  $('[data-calc-keep]', el).addEventListener('click', () => { c.touched = true; bumpCalc(); updateSaved(true); showMobileQr(); });
}
function bumpCalc() { if (!ses.calcCounted) { ses.calcCounted = true; bump('calc'); } }
// gedrückt halten = schneller zählen (nur der gerade gedrückte Knopf, neu gezeichnete Knöpfe übernehmen nicht)
function holdRepeat(btn, fn) {
  btn.addEventListener('click', (e) => { if (holdRepeat.fired) { holdRepeat.fired = false; e.preventDefault(); return; } fn(); });
  btn.addEventListener('pointerdown', () => {
    clearTimeout(holdRepeat.t); clearInterval(holdRepeat.i);
    const key = btn.dataset.inc ? '[data-inc="' + btn.dataset.inc + '"]' : '[data-dec="' + btn.dataset.dec + '"]';
    holdRepeat.t = setTimeout(() => {
      holdRepeat.fired = true;
      holdRepeat.i = setInterval(() => { const b = $(key); if (!b) return clearInterval(holdRepeat.i); fn(); poke(); }, 110);
    }, 450);
  });
  const stop = () => { clearTimeout(holdRepeat.t); clearInterval(holdRepeat.i); };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((e) => btn.addEventListener(e, stop));
}
addEventListener('pointerup', () => { clearTimeout(holdRepeat.t); clearInterval(holdRepeat.i); setTimeout(() => { holdRepeat.fired = false; }, 50); }, true);

// ================================================================== Werkzeugraum-Planer (Kopie in docs/planer, läuft offline)
function planerFolder(l) {
  const loc = langInfo(l)?.locale || 'de-DE';
  return loc === 'de-DE' ? '' : loc.toLowerCase() + '/';
}
function openPlaner(force) {
  const fr = $('[data-planer]');
  const want = abs('planer/' + planerFolder(lang()));
  if (!force && fr.dataset.lang === lang() && fr.getAttribute('src')) return;
  fr.dataset.lang = lang();
  if (!ses.planerCounted) { ses.planerCounted = true; bump('planer'); }
  fr.onload = () => {
    try {
      const w = fr.contentWindow, doc = fr.contentDocument;
      if (!doc || w.location.href === 'about:blank') return;
      ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart'].forEach((e) => w.addEventListener(e, poke, { capture: true, passive: true }));
      const st = doc.createElement('style');
      st.textContent = '.bar__showroom,.langsel,.bar__logo,.bar__title{display:none!important}'
        + 'body{-webkit-touch-callout:none}';
      doc.head.appendChild(st);
      // Links nach draußen → QR-Code, »Angebot anfordern« (mailto) → Kontaktformular der Messe-App, window.open abgefangen
      guardLinks(doc, w, (u) => u.href.startsWith(abs('planer/')));
    } catch (e) { console.warn('Planer', e); }
  };
  fr.src = want;
}
// »Angebot anfordern« im Planer → Planung in die Merkliste, weiter zum Kontakt
function planerMail(mailto) {
  try {
    const u = new URL(mailto);
    const body = u.searchParams.get('body') || '';
    const link = (body.match(/https?:\/\/\S+#p=[\w-]+/) || [])[0] || '';
    // Planungs-Link für Besucher: der Planer liegt auf dem Messe-Server mit (D.app + planer/…)
    ses.plan = { body, link: link ? link.replace(abs(''), D.app) : '' };
    bump('plan');
    updateSaved(true);
    toast(t('planer.taken'));
    go('contact');
  } catch (e) { console.warn(e); }
}
window.kioskPlaner = { mail: (u) => planerMail(u) };

// ================================================================== Kontakt + QR
function mobileUrl(extra) {
  const p = new URLSearchParams();
  p.set('l', lang());
  if (S.event?.id) p.set('e', S.event.id); else if (S.event?.title) p.set('et', S.event.title);
  if (S.booth) p.set('b', S.booth);
  p.set('h', S.site);
  const g = [...ses.saved];
  if (extra && !g.includes(extra)) g.unshift(extra);
  if (g.length) p.set('g', g.join('.'));
  if (ses.calc?.touched) { const c = ses.calc; p.set('r', [c.machines, c.shifts, c.days, c.rate].join('.')); }
  if (ses.plan?.link) { const m = ses.plan.link.match(/#p=([\w-]+)/); if (m) p.set('p', m[1]); }
  if (S.hubspot.portal && S.hubspot.form) p.set('hs', [S.hubspot.portal, S.hubspot.form, S.hubspot.host !== 'api.hsforms.com' ? S.hubspot.host : ''].filter(Boolean).join('~'));
  return D.app + 'm/?' + p.toString();
}
function showMobileQr(devId) {
  bump('qr');
  const url = mobileUrl(devId);
  showQr(url, t('qr.h'), t('qr.p'));
}
function showQr(url, title, text) {
  openSheet(`<div class="sheet__head"><h2>${esc(title)}</h2><button class="sheet__x" data-close>${ICON.x}</button></div>
    <div class="qrsheet"><div class="qr">${qrSvg(url, { label: title })}</div><div><p>${esc(text)}</p><p class="muted" style="margin-top:14px">${esc(t('qr.note'))}</p></div></div>`, true);
}

function renderContact(el) {
  const items = [...ses.saved].map(product).filter(Boolean);
  const f = ses.form || (ses.form = { first: '', last: '', company: '', email: '', phone: '', country: defaultCountry(), wants: new Set(), msg: '', consent: false });
  const countries = countryList();
  el.innerHTML = `<div class="wrap">
    <div class="head"><div><p class="kicker" data-rv>${esc(t('contact.kicker'))}</p><h1 data-rv>${esc(t('contact.h'))}</h1><p data-rv>${esc(t('contact.p'))}</p></div></div>
    <div class="contact">
      <div style="display:grid;gap:var(--gap)">
        <div class="card" data-rv><h2>${esc(t('contact.saved'))}</h2>
          ${items.length ? `<div class="saved">${items.map((p) => `<button data-unsave="${esc(p.id)}">${esc(W.pname(p))}${ICON.x}</button>`).join('')}</div>` : `<p class="saved__empty">${esc(t('contact.empty'))}</p>`}
          ${ses.calc?.touched || ses.plan ? `<div class="attach">
            ${ses.calc?.touched ? `<div>${ICON.calc}<span>${esc(t('contact.calc', { v: money(calcResult(ses.calc).save, calcResult(ses.calc).cur) }))}</span></div>` : ''}
            ${ses.plan ? `<div>${ICON.plan}<span>${esc(t('contact.plan'))}</span></div>` : ''}</div>` : ''}
        </div>
        <div class="card card--qr" data-rv><h2>${esc(t('qr.h'))}</h2><div class="qr" data-qr></div><p>${esc(t('qr.p'))}</p><small>${esc(t('qr.note'))}</small></div>
      </div>
      <form class="card" data-form novalidate data-rv>
        <h2>${esc(t('form.h'))}</h2>
        <p class="muted" style="font-size:var(--fs-s);line-height:1.4">${esc(t('form.p'))}</p>
        <div class="form">
          ${inp('first', t('form.first'), 'text', 'given-name')}${inp('last', t('form.last') + ' *', 'text', 'family-name')}
          <div class="full">${inp('company', t('form.company') + ' *', 'text', 'organization')}</div>
          ${inp('email', t('form.email'), 'email', 'email')}${inp('phone', t('form.phone'), 'tel', 'tel')}
          <label class="inp full"><span>${esc(t('form.country'))}</span><select name="country">${countries.map(([c, n]) => `<option value="${c}"${c === f.country ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
          <div class="full inp"><span>${esc(t('form.wants'))}</span><div class="chips">${['offer', 'demo', 'call', 'docs', 'visit'].map((k) => `<button type="button" data-want="${k}" class="${f.wants.has(k) ? 'is-on' : ''}">${esc(t('want.' + k))}</button>`).join('')}</div></div>
          <label class="inp full"><span>${esc(t('form.msg'))}</span><textarea name="msg" rows="3">${esc(f.msg)}</textarea></label>
          <button type="button" class="consent full${f.consent ? ' is-on' : ''}" data-consent><i>${ICON.check}</i><span>${esc(t('form.consent', { company: site().company }))}</span></button>
          <p class="src full">${esc(t('form.required'))}</p>
          <button type="submit" class="btn btn--yellow full">${ICON.mail}${esc(t('form.send'))}</button>
        </div>
      </form>
    </div>
  </div>`;
  $('[data-qr]', el).innerHTML = qrSvg(mobileUrl(), { label: t('qr.h') });
  if (!ses.qrCounted) { ses.qrCounted = true; bump('qr'); }
  $$('[data-unsave]', el).forEach((b) => b.addEventListener('click', () => { toggleSave(b.dataset.unsave); renderContact(el); }));
  const form = $('[data-form]', el);
  form.addEventListener('input', (e) => { if (e.target.name) f[e.target.name] = e.target.value; e.target.closest('.inp')?.classList.remove('is-bad'); });
  form.addEventListener('change', (e) => { if (e.target.name) f[e.target.name] = e.target.value; });
  $$('[data-want]', el).forEach((b) => b.addEventListener('click', () => { const k = b.dataset.want; if (f.wants.has(k)) f.wants.delete(k); else f.wants.add(k); b.classList.toggle('is-on'); }));
  $('[data-consent]', el).addEventListener('click', (e) => { f.consent = !f.consent; e.currentTarget.classList.toggle('is-on', f.consent); e.currentTarget.classList.remove('is-bad'); });
  form.addEventListener('submit', (e) => { e.preventDefault(); submitLead(el, f); });
  // Tastatur auf dem iPad: Feld sichtbar halten
  form.addEventListener('focusin', (e) => setTimeout(() => e.target.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 300));
}
function inp(k, label, type, ac) {
  const f = ses.form;
  return `<label class="inp"><span>${esc(label)}</span><input name="${k}" type="${type}" autocomplete="${ac}" value="${esc(f[k])}" ${type === 'email' ? 'inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false"' : ''}${type === 'tel' ? 'inputmode="tel"' : ''}></label>`;
}
function countryList() {
  let dn = null;
  try { dn = new Intl.DisplayNames([intl()], { type: 'region' }); } catch { /* alt */ }
  const seen = new Map();
  for (const [code, s] of Object.entries(D.sites)) {
    const reg = (s.flag === 'uk' ? 'GB' : s.flag.toUpperCase());
    if (seen.has(s.site)) continue;
    let n = s.name; try { n = dn?.of(reg) || s.name; } catch { /* alt */ }
    seen.set(s.site, [code, n]);
  }
  const list = [...seen.values()].sort((a, b) => a[1].localeCompare(b[1], intl()));
  return [['', t('form.country.pick')], ...list, ['other', t('form.country.other')]];
}
function defaultCountry() {
  const loc = langInfo(lang())?.locale;
  if (!loc || loc === 'en') return '';
  const s = D.sites[loc];
  if (!s) return '';
  return Object.entries(D.sites).find(([, x]) => x.site === s.site)?.[0] || '';
}

async function submitLead(el, f) {
  const bad = [];
  if (!f.last.trim()) bad.push('last');
  if (!f.company.trim()) bad.push('company');
  const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
  if (!mailOk && f.phone.replace(/\D/g, '').length < 6) bad.push('email', 'phone');
  bad.forEach((k) => $(`[name="${k}"]`, el)?.closest('.inp')?.classList.add('is-bad'));
  if (!f.consent) $('[data-consent]', el).classList.add('is-bad');
  if (bad.length || !f.consent) { toast(t(bad.includes('email') && !bad.includes('last') && !bad.includes('company') ? 'form.err.reach' : 'form.err')); return; }
  const r = ses.calc?.touched ? calcResult(ses.calc) : null;
  // Land für HubSpot immer englisch (wie die Webseiten-Formulare), angezeigt wird es in der Sprache des Besuchers
  let countryEn = '';
  try { const reg = D.sites[f.country]; countryEn = reg ? new Intl.DisplayNames(['en'], { type: 'region' }).of(reg.flag === 'uk' ? 'GB' : reg.flag.toUpperCase()) : ''; } catch { /* alt */ }
  const lead = newLead({
    source: 'ipad', device: S.kiosk, staff: '', event: S.event, eventLine: eventLine(false), booth: S.booth, site: S.site, lang: lang(), form: S.form || undefined,
    first: f.first.trim(), last: f.last.trim(), company: f.company.trim(), email: f.email.trim(), phone: f.phone.trim(),
    country: f.country, countryName: countryEn || countryList().find(([c]) => c === f.country)?.[1] || '',
    interests: [...new Set([...ses.saved].map(interestKey))], products: [...ses.saved].map(product).filter(Boolean).map((p) => W.pname(p).replace(/[»«]/g, '')),
    wants: [...f.wants], msg: f.msg.trim(),
    films: [...ses.films], calc: r ? { ...ses.calc, save: Math.round(r.save), cur: r.cur } : null, plan: ses.plan?.link || '',
    consent: true, consentText: t('form.consent', { company: site().company }),
  });
  if (!lead.form) lead.form = D.fragen?.default;
  await saveLead(lead);
  bump('leads');
  go('thanks', lead.first || lead.last, { push: false });
}

function renderThanks(el, who) {
  el.innerHTML = `<div class="thanks">
    <div class="thanks__ok"><i></i><i></i><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></svg></div>
    <h1 data-rv>${esc(t('thanks.h', { name: who || '' }).replace(/,\s*!/, '!'))}</h1>
    <p data-rv>${esc(t('thanks.p'))}</p>
    <div class="row" style="justify-content:center" data-rv><button class="btn" data-mobile>${ICON.phone}${esc(t('thanks.mobile'))}</button><button class="btn btn--yellow" data-end-now>${esc(t('thanks.done'))}</button></div>
    <p class="src" data-thanks-n></p>
  </div>`;
  let n = 30;
  const tick = () => {
    const out = $('[data-thanks-n]', el);
    if (ses.view !== 'thanks' || !out) return;
    out.textContent = t('thanks.auto', { n });
    if (n-- <= 0) { endSession(); return; }
    setTimeout(tick, 1000);
  };
  tick();
}

// ================================================================== Dialoge
function openSheet(html, wide) {
  const s = $('[data-sheet]');
  $('[data-sheet-panel]').className = 'sheet__panel' + (wide ? ' sheet__panel--wide' : '');
  $('[data-sheet-panel]').innerHTML = html;
  s.hidden = false;
}
function closeSheet() { $('[data-sheet]').hidden = true; }

function langSheet() {
  openSheet(`<div class="sheet__head"><h2>${esc(t('lang.h'))}</h2><button class="sheet__x" data-close>${ICON.x}</button></div>
    <div class="langs">${D.langs.map((l) => `<button data-lang="${l.code}" class="${l.code === lang() ? 'is-on' : ''}" lang="${l.code}">${esc(l.name)}<small>${esc(l.code)}</small></button>`).join('')}</div>`, true);
}
function endSheet() {
  const n = ses.saved.size + (ses.calc?.touched ? 1 : 0) + (ses.plan ? 1 : 0);
  openSheet(`<div class="sheet__head"><h2>${esc(t('end.h'))}</h2><button class="sheet__x" data-close>${ICON.x}</button></div>
    <p class="muted" style="font-size:var(--fs-b);line-height:1.45">${esc(t(n ? 'end.p.saved' : 'end.p'))}</p>
    <div class="row">${n ? `<button class="btn btn--yellow" data-mobile>${ICON.phone}${esc(t('end.qr'))}</button>` : ''}
    <button class="btn${n ? '' : ' btn--yellow'}" data-end-now>${esc(t('end.yes'))}</button><button class="btn btn--ghost" data-close>${esc(t('end.no'))}</button></div>`);
}

// ================================================================== Inaktivität
let last = Date.now(), idleT = null;
function poke() { last = Date.now(); }
function idleLoop() {
  ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart'].forEach((e) => addEventListener(e, poke, { capture: true, passive: true }));
  document.addEventListener('scroll', poke, { capture: true, passive: true });
  setInterval(() => {
    if (!ses.on || staff?.isOpen?.() || !$('[data-idle]').hidden) return;
    if (player?.playing) { poke(); return; }
    if (Date.now() - last > (S.idle || 90) * 1000) showIdle();
  }, 1000);
}
function showIdle() {
  const el = $('[data-idle]');
  el.hidden = false;
  apply(el);
  let n = 15;
  const ring = $('[data-idle-ring]');
  const tick = () => {
    $('[data-idle-n]').textContent = n;
    ring.style.strokeDashoffset = String(326.7 * (1 - n / 15));
    if (n-- <= 0) { hideIdle(); endSession(); return; }
    idleT = setTimeout(tick, 1000);
  };
  tick();
}
function hideIdle() { clearTimeout(idleT); $('[data-idle]').hidden = true; poke(); }

// ================================================================== Personalbereich
async function openStaff(setup = false) {
  const mod = await import('./staff.js');
  staff = mod;
  await mod.openStaff({
    D, S, setup, t, esc, ICON,
    save(next) { S = next; saveSettings(S); catalogSettings(S); },
    get settings() { return S; },
    reg: () => reg,
    lock: () => lockApp(true),
    onClose: async (changed) => {
      if (changed) { await setLangAll(S.lang); }
      if (!S.setup) return openStaff(true);
      if (ses.on) { if (changed) await useLang(lang()); } else { stopAttract(); startAttract(); }
    },
    endSession,
  });
}
function holdForStaff(el) {
  let tm = null;
  el.addEventListener('pointerdown', () => { clearTimeout(tm); tm = setTimeout(() => { el.dataset.held = '1'; openStaff(false); }, 1800); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => el.addEventListener(e, () => clearTimeout(tm)));
  el.addEventListener('click', (e) => { if (el.dataset.held) { delete el.dataset.held; e.stopPropagation(); e.preventDefault(); } }, true);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ================================================================== App sperren (Pause, Nacht): nur Hinweis, Entsperren mit Logo + PIN
const LOCK = 'zm.locked';
function locked() { try { return localStorage.getItem(LOCK) === '1'; } catch { return false; } }
function lockApp(on) {
  try { if (on) localStorage.setItem(LOCK, '1'); else localStorage.removeItem(LOCK); } catch { /* egal */ }
  const el = $('[data-lock]');
  if (on) {
    if (ses.on) { closeSheet(); hideIdle(); if (player.open) player.close(); ses.on = false; $$('.view').forEach((v) => { if (v.dataset.view !== 'planer') v.innerHTML = ''; }); }
    stopAttract();
    $('[data-app]').hidden = true;
    $('[data-lock-ev]').textContent = eventLine();
    el.hidden = false;
  } else {
    el.hidden = true;
    startAttract();
  }
}
async function unlockApp() {
  const mod = await import('./staff.js');
  if (await mod.unlock({ settings: S, esc, save(next) { S = next; saveSettings(S); } })) lockApp(false);
}

// ================================================================== Kiosk: kein Weg nach draußen (Links → QR-Code fürs Handy)
function linkToPhone(href) {
  try {
    const u = new URL(href, location.href);
    if (/^https?:$/.test(u.protocol)) showQr(u.href, t('qr.link.h'), t('qr.link.p'));
  } catch { /* kein Link */ }
}
function guardLinks(doc, win, inside = () => false) {
  doc.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a || a.rel === 'ar' || a.hasAttribute('download')) return;     // AR Quick Look und Dateien bleiben auf dem iPad
    const u = new URL(a.href, doc.baseURI);
    if (u.protocol === 'blob:' || (u.origin === location.origin && a.target !== '_blank' && !/^(mailto|tel|sms):/.test(u.protocol)) || inside(u)) return;
    e.preventDefault(); e.stopPropagation();
    if (u.protocol === 'mailto:' && win !== window) { planerMail(u.href); return; }
    linkToPhone(u.href);
  }, true);
  // window.open (z. B. 3D-Showroom aus dem Planer) öffnet sonst Safari
  try { win.open = (url) => { if (url) linkToPhone(url); return null; }; } catch { /* fremdes Fenster */ }
}

// ================================================================== Verdrahtung (ein Klick-Verteiler für alles)
function wire() {
  apply();
  guardLinks(document, window);
  $$('[data-lock-hold]').forEach((el) => {
    let tm = null;
    el.addEventListener('pointerdown', () => { clearTimeout(tm); tm = setTimeout(unlockApp, 1800); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, () => clearTimeout(tm)));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  ripples();
  $$('[data-staff-hold]').forEach(holdForStaff);
  // Dauerschleife: überall tippen startet, Sprach-Chips starten in der Sprache
  $('[data-attract]').addEventListener('click', (e) => {
    if (e.target.closest('[data-staff-hold]')) return;
    const b = e.target.closest('[data-a-lang]');
    if (b && b.dataset.aLang !== '*') return startSession(b.dataset.aLang);
    startSession(S.lang).then(() => { if (b) langSheet(); });
  });
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('button, a, [data-close]');
    if (!el) return;
    const ds = el.dataset;
    if ('close' in ds || e.target === $('[data-sheet]')) { closeSheet(); return; }
    if (ds.go) { closeSheet(); go(ds.go); return; }
    if ('back' in ds) { back(); return; }
    if (ds.dev) {
      const img = el.matches('.dcard, .pc') ? $('.dcard__img img, .pc__stage img', el) : null;
      closeSheet(); if (player.open) player.close();
      go('device', ds.dev, { dir: el.closest('.dev__nav') && el === $$('.dev__nav button')[0] ? -1 : 1 });
      if (img) flyToStage(img);
      return;
    }
    if (ds.play) { playFilm(ds.play, $('.fcard__img img, .wf__img img', el)); return; }
    if (ds.save) {
      const on = toggleSave(ds.save);
      el.innerHTML = (on ? ICON.heartOn : ICON.heart) + esc(t(on ? 'dev.saved' : 'dev.save'));
      if (on) toast(t('dev.saved.toast'));
      return;
    }
    if ('mobile' in ds) { showMobileQr(ds.mobile || undefined); return; }
    if (ds.open === 'lang') { langSheet(); return; }
    if (ds.open === 'end') { endSheet(); return; }
    if (ds.lang) { closeSheet(); await useLang(ds.lang); bump('lang', ds.lang); return; }
    if ('endNow' in ds) { endSession(); return; }
    if ('idleStay' in ds) { hideIdle(); return; }
    if ('idleEnd' in ds) { hideIdle(); endSession(); return; }
    if ('pAgain' in ds) { player.v.currentTime = 0; player.endEl.hidden = true; player.v.play().catch(() => {}); return; }
    if (ds.pDev) { player.close(); go('device', ds.pDev); return; }
    if (ds.pNext) { playFilm(ds.pNext); return; }
  });
  $('[data-sheet]').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSheet(); });
  // kein Zoomen, kein Kontextmenü am Stand
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input, textarea')) e.preventDefault(); });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  addEventListener('resize', () => { if (A.on && D.hero.posterLand) $('[data-attract]').style.background = `#000 url("${abs(innerWidth < innerHeight ? D.hero.posterPort : D.hero.posterLand)}") center/cover`; });
}

boot();
