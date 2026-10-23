// QR-Lesen im Hintergrund (jsQR, Apache-2.0, assets/vendor) – die Kamera-Vorschau bleibt flüssig.
importScripts('../vendor/jsQR.js');

self.onmessage = (e) => {
  const { id, data, width, height } = e.data;
  let text = null;
  try {
    const code = self.jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
    text = code ? code.data || null : null;
  } catch { /* nächstes Bild */ }
  self.postMessage({ id, text });
};
