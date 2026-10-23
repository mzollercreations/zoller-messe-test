// Bewegung: Seitenwechsel, Auftauchen beim Scrollen, Zählwerke, Bild-Flug von der Karte auf die nächste Seite,
// Tipp-Welle auf Knöpfen und die Gerätereihe, die beim Wischen mitlebt. Nur transform/opacity – flüssig auf dem iPad.
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ Seitenwechsel
// out/in mit Richtung: vor = neue Seite kommt von rechts, zurück = von links. Die Inhalte mit [data-rv] folgen gestaffelt.
export function swapViews(from, to, dir = 1) {
  const all = [...document.querySelectorAll('.view')];
  all.forEach((v) => {
    if (v !== from && v !== to) v.classList.remove('is-on', 'v-in', 'v-out', 'v-back');
  });
  if (from && from !== to) {
    clearTimeout(from._vt);
    from.classList.remove('v-in');
    from.classList.add('v-out');
    from.classList.toggle('v-back', dir < 0);
    // wurde die Seite inzwischen wieder geöffnet, fehlt »v-out« – dann bleibt sie stehen
    const done = () => { if (from.classList.contains('v-out')) from.classList.remove('v-out', 'v-back', 'is-on'); };
    if (REDUCED) done(); else setTimeout(done, 420);
  }
  if (!to) return;
  to.classList.remove('v-out');
  to.classList.add('is-on');
  to.classList.toggle('v-back', dir < 0);
  to.classList.remove('v-in'); void to.offsetWidth; to.classList.add('v-in');
  // danach keine Transform-Animation stehen lassen (sonst wird die Seite zum Bezugsrahmen für fixierte Elemente)
  clearTimeout(to._vt); to._vt = setTimeout(() => to.classList.remove('v-in', 'v-back'), 720);
  stagger(to);
}

/** Elemente mit [data-rv] einer Seite nacheinander einblenden (die Reihenfolge im HTML zählt) */
export function stagger(root) {
  let i = 0;
  root.querySelectorAll('[data-rv]').forEach((el) => {
    if (el.closest('.rv-later')) return;           // die zeigt erst der Scroll-Beobachter
    el.style.setProperty('--i', String(Math.min(i++, 12)));
    el.classList.remove('rv-go'); void el.offsetWidth; el.classList.add('rv-go');
  });
}

// ------------------------------------------------------------------ Auftauchen beim Scrollen
let io = null;
export function reveal(root) {
  if (REDUCED || !('IntersectionObserver' in window)) { root.querySelectorAll('.rv').forEach((e) => e.classList.add('is-in')); return; }
  io ||= new IntersectionObserver((entries) => {
    // was gleichzeitig hereinkommt, kommt leicht versetzt
    let n = 0;
    entries.filter((e) => e.isIntersecting).forEach((e) => {
      e.target.style.setProperty('--d', `${Math.min(n++, 6) * 70}ms`);
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
  root.querySelectorAll('.rv:not(.is-in)').forEach((e) => io.observe(e));
}

// ------------------------------------------------------------------ Zählwerk
// Zählt die Zahl im ersten Textknoten hoch (»820«, »−70«, »×1,5«, »20.000«); Vorzeichen und Einheit bleiben stehen.
export function countUp(el, { dur = 1100, delay = 0 } = {}) {
  const node = [...el.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.nodeValue));
  if (!node || REDUCED) return;
  const text = node.nodeValue;
  const m = text.match(/\d[\d.,   ]*/);
  if (!m) return;
  const raw = m[0].trim();
  const dec = (1.5).toLocaleString(document.documentElement.lang || 'de').replace(/\d/g, '') || '.';
  const parts = raw.split(dec);
  const decimals = parts.length > 1 && parts[parts.length - 1].length < 3 ? parts[parts.length - 1].length : 0;
  const target = decimals ? parseFloat(parts.slice(0, -1).join('').replace(/\D/g, '') + '.' + parts[parts.length - 1]) : +raw.replace(/\D/g, '');
  if (!isFinite(target) || target === 0) return;
  const fmt = new Intl.NumberFormat(document.documentElement.lang || 'de', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: /[.,   ]\d{3}/.test(raw) && !decimals });
  const pre = text.slice(0, m.index), post = text.slice(m.index + m[0].length) + (m[0].length > raw.length ? ' ' : '');
  const t0 = performance.now() + delay;
  node.nodeValue = pre + fmt.format(0) + post;
  const step = (now) => {
    const k = Math.min(1, Math.max(0, (now - t0) / dur));
    const e = 1 - Math.pow(1 - k, 4);
    node.nodeValue = pre + fmt.format(target * e) + post;
    if (k < 1 && node.isConnected) requestAnimationFrame(step); else node.nodeValue = text;
  };
  requestAnimationFrame(step);
}

/** Betrag sanft von »from« nach »to« laufen lassen; format() baut den Text */
export function tween(el, from, to, format, dur = 520) {
  cancelAnimationFrame(el._tw);
  if (REDUCED || from === to || from == null) { el.textContent = format(to); el._v = to; return; }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el._v = from + (to - from) * e;
    el.textContent = format(el._v);
    if (k < 1 && el.isConnected) el._tw = requestAnimationFrame(step);
  };
  el._tw = requestAnimationFrame(step);
}

// ------------------------------------------------------------------ Bild-Flug (Karte → nächste Seite)
// Eine Kopie des Bildes fliegt von der Karte an ihren Platz auf der neuen Seite und blendet dort aus.
export function fly(img, to, { dur = 560, fade = 260, z = 30, fit = 'contain', radius = 22 } = {}) {
  if (REDUCED || !img || !img.complete || !img.naturalWidth) return Promise.resolve();
  const a = img.getBoundingClientRect();
  if (!a.width) return Promise.resolve();
  const b = typeof to === 'function' ? to() : to;
  if (!b) return Promise.resolve();
  const c = img.cloneNode();
  c.removeAttribute('class');
  c.className = 'flyer';
  Object.assign(c.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, objectFit: fit, zIndex: z, borderRadius: `${radius}px` });
  document.body.appendChild(c);
  // Rahmen statt Skalierung: so bleibt das Bild (object-fit) unverzerrt, auch wenn Karte und Ziel andere Formate haben
  const box = (r) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const anim = c.animate([
    { ...box(a), borderRadius: `${radius}px` },
    { ...box(b), borderRadius: `${fit === 'cover' ? 0 : radius}px` },
  ], { duration: dur, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'forwards' });
  return anim.finished.then(() => {
    const out = c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade, easing: 'ease-out', fill: 'forwards' });
    out.finished.then(() => c.remove());
  }).catch(() => c.remove());
}

// ------------------------------------------------------------------ Tipp-Welle
export function ripples() {
  if (REDUCED) return;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.btn, .action, .dcard, .fcard, .bar__btn, .bar__back, .steps button, .langs button, .chips button, .seg button, .attract__langs button, .dev__modes button, .dev__variants button');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = Math.max(r.width, r.height) * 2.2;
    const w = document.createElement('i');
    w.className = 'ripple';
    Object.assign(w.style, { width: `${s}px`, height: `${s}px`, left: `${e.clientX - r.left - s / 2}px`, top: `${e.clientY - r.top - s / 2}px` });
    el.appendChild(w);
    setTimeout(() => w.remove(), 700);
  }, { passive: true, capture: true });
}

// ------------------------------------------------------------------ Gerätereihe
// Karten am Rand werden kleiner und blasser, das Produktbild läuft leicht gegen die Wischrichtung (Tiefe).
export function railFx(rail) {
  if (REDUCED) return () => {};
  const cards = [...rail.querySelectorAll('.dcard')];
  let raf = 0;
  const run = () => {
    raf = 0;
    const r = rail.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    const L = r.left + pad, R = r.right - pad;
    for (const c of cards) {
      const b = c.getBoundingClientRect();
      const over = Math.max(0, L - b.left, b.right - R) / b.width;      // 0 = ganz sichtbar, 1 = eine Kartenbreite draußen
      const k = Math.min(1, over);
      c.style.setProperty('--rk', k.toFixed(3));
      const mid = (b.left + b.width / 2 - (L + R) / 2) / (R - L);         // −0,5 … 0,5
      c.style.setProperty('--px', (mid * -18).toFixed(1) + 'px');
    }
  };
  const on = () => { if (!raf) raf = requestAnimationFrame(run); };
  rail.addEventListener('scroll', on, { passive: true });
  addEventListener('resize', on);
  run();
  return () => { rail.removeEventListener('scroll', on); removeEventListener('resize', on); };
}

/** Fortschrittslinie für einen Scrollbereich (Messskala oben am Bereich) */
export function scrollMeter(scroller, bar) {
  const run = () => {
    const max = scroller.scrollHeight - scroller.clientHeight;
    bar.style.transform = `scaleX(${max > 4 ? Math.min(1, scroller.scrollTop / max) : 0})`;
    bar.parentElement?.classList.toggle('is-on', max > 4);
  };
  scroller.addEventListener('scroll', () => requestAnimationFrame(run), { passive: true });
  requestAnimationFrame(run);
}
