// Gespeichertes auf dem Gerät: Einstellungen (localStorage), Leads + Visitenkarten-Fotos (IndexedDB), Statistik pro Messetag.
// Leads verlassen das Gerät nur über die HubSpot-Übertragung (leads.js) oder den CSV-Export des Standpersonals.

const SKEY = 'zm.settings';
const STKEY = 'zm.stats';

export const DEFAULTS = {
  setup: false,            // Einrichtung abgeschlossen
  event: null,             // { id, title, city, start, end, country } oder { title, city } (eigene Veranstaltung)
  booth: '',               // z. B. »Halle 5 · Stand A12«
  site: 'de-DE',           // Länderfassung der ausstellenden ZOLLER-Gesellschaft (Mail, Währung)
  lang: 'de',              // Startsprache der App
  kiosk: 'iPad 1',
  idle: 90,                // Sekunden ohne Berührung bis zur Rückfrage
  attract: { films: null, captions: true },   // null = alle Filme
  live: {},                // Geräte am Stand: { venturion: 'Bereich A' }
  pin: '',                 // SHA-256 der PIN
  hubspot: { portal: '', form: '', host: 'api.hsforms.com' },
  rate: null,              // Maschinenstundensatz im Rechner (null = Standard der Länderfassung)
};

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SKEY) || '{}');
    return { ...structuredClone(DEFAULTS), ...s, attract: { ...DEFAULTS.attract, ...(s.attract || {}) }, hubspot: { ...DEFAULTS.hubspot, ...(s.hubspot || {}) } };
  } catch {
    return structuredClone(DEFAULTS);
  }
}
export function saveSettings(s) {
  try { localStorage.setItem(SKEY, JSON.stringify(s)); return true; } catch { return false; }
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('zoller-messe:' + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------ Statistik
export const today = () => new Date().toLocaleDateString('sv-SE');   // JJJJ-MM-TT in Ortszeit

export function stats() {
  try { return JSON.parse(localStorage.getItem(STKEY) || '{}'); } catch { return {}; }
}
export function bump(kind, id) {
  const all = stats();
  const d = today();
  const day = all[d] || (all[d] = {});
  if (id) { day[kind] = day[kind] || {}; day[kind][id] = (day[kind][id] || 0) + 1; } else day[kind] = (day[kind] || 0) + 1;
  try { localStorage.setItem(STKEY, JSON.stringify(all)); } catch { /* voll */ }
}
export function clearStats() { try { localStorage.removeItem(STKEY); } catch { /* egal */ } }

// ------------------------------------------------------------------ Leads
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('zoller-messe', 2);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('leads')) d.createObjectStore('leads', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos', { keyPath: 'id' });   // Visitenkarten-Fotos
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
async function tx(mode, fn, store = 'leads') {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
export const leads = {
  async all() {
    try { return (await tx('readonly', (s) => s.getAll())).sort((a, b) => (a.created < b.created ? 1 : -1)); } catch (e) { console.warn(e); return backup(); }
  },
  async put(lead) {
    try { await tx('readwrite', (s) => s.put(lead)); } catch (e) { console.warn(e); }
    const b = backup().filter((l) => l.id !== lead.id); b.push(lead);
    try { localStorage.setItem('zm.leads.backup', JSON.stringify(b)); } catch { /* voll */ }
  },
  async del(id) {
    try { await tx('readwrite', (s) => s.delete(id)); } catch (e) { console.warn(e); }
    try { localStorage.setItem('zm.leads.backup', JSON.stringify(backup().filter((l) => l.id !== id))); } catch { /* egal */ }
  },
};
// Fotos (Visitenkarte) nur in IndexedDB – zu groß für die Sicherungskopie
// als Rohdaten (ArrayBuffer) – Blobs in IndexedDB scheitern in Safari im privaten Modus
export const photos = {
  async get(id) {
    try {
      const r = await tx('readonly', (s) => s.get(id), 'photos');
      return r ? (r.blob || new Blob([r.buf], { type: r.type || 'image/jpeg' })) : null;
    } catch { return null; }
  },
  async put(id, blob) {
    try { const buf = await blob.arrayBuffer(); await tx('readwrite', (s) => s.put({ id, buf, type: blob.type }), 'photos'); return true; } catch (e) { console.warn(e); return false; }
  },
  async del(id) { try { await tx('readwrite', (s) => s.delete(id), 'photos'); } catch { /* egal */ } },
};
// zweite Kopie, falls IndexedDB auf einem Gerät nicht verfügbar ist oder geleert wird
function backup() { try { return JSON.parse(localStorage.getItem('zm.leads.backup') || '[]'); } catch { return []; } }

export function uid() {
  const a = new Uint8Array(6); crypto.getRandomValues(a);
  return Date.now().toString(36) + '-' + [...a].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 8);
}
