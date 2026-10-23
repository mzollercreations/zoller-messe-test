// Lead erfassen (Standpersonal): Badge scannen, Visitenkarte (iOS »Text scannen« + Foto) oder von Hand, dann Fragebogen der Messe,
// Notiz, Einwilligung. Läuft in der Erfassungs-App (Handy/iPad, /erfassen/) und im Personalbereich des Kiosks.
import { newLead, saveLead, deleteLead, allLeads, template, label, visible, parseBadge, parseCard, isMail, photos, eventName } from './leads.js';
import { scan, beep } from './scan.js';
import { readCard, warmUp } from './ocr.js';
import { uid } from './store.js';

export const CTX = {
  de: {
    new: 'Neuer Lead', edit: 'Lead bearbeiten', close: 'Schließen', badge: 'Badge scannen', card: 'Visitenkarte', hand: 'Von Hand',
    contact: 'Kontakt', first: 'Vorname', last: 'Nachname', company: 'Firma', email: 'E-Mail', phone: 'Telefon', mobile: 'Mobil', title: 'Position',
    website: 'Webseite', street: 'Straße', zip: 'PLZ', city: 'Ort', country: 'Land', address: 'Adresse', more: 'Mehr Felder',
    cardH: 'Visitenkarte', cardP: 'Karte fotografieren – Name, Firma, E-Mail, Telefon und Adresse werden automatisch ausgefüllt. Das Foto bleibt als Nachweis beim Lead.',
    cardPh: 'Text der Visitenkarte', photo: 'Karte fotografieren', photoAgain: 'Neu fotografieren', photoDel: 'Foto entfernen',
    reading: 'Karte wird gelesen … {p} %', readOk: '{n} Angaben erkannt – bitte mit dem Foto vergleichen.', readNone: 'Kein Text erkannt – das Foto ist gespeichert, bitte von Hand eintragen.', readFew: 'Nur {n} Angaben erkannt – Karte nochmal formatfüllend, scharf und ohne Spiegelung fotografieren (Foto bleibt gespeichert).',
    cardText: 'Erkannter Text (zum Prüfen)', zoom: 'Antippen zum Vergrößern',
    badgeH: 'Besucherausweis', badgeId: 'Nur eine Ausweis-Nummer – bitte E-Mail ergänzen oder Visitenkarte scannen.', rescan: 'Neu scannen',
    quali: 'Fragebogen', note: 'Notiz', notePh: 'Was ist wichtig? (Diktieren: Mikrofon auf der Tastatur)',
    consent: 'Kontakt ist einverstanden, dass {company} die Angaben speichert und sich meldet.', newsletter: 'Möchte den Newsletter (Einwilligung)',
    save: 'Speichern', saveNext: 'Speichern + Scan', del: 'Löschen', delQ: 'Diesen Lead löschen?',
    staff: 'Erfasst von (Ihr Name)', needStaff: 'Bitte Ihren Namen eintragen – daran sieht man in HubSpot, wer den Lead erfasst hat.',
    need: 'Bitte mindestens Name, Firma, E-Mail oder Badge erfassen.', noMail: 'Ohne E-Mail kann der Lead nicht an HubSpot übertragen werden. Trotzdem speichern?',
    badMail: 'Die E-Mail-Adresse sieht nicht vollständig aus.', saved: 'Gespeichert – wird an HubSpot übertragen, sobald Netz da ist.',
    dupe: 'Schon erfasst: {who} um {time}.', dupeOpen: 'Vorhandenen öffnen', scanTitle: 'Besucherausweis scannen', scanHint: 'QR-Code des Badges in den Rahmen halten',
    cancel: 'Abbrechen', manual: 'Ohne Scan weiter', noCam: 'Kamera nicht verfügbar – in den Einstellungen für diese App erlauben.',
    parts: 'Gelesen:', from: 'von',
  },
  en: {
    new: 'New lead', edit: 'Edit lead', close: 'Close', badge: 'Scan badge', card: 'Business card', hand: 'Manual',
    contact: 'Contact', first: 'First name', last: 'Last name', company: 'Company', email: 'E-mail', phone: 'Phone', mobile: 'Mobile', title: 'Job title',
    website: 'Website', street: 'Street', zip: 'ZIP', city: 'City', country: 'Country', address: 'Address', more: 'More fields',
    cardH: 'Business card', cardP: 'Take a photo of the card – name, company, e-mail, phone and address fill in automatically. The photo stays with the lead as proof.',
    cardPh: 'Business card text', photo: 'Photograph card', photoAgain: 'New photo', photoDel: 'Remove photo',
    reading: 'Reading card … {p} %', readOk: '{n} details recognised – please compare with the photo.', readNone: 'No text recognised – the photo is saved, please enter by hand.', readFew: 'Only {n} details recognised – photograph the card again filling the frame, sharp and without glare (the photo is kept).',
    cardText: 'Recognised text (to check)', zoom: 'Tap to enlarge',
    badgeH: 'Badge', badgeId: 'Badge holds only an ID – please add the e-mail or scan the business card.', rescan: 'Scan again',
    quali: 'Questionnaire', note: 'Note', notePh: 'What matters? (Dictate: microphone on the keyboard)',
    consent: 'Contact agrees that {company} stores the details and gets in touch.', newsletter: 'Wants the newsletter (consent)',
    save: 'Save', saveNext: 'Save + scan', del: 'Delete', delQ: 'Delete this lead?',
    staff: 'Captured by (your name)', needStaff: 'Please enter your name – HubSpot shows who captured the lead.',
    need: 'Please capture at least a name, company, e-mail or badge.', noMail: 'Without an e-mail the lead cannot be sent to HubSpot. Save anyway?',
    badMail: 'The e-mail address looks incomplete.', saved: 'Saved – it goes to HubSpot as soon as there is a connection.',
    dupe: 'Already captured: {who} at {time}.', dupeOpen: 'Open existing', scanTitle: 'Scan badge', scanHint: 'Hold the badge QR code inside the frame',
    cancel: 'Cancel', manual: 'Continue without scan', noCam: 'Camera not available – allow it for this app in Settings.',
    parts: 'Read:', from: 'by',
  },
  fr: {
    new: 'Nouveau contact', edit: 'Modifier le contact', close: 'Fermer', badge: 'Scanner le badge', card: 'Carte de visite', hand: 'Saisie manuelle',
    contact: 'Contact', first: 'Prénom', last: 'Nom', company: 'Société', email: 'E-mail', phone: 'Téléphone', mobile: 'Mobile', title: 'Fonction',
    website: 'Site web', street: 'Rue', zip: 'Code postal', city: 'Ville', country: 'Pays', address: 'Adresse', more: 'Plus de champs',
    cardH: 'Carte de visite', cardP: 'Photographiez la carte – nom, société, e-mail, téléphone et adresse se remplissent automatiquement. La photo reste jointe au contact comme preuve.',
    cardPh: 'Texte de la carte', photo: 'Photographier la carte', photoAgain: 'Nouvelle photo', photoDel: 'Supprimer la photo',
    reading: 'Lecture de la carte … {p} %', readOk: '{n} informations reconnues – comparez avec la photo.', readNone: 'Aucun texte reconnu – la photo est enregistrée, saisissez à la main.', readFew: 'Seulement {n} informations reconnues – reprenez la carte en plein cadre, nette et sans reflet (la photo est conservée).',
    cardText: 'Texte reconnu (à vérifier)', zoom: 'Touchez pour agrandir',
    badgeH: 'Badge', badgeId: 'Le badge ne contient qu’un numéro – ajoutez l’e-mail ou scannez la carte de visite.', rescan: 'Scanner à nouveau',
    quali: 'Questionnaire', note: 'Note', notePh: 'Qu’est-ce qui compte ? (Dictée : micro du clavier)',
    consent: 'Le contact accepte que {company} enregistre ces données et le recontacte.', newsletter: 'Souhaite la newsletter (consentement)',
    save: 'Enregistrer', saveNext: 'Enregistrer + scan', del: 'Supprimer', delQ: 'Supprimer ce contact ?',
    staff: 'Saisi par (votre nom)', needStaff: 'Indiquez votre nom – HubSpot affiche qui a saisi le contact.',
    need: 'Saisissez au moins un nom, une société, un e-mail ou un badge.', noMail: 'Sans e-mail, le contact ne peut pas être transmis à HubSpot. Enregistrer quand même ?',
    badMail: 'L’adresse e-mail semble incomplète.', saved: 'Enregistré – transmis à HubSpot dès qu’il y a du réseau.',
    dupe: 'Déjà saisi : {who} à {time}.', dupeOpen: 'Ouvrir l’existant', scanTitle: 'Scanner le badge', scanHint: 'Placez le QR code du badge dans le cadre',
    cancel: 'Annuler', manual: 'Continuer sans scan', noCam: 'Caméra indisponible – autorisez-la pour cette app dans Réglages.',
    parts: 'Lu :', from: 'par',
  },
  es: {
    new: 'Nuevo contacto', edit: 'Editar contacto', close: 'Cerrar', badge: 'Escanear gafete', card: 'Tarjeta de visita', hand: 'A mano',
    contact: 'Contacto', first: 'Nombre', last: 'Apellidos', company: 'Empresa', email: 'Correo', phone: 'Teléfono', mobile: 'Móvil', title: 'Cargo',
    website: 'Sitio web', street: 'Calle', zip: 'C.P.', city: 'Ciudad', country: 'País', address: 'Dirección', more: 'Más campos',
    cardH: 'Tarjeta de visita', cardP: 'Fotografíe la tarjeta: nombre, empresa, correo, teléfono y dirección se rellenan solos. La foto queda con el contacto como respaldo.',
    cardPh: 'Texto de la tarjeta', photo: 'Fotografiar tarjeta', photoAgain: 'Nueva foto', photoDel: 'Quitar foto',
    reading: 'Leyendo tarjeta … {p} %', readOk: '{n} datos reconocidos: compárelos con la foto.', readNone: 'No se reconoció texto: la foto está guardada, introduzca los datos a mano.', readFew: 'Solo {n} datos reconocidos: vuelva a fotografiar la tarjeta llenando el encuadre, nítida y sin reflejos (la foto se conserva).',
    cardText: 'Texto reconocido (para revisar)', zoom: 'Toque para ampliar',
    badgeH: 'Gafete', badgeId: 'El gafete solo tiene un número – añada el correo o escanee la tarjeta.', rescan: 'Escanear de nuevo',
    quali: 'Cuestionario', note: 'Nota', notePh: '¿Qué es importante? (Dictado: micrófono del teclado)',
    consent: 'El contacto acepta que {company} guarde los datos y se ponga en contacto.', newsletter: 'Quiere el boletín (consentimiento)',
    save: 'Guardar', saveNext: 'Guardar + escanear', del: 'Eliminar', delQ: '¿Eliminar este contacto?',
    staff: 'Registrado por (su nombre)', needStaff: 'Indique su nombre – HubSpot muestra quién registró el contacto.',
    need: 'Capture al menos nombre, empresa, correo o gafete.', noMail: 'Sin correo el contacto no puede enviarse a HubSpot. ¿Guardar de todos modos?',
    badMail: 'El correo parece incompleto.', saved: 'Guardado – se envía a HubSpot en cuanto haya conexión.',
    dupe: 'Ya capturado: {who} a las {time}.', dupeOpen: 'Abrir existente', scanTitle: 'Escanear gafete', scanHint: 'Coloque el código QR del gafete en el marco',
    cancel: 'Cancelar', manual: 'Seguir sin escanear', noCam: 'Cámara no disponible – permítala para esta app en Ajustes.',
    parts: 'Leído:', from: 'por',
  },
};
export const ICONS = {
  qr: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/></svg>',
  card: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M14 10h4M14 13.5h3"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
/** Großansicht eines Fotos: Bild antippen = doppelt so groß (darin wischen), nochmal = ganz; × oder Rand schließt */
function lightbox(src, onClose) {
  const box = document.createElement('div');
  box.className = 'cap__zoom';
  box.innerHTML = `<div class="cap__zoomwrap"><img src="${src}" alt=""></div><button type="button" class="cap__x" aria-label="×">${ICONS.x}</button>`;
  const img = box.querySelector('img'), wrap = box.querySelector('.cap__zoomwrap');
  box.addEventListener('click', (e) => {
    if (e.target === img) {
      const big = !box.classList.contains('is-big');
      const r = img.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      box.classList.toggle('is-big', big);
      // die angetippte Stelle in die Mitte holen
      if (big) requestAnimationFrame(() => { wrap.scrollLeft = img.offsetWidth * fx - wrap.clientWidth / 2; wrap.scrollTop = img.offsetHeight * fy - wrap.clientHeight / 2; });
      return;
    }
    if (e.target.closest('.cap__x') || e.target === box || e.target === wrap) { box.remove(); onClose?.(); }
  });
  document.body.appendChild(box);
}

/** Foto einer Visitenkarte groß zeigen (Lead-Listen) */
export async function showPhoto(id) {
  const blob = id ? await photos.get(id) : null;
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  lightbox(url, () => URL.revokeObjectURL(url));
  return true;
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FIELDS = ['first', 'last', 'company', 'email', 'phone', 'mobile', 'title', 'website', 'street', 'zip', 'city', 'countryName'];

/**
 * Formular öffnen. ctx: { lang, setup: {staff, device, event, booth, site, form}, company (für die Einwilligung), lead (zum Bearbeiten),
 * source ('badge' startet sofort den Scanner), askStaff (gemeinsames Gerät: Namen abfragen, onStaff(name) merkt ihn), onSaved(lead, next), onClose() }
 */
export async function openCapture(host, ctx) {
  const L = CTX[ctx.lang] ? ctx.lang : (CTX[(ctx.lang || '').split('-')[0]] ? ctx.lang.split('-')[0] : 'en');
  const tx = (k, v) => { let s = CTX[L][k] ?? CTX.en[k] ?? k; if (v) s = s.replace(/\{(\w+)\}/g, (m, x) => v[x] ?? m); return s; };
  const S = ctx.setup || {};
  const editing = !!ctx.lead;
  const askStaff = ctx.askStaff && !editing;   // beim Bearbeiten bleibt, wer erfasst hat
  const lead = ctx.lead ? structuredClone(ctx.lead) : newLead({
    source: 'manuell', staff: S.staff || '', device: S.device || '', event: S.event || null, eventLine: eventName(S.event),
    booth: S.booth || '', site: S.site || '', lang: L, form: S.form || undefined, consent: true,
  });
  lead.form = lead.form || S.form || template().id;
  const tpl = template(lead.form);
  const auto = new Set();       // Felder, die der Leser gefüllt hat (dürfen bei neuem Text überschrieben werden)
  const el = document.createElement('div');
  el.className = 'cap';
  host.appendChild(el);
  let photoUrl = null;
  const $ = (s) => el.querySelector(s);
  const $$ = (s) => [...el.querySelectorAll(s)];

  const field = (k, type = 'text', extra = '') => `<label class="cf${k === 'email' || k === 'company' ? ' cf--wide' : ''}"><span>${esc(tx(k === 'countryName' ? 'country' : k))}</span>
    <input name="${k}" type="${type}" value="${esc(lead[k])}" ${extra}
    ${type === 'email' ? 'inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false"' : ''}${type === 'tel' ? 'inputmode="tel"' : ''}></label>`;

  function render() {
    el.innerHTML = `<header class="cap__head">
        <div><h2>${esc(tx(editing ? 'edit' : 'new'))}</h2><p>${esc([lead.eventLine, lead.booth, label(tpl.title, L)].filter(Boolean).join(' · '))}</p></div>
        <button type="button" class="cap__x" data-x aria-label="${esc(tx('close'))}">${ICONS.x}</button>
      </header>
      <div class="cap__body">
        ${editing ? '' : `<div class="cap__src">
          <button type="button" data-src="badge" class="${lead.source === 'badge' ? 'is-on' : ''}">${ICONS.qr}<span>${esc(tx('badge'))}</span></button>
          <button type="button" data-src="visitenkarte" class="${lead.source === 'visitenkarte' ? 'is-on' : ''}">${ICONS.card}<span>${esc(tx('card'))}</span></button>
          <button type="button" data-src="manuell" class="${lead.source === 'manuell' ? 'is-on' : ''}">${ICONS.pen}<span>${esc(tx('hand'))}</span></button>
        </div>`}
        ${askStaff ? `<label class="cf cap__staff"><span>${esc(tx('staff'))} *</span><input name="staff" value="${esc(lead.staff)}" autocomplete="name" enterkeyhint="done"></label>` : ''}
        <div data-dupe></div>
        <div data-badge></div>
        <section class="cap__sec" data-cardsec ${lead.source === 'visitenkarte' || lead.card || lead.photo ? '' : 'hidden'}>
          <h3>${esc(tx('cardH'))}</h3>
          <div class="cap__card">
            <button type="button" class="cap__shot" data-zoom aria-label="${esc(tx('zoom'))}"><img data-thumb alt="" hidden>${ICONS.card}</button>
            <div class="cap__cardinfo"><p class="cap__hint" data-cardmsg>${esc(tx('cardP'))}</p>
              <div class="cap__bar" data-cardbar hidden><i></i></div>
              <div class="cap__photo"><button type="button" class="cbtn cbtn--line cbtn--sm" data-cardshot>${ICONS.cam}<span data-photo-label>${esc(tx(lead.photo ? 'photoAgain' : 'photo'))}</span></button>
                <button type="button" class="cbtn cbtn--ghost cbtn--sm" data-photo-del ${lead.photo ? '' : 'hidden'}>${esc(tx('photoDel'))}</button></div></div>
          </div>
          <details class="cap__more"><summary>${esc(tx('cardText'))}</summary>
            <textarea name="card" rows="6" placeholder="${esc(tx('cardPh'))}" autocomplete="off" autocorrect="off" spellcheck="false">${esc(lead.card)}</textarea></details>
        </section>
        <section class="cap__sec"><h3>${esc(tx('contact'))}</h3>
          <div class="cap__grid">${field('first', 'text', 'autocomplete="off"')}${field('last', 'text', 'autocomplete="off"')}${field('company')}
            ${field('email', 'email')}${field('phone', 'tel')}${field('mobile', 'tel')}${field('title')}</div>
          <details class="cap__more" data-addr ${lead.street || lead.city || lead.website ? 'open' : ''}><summary>${esc(tx('address'))}</summary>
            <div class="cap__grid">${field('street')}${field('zip')}${field('city')}${field('countryName')}${field('website', 'url', 'autocapitalize="off"')}</div></details>
        </section>
        <section class="cap__sec"><h3>${esc(tx('quali'))}</h3><div data-q></div></section>
        <section class="cap__sec"><h3>${esc(tx('note'))}</h3>
          <textarea name="note" rows="3" placeholder="${esc(tx('notePh'))}">${esc(lead.note)}</textarea>
          <button type="button" class="ccheck${lead.consent ? ' is-on' : ''}" data-check="consent"><i>${ICONS.check}</i><span>${esc(tx('consent', { company: ctx.company || 'ZOLLER' }))}</span></button>
          <button type="button" class="ccheck${lead.newsletter ? ' is-on' : ''}" data-check="newsletter"><i>${ICONS.check}</i><span>${esc(tx('newsletter'))}</span></button>
        </section>
      </div>
      <footer class="cap__foot">
        ${editing ? `<button type="button" class="cbtn cbtn--ghost" data-del>${esc(tx('del'))}</button>` : `<button type="button" class="cbtn cbtn--line" data-save="next">${esc(tx('saveNext'))}</button>`}
        <button type="button" class="cbtn cbtn--yellow" data-save="1">${esc(tx('save'))}</button>
      </footer>`;
    renderBadge();
    renderQ();
    showPhoto();
  }

  function renderBadge() {
    const box = $('[data-badge]');
    if (!lead.badge) { box.innerHTML = ''; return; }
    const p = parseBadge(lead.badge);
    const onlyId = p.kind === 'id' && !lead.email;
    box.innerHTML = `<div class="cap__badge${onlyId ? ' is-warn' : ''}"><div><b>${esc(tx('badgeH'))}</b><code>${esc(lead.badge.length > 90 ? lead.badge.slice(0, 90) + '…' : lead.badge)}</code>
      ${onlyId ? `<p>${esc(tx('badgeId'))}</p>` : ''}${p.fields.parts?.length ? `<p class="cap__parts">${esc(tx('parts'))} ${p.fields.parts.map((x) => `<button type="button" data-part="${esc(x)}">${esc(x)}</button>`).join('')}</p>` : ''}</div>
      <button type="button" class="cbtn cbtn--line cbtn--sm" data-rescan>${esc(tx('rescan'))}</button></div>`;
  }

  function optionHtml(q, o, on) {
    return `<button type="button" data-qo="${esc(q.id)}" data-k="${esc(o.k)}" class="${on ? 'is-on' : ''}${q.style === 'rating' ? ' r-' + esc(o.s ?? o.k) : ''}">${esc(label(o.l, L))}</button>`;
  }
  function renderQ() {
    const box = $('[data-q]');
    box.innerHTML = tpl.questions.filter((q) => visible(q, lead.answers)).map((q) => {
      const a = lead.answers[q.id];
      const lab = `<span class="cq__l">${esc(label(q.label, L))}</span>`;
      if (q.options) {
        const on = (k) => (Array.isArray(a) ? a.includes(k) : a === k);
        return `<div class="cq${q.style === 'rating' ? ' cq--rating' : ''}" data-qid="${esc(q.id)}">${lab}<div class="cq__opts">${q.options.map((o) => optionHtml(q, o, on(o.k))).join('')}</div></div>`;
      }
      if (q.type === 'textarea') return `<label class="cq">${lab}<textarea data-qt="${esc(q.id)}" rows="3">${esc(a || '')}</textarea></label>`;
      return `<label class="cq">${lab}<input data-qt="${esc(q.id)}" value="${esc(a || '')}" ${q.input === 'numeric' ? 'inputmode="numeric"' : ''}></label>`;
    }).join('');
  }

  async function showPhoto() {
    const img = $('[data-thumb]');
    if (!img) return;
    if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = null; }
    const blob = lead.photo ? await photos.get(lead.photo) : null;
    if (blob) { photoUrl = URL.createObjectURL(blob); img.src = photoUrl; img.hidden = false; } else img.hidden = true;
  }

  function apply(fields, { force = false } = {}) {
    for (const k of FIELDS) {
      const v = fields[k];
      if (!v) continue;
      if (lead[k] && !auto.has(k) && !force) continue;
      lead[k] = v; auto.add(k);
      const inp = $(`input[name="${k}"]`);
      if (inp) { inp.value = v; inp.closest('.cf')?.classList.add('is-auto'); }
    }
    if (fields.salutation && !lead.salutation) lead.salutation = fields.salutation;
    if (fields.state) lead.state = fields.state;
    if (lead.street || lead.city || lead.website) $('[data-addr]')?.setAttribute('open', '');
    checkDupe();
  }

  async function doScan() {
    const text = await scan(document.body, { title: tx('scanTitle'), hint: tx('scanHint'), cancel: tx('cancel'), manual: tx('manual'), noCamera: tx('noCam') });
    if (!text) return false;
    lead.badge = text; lead.source = 'badge';
    const p = parseBadge(text);
    apply(p.fields);
    $$('[data-src]').forEach((b) => b.classList.toggle('is-on', b.dataset.src === 'badge'));
    renderBadge();
    return true;
  }

  let dupeT = null;
  function checkDupe() {
    clearTimeout(dupeT);
    dupeT = setTimeout(async () => {
      const box = $('[data-dupe]');
      if (!box) return;
      const mail = (lead.email || '').trim().toLowerCase();
      const badge = lead.badge;
      if (!mail && !badge) { box.innerHTML = ''; return; }
      const same = (await allLeads()).find((x) => x.id !== lead.id && ((mail && x.email?.toLowerCase() === mail) || (badge && x.badge === badge)));
      box.innerHTML = same ? `<div class="cap__dupe"><span>${esc(tx('dupe', { who: [same.first, same.last].filter(Boolean).join(' ') || same.email || same.company,
        time: new Date(same.created).toLocaleTimeString(L, { hour: '2-digit', minute: '2-digit' }) + (same.staff ? ` ${tx('from')} ${same.staff}` : '') }))}</span>
        <button type="button" class="cbtn cbtn--sm cbtn--line" data-open="${esc(same.id)}">${esc(tx('dupeOpen'))}</button></div>` : '';
    }, 250);
  }

  async function takePhoto(file) {
    if (!file) return;
    try {
      let bmp;
      try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bmp = await createImageBitmap(file); }
      const sc = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
      const id = lead.photo || 'p-' + uid();
      if (await photos.put(id, blob)) lead.photo = id;
      $('[data-photo-label]').textContent = tx('photoAgain');
      $('[data-photo-del]').hidden = false;
      showPhoto();
    } catch (e) { console.warn(e); }
  }

  // Visitenkarte: Foto sofort als Nachweis speichern, dann Text auf dem Gerät erkennen und die Felder füllen
  async function scanCard(file) {
    if (!file) return;
    if (lead.source !== 'badge') lead.source = 'visitenkarte';
    $('[data-cardsec]').hidden = false;
    const msg = $('[data-cardmsg]'), bar = $('[data-cardbar]');
    msg.textContent = tx('reading', { p: 0 }); bar.hidden = false; bar.firstElementChild.style.width = '0%';
    el.classList.add('is-reading');
    await takePhoto(file);
    try {
      const res = await readCard(file, { lang: L, onProgress: (p) => { msg.textContent = tx('reading', { p: Math.round(p * 100) }); bar.firstElementChild.style.width = p * 100 + '%'; } });
      lead.card = res.text;
      $('textarea[name="card"]').value = res.text;
      apply(parseCard(res.text, res.alt));     // zweite Lesung (anderer Ausschnitt) füllt Lücken
      const got = FIELDS.filter((k) => auto.has(k)).length;
      // wenig erkannt: meist unscharf, Spiegelung oder Karte zu klein im Bild → nochmal fotografieren
      const key = !got ? 'readNone' : got < 4 ? 'readFew' : 'readOk';
      msg.textContent = tx(key, { n: got });
      msg.classList.toggle('is-warn', key !== 'readOk');
      if (key === 'readOk') { beep(true); toast(tx('readOk', { n: got })); } else toast(tx(key, { n: got }), true);
    } catch (e) {
      console.warn(e);
      msg.textContent = tx('readNone'); msg.classList.add('is-warn');
    } finally {
      bar.hidden = true;
      el.classList.remove('is-reading');
    }
  }
  function zoom() {
    const img = $('[data-thumb]');
    if (img && !img.hidden) lightbox(img.src);
  }
  const cardInput = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', hidden: true });
  cardInput.setAttribute('capture', 'environment');
  cardInput.addEventListener('change', () => { const f = cardInput.files?.[0]; cardInput.value = ''; scanCard(f); });
  const openCardCamera = () => { warmUp(L); cardInput.click(); };

  function close() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    el.remove();
    ctx.onClose?.();
  }

  async function save(next) {
    for (const inp of $$('input[name], textarea[name]')) if (inp.name in lead) lead[inp.name] = inp.value.trim();
    lead.email = lead.email.replace(/\s+/g, '');
    if (!lead.first && !lead.last && !lead.company && !lead.email && !lead.badge) { toast(tx('need'), true); return; }
    if (askStaff && !lead.staff) { toast(tx('needStaff'), true); $('input[name="staff"]').focus(); return; }
    if (lead.email && !isMail(lead.email)) { toast(tx('badMail'), true); $('input[name="email"]').focus(); return; }
    if (!lead.email && !confirm(tx('noMail'))) return;
    lead.consentText = lead.consent ? tx('consent', { company: ctx.company || 'ZOLLER' }) : '';
    if (askStaff) ctx.onStaff?.(lead.staff);
    const saved = await saveLead(lead);
    beep(true);
    toast(tx('saved'));
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    el.remove();
    ctx.onSaved?.(saved, next);
  }

  function toast(msg, bad) {
    let t = document.querySelector('.ctoast');
    if (!t) { t = document.createElement('div'); t.className = 'ctoast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle('is-bad', !!bad); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, bad ? 3600 : 2400);
  }

  render();
  el.appendChild(cardInput);      // nach render(): render() ersetzt den Inhalt von el
  // Eingaben
  el.addEventListener('input', (e) => {
    const n = e.target.name;
    if (n === 'card') {
      lead.card = e.target.value;
      clearTimeout(el.cardT);
      el.cardT = setTimeout(() => apply(parseCard(lead.card)), 250);
    } else if (n && n in lead) {
      lead[n] = e.target.value; auto.delete(n); e.target.closest('.cf')?.classList.remove('is-auto');
      if (n === 'email') checkDupe();
    } else if (e.target.dataset.qt) lead.answers[e.target.dataset.qt] = e.target.value;
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button, [data-x]');
    if (!b) return;
    const d = b.dataset;
    if ('x' in d) return close();
    if (d.src) {
      lead.source = d.src;
      $$('[data-src]').forEach((x) => x.classList.toggle('is-on', x === b));
      if (d.src === 'badge') { await doScan(); return; }
      $('[data-cardsec]').hidden = d.src !== 'visitenkarte' && !lead.card && !lead.photo;
      if (d.src === 'visitenkarte') { openCardCamera(); $('[data-cardsec]').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      else $('input[name="first"]').focus();
      return;
    }
    if ('cardshot' in d) { openCardCamera(); return; }
    if ('zoom' in d) { zoom(); return; }
    if ('rescan' in d) { await doScan(); return; }
    if (d.part) {
      // gelesenes Stück in das nächste leere Feld (Vorname → Nachname → Firma …)
      const k = ['first', 'last', 'company', 'title', 'city'].find((f) => !lead[f]);
      if (k) apply({ [k]: d.part }, { force: true });
      b.remove();
      return;
    }
    if (d.qo) {
      const q = tpl.questions.find((x) => x.id === d.qo);
      const cur = lead.answers[q.id];
      if (q.type === 'multi') {
        const arr = Array.isArray(cur) ? [...cur] : [];
        const i = arr.indexOf(d.k);
        if (i >= 0) arr.splice(i, 1); else arr.push(d.k);
        lead.answers[q.id] = arr;
      } else lead.answers[q.id] = cur === d.k ? '' : d.k;
      const y = window.scrollY, box = $('.cap__body'), top = box.scrollTop;
      renderQ();
      box.scrollTop = top; window.scrollTo(0, y);
      return;
    }
    if (d.check) { lead[d.check] = !lead[d.check]; b.classList.toggle('is-on', lead[d.check]); return; }
    if (d.photoDel !== undefined && 'photoDel' in d) { if (lead.photo) await photos.del(lead.photo); lead.photo = ''; b.hidden = true; $('[data-photo-label]').textContent = tx('photo'); showPhoto(); return; }
    if (d.open) {
      const other = (await allLeads()).find((x) => x.id === d.open);
      if (other) { el.remove(); openCapture(host, { ...ctx, lead: other }); }
      return;
    }
    if ('del' in d) {
      if (!confirm(tx('delQ'))) return;
      await deleteLead(lead);
      el.remove();
      ctx.onSaved?.(null);
      return;
    }
    if (d.save) await save(d.save === 'next');
  });
  el.addEventListener('focusin', (e) => { if (e.target.matches('input, textarea')) setTimeout(() => e.target.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 280); });
  if (!editing && ctx.source === 'badge') {
    const ok = await doScan();
    if (!ok) { lead.source = 'manuell'; $$('[data-src]').forEach((x) => x.classList.toggle('is-on', x.dataset.src === 'manuell')); }
  } else if (!editing && ctx.source === 'visitenkarte') {
    $('[data-src="visitenkarte"]')?.click();
  }
  return el;
}
