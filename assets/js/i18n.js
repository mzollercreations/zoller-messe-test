// Texte: Messe-App (assets/js/i18n/<lang>.js) + Planer (Produktnamen, Rollen, belegte Fakten, Schritte des Werkzeugkreislaufs).
// Fehlt ein Text in einer Sprache: Englisch, dann Deutsch.
import { STR as PLANER } from '../../planer/assets/js/strings.js';
import WORLDS from './i18n2.js';

const DICTS = {};
let LANG = 'de';

// »Berühren, um zu starten« in jeder Sprache – läuft in der Dauerschleife reihum
export const TOUCH = {
  de: 'Berühren, um zu starten', en: 'Touch to start', fr: 'Touchez pour commencer', es: 'Toque para empezar',
  it: 'Tocca per iniziare', pt: 'Toque para começar', 'pt-BR': 'Toque para começar', sv: 'Tryck för att börja',
  pl: 'Dotknij, aby rozpocząć', cs: 'Dotkněte se pro start', sk: 'Dotknite sa pre štart', sl: 'Dotaknite se za začetek',
  hu: 'Érintse meg az indításhoz', tr: 'Başlamak için dokunun', ru: 'Коснитесь, чтобы начать', zh: '轻触开始',
  ja: 'タッチしてスタート', ko: '터치하여 시작',
};

// Sprachcode → Gebietsschema für Zahlen und Datum
const INTL = {
  de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-PT', 'pt-BR': 'pt-BR', sv: 'sv-SE', pl: 'pl-PL',
  cs: 'cs-CZ', sk: 'sk-SK', sl: 'sl-SI', hu: 'hu-HU', tr: 'tr-TR', ru: 'ru-RU', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR',
};

async function load(lang) {
  if (DICTS[lang]) return DICTS[lang];
  let planer = PLANER[lang];
  if (!planer) {
    try { planer = (await import(`../../planer/assets/js/strings-${lang}.js`)).default; } catch { planer = {}; }
  }
  let kiosk = {};
  try { kiosk = (await import(`./i18n/${lang}.js`)).default; } catch (e) { console.warn('Texte', lang, e); }
  DICTS[lang] = { ...planer, ...kiosk, ...(WORLDS[lang] || {}) };
  return DICTS[lang];
}

export async function setLang(lang) {
  await Promise.all([load('de'), load('en'), load(lang)]);
  LANG = lang;
  document.documentElement.lang = lang;
}

export const lang = () => LANG;
export const intl = (l = LANG) => INTL[l] || l;

export function has(key, l = LANG) { return DICTS[l]?.[key] != null; }

export function t(key, vars, l = LANG) {
  let s = DICTS[l]?.[key] ?? DICTS.en?.[key] ?? DICTS.de?.[key];
  if (s == null) return key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return s;
}

// Text in einer anderen Sprache (für die Sprachwahl), lädt bei Bedarf nach
export async function tIn(l, key) { await load(l); return t(key, null, l); }

/** Alle [data-t]-Elemente im Bereich neu beschriften */
export function apply(root = document) {
  root.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  root.querySelectorAll('[data-t-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.tAria)); });
}

export function num(v, opt) { return new Intl.NumberFormat(intl(), opt).format(v); }
export function money(v, cur = 'EUR') {
  return new Intl.NumberFormat(intl(), { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v);
}
