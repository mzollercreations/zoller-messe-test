// Filme und große Dateien: aus dem Offline-Speicher als Blob-URL (zuverlässig auf dem iPad, auch beim Spulen),
// sonst direkt übers Netz. Dazu »Offline laden« mit Fortschritt für den Personalbereich.

export const BASE = new URL('../../', import.meta.url).href;
const MEDIA_CACHE = 'zm-media';
const urls = new Map();     // Pfad → Blob-URL (wenige, werden wiederverwendet)

export const abs = (path) => new URL(path, BASE).href;

async function cached(path) {
  if (!('caches' in window)) return null;
  try { return await caches.match(abs(path)); } catch { return null; }
}

/** URL zum Abspielen: Blob aus dem Speicher (schnell, offline) oder Netz-URL */
export async function mediaUrl(path, keep = []) {
  if (urls.has(path)) { const u = urls.get(path); urls.delete(path); urls.set(path, u); return u; }
  const res = await cached(path);
  if (!res) return abs(path);
  const blob = await res.blob();
  const u = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'video/mp4' }));
  urls.set(path, u);
  // höchstens 5 Blob-URLs halten; nie die gerade benutzten freigeben
  const busy = new Set(keep);
  for (const [p, old] of urls) {
    if (urls.size <= 5) break;
    if (p === path || busy.has(old)) continue;
    URL.revokeObjectURL(old); urls.delete(p);
  }
  return u;
}

export async function json(path) {
  const r = await fetch(abs(path));
  if (!r.ok) throw new Error(r.status + ' ' + path);
  return r.json();
}

// ------------------------------------------------------------------ Service Worker
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(abs('sw.js'), { scope: BASE });
    return reg;
  } catch (e) { console.warn('Service Worker', e); return null; }
}

export async function swFiles() {
  const reg = await navigator.serviceWorker?.getRegistration(BASE);
  const sw = reg?.active || reg?.waiting || reg?.installing;
  if (!sw) return null;
  return new Promise((res) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => res(null), 3000);
    ch.port1.onmessage = (e) => { clearTimeout(t); res(e.data); };
    sw.postMessage('files', [ch.port2]);
  });
}

/** Offline-Status: wie viele Basis- und Mediendateien liegen im Speicher (want: nur diese Mediendateien zählen – die Auswahl am Stand) */
export async function offlineStatus(want) {
  const f = await swFiles();
  if (!f) return null;
  const core = await caches.open(f.coreCache), media = await caches.open(f.mediaCache);
  const has = async (c, list) => {
    const keys = new Set((await c.keys()).map((r) => r.url));
    const missing = list.filter(([p]) => !keys.has(abs(p)));
    return { total: list.length, bytes: list.reduce((a, x) => a + x[1], 0), missing, missingBytes: missing.reduce((a, x) => a + x[1], 0) };
  };
  return { version: f.version, core: await has(core, f.core), media: await has(media, want ? f.media.filter(([p]) => want.has(p)) : f.media) };
}

/** Lädt fehlende Mediendateien in den Speicher (want: nur diese); onProgress(geladen, gesamt, datei) */
export async function downloadMedia(onProgress, signal, want) {
  const f = await swFiles();
  if (!f) throw new Error('Service Worker nicht aktiv – Seite einmal neu laden');
  const st = await offlineStatus(want);
  const cache = await caches.open(f.mediaCache);
  const todo = st.media.missing;
  const total = todo.reduce((a, x) => a + x[1], 0);
  let done = 0;
  for (const [path, size, hash] of todo) {
    if (signal?.aborted) break;
    const res = await fetch(abs(path), { cache: 'no-cache', signal });
    if (!res.ok) throw new Error(res.status + ' ' + path);
    const reader = res.body.getReader();
    const parts = [];
    let got = 0;
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      parts.push(value); got += value.length;
      onProgress?.(done + got, total, path);
    }
    const type = res.headers.get('content-type') || (path.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream');
    await cache.put(abs(path), new Response(new Blob(parts, { type }), { headers: { 'content-type': type, 'x-zm-hash': hash } }));
    done += size;
    onProgress?.(done, total, path);
  }
  return offlineStatus(want);
}

export async function storageInfo() {
  const out = { persisted: null, usage: null, quota: null };
  try { out.persisted = await navigator.storage?.persisted?.(); } catch { /* egal */ }
  try { const e = await navigator.storage?.estimate?.(); if (e) { out.usage = e.usage; out.quota = e.quota; } } catch { /* egal */ }
  return out;
}
export async function persist() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}

export const mb = (b) => (b / 1e6).toLocaleString(undefined, { maximumFractionDigits: b < 1e7 ? 1 : 0 }) + ' MB';
