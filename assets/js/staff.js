// Personalbereich (Logo 2 Sekunden gedrückt halten + PIN): Einrichtung, Leads (Erfassung + automatische HubSpot-Übertragung statt
// Captello/snapADDY), Handys koppeln, App sperren, Offline, Statistik, Hilfe.
// Oberfläche Deutsch, für alle anderen Startsprachen Englisch (das Standpersonal ist international).
import { stats, clearStats, sha256, saveSettings } from './store.js';
import { offlineStatus, downloadMedia, storageInfo, persist, mb, swFiles, abs } from './media.js';
import { allLeads, saveLead, deleteLead, setStd, counts, csvRows, csv, shareFile, fileTag, syncNow, onChange, hubspotConfig, pairCode,
  templates, label, RATINGS } from './leads.js';
import { openCapture, showPhoto } from './capture.js';
import { qrSvg } from './qr.js';
import { textIn, prodId, selectedMedia, settings as catalogSettings } from './catalog.js';

const TX = {
  de: {
    title: 'Personalbereich', close: 'Zurück zur Messe-App', start: 'Messe-App starten', 'pin.set': 'PIN für den Personalbereich festlegen',
    'pin.again': 'PIN wiederholen', 'pin.enter': 'PIN eingeben', 'pin.wrong': 'Falsche PIN', 'pin.mismatch': 'Die PINs stimmen nicht überein',
    'pin.hint': '6 bis 8 Ziffern. Öffnen: ZOLLER-Logo 2 Sekunden gedrückt halten. Nach 5 falschen Versuchen sperrt die App kurz.', cancel: 'Abbrechen', del: 'Löschen',
    'tab.today': 'Übersicht', 'tab.show': 'Auswahl', 'tab.leads': 'Leads', 'tab.setup': 'Einrichtung', 'tab.offline': 'Offline', 'tab.help': 'Hilfe',
    welcome: 'Willkommen! Richten Sie die Messe-App einmal ein: Veranstaltung, Stand, Sprache – dann alles offline laden.',
    'k.sessions': 'Besuche', 'k.leads': 'Leads', 'k.qr': 'QR-Codes gezeigt', 'k.film': 'Filme gestartet', 'k.calc': 'Rechner genutzt', 'k.planer': 'Planer geöffnet',
    'k.today': 'Heute', 'k.all': 'Ganze Messe', 'b.device': 'Meistgesehene Geräte', 'b.film': 'Filme', 'b.lang': 'Sprachen', 'b.saved': 'Gemerkt',
    'stats.export': 'Statistik exportieren', 'stats.reset': 'Statistik zurücksetzen', 'stats.reset.q': 'Statistik wirklich löschen?',
    'l.none': 'Noch keine Leads.', 'l.csv': 'CSV für HubSpot', 'l.xls': 'CSV für Excel', 'l.hs': 'An HubSpot senden', 'l.hs.off': 'HubSpot ist nicht eingerichtet (Einrichtung → HubSpot).',
    'l.hs.done': '{n} übertragen', 'l.hs.fail': '{n} fehlgeschlagen', 'l.hs.nomail': 'ohne E-Mail nicht übertragbar', 'l.del.q': 'Diesen Lead löschen?',
    'l.delall': 'Übertragene/exportierte löschen', 'l.delall.q': 'Alle bereits exportierten oder übertragenen Leads vom iPad löschen?', 'l.note': 'Notiz des Standpersonals',
    'l.exported': 'exportiert', 'l.plan': 'Werkzeugraum-Planung', 'l.synced': 'in HubSpot', 'r.hot': 'heiß', 'r.warm': 'warm', 'r.cold': 'kalt',
    's.event': 'Veranstaltung', 's.event.custom': 'Eigene Veranstaltung …', 's.event.title': 'Name der Veranstaltung', 's.event.city': 'Ort',
    's.booth': 'Halle / Stand', 's.kiosk': 'Name dieses iPads', 's.site': 'Ausstellende ZOLLER-Gesellschaft', 's.lang': 'Startsprache',
    's.idle': 'Rückfrage nach … Sekunden ohne Berührung', 's.attract': 'Filme in der Dauerschleife', 's.captions': 'Untertitel in der Dauerschleife',
    's.live': 'Geräte live am Stand', 's.live.p': 'Antippen = am Stand. Optional ein Ort, z. B. »Bereich B«.', 's.live.loc': 'Ort am Stand',
    's.rate': 'Maschinenstundensatz im Rechner (leer = Standard)', 's.hs': 'HubSpot (Formular-Übertragung)',
    's.hs.p': 'Leads gehen über das HubSpot-Formular »ZOLLER Messe – Leads« (eingerichtet mit tools/hubspot_messe.py). Ein anderes Formular nur eintragen, wenn ZOLLER-Marketing es so will – es braucht dieselben Felder.',
    's.hs.portal': 'Portal-ID', 's.hs.form': 'Formular-GUID', 's.hs.host': 'API-Host', 's.pin': 'PIN ändern', 's.on': 'an', 's.off': 'aus',
    'o.version': 'Version', 'o.core': 'App, Planer, 3D-Modelle', 'o.media': 'Filme und AR', 'o.ready': 'offline bereit', 'o.missing': '{n} Dateien fehlen ({mb})',
    'o.load': 'Alles offline laden', 'o.loading': 'Lädt … {a} von {b}', 'o.done': 'Alles geladen – die Messe-App läuft jetzt ohne Internet.',
    'o.nosw': 'Offline-Speicher noch nicht aktiv. Seite einmal neu laden (mit Internet).', 'o.storage': 'Speicher', 'o.persist': 'Speicher dauerhaft sichern',
    'o.persisted': 'dauerhaft gesichert', 'o.notpersisted': 'nicht dauerhaft (iPad darf bei Platzmangel löschen)', 'o.update': 'Nach Update suchen',
    'o.upd.none': 'Die App ist aktuell.', 'o.upd.ready': 'Update geladen – wird beim nächsten Neustart der Sitzung eingespielt.', 'o.upd.now': 'Jetzt einspielen',
    'o.standalone': 'Die App läuft im Browser. Für den Messestand: Teilen → »Zum Home-Bildschirm«, dann von dort öffnen und hier »Alles offline laden«.',
    'o.standalone.ok': 'Läuft als App vom Home-Bildschirm.', 'o.reload': 'App neu laden',
    'h.ga': 'iPad sperren (Geführter Zugriff)', 'h.prep': 'Vor der Messe', 'h.daily': 'Jeden Messetag', 'h.after': 'Nach der Messe', 'h.leads': 'Leads (statt Captello/snapADDY)',
    'pin.wait': 'Zu viele Versuche – bitte {n} s warten', 'pin.short': 'Mindestens 6 Ziffern', 'l.new': '+ Lead erfassen', 'l.edit': 'Bearbeiten', 'l.photo': 'Foto der Karte',
    'l.send': 'Jetzt senden', 'l.state.gesendet': 'in HubSpot', 'l.state.wartet': 'wartet', 'l.state.neu': 'wartet', 'l.state.fehler': 'abgelehnt',
    'l.state.unvollstaendig': 'ohne E-Mail', 'l.sum': '{all} Leads · {sent} in HubSpot · {open} warten · {bad} abgelehnt · {mail} ohne E-Mail',
    'l.hs.sandbox': 'HubSpot-TESTKONTO (Sandbox): Leads landen nicht im echten HubSpot.', 'l.hs.live': 'Leads gehen von selbst an HubSpot (Portal {p}), sobald Netz da ist.',
    'l.hs.none': 'Kein HubSpot-Formular eingebaut – Leads bleiben auf dem iPad (CSV-Export).', 'l.by': 'von', 'r.heiss': 'heiß', 'r.hoch': 'hoch', 'r.mittel': 'mittel', 'r.niedrig': 'niedrig',
    's.form': 'Fragebogen für die Leaderfassung', 's.pair': 'Handys des Standpersonals verbinden',
    's.pair.p': 'Mit der Kamera-App des Handys scannen → »ZOLLER Leads« öffnet sich mit dieser Messe. Dann Teilen → »Zum Home-Bildschirm«. Oder in »ZOLLER Leads« unter Einrichtung »Vom Kiosk-iPad übernehmen« tippen und diesen Code scannen.',
    's.hs.builtin': 'Eingebaut: Formular »ZOLLER Messe – Leads« · Portal {p}', 's.hs.expert': 'Anderes HubSpot-Formular (nur für Experten)', 's.lock': 'App sperren',
    's.lock.p': 'Zeigt »Bitte wenden Sie sich an unser Standpersonal« – z. B. in der Pause oder über Nacht. Entsperren: ZOLLER-Logo 2 s halten + PIN.',
    'w.h': 'Was zeigt die Messe-App?', 'w.p': 'Produkte und Filme für diese Messe auswählen. Besucher sehen nur die Auswahl, »Offline« lädt nur, was ausgewählt ist. Live = steht am Stand (grüner Punkt, eigene Reihe auf der Startseite).',
    'w.prod': 'Produkte', 'w.films': 'Filme', 'w.live': 'live am Stand', 'w.mb': 'offline nötig', 'w.all': 'Alle Produkte', 'w.liveonly': 'Nur was am Stand steht',
    'w.none': 'Keine Produkte', 'w.on': 'Alle', 'w.off': 'Keine', 'w.liveBtn': 'Live', 'w.loc.h': 'Live am Stand – Ort (optional)',
    'w.loc.p': 'Erscheint auf der Produktseite und in der Dauerschleife, z. B. »Bereich B« oder »Halle 5, vorne«.', 'w.nolive': 'Noch nichts als live markiert.',
    'w.films.p': 'In der App = Besucher können den Film ansehen. Schleife = läuft in der Dauerschleife, solange niemand das iPad benutzt.',
    'w.inapp': 'In der App', 'w.loop': 'Schleife', 'w.nolive.q': 'Erst Geräte als »Live« markieren.', 'w.next': 'Weiter: Produkte und Filme auswählen',
    'o.media.sel': 'Filme, Bilder, 3D (Auswahl)',
  },
  en: {
    'w.h': 'What does the app show?', 'w.p': 'Choose products and films for this show. Visitors only see the selection, “Offline” only loads what is selected. Live = on the booth (green dot, own row on the start page).',
    'w.prod': 'Products', 'w.films': 'Films', 'w.live': 'live at the booth', 'w.mb': 'needed offline', 'w.all': 'All products', 'w.liveonly': 'Only what is on the booth',
    'w.none': 'No products', 'w.on': 'All', 'w.off': 'None', 'w.liveBtn': 'Live', 'w.loc.h': 'Live at the booth – location (optional)',
    'w.loc.p': 'Shown on the product page and in the loop, e.g. “Area B” or “Hall 5, front”.', 'w.nolive': 'Nothing marked as live yet.',
    'w.films.p': 'In the app = visitors can watch the film. Loop = plays in the attract loop while nobody uses the iPad.',
    'w.inapp': 'In the app', 'w.loop': 'Loop', 'w.nolive.q': 'Mark devices as “Live” first.', 'w.next': 'Next: choose products and films',
    'o.media.sel': 'Films, images, 3D (selection)',
    title: 'Staff area', close: 'Back to the trade show app', start: 'Start the trade show app', 'pin.set': 'Set a PIN for the staff area',
    'pin.again': 'Repeat PIN', 'pin.enter': 'Enter PIN', 'pin.wrong': 'Wrong PIN', 'pin.mismatch': 'The PINs do not match',
    'pin.hint': '6 to 8 digits. To open: press and hold the ZOLLER logo for 2 seconds. After 5 wrong attempts the app pauses.', cancel: 'Cancel', del: 'Delete',
    'tab.today': 'Overview', 'tab.show': 'Selection', 'tab.leads': 'Leads', 'tab.setup': 'Setup', 'tab.offline': 'Offline', 'tab.help': 'Help',
    welcome: 'Welcome! Set up the trade show app once: event, booth, language – then download everything for offline use.',
    'k.sessions': 'Visits', 'k.leads': 'Leads', 'k.qr': 'QR codes shown', 'k.film': 'Films started', 'k.calc': 'Calculator used', 'k.planer': 'Planner opened',
    'k.today': 'Today', 'k.all': 'Whole show', 'b.device': 'Most viewed devices', 'b.film': 'Films', 'b.lang': 'Languages', 'b.saved': 'Saved',
    'stats.export': 'Export statistics', 'stats.reset': 'Reset statistics', 'stats.reset.q': 'Really delete the statistics?',
    'l.none': 'No leads yet.', 'l.csv': 'CSV for HubSpot', 'l.xls': 'CSV for Excel', 'l.hs': 'Send to HubSpot', 'l.hs.off': 'HubSpot is not set up (Setup → HubSpot).',
    'l.hs.done': '{n} sent', 'l.hs.fail': '{n} failed', 'l.hs.nomail': 'cannot be sent without an e-mail', 'l.del.q': 'Delete this lead?',
    'l.delall': 'Delete sent/exported', 'l.delall.q': 'Delete all leads that were already exported or sent from this iPad?', 'l.note': 'Staff note',
    'l.exported': 'exported', 'l.plan': 'Toolroom plan', 'l.synced': 'in HubSpot', 'r.hot': 'hot', 'r.warm': 'warm', 'r.cold': 'cold',
    's.event': 'Event', 's.event.custom': 'Other event …', 's.event.title': 'Event name', 's.event.city': 'City',
    's.booth': 'Hall / booth', 's.kiosk': 'Name of this iPad', 's.site': 'Exhibiting ZOLLER company', 's.lang': 'Start language',
    's.idle': 'Ask after … seconds without touch', 's.attract': 'Films in the loop', 's.captions': 'Subtitles in the loop',
    's.live': 'Devices live at the booth', 's.live.p': 'Tap = at the booth. Optionally a location, e.g. “Area B”.', 's.live.loc': 'Location at the booth',
    's.rate': 'Machine hourly rate in the calculator (empty = default)', 's.hs': 'HubSpot (form submission)',
    's.hs.p': 'Leads go through the HubSpot form “ZOLLER Messe – Leads” (set up with tools/hubspot_messe.py). Only enter a different form if ZOLLER marketing wants it – it needs the same fields.',
    's.hs.portal': 'Portal ID', 's.hs.form': 'Form GUID', 's.hs.host': 'API host', 's.pin': 'Change PIN', 's.on': 'on', 's.off': 'off',
    'o.version': 'Version', 'o.core': 'App, planner, 3D models', 'o.media': 'Films and AR', 'o.ready': 'ready offline', 'o.missing': '{n} files missing ({mb})',
    'o.load': 'Download everything', 'o.loading': 'Loading … {a} of {b}', 'o.done': 'Everything downloaded – the app now runs without internet.',
    'o.nosw': 'Offline storage not active yet. Reload the page once (with internet).', 'o.storage': 'Storage', 'o.persist': 'Make storage persistent',
    'o.persisted': 'persistent', 'o.notpersisted': 'not persistent (iPad may clear it when space runs low)', 'o.update': 'Check for update',
    'o.upd.none': 'The app is up to date.', 'o.upd.ready': 'Update downloaded – it will be applied when the next session ends.', 'o.upd.now': 'Apply now',
    'o.standalone': 'The app is running in the browser. For the booth: Share → “Add to Home Screen”, open it from there and tap “Download everything” here.',
    'o.standalone.ok': 'Running as an app from the home screen.', 'o.reload': 'Reload app',
    'h.ga': 'Lock the iPad (Guided Access)', 'h.prep': 'Before the show', 'h.daily': 'Every show day', 'h.after': 'After the show', 'h.leads': 'Leads (instead of Captello/snapADDY)',
    'pin.wait': 'Too many attempts – please wait {n} s', 'pin.short': 'At least 6 digits', 'l.new': '+ Capture lead', 'l.edit': 'Edit', 'l.photo': 'Card photo',
    'l.send': 'Send now', 'l.state.gesendet': 'in HubSpot', 'l.state.wartet': 'waiting', 'l.state.neu': 'waiting', 'l.state.fehler': 'rejected',
    'l.state.unvollstaendig': 'no e-mail', 'l.sum': '{all} leads · {sent} in HubSpot · {open} waiting · {bad} rejected · {mail} without e-mail',
    'l.hs.sandbox': 'HubSpot TEST account (sandbox): leads do not reach the real HubSpot.', 'l.hs.live': 'Leads go to HubSpot (portal {p}) by themselves as soon as there is a connection.',
    'l.hs.none': 'No HubSpot form built in – leads stay on the iPad (CSV export).', 'l.by': 'by', 'r.heiss': 'hot', 'r.hoch': 'high', 'r.mittel': 'medium', 'r.niedrig': 'low',
    's.form': 'Questionnaire for lead capture', 's.pair': 'Connect booth staff phones',
    's.pair.p': 'Scan with the phone’s camera app → “ZOLLER Leads” opens with this event. Then Share → “Add to Home Screen”. Or in “ZOLLER Leads” tap Setup → “Take over from the kiosk iPad” and scan this code.',
    's.hs.builtin': 'Built in: form “ZOLLER Messe – Leads” · portal {p}', 's.hs.expert': 'Different HubSpot form (experts only)', 's.lock': 'Lock app',
    's.lock.p': 'Shows “Please ask our booth staff” – e.g. during breaks or overnight. To unlock: hold the ZOLLER logo for 2 s + PIN.',
  },
};
const HELP = {
  de: {
    ga: ['Einstellungen → Bedienungshilfen → Geführter Zugriff: einschalten, Code festlegen (nicht die Personal-PIN), Face ID/Touch ID für das Beenden darf an sein.',
      'Einstellungen → Bedienungshilfen → Kurzbefehl: nur »Geführter Zugriff«.', 'Messe-App vom Home-Bildschirm öffnen.',
      'Seitentaste (oder Home-Taste) dreimal drücken → Optionen: Seitentaste AUS, Lautstärketasten AUS, Tastatur AN, Berührung AN → »Starten«.',
      'Jetzt kommt niemand aus der App: kein Home, keine Mitteilungen, kein Kontrollzentrum, keine anderen Apps.', 'Beenden: wieder dreimal drücken, Code eingeben.'],
    prep: ['In Safari öffnen → Teilen → »Zum Home-Bildschirm«. Ab jetzt nur noch dieses Symbol benutzen.', 'Personalbereich: Veranstaltung, Stand, Sprache, Fragebogen, Geräte am Stand einstellen.',
      'Auswahl → Produkte, Filme und Live-Geräte für diese Messe festlegen.', 'Offline → »Alles offline laden« (mit WLAN; lädt nur die Auswahl, alles zusammen ca. 120 MB). Danach einmal im Flugmodus testen.', 'Einstellungen → Anzeige & Helligkeit → Automatische Sperre: »Nie«. Ton für Filme passend einstellen.',
      'Einrichtung → »Handys des Standpersonals verbinden«: jeder scannt den Code und legt »ZOLLER Leads« auf den Home-Bildschirm.'],
    leads: ['Besucher tragen sich am iPad selbst ein (Kontakt) oder über die Messe-Mappe am Handy.', 'Das Standpersonal erfasst mit »ZOLLER Leads« am eigenen Handy oder hier mit »+ Lead erfassen«: Badge scannen, Visitenkarte (»Text scannen«) oder von Hand, dann Fragebogen.',
      'Alles geht von selbst an HubSpot, sobald Netz da ist – auch Stunden später. Ohne Netz wird nichts verloren.', 'Leads ohne E-Mail kann HubSpot nicht annehmen: E-Mail ergänzen oder per CSV weitergeben.'],
    daily: ['iPad am Ladekabel lassen. Morgens kurz prüfen: Dauerschleife läuft, Ton passt, Leads oben »in HubSpot«.', 'Pause/abends: »App sperren« oder Geführten Zugriff anlassen.'],
    after: ['Leads: alles »in HubSpot«? Abgelehnte prüfen und erneut senden, dann »Übertragene/exportierte löschen«.', 'Statistik exportieren für den Messebericht.'],
  },
  en: {
    ga: ['Settings → Accessibility → Guided Access: turn on, set a passcode (not the staff PIN); Face ID/Touch ID for ending may stay on.',
      'Settings → Accessibility → Accessibility Shortcut: only “Guided Access”.', 'Open the trade show app from the home screen.',
      'Triple-click the side (or home) button → Options: side button OFF, volume buttons OFF, keyboard ON, touch ON → “Start”.',
      'Now nobody can leave the app: no home, no notifications, no Control Center, no other apps.', 'To end: triple-click again and enter the passcode.'],
    prep: ['Open in Safari → Share → “Add to Home Screen”. From now on only use this icon.', 'Staff area: set event, booth, language, questionnaire and devices at the booth.',
      'Selection → choose products, films and live devices for this show.', 'Offline → “Download everything” (Wi-Fi; loads only the selection, everything together approx. 120 MB). Then test once in airplane mode.', 'Settings → Display & Brightness → Auto-Lock: “Never”. Set the volume for films.',
      'Setup → “Connect booth staff phones”: everyone scans the code and adds “ZOLLER Leads” to the home screen.'],
    leads: ['Visitors enter their details on the iPad (Contact) or via the show folder on their phone.', 'Booth staff capture with “ZOLLER Leads” on their own phone or here with “+ Capture lead”: scan badge, business card (“Scan Text”) or manual, then the questionnaire.',
      'Everything goes to HubSpot by itself as soon as there is a connection – even hours later. Nothing is lost offline.', 'HubSpot cannot accept leads without an e-mail: add it or pass them on via CSV.'],
    daily: ['Keep the iPad on the charger. Each morning check: loop is running, sound is right, leads show “in HubSpot”.', 'Breaks/evening: “Lock app” or keep Guided Access on.'],
    after: ['Leads: all “in HubSpot”? Check rejected ones and send again, then “Delete sent/exported”.', 'Export the statistics for the show report.'],
  },
};

let C = null, L = 'de', root = null, tab = 'today', allDays = false, changed = false, openFlag = false, offSync = null;
const tx = (k, v) => { let s = (TX[L] || TX.en)[k] ?? TX.de[k] ?? k; if (v) s = s.replace(/\{(\w+)\}/g, (m, x) => v[x] ?? m); return s; };
const $ = (s, r = root) => r.querySelector(s);
const $$ = (s, r = root) => [...r.querySelectorAll(s)];
export const isOpen = () => openFlag;

export async function openStaff(ctx) {
  C = ctx;
  L = C.settings.lang === 'de' ? 'de' : 'en';
  root = document.querySelector('[data-staff]');
  changed = false;
  if (!C.settings.pin) {
    const pin = await askPin(tx('pin.set'), true, !!C.settings.setup);
    if (!pin) return;
    C.save({ ...C.settings, pin: await makePin(pin), pinLen: pin.length });
  } else if (!ctx.setup) {
    const pin = await askPin(tx('pin.enter'));
    if (!pin) return;
  }
  tab = C.settings.setup ? 'today' : 'setup';
  openFlag = true;
  root.hidden = false;
  offSync = onChange(() => { if (openFlag && tab === 'leads' && !root.querySelector('.cap')) render(); });
  render();
}

/** Gesperrte App (»App sperren«) mit der Personal-PIN entsperren */
export async function unlock(ctx) {
  C = ctx;
  L = C.settings.lang === 'de' ? 'de' : 'en';
  return !!(await askPin(tx('pin.enter')));
}

function close() {
  openFlag = false;
  offSync?.();
  root.hidden = true;
  root.innerHTML = '';
  C.onClose(changed);
}

// ------------------------------------------------------------------ PIN (PBKDF2 mit Salz, kurze Sperre nach 5 Fehlversuchen)
const FAIL = 'zm.pinfail';
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function pinHash(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('zoller-messe:' + salt), iterations: 150000 }, key, 256));
}
async function makePin(pin) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(12)));
  return `p2$${salt}$${await pinHash(pin, salt)}`;
}
async function pinOk(pin, stored) {
  if (!stored) return false;
  if (stored.startsWith('p2$')) { const [, salt, h] = stored.split('$'); return (await pinHash(pin, salt)) === h; }
  return (await sha256(pin)) === stored;       // PIN aus der ersten Fassung (4–6 Ziffern, SHA-256)
}
const fails = () => { try { return JSON.parse(localStorage.getItem(FAIL) || '{"n":0,"until":0}'); } catch { return { n: 0, until: 0 }; } };
const setFails = (f) => { try { localStorage.setItem(FAIL, JSON.stringify(f)); } catch { /* egal */ } };

function askPin(title, create = false, cancel = true) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'pin';
    let val = '', first = null, busy = false, waitT = null;
    const max = create ? 8 : (C.settings.pinLen || 6);
    const draw = (msg, bad) => {
      el.innerHTML = `<div class="pin__panel">
        <img src="assets/img/zoller.svg" alt="" style="width:160px">
        <h2>${C.esc(msg)}</h2>
        <div class="pin__dots${bad ? ' is-bad' : ''}">${Array.from({ length: Math.max(create ? 6 : max, val.length) }, (_, i) => `<i class="${i < val.length ? 'is-on' : ''}"></i>`).join('')}</div>
        <div class="pin__pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
          ${cancel ? `<button class="ghost" data-k="x">${C.esc(tx('cancel'))}</button>` : '<span></span>'}<button data-k="0">0</button><button class="ghost" data-k="b">⌫</button></div>
        ${create ? `<p class="muted" style="max-width:340px;text-align:center;font-size:.9rem;line-height:1.4">${C.esc(tx('pin.hint'))}</p>` : ''}
      </div>`;
    };
    const done = (v) => { clearInterval(waitT); el.remove(); resolve(v); };
    let msg = title;
    // gesperrt nach zu vielen Fehlversuchen: Countdown, keine Eingabe
    const locked = () => {
      const f = fails();
      const left = Math.ceil((f.until - Date.now()) / 1000);
      if (left <= 0) return false;
      draw(tx('pin.wait', { n: left }), true);
      clearInterval(waitT);
      waitT = setInterval(() => { const l2 = Math.ceil((fails().until - Date.now()) / 1000); if (l2 <= 0) { clearInterval(waitT); val = ''; draw(msg); } else draw(tx('pin.wait', { n: l2 }), true); }, 1000);
      return true;
    };
    if (!create && locked()) { /* Countdown läuft */ } else draw(msg);
    el.addEventListener('click', async (e) => {
      const k = e.target.closest('[data-k]')?.dataset.k;
      if (!k || busy) return;
      if (k === 'x') return done(null);
      if (!create && locked()) return;
      if (k === 'b') val = val.slice(0, -1);
      else if (val.length < max) val += k;
      draw(msg);
      if (create) {
        clearTimeout(el.t);
        if (val.length >= 6 && first === null) {
          // nach 6–8 Ziffern und kurzer Pause (oder bei 8 Ziffern sofort) bestätigen lassen
          el.t = setTimeout(() => { first = val; val = ''; msg = tx('pin.again'); draw(msg); }, val.length === 8 ? 150 : 1300);
        } else if (first !== null && val.length === first.length) {
          if (val === first) done(val); else { first = null; val = ''; msg = tx('pin.mismatch'); draw(msg, true); setTimeout(() => { msg = title; draw(msg); }, 1400); }
        }
        return;
      }
      const legacy = !C.settings.pinLen;
      if (val.length < (legacy ? 4 : max)) return;
      busy = true;
      const ok = await pinOk(val, C.settings.pin);
      busy = false;
      if (ok) {
        setFails({ n: 0, until: 0 });
        // alte PIN (SHA-256) beim ersten richtigen Eintippen auf PBKDF2 umstellen
        if (legacy || !C.settings.pin.startsWith('p2$')) C.save({ ...C.settings, pin: await makePin(val), pinLen: val.length });
        done(val);
      } else if (val.length >= max) {
        const f = fails(); f.n += 1;
        if (f.n >= 5) f.until = Date.now() + 30000 * 2 ** (f.n - 5);
        setFails(f);
        val = '';
        if (!locked()) draw(tx('pin.wrong'), true);
      }
    });
    document.body.appendChild(el);
  });
}

// ------------------------------------------------------------------ Rahmen
function render() {
  const S = C.settings;
  root.innerHTML = `<div class="staff__bar">
      <img src="assets/img/zoller.svg" alt="ZOLLER"><h2>${C.esc(tx('title'))} · ${C.esc(S.kiosk || '')}</h2>
      <nav class="staff__tabs">${['today', 'show', 'leads', 'setup', 'offline', 'help'].map((k) => `<button data-tab="${k}" class="${tab === k ? 'is-on' : ''}">${C.esc(tx('tab.' + k))}</button>`).join('')}</nav>
      <button class="btn btn--dark" data-close-staff>${C.esc(S.setup ? tx('close') : tx('start'))}</button>
    </div>
    <div class="staff__body" data-body></div>`;
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
  $('[data-close-staff]').addEventListener('click', () => {
    if (!C.settings.setup) { C.save({ ...C.settings, setup: true }); changed = true; }
    close();
  });
  const body = $('[data-body]');
  ({ today, show, leads: leadsTab, setup, offline, help })[tab](body);
}

// ------------------------------------------------------------------ Übersicht
function sumDays(days) {
  const out = {};
  for (const d of days) for (const [k, v] of Object.entries(d)) {
    if (typeof v === 'number') out[k] = (out[k] || 0) + v;
    else { out[k] = out[k] || {}; for (const [id, n] of Object.entries(v)) out[k][id] = (out[k][id] || 0) + n; }
  }
  return out;
}
function today(body) {
  const all = stats();
  const day = new Date().toLocaleDateString('sv-SE');
  const s = allDays ? sumDays(Object.values(all)) : (all[day] || {});
  const D = C.D, t = C.t;
  const devName = (id) => pName(id);
  const filmName = (id) => t('film.' + id, null, L);
  const langName = (c) => D.langs.find((l) => l.code === c)?.name || c;
  const bars = (title, obj, nameOf) => {
    const rows = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
    const max = rows[0]?.[1] || 1;
    return `<div class="scard"><h3>${C.esc(title)}</h3><div class="bars">${rows.length ? rows.map(([k, n]) => `<div><span>${C.esc(nameOf(k))}</span><i style="width:${Math.max(2, n / max * 100)}%"></i><em>${n}</em></div>`).join('') : '<p>–</p>'}</div></div>`;
  };
  body.innerHTML = `${!C.settings.setup ? `<div class="scard" style="margin-bottom:16px"><p>${C.esc(tx('welcome'))}</p></div>` : ''}
    <div class="row" style="margin-bottom:16px"><div class="seg" style="width:auto"><button data-days="0" class="${allDays ? '' : 'is-on'}">${C.esc(tx('k.today'))}</button><button data-days="1" class="${allDays ? 'is-on' : ''}">${C.esc(tx('k.all'))}</button></div>
      <button class="btn btn--sm" data-stats-csv>${C.esc(tx('stats.export'))}</button></div>
    <div class="kpis" style="margin-bottom:16px">${['sessions', 'leads', 'qr', 'film', 'calc', 'planer'].map((k) => {
      const v = s[k]; const n = typeof v === 'number' ? v : Object.values(v || {}).reduce((a, b) => a + b, 0);
      return `<div class="kpi"><b>${n}</b><span>${C.esc(tx('k.' + k))}</span></div>`;
    }).join('')}</div>
    <div class="staff__grid">${bars(tx('b.device'), s.device, devName)}${bars(tx('b.film'), s.film, filmName)}${bars(tx('b.saved'), s.saved, devName)}${bars(tx('b.lang'), s.lang, langName)}</div>
    <div class="row" style="margin-top:22px"><button class="btn btn--sm" data-stats-reset>${C.esc(tx('stats.reset'))}</button></div>`;
  $$('[data-days]', body).forEach((b) => b.addEventListener('click', () => { allDays = b.dataset.days === '1'; today(body); }));
  $('[data-stats-reset]', body).addEventListener('click', () => { if (confirm(tx('stats.reset.q'))) { clearStats(); today(body); } });
  $('[data-stats-csv]', body).addEventListener('click', () => {
    const rows = [['day', 'kind', 'id', 'count']];
    for (const [d, o] of Object.entries(all)) for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number') rows.push([d, k, '', v]); else for (const [id, n] of Object.entries(v)) rows.push([d, k, id, n]);
    }
    shareFile(`ZOLLER-Messe-Statistik-${fileTag()}.csv`, csv(rows, ';'), 'text/csv');
  });
}

// ------------------------------------------------------------------ Leads
const plain = (s) => String(s || '').replace(/[»«]/g, '');
const pName = (id) => plain(textIn(L).products?.[prodId(id)]?.name || id);
const devName = pName;

function captureCtx(extra) {
  const S = C.settings;
  return {
    lang: L, company: C.D.sites[S.site]?.company || 'ZOLLER',
    setup: { staff: S.staffName || '', device: S.kiosk || 'iPad', event: S.event, booth: S.booth, site: S.site, form: S.form },
    askStaff: true,   // das Kiosk-iPad teilen sich mehrere: wer erfasst, steht in HubSpot unter »Erfasst von«
    onStaff: (name) => { if (name !== C.settings.staffName) C.save({ ...C.settings, staffName: name }); },
    onSaved: () => render(), onClose: () => render(), ...extra,
  };
}

async function leadsTab(body) {
  const list = await allLeads();
  const cfg = hubspotConfig(C.settings.hubspot);
  const c = counts(list);
  const loc = L === 'de' ? 'de-DE' : 'en-GB';
  body.innerHTML = `<div class="row" style="margin-bottom:12px">
      <button class="btn btn--sm btn--yellow" data-new>${C.esc(tx('l.new'))}</button>
      <button class="btn btn--sm btn--dark" data-send ${cfg && (c.open || c.fehler) ? '' : 'disabled'}>${C.esc(tx('l.send'))} (${c.open + c.fehler})</button>
      <button class="btn btn--sm" data-csv="," ${list.length ? '' : 'disabled'}>${C.esc(tx('l.csv'))}</button>
      <button class="btn btn--sm" data-csv=";" ${list.length ? '' : 'disabled'}>${C.esc(tx('l.xls'))}</button>
      <button class="btn btn--sm" data-delall ${list.some((l) => l.sync.state === 'gesendet' || l.exported) ? '' : 'disabled'}>${C.esc(tx('l.delall'))}</button>
    </div>
    <p class="${cfg && !cfg.sandbox ? 'ok' : 'warn'}" style="margin-bottom:6px">${C.esc(cfg ? (cfg.sandbox ? tx('l.hs.sandbox') : tx('l.hs.live', { p: cfg.portal })) : tx('l.hs.none'))}</p>
    <p class="muted" style="margin-bottom:14px">${C.esc(tx('l.sum', { all: c.all, sent: c.gesendet, open: c.open, bad: c.fehler, mail: c.unvollstaendig }))}</p>
    <div class="sleads">${list.length ? list.map((l) => {
      const when = new Date(l.created).toLocaleString(loc, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const st = l.sync.state;
      const interests = (l.interests || []).map(devName).join(', ');
      return `<div class="slead" data-id="${l.id}">
        <div><b>${C.esc([l.first, l.last].filter(Boolean).join(' ') || l.email || '–')}</b> · ${C.esc(l.company)}<br>
          <span>${C.esc([l.email, l.phone, l.countryName].filter(Boolean).join(' · '))}</span><br>
          <span>${C.esc([when, l.staff && `${tx('l.by')} ${l.staff}`].filter(Boolean).join(' · '))}${interests ? ' · ' + C.esc(interests) : ''}</span>
          ${l.msg ? `<br><span>„${C.esc(l.msg)}“</span>` : ''}${l.plan ? `<br><span>${C.esc(tx('l.plan'))}: ${C.esc(l.plan.slice(0, 70))}…</span>` : ''}
          ${st === 'fehler' ? `<br><span class="warn">${C.esc(l.sync.error || '')}</span>` : ''}
        </div>
        <div style="display:grid;gap:6px;justify-items:end"><em class="${st === 'gesendet' ? 'sync' : st === 'fehler' ? 'hot' : ''}">${C.esc(tx('l.state.' + st))}</em></div>
        <div style="grid-column:1/-1;display:grid;gap:10px">
          <div class="chips">${RATINGS.map((k) => `<button data-rate="${k}" class="${l.rating === k ? 'is-on' : ''}">${C.esc(tx('r.' + k))}</button>`).join('')}
            ${l.photo ? `<button data-photo style="margin-left:auto">${C.esc(tx('l.photo'))}</button>` : ''}<button data-edit ${l.photo ? '' : 'style="margin-left:auto"'}>${C.esc(tx('l.edit'))}</button><button data-del>${C.esc(tx('del'))}</button></div>
          <label class="inp"><span>${C.esc(tx('l.note'))}</span><input data-note value="${C.esc(l.note || '')}"></label>
        </div>
      </div>`;
    }).join('') : `<div class="scard"><p>${C.esc(tx('l.none'))}</p></div>`}</div>`;
  const byId = (el) => list.find((l) => l.id === el.closest('[data-id]').dataset.id);
  $('[data-new]', body).addEventListener('click', () => openCapture(root, captureCtx()));
  $$('[data-edit]', body).forEach((b) => b.addEventListener('click', () => openCapture(root, captureCtx({ lead: byId(b) }))));
  $$('[data-photo]', body).forEach((b) => b.addEventListener('click', () => showPhoto(byId(b).photo)));
  $$('[data-rate]', body).forEach((b) => b.addEventListener('click', async () => { const l = byId(b); setStd(l, 'rating', l.rating === b.dataset.rate ? '' : b.dataset.rate); await saveLead(l); }));
  $$('[data-note]', body).forEach((i) => i.addEventListener('change', async () => { const l = byId(i); l.note = i.value.trim(); await saveLead(l); }));
  $$('[data-del]', body).forEach((b) => b.addEventListener('click', async () => { if (confirm(tx('l.del.q'))) await deleteLead(byId(b)); }));
  $$('[data-csv]', body).forEach((b) => b.addEventListener('click', async () => {
    const ok = await shareFile(`ZOLLER-Messe-Leads-${fileTag()}.csv`, csv(csvRows(list, L), b.dataset.csv), 'text/csv');
    if (ok) for (const l of list) if (!l.exported) { l.exported = true; await saveLead(l, { resend: false }); }
  }));
  $('[data-delall]', body).addEventListener('click', async () => {
    if (!confirm(tx('l.delall.q'))) return;
    for (const l of list) if (l.sync.state === 'gesendet' || l.exported) await deleteLead(l);
  });
  $('[data-send]', body).addEventListener('click', (e) => { e.currentTarget.disabled = true; syncNow({ force: true }); });
}

// ------------------------------------------------------------------ Einrichtung
function setup(body) {
  const S = C.settings, D = C.D, t = C.t;
  const hsCfg = hubspotConfig(S.hubspot);
  const ev = S.event;
  const evTitle = (e) => `${e.title} · ${(e.city?.de || e.city?.en || '')} · ${e.start}${e.end && e.end !== e.start ? ' – ' + e.end : ''}`;
  const sites = Object.entries(D.sites).sort((a, b) => a[1].company.localeCompare(b[1].company));
  body.innerHTML = `<div class="staff__grid">
    <div class="scard"><h3>${C.esc(tx('s.event'))}</h3>
      <label class="inp"><span>${C.esc(tx('s.event'))}</span><select data-k="event">
        <option value="">–</option>
        ${D.events.map((e) => `<option value="${e.id}" ${ev?.id === e.id ? 'selected' : ''}>${C.esc(evTitle(e))}</option>`).join('')}
        <option value="*" ${ev && !ev.id ? 'selected' : ''}>${C.esc(tx('s.event.custom'))}</option></select></label>
      <div data-custom ${ev && !ev.id ? '' : 'hidden'} style="display:grid;gap:10px">
        <label class="inp"><span>${C.esc(tx('s.event.title'))}</span><input data-k="evTitle" value="${C.esc(ev && !ev.id ? ev.title : '')}"></label>
        <label class="inp"><span>${C.esc(tx('s.event.city'))}</span><input data-k="evCity" value="${C.esc(ev && !ev.id ? (typeof ev.city === 'string' ? ev.city : '') : '')}"></label>
      </div>
      <label class="inp"><span>${C.esc(tx('s.booth'))}</span><input data-k="booth" value="${C.esc(S.booth)}" placeholder="Halle 5 · Stand A12"></label>
      <label class="inp"><span>${C.esc(tx('s.kiosk'))}</span><input data-k="kiosk" value="${C.esc(S.kiosk)}"></label>
      <label class="inp"><span>${C.esc(tx('s.site'))}</span><select data-k="site">${sites.map(([code, s]) => `<option value="${code}" ${code === S.site ? 'selected' : ''}>${C.esc(s.company)} – ${C.esc(s.name)} (${code})</option>`).join('')}</select></label>
      <label class="inp"><span>${C.esc(tx('s.lang'))}</span><select data-k="lang">${D.langs.map((l) => `<option value="${l.code}" ${l.code === S.lang ? 'selected' : ''}>${C.esc(l.name)}</option>`).join('')}</select></label>
      <label class="inp"><span>${C.esc(tx('s.idle'))}</span><select data-k="idle">${[45, 60, 90, 120, 180, 300].map((n) => `<option ${n === S.idle ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
    <div class="scard"><h3>${C.esc(tx('tab.show'))}</h3><p>${C.esc(tx('w.p'))}</p>
      <button class="btn btn--yellow" data-to-show>${C.esc(tx('w.next'))}</button></div>
    <div class="scard"><h3>${C.esc(tx('s.form'))}</h3>
      <label class="inp"><select data-k="form">${templates().map((tp) => `<option value="${C.esc(tp.id)}" ${tp.id === (S.form || C.D.fragen?.default) ? 'selected' : ''}>${C.esc(label(tp.title, L))}</option>`).join('')}</select></label>
      <h3>${C.esc(tx('s.hs'))}</h3>
      ${hsCfg ? `<p class="${hsCfg.sandbox ? 'warn' : 'ok'}">${C.esc(hsCfg.sandbox ? tx('l.hs.sandbox') : tx('s.hs.builtin', { p: hsCfg.portal }))}</p>` : `<p class="warn">${C.esc(tx('l.hs.none'))}</p>`}
      <p>${C.esc(tx('s.hs.p'))}</p>
      <details><summary class="muted">${C.esc(tx('s.hs.expert'))}</summary><div style="display:grid;gap:10px;margin-top:10px">
        <label class="inp"><span>${C.esc(tx('s.hs.portal'))}</span><input data-k="hsPortal" inputmode="numeric" value="${C.esc(S.hubspot.portal)}"></label>
        <label class="inp"><span>${C.esc(tx('s.hs.form'))}</span><input data-k="hsForm" autocapitalize="off" autocorrect="off" spellcheck="false" value="${C.esc(S.hubspot.form)}"></label>
        <label class="inp"><span>${C.esc(tx('s.hs.host'))}</span><input data-k="hsHost" autocapitalize="off" autocorrect="off" spellcheck="false" value="${C.esc(S.hubspot.host)}"></label></div></details>
      <label class="inp"><span>${C.esc(tx('s.rate'))}</span><input data-k="rate" inputmode="numeric" value="${C.esc(S.rate ?? '')}"></label>
      <div class="row"><button class="btn btn--sm" data-pin>${C.esc(tx('s.pin'))}</button><button class="btn btn--sm btn--dark" data-lock-app>${C.esc(tx('s.lock'))}</button></div>
      <p class="muted" style="font-size:.9rem">${C.esc(tx('s.lock.p'))}</p>
    </div>
    <div class="scard"><h3>${C.esc(tx('s.pair'))}</h3>
      <div class="qr" style="background:#fff;border-radius:14px;padding:14px;max-width:260px" data-pair-qr></div>
      <p style="font-size:.92rem;line-height:1.45">${C.esc(tx('s.pair.p'))}</p>
    </div>
  </div>`;
  const pairQr = () => { const q = $('[data-pair-qr]', body); if (q) q.innerHTML = qrSvg(`${C.D.app}erfassen/#setup=${pairCode(C.settings)}`, { label: tx('s.pair') }); };
  pairQr();
  const set = (patch) => { C.save({ ...C.settings, ...patch }); changed = true; pairQr(); };
  body.addEventListener('change', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    const v = e.target.value.trim();
    const cur = C.settings;
    if (k === 'event') {
      $('[data-custom]', body).hidden = v !== '*';
      if (v === '*') set({ event: { title: $('[data-k="evTitle"]', body).value.trim(), city: $('[data-k="evCity"]', body).value.trim() } });
      else if (!v) set({ event: null });
      else {
        const e2 = D.events.find((x) => x.id === v);
        const evSite = Object.entries(D.sites).find(([, s]) => s.country === e2.country && s.lang === (D.sites[cur.site]?.lang))?.[0]
          || Object.entries(D.sites).find(([, s]) => s.country === e2.country)?.[0];
        set({ event: e2, ...(evSite ? { site: evSite } : {}) });
        if (evSite) { $('[data-k="site"]', body).value = evSite; }
      }
    } else if (k === 'evTitle' || k === 'evCity') set({ event: { title: $('[data-k="evTitle"]', body).value.trim(), city: $('[data-k="evCity"]', body).value.trim() } });
    else if (k === 'idle') set({ idle: +v });
    else if (k === 'rate') set({ rate: v ? Math.max(1, Math.round(+v.replace(/\D/g, ''))) || null : null });
    else if (k === 'hsPortal') set({ hubspot: { ...cur.hubspot, portal: v.replace(/\D/g, '') } });
    else if (k === 'hsForm') set({ hubspot: { ...cur.hubspot, form: v } });
    else if (k === 'hsHost') set({ hubspot: { ...cur.hubspot, host: v.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || 'api.hsforms.com' } });
    else set({ [k]: v });
  });
  $('[data-to-show]', body).addEventListener('click', () => { tab = 'show'; render(); });
  $('[data-pin]', body).addEventListener('click', async () => {
    const pin = await askPin(tx('pin.set'), true);
    if (pin) set({ pin: await makePin(pin), pinLen: pin.length });
  });
  $('[data-lock-app]', body).addEventListener('click', () => { close(); C.lock(); });
}

// ------------------------------------------------------------------ Auswahl: Produkte, Filme, live am Stand
// null = alles (neue Produkte/Filme eines Updates erscheinen dann von selbst); Live ⊂ gezeigt, Schleife ⊂ Filme in der App
function show(body) {
  const S = C.settings, D = C.D, T = textIn(L);
  const allP = D.products.map((p) => p.id), allF = D.films.map((f) => f.id);
  const selP = new Set(S.products || allP), selF = new Set(S.films || allF);
  const loopF = new Set((S.attract.films || [...selF]).filter((id) => selF.has(id)));
  const live = Object.fromEntries(Object.entries(S.live || {}).map(([k, v]) => [prodId(k), v]));
  const save = () => {
    const prods = allP.filter((id) => selP.has(id) || id in live);
    const films = allF.filter((id) => selF.has(id));
    const loop = films.filter((id) => loopF.has(id));
    C.save({ ...C.settings, products: prods.length === allP.length ? null : prods, films: films.length === allF.length ? null : films,
      attract: { ...C.settings.attract, films: loop.length === films.length ? null : loop }, live: { ...live } });
    catalogSettings(C.settings);
    changed = true;
    show(body);
  };
  const dur = (f) => `${Math.floor(f.dur / 60)}:${String(Math.round(f.dur % 60)).padStart(2, '0')}`;
  const nShown = allP.filter((id) => selP.has(id) || id in live).length;
  body.innerHTML = `<div class="sel">
    <div class="scard sel__top"><div><h3>${C.esc(tx('w.h'))}</h3><p>${C.esc(tx('w.p'))}</p></div>
      <div class="kpis">
        <div class="kpi"><b>${nShown}<small>/${allP.length}</small></b><span>${C.esc(tx('w.prod'))}</span></div>
        ${allF.length ? `<div class="kpi"><b>${selF.size}<small>/${allF.length}</small></b><span>${C.esc(tx('w.films'))}</span></div>` : ''}
        <div class="kpi"><b>${Object.keys(live).length}</b><span>${C.esc(tx('w.live'))}</span></div>
        <div class="kpi"><b data-sel-mb>…</b><span>${C.esc(tx('w.mb'))}</span></div></div>
      <div class="row"><button class="btn btn--sm" data-preset="all">${C.esc(tx('w.all'))}</button><button class="btn btn--sm" data-preset="live">${C.esc(tx('w.liveonly'))}</button>
        <button class="btn btn--sm" data-preset="none">${C.esc(tx('w.none'))}</button></div></div>
    ${D.worlds.map((w) => {
      const items = D.products.filter((p) => p.cat === w.id);
      const n = items.filter((p) => selP.has(p.id) || p.id in live).length;
      return `<section class="scard sel__world"><div class="sel__head"><h3>${C.esc(T.worlds?.[w.id]?.name || w.id)} <small>${n}/${items.length}</small></h3>
        <div class="row"><button class="btn btn--sm" data-wall="${w.id}" data-on="1">${C.esc(tx('w.on'))}</button><button class="btn btn--sm" data-wall="${w.id}" data-on="0">${C.esc(tx('w.off'))}</button></div></div>
        <div class="sel__grid">${items.map((p) => {
          const on = selP.has(p.id) || p.id in live, lv = p.id in live;
          return `<div class="sel__p${on ? ' is-on' : ''}${lv ? ' is-live' : ''}">
            <button class="sel__pick" data-pick="${p.id}"><span class="sel__img">${p.thumb || p.img ? `<img src="${C.esc(p.thumb || p.img)}" alt="" loading="lazy">` : ''}</span>
              <span class="sel__txt"><b>${C.esc(plain(T.products?.[p.id]?.name || p.id))}</b><small>${C.esc(T.products?.[p.id]?.sub || '')}</small></span><i class="sel__check"></i></button>
            <button class="sel__live" data-live="${p.id}"><i></i>${C.esc(tx('w.liveBtn'))}</button></div>`;
        }).join('')}</div></section>`;
    }).join('')}
    <div class="scard"><h3>${C.esc(tx('w.loc.h'))}</h3><p>${C.esc(tx('w.loc.p'))}</p>
      ${Object.keys(live).length ? `<div style="display:grid;gap:8px">${Object.keys(live).map((id) => `<label class="inp sel__loc"><span>${C.esc(pName(id))}</span>
        <input data-loc="${id}" placeholder="${C.esc(tx('s.live.loc'))}" value="${C.esc(live[id] || '')}"></label>`).join('')}</div>` : `<p class="muted">${C.esc(tx('w.nolive'))}</p>`}</div>
    ${allF.length ? `<section class="scard"><div class="sel__head"><h3>${C.esc(tx('w.films'))} <small>${selF.size}/${allF.length}</small></h3>
        <div class="row"><button class="btn btn--sm" data-fall="1">${C.esc(tx('w.on'))}</button><button class="btn btn--sm" data-fall="0">${C.esc(tx('w.off'))}</button></div></div>
      <p>${C.esc(tx('w.films.p'))}</p>
      <div class="sel__films">${D.films.map((f) => `<div class="sel__f${selF.has(f.id) ? ' is-on' : ''}">
        <span class="sel__poster"><img src="${C.esc(f.thumb || f.poster)}" alt="" loading="lazy"><em>${dur(f)}</em></span>
        <b>${C.esc(plain(C.t('film.' + f.id, null, L)))}</b><small>${C.esc((f.products || []).slice(0, 3).map(pName).join(' · '))}</small>
        <div class="seg"><button data-fapp="${f.id}" class="${selF.has(f.id) ? 'is-on' : ''}">${C.esc(tx('w.inapp'))}</button><button data-floop="${f.id}" class="${loopF.has(f.id) ? 'is-on' : ''}">${C.esc(tx('w.loop'))}</button></div></div>`).join('')}</div>
      <h3>${C.esc(tx('s.captions'))}</h3>
      <div class="seg" style="max-width:360px"><button data-cap="1" class="${S.attract.captions ? 'is-on' : ''}">${C.esc(tx('s.on'))}</button><button data-cap="0" class="${S.attract.captions ? '' : 'is-on'}">${C.esc(tx('s.off'))}</button></div>
    </section>` : ''}</div>`;
  // Größe der Auswahl für »Offline laden«
  swFiles().then((f) => {
    const want = selectedMedia();
    const bytes = (f?.media || []).filter(([pth]) => want.has(pth)).reduce((a, x) => a + x[1], 0);
    const el = $('[data-sel-mb]', body);
    if (el) el.textContent = f ? mb(bytes) : '–';
  }).catch(() => {});
  $$('[data-pick]', body).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.pick;
    if (selP.has(id) || id in live) { selP.delete(id); delete live[id]; } else selP.add(id);
    save();
  }));
  $$('[data-live]', body).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.live;
    if (id in live) delete live[id]; else { live[id] = ''; selP.add(id); }
    save();
  }));
  $$('[data-wall]', body).forEach((b) => b.addEventListener('click', () => {
    D.products.filter((p) => p.cat === b.dataset.wall).forEach((p) => { if (b.dataset.on === '1') selP.add(p.id); else { selP.delete(p.id); delete live[p.id]; } });
    save();
  }));
  $$('[data-preset]', body).forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.preset;
    if (k === 'live' && !Object.keys(live).length) { alert(tx('w.nolive.q')); return; }
    selP.clear();
    if (k === 'all') allP.forEach((id) => selP.add(id));
    if (k === 'none') Object.keys(live).forEach((id) => delete live[id]);
    save();
  }));
  $$('[data-loc]', body).forEach((i) => i.addEventListener('change', () => {
    live[i.dataset.loc] = i.value.trim();
    C.save({ ...C.settings, live: { ...live } }); catalogSettings(C.settings); changed = true;
  }));
  $$('[data-fapp]', body).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.fapp;
    if (selF.has(id)) { selF.delete(id); loopF.delete(id); } else selF.add(id);
    save();
  }));
  $$('[data-floop]', body).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.floop;
    if (loopF.has(id)) loopF.delete(id); else { loopF.add(id); selF.add(id); }
    save();
  }));
  $$('[data-fall]', body).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.fall === '1') allF.forEach((id) => { selF.add(id); loopF.add(id); }); else { selF.clear(); loopF.clear(); }
    save();
  }));
  $$('[data-cap]', body).forEach((b) => b.addEventListener('click', () => {
    C.save({ ...C.settings, attract: { ...C.settings.attract, captions: b.dataset.cap === '1' } }); changed = true;
    $$('[data-cap]', body).forEach((x) => x.classList.toggle('is-on', x === b));
  }));
}

// ------------------------------------------------------------------ Offline
async function offline(body) {
  const want = selectedMedia();
  const st = await offlineStatus(want).catch(() => null);
  const info = await storageInfo();
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const line = (label, x) => x ? `<div class="files"><div><b>${C.esc(label)}</b><span class="${x.missing.length ? 'warn' : 'ok'}">${x.missing.length ? C.esc(tx('o.missing', { n: x.missing.length, mb: mb(x.missingBytes) })) : C.esc(tx('o.ready')) + ' · ' + mb(x.bytes)}</span></div></div>` : '';
  body.innerHTML = `<div class="staff__grid">
    <div class="scard"><h3>${C.esc(tx('tab.offline'))}</h3>
      <p class="${standalone ? 'ok' : 'warn'}">${C.esc(standalone ? tx('o.standalone.ok') : tx('o.standalone'))}</p>
      ${st ? `${line(tx('o.core'), st.core)}${line(tx('o.media.sel'), st.media)}<p>${C.esc(tx('o.version'))}: ${C.esc(st.version)}</p>` : `<p class="warn">${C.esc(tx('o.nosw'))}</p>`}
      <div class="progress" data-prog hidden><i></i></div><p data-prog-msg></p>
      <div class="row"><button class="btn btn--yellow" data-load ${st && (st.media.missing.length || st.core.missing.length) ? '' : 'disabled'}>${C.esc(tx('o.load'))}</button>
        <button class="btn btn--sm" data-reload>${C.esc(tx('o.reload'))}</button></div>
    </div>
    <div class="scard"><h3>${C.esc(tx('o.storage'))}</h3>
      <p>${info.usage != null ? `${mb(info.usage)} / ${mb(info.quota)}` : '–'} · <span class="${info.persisted ? 'ok' : 'warn'}">${C.esc(info.persisted ? tx('o.persisted') : tx('o.notpersisted'))}</span></p>
      ${info.persisted ? '' : `<button class="btn btn--sm" data-persist>${C.esc(tx('o.persist'))}</button>`}
      <h3>Update</h3><p data-upd-msg></p>
      <div class="row"><button class="btn btn--sm" data-upd>${C.esc(tx('o.update'))}</button><button class="btn btn--sm btn--dark" data-upd-now hidden>${C.esc(tx('o.upd.now'))}</button></div>
    </div>
  </div>`;
  const reg = C.reg();
  if (reg?.waiting) { $('[data-upd-msg]', body).textContent = tx('o.upd.ready'); $('[data-upd-now]', body).hidden = false; }
  $('[data-reload]', body).addEventListener('click', () => location.reload());
  $('[data-persist]', body)?.addEventListener('click', async () => { await persist(); offline(body); });
  $('[data-upd]', body).addEventListener('click', async () => {
    const r = C.reg();
    try { await r?.update(); } catch { /* offline */ }
    await new Promise((res) => setTimeout(res, 1500));
    const w = r?.waiting || r?.installing;
    $('[data-upd-msg]', body).textContent = w ? tx('o.upd.ready') : tx('o.upd.none');
    $('[data-upd-now]', body).hidden = !w;
  });
  $('[data-upd-now]', body).addEventListener('click', () => {
    const r = C.reg();
    if (r?.waiting) { navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); r.waiting.postMessage('skipWaiting'); } else location.reload();
  });
  $('[data-load]', body).addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    await persist();
    const prog = $('[data-prog]', body), bar = $('[data-prog] i', body), msg = $('[data-prog-msg]', body);
    prog.hidden = false;
    try {
      // Basisdateien, die beim Installieren gefehlt haben, gleich mitnehmen
      if (st.core.missing.length) {
        const f = await swFiles();
        const c = await caches.open(f.coreCache);
        for (const [p] of st.core.missing) { try { const r = await fetch(abs(p), { cache: 'no-cache' }); if (r.ok) await c.put(abs(p), r); } catch { /* weiter */ } }
      }
      await downloadMedia((a, b) => { bar.style.width = (b ? a / b * 100 : 100) + '%'; msg.textContent = tx('o.loading', { a: mb(a), b: mb(b) }); }, null, want);
      msg.textContent = tx('o.done');
      setTimeout(() => offline(body), 1500);
    } catch (err) { msg.textContent = String(err.message || err); msg.className = 'warn'; e.currentTarget.disabled = false; }
  });
}

// ------------------------------------------------------------------ Hilfe
function help(body) {
  const H = HELP[L] || HELP.en;
  const box = (title, items) => `<div class="scard"><h3>${C.esc(title)}</h3><ol>${items.map((i) => `<li>${C.esc(i)}</li>`).join('')}</ol></div>`;
  body.innerHTML = `<div class="staff__grid">${box(tx('h.prep'), H.prep)}${box(tx('h.ga'), H.ga)}${box(tx('h.leads'), H.leads)}${box(tx('h.daily'), H.daily)}${box(tx('h.after'), H.after)}</div>`;
}

export { saveSettings };
