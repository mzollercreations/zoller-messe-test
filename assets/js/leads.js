// Messe-Leads – ein Kern für den iPad-Kiosk (Besucher trägt sich ein), die Erfassung des Standpersonals (Handy/iPad) und die
// Messe-Mappe am Handy. Ersetzt Captello und snapADDY:
//   - Fragebogen je Messe (tools/frageboegen.json), Antworten landen in HubSpot-Kontaktfeldern (auch in den alten Captello-Feldern)
//   - Warteschlange auf dem Gerät, Übertragung über die öffentliche HubSpot-Forms-API (kein Schlüssel auf dem Gerät), sobald Netz da ist
//   - Leser für Besucherausweise (vCard, MeCard, BIZCARD, Links, JSON, Textzeilen) und Visitenkarten-Text (iOS »Text scannen«)
//   - lesbarer Messebericht, CSV für HubSpot-Import/Excel
import { leads, photos, uid, today } from './store.js';

let D = null;                       // data/kiosk.json (fragen, hubspot, events, sites)
export function useData(data) { D = data; }

const isMail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
export { isMail };
const plain = (s) => String(s ?? '').replace(/[»«]/g, '').trim();

// Wünsche aus dem Kiosk-Formular (Texte want.* in 18 Sprachen) → Standardwerte
const WANT = { offer: 'angebot', demo: 'vorfuehrung', call: 'rueckruf', docs: 'unterlagen', visit: 'besuch' };
// frühere Bewertung im Personalbereich (heiß/warm/kalt) → vier Stufen wie bei ZOLLER USA (Hot/High/Medium/Low)
const RATE = { hot: 'heiss', warm: 'mittel', cold: 'niedrig' };
export const RATINGS = ['heiss', 'hoch', 'mittel', 'niedrig'];
export const SOURCES = ['badge', 'visitenkarte', 'manuell', 'ipad', 'handy'];

// ================================================================== Fragebogen
export function templates() { return D?.fragen?.templates || []; }
export function template(id) {
  const all = templates();
  return all.find((t) => t.id === id) || all.find((t) => t.id === D?.fragen?.default) || all[0] || { id: 'standard', questions: [] };
}
export function label(x, lang) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  return x[lang] ?? x[lang?.split('-')[0]] ?? x.en ?? x.de ?? Object.values(x)[0] ?? '';
}
const optKey = (o) => o.k;
const optStd = (o) => o.s ?? o.k;
const optVal = (o) => o.v ?? o.k;
const asList = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

/** Ist die Frage sichtbar (Bedingung »when« erfüllt)? */
export function visible(q, answers) {
  if (!q.when) return true;
  const got = asList(answers?.[q.when.q]);
  if (!got.length) return false;
  return !q.when.has || q.when.has.some((k) => got.includes(k));
}

/** Standardangaben (Bewertung, Interesse, Wunsch, Zeitraum, Rolle) aus den Antworten ableiten – nur, wenn dazu etwas beantwortet ist */
export function deriveStd(lead) {
  const tpl = template(lead.form);
  const got = {};
  for (const q of tpl.questions) {
    if (!q.std || !visible(q, lead.answers)) continue;
    const keys = asList(lead.answers?.[q.id]);
    if (!keys.length) continue;
    const vals = keys.map((k) => q.options?.find((o) => optKey(o) === k)).filter(Boolean).map(optStd);
    (got[q.std] = got[q.std] || []).push(...vals);
  }
  for (const [std, vals] of Object.entries(got)) {
    const u = [...new Set(vals)];
    if (std === 'interests' || std === 'wants') lead[std] = u; else lead[std] = u[0] || '';
  }
  return lead;
}

/** Standardangabe direkt setzen (z. B. Bewertung im Personalbereich) – beantwortete Fragen dazu werden mitgezogen */
export function setStd(lead, std, value) {
  lead[std] = value;
  for (const q of template(lead.form).questions) {
    if (q.std !== std || !asList(lead.answers?.[q.id]).length) continue;
    const keys = asList(value).map((s) => q.options?.find((o) => optStd(o) === s)).filter(Boolean).map(optKey);
    lead.answers[q.id] = q.type === 'multi' ? keys : (keys[0] || '');
  }
  return lead;
}

/** Antworten für den Versand: unbeantwortete Standardfragen aus den Standardangaben füllen (z. B. Kiosk-Lead, Bewertung im Personalbereich) */
function answersForSend(lead, tpl) {
  const a = structuredClone(lead.answers || {});
  for (const q of tpl.questions) {
    if (!q.std || asList(a[q.id]).length) continue;
    const want = asList(lead[q.std]);
    if (!want.length) continue;
    const keys = [];
    for (const s of want) { const o = q.options?.find((x) => optStd(x) === s); if (o && !keys.includes(optKey(o))) keys.push(optKey(o)); }
    if (keys.length) a[q.id] = q.type === 'multi' ? keys : keys[0];
  }
  return a;
}

// ================================================================== Lead anlegen / speichern
export function newLead(base = {}) {
  return {
    id: uid(), created: new Date().toISOString(), day: today(), source: 'manuell', device: '', staff: '',
    event: null, eventLine: '', booth: '', site: '', lang: 'de', form: D?.fragen?.default || 'standard',
    salutation: '', first: '', last: '', company: '', title: '', email: '', phone: '', mobile: '', website: '',
    street: '', zip: '', city: '', country: '', countryName: '',
    badge: '', card: '', photo: '', rating: '', interests: [], wants: [], timeframe: '', role: '', answers: {}, note: '', msg: '',
    films: [], calc: null, plan: '', consent: false, consentText: '', newsletter: false, sync: { state: 'neu', tries: 0 }, exported: false,
    ...base,
  };
}

/** ältere Kiosk-Leads (synced/hot/offer …) auf den heutigen Stand bringen */
export function upgrade(l) {
  if (!l.sync) l.sync = { state: l.synced ? 'gesendet' : 'neu', tries: 0 };
  if (RATE[l.rating]) l.rating = RATE[l.rating];
  if (l.wants?.some((w) => WANT[w])) l.wants = l.wants.map((w) => WANT[w] || w);
  if (!l.source) l.source = 'ipad';
  if (!l.device && l.kiosk) l.device = l.kiosk;
  if (!l.eventLine && typeof l.event === 'string') { l.eventLine = l.event; l.event = null; }
  l.answers = l.answers || {};
  return l;
}

export async function allLeads() { return (await leads.all()).map(upgrade); }

/** Speichern (neu oder geändert) – geänderte, schon übertragene Leads gehen erneut an HubSpot (Kontakt wird aktualisiert) */
export async function saveLead(lead, { resend = true } = {}) {
  upgrade(lead);
  lead.updated = new Date().toISOString();
  deriveStd(lead);
  lead.synced = false;
  if (resend || !lead.sync) lead.sync = { state: isMail(lead.email) ? 'neu' : 'unvollstaendig', tries: 0 };
  await leads.put(lead);
  emit();
  syncSoon(600);
  return lead;
}
export async function setLeadField(lead, patch) { Object.assign(lead, patch); return saveLead(lead); }
export async function deleteLead(lead) {
  if (lead.photo) await photos.del(lead.photo);
  await leads.del(lead.id);
  emit();
}
export { photos };

// ================================================================== Messe, Texte für HubSpot
function eventCity(e) {
  if (!e?.city) return '';
  return typeof e.city === 'string' ? e.city : (e.city.en || e.city.de || Object.values(e.city)[0] || '');
}
export function eventName(e) {
  if (!e) return '';
  const year = (e.start || '').slice(0, 4);
  const title = e.title || '';
  return [title + (year && !title.includes(year) ? ' ' + year : ''), eventCity(e)].filter(Boolean).join(' · ');
}
export function eventId(e) {
  if (!e) return '';
  if (e.id) return e.id;
  return (e.title || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + (e.start ? '-' + e.start.slice(0, 4) : '');
}

const TXT = {
  de: { event: 'Messe', stand: 'Stand', when: 'Erfasst', by: 'von', src: { badge: 'Badge-Scan', visitenkarte: 'Visitenkarte', manuell: 'von Hand', ipad: 'selbst am iPad', handy: 'selbst am Handy (Messe-Mappe)' },
    rating: 'Bewertung', interests: 'Interesse an', wants: 'Nächster Schritt', timeframe: 'Investition geplant', role: 'Rolle beim Kauf', note: 'Notiz Standpersonal',
    msg: 'Nachricht des Besuchers', products: 'Merkliste', films: 'Filme angesehen', calc: 'Ersparnis-Rechner', plan: 'Werkzeugraum-Planung', badge: 'Badge-Code', card: 'Visitenkarte (Text)',
    newsletter: 'Newsletter gewünscht', yes: 'ja', consent: 'Einwilligung', machines: 'Maschinen', shifts: 'Schichten', days: 'Arbeitstage', rate: 'Stundensatz', save: 'Einsparung mind.', year: 'Jahr' },
  en: { event: 'Event', stand: 'Booth', when: 'Captured', by: 'by', src: { badge: 'badge scan', visitenkarte: 'business card', manuell: 'manual entry', ipad: 'self-service iPad', handy: 'self-service phone (show folder)' },
    rating: 'Rating', interests: 'Interested in', wants: 'Next step', timeframe: 'Time of investment', role: 'Role in purchase', note: 'Staff note',
    msg: 'Visitor message', products: 'Saved products', films: 'Films watched', calc: 'Savings calculator', plan: 'Toolroom plan', badge: 'Badge code', card: 'Business card (text)',
    newsletter: 'Newsletter requested', yes: 'yes', consent: 'Consent', machines: 'machines', shifts: 'shifts', days: 'working days', rate: 'hourly rate', save: 'savings min.', year: 'year' },
};
const T = (lang) => TXT[lang] || TXT[(lang || '').split('-')[0]] || TXT.en;
/** »Erfasst von« für Selbsteinträge: »Selbst am iPad (iPad 1)«, »Selbst am Handy (Messe-Mappe)« – in HubSpot nie leer */
const selfEntry = (lead, lang) => {
  if (lead.source !== 'ipad' && lead.source !== 'handy') return '';
  const src = T(lang).src[lead.source];
  return `${src[0].toUpperCase()}${src.slice(1)}${lead.source === 'ipad' && lead.device ? ` (${lead.device})` : ''}`;
};

function stdLabel(std, keys, lang) {
  const tpl = template('standard');
  const q = tpl.questions.find((x) => x.std === std);
  return asList(keys).map((k) => plain(label(q?.options?.find((o) => o.k === k)?.l, lang)) || k).join(', ');
}

/** Lesbarer Messebericht – steht in HubSpot im Feld »Messebericht« (und bei Captello-Messen in »Captello Lead Summary«) */
export function report(lead, lang = 'de', { qa = true } = {}) {
  const t = T(lang);
  const tpl = template(lead.form);
  const when = new Date(lead.created);
  const out = [];
  const ev = [lead.eventLine || eventName(lead.event), lead.booth && `${t.stand} ${lead.booth}`].filter(Boolean).join(' · ');
  if (ev) out.push(`${t.event}: ${ev}`);
  out.push(`${t.when}: ${when.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}`
    + `${lead.staff ? ` ${t.by} ${lead.staff}` : ''}${lead.device ? ` (${lead.device})` : ''} · ${t.src[lead.source] || lead.source}`);
  if (lead.rating) out.push(`${t.rating}: ${stdLabel('rating', lead.rating, lang)}`);
  if (lead.interests?.length) out.push(`${t.interests}: ${stdLabel('interests', lead.interests, lang)}`);
  if (lead.wants?.length) out.push(`${t.wants}: ${stdLabel('wants', lead.wants, lang)}`);
  if (lead.timeframe) out.push(`${t.timeframe}: ${stdLabel('timeframe', lead.timeframe, lang)}`);
  if (lead.role) out.push(`${t.role}: ${stdLabel('role', lead.role, lang)}`);
  if (qa) {
    for (const q of tpl.questions) {
      if (q.std || !visible(q, lead.answers)) continue;
      const a = lead.answers?.[q.id];
      if (!asList(a).length || (typeof a === 'string' && !a.trim())) continue;
      const text = q.options ? asList(a).map((k) => plain(label(q.options.find((o) => o.k === k)?.l, lang)) || k).join(', ') : String(a).trim();
      out.push(`${plain(label(q.label, lang))}: ${text}`);
    }
  }
  if (lead.msg) out.push(`${t.msg}: ${lead.msg}`);
  if (lead.note) out.push(`${t.note}: ${lead.note}`);
  const ex = extras(lead, lang);
  if (ex) out.push(ex);
  if (lead.newsletter) out.push(`${t.newsletter}: ${t.yes}`);
  if (lead.badge) out.push(`${t.badge}: ${lead.badge.slice(0, 300)}`);
  return out.join('\n');
}

export function extras(lead, lang = 'de') {
  const t = T(lang);
  const out = [];
  if (lead.products?.length) out.push(`${t.products}: ${lead.products.join(', ')}`);
  if (lead.films?.length) out.push(`${t.films}: ${lead.films.join(', ')}`);
  if (lead.calc) { const c = lead.calc; out.push(`${t.calc}: ${c.machines} ${t.machines}, ${c.shifts} ${t.shifts}, ${c.days} ${t.days}, ${t.rate} ${c.rate} → ${t.save} ${c.save} ${c.cur}/${t.year}`); }
  if (lead.plan) out.push(`${t.plan}: ${lead.plan}`);
  return out.join('\n');
}

// ================================================================== HubSpot (Forms-API)
/** Wirksame HubSpot-Einstellung: Eintrag im Gerät (Experten) oder die beim Bauen eingesetzte (tools/hubspot_messe.json) */
export function hubspotConfig(override) {
  const o = override || {};
  if (o.portal && o.form) return { ...(D?.hubspot || {}), ...o, own: true, fields: o.form === D?.hubspot?.form ? D.hubspot.fields : null };
  return D?.hubspot?.portal ? { ...D.hubspot } : null;
}

const utcDay = (day) => { const [y, m, d] = String(day).split('-').map(Number); return y ? String(Date.UTC(y, m - 1, d)) : ''; };

/** Felder der Übermittlung: Kontakt, Standardfelder »ZOLLER Messe«, Fragebogen (auch Captello-Felder), Messebericht */
export function hubspotFields(lead, cfg, lang = 'de') {
  const tpl = template(lead.form);
  const f = {};
  const set = (name, value) => { const v = String(value ?? '').trim(); if (v && !(name in f)) f[name] = v.slice(0, 65000); };
  set('email', lead.email); set('salutation', lead.salutation); set('firstname', lead.first); set('lastname', lead.last);
  set('company', lead.company); set('jobtitle', lead.title); set('phone', lead.phone); set('mobilephone', lead.mobile);
  set('website', lead.website); set('address', lead.street); set('zip', lead.zip); set('city', lead.city);
  set('country', lead.countryName || lead.country); set('message', lead.msg);
  set('zoller_messe_event', lead.eventLine || eventName(lead.event)); set('zoller_messe_event_id', eventId(lead.event) || eventId({ title: lead.eventLine }));
  set('zoller_messe_datum', utcDay(lead.day)); set('zoller_messe_stand', lead.booth);
  set('zoller_messe_bewertung', lead.rating);
  const interest = (lead.interests || []).filter((k) => !cfg?.interest || cfg.interest.includes(k));
  set('zoller_messe_interesse', interest.join(';'));
  set('zoller_messe_wunsch', (lead.wants || []).join(';'));
  set('zoller_messe_zeitrahmen', lead.timeframe); set('zoller_messe_rolle', lead.role);
  set('zoller_messe_notiz', lead.note); set('zoller_messe_erfasst_von', lead.staff || selfEntry(lead, lang)); set('zoller_messe_quelle', lead.source);
  set('zoller_messe_geraet', lead.device); set('zoller_messe_badge', lead.badge); set('zoller_messe_lead_id', lead.id);
  set('zoller_messe_extras', extras(lead, lang));
  if (lead.newsletter) set('zoller_newsletter', 'true');
  if (cfg?.lang?.[lead.lang]) set('hs_language', cfg.lang[lead.lang]);
  // Fragebogen → eigene Felder (bei der IMTS-Vorlage die vorhandenen Captello-Felder)
  const a = answersForSend(lead, tpl);
  for (const q of tpl.questions) {
    if (!visible(q, a)) continue;
    const got = a[q.id];
    if (!q.prop || q.prop.startsWith('zoller_messe_')) continue;
    if (q.options) {
      const opts = asList(got).map((k) => q.options.find((o) => o.k === k)).filter(Boolean);
      if (!opts.length) continue;
      set(q.prop, opts.map(optVal).join(';'));
      for (const o of opts) for (const [p, v] of Object.entries(o.also || {})) set(p, v);
    } else set(q.prop, got);
  }
  const rep = report(lead, lang);
  set('zoller_messe_bericht', rep);
  if (tpl.mirror?.bericht) set(tpl.mirror.bericht, rep);
  if (tpl.mirror?.note) set(tpl.mirror.note, lead.note);
  // nur Felder, die im HubSpot-Formular stehen (sonst lehnt die Forms-API ab); der Rest steht im Messebericht
  if (cfg?.fields?.length) for (const k of Object.keys(f)) if (!cfg.fields.includes(k)) delete f[k];
  return f;
}

export function hubspotBody(lead, cfg, lang, drop = new Set(), stamp = true) {
  const fields = Object.entries(hubspotFields(lead, cfg, lang)).filter(([k]) => !drop.has(k)).map(([name, value]) => ({ objectTypeId: '0-1', name, value }));
  const ev = lead.eventLine || eventName(lead.event);
  const body = {
    fields,
    context: { pageUri: cfg.pageUri || (location.origin + location.pathname), pageName: `ZOLLER Messe-App · ${ev || 'Messe'}` },
  };
  if (stamp) body.submittedAt = Date.parse(lead.created) || Date.now();
  if (lead.consent) body.legalConsentOptions = { consent: { consentToProcess: true, text: lead.consentText || 'Einwilligung am Messestand' } };
  return body;
}

class SendError extends Error {
  constructor(msg, { permanent = false, status = 0, fields = [] } = {}) { super(msg); this.permanent = permanent; this.status = status; this.fields = fields; }
}

async function post(cfg, body) {
  const url = `https://${cfg.host || 'api.hsforms.com'}/submissions/v3/integration/submit/${encodeURIComponent(cfg.portal)}/${encodeURIComponent(cfg.form)}`;
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) { throw new SendError('offline / ' + (e.message || e)); }
  if (res.ok) return true;
  const txt = await res.text().catch(() => '');
  let j = null; try { j = JSON.parse(txt); } catch { /* Text */ }
  const msgs = (j?.errors || []).map((e) => `${e.errorType || ''} ${e.message || ''}`.trim());
  const fields = [...txt.matchAll(/fields\.([\w-]+)/g)].map((m) => m[1]);
  const permanent = res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408;
  throw new SendError(`${res.status} ${msgs.join(' · ') || j?.message || txt.slice(0, 200)}`, { permanent, status: res.status, fields });
}

/** einen Lead senden; lehnt HubSpot einzelne Felder ab (z. B. Wert im Captello-Feld geändert), geht er ohne sie durch – sie stehen im Bericht */
export async function sendLead(lead, cfg, lang) {
  const drop = new Set();
  let stamp = true;
  for (let i = 0; i < 4; i++) {
    try { await post(cfg, hubspotBody(lead, cfg, lang, drop, stamp)); return { dropped: [...drop] }; } catch (e) {
      if (!e.permanent) throw e;
      const bad = e.fields.filter((k) => k !== 'email' && !drop.has(k));
      if (bad.length) { bad.forEach((k) => drop.add(k)); continue; }
      if (stamp && /submittedAt/i.test(e.message)) { stamp = false; continue; }
      throw e;
    }
  }
  throw new SendError('HubSpot lehnt den Lead ab', { permanent: true });
}

// ================================================================== Warteschlange
const SYNC = { running: false, timer: null, cfg: () => null, lang: () => 'de', subs: new Set() };
const emit = () => { for (const fn of SYNC.subs) try { fn(); } catch (e) { console.warn(e); } };
export function onChange(fn) { SYNC.subs.add(fn); return () => SYNC.subs.delete(fn); }
const backoff = (n) => Math.min(15 * 60, 20 * 2 ** Math.max(0, n - 1)) * 1000;   // 20 s, 40 s, … höchstens 15 min

export function startSync({ config, lang }) {
  SYNC.cfg = config; SYNC.lang = lang || SYNC.lang;
  addEventListener('online', () => syncSoon(400));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSoon(800); });
  setInterval(() => syncSoon(0), 30 * 1000);
  syncSoon(1500);
}
export function syncSoon(ms = 800) { clearTimeout(SYNC.timer); SYNC.timer = setTimeout(() => syncNow(), ms); }

/** alles Offene senden. force: auch abgelehnte und wartende sofort noch einmal versuchen */
export async function syncNow({ force = false } = {}) {
  const cfg = SYNC.cfg?.();
  if (!cfg?.portal || !cfg?.form || SYNC.running) return;
  const run = async () => {
    SYNC.running = true; emit();
    try {
      const list = (await allLeads()).sort((a, b) => (a.created < b.created ? -1 : 1));
      for (const l of list) {
        const st = l.sync.state;
        if (st === 'gesendet') continue;
        if (!isMail(l.email)) {
          if (st !== 'unvollstaendig') { l.sync = { ...l.sync, state: 'unvollstaendig' }; await leads.put(l); emit(); }
          continue;
        }
        if (st === 'fehler' && !force) continue;
        if (!force && l.sync.next && Date.now() < l.sync.next) continue;
        if (navigator.onLine === false) break;
        const tries = (l.sync.tries || 0) + 1;
        try {
          const r = await sendLead(l, cfg, SYNC.lang());
          l.sync = { state: 'gesendet', at: new Date().toISOString(), tries, portal: cfg.portal, ...(r.dropped.length ? { dropped: r.dropped } : {}) };
          l.synced = true;
        } catch (e) {
          l.sync = e.permanent ? { state: 'fehler', tries, error: e.message, at: new Date().toISOString() }
            : { state: 'wartet', tries, error: e.message, next: Date.now() + backoff(tries) };
        }
        await leads.put(l); emit();
        if (l.sync.state === 'wartet' && /^offline/.test(l.sync.error || '')) break;   // kein Netz: später weiter
      }
    } finally { SYNC.running = false; emit(); }
  };
  if (navigator.locks?.request) await navigator.locks.request('zoller-messe-sync', { ifAvailable: true }, (lock) => (lock ? run() : null));
  else await run();
}
export const syncRunning = () => SYNC.running;

export function counts(list) {
  const c = { all: list.length, neu: 0, wartet: 0, gesendet: 0, fehler: 0, unvollstaendig: 0 };
  for (const l of list) c[l.sync?.state || 'neu'] = (c[l.sync?.state || 'neu'] || 0) + 1;
  c.open = c.neu + c.wartet;
  return c;
}

/** übertragene Leads nach »days« Tagen vom Gerät löschen (Datenschutz – in HubSpot sind sie sicher) */
export async function purgeSent(days = 30) {
  const cut = Date.now() - days * 864e5;
  for (const l of await allLeads()) if (l.sync.state === 'gesendet' && Date.parse(l.sync.at || l.created) < cut) await deleteLead(l);
}

// ================================================================== Besucherausweis (Badge) lesen
const unesc = (s) => s.replace(/\\n/gi, ' ').replace(/\\([,;:\\])/g, '$1').trim();
function splitEsc(s, sep) {
  const out = []; let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) { cur += c + s[++i]; continue; }
    if (c === sep) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}
function qp(s) {
  try { return decodeURIComponent(s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, '%$1')); } catch { return s; }
}
function splitName(full) {
  const parts = String(full || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (parts.length < 2) return { first: '', last: parts[0] || '' };
  const comma = full.indexOf(',');
  if (comma > 0) return { last: full.slice(0, comma).trim(), first: full.slice(comma + 1).trim() };
  let i = parts.length - 1;
  while (i > 1 && /^(von|van|de|der|den|zu|da|di|del|della|du|la|le|ter|ten|vom|zum|zur|dos|das)$/i.test(parts[i - 1])) i--;
  return { first: parts.slice(0, i).join(' '), last: parts.slice(i).join(' ') };
}

function vcard(s) {
  const lines = s.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const o = {};
  let fn = '';
  for (const line of lines) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const head = line.slice(0, i);
    let val = line.slice(i + 1);
    const [nameRaw, ...params] = head.split(';');
    const name = nameRaw.replace(/^item\d+\./i, '').toUpperCase();
    const p = params.join(';').toUpperCase();
    if (/QUOTED-PRINTABLE/.test(p)) val = qp(val);
    const parts = splitEsc(val, ';').map(unesc);
    if (name === 'N') { o.last ||= parts[0] || ''; o.first ||= [parts[1], parts[2]].filter(Boolean).join(' '); o.salutation ||= parts[3] || ''; }
    else if (name === 'FN') fn = unesc(val);
    else if (name === 'ORG') o.company ||= parts[0] || '';
    else if (name === 'TITLE' || name === 'ROLE') o.title ||= unesc(val);
    else if (name === 'EMAIL') o.email ||= unesc(val);
    else if (name === 'TEL') { if (/CELL|MOBILE|IPHONE/.test(p)) o.mobile ||= unesc(val); else if (!/FAX/.test(p)) o.phone ||= unesc(val); }
    else if (name === 'ADR') { o.street ||= [parts[1], parts[2]].filter(Boolean).join(' '); o.city ||= parts[3] || ''; o.zip ||= parts[5] || ''; o.countryName ||= parts[6] || ''; }
    else if (name === 'URL') o.website ||= unesc(val);
  }
  if (!o.first && !o.last && fn) Object.assign(o, splitName(fn));
  return o;
}

function mecard(s) {
  const body = s.replace(/^MECARD:/i, '');
  const o = {};
  for (const part of splitEsc(body, ';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).toUpperCase(), v = unesc(part.slice(i + 1));
    if (!v) continue;
    if (k === 'N') { const [l, f] = splitEsc(v, ','); o.last = unesc(l || ''); o.first = unesc(f || ''); }
    else if (k === 'ORG') o.company = v;
    else if (k === 'TITLE') o.title = v;
    else if (k === 'EMAIL') o.email ||= v;
    else if (k === 'TEL') o.phone ? (o.mobile ||= v) : (o.phone = v);
    else if (k === 'URL') o.website = v;
    else if (k === 'ADR') { const a = splitEsc(v, ',').map(unesc); o.street = [a[1], a[2]].filter(Boolean).join(' '); o.city = a[3] || ''; o.zip = a[5] || ''; o.countryName = a[6] || ''; }
  }
  return o;
}

function bizcard(s) {
  const o = {};
  for (const part of splitEsc(s.replace(/^BIZCARD:/i, ''), ';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).toUpperCase(), v = unesc(part.slice(i + 1));
    ({ N: () => (o.first = v), X: () => (o.last = v), T: () => (o.title = v), C: () => (o.company = v), A: () => (o.street = v),
      B: () => (o.phone = v), M: () => (o.mobile = v), E: () => (o.email = v) })[k]?.();
  }
  return o;
}

const KEYS = {
  email: /^(e-?mail|mail|email_?address)$/i, first: /^(first_?name|firstname|given_?name|vorname|fname|fn|prenom|prénom|nombre)$/i,
  last: /^(last_?name|lastname|surname|family_?name|nachname|lname|ln|nom|apellidos?)$/i, company: /^(company|firma|org|organi[sz]ation|unternehmen|empresa|societe|société)$/i,
  title: /^(title|job_?title|position|funktion|role|cargo|fonction)$/i, phone: /^(phone|tel|telephone|telefon|telefono)$/i, mobile: /^(mobile|cell|handy|mobil)$/i,
  city: /^(city|ort|stadt|ville|ciudad)$/i, zip: /^(zip|postal_?code|plz|postcode|cp)$/i, countryName: /^(country|land|pays|pais|país)$/i,
  street: /^(street|address|strasse|straße|adresse|direccion)$/i, name: /^(name|full_?name|fullname)$/i,
};
function byKeys(obj) {
  const o = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || typeof v === 'object') continue;
    for (const [f, re] of Object.entries(KEYS)) if (re.test(k.trim())) { o[f] ||= String(v).trim(); break; }
  }
  if (o.name && !o.first && !o.last) Object.assign(o, splitName(o.name));
  delete o.name;
  return o;
}

/**
 * Inhalt eines Besucherausweises (QR/Barcode) lesen. Viele Messen kodieren eine vCard oder Klartext; bei verschlüsselten
 * Ausweis-Nummern (nur eine ID) bleibt der Code am Lead, und das Standpersonal ergänzt E-Mail/Name (oder scannt die Visitenkarte).
 */
export function parseBadge(raw) {
  const s = String(raw || '').replace(/^﻿/, '').trim();
  let kind = 'id', fields = {};
  if (/BEGIN:VCARD/i.test(s)) { kind = 'vcard'; fields = vcard(s); }
  else if (/^MECARD:/i.test(s)) { kind = 'mecard'; fields = mecard(s); }
  else if (/^BIZCARD:/i.test(s)) { kind = 'bizcard'; fields = bizcard(s); }
  else if (/^\s*[[{]/.test(s)) { try { const j = JSON.parse(s); kind = 'json'; fields = byKeys(Array.isArray(j) ? j[0] || {} : j); } catch { /* kein JSON */ } }
  else if (/^mailto:/i.test(s)) { kind = 'mailto'; fields = { email: decodeURIComponent(s.slice(7).split('?')[0]) }; }
  else if (/^https?:\/\//i.test(s)) {
    kind = 'url';
    try { const u = new URL(s); fields = byKeys(Object.fromEntries(u.searchParams)); } catch { /* egal */ }
  } else if (/[|^\t;]/.test(s) || (s.match(/,/g) || []).length >= 2) {
    // Textzeile mit Trennzeichen (z. B. »12345|Max|Muster|Firma|max@firma.de«): E-Mail/Telefon sicher, Rest bietet die Oberfläche an
    const sep = ['|', '^', '\t', ';', ','].find((c) => s.includes(c));
    const parts = s.split(sep).map((x) => x.trim()).filter(Boolean);
    kind = 'text';
    fields.email = parts.find(isMail) || '';
    fields.phone = parts.find((x) => /^\+?[\d ()./-]{7,}$/.test(x) && /[+ ()./-]/.test(x) && (x.match(/\d/g) || []).length >= 7) || '';
    fields.parts = parts.filter((x) => x !== fields.email && x !== fields.phone);
  } else if (/\n/.test(s) || isMail(s.split(/\s/).find(isMail) || '')) {
    kind = 'text';
    fields = parseCard(s);
  }
  if (!fields.email) { const m = s.match(/[^\s@;,:<>|"']+@[^\s@;,:<>|"']+\.[a-z]{2,}/i); if (m) fields.email = m[0]; }
  for (const k of Object.keys(fields)) if (typeof fields[k] === 'string') fields[k] = fields[k].trim();
  return { kind, raw: s, fields };
}

// ================================================================== Visitenkarte (Text aus der Texterkennung oder iOS »Text scannen«)
const LEGAL = /\b(GmbH|AG|KG|OHG|GbR|UG|SE|e\.\s?K\.|mbH|Inc\.?|LLC|L\.L\.C\.|Ltd\.?|Lt[ée]e|Limit[ée]e|Limited|S\.\s?de\s?R\.\s?L\.|Corp\.?|Corporation|Co\.|Company|PLC|S\.?A\.?(?:\s?de\s?C\.?V\.?)?|S\.?A\.?S\.?|SARL|S\.?r\.?l\.?|S\.?p\.?A\.?|S\.?L\.?U?\.?|B\.?V\.?|N\.?V\.?|AB|Oy|A\/S|ApS|Kft\.?|d\.o\.o\.|s\.r\.o\.|a\.s\.|Sp\.\s?z\s?o\.?o\.?|Pty|Pvt|GesmbH|Werke?|Group|Gruppe|Industries|Technologies|Technik|Maschinenbau|Manufacturing|Engineering)(?![\p{L}])/iu;
const JOB = /\b(gesch[äa]ftsf[üu]hr\w*|inhaber\w*|leiter\w*|leitung|meister\w*|ingenieur\w*|techniker\w*|vertrieb\w*|verkauf\w*|einkauf\w*|eink[äa]ufer\w*|fertigung\w*|produktion\w*|arbeitsvorbereitung|konstruk\w*|entwickl\w*|projekt\w*|berater\w*|referent\w*|sachbearbeit\w*|prokurist\w*|vorstand\w*|bereichsleit\w*|teamleit\w*|abteilungsleit\w*|qualit[äa]t\w*|manager|management|director|directeur|directrice|directora?|direttor[ei]|direttrice|head|chief|ceo|cto|coo|cfo|vp|vice president|president|owner|founder|engineer|engineering|specialist|consultant|sales|purchasing|buyer|procurement|production|operations|plant|supervisor|lead|foreman|programmer|machinist|technician|coordinator|representative|account|application|quality|gerente|jef[ae]|ingenier[oa]|responsable|responsabile|chef|acheteu[rs]e?|technicien\w*|ventes|achats|m[ée]thodes|qualit[ée]|commercial\w*|calidad|compras|ventas|producci[óo]n|acquisti|produzione|qualit[àa]|ufficio|tecnic[oa]|commerciale)\b/i;
const ACAD = /^(\(fh\)|\(th\)|\(ba\)|dr\.?|prof\.?|dipl\.?-?\s?ing\.?|dipl\.?-?\s?kfm\.?|ing\.?|mag\.?|m\.?\s?sc\.?|b\.?\s?sc\.?|m\.?\s?eng\.?|b\.?\s?eng\.?|mba|herr|frau|mr\.?|mrs\.?|ms\.?|sr\.?|sra\.?|m\.|mme|lic\.?|dott\.?|arch\.?)$/i;
const STREET = /(stra(ß|ss)e|str\.|weg\b|platz\b|allee\b|gasse\b|ring\b|damm\b|ufer\b|chaussee|road\b|rd\.?\b|street\b|st\.\s|avenue\b|ave\.?\b|blvd\.?\b|boulevard|drive\b|dr\.\s|lane\b|ln\.\b|way\b|parkway|pkwy|suite\b|ste\.?\s|court\b|ct\.\b|place\b|calle\b|avenida\b|av\.\s|rue\b|via\b|viale\b|pol[íi]gono|carretera|ulica\b|ul\.\s|postfach|p\.?\s?o\.?\s?box)/i;
const ZIPLINE = [
  { re: /^(.*?)[,\s]+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*(?:,?\s*(USA|U\.S\.A\.|United States))?$/, f: (m) => ({ city: m[1], zip: m[3], state: m[2], countryName: m[4] ? 'United States' : '' }) },
  { re: /^(.*?)[,\s]+([A-Z]{2})\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d)\s*(?:,?\s*(Canada))?$/i, f: (m) => ({ city: m[1], zip: m[3].toUpperCase(), state: m[2], countryName: m[4] ? 'Canada' : '' }) },
  // Kanada mit ausgeschriebener Provinz: »Laval (Québec) H7L 4R9«, »Toronto, Ontario M5V 2T6«
  { re: /^([\p{L} .'-]+?)[,\s]*(?:\(?([\p{L} .'-]+?)\)?)?\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d)$/iu, f: (m) => ({ city: m[1].trim(), zip: m[3].toUpperCase(), state: m[2] || '' }) },
  { re: /^(?:(?:[A-Z]{1,3})[-–]\s?)?(?:C\.?P\.?\s*)?(\d{4,5})\s+([A-ZÄÖÜÉÈÀÂÎÔÇa-zäöüß][\p{L} .,'()/-]+)$/u, f: (m) => ({ zip: m[1], city: m[2] }) },
  { re: /^([\p{L} .'-]+?),?\s+(\d{4,5})$/u, f: (m) => ({ city: m[1], zip: m[2] }) },
  { re: /^(.*?)\s*([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/, f: (m) => ({ city: m[1].replace(/,$/, ''), zip: m[2] }) },
];
const COUNTRIES = /^(deutschland|germany|allemagne|alemania|germania|österreich|austria|schweiz|switzerland|suisse|svizzera|usa|u\.s\.a\.|united states|canada|kanada|mexico|méxico|mexiko|messico|france|frankreich|francia|italia|italy|italien|italie|españa|spain|spanien|espagne|spagna|united kingdom|uk|england|polska|poland|polen|česká republika|czech republic|tschechien|china|japan|korea|brasil|brazil|brasilien|india|indien|sverige|sweden|schweden|türkiye|turkey|türkei)$/i;
const PHONE = /(\+?\(?\d[\d\s()./–-]{5,}\d)/g;
const fold = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
// Namen → E-Mail-Schreibweise: »Krüger« → krueger und kruger
const translit = (s, de = true) => (de ? String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue') : String(s).toLowerCase())
  .replace(/ß/g, 'ss').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const titleCase = (w) => (w.length > 1 && w === w.toUpperCase() && /\p{Lu}/u.test(w) ? w[0] + w.slice(1).toLowerCase() : w);

/**
 * Zeilen einer Karte in einzelne Angaben zerlegen: Designer setzen oft »Firma · Straße · PLZ Ort« oder »T … | M …« in eine Zeile,
 * die Texterkennung liest »·« auch als ».«, »°« oder »-«. Symbole vor den Angaben (☎ ✉ ⌂, gelesen als »©«, »&«) fallen weg.
 */
function segments(text) {
  const ZIPANY = /(\b\d{5}\b|\b[A-Z]{2}\s\d{5}\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b|\b\d{4}\s+\p{Lu})/u;
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').replace(/(^|\s)[|!]\s(?=[a-z][a-z.-]*\s?@)/g, '$1l.').replace(/(^|\s)[|!](?=[a-z][a-z.-]*\s?@)/g, '$1l')
      .replace(/\bw{4,}\./gi, 'www.').replace(/\s*@\s*/g, '@').replace(/\bn[0o°]\s(?=\d)/g, 'nº ').replace(/(stra|Stra)B(e\b)/g, '$1ß$2').replace(/\bwww\s?[.,]\s?/gi, 'www.').trim();
    if (!line) continue;
    let parts = line.split(/\s{3,}|\s?[|•·°∙▪■◦]\s|\s[|•·°∙▪■◦]\s?|\s[–—-]\s|\s\.\s(?=\S)|(?<=\p{L}{3})\.\s(?=(?:[A-Z]{1,2}-)?\d{4,5}\s\p{Lu})/u);
    // Adresse mit Kommas in einer Zeile (»Weber GmbH, Am Hohlweg 3, 58513 Lüdenscheid«) – nur wenn eine PLZ oder Rechtsform drin ist
    parts = parts.flatMap((x) => {
      if (!/,/.test(x) || !(ZIPANY.test(x) || /(GmbH|Inc\.?|LLC|S\.r\.l\.|SAS|S\.L\.|Ltée),/i.test(x))) return [x];
      const bits = x.split(/\s*,\s*/).filter(Boolean);
      const merged = [];
      for (const b of bits) {
        const prev = merged[merged.length - 1];
        if (prev && /^[A-Z][A-Za-z]\s+(\d{5}|[A-Z]\d[A-Z])/.test(b)) merged[merged.length - 1] = prev + ', ' + b.slice(0, 2).toUpperCase() + b.slice(2);     // »Ann Arbor, MI 48108«
        else if (prev && /^\d{1,5}$/.test(prev) && STREET.test(b + ' ')) merged[merged.length - 1] = prev + ', ' + b;  // »1250, rue Industrielle«
        else merged.push(b);
      }
      return merged;
    });
    parts = parts.flatMap((x) => {
      const m = x.match(/^(.*?\b(?:GmbH(?: & Co\.? KG)?|KG|AG|Inc\.?|LLC|Ltd\.?|S\.r\.l\.|SAS|S\.L\.|S\.A\.(?: de C\.V\.)?|Lt[ée]e))[.,]?\s+(.+)$/u);
      return m && (STREET.test(m[2] + ' ') || /\b\d{4,5}\b/.test(m[2])) && /\d/.test(m[2]) ? [m[1], m[2]] : [x];
    });
    for (let x of parts) {
      x = x.replace(/^[^\p{L}\p{N}+(]+/u, '').replace(/(\p{Ll})\]$/u, '$1l').replace(/[\s,;|·•–—-]+$/u, '').trim();     // »Industria]« = »Industrial«
      if (x.length > 1 && /[\p{L}\p{N}]/u.test(x)) out.push(x);
    }
  }
  // umbrochene PLZ: »70794« am Zeilenende, »Filderstadt« in der nächsten Zeile
  for (let i = out.length - 2; i >= 0; i--) {
    if (/^(?:[A-Z]{1,2}-)?\d{4,5}$/.test(out[i]) && /^\p{Lu}[\p{L} .'()-]+$/u.test(out[i + 1])) out.splice(i, 2, out[i] + ' ' + out[i + 1]);
  }
  return out;
}

/** E-Mail aus Texterkennung: »| bianchi@…«, »Igarcia@…«, »name@firma,com«, »name@firma de« */
function findEmail(all) {
  all = all.replace(/(^|\s)[|!]\s(?=[a-z][a-z.-]*@)/gm, '$1l.').replace(/(^|\s)[|!](?=[a-z][a-z.-]*@)/gm, '$1l');
  const m = all.match(/([^\s@,;:<>()"'|\\]+)@([a-z0-9][a-z0-9-]*(?:[.,][a-z0-9-]+)*)(?:[ ]?[.,]?[ ]?([a-z]{2,4})\b)?/i);
  if (!m) return null;
  let local = m[1].replace(/^[.,-]+/, ''), dom = m[2].replace(/,/g, '.');
  if (!dom.includes('.') && m[3] && !/^www$/i.test(m[3])) dom += '.' + m[3];
  if (/[a-z]/.test(local)) local = local.replace(/I/g, 'l');        // Großes I kommt in Adressen kaum vor – es war ein l
  local = local.replace(/\|/g, 'l').replace(/,/g, '.');
  return { raw: m[0], local: local.toLowerCase(), dom: dom.toLowerCase().replace(/\.+$/, '') };
}
/** Vorname/Nachname → übliche Schreibweisen der E-Mail; bei einem Lesefehler (ein Zeichen) wird die passende genommen */
function fixLocal(local, first, last) {
  const cands = new Set();
  for (const de of [true, false]) {
    const f = translit((first || '').split(' ')[0], de), l = translit((last || '').split(' ')[0], de), l2 = translit(last || '', de);
    if (!l) continue;
    [`${f}.${l}`, `${f[0] || ''}.${l}`, `${f[0] || ''}${l}`, `${f}${l}`, `${f}_${l}`, `${f}-${l}`, l, f, `${l}.${f}`, `${l}${f[0] || ''}`, `${f}.${l2}`, `${f[0] || ''}${l2}`]
      .filter((x) => x.length > 3 && !/^[._-]|[._-]$/.test(x)).forEach((x) => cands.add(x));
  }
  if (!cands.size || cands.has(local)) return local;
  let best = local, bd = 9;
  for (const c of cands) { const d = lev(local, c); if (d < bd) { bd = d; best = c; } }
  return bd === 1 || (bd === 2 && local.length >= 9) ? best : local;
}

/**
 * Text einer Visitenkarte in Felder zerlegen. Gibt nur, was sicher erkennbar ist; das Standpersonal prüft auf dem Bildschirm (Foto dabei).
 * alt: zweite Lesung derselben Karte (anderer Ausschnitt) – füllt nur Felder, die in der ersten fehlen.
 */
export function parseCard(text, alt) {
  if (alt) {
    const o = parseCard(text), o2 = parseCard(alt);
    const dig = (x) => String(x || '').replace(/\D/g, '').slice(0, 10);
    for (const [k, v] of Object.entries(o2)) {
      if (!v || o[k]) continue;
      // dieselbe Nummer nicht als zweite Nummer übernehmen
      if ((k === 'phone' || k === 'mobile') && [o.phone, o.mobile].some((n) => n && dig(n) === dig(v))) continue;
      o[k] = v;
    }
    return o;
  }
  const o = {};
  const lines = segments(text);
  const all = lines.join('\n');
  const used = new Set();
  // E-Mail
  const em = findEmail(all);
  if (em) {
    o.email = em.local + '@' + em.dom;
    const i = lines.findIndex((l) => l.includes('@'));
    if (i >= 0 && lines[i].replace(em.raw, '').replace(/e-?mail|mail|courriel|correo|[:\s]/gi, '').length < 3) used.add(i);
  }
  // Web: erst »www.«/»http«, dann eine bloße Domain (»precisiontooling.com«)
  for (const re of [/\b((?:https?:\/\/)?www\.[^\s,;@]+|https?:\/\/[^\s,;@]+)/i,
    /(?:^|\s)((?:[a-z0-9-]+\.)+(?:com|de|net|org|info|eu|at|ch|fr|es|it|mx|ca|us|co\.uk|cz|pl|se|nl|be))(?=\s|$)/i]) {
    for (const [i, l] of lines.entries()) {
      if (o.website) break;
      const w = l.match(re);
      if (w && !w[1].includes('@') && !(o.email && fold(w[1]).endsWith(fold(o.email)))) {
        o.website = w[1].replace(/[.)]+$/, '').toLowerCase();
        if (l.replace(w[0], '').replace(/web|internet|[:\s]/gi, '').length < 3) used.add(i);
      }
    }
  }
  // E-Mail-Domain und Web gegeneinander prüfen (fehlende Endung, ein falsch gelesener Buchstabe)
  if (o.email && o.website) {
    const host = o.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    const dom = o.email.split('@')[1];
    if (!dom.includes('.') && host.startsWith(dom + '.')) o.email += host.slice(dom.length);
    else if (host !== dom && lev(host, dom) <= 2) {
      const rest = fold(all.replace(o.email, ' ').replace(o.website, ' '));
      const good = (d) => rest.includes(fold(d.split('.')[0]));
      if (good(host) && !good(dom)) o.email = o.email.split('@')[0] + '@' + host;
      else o.website = o.website.replace(host, dom);
    }
  }
  // Telefon (Beschriftung vor der Nummer entscheidet: Mobil / Fax / Telefon)
  for (const [i, line] of lines.entries()) {
    if (used.has(i)) continue;
    const l = line.replace(/[^\s@]+@[^\s@]+/g, ' ').replace(/\bwww\.[^\s]+/gi, ' ');
    let hit = false;
    for (const m of l.matchAll(PHONE)) {
      const num = m[1].trim();
      const digits = (num.match(/\d/g) || []).length;
      if (digits < 7 || digits > 16) continue;
      const before = l.slice(Math.max(0, m.index - 14), m.index).toLowerCase();
      const label = /(tel|fon|phone|t[ée]l|mob|cell|cel|handy|fax|direct|office|\b[tpmocfd]\b)\.?:?\s*$/.test(before);
      if (!label && !/[+(]/.test(num) && digits < 9 && /\p{L}{3,}/u.test(l.slice(m.index + m[0].length))) continue;   // PLZ + Ort, Hausnummer + PLZ
      if (/^\d{4,5}\s/.test(l) && !/[+(]/.test(num) && m.index === 0 && /\p{L}{3,}/u.test(l)) continue;
      if (/fax|\bf\b|f:|f\.\s*$/.test(before)) { hit = true; continue; }
      if (/mob|cell|handy|\bm\b|m:|m\.\s*$|gsm|port|cel\b|cel\.|celular|\bc\b|c:|cell\.?/.test(before)) o.mobile ||= num;
      else if (!o.phone) o.phone = num; else o.mobile ||= num;
      hit = true;
    }
    if (hit && l.replace(PHONE, '').replace(/\b(tel|telefon|t[ée]l[ée]phone|phone|fon|mobil|mobile|handy|cell|cel|celular|fax|direct|direkt|office|mob|[tpmfcdo])\b\.?:?/gi, '')
      .replace(/[^\p{L}]/gu, '').length < 3) used.add(i);
  }
  // Adresse: Angabe mit PLZ/Ort, Straße meist direkt davor; erst US/Kanada, dann PLZ vor/nach dem Ort
  for (const pats of [ZIPLINE.slice(0, 3), ZIPLINE.slice(3)]) {
    for (const [i, l] of lines.entries()) {
      if (used.has(i) || o.zip) continue;
      for (const z of pats) {
        const m = l.match(z.re);
        if (!m) continue;
        const a = z.f(m);
        // Ort ohne Zusätze: »Castel Mella (BS)«, »Querétaro, Qro., México«
        const tail = a.city.split(',').slice(1).map((x) => x.trim()).filter(Boolean);
        a.city = a.city.split(',')[0].replace(/\s*\([^)]*\)\s*$/, '').replace(/[,.]\s*$/, '').trim();
        if (!a.city || /\d{3,}/.test(a.city) || a.city.length > 40 || STREET.test(a.city + ' ')) continue;
        const c = tail.find((x) => COUNTRIES.test(x));
        if (c && !a.countryName) a.countryName = c;
        Object.assign(o, a);
        used.add(i);
        const prev = lines[i - 1];
        if (prev && !used.has(i - 1) && (STREET.test(prev + ' ') || /\d/.test(prev)) && !prev.includes('@') && !LEGAL.test(prev)) { o.street = prev; used.add(i - 1); }
        break;
      }
    }
  }
  if (!o.street) {
    const i = lines.findIndex((l, j) => !used.has(j) && STREET.test(l + ' ') && /\d/.test(l) && !l.includes('@'));
    if (i >= 0) { o.street = lines[i]; used.add(i); }
  }
  for (const [i, l] of lines.entries()) if (!used.has(i) && COUNTRIES.test(l)) { o.countryName ||= l; used.add(i); }
  for (const [i, l] of lines.entries()) if (!used.has(i) && /^[A-Z][a-z]{1,3}\.$/.test(l)) used.add(i);    // Bundesstaat-Kürzel »Qro.«
  // Firma: Rechtsform, sonst der Name der E-Mail-Domain
  const dom = o.email ? fold(o.email.split('@')[1].split('.').slice(-2, -1)[0] || '') : '';
  const fixLegal = (l) => l.replace(/\bL[Il1]c\b/g, 'LLC').replace(/\bGmbh\b/g, 'GmbH').replace(/\bS\.\s?A\.\s?de\s?[A-Z.(]{1,5}$/, 'S.A. de C.V.');
  let ci = lines.findIndex((l, j) => !used.has(j) && LEGAL.test(fixLegal(l)) && !JOB.test(l) && !/@|www\./i.test(l));
  if (ci < 0 && dom.length >= 3) ci = lines.findIndex((l, j) => !used.has(j) && fold(l).includes(dom) && !/@|www\./i.test(l));
  if (ci >= 0) {
    o.company = fixLegal(lines[ci]); used.add(ci);
    // Logo in zwei Zeilen: »APEX AEROSPACE« + »COMPONENTS LLC«
    const prev = lines[ci - 1];
    if (prev && !used.has(ci - 1) && o.company.split(' ').length <= 3 && o.company === o.company.toUpperCase() && prev === prev.toUpperCase() && !/\d/.test(prev)) {
      o.company = prev + ' ' + o.company; used.add(ci - 1);
    }
  }
  // Name: 2–4 Wörter ohne Ziffern; Treffer mit dem E-Mail-Namen zählen am meisten, Firmen-/Logozeilen scheiden aus
  const local = o.email ? fold(o.email.split('@')[0]) : '';
  let best = null, bestScore = 0;
  for (const [i, l] of lines.entries()) {
    if (used.has(i) || /\d|@|www\.|https?:/i.test(l) || LEGAL.test(l)) continue;
    const words = l.split(' ').filter((w) => !ACAD.test(w.replace(/,$/, '')));
    if (words.length < 2 || words.length > 4 || l.length > 40) continue;
    if (!words.every((w) => /^[\p{Lu}][\p{L}'’.-]*,?$/u.test(w) || /^(von|van|de|der|den|zu|da|di|del|della|du|la|le|vom|zum|y)$/i.test(w))) continue;
    const f = fold(words.join(''));
    if (dom && f.length >= 6 && (dom.includes(f) || f.includes(dom))) continue;           // »Schmidt Zerspanung« ist die Firma
    if (o.company && fold(o.company).startsWith(f)) continue;
    if (JOB.test(l) && !(local && words.some((w) => w.length > 2 && local.includes(fold(w))))) continue;
    let score = 1 + (i < 4 ? 1 : 0);
    if (local && words.some((w) => w.length > 2 && local.includes(fold(w)))) score += 4;
    if (lines[i + 1] && JOB.test(lines[i + 1])) score += 2;
    if (l === l.toUpperCase()) score -= 1;
    if (score > bestScore) { bestScore = score; best = [i, words.map(titleCase).join(' ')]; }
  }
  if (best) {
    const words = best[1].split(' ');
    // spanische Namen: Vorname + zwei Nachnamen (»Carlos Hernández Pérez«)
    const es = /\.(mx|es|ar|co|cl|pe)$/i.test(o.email || '') || /S\.A\. de C\.V\.|S\.L\.|C\.P\.\s?\d|\bGerente\b|\bJef[ae]\b/i.test(text);
    Object.assign(o, es && words.length === 3 && !best[1].includes(',') ? { first: words[0], last: words.slice(1).join(' ') } : splitName(best[1]));
    if (/^\p{L}{2,}\s\p{Lu}\.$/u.test(o.first || '')) o.first = o.first.split(' ')[0];
    used.add(best[0]);
  }
  // Position: Berufsbezeichnung, sonst die Zeile direkt unter dem Namen
  let ti = lines.findIndex((l, j) => !used.has(j) && JOB.test(l) && l.split(' ').length <= 8 && !/\d|@/.test(l));
  if (ti < 0 && best && lines[best[0] + 1] && !used.has(best[0] + 1) && !/\d|@|www/i.test(lines[best[0] + 1]) && lines[best[0] + 1].split(' ').length <= 6) ti = best[0] + 1;
  if (ti >= 0) {
    o.title = lines[ti].replace(/gesch[aä]ftsf[uü]hr/gi, (m) => (m === m.toUpperCase() ? 'GESCHÄFTSFÜHR' : 'Geschäftsführ'))
      .replace(/eink[aä]ufer/gi, (m) => (m === m.toUpperCase() ? 'EINKÄUFER' : 'Einkäufer')).replace(/qualit[aä]ts/gi, (m) => (m === m.toUpperCase() ? 'QUALITÄTS' : 'Qualitäts'))
      .replace(/gesch[aä]ftsleitung/gi, (m) => (m === m.toUpperCase() ? 'GESCHÄFTSLEITUNG' : 'Geschäftsleitung'));
    used.add(ti);
  }
  if (!o.company) {
    // ohne Rechtsform: erste übrige Zeile in Großbuchstaben (Logo-Schriftzug), sonst nichts raten
    const ui = lines.findIndex((l, j) => !used.has(j) && l.length > 2 && l === l.toUpperCase() && /\p{L}{3,}/u.test(l) && !/\d/.test(l));
    if (ui >= 0) { o.company = lines[ui]; used.add(ui); }
  }
  if (!o.email && (o.first || o.last)) {
    for (const tok of all.split(/\s+/)) {
      const m = tok.match(/^([a-z][a-z0-9._-]{1,40})\.([a-z]{2,4})$/i);
      if (!m || /^www\./i.test(tok)) continue;
      for (let k = 2; k < m[1].length - 3; k++) {
        if (!/[eoq0©®(a]/i.test(m[1][k])) continue;
        const local = m[1].slice(0, k).toLowerCase(), dom = m[1].slice(k + 1).toLowerCase() + '.' + m[2].toLowerCase();
        if (fixLocal(local, o.first, o.last) !== local || [o.first, o.last].some((n) => n && local.includes(translit(n.split(' ')[0])))) {
          o.email = fixLocal(local, o.first, o.last) + '@' + dom;
          if (o.website && o.website.replace(/^www\./, '') === tok.toLowerCase()) delete o.website;
          break;
        }
      }
      if (o.email) break;
    }
  }
  // E-Mail-Name gegen den Namen prüfen (»s-krueger« → »s.krueger«)
  if (o.email && (o.first || o.last)) o.email = fixLocal(o.email.split('@')[0], o.first, o.last) + '@' + o.email.split('@')[1];
  if (o.salutation === '') delete o.salutation;
  return o;
}

// ================================================================== CSV (HubSpot-Import, Excel)
export function csvRows(list, lang = 'de') {
  return list.map((l) => {
    const f = hubspotFields(l, null, lang);
    return {
      'First Name': l.first, 'Last Name': l.last, 'Email': l.email, 'Company Name': l.company, 'Job Title': l.title, 'Phone Number': l.phone,
      'Mobile Phone Number': l.mobile, 'Website URL': l.website, 'Street Address': l.street, 'Postal Code': l.zip, 'City': l.city,
      'Country/Region': l.countryName || l.country, 'Message': l.msg,
      'ZOLLER Messe': f.zoller_messe_event || '', 'Messe-ID': f.zoller_messe_event_id || '', 'Messekontakt am': l.day, 'Messestand': l.booth,
      'Bewertung': l.rating, 'Interesse': (l.interests || []).join(';'), 'Folgeaktion': (l.wants || []).join(';'), 'Zeitraum': l.timeframe, 'Rolle': l.role,
      'Erfasst von': l.staff, 'Erfassungsart': l.source, 'Gerät': l.device, 'Badge-Code': l.badge, 'Notiz': l.note, 'Messebericht': f.zoller_messe_bericht || '',
      'Newsletter': l.newsletter ? 'ja' : '', 'Einwilligung': l.consent ? 'ja' : 'nein', 'Einwilligungstext': l.consentText,
      'HubSpot': ({ gesendet: 'übertragen', wartet: 'wartet', neu: 'offen', fehler: 'abgelehnt', unvollstaendig: 'ohne E-Mail' })[l.sync?.state] || '',
      'Lead-ID': l.id,
    };
  });
}
export function csv(rows, sep = ',') {
  if (!rows.length) return '﻿';
  const head = Object.keys(rows[0]);
  const cell = (v) => { const s = String(v ?? ''); return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [head, ...rows.map((r) => head.map((h) => r[h]))].map((r) => r.map(cell).join(sep)).join('\r\n');
}

export async function shareFile(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  return true;
}
export const fileTag = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');

// ================================================================== Kopplung Kiosk → Handy des Standpersonals
const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
/** Einrichtung als kurzer Text für den QR-Code (Messe, Stand, Gesellschaft, Fragebogen, Sprache, ggf. eigenes HubSpot-Formular) */
export function pairCode(s) {
  const e = s.event ? (s.event.id ? s.event.id : { t: s.event.title, c: typeof s.event.city === 'string' ? s.event.city : '', s: s.event.start || '' }) : null;
  const h = s.hubspot?.portal && s.hubspot?.form && s.hubspot.form !== D?.hubspot?.form ? [s.hubspot.portal, s.hubspot.form, s.hubspot.host || ''] : null;
  return b64u(JSON.stringify({ v: 1, e, b: s.booth || '', s: s.site || '', f: s.form || '', l: s.lang || '', ...(h ? { h } : {}) }));
}
export function readPair(code) {
  try {
    const raw = String(code).replace(/^.*[#?&]setup=/, '').split('&')[0];
    const j = JSON.parse(unb64u(raw));
    if (j.v !== 1) return null;
    let event = null;
    if (typeof j.e === 'string') event = D?.events?.find((x) => x.id === j.e) || { id: j.e, title: j.e };
    else if (j.e) event = { title: j.e.t, city: j.e.c, start: j.e.s };
    return { event, booth: j.b, site: j.s, form: j.f, lang: j.l, ...(j.h ? { hubspot: { portal: j.h[0], form: j.h[1], host: j.h[2] || 'api.hsforms.com' } } : {}) };
  } catch { return null; }
}
