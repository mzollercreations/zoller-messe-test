// ZOLLER Leads – Lead-Erfassung des Standpersonals auf Handy oder iPad (ersetzt die Apps von Captello und snapADDY).
// Messe einmal einrichten (oder vom Kiosk-iPad per QR übernehmen), dann Badge scannen / Visitenkarte / von Hand + Fragebogen.
// Leads liegen zuerst auf dem Gerät und gehen von selbst an HubSpot, sobald Netz da ist.
import { useData, startSync, syncNow, onChange, allLeads, counts, hubspotConfig, templates, label, eventName, readPair, csv, csvRows,
  shareFile, fileTag, deleteLead, purgeSent, syncRunning } from '../assets/js/leads.js';
import { openCapture, ICONS } from '../assets/js/capture.js';
import { scan } from '../assets/js/scan.js';

const KEY = 'zm.erfassen';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TX = {
  de: {
    badge: 'Badge scannen', card: 'Visitenkarte', hand: 'Von Hand', today: 'Heute', mine: 'Von mir', open: 'Offen', all: 'Alle', none: 'Noch keine Leads – los geht’s mit »Badge scannen«.',
    st: { gesendet: 'in HubSpot', wartet: 'wartet', neu: 'wartet', fehler: 'abgelehnt', unvollstaendig: 'ohne E-Mail' },
    pill: { sync: 'Überträgt …', ok: 'Alles in HubSpot', wait: '{n} warten', off: 'Offline · {n} warten', bad: '{n} abgelehnt', mail: '{n} ohne E-Mail', nohs: 'HubSpot fehlt', empty: 'Bereit' },
    setup: 'Einrichtung', staff: 'Ihr Name (Standpersonal)', device: 'Name dieses Geräts', event: 'Messe', evCustom: 'Andere Messe …', evTitle: 'Name der Messe',
    evCity: 'Ort', evStart: 'Erster Messetag', booth: 'Halle / Stand', site: 'Ausstellende ZOLLER-Gesellschaft', form: 'Fragebogen', lang: 'Sprache',
    pair: 'Vom Kiosk-iPad übernehmen', pairP: 'Am Messe-iPad: Personalbereich → Einrichtung → »Handys des Standpersonals verbinden«. Den Code dort hier scannen.',
    paired: 'Messe übernommen – bitte noch Ihren Namen prüfen.', pairBad: 'Das ist kein Kopplungs-Code der Messe-App.', done: 'Fertig',
    hs: 'HubSpot', hsOn: 'Formular »ZOLLER Messe – Leads« · Portal {p}', hsSandbox: 'TEST-Konto (Sandbox) – Leads landen NICHT im echten HubSpot.',
    hsOff: 'Kein HubSpot-Formular eingebaut – Leads bleiben auf dem Gerät (CSV-Export).', sendNow: 'Jetzt senden',
    data: 'Daten auf diesem Gerät', csvHs: 'CSV für HubSpot', csvXls: 'CSV für Excel', purge: 'Übertragene löschen', purgeQ: 'Alle bereits an HubSpot übertragenen Leads von diesem Gerät löschen?',
    need: 'Bitte Name und Messe eintragen.', home: 'Zur Erfassung', version: 'Version', install: 'Tipp: Teilen → »Zum Home-Bildschirm«, dann läuft die App auch ohne Netz.',
    err: 'Fehler', retry: 'Erneut senden',
  },
  en: {
    badge: 'Scan badge', card: 'Business card', hand: 'Manual', today: 'Today', mine: 'By me', open: 'Open', all: 'All', none: 'No leads yet – start with “Scan badge”.',
    st: { gesendet: 'in HubSpot', wartet: 'waiting', neu: 'waiting', fehler: 'rejected', unvollstaendig: 'no e-mail' },
    pill: { sync: 'Sending …', ok: 'All in HubSpot', wait: '{n} waiting', off: 'Offline · {n} waiting', bad: '{n} rejected', mail: '{n} without e-mail', nohs: 'No HubSpot', empty: 'Ready' },
    setup: 'Setup', staff: 'Your name (booth staff)', device: 'Name of this device', event: 'Event', evCustom: 'Other event …', evTitle: 'Event name',
    evCity: 'City', evStart: 'First show day', booth: 'Hall / booth', site: 'Exhibiting ZOLLER company', form: 'Questionnaire', lang: 'Language',
    pair: 'Take over from the kiosk iPad', pairP: 'On the booth iPad: staff area → Setup → “Connect booth staff phones”. Scan that code here.',
    paired: 'Event taken over – please check your name.', pairBad: 'This is not a pairing code of the trade show app.', done: 'Done',
    hs: 'HubSpot', hsOn: 'Form “ZOLLER Messe – Leads” · portal {p}', hsSandbox: 'TEST account (sandbox) – leads do NOT reach the real HubSpot.',
    hsOff: 'No HubSpot form built in – leads stay on this device (CSV export).', sendNow: 'Send now',
    data: 'Data on this device', csvHs: 'CSV for HubSpot', csvXls: 'CSV for Excel', purge: 'Delete sent leads', purgeQ: 'Delete all leads already sent to HubSpot from this device?',
    need: 'Please enter your name and the event.', home: 'Back to capture', version: 'Version', install: 'Tip: Share → “Add to Home Screen” – then the app also works offline.',
    err: 'Error', retry: 'Send again',
  },
  fr: {
    badge: 'Scanner le badge', card: 'Carte de visite', hand: 'Saisie manuelle', today: 'Aujourd’hui', mine: 'Par moi', open: 'En attente', all: 'Tous', none: 'Aucun contact – commencez par « Scanner le badge ».',
    st: { gesendet: 'dans HubSpot', wartet: 'en attente', neu: 'en attente', fehler: 'refusé', unvollstaendig: 'sans e-mail' },
    pill: { sync: 'Envoi …', ok: 'Tout dans HubSpot', wait: '{n} en attente', off: 'Hors ligne · {n} en attente', bad: '{n} refusé(s)', mail: '{n} sans e-mail', nohs: 'HubSpot manquant', empty: 'Prêt' },
    setup: 'Configuration', staff: 'Votre nom (équipe du stand)', device: 'Nom de cet appareil', event: 'Salon', evCustom: 'Autre salon …', evTitle: 'Nom du salon',
    evCity: 'Ville', evStart: 'Premier jour', booth: 'Hall / stand', site: 'Société ZOLLER exposante', form: 'Questionnaire', lang: 'Langue',
    pair: 'Reprendre de l’iPad du stand', pairP: 'Sur l’iPad du stand : espace équipe → Setup → « Connect booth staff phones ». Scannez ce code ici.',
    paired: 'Salon repris – vérifiez votre nom.', pairBad: 'Ce n’est pas un code de l’app salon.', done: 'Terminé',
    hs: 'HubSpot', hsOn: 'Formulaire « ZOLLER Messe – Leads » · portail {p}', hsSandbox: 'Compte TEST (sandbox) – les contacts n’arrivent PAS dans le vrai HubSpot.',
    hsOff: 'Aucun formulaire HubSpot intégré – les contacts restent sur l’appareil (export CSV).', sendNow: 'Envoyer',
    data: 'Données sur cet appareil', csvHs: 'CSV pour HubSpot', csvXls: 'CSV pour Excel', purge: 'Supprimer les envoyés', purgeQ: 'Supprimer de cet appareil tous les contacts déjà envoyés à HubSpot ?',
    need: 'Indiquez votre nom et le salon.', home: 'Retour à la saisie', version: 'Version', install: 'Astuce : Partager → « Sur l’écran d’accueil » – l’app fonctionne alors hors ligne.',
    err: 'Erreur', retry: 'Renvoyer',
  },
  es: {
    badge: 'Escanear gafete', card: 'Tarjeta de visita', hand: 'A mano', today: 'Hoy', mine: 'Míos', open: 'Pendientes', all: 'Todos', none: 'Aún no hay contactos – empiece con «Escanear gafete».',
    st: { gesendet: 'en HubSpot', wartet: 'pendiente', neu: 'pendiente', fehler: 'rechazado', unvollstaendig: 'sin correo' },
    pill: { sync: 'Enviando …', ok: 'Todo en HubSpot', wait: '{n} pendientes', off: 'Sin conexión · {n} pendientes', bad: '{n} rechazados', mail: '{n} sin correo', nohs: 'Falta HubSpot', empty: 'Listo' },
    setup: 'Configuración', staff: 'Su nombre (personal del stand)', device: 'Nombre de este equipo', event: 'Feria', evCustom: 'Otra feria …', evTitle: 'Nombre de la feria',
    evCity: 'Ciudad', evStart: 'Primer día', booth: 'Pabellón / stand', site: 'Empresa ZOLLER expositora', form: 'Cuestionario', lang: 'Idioma',
    pair: 'Tomar del iPad del stand', pairP: 'En el iPad del stand: área del personal → Setup → «Connect booth staff phones». Escanee ese código aquí.',
    paired: 'Feria tomada – revise su nombre.', pairBad: 'No es un código de la app de ferias.', done: 'Listo',
    hs: 'HubSpot', hsOn: 'Formulario «ZOLLER Messe – Leads» · portal {p}', hsSandbox: 'Cuenta de PRUEBA (sandbox) – los contactos NO llegan al HubSpot real.',
    hsOff: 'Sin formulario de HubSpot – los contactos quedan en el equipo (exportar CSV).', sendNow: 'Enviar ahora',
    data: 'Datos en este equipo', csvHs: 'CSV para HubSpot', csvXls: 'CSV para Excel', purge: 'Borrar enviados', purgeQ: '¿Borrar de este equipo todos los contactos ya enviados a HubSpot?',
    need: 'Indique su nombre y la feria.', home: 'Volver a capturar', version: 'Versión', install: 'Consejo: Compartir → «Añadir a inicio» – así la app funciona sin conexión.',
    err: 'Error', retry: 'Reenviar',
  },
};
const LANGS = [['de', 'Deutsch'], ['en', 'English'], ['fr', 'Français'], ['es', 'Español']];

let D = null, S = load(), filter = 'all', version = '';
const L = () => (TX[S.lang] ? S.lang : 'en');
const tx = (k, v) => { let s = k.split('.').reduce((o, p) => o?.[p], TX[L()]) ?? k.split('.').reduce((o, p) => o?.[p], TX.en) ?? k; if (v) s = s.replace(/\{(\w+)\}/g, (m, x) => v[x] ?? m); return s; };

function load() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* neu */ }
  const nav = (navigator.language || 'de').slice(0, 2);
  return { staff: '', device: '', event: null, booth: '', site: '', form: '', lang: TX[nav] ? nav : 'en', hubspot: null, ...s };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* voll */ } }
const ready = () => S.staff && S.event;
const company = () => D?.sites?.[S.site]?.company || 'ZOLLER';
const hs = () => hubspotConfig(S.hubspot);

async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { scope: './' }).catch((e) => console.warn(e));
  try { D = await (await fetch('../data/kiosk.json')).json(); } catch (e) {
    $('[data-main]').innerHTML = `<p class="warn">Daten nicht geladen (${esc(e.message)}). Bitte einmal mit Internet öffnen.</p>`; return;
  }
  try { version = (await (await fetch('../data/version.json', { cache: 'no-store' })).json()).version; } catch { /* offline */ }
  useData(D);
  document.documentElement.lang = L();
  if (!S.device) S.device = /iPad/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform)) ? 'iPad' : /iPhone/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'Mac/PC';
  // Kopplung per Link (Kamera-App scannt den Code am Kiosk)
  if (/setup=/.test(location.hash + location.search)) {
    const p = readPair(location.hash + location.search);
    history.replaceState(null, '', location.pathname);
    if (p) { applyPair(p); }
  }
  startSync({ config: hs, lang: () => L() });
  purgeSent(30).catch(() => {});
  onChange(() => { updatePill(); if (!$('.cap') && !$('.setup')) renderHome(); });
  $('[data-sync]').addEventListener('click', () => syncNow({ force: true }));
  $('[data-go="setup"]').addEventListener('click', () => renderSetup());
  if (ready()) renderHome(); else renderSetup();
}

function applyPair(p) {
  S = { ...S, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && v !== '')) };
  if (p.lang && !TX[p.lang]) S.lang = 'en';
  save();
}

// ================================================================== Status
async function updatePill() {
  const pill = $('[data-sync]');
  const c = counts(await allLeads());
  const cfg = hs();
  let cls = 'ok', text;
  if (syncRunning()) { cls = 'busy'; text = tx('pill.sync'); }
  else if (!cfg) { cls = 'dim'; text = tx('pill.nohs'); }
  else if (c.fehler) { cls = 'bad'; text = tx('pill.bad', { n: c.fehler }); }
  else if (c.open) { cls = navigator.onLine === false ? 'dim' : 'wait'; text = tx(navigator.onLine === false ? 'pill.off' : 'pill.wait', { n: c.open }); }
  else if (c.unvollstaendig) { cls = 'wait'; text = tx('pill.mail', { n: c.unvollstaendig }); }
  else text = c.gesendet ? tx('pill.ok') : tx('pill.empty');
  pill.className = 'pill pill--' + cls;
  $('[data-sync-t]').textContent = text;
  if (cfg?.sandbox) pill.classList.add('pill--test');
}
addEventListener('online', updatePill);
addEventListener('offline', updatePill);

// ================================================================== Start: erfassen + Liste
async function renderHome() {
  const main = $('[data-main]');
  const list = await allLeads();
  const day = new Date().toLocaleDateString('sv-SE');
  const todays = list.filter((l) => l.day === day);
  const mine = list.filter((l) => l.staff === S.staff);
  const c = counts(list);
  const shown = (filter === 'mine' ? mine : filter === 'open' ? list.filter((l) => l.sync.state !== 'gesendet') : list);
  const tpl = templates().find((t) => t.id === S.form);
  main.innerHTML = `<button class="ev" data-go-setup>
      <b>${esc(eventName(S.event) || '–')}</b>
      <span>${esc([S.booth, S.staff, label(tpl?.title, L())].filter(Boolean).join(' · '))}</span>
      ${hs()?.sandbox ? `<em class="ev__test">${esc(tx('hsSandbox'))}</em>` : ''}
    </button>
    <div class="go">
      <button class="go__big" data-new="badge">${ICONS.qr}<span>${esc(tx('badge'))}</span></button>
      <button data-new="visitenkarte">${ICONS.card}<span>${esc(tx('card'))}</span></button>
      <button data-new="manuell">${ICONS.pen}<span>${esc(tx('hand'))}</span></button>
    </div>
    <div class="kpi"><div><b>${todays.length}</b><span>${esc(tx('today'))}</span></div><div><b>${mine.length}</b><span>${esc(tx('mine'))}</span></div>
      <div><b>${c.open + c.fehler + c.unvollstaendig}</b><span>${esc(tx('open'))}</span></div></div>
    <div class="seg">${['all', 'mine', 'open'].map((f) => `<button data-filter="${f}" class="${filter === f ? 'is-on' : ''}">${esc(tx(f))}</button>`).join('')}</div>
    <div class="list">${shown.length ? shown.map(row).join('') : `<p class="empty">${esc(tx('none'))}</p>`}</div>
    ${navigator.standalone || matchMedia('(display-mode: standalone)').matches ? '' : `<p class="tip">${esc(tx('install'))}</p>`}`;
  $('[data-go-setup]').addEventListener('click', renderSetup);
  $$('[data-new]').forEach((b) => b.addEventListener('click', () => capture(b.dataset.new)));
  $$('[data-filter]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; renderHome(); }));
  $$('[data-lead]').forEach((b) => b.addEventListener('click', async () => {
    const l = (await allLeads()).find((x) => x.id === b.dataset.lead);
    if (l) capture(null, l);
  }));
  updatePill();
}

function row(l) {
  const when = new Date(l.created).toLocaleString(L(), { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const st = l.sync.state;
  return `<button class="lrow" data-lead="${esc(l.id)}">
    <i class="dot r-${esc(l.rating || 'x')}"></i>
    <div><b>${l.photo ? `<span class="lrow__cam" title="Foto">${ICONS.cam}</span>` : ''}${esc([l.first, l.last].filter(Boolean).join(' ') || l.email || l.badge.slice(0, 24) || '–')}</b>
      <span>${esc([l.company, when, l.staff !== S.staff ? l.staff : ''].filter(Boolean).join(' · '))}</span>
      ${st === 'fehler' ? `<span class="lrow__err">${esc(tx('err'))}: ${esc(l.sync.error || '')}</span>` : ''}</div>
    <em class="st st--${esc(st)}">${esc(tx('st.' + st))}</em></button>`;
}

function capture(source, lead) {
  if (!ready()) { renderSetup(); return; }
  openCapture(document.body, {
    lang: L(), setup: S, company: company(), lead, source,
    onSaved: (l, next) => { renderHome(); if (next) capture('badge'); },
    onClose: () => renderHome(),
  });
}

// ================================================================== Einrichtung
function renderSetup() {
  const main = $('[data-main]');
  const evs = [...(D.events || [])].sort((a, b) => (a.start < b.start ? -1 : 1));
  const custom = S.event && !S.event.id;
  const sites = Object.entries(D.sites || {}).sort((a, b) => a[1].company.localeCompare(b[1].company));
  const cfg = hs();
  const city = (e) => (typeof e.city === 'string' ? e.city : (e.city?.[L()] || e.city?.en || ''));
  main.innerHTML = `<div class="setup">
    <h1>${esc(tx('setup'))}</h1>
    <section class="box">
      <label class="cf"><span>${esc(tx('staff'))} *</span><input data-k="staff" value="${esc(S.staff)}" autocomplete="name"></label>
      <label class="cf"><span>${esc(tx('device'))}</span><input data-k="device" value="${esc(S.device)}"></label>
      <label class="cf"><span>${esc(tx('lang'))}</span><select data-k="lang">${LANGS.map(([c, n]) => `<option value="${c}" ${c === L() ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </section>
    <section class="box">
      <button class="cbtn cbtn--dark" data-pair>${ICONS.qr}<span>${esc(tx('pair'))}</span></button>
      <p class="hint">${esc(tx('pairP'))}</p>
    </section>
    <section class="box">
      <label class="cf"><span>${esc(tx('event'))} *</span><select data-k="event"><option value="">–</option>
        ${evs.map((e) => `<option value="${esc(e.id)}" ${S.event?.id === e.id ? 'selected' : ''}>${esc(`${e.title} · ${city(e)} · ${e.start}`)}</option>`).join('')}
        <option value="*" ${custom ? 'selected' : ''}>${esc(tx('evCustom'))}</option></select></label>
      <div data-custom ${custom ? '' : 'hidden'} class="grid2">
        <label class="cf"><span>${esc(tx('evTitle'))}</span><input data-k="evTitle" value="${esc(custom ? S.event.title : '')}"></label>
        <label class="cf"><span>${esc(tx('evCity'))}</span><input data-k="evCity" value="${esc(custom ? (typeof S.event.city === 'string' ? S.event.city : '') : '')}"></label>
        <label class="cf"><span>${esc(tx('evStart'))}</span><input data-k="evStart" type="date" value="${esc(custom ? S.event.start || '' : '')}"></label>
      </div>
      <label class="cf"><span>${esc(tx('booth'))}</span><input data-k="booth" value="${esc(S.booth)}" placeholder="Halle 5 · A12"></label>
      <label class="cf"><span>${esc(tx('site'))}</span><select data-k="site"><option value="">–</option>${sites.map(([code, s]) => `<option value="${esc(code)}" ${code === S.site ? 'selected' : ''}>${esc(s.company)} – ${esc(s.name)}</option>`).join('')}</select></label>
      <label class="cf"><span>${esc(tx('form'))}</span><select data-k="form">${templates().map((t) => `<option value="${esc(t.id)}" ${t.id === (S.form || D.fragen?.default) ? 'selected' : ''}>${esc(label(t.title, L()))}</option>`).join('')}</select></label>
    </section>
    <section class="box">
      <h2>${esc(tx('hs'))}</h2>
      <p class="${cfg ? (cfg.sandbox ? 'warn' : 'ok') : 'warn'}">${esc(cfg ? (cfg.sandbox ? tx('hsSandbox') : tx('hsOn', { p: cfg.portal })) : tx('hsOff'))}</p>
      ${cfg ? `<button class="cbtn cbtn--line" data-send>${esc(tx('sendNow'))}</button>` : ''}
      <h2>${esc(tx('data'))}</h2>
      <div class="row"><button class="cbtn cbtn--line cbtn--sm" data-csv=",">${esc(tx('csvHs'))}</button><button class="cbtn cbtn--line cbtn--sm" data-csv=";">${esc(tx('csvXls'))}</button>
        <button class="cbtn cbtn--ghost cbtn--sm" data-purge>${esc(tx('purge'))}</button></div>
      <p class="hint">${esc(tx('version'))} ${esc(version || '–')}</p>
    </section>
    <button class="cbtn cbtn--yellow wide" data-done>${esc(ready() ? tx('home') : tx('done'))}</button>
  </div>`;
  const set = (patch) => { S = { ...S, ...patch }; save(); };
  const box = $('.setup', main);
  box.addEventListener('change', onChangeSetup);
  box.addEventListener('input', onChangeSetup);
  function onChangeSetup(e) {
    const k = e.target.dataset.k;
    if (!k) return;
    const v = e.target.value.trim();
    if (k === 'event') {
      $('[data-custom]').hidden = v !== '*';
      if (v === '*') set({ event: { title: $('[data-k="evTitle"]').value.trim(), city: $('[data-k="evCity"]').value.trim(), start: $('[data-k="evStart"]').value } });
      else if (!v) set({ event: null });
      else {
        const ev = D.events.find((x) => x.id === v);
        const site = Object.entries(D.sites).find(([, s]) => s.country === ev.country && s.lang === L())?.[0] || Object.entries(D.sites).find(([, s]) => s.country === ev.country)?.[0];
        set({ event: ev, ...(site && !S.site ? { site } : {}) });
        if (site && $('[data-k="site"]').value === '') $('[data-k="site"]').value = site;
      }
    } else if (k === 'evTitle' || k === 'evCity' || k === 'evStart') {
      set({ event: { title: $('[data-k="evTitle"]').value.trim(), city: $('[data-k="evCity"]').value.trim(), start: $('[data-k="evStart"]').value } });
    } else if (k === 'lang') { set({ lang: v }); document.documentElement.lang = v; renderSetup(); }
    else set({ [k]: v });
  }
  $('[data-pair]').addEventListener('click', async () => {
    const text = await scan(document.body, { title: tx('pair'), hint: tx('pairP'), cancel: 'OK', accept: (t) => /setup=/.test(t) });
    if (!text) return;
    const p = readPair(text);
    if (!p) { alert(tx('pairBad')); return; }
    applyPair(p);
    renderSetup();
    setTimeout(() => alert(tx('paired')), 50);
  });
  $('[data-send]')?.addEventListener('click', () => syncNow({ force: true }));
  $$('[data-csv]').forEach((b) => b.addEventListener('click', async () => {
    const list = await allLeads();
    if (!list.length) return;
    await shareFile(`ZOLLER-Leads-${fileTag()}.csv`, csv(csvRows(list, L()), b.dataset.csv), 'text/csv');
  }));
  $('[data-purge]').addEventListener('click', async () => {
    if (!confirm(tx('purgeQ'))) return;
    for (const l of await allLeads()) if (l.sync.state === 'gesendet') await deleteLead(l);
  });
  $('[data-done]').addEventListener('click', () => {
    if (!S.form) set({ form: D.fragen?.default || 'standard' });
    if (!ready()) { alert(tx('need')); return; }
    renderHome();
  });
  updatePill();
}

boot();
