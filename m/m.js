// Messe-Mappe auf dem Handy: öffnet sich über den QR-Code am Messestand. Alles steht in der Adresse
// (Sprache, Messe, gemerkte Geräte, Rechner, Planung) – keine Anmeldung, nichts wird gespeichert, bis der Besucher schreibt.
import { setLang, t, lang, num, money, intl } from '../assets/js/i18n.js';
import { useData, newLead, upgrade, sendLead, hubspotConfig } from '../assets/js/leads.js';
import { useCatalog, loadText, product, ptx, prodId, interestKey } from '../assets/js/catalog.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const Q = new URLSearchParams(location.search);
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  cube: '<svg viewBox="0 0 24 24"><path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z"/><path d="M4 7.4l8 4.6 8-4.6M12 12v9.2"/></svg>',
  plan: '<svg viewBox="0 0 24 24"><path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
};

let D, host, country = '', loc = '';
const form = { first: '', last: '', company: '', email: '', phone: '', wants: new Set(), msg: '', consent: false };

const name = (d) => t('prod.' + (d.prod || d.id));
// gemerkt wird im Kiosk ein Produkt des Katalogs; kuratierte Geräte (Kennzahlen, Fakten) haben ihre eigene Karte
const devOf = (p) => D.devices.find((d) => prodId(d.id) === p.id);
const pname = (p) => ptx(p.id).name || p.id;
const saved = () => [...new Set((Q.get('g') || '').split('.').filter(Boolean).map(prodId))].map(product).filter(Boolean);
const stepKey = (n) => D.steps.find((s) => s.n === n)?.key;
const langInfo = (c) => D.langs.find((l) => l.code === c);
const fmtVal = (v) => { const dec = num(1.5).replace(/\d/g, ''); return /^\d+$/.test(v) ? num(+v) : v.replace(/(\d),(\d)/g, `$1${dec}$2`); };

function toast(msg, ms = 3200) {
  const el = $('[data-toast]'); el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, ms);
}

// Länderfassung: Land (Seite) + Sprache des Besuchers → Locale-Code in D.sites
function localeFor(siteId, l) {
  const all = Object.entries(D.sites).filter(([, s]) => s.site === siteId);
  return (all.find(([, s]) => s.lang === l) || all.find(([, s]) => s.lang.split('-')[0] === l.split('-')[0]) || all[0] || [])[0] || '';
}
function defaultCountry(l) {
  const pref = langInfo(l)?.locale;
  if (pref && pref !== 'en' && D.sites[pref]) return D.sites[pref].site;
  return host?.lang?.startsWith('en') ? host.site : '';
}
const visitorSite = () => D.sites[loc] || D.sites[localeFor(country, lang())] || host || D.sites.en || D.sites['de-DE'];

async function boot() {
  try {
    D = await (await fetch('../data/kiosk.json')).json();
    useData(D);
    useCatalog(D, {});
  } catch {
    $('[data-main]').innerHTML = '<p class="loading">Offline – bitte später erneut öffnen.</p>'; return;
  }
  let l = Q.get('l') || (navigator.language || 'de');
  if (!langInfo(l)) l = langInfo(l.split('-')[0]) ? l.split('-')[0] : 'en';
  await Promise.all([setLang(l), loadText(l)]);
  host = D.sites[Q.get('h')] || D.sites['de-DE'];
  country = defaultCountry(l);
  loc = country ? localeFor(country, l) : '';
  const sel = $('[data-lang]');
  sel.innerHTML = D.langs.map((x) => `<option value="${x.code}" ${x.code === l ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  sel.addEventListener('change', async () => {
    await Promise.all([setLang(sel.value), loadText(sel.value)]);
    Q.set('l', sel.value); history.replaceState(null, '', '?' + Q.toString());
    if (!form.countryTouched) { country = defaultCountry(sel.value); }
    loc = country ? localeFor(country, sel.value) : '';
    render();
  });
  render();
}

function eventInfo() {
  const e = D.events.find((x) => x.id === Q.get('e'));
  const title = e ? e.title : (Q.get('et') || '');
  const city = e ? (e.city?.[lang()] || e.city?.[lang().split('-')[0]] || e.city?.en || e.city?.de || '') : '';
  const running = !e || !e.end || e.end >= new Date().toLocaleDateString('sv-SE');
  return { title, city, line: [title, city].filter(Boolean).join(' · '), booth: Q.get('b') || '', running };
}

function render() {
  document.title = t('m.title');
  const ev = eventInfo();
  const devices = saved();
  const ids = devices.map((p) => p.id);
  const site = visitorSite();
  const mine = (f) => ((f.products || []).some((id) => ids.includes(id)) ? 1 : 0);
  const films = [...D.films].sort((a, b) => mine(b) - mine(a));
  const others = D.devices.filter((d) => !ids.includes(prodId(d.id)));
  $('[data-main]').innerHTML = `
    <section class="hero">
      ${ev.line ? `<p class="kicker"><b>ZOLLER</b> · ${esc(ev.line)}</p>` : '<p class="kicker"><b>ZOLLER</b></p>'}
      <h1>${esc(t('m.title'))}</h1>
      <p>${esc(t('m.hello'))}</p>
      ${ev.booth && ev.running ? `<span class="visit">${ICON.pin}${esc(t('m.visit', { where: ev.booth }))}</span>` : ''}
    </section>
    ${devices.length ? `<section class="sec"><h2>${esc(t('m.devices'))}</h2>${devices.map((p) => (devOf(p) ? devCard(devOf(p), site, true) : prodCard(p))).join('')}</section>` : ''}
    ${calcBlock()}
    ${planBlock(site)}
    ${films.length ? `<section class="sec"><h2>${esc(t('m.films'))}</h2>${films.map(filmCard).join('')}</section>` : ''}
    ${others.length ? `<section class="sec"><details class="card" style="padding:16px 18px"><summary>${esc(t('m.more'))} (${others.length})</summary>
      <div style="display:grid;gap:12px;margin-top:14px">${others.map((d) => devCard(d, site, false)).join('')}</div></details></section>` : ''}
    <section class="sec" id="kontakt"><h2>${esc(t('m.contact'))}</h2>${formBlock(devices, site)}</section>
    <footer class="foot">
      <div><b>${esc(t('m.company'))}</b><br>${esc(site.company)}<br>${site.address.map(esc).join('<br>')}<br>
        ${site.phone ? `<a href="tel:${esc(site.phone.replace(/[^\d+]/g, ''))}">${esc(site.phone)}</a><br>` : ''}<a href="mailto:${esc(site.mail)}">${esc(site.mail)}</a></div>
      <div class="links"><button class="btn" data-share>${ICON.share}${esc(t('m.share'))}</button><a class="btn" href="${esc(site.url)}" target="_blank" rel="noopener">${ICON.ext}ZOLLER</a>
        ${site.privacy ? `<a class="btn" href="${esc(site.privacy)}" target="_blank" rel="noopener">${esc(t('m.privacy'))}</a>` : ''}
        ${site.imprint ? `<a class="btn" href="${esc(site.imprint)}" target="_blank" rel="noopener">${esc(t('m.imprint'))}</a>` : ''}</div>
      <p class="src">${esc(t('m.save'))}</p>
    </footer>`;
  wire(devices, site);
  attachCaptions();
}

function devCard(d, site, open) {
  const v = d.variants[0];
  const specs = [...(v.specs || []), ...(d.specs || [])];
  const link = site.links?.[d.id];
  const show = d.show && site.showroom ? site.showroom + '#produkt/' + d.show : '';   // Showroom nur, wo es ihn offiziell gibt
  return `<article class="card">
    ${d.img ? `<div class="dev__img"><img src="../${esc(d.img)}" alt="" loading="lazy" class="${d.photo ? 'photo' : ''}"></div>` : ''}
    <div class="dev__body">
      <span class="dev__step"><b>0${d.step}</b> ${esc(t('step.' + stepKey(d.step)))}</span>
      <h3>${esc(name(d))}</h3>
      <p class="claim">${esc(t('claim.' + d.id))}</p>
      <p class="role">${esc(t('role.' + (d.prod || d.id)))}</p>
      ${specs.length ? `<div class="specs">${specs.map(([val, unit, key]) => `<div class="spec"><b>${esc(fmtVal(val))}${unit ? `<small>${esc(unit)}</small>` : ''}</b><span>${esc(t(key))}</span></div>`).join('')}</div>` : ''}
      ${d.variants.length > 1 ? `<p class="src">${d.variants.map((x) => esc(x.name)).join(' · ')}</p>` : ''}
      <details ${open ? 'open' : ''}><summary>${esc(t('m.facts'))}</summary>
        <ul class="facts">${d.facts.map((k) => `<li>${esc(t('fact.' + k))}<small>${esc(t('src.' + k))}</small></li>`).join('')}</ul></details>
      <div class="links">
        ${d.films.length ? `<a class="btn btn--yellow" href="#film-${d.films[0]}">${ICON.play}${esc(t('dev.watch'))}</a>` : ''}
        ${link ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener">${ICON.ext}${esc(t('m.product'))}</a>` : ''}
        ${show ? `<a class="btn" href="${esc(show)}" target="_blank" rel="noopener">${ICON.cube}${esc(t('m.showroom'))}</a>` : ''}
      </div>
    </div>
  </article>`;
}

// Produkt ohne kuratierte Gerätekarte: Bild, Bereich, Kernaussage, Highlights, offizielle Produktseite
function prodCard(p) {
  const tx = ptx(p.id);
  const films = D.films.filter((f) => (f.products || []).includes(p.id));
  return `<article class="card">
    ${p.img ? `<div class="dev__img"><img src="../${esc(p.img)}" alt="" loading="lazy"></div>` : ''}
    <div class="dev__body">
      ${tx.sub ? `<span class="dev__step">${esc(tx.sub)}</span>` : ''}
      <h3>${esc(pname(p))}</h3>
      ${tx.teaser ? `<p class="claim">${esc(tx.teaser)}</p>` : ''}
      ${tx.claim && tx.claim !== tx.teaser ? `<p class="role">${esc(tx.claim)}</p>` : ''}
      ${tx.highlights?.length ? `<ul class="facts">${tx.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      <div class="links">
        ${films.length ? `<a class="btn btn--yellow" href="#film-${films[0].id}">${ICON.play}${esc(t('dev.watch'))}</a>` : ''}
        ${tx.url ? `<a class="btn" href="${esc(tx.url)}" target="_blank" rel="noopener">${ICON.ext}${esc(t('m.product'))}</a>` : ''}
      </div>
    </div>
  </article>`;
}

function filmCard(f) {
  const src = f.src[lang()] || f.src[lang().split('-')[0]] || f.src['*'] || f.src.all;
  const devs = (f.products || []).map(product).filter(Boolean).slice(0, 3).map(pname).join(' · ');
  return `<article class="card film" id="film-${f.id}">
    <video controls playsinline preload="none" poster="../${esc(f.poster)}" src="../${esc(src)}" data-film="${f.id}" crossorigin="anonymous"></video>
    <div class="film__t"><b>${esc(t('film.' + f.id))}</b><span>${esc(devs)} · ${Math.floor(f.dur / 60)}:${String(Math.round(f.dur % 60)).padStart(2, '0')}</span></div>
  </article>`;
}

// Untertitel als WebVTT-Spur (der native Player zeigt sie auch im Vollbild)
async function attachCaptions() {
  for (const v of $$('video[data-film]')) {
    const f = D.films.find((x) => x.id === v.dataset.film);
    if (!f?.captions) continue;
    try {
      const all = await (await fetch('../' + f.captions)).json();
      const l = all[lang()] ? lang() : all[lang().split('-')[0]] ? lang().split('-')[0] : 'en';
      const ts = (s) => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = (s % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${x}`; };
      const vtt = 'WEBVTT\n\n' + all[l].map((c, i) => `${i + 1}\n${ts(c[0])} --> ${ts(c[1] + .3)}\n${c[2]}\n`).join('\n');
      const tr = document.createElement('track');
      tr.kind = 'subtitles'; tr.srclang = l; tr.label = langInfo(l)?.name || l; tr.default = true;
      tr.src = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
      v.appendChild(tr);
    } catch { /* ohne Untertitel */ }
  }
}

function calcData() {
  const r = (Q.get('r') || '').split('.').map(Number);
  if (r.length !== 4 || r.some((x) => !Number.isFinite(x))) return null;
  const [machines, shifts, days, rate] = r;
  const fx = host.fx || 1, cur = host.currency || 'EUR';
  const save = 15000 * fx * machines * shifts;
  const hours = 4.52 / 60 * 8 * shifts * days * machines;
  return { machines, shifts, days, rate, save, hours, cost: hours * rate, cur };
}
function calcBlock() {
  const c = calcData();
  if (!c) return '';
  return `<section class="sec"><h2>${esc(t('m.calc'))}</h2><div class="card calc">
    <div class="big"><small>${esc(t('calc.save'))}</small>${esc(money(c.save, c.cur))}</div>
    <p>${esc(t('m.calc.line', { machines: num(c.machines), shifts: c.shifts, days: num(c.days), rate: money(c.rate, c.cur) }))}</p>
    <p><b>${esc(num(Math.round(c.hours)))} h</b> ${esc(t('calc.hours'))}</p>
    <p><b>${esc(money(c.cost, c.cur))}</b> ${esc(t('calc.cost', { rate: money(c.rate, c.cur) }))}</p>
    <p class="src">${esc(t('dev.source'))}: ${esc(t('src.calc15k'))}. ${esc(t('calc.note'))}</p>
  </div></section>`;
}
function planBlock(site) {
  const p = Q.get('p');
  const url = (site.planer || D.sites['de-DE'].planer) + (p ? '#p=' + p : '');
  return `<section class="sec"><h2>${esc(t(p ? 'm.plan' : 'planer.h'))}</h2>
    <a class="btn btn--dark btn--full" href="${esc(url)}" target="_blank" rel="noopener">${ICON.plan}${esc(t(p ? 'm.plan.open' : 'm.planer'))}</a></section>`;
}

function countryOptions() {
  let dn = null;
  try { dn = new Intl.DisplayNames([intl()], { type: 'region' }); } catch { /* alt */ }
  const seen = new Map();
  for (const s of Object.values(D.sites)) {
    if (seen.has(s.site)) continue;
    let n = s.name; try { n = dn?.of(s.flag === 'uk' ? 'GB' : s.flag.toUpperCase()) || s.name; } catch { /* alt */ }
    seen.set(s.site, n);
  }
  return [['', t('form.country.pick')], ...[...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], intl())), ['other', t('form.country.other')]];
}

function formBlock(devices, site) {
  if (form.sent) return `<div class="ok">${esc(t('m.sent'))}</div>`;
  return `<form class="card form" data-form novalidate>
    <p>${esc(t('m.contact.p'))}</p>
    <div class="two">${inp('first', t('form.first'), 'text', 'given-name')}${inp('last', t('form.last') + ' *', 'text', 'family-name')}</div>
    ${inp('company', t('form.company') + ' *', 'text', 'organization')}
    <div class="two">${inp('email', t('form.email'), 'email', 'email')}${inp('phone', t('form.phone'), 'tel', 'tel')}</div>
    <label class="inp"><span>${esc(t('m.country'))}</span><select name="country">${countryOptions().map(([c, n]) => `<option value="${c}" ${c === country ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <div class="inp"><span>${esc(t('form.wants'))}</span><div class="chips">${['offer', 'demo', 'call', 'docs', 'visit'].map((k) => `<button type="button" data-want="${k}" class="${form.wants.has(k) ? 'is-on' : ''}">${esc(t('want.' + k))}</button>`).join('')}</div></div>
    <label class="inp"><span>${esc(t('form.msg'))}</span><textarea name="msg">${esc(form.msg)}</textarea></label>
    <label class="consent" data-consent><input type="checkbox" name="consent" ${form.consent ? 'checked' : ''}><span>${esc(t('form.consent', { company: site.company }))}</span></label>
    <p class="src">${esc(t('form.required'))}</p>
    <button class="btn btn--yellow btn--full" type="submit">${ICON.mail}${esc(t('m.send'))}</button>
  </form>`;
}
function inp(k, label, type, ac) {
  return `<label class="inp"><span>${esc(label)}</span><input name="${k}" type="${type}" autocomplete="${ac}" value="${esc(form[k])}"${type === 'email' ? ' inputmode="email" autocapitalize="off"' : ''}${type === 'tel' ? ' inputmode="tel"' : ''}></label>`;
}

function wire(devices) {
  $('[data-share]')?.addEventListener('click', async () => {
    try { await navigator.share({ title: t('m.title'), url: location.href }); } catch {
      try { await navigator.clipboard.writeText(location.href); toast('✓ ' + location.href.slice(0, 40) + '…'); } catch { /* egal */ }
    }
  });
  const f = $('[data-form]');
  if (!f) return;
  f.addEventListener('input', (e) => {
    const n = e.target.name;
    if (!n) return;
    if (n === 'consent') form.consent = e.target.checked; else form[n] = e.target.value;
    e.target.closest('.inp')?.classList.remove('is-bad');
    $('[data-consent]')?.classList.remove('is-bad');
  });
  f.addEventListener('change', (e) => {
    if (e.target.name === 'country') {
      form.countryTouched = true;
      country = e.target.value === 'other' ? '' : e.target.value;
      loc = country ? localeFor(country, lang()) : '';
      render();
      location.hash = 'kontakt';
    }
  });
  $$('[data-want]', f).forEach((b) => b.addEventListener('click', () => { const k = b.dataset.want; if (form.wants.has(k)) form.wants.delete(k); else form.wants.add(k); b.classList.toggle('is-on'); }));
  f.addEventListener('submit', (e) => { e.preventDefault(); send(devices); });
}

function message(devices) {
  const ev = eventInfo();
  const c = calcData();
  const p = Q.get('p');
  const site = visitorSite();
  return [
    t('m.body.intro'), '',
    devices.length ? `${t('m.body.interest')}: ${devices.map(pname).join(', ')}` : '',
    form.wants.size ? `${t('m.body.wants')}: ${[...form.wants].map((w) => t('want.' + w)).join(', ')}` : '',
    ev.line ? `${t('m.body.event')}: ${[ev.line, ev.booth].filter(Boolean).join(' · ')}` : '',
    c ? `${t('m.body.calc')}: ${t('m.calc.line', { machines: c.machines, shifts: c.shifts, days: c.days, rate: money(c.rate, c.cur) })} → ${money(c.save, c.cur)}` : '',
    p ? `${t('m.body.plan')}: ${(site.planer || '') + '#p=' + p}` : '',
    form.msg ? '\n' + form.msg : '', '',
    t('m.body.bye'), [form.first, form.last].filter(Boolean).join(' '), form.company, [form.email, form.phone].filter(Boolean).join(' · '),
  ].filter((x) => x !== '').join('\n');
}

async function send(devices) {
  const bad = [];
  if (!form.last.trim()) bad.push('last');
  if (!form.company.trim()) bad.push('company');
  const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  if (!mailOk && form.phone.replace(/\D/g, '').length < 6) bad.push('email', 'phone');
  bad.forEach((k) => $(`[name="${k}"]`)?.closest('.inp')?.classList.add('is-bad'));
  if (!form.consent) $('[data-consent]').classList.add('is-bad');
  if (bad.length || !form.consent) { toast(t('form.err')); return; }
  const site = visitorSite();
  const body = message(devices);
  const ev = eventInfo();
  const subject = `${t('m.subject')}${ev.title ? ' – ' + ev.title : ''} – ${form.company.trim()}`;
  // HubSpot: dasselbe Formular wie Kiosk und Erfassung (Quelle »selbst am Handy«), sonst E-Mail an die ZOLLER-Gesellschaft
  const hs = (Q.get('hs') || '').split('~');
  const cfg = hubspotConfig(hs[0] && hs[1] ? { portal: hs[0], form: hs[1], host: hs[2] || 'api.hsforms.com' } : null);
  if (cfg && mailOk) {
    try {
      const c = calcData();
      const p = Q.get('p');
      const reg = Object.values(D.sites).find((x) => x.site === country);
      let countryEn = '';
      try { countryEn = reg ? new Intl.DisplayNames(['en'], { type: 'region' }).of(reg.flag === 'uk' ? 'GB' : reg.flag.toUpperCase()) : ''; } catch { /* alt */ }
      const lead = upgrade(newLead({
        source: 'handy', device: 'Messe-Mappe', event: D.events.find((x) => x.id === Q.get('e')) || (ev.title ? { title: ev.title, city: ev.city } : null),
        eventLine: ev.line, booth: ev.booth, site: Q.get('h') || '', lang: lang(),
        first: form.first.trim(), last: form.last.trim(), company: form.company.trim(), email: form.email.trim(), phone: form.phone.trim(), countryName: countryEn,
        interests: [...new Set(devices.map((p) => interestKey(p.id)))], products: devices.map((p) => pname(p).replace(/[»«]/g, '')), wants: [...form.wants], msg: form.msg.trim(), plan: p ? (site.planer || '') + '#p=' + p : '',
        calc: c ? { machines: c.machines, shifts: c.shifts, days: c.days, rate: c.rate, save: Math.round(c.save), cur: c.cur } : null,
        consent: true, consentText: t('form.consent', { company: site.company }),
      }));
      await sendLead(lead, { ...cfg, pageUri: location.origin + location.pathname }, lang() === 'de' ? 'de' : 'en');
      form.sent = true; render(); location.hash = 'kontakt'; return;
    } catch (e) { console.warn(e); toast(t('m.fail')); }
  }
  const cc = host && host.mail !== site.mail ? host.mail : '';
  const href = `mailto:${site.mail}?${cc ? 'cc=' + encodeURIComponent(cc) + '&' : ''}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  toast(t('m.mail'), 6000);
  setTimeout(() => { location.href = href; }, 400);
}

boot();
