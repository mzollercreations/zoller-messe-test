// Produktkatalog: alle Produkte und Produktwelten (data/kiosk.json: worlds, products) + Texte je Sprache (data/catalog/<sprache>.json).
// Was am Stand zu sehen ist, legt das Standpersonal fest (Einstellungen: products, films; null = alles).
import { json } from './media.js';

const TXT = {};
let D = null, S = null, L = 'de';

// Geräte-IDs der ersten Fassung → Produkt-IDs des Katalogs
export const DEV2PROD = { powershrink400: 'powershrink', redomatic600: 'redomatic', titanium: 'tooling' };
export const prodId = (id) => DEV2PROD[id] || id;

export function useCatalog(data, settings) { D = data; S = settings; }
export function settings(s) { S = s; }

export async function loadText(lang) {
  L = lang;
  const want = [lang, 'en', 'de'].filter((x, i, a) => a.indexOf(x) === i);
  await Promise.all(want.map(async (l) => { if (!TXT[l]) TXT[l] = await json(`data/catalog/${l}.json`).catch(() => null); }));
}

/** Text eines Produkts in der aktuellen Sprache (Rückfall Englisch, Deutsch) */
export function ptx(id) {
  return TXT[L]?.products?.[id] || TXT.en?.products?.[id] || TXT.de?.products?.[id] || {};
}
export function wtx(id) {
  return TXT[L]?.worlds?.[id] || TXT.en?.worlds?.[id] || TXT.de?.worlds?.[id] || { name: id, text: '' };
}

export const product = (id) => D.products.find((p) => p.id === prodId(id));
/** Produkte, die am Stand gezeigt werden (Auswahl des Personals) */
export function shown() {
  const sel = S?.products;
  return D.products.filter((p) => !sel || sel.includes(p.id));
}
export function worlds() {
  const vis = shown();
  return D.worlds.map((w) => ({ ...w, items: vis.filter((p) => p.cat === w.id) })).filter((w) => w.items.length);
}
/** Filme, die am Stand gezeigt werden */
export function shownFilms() {
  const sel = S?.films;
  return D.films.filter((f) => !sel || sel.includes(f.id));
}
/** live am Stand (Einstellungen live: {id: Ort}); alte Geräte-IDs werden umgerechnet */
export function liveMap() {
  const out = {};
  for (const [k, v] of Object.entries(S?.live || {})) out[prodId(k)] = v;
  return out;
}
export const isLive = (id) => prodId(id) in liveMap();
export const filmsOf = (p) => shownFilms().filter((f) => (f.products || []).includes(p.id));

// Merkliste → Auswahlwerte des HubSpot-Felds »Interesse an Geräten (Messe)« (tools/frageboegen.json); der volle Produktname
// steht zusätzlich im Messebericht
const INTEREST = { redomatic: 'redomatic600', powershrink: 'powershrink400', 'corameasure-lg': 'corameasure' };
const DIRECT = ['venturion', 'smile', 'toolbalancer', 'keeper', 'toolorganizer', 'toolstation', 'zidcode', 'robobox', 'hightower'];
export function interestKey(id) {
  const p = product(id);
  if (!p) return 'sonstiges';
  if (INTEREST[p.id]) return INTEREST[p.id];
  if (DIRECT.includes(p.id)) return p.id;
  if (p.cat === 'automation') return 'automation';
  if (p.kind === 'software' || p.kind === 'package') return 'tms';
  return 'sonstiges';
}

/** Texte einer bestimmten Sprache (Personalbereich: Deutsch/Englisch) */
export const textIn = (l) => TXT[l] || TXT.en || TXT.de || { worlds: {}, products: {} };

/**
 * Mediendateien, die die Auswahl braucht (Startbühne, Welten, gezeigte Produkte, Geräte, Filme) – »Offline laden« holt nur diese.
 * Pfade wie in der Dateiliste des Service Workers (ohne ?v=).
 */
export function selectedMedia() {
  const vis = new Set(shown().map((p) => p.id));
  const parts = [D.hero, D.worlds, shown(), shownFilms(), D.devices.filter((d) => vis.has(prodId(d.id)) || vis.has(d.show))];
  return new Set(JSON.stringify(parts).match(/media\/[^"?\\\s]+/g) || []);
}
