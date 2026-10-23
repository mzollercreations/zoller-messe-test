// Filmspieler (Vollbild, mit Ton, Untertitel in der Sprache des Besuchers) + Untertitel-Helfer für die Dauerschleife.
import { mediaUrl, json } from './media.js';

const capCache = new Map();
export async function captions(film, lang) {
  if (!film.captions) return null;
  if (!capCache.has(film.id)) capCache.set(film.id, json(film.captions).catch(() => null));
  const all = await capCache.get(film.id);
  if (!all) return null;
  return all[lang] || all[lang.split('-')[0]] || all.en || null;
}
export const filmSrc = (film, lang) => film.src[lang] || film.src[lang.split('-')[0]] || film.src['*'] || film.src.all;

/** Untertitel an ein <video> koppeln; liefert eine Funktion zum Lösen */
export function bindCaptions(video, el, cues) {
  let last = -1;
  const tick = () => {
    if (!cues) { el.classList.remove('is-on'); return; }
    const t = video.currentTime;
    const i = cues.findIndex((c) => t >= c[0] - .05 && t <= c[1] + .35);
    if (i === last) return;
    last = i;
    if (i < 0) { el.classList.remove('is-on'); return; }
    el.textContent = cues[i][2];
    el.classList.add('is-on');
  };
  video.addEventListener('timeupdate', tick);
  video.addEventListener('seeked', tick);
  tick();
  return () => { video.removeEventListener('timeupdate', tick); video.removeEventListener('seeked', tick); el.classList.remove('is-on'); };
}

const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export class Player {
  constructor(root, { t, onEnd, onState }) {
    this.root = root; this.t = t; this.onEnd = onEnd; this.onState = onState;
    this.v = root.querySelector('[data-p-video]');
    this.cap = root.querySelector('[data-p-cap]');
    this.ui = root.querySelector('[data-p-ui]');
    this.endEl = root.querySelector('[data-p-end]');
    this.capOn = true;
    const q = (s) => root.querySelector(s);
    q('[data-p-close]').addEventListener('click', () => this.close());
    q('[data-p-play]').addEventListener('click', () => this.toggle());
    q('[data-p-cc]').addEventListener('click', () => { this.capOn = !this.capOn; this.syncCC(); this.poke(); });
    // Tippen aufs Bild: versteckte Bedienung erst einblenden, sonst Pause/Weiter
    this.v.addEventListener('click', () => { if (this.wasHidden) this.poke(); else this.toggle(); });
    this.v.addEventListener('play', () => { root.classList.add('is-playing'); this.poke(); this.onState?.(true); });
    this.v.addEventListener('pause', () => { root.classList.remove('is-playing'); this.ui.classList.remove('is-hidden'); this.onState?.(false); });
    this.v.addEventListener('ended', () => { this.onState?.(false); this.showEnd(); });
    this.v.addEventListener('timeupdate', () => this.progress());
    this.v.addEventListener('progress', () => this.progress());
    this.v.addEventListener('loadedmetadata', () => { q('[data-p-dur]').textContent = fmt(this.v.duration); });
    // Spulen über die Leiste (Finger ziehen)
    const track = q('[data-p-track]');
    const seek = (e) => {
      const r = track.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      if (this.v.duration) this.v.currentTime = f * this.v.duration;
      this.progress(); this.poke();
    };
    track.addEventListener('pointerdown', (e) => { track.setPointerCapture(e.pointerId); this.drag = true; seek(e); });
    track.addEventListener('pointermove', (e) => { if (this.drag) seek(e); });
    track.addEventListener('pointerup', () => { this.drag = false; });
    track.addEventListener('pointercancel', () => { this.drag = false; });
    root.addEventListener('pointerdown', () => { this.wasHidden = this.ui.classList.contains('is-hidden'); this.poke(); }, true);
  }

  get playing() { return !this.root.hidden && !this.v.paused && !this.v.ended; }
  get open() { return !this.root.hidden; }

  async play(film, { lang, title, sub, next }) {
    this.film = film; this.next = next;
    this.endEl.hidden = true;
    this.root.hidden = false;
    this.root.querySelector('[data-p-title]').innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    const src = await mediaUrl(filmSrc(film, lang), [this.v.src]);
    this.v.src = src;
    this.v.muted = false;
    this.v.currentTime = 0;
    this.unbind?.();
    this.cues = await captions(film, lang);
    this.unbind = bindCaptions(this.v, this.cap, this.cues);
    this.syncCC();
    try { await this.v.play(); } catch (e) { console.warn('Abspielen', e); this.root.classList.remove('is-playing'); }
  }

  syncCC() {
    const btn = this.root.querySelector('[data-p-cc]');
    btn.hidden = !this.cues;
    btn.classList.toggle('is-on', this.capOn);
    this.cap.style.visibility = this.capOn ? '' : 'hidden';
  }

  toggle() { if (this.v.paused) { this.endEl.hidden = true; this.v.play().catch(() => {}); } else this.v.pause(); }

  poke() {
    this.ui.classList.remove('is-hidden');
    clearTimeout(this.hideT);
    this.hideT = setTimeout(() => { if (!this.v.paused && !this.drag) this.ui.classList.add('is-hidden'); }, 3200);
  }

  progress() {
    const d = this.v.duration || 0, t = this.v.currentTime || 0;
    this.root.querySelector('[data-p-pos]').style.width = d ? (t / d * 100) + '%' : '0';
    this.root.querySelector('[data-p-time]').textContent = fmt(t);
    let buf = 0;
    try { if (this.v.buffered.length) buf = this.v.buffered.end(this.v.buffered.length - 1); } catch { /* egal */ }
    this.root.querySelector('[data-p-buf]').style.width = d ? (buf / d * 100) + '%' : '0';
  }

  showEnd() {
    this.ui.classList.remove('is-hidden');
    this.endEl.hidden = false;
    this.endEl.innerHTML = this.onEnd ? this.onEnd(this.film, this.next) : '';
  }

  close() {
    this.v.pause();
    this.unbind?.(); this.unbind = null;
    this.root.hidden = true;
    this.root.classList.remove('is-playing');
    this.onState?.(false);
    this.onClose?.();
  }
}
