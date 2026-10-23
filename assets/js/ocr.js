// Visitenkarte lesen: Texterkennung direkt auf dem Gerät (Tesseract per WebAssembly, assets/vendor/tesseract + tessdata) –
// funktioniert offline, nichts verlässt das Gerät. Zwei Durchgänge: (1) ganzes Foto – Lage (0°/90°/270°) und Karte im Bild finden,
// (2) nur die Karte, groß genug für kleine Schrift; liest das zu wenig, (3) mit Lichtausgleich (Glanz, Schatten, dunkle Karten).
// Zurück kommen beide Lesungen: parseCard(text, alt) füllt Lücken der besseren mit der anderen.
// Messreihe (24 Handyfotos, 12 Kartendesigns, 2026-10-23): 59 % → 89 % richtige Felder.

const VENDOR = new URL('../vendor/', import.meta.url).href;
// Sprache der Erfassung → Sprachmodelle (Englisch immer dabei: E-Mail, Web, Positionen sind oft englisch)
const MODELS = { de: 'deu+eng', en: 'eng', fr: 'fra+eng', es: 'spa+eng' };
let W = null, Wkey = '', Wbusy = null;

function simd() {
  try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch { return false; }
}

// Offline auf iPad/iPhone: WebKit lädt Skripte und Dateien eines Workers am Offline-Speicher (Service Worker) vorbei. Darum holt
// die Seite alles selbst (Service Worker → Offline-Speicher), startet Kern + Worker als EIN Blob-Skript (kein Nachladen) und legt
// die Sprachdaten vorab in den Speicher, den Tesseract zuerst fragt (IndexedDB »keyval-store«, Schlüssel »./<sprache>.traineddata«).
const text = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(r.status + ' ' + url); return r.text(); };
let blobUrl = null;
async function workerBlob(core) {
  if (blobUrl) return blobUrl;
  const [c, w] = await Promise.all([text(VENDOR + 'tesseract/' + core), text(VENDOR + 'tesseract/worker.min.js')]);
  blobUrl = URL.createObjectURL(new Blob([c, '\n;\n', w], { type: 'text/javascript' }));
  return blobUrl;
}
function kv() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('keyval-store');
    r.onupgradeneeded = () => r.result.createObjectStore('keyval');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function seedLang(code) {
  const db = await kv();
  const key = `./${code}.traineddata`;
  const have = await new Promise((res) => { const q = db.transaction('keyval').objectStore('keyval').count(key); q.onsuccess = () => res(q.result); q.onerror = () => res(0); });
  if (!have) {
    const r = await fetch(VENDOR + 'tessdata/' + code + '.traineddata');
    if (!r.ok) throw new Error(r.status + ' ' + code);
    const data = new Uint8Array(await r.arrayBuffer());
    await new Promise((res, rej) => { const t = db.transaction('keyval', 'readwrite'); t.objectStore('keyval').put(data, key); t.oncomplete = res; t.onerror = () => rej(t.error); });
  }
  db.close();
}

let progressFn = null;
async function worker(lang) {
  const key = MODELS[lang] || MODELS[(lang || '').split('-')[0]] || 'deu+eng';
  if (W && Wkey === key) return W;
  if (Wbusy) await Wbusy;
  if (W && Wkey === key) return W;
  Wbusy = (async () => {
    if (W) { await W.terminate().catch(() => {}); W = null; }
    const T = (await import(VENDOR + 'tesseract/tesseract.esm.min.js')).default;
    const core = simd() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js';
    await Promise.all(key.split('+').map(seedLang));
    W = await T.createWorker(key.split('+'), 1, {          // 1 = nur LSTM (schnell, genau)
      workerPath: await workerBlob(core), workerBlobURL: false,
      corePath: VENDOR + 'tesseract/' + core,                // nur Rückfall – der Kern steckt schon im Worker-Skript
      langPath: VENDOR + 'tessdata', gzip: false, cacheMethod: 'write',
      logger: (m) => { if (m.status === 'recognizing text') progressFn?.(m.progress); },
    });
    await W.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300' });
    Wkey = key;
  })();
  try { await Wbusy; } finally { Wbusy = null; }
  return W;
}

/** Leser vorab laden (z. B. beim Öffnen des Formulars), damit der erste Scan schneller ist */
export function warmUp(lang) { worker(lang).catch(() => {}); }

/**
 * Foto → Leinwand für die Texterkennung: gedreht, auf einen Ausschnitt beschnitten (region = [x0, y0, x1, y1] im gedrehten Bild, 0…1),
 * lange Seite auf »target« gebracht (auch vergrößert, kleine Schrift braucht Pixel), Graustufen, Licht ausgeglichen
 * (Glanzlicht, Schatten, Verlauf: Bild durch den geschätzten Papierhintergrund teilen), dunkle Karten invertiert, Kontrast gestreckt.
 */
function prepare(bmp, rot, { region = [0, 0, 1, 1], target = 2000, maxUp = 3, flatten = true } = {}) {
  const side = rot % 180 !== 0;
  const RW = side ? bmp.height : bmp.width, RH = side ? bmp.width : bmp.height;
  const rx = region[0] * RW, ry = region[1] * RH, rw = (region[2] - region[0]) * RW, rh = (region[3] - region[1]) * RH;
  const sc = Math.min(maxUp, target / Math.max(rw, rh));
  const c = document.createElement('canvas');
  c.width = Math.max(32, Math.round(rw * sc)); c.height = Math.max(32, Math.round(rh * sc));
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  x.setTransform(sc, 0, 0, sc, -rx * sc, -ry * sc);
  x.translate(RW / 2, RH / 2);
  x.rotate(rot * Math.PI / 180);
  x.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  x.setTransform(1, 0, 0, 1, 0, 0);
  const W = c.width, H = c.height;
  const img = x.getImageData(0, 0, W, H);
  const d = img.data;
  const g = new Float32Array(W * H);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  const hist = new Uint32Array(256);
  if (!flatten) {
    // erster Durchgang (ganzes Foto): nur Graustufen – Ausgleich würde die Tischmaserung zu Streifen machen
    for (let j = 0; j < g.length; j++) hist[g[j] | 0]++;
    return stretch(c, x, img, g, hist, 0.01, 0.01);
  }
  // dunkle Karte (helle Schrift)? Mitte des Ausschnitts zählt – dann umkehren, damit die Schrift dunkel auf hell steht
  let sum = 0, n = 0;
  for (let y = Math.round(H * .2); y < H * .8; y += 4) for (let xx = Math.round(W * .2); xx < W * .8; xx += 4) { sum += g[y * W + xx]; n++; }
  if (n && sum / n < 105) for (let j = 0; j < g.length; j++) g[j] = 255 - g[j];
  // Papierhintergrund schätzen: Maximum in 12-px-Blöcken, dann 5×5-Maximum und Glättung im kleinen Bild
  const B = 12, sw = Math.ceil(W / B), sh = Math.ceil(H / B);
  let bg = new Float32Array(sw * sh);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { const k = ((y / B) | 0) * sw + ((xx / B) | 0); if (g[y * W + xx] > bg[k]) bg[k] = g[y * W + xx]; }
  const pass = (src, fn) => {
    const out = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) for (let xx = 0; xx < sw; xx++) {
      let v = fn === 'max' ? 0 : 0, cnt = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const yy = y + dy, xq = xx + dx;
        if (yy < 0 || yy >= sh || xq < 0 || xq >= sw) continue;
        const s = src[yy * sw + xq];
        if (fn === 'max') { if (s > v) v = s; } else { v += s; cnt++; }
      }
      out[y * sw + xx] = fn === 'max' ? v : v / cnt;
    }
    return out;
  };
  bg = pass(pass(bg, 'max'), 'mean');
  // teilen (bilinear aus dem kleinen Bild), Histogramm für die Streckung
  for (let y = 0; y < H; y++) {
    const fy = Math.min(sh - 1.001, Math.max(0, y / B - .5)), y0 = fy | 0, ty = fy - y0;
    for (let xx = 0; xx < W; xx++) {
      const fx = Math.min(sw - 1.001, Math.max(0, xx / B - .5)), x0 = fx | 0, tx = fx - x0;
      const a = bg[y0 * sw + x0], b2 = bg[y0 * sw + x0 + 1] ?? a, c2 = bg[(y0 + 1) * sw + x0] ?? a, e = bg[(y0 + 1) * sw + x0 + 1] ?? a;
      const back = (a * (1 - tx) + b2 * tx) * (1 - ty) + (c2 * (1 - tx) + e * tx) * ty;
      const v = Math.min(255, g[y * W + xx] / Math.max(24, back) * 255);
      g[y * W + xx] = v; hist[v | 0]++;
    }
  }
  return stretch(c, x, img, g, hist, 0.005, 0.02);
}
// dunkelste / hellste Anteile abschneiden, dazwischen auf 0–255 strecken
function stretch(c, x, img, g, hist, cutLo, cutHi) {
  const d = img.data, total = g.length;
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255 && (acc += hist[lo]) < total * cutLo; lo++);
  acc = 0;
  for (; hi > 0 && (acc += hist[hi]) < total * cutHi; hi--);
  const span = Math.max(1, hi - lo);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) {
    const v = Math.max(0, Math.min(255, (g[j] - lo) * 255 / span));
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

/**
 * Wo liegt die Karte? Vom Textbereich aus über das Papier »fluten« (kleines, geglättetes Graubild; ein Schritt darf sich nur wenig
 * ändern) – Papier mit Verlauf oder Glanz gehört dazu, an der Kartenkante (Sprung) ist Schluss. Gibt den Ausschnitt 0…1 zurück
 * oder null, wenn das Fluten ausläuft (Karte und Tisch gleich hell) – dann reicht der Textbereich mit großzügigem Rand.
 */
function cardBox(canvas, tb) {
  const S = 480 / Math.max(canvas.width, canvas.height);
  const w = Math.max(8, Math.round(canvas.width * S)), h = Math.max(8, Math.round(canvas.height * S));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(canvas, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  let g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = d[i * 4];
  // 2× Kastenfilter 5×5 (glättet Maserung und Schrift)
  for (let k = 0; k < 2; k++) {
    const o = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      let s2 = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xq = xx + dx; if (yy >= 0 && yy < h && xq >= 0 && xq < w) { s2 += g[yy * w + xq]; n++; } }
      o[y * w + xx] = s2 / n;
    }
    g = o;
  }
  // Start: hellster Punkt im Textbereich (Papier zwischen den Zeilen)
  const bx0 = Math.round(tb[0] * w), by0 = Math.round(tb[1] * h), bx1 = Math.round(tb[2] * w), by1 = Math.round(tb[3] * h);
  let seed = -1, sv = -1;
  for (let y = by0; y < by1; y++) for (let xx = bx0; xx < bx1; xx++) if (g[y * w + xx] > sv) { sv = g[y * w + xx]; seed = y * w + xx; }
  if (seed < 0) return null;
  const seen = new Uint8Array(w * h), stack = [seed];
  seen[seed] = 1;
  let minX = w, minY = h, maxX = 0, maxY = 0, n = 0;
  while (stack.length) {
    const i = stack.pop(), y = (i / w) | 0, xx = i - y * w;
    n++; if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; if (y < minY) minY = y; if (y > maxY) maxY = y;
    for (const j of [i - 1, i + 1, i - w, i + w]) {
      if (j < 0 || j >= g.length || seen[j] || (j === i - 1 && xx === 0) || (j === i + 1 && xx === w - 1)) continue;
      if (Math.abs(g[j] - g[i]) < 5) { seen[j] = 1; stack.push(j); }
    }
  }
  const area = (maxX - minX + 1) * (maxY - minY + 1);
  if (n < w * h * 0.04 || area > w * h * 0.92) return null;
  const box = [minX / w, minY / h, (maxX + 1) / w, (maxY + 1) / h];
  // Textbereich muss drin liegen
  if (box[0] > tb[0] + .02 || box[1] > tb[1] + .02 || box[2] < tb[2] - .02 || box[3] < tb[3] - .02) return null;
  // etwas Rand: farbige Bänder am Kartenrand (andere Helligkeit) gehören noch zur Karte
  const mw = (box[2] - box[0]) * .05, mh = (box[3] - box[1]) * .12;
  return [Math.max(0, box[0] - mw), Math.max(0, box[1] - mh), Math.min(1, box[2] + mw), Math.min(1, box[3] + mh)];
}

/** Bereich mit sicher gelesenem Text (Karte im Foto) → Ausschnitt 0…1 mit Rand; null, wenn zu wenig erkannt */
function textBox(words, W, H) {
  let ok = words.filter((w) => w.confidence > 70 && /[\p{L}\p{N}]{3}/u.test(w.text));
  if (ok.length < 3) return null;
  // Ausreißer (Maserung, Gegenstände neben der Karte) weg: weit vom Schwerpunkt der Wörter
  const med = (a) => [...a].sort((p, q) => p - q)[a.length >> 1];
  const cx = med(ok.map((w) => (w.bbox.x0 + w.bbox.x1) / 2)), cy = med(ok.map((w) => (w.bbox.y0 + w.bbox.y1) / 2));
  ok = ok.filter((w) => Math.abs((w.bbox.x0 + w.bbox.x1) / 2 - cx) < W * .42 && Math.abs((w.bbox.y0 + w.bbox.y1) / 2 - cy) < H * .42);
  if (ok.length < 3) return null;
  const x0 = Math.min(...ok.map((w) => w.bbox.x0)), x1 = Math.max(...ok.map((w) => w.bbox.x1)), y0 = Math.min(...ok.map((w) => w.bbox.y0)), y1 = Math.max(...ok.map((w) => w.bbox.y1));
  const mx = (x1 - x0) * .07 + W * .015, my = (y1 - y0) * .1 + H * .015;
  return [Math.max(0, (x0 - mx) / W), Math.max(0, (y0 - my) / H), Math.min(1, (x1 + mx) / W), Math.min(1, (y1 + my) / H)];
}

const score = (data) => (data?.words || []).filter((w) => w.confidence > 60 && w.text.trim().length > 1).length;

/**
 * Text nach Lage auf der Karte: Tesseract liest zwei Spalten auf gleicher Höhe als eine Zeile (»Firma GmbH   Tel. …«).
 * Zeilen werden an großen Lücken getrennt, jedes Stück der linken oder rechten Kartenhälfte zugeordnet; ausgegeben wird erst die
 * linke Spalte (Name, Firma, Adresse), dann die rechte (Logo, Telefon, E-Mail, Web) – jeweils von oben nach unten.
 */
function layout(lines) {
  const segs = [];
  const all = lines.flatMap((l) => l.words);
  if (!all.length) return '';
  const minX = Math.min(...all.map((w) => w.bbox.x0)), maxX = Math.max(...all.map((w) => w.bbox.x1));
  const mid = (minX + maxX) / 2;
  for (const line of lines) {
    const words = [...line.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const h = words.reduce((s, w) => s + (w.bbox.y1 - w.bbox.y0), 0) / words.length;
    let cur = [];
    const flush = () => {
      if (!cur.length) return;
      const x0 = cur[0].bbox.x0, x1 = cur[cur.length - 1].bbox.x1;
      segs.push({ text: cur.map((w) => w.text).join(' '), y: Math.min(...cur.map((w) => w.bbox.y0)), col: (x0 + x1) / 2 < mid ? 0 : 1, wide: x1 - x0 > (maxX - minX) * 0.6 });
      cur = [];
    };
    for (const w of words) {
      const prev = cur[cur.length - 1];
      if (prev && w.bbox.x0 - prev.bbox.x1 > Math.max(h * 2.2, (maxX - minX) * 0.06)) flush();
      cur.push(w);
    }
    flush();
  }
  // Spalten nur, wenn die Karte wirklich zwei hat (Lücken in Zeilen); zentrierte Karten bleiben von oben nach unten.
  // Breite Zeilen (über die ganze Karte) zählen zur linken Spalte.
  const split = lines.length && segs.length - lines.length >= 1;
  const col = (s) => (!split || s.wide ? 0 : s.col);
  return [...segs].sort((a, b) => col(a) - col(b) || a.y - b.y).map((s) => s.text).join('\n');
}

/**
 * Visitenkarte lesen. file: Foto (File/Blob). Liefert { text, confidence, rotation }.
 * onProgress(0…1) während der Erkennung.
 */
export async function readCard(file, { lang = 'de', onProgress } = {}) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bmp = await createImageBitmap(file); }
  const w = await worker(lang);
  const read = async (canvas) => {
    const { data } = await w.recognize(canvas, {}, { blocks: true, text: true });
    const lines = (data.blocks || []).flatMap((b) => (b.paragraphs || []).flatMap((p) => p.lines || []))
      .map((l) => ({ ...l, words: (l.words || []).filter((x) => x.text.trim() && x.confidence > 20) })).filter((l) => l.words.length);
    const words = lines.flatMap((l) => l.words);
    const res = { text: layout(lines) || data.text || '', confidence: data.confidence || 0, words, W: canvas.width, H: canvas.height, canvas };
    return { ...res, s: score(res) };
  };
  // Durchgang 1: ganzes Foto – richtige Lage finden (wie fotografiert, sonst quer) und wo auf dem Foto die Karte liegt
  let best = null;
  for (const rot of [0, 90, 270]) {
    progressFn = (p) => onProgress?.(Math.min(0.99, (rot === 0 ? 0 : 0.25) + p * 0.25));
    const r = await read(prepare(bmp, rot, { target: 2000, maxUp: 1, flatten: false }));
    if (!best || r.s > best.s) best = { ...r, rotation: rot };
    if (rot === 0 && r.s >= 6 && r.confidence >= 55) break;
  }
  // Durchgang 2: nur die Karte, groß genug für kleine Schrift (lange Seite 2600 px) – gewinnt, wenn er mindestens so viel sicher liest
  const tb = textBox(best.words, best.W, best.H);
  // Karte im Foto; wenn sie sich nicht abgrenzen lässt: Textbereich mit großzügigem Rand (blasse Zeilen hat Durchgang 1 evtl. übersehen)
  const box = tb && (cardBox(best.canvas, tb) || [Math.max(0, tb[0] - .08), Math.max(0, tb[1] - .1), Math.min(1, tb[2] + .08), Math.min(1, tb[3] + .1)]);
  if (box) {
    progressFn = (p) => onProgress?.(Math.min(0.99, 0.5 + p * 0.5));
    const r2 = await read(prepare(bmp, best.rotation, { region: box, target: 2000, maxUp: 3, flatten: false }));
    const first = best;
    if (r2.s >= best.s * 0.9) best = { ...r2, rotation: best.rotation, other: first.text };
    else best.other = r2.text;
    // zu wenig gelesen (keine E-Mail, kaum Zeilen)? Blasse/dünne Schrift: noch einmal mit Lichtausgleich
    const thin = (t) => !/@/.test(t) || t.split('\n').filter((l) => /[\p{L}\p{N}]{3}/u.test(l)).length < 5;
    if (thin(best.text)) {
      progressFn = (p) => onProgress?.(Math.min(0.99, 0.75 + p * 0.25));
      const r3 = await read(prepare(bmp, best.rotation, { region: box, target: 2400, maxUp: 3, flatten: true }));
      if (r3.s > best.s || (!/@/.test(best.text) && /@/.test(r3.text))) best = { ...r3, rotation: best.rotation, other: best.text + '\n' + (best.other || '') };
      else best.other = (best.other || '') + '\n' + r3.text;
    }
  }
  progressFn = null;
  onProgress?.(1);
  bmp.close?.();
  // Zeilen mit fast nur Störzeichen (Kartenrand, Logo-Grafik) entfernen
  const clean = (t) => t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 1 && (l.match(/[\p{L}\p{N}@]/gu) || []).length >= Math.max(2, l.length * 0.5)).join('\n');
  const text = clean(best.text);
  // alt: die andere Lesung (ganzes Foto bzw. Ausschnitt) – parseCard(text, alt) füllt damit Lücken
  return { text, alt: clean(best.other || ''), confidence: Math.round(best.confidence), rotation: best.rotation };
}

