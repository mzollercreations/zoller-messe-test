// Service Worker der Lead-Erfassung (/erfassen/) – erzeugt von tools/build.py. Klein: nur die Erfassung, keine Filme/3D.
// Alles beim Installieren in den Speicher, danach läuft die App ohne Netz; Updates kommen mit der nächsten Version.
const VERSION = '6c37487eba';
const FILES = ["erfassen/index.html", "erfassen/erfassen.js", "erfassen/erfassen.css", "erfassen/manifest.webmanifest", "assets/css/capture.css", "assets/js/leads.js", "assets/js/store.js", "assets/js/capture.js", "assets/js/scan.js", "assets/js/qrworker.js", "assets/vendor/jsQR.js", "assets/js/ocr.js", "assets/vendor/tesseract/tesseract.esm.min.js", "assets/vendor/tesseract/worker.min.js", "assets/vendor/tesseract/tesseract-core-simd-lstm.wasm.js", "assets/vendor/tessdata/eng.traineddata", "assets/vendor/tessdata/deu.traineddata", "assets/vendor/tessdata/fra.traineddata", "assets/vendor/tessdata/spa.traineddata", "assets/img/zoller.svg", "assets/img/leads-180.png", "assets/img/leads-192.png", "assets/fonts/T-Star-Regular.woff2", "assets/fonts/T-Star-Medium.woff2", "assets/fonts/T-Star-Bold.woff2", "data/kiosk.json"];   // Pfade relativ zum App-Ordner (docs/)
const CACHE = 'zl-' + VERSION;
const ROOT = new URL('../', self.location).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(FILES.map(async (p) => {
      for (let t = 1; t <= 3; t++) {
        try { const r = await fetch(ROOT + p, { cache: 'no-cache' }); if (r.ok) { await c.put(ROOT + p, r); return; } } catch { /* nochmal */ }
        await new Promise((res) => setTimeout(res, 600 * t));
      }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('zl-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(ROOT)) return;      // HubSpot (POST) und fremde Hosts: normal übers Netz
  let path = req.url.slice(ROOT.length).split('#')[0].split('?')[0];
  if (path === 'erfassen/' || path === 'erfassen') path = 'erfassen/index.html';
  if (path === 'data/version.json') return;                          // Versionsanzeige: Netz
  event.respondWith((async () => {
    const hit = await caches.match(ROOT + path, { cacheName: CACHE });
    if (hit) return hit;
    try { return await fetch(req); } catch {
      if (req.mode === 'navigate') return (await caches.match(ROOT + 'erfassen/index.html', { cacheName: CACHE })) || Response.error();
      return new Response('offline', { status: 503 });
    }
  })());
});
