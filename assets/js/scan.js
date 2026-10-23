// Kamera-Scanner für Besucherausweise und den Kopplungs-Code: BarcodeDetector, wo es ihn gibt (QR, PDF417, DataMatrix,
// Aztec, Code 128/39), sonst jsQR in einem Worker (nur QR – auf Messeausweisen fast immer QR). Läuft ohne Netz.

const FORMATS = ['qr_code', 'pdf417', 'data_matrix', 'aztec', 'code_128', 'code_39'];

let detector = null;
async function nativeDetector() {
  if (detector !== null) return detector;
  detector = false;
  try {
    if ('BarcodeDetector' in window) {
      const have = await window.BarcodeDetector.getSupportedFormats();
      const use = FORMATS.filter((f) => have.includes(f));
      if (use.includes('qr_code')) detector = new window.BarcodeDetector({ formats: use });
    }
  } catch { detector = false; }
  return detector;
}

let worker = null, seq = 0;
const waiting = new Map();
// Worker als Blob aus jsQR + qrworker.js: WebKit lädt Worker-Skripte am Offline-Speicher vorbei – so geht der Scan auch ohne Netz
async function qrWorker() {
  if (!worker) {
    worker = (async () => {
      const get = async (u) => { const r = await fetch(new URL(u, import.meta.url)); if (!r.ok) throw new Error(r.status + ' ' + u); return r.text(); };
      const [lib, body] = await Promise.all([get('../vendor/jsQR.js'), get('./qrworker.js')]);
      const w = new Worker(URL.createObjectURL(new Blob([lib, '\n;\n', body.replace(/importScripts\([^)]*\);?/, '')], { type: 'text/javascript' })));
      w.onmessage = (e) => { const r = waiting.get(e.data.id); if (r) { waiting.delete(e.data.id); r(e.data.text); } };
      return w;
    })();
  }
  return worker;
}
async function decode(img) {
  const w = await qrWorker();
  return new Promise((res) => {
    const id = ++seq;
    waiting.set(id, res);
    w.postMessage({ id, data: img.data, width: img.width, height: img.height }, [img.data.buffer]);
  });
}

/** kurzer Signalton als Rückmeldung (iOS kennt kein navigator.vibrate) */
export function beep(ok = true) {
  try {
    const ac = beep.ac || (beep.ac = new (window.AudioContext || window.webkitAudioContext)());
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = ok ? 1320 : 330;
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (ok ? 0.12 : 0.3));
    o.connect(g).connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.32);
  } catch { /* ohne Ton */ }
  try { navigator.vibrate?.(ok ? 40 : [60, 60, 60]); } catch { /* egal */ }
}

/**
 * Scanner im Element »host« öffnen. Liefert den gelesenen Text (oder null bei Abbruch).
 * opts.title / opts.hint: Beschriftung, opts.cancel: Text des Abbrechen-Knopfs, opts.accept(text): true = annehmen
 */
export function scan(host, opts = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'scan';
    el.innerHTML = `<video playsinline muted autoplay></video>
      <div class="scan__frame"><i></i><i></i><i></i><i></i><b></b></div>
      <div class="scan__top"><strong>${opts.title || ''}</strong><span>${opts.hint || ''}</span></div>
      <p class="scan__msg" data-msg></p>
      <div class="scan__bar"><button type="button" class="cbtn cbtn--light" data-x>${opts.cancel || 'Abbrechen'}</button>
        ${opts.manual ? `<button type="button" class="cbtn cbtn--ghost" data-manual>${opts.manual}</button>` : ''}</div>`;
    host.appendChild(el);
    const video = el.querySelector('video');
    const msg = el.querySelector('[data-msg]');
    let stream = null, done = false, timer = null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const finish = (text) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 220);
      resolve(text);
    };
    el.querySelector('[data-x]').addEventListener('click', () => finish(null));
    el.querySelector('[data-manual]')?.addEventListener('click', () => finish(''));
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      } catch (e) {
        msg.textContent = opts.noCamera || 'Kamera nicht verfügbar – bitte in den Einstellungen erlauben.';
        el.classList.add('is-error');
        return;
      }
      if (done) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream;
      await video.play().catch(() => {});
      const native = await nativeDetector();
      const tick = async () => {
        if (done) return;
        let text = null;
        try {
          if (video.readyState >= 2 && video.videoWidth) {
            if (native) {
              const codes = await native.detect(video);
              text = codes?.[0]?.rawValue || null;
            } else {
              // Ausschnitt in der Bildmitte (dort liegt der Ausweis), höchstens 900 px – schnell und genau genug
              const vw = video.videoWidth, vh = video.videoHeight;
              const side = Math.min(vw, vh) * 0.9;
              const sc = Math.min(1, 900 / side);
              canvas.width = canvas.height = Math.round(side * sc);
              ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
              text = await decode(ctx.getImageData(0, 0, canvas.width, canvas.height));
            }
          }
        } catch { /* nächstes Bild */ }
        if (text && (!opts.accept || opts.accept(text))) {
          el.classList.add('is-hit');
          beep(true);
          setTimeout(() => finish(text), 180);
          return;
        }
        timer = setTimeout(tick, native ? 120 : 60);
      };
      tick();
    })();
  });
}

// für Tests und andere Leser (Bilddaten → Text)
export { decode as decodeQR };
