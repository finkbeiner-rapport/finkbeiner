'use strict';
/* Tagesrapport – Fliesen Finkbeiner | eigenständige PWA (iPhone + Android) */

const VERSION = '2.2';
const $ = id => document.getElementById(id);
const MAT_UNITS = ['m²','lfm','m','kg','g','l','Stk','Sack','Eimer','Pkt','Gebinde','m³','t'];
const GER_UNITS = ['Std','Tage','Stk','Min'];
const MODEL = 'claude-sonnet-5-5';
const DEF = {
  firma: 'Fliesen-Finkbeiner GmbH',
  kontakt: 'Trottäcker 26-28 · 79713 Bad Säckingen · Tel. 07761 3075 · info@fliesen-finkbeiner.de',
  farbe: '#1f4e79',
  logourl: 'https://www.fliesen-finkbeiner.de/wp-content/uploads/2017/09/Finkbeiner_Logo_reg.jpg'
};

/* ---------- Einstellungen / Logo ---------- */
const S = {
  get(){ try { return JSON.parse(localStorage.getItem('rp_settings') || '{}'); } catch(e){ return {}; } },
  set(o){ try { localStorage.setItem('rp_settings', JSON.stringify(o)); return true; } catch(e){ return false; } }
};
const eff = k => { const v = S.get()[k]; return (v === undefined || v === '') ? DEF[k] : v; };
let LOGO = null; // {url (PNG dataURL), w, h}

function imgToLogo(src){
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      res({ url: c.toDataURL('image/png'), w, h });
    };
    img.onerror = () => rej(new Error('Bild nicht lesbar'));
    img.src = src;
  });
}
/* Logo von der Firmenwebseite laden (direkt, sonst über einen Bild-Proxy mit CORS) und lokal speichern */
async function fetchWebLogo(){
  const url = eff('logourl');
  const sources = [url, 'https://wsrv.nl/?output=png&url=' + encodeURIComponent(url.replace(/^https?:\/\//, ''))];
  for (const src of sources){
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 15000);
      let r; try { r = await fetch(src, { mode: 'cors', cache: 'no-cache', signal: ctl.signal }); } finally { clearTimeout(to); }
      if (!r.ok) continue;
      const blob = await r.blob(); if (!/^image\//.test(blob.type)) continue;
      const u = URL.createObjectURL(blob);
      try {
        const l = await imgToLogo(u);
        try { localStorage.setItem('rp_logo', l.url); } catch(e){}
        LOGO = l; applyBranding(); return true;
      } finally { URL.revokeObjectURL(u); }
    } catch(e){ /* nächste Quelle */ }
  }
  return false;
}
async function loadLogo(){
  try {
    const stored = localStorage.getItem('rp_logo');
    if (stored){ LOGO = await imgToLogo(stored); return applyBranding(); }
  } catch(e){}
  if (navigator.onLine && await fetchWebLogo()) return;
  try { // optional: logo.png neben der App ablegen
    const r = await fetch('logo.png', { cache: 'no-cache' });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && /^image\//.test(ct)){
      const blob = await r.blob(); const u = URL.createObjectURL(blob);
      try { LOGO = await imgToLogo(u); } finally { URL.revokeObjectURL(u); }
    }
  } catch(e){}
  applyBranding();
}
function applyBranding(){
  const farbe = eff('farbe');
  document.documentElement.style.setProperty('--blau', farbe);
  $('themeColor').setAttribute('content', farbe);
  $('hfirma').textContent = eff('firma');
  const hl = $('hlogo');
  if (LOGO){ hl.src = LOGO.url; hl.style.display = 'block'; $('hfirma').style.display = 'none'; }
  else { hl.style.display = 'none'; $('hfirma').style.display = ''; }
}

/* ---------- IndexedDB ---------- */
const DB = (() => {
  let db;
  const open = () => new Promise((res, rej) => {
    if (db) return res(db);
    if (!window.indexedDB) return rej(new Error('Kein IndexedDB'));
    const r = indexedDB.open('rapporte', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('r', { keyPath: 'id' });
    r.onsuccess = () => { db = r.result; res(db); };
    r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction('r', mode); const rq = fn(t.objectStore('r'));
      t.oncomplete = () => res(rq && rq.result);
      t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  };
  return {
    put: r => tx('readwrite', s => s.put(r)),
    del: id => tx('readwrite', s => s.delete(id)),
    all: () => tx('readonly', s => s.getAll())
  };
})();

/* ---------- Hilfsfunktionen ---------- */
function toast(msg, ms = 2800){
  const t = $('toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => t.style.display = 'none', ms);
}
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtDate = iso => iso ? iso.split('-').reverse().join('.') : '';
const num = v => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const fmtNum = n => n == null ? '' : String(n).replace('.', ',');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const visible = id => !$(id).classList.contains('hide');

/* ---------- Zustand ---------- */
let cur = { id: uid(), fotos: [], status: 'entwurf' };
let dirty = false;
const markDirty = () => { dirty = true; };
const FIELDS = ['datum','nr','objekt','projekt','wetter','adresse','kunde','bauleiter','mitarbeiter','von','bis','pause','diktat','taetigkeit','bemerkung','kundeName'];

function collect(){
  const r = { id: cur.id, fotos: cur.fotos, status: cur.status || 'entwurf', created: cur.created || Date.now() };
  FIELDS.forEach(f => r[f] = $(f).value.trim ? $(f).value.trim() : $(f).value);
  r.diktat = $('diktat').value; r.taetigkeit = $('taetigkeit').value; r.bemerkung = $('bemerkung').value;
  r.material = rows('mat'); r.geraete = rows('ger');
  r.sig1 = sig1.data(); r.sig2 = sig2.data();
  r.updated = Date.now();
  return r;
}
function hasContent(r){
  return !!(r.objekt || r.projekt || r.kunde || r.adresse || r.diktat || r.taetigkeit || r.bemerkung ||
    (r.material || []).length || (r.geraete || []).length || (r.fotos || []).length || r.sig1 || r.sig2);
}
function fill(r){
  cur = { id: r.id, fotos: r.fotos || [], status: r.status || 'entwurf', created: r.created };
  FIELDS.forEach(f => $(f).value = r[f] || '');
  $('mat').innerHTML = ''; $('ger').innerHTML = '';
  (r.material || []).forEach(m => addRow('mat', m));
  (r.geraete || []).forEach(m => addRow('ger', m));
  if (!(r.material || []).length) addRow('mat');
  if (!(r.geraete || []).length) addRow('ger');
  renderPhotos();
  sig1.load(r.sig1 || ''); sig2.load(r.sig2 || '');
  dirty = false;
}
function fresh(){ fill({ id: uid(), datum: today(), mitarbeiter: S.get().ma || '' }); }

/* Rapportnummer: JJJJ-001, fortlaufend, wird erst bei erstem Speichern vergeben */
function nextNr(){
  let c; try { c = JSON.parse(localStorage.getItem('rp_nr') || '{}'); } catch(e){ c = {}; }
  const y = new Date().getFullYear();
  if (c.y !== y) c = { y, n: 0 };
  c.n++; try { localStorage.setItem('rp_nr', JSON.stringify(c)); } catch(e){}
  return y + '-' + String(c.n).padStart(3, '0');
}

/* ---------- Material-/Geräte-Zeilen ---------- */
function addRow(kind, d = {}){
  const units = kind === 'mat' ? MAT_UNITS : GER_UNITS;
  const u = d.einheit && !units.includes(d.einheit) ? units.concat(d.einheit) : units;
  const el = document.createElement('div'); el.className = 'item';
  el.innerHTML = `<input class="n" placeholder="${kind === 'mat' ? 'Material' : 'Gerät'}" value="${esc(d.name || '')}" autocomplete="off">
    <input class="q" inputmode="decimal" placeholder="Menge" value="${esc(fmtNum(d.menge))}">
    <select class="u">${u.map(x => `<option${x === (d.einheit || u[0]) ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
    <button class="x" type="button" aria-label="Zeile entfernen">✕</button>`;
  el.querySelector('.x').onclick = () => { el.remove(); markDirty(); };
  $(kind).appendChild(el);
}
function rows(kind){
  return [...$(kind).children].map(el => ({
    name: el.querySelector('.n').value.trim(),
    menge: num(el.querySelector('.q').value),
    einheit: el.querySelector('.u').value
  })).filter(x => x.name);
}
$('addMat').onclick = () => { addRow('mat'); markDirty(); };
$('addGer').onclick = () => { addRow('ger'); markDirty(); };

/* ---------- Fotos ---------- */
function compress(file, max = 1400, q = 0.72){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight; const k = Math.min(1, max / Math.max(w, h));
      w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url); res({ data: c.toDataURL('image/jpeg', q), w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Bild nicht lesbar')); };
    img.src = url;
  });
}
async function addFiles(files){
  let bad = 0;
  for (const f of files){
    try { const p = await compress(f); cur.fotos.push({ data: p.data, w: p.w, h: p.h, text: '' }); }
    catch(e){ bad++; }
  }
  if (bad) toast(bad + ' Foto(s) konnten nicht gelesen werden (z. B. HEIC). Bitte Kamera-Foto direkt aufnehmen.', 4500);
  renderPhotos(); markDirty();
}
function renderPhotos(){
  const box = $('photos'); box.innerHTML = '';
  cur.fotos.forEach((p, i) => {
    const d = document.createElement('div'); d.className = 'photo';
    d.innerHTML = `<img alt="Foto ${i + 1}"><button class="x" type="button" aria-label="Foto entfernen">✕</button><input placeholder="Bildtext (optional)" autocomplete="off">`;
    d.querySelector('img').src = p.data;
    const inp = d.querySelector('input'); inp.value = p.text || ''; inp.oninput = e => { p.text = e.target.value; markDirty(); };
    d.querySelector('.x').onclick = () => { cur.fotos.splice(i, 1); renderPhotos(); markDirty(); };
    box.appendChild(d);
  });
}
$('camBtn').onclick = () => $('cam').click();
$('galBtn').onclick = () => $('gal').click();
$('cam').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };
$('gal').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };

/* ---------- Unterschrift ---------- */
function Sig(canvas){
  const ctx = canvas.getContext('2d'); let drawing = false;
  const o = { url: '', empty: true };
  const rect = () => canvas.getBoundingClientRect();
  function style(){ const k = window.devicePixelRatio || 1; ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; }
  function redraw(){
    const r = rect(); if (!r.width) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore();
    if (!o.url) return;
    const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height); img.src = o.url;
  }
  o.size = () => {
    const r = rect(); if (!r.width) return;
    const k = window.devicePixelRatio || 1; const w = Math.round(r.width * k), h = Math.round(r.height * k);
    if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; style(); redraw(); }
  };
  const pos = e => { const r = rect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', e => {
    o.size(); drawing = true; try { canvas.setPointerCapture(e.pointerId); } catch(_){}
    const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + .1, y + .1); ctx.stroke(); e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => { if (!drawing) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); e.preventDefault(); });
  const end = () => { if (!drawing) return; drawing = false; o.url = canvas.toDataURL('image/png'); o.empty = false; markDirty(); };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  o.clear = () => { o.url = ''; o.empty = true; redraw(); if (drawing) drawing = false; markDirty(); };
  o.data = () => o.empty ? '' : o.url;
  o.load = url => { o.url = url || ''; o.empty = !url; o.size(); redraw(); };
  return o;
}
const sig1 = Sig($('sig1')), sig2 = Sig($('sig2'));
document.querySelectorAll('[data-clr]').forEach(b => b.onclick = () => (b.dataset.clr === 'sig1' ? sig1 : sig2).clear());

/* ---------- Sprache ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let activeMic = null;
function Mic(btn, area, label){
  let rec = null, on = false, base = '', fails = 0;
  const api = { stop(){ if (!on) return; on = false; try { rec && rec.stop(); } catch(e){} if (base) area.value = base; ui(); } };
  const ui = () => { btn.classList.toggle('rec', on); btn.textContent = on ? '■ Stopp' : label; };
  if (!SR){ btn.onclick = () => toast('Hier gibt es keine eingebaute Spracherkennung – bitte das Mikrofon der Tastatur nutzen.', 4500); return api; }
  const start = () => {
    rec = new SR(); rec.lang = 'de-DE'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => {
      fails = 0; let fin = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++){
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t; else interim += t;
      }
      if (fin) base += (base && !/\s$/.test(base) ? ' ' : '') + fin.trim();
      area.value = base + (interim ? (base ? ' ' : '') + interim : ''); markDirty();
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed'){ on = false; ui(); toast('Mikrofon nicht erlaubt – bitte in den Geräte-Einstellungen freigeben.', 5000); }
      else if (e.error === 'network'){ on = false; ui(); toast('Spracherkennung braucht Internet.', 4000); }
      else if (e.error === 'audio-capture'){ on = false; ui(); toast('Kein Mikrofon gefunden.', 4000); }
    };
    rec.onend = () => {
      if (!on) return ui();
      if (++fails > 8){ on = false; ui(); return; }
      setTimeout(() => { if (on){ try { rec.start(); } catch(e){ on = false; ui(); } } }, 250);
    };
    try { rec.start(); } catch(e){ on = false; ui(); }
  };
  btn.onclick = () => {
    if (on){ api.stop(); return; }
    if (activeMic && activeMic !== api) activeMic.stop();
    activeMic = api; base = area.value; on = true; fails = 0; ui(); start();
  };
  return api;
}
Mic($('mic'), $('diktat'), '🎤 Sprechen');
Mic($('mic2'), $('taetigkeit'), '🎤 Diktieren');
if (!SR) $('micHint').textContent = 'Hinweis: Dieser Browser hat keine eingebaute Spracherkennung. Tippe ins Textfeld und nutze das Mikrofon-Symbol der Tastatur – die Auswertung funktioniert danach genauso.';
$('diktClear').onclick = () => { $('diktat').value = ''; markDirty(); };

/* ---------- Auswertung (lokal) ---------- */
const UNIT_MAP = [
  [/^(m²|m2|qm|quadratmeter)$/i, 'm²'], [/^(lfm|lfdm|laufende[nr]? meter|lfd\.? ?m)$/i, 'lfm'],
  [/^(m³|m3|kubikmeter|cbm)$/i, 'm³'], [/^(meter|m)$/i, 'm'], [/^(kg|kilo|kilogramm)$/i, 'kg'],
  [/^(g|gramm)$/i, 'g'], [/^(l|liter)$/i, 'l'], [/^(stk|stück|stueck|st)$/i, 'Stk'],
  [/^(sack|säcke|saecke)$/i, 'Sack'], [/^(eimer)$/i, 'Eimer'], [/^(pkt|paket|pakete|packung|packungen)$/i, 'Pkt'],
  [/^(gebinde|kanister)$/i, 'Gebinde'], [/^(t|tonnen?)$/i, 't'],
  [/^(std|stunden?|h)$/i, 'Std'], [/^(tage?|tag)$/i, 'Tage'], [/^(min|minuten)$/i, 'Min']
];
function normUnit(u){ if (!u) return null; u = String(u).trim(); for (const [re, n] of UNIT_MAP) if (re.test(u)) return n; return null; }
const GERAET_RE = /(schneider|rührgerät|ruehrgeraet|rührer|bohrmaschine|bohrhammer|gerüst|gerueste|mischer|rüttler|rüttelplatte|schleifer|flex|laser|kompressor|sauger|staubsauger|leiter|hubwagen|kran|aufzug|maschine|gerät|wasserwaage|pumpe|heizer|trockner)/i;
const NUM_WORDS = { ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12 };
const cap = n => n.charAt(0).toUpperCase() + n.slice(1);

function parseLocal(text){
  const t = text.replace(/\s+/g, ' ')
    .replace(/\b(ein|eine|einen|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\b(?=\s+(?:m²|m2|qm|quadratmeter|lfm|laufende|meter|kilo|kilogramm|kg|sack|säcke|eimer|liter|stunden?|tage?|stück|paket|pakete|gebinde|kanister))/gi, m => NUM_WORDS[m.toLowerCase()])
    .replace(/(\d)\s*(?:[x×]|mal)\s*(\d)/gi, '$1x$2');
  const mat = [], ger = [];
  // Gerät zuerst: "Nassschneider 4 Stunden" (Name vor Menge)
  const t2 = t.replace(/(?:^|[\s,;.])((?:[A-Za-zÄÖÜäöüß\-]+\s)?[A-Za-zÄÖÜäöüß\-]{3,})\s+(\d+(?:[.,]\d+)?)\s*(stunden|stunde|std|tage|tag|h)(?=[\s,.;:]|$)/gi, (all, name, q, u) => {
    name = name.replace(/^(?:und|sowie|benutzt|wurden|wurde|eingesetzt|verwendet)\s+/i, '').trim();
    if (name.length < 3) return all;
    ger.push({ name: cap(name), menge: num(q), einheit: normUnit(u) }); return ' ';
  });
  const re = /(\d+(?:[.,]\d+)?)\s*(m²|m2|m³|m3|qm|quadratmeter|kubikmeter|lfm|lfdm|laufende[nr]? meter|kilogramm|kilo|kg|gramm|liter|stück|stk|säcke|sack|eimer|pakete|paket|packungen|packung|gebinde|kanister|tonnen|stunden|stunde|std|minuten|min|tage|tag|meter|m|g|l|t|h)(?=[\s,.;:]|$)\s*(?:von |an |vom |der |die |das |des )?((?:[^,.;:\d]|\d+x\d+)*?)(?=[,.;:]|\s+und\s+\d|\s+\d(?!\d*x)|$)/gi;
  let m;
  while ((m = re.exec(t2))){
    const unit = normUnit(m[2]); let name = m[3].replace(/^(?:verlegt|verbraucht|benutzt|verwendet|eingesetzt|gebraucht)\s+/i, '').trim();
    if (!unit || name.length < 2) continue;
    const item = { name: cap(name), menge: num(m[1]), einheit: unit };
    if (unit === 'Std' || unit === 'Tage' || unit === 'Min' || GERAET_RE.test(name)){
      if (!GER_UNITS.includes(unit)) item.einheit = 'Stk';
      ger.push(item);
    } else mat.push(item);
  }
  return { taetigkeit: text.trim(), material: mat, geraete: ger, bemerkung: '' };
}

/* ---------- Auswertung (Claude) ---------- */
async function parseAI(text, key){
  const sys = `Du bist Assistent für einen Fliesenlegerbetrieb und wertest diktierte Tagesrapporte aus. Antworte NUR mit gültigem JSON ohne Erklärung, Format:
{"taetigkeit":"sachlich formulierte Zusammenfassung der ausgeführten Arbeiten in kurzen Sätzen oder Stichpunkten (Raum/Bereich, Arbeitsschritte)","material":[{"name":"","menge":0,"einheit":""}],"geraete":[{"name":"","menge":0,"einheit":""}],"bemerkung":""}
Regeln: Verbrauchte Werkstoffe/Material (Fliesen, Kleber, Fugenmasse, Profile, Grundierung, Abdichtung …) kommen in "material", Maschinen/Werkzeuge/Gerüste in "geraete". Einheiten bei material nur aus: ${MAT_UNITS.join(', ')}. Einheiten bei geraete nur aus: ${GER_UNITS.join(', ')}. Mengen als Zahl (Punkt als Dezimaltrenner). Quadratmeter = m², laufende Meter = lfm, Kilogramm = kg, Säcke = Sack. Format/Größe/Typ gehört in den Namen (z. B. "Bodenfliese 60x60"). Erfinde NIE Mengen: ist keine genannt, setze menge null. "bemerkung" nur für Mängel, Behinderungen, Absprachen, Zusatzleistungen, sonst leer.`;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 40000);
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, system: sys, messages: [{ role: 'user', content: text }] })
    });
  } finally { clearTimeout(to); }
  if (r.status === 401) { const e = new Error('Schlüssel ungültig'); e.auth = true; throw e; }
  if (!r.ok) throw new Error('API ' + r.status);
  const j = await r.json();
  const raw = (j.content || []).map(c => c.text || '').join('').replace(/^```(?:json)?|```$/gim, '').trim();
  const o = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  const clean = (a, units) => (Array.isArray(a) ? a : []).filter(x => x && x.name).map(x => ({ name: String(x.name), menge: num(x.menge), einheit: units.includes(x.einheit) ? x.einheit : (normUnit(x.einheit) && units.includes(normUnit(x.einheit)) ? normUnit(x.einheit) : units[0]) }));
  return { taetigkeit: o.taetigkeit || text, material: clean(o.material, MAT_UNITS), geraete: clean(o.geraete, GER_UNITS), bemerkung: o.bemerkung || '' };
}

$('ki').onclick = async () => {
  const text = $('diktat').value.trim();
  if (!text) return toast('Bitte zuerst etwas sprechen oder eintippen.');
  if (activeMic) activeMic.stop();
  const key = (S.get().key || '').trim(); const b = $('ki'); b.disabled = true; const old = b.textContent; b.textContent = '… wertet aus';
  let res, how = 'KI';
  try {
    if (key && navigator.onLine) res = await parseAI(text, key); else { res = parseLocal(text); how = 'Mustererkennung'; }
  } catch(e){ res = parseLocal(text); how = e.auth ? 'Mustererkennung – API-Schlüssel ungültig' : 'Mustererkennung – KI nicht erreichbar'; }
  b.disabled = false; b.textContent = old;
  const ta = $('taetigkeit');
  if (res.taetigkeit){
    if (!ta.value.trim()) ta.value = res.taetigkeit;
    else if (ta.value.trim() !== res.taetigkeit.trim() && confirm('Vorhandenen Text unter „Ausgeführte Arbeiten“ durch die neue Fassung ersetzen?')) ta.value = res.taetigkeit;
  }
  if (res.bemerkung && !$('bemerkung').value.includes(res.bemerkung)) $('bemerkung').value = ($('bemerkung').value ? $('bemerkung').value + '\n' : '') + res.bemerkung;
  const merge = (kind, list) => {
    const have = rows(kind); const key = x => [x.name.toLowerCase(), x.einheit, x.menge].join('|');
    const seen = new Set(have.map(key)); const add = list.filter(x => !seen.has(key(x)));
    $(kind).innerHTML = ''; have.concat(add).forEach(x => addRow(kind, x));
    if (!have.length && !add.length) addRow(kind);
  };
  merge('mat', res.material); merge('ger', res.geraete); markDirty();
  toast(`Ausgewertet (${how}): ${res.material.length} Material, ${res.geraete.length} Geräte – bitte prüfen.`, 4500);
};

/* ---------- Speichern / Archiv ---------- */
async function save(silent){
  const r = collect();
  if (!hasContent(r)){ if (!silent) toast('Nichts zu speichern – der Rapport ist noch leer.'); return r; }
  if (!r.nr){ r.nr = nextNr(); $('nr').value = r.nr; }
  try { await DB.put(r); dirty = false; if (!silent) toast('Gespeichert'); }
  catch(e){ if (!silent) toast('Speichern fehlgeschlagen: ' + (e && e.message || e), 5000); else throw e; }
  return r;
}
$('save').onclick = () => save();
$('newBtn').onclick = async () => {
  if (!confirm('Neuen Rapport beginnen? Der aktuelle wird vorher gespeichert.')) return;
  try { await save(true); } catch(e){ if (!confirm('Speichern fehlgeschlagen. Trotzdem neu beginnen?')) return; }
  fresh(); window.scrollTo(0, 0);
};
async function renderArchiv(){
  let list = [];
  try { list = (await DB.all()) || []; } catch(e){ toast('Archiv nicht lesbar'); }
  list.sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || (b.updated || 0) - (a.updated || 0));
  const box = $('liste'); box.innerHTML = list.length ? '' : '<div class="hint">Noch keine Rapporte gespeichert.</div>';
  list.forEach(r => {
    const d = document.createElement('div'); d.className = 'it';
    const badge = r.status === 'versendet' ? '<span class="badge v">versendet</span>' : '<span class="badge">' + (r.status === 'pdf' ? 'PDF erstellt' : 'Entwurf') + '</span>';
    d.innerHTML = `<div class="m"><b>${esc(fmtDate(r.datum))} – ${esc(r.objekt || 'ohne Objekt')}</b><span class="hint">${esc(r.nr || '')}${r.mitarbeiter ? ' · ' + esc(r.mitarbeiter) : ''}${r.fotos && r.fotos.length ? ' · ' + r.fotos.length + ' Foto(s)' : ''}</span>${badge}</div>
      <div class="bar" style="margin:0;flex-wrap:nowrap"><button class="btn sec o" type="button">Öffnen</button><button class="btn sec p" type="button">PDF</button><button class="btn red d" type="button" aria-label="Löschen">✕</button></div>`;
    d.querySelector('.o').onclick = async () => {
      if (dirty) { try { await save(true); } catch(e){} }
      fill(r); show('neu'); window.scrollTo(0, 0);
    };
    d.querySelector('.p').onclick = () => makePDF(r);
    d.querySelector('.d').onclick = async () => {
      if (!confirm('Rapport „' + (r.objekt || r.nr || 'ohne Titel') + '“ endgültig löschen?')) return;
      await DB.del(r.id); if (cur.id === r.id){ fresh(); } renderArchiv();
    };
    box.appendChild(d);
  });
}

/* ---------- PDF ---------- */
const hexRGB = h => { h = String(h || '#1f4e79').replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) || 0); };

function buildPDF(r){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210, M = 15, CW = 180, LIM = 281;
  const acc = hexRGB(eff('farbe')); const light = acc.map(c => Math.round(c + (255 - c) * 0.88));
  const firma = eff('firma'), kontakt = eff('kontakt');
  let y = 0;

  const head = () => {
    doc.setTextColor(...acc);
    if (LOGO){
      const k = Math.min(58 / LOGO.w, 16 / LOGO.h);
      doc.addImage(LOGO.url, 'PNG', M, 7, LOGO.w * k, LOGO.h * k, undefined, 'FAST');
    } else { doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(firma, M, 14); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('TAGESRAPPORT', W - M, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    if (r.nr) doc.text('Nr. ' + r.nr, W - M, 18.5, { align: 'right' });
    doc.setFontSize(8); doc.text(doc.splitTextToSize(kontakt || '', CW)[0] || '', M, 26);
    doc.setDrawColor(...acc); doc.setLineWidth(.6); doc.line(M, 29, W - M, 29); doc.setLineWidth(.2);
    doc.setTextColor(0); y = 36;
  };
  const need = h => { if (y + h > LIM){ doc.addPage(); head(); } };
  const h2 = t => {
    need(16); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...acc); doc.text(t, M, y);
    doc.setDrawColor(...acc); doc.line(M, y + 1.5, W - M, y + 1.5); doc.setTextColor(0); y += 7;
  };
  const para = t => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.splitTextToSize(t || '–', CW).forEach(l => { need(5); doc.text(l, M, y); y += 5; });
    y += 6;
  };
  const cellRow = cells => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const prep = cells.map(c => ({ ...c, w: CW * c.f, lines: doc.splitTextToSize(c.v || '–', CW * c.f - 4) }));
    const h = Math.max(...prep.map(c => c.lines.length)) * 4.6 + 8.2; need(h); let x = M;
    prep.forEach(c => {
      doc.setDrawColor(200); doc.rect(x, y, c.w, h);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(110); doc.text(c.l.toUpperCase(), x + 2, y + 3.6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(0); doc.text(c.lines, x + 2, y + 8.2);
      x += c.w;
    });
    y += h;
  };
  const table = (title, list) => {
    h2(title);
    if (!list.length){ para('Keine Angaben.'); return; }
    const NW = 124;
    const row = (a, b, c, d, hdr) => {
      const setF = () => { doc.setFont('helvetica', hdr ? 'bold' : 'normal'); doc.setFontSize(10); };
      setF(); const lines = doc.splitTextToSize(b, NW); const h = lines.length * 4.8 + 2.6;
      if (y + h > LIM){ doc.addPage(); head(); if (!hdr) row('Pos', 'Bezeichnung', 'Menge', 'Einheit', true); setF(); }
      if (hdr){ doc.setFillColor(...light); doc.rect(M, y, CW, h, 'F'); }
      doc.setTextColor(0); const ty = y + 4.8;
      doc.text(a, M + 1.5, ty); doc.text(lines, M + 11, ty); doc.text(c, M + CW - 28, ty, { align: 'right' }); doc.text(d, M + CW - 24, ty);
      y += h; if (!hdr){ doc.setDrawColor(220); doc.line(M, y, W - M, y); }
    };
    row('Pos', 'Bezeichnung', 'Menge', 'Einheit', true);
    list.forEach((x, i) => row(String(i + 1), x.name, x.menge == null ? '–' : fmtNum(x.menge), x.einheit || '', false));
    y += 9;
  };

  head();
  let zeit = '–';
  if (r.von && r.bis){
    const tm = x => { const [h, m] = x.split(':'); return +h * 60 + +m; };
    const mins = tm(r.bis) - tm(r.von) - (num(r.pause) || 0);
    zeit = `${r.von}–${r.bis} Uhr` + (r.pause ? `, Pause ${r.pause} Min.` : '') + (mins > 0 ? ` = ${Math.floor(mins / 60)} Std ${pad(mins % 60)} Min` : '');
  } else if (r.von || r.bis) zeit = (r.von ? 'ab ' + r.von : 'bis ' + r.bis) + ' Uhr';
  cellRow([{ l: 'Datum', v: fmtDate(r.datum), f: .30 }, { l: 'Rapport-Nr.', v: r.nr, f: .30 }, { l: 'Projekt-/Auftrags-Nr.', v: r.projekt, f: .40 }]);
  cellRow([{ l: 'Objekt / Baustelle', v: r.objekt, f: .60 }, { l: 'Wetter', v: r.wetter, f: .40 }]);
  cellRow([{ l: 'Adresse der Baustelle', v: r.adresse, f: .50 }, { l: 'Auftraggeber / Kunde', v: r.kunde, f: .50 }]);
  cellRow([{ l: 'Bauleiter / Ansprechpartner', v: r.bauleiter, f: .50 }, { l: 'Mitarbeiter', v: r.mitarbeiter, f: .50 }]);
  cellRow([{ l: 'Arbeitszeit', v: zeit, f: 1 }]);
  y += 7;

  h2('Ausgeführte Arbeiten'); para(r.taetigkeit);
  table('Verbrauchte Werkstoffe / Material', r.material || []);
  table('Eingesetzte Geräte / Maschinen', r.geraete || []);
  if (r.bemerkung){ h2('Bemerkungen'); para(r.bemerkung); }

  if (r.fotos && r.fotos.length){
    need(70); h2('Fotodokumentation');
    const pw = (CW - 6) / 2;
    const dim = p => { const ph = Math.min(pw * (p.h / p.w), 95); return { ph, w: ph / (p.h / p.w) }; };
    for (let i = 0; i < r.fotos.length; i += 2){
      const pair = r.fotos.slice(i, i + 2); const ds = pair.map(dim);
      const caps = pair.map(p => p.text ? doc.splitTextToSize(p.text, pw).slice(0, 2) : []);
      const rowH = Math.max(...ds.map(d => d.ph)) + Math.max(...caps.map(c => c.length)) * 3.8 + 6;
      need(rowH);
      pair.forEach((p, j) => {
        const x = M + j * (pw + 6);
        doc.addImage(p.data, 'JPEG', x, y, ds[j].w, ds[j].ph, undefined, 'FAST');
        if (caps[j].length){ doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60); doc.text(caps[j], x, y + ds[j].ph + 4); doc.setTextColor(0); }
      });
      y += rowH;
    }
  }

  need(52); y += 2; h2('Unterschriften');
  const bw = (CW - 10) / 2; const top = y;
  [[r.sig1, 'Mitarbeiter / Bauleiter' + (r.mitarbeiter ? ': ' + r.mitarbeiter : ''), M], [r.sig2, 'Kunde / Auftraggeber' + (r.kundeName ? ': ' + r.kundeName : ''), M + bw + 10]].forEach(([img, lbl, x]) => {
    doc.setDrawColor(150); doc.rect(x, top, bw, 28);
    if (img){ try { doc.addImage(img, 'PNG', x + 1, top + 1, bw - 2, 26, undefined, 'FAST'); } catch(e){} }
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(60); doc.text(doc.splitTextToSize(lbl, bw)[0], x, top + 33); doc.setTextColor(0);
  });
  doc.setFontSize(8); doc.setTextColor(110); doc.text('Datum: ' + fmtDate(r.datum), M, top + 39); doc.setTextColor(0);

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++){
    doc.setPage(i); doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(130);
    doc.text(`${firma} · Tagesrapport ${fmtDate(r.datum)}${r.nr ? ' · ' + r.nr : ''}`, M, 291);
    doc.text(`Seite ${i} von ${n}`, W - M, 291, { align: 'right' });
  }
  return doc;
}

/* ---------- PDF-Ausgabe: Teilen / Mail / Speichern ---------- */
let pack = null;
async function makePDF(r){
  let doc;
  toast('PDF wird erstellt …', 1500);
  await new Promise(res => setTimeout(res, 30));
  try { doc = buildPDF(r); } catch(e){ console.error(e); return toast('PDF-Erstellung fehlgeschlagen: ' + e.message, 6000); }
  const safe = (r.objekt || 'Rapport').replace(/[^\wäöüÄÖÜß\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'Rapport';
  const name = `Tagesrapport_${r.datum || today()}_${safe}.pdf`;
  const blob = doc.output('blob'); const file = new File([blob], name, { type: 'application/pdf' });
  const subject = `Tagesrapport ${fmtDate(r.datum)}${r.nr ? ' (' + r.nr + ')' : ''}${r.objekt ? ' – ' + r.objekt : ''}`;
  const body = `Guten Tag,\n\nanbei der Tagesrapport vom ${fmtDate(r.datum)}${r.objekt ? ' für ' + r.objekt : ''}.\n\nMit freundlichen Grüßen\n${r.mitarbeiter || eff('firma')}`;
  if (pack && pack.url) URL.revokeObjectURL(pack.url);
  pack = { r, blob, file, name, subject, body, url: URL.createObjectURL(blob) };
  $('mInfo').textContent = `${name} · ${Math.round(blob.size / 1024)} KB`;
  $('mShare').classList.toggle('hide', !(navigator.canShare && navigator.canShare({ files: [file] })));
  $('modal').style.display = 'flex';
}
async function setStatus(st){
  if (!pack) return; const r = pack.r;
  if (r.status === 'versendet') return;
  r.status = st; if (cur.id === r.id) cur.status = st;
  try { const stored = r.id === cur.id ? collect() : r; stored.status = st; await DB.put(stored); } catch(e){}
}
$('mClose').onclick = () => { $('modal').style.display = 'none'; };
$('modal').onclick = e => { if (e.target === $('modal')) $('modal').style.display = 'none'; };
$('mShare').onclick = async () => {
  try { await navigator.share({ files: [pack.file], title: pack.subject, text: pack.body }); await setStatus('versendet'); $('modal').style.display = 'none'; toast('Geteilt'); }
  catch(e){ if (e && e.name !== 'AbortError') toast('Teilen nicht möglich – bitte „PDF speichern“ nutzen.', 5000); }
};
$('mMail').onclick = async () => {
  const to = S.get().mail || '';
  await setStatus('versendet');
  location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(pack.subject)}&body=${encodeURIComponent(pack.body + '\n\n(PDF „' + pack.name + '“ bitte anhängen)')}`;
  toast('Mail-Entwurf geöffnet – PDF bitte anhängen (vorher „PDF speichern“).', 6000);
};
$('mView').onclick = () => { const w = window.open(pack.url, '_blank'); if (!w) toast('Ansicht blockiert – bitte „PDF speichern“ nutzen.', 4500); };
$('mSave').onclick = async () => {
  const a = document.createElement('a'); a.href = pack.url; a.download = pack.name; document.body.appendChild(a); a.click(); a.remove();
  await setStatus('pdf'); toast('PDF gespeichert (Ordner „Downloads“ / „Dateien“).', 4000);
};
$('send').onclick = async () => {
  let r;
  try { r = await save(true); } catch(e){ r = collect(); }
  if (!hasContent(r)) return toast('Der Rapport ist noch leer.');
  if (!r.sig1 && !confirm('Es fehlt die Unterschrift des Mitarbeiters. Trotzdem PDF erstellen?')) return;
  makePDF(r);
};

/* ---------- Navigation & Einstellungen ---------- */
let view = 'neu';
function show(v){
  if (view === 'neu' && v !== 'neu' && dirty) save(true).catch(() => {});
  if (activeMic && v !== 'neu') activeMic.stop();
  view = v;
  ['neu', 'archiv', 'set'].forEach(k => $('v-' + k).classList.toggle('hide', k !== v));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('bottom').classList.toggle('hide', v !== 'neu');
  if (v === 'archiv') renderArchiv();
  if (v === 'neu') requestAnimationFrame(() => { sig1.size(); sig2.size(); sig1.load(sig1.url); sig2.load(sig2.url); });
  if (v === 'set'){
    const s = S.get();
    $('s_firma').value = s.firma ?? DEF.firma; $('s_kontakt').value = s.kontakt ?? DEF.kontakt; $('s_farbe').value = s.farbe || DEF.farbe;
    $('s_logourl').value = s.logourl || DEF.logourl; $('s_ma').value = s.ma || ''; $('s_mail').value = s.mail || ''; $('s_key').value = s.key || '';
    const lp = $('logoPrev'); if (LOGO){ lp.src = LOGO.url; lp.style.display = 'block'; } else lp.style.display = 'none';
    $('ver').textContent = 'Version ' + VERSION;
  }
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav button').forEach(b => b.onclick = () => show(b.dataset.v));
$('saveSet').onclick = () => {
  const ok = S.set({ firma: $('s_firma').value.trim(), kontakt: $('s_kontakt').value.trim(), farbe: $('s_farbe').value, logourl: $('s_logourl').value.trim(), ma: $('s_ma').value.trim(), mail: $('s_mail').value.trim(), key: $('s_key').value.trim() });
  applyBranding(); toast(ok ? 'Einstellungen gespeichert' : 'Speichern nicht möglich (Speicher voll?)');
};
$('logoBtn').onclick = () => $('logoFile').click();
$('logoWeb').onclick = async () => {
  const cur = S.get(); S.set({ ...cur, logourl: $('s_logourl').value.trim() });
  const b = $('logoWeb'); b.disabled = true; toast('Logo wird geladen …', 1800);
  const ok = navigator.onLine && await fetchWebLogo(); b.disabled = false;
  if (ok){ $('logoPrev').src = LOGO.url; $('logoPrev').style.display = 'block'; toast('Logo von der Webseite geladen'); }
  else toast('Logo konnte nicht geladen werden (kein Internet oder Seite sperrt den Zugriff). Bitte „Logo auswählen“ nutzen.', 6000);
};
$('logoFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const u = URL.createObjectURL(f);
  try {
    const l = await imgToLogo(u);
    try { localStorage.setItem('rp_logo', l.url); } catch(err){ return toast('Logo konnte nicht gespeichert werden.', 4000); }
    LOGO = l; applyBranding(); $('logoPrev').src = l.url; $('logoPrev').style.display = 'block'; toast('Logo gespeichert');
  } catch(err){ toast('Bild konnte nicht gelesen werden. Bitte PNG oder JPG wählen.', 4500); }
  finally { URL.revokeObjectURL(u); }
};
$('logoDel').onclick = async () => { try { localStorage.removeItem('rp_logo'); } catch(e){} LOGO = null; await loadLogo(); $('logoPrev').style.display = LOGO ? 'block' : 'none'; if (LOGO) $('logoPrev').src = LOGO.url; toast('Logo entfernt'); };

/* ---------- Installations-Hinweis ---------- */
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let deferredInstall = null;
function showInstall(html, withBtn){
  if (standalone || localStorage.getItem('rp_inst') === '1') return;
  const el = $('inst'); el.style.display = 'block';
  el.innerHTML = html + `<div class="bar">${withBtn ? '<button class="btn" id="instGo" type="button">Jetzt installieren</button>' : ''}<button class="btn sec" id="instX" type="button">Ausblenden</button></div>`;
  $('instX').onclick = () => { el.style.display = 'none'; try { localStorage.setItem('rp_inst', '1'); } catch(e){} };
  if (withBtn) $('instGo').onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch(e){} deferredInstall = null; el.style.display = 'none'; };
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; showInstall('📲 <b>App installieren</b> – startet wie eine normale App, auch ohne Netz.', true); });
window.addEventListener('appinstalled', () => { $('inst').style.display = 'none'; toast('App installiert'); });
if (isIOS && !standalone) showInstall('📲 <b>Auf dem iPhone installieren:</b> unten auf das Teilen-Symbol tippen und „Zum Home-Bildschirm“ wählen. (Nur in Safari möglich.)', false);

/* ---------- Auto-Entwurf ---------- */
$('v-neu').addEventListener('input', markDirty);
$('v-neu').addEventListener('change', markDirty);
setInterval(() => { if (dirty && view === 'neu') save(true).catch(() => {}); }, 20000);
document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) save(true).catch(() => {}); });
window.addEventListener('pagehide', () => { if (dirty) save(true).catch(() => {}); });
window.addEventListener('resize', () => { if (view === 'neu'){ sig1.size(); sig2.size(); } });

/* ---------- Start ---------- */
(async () => {
  applyBranding();
  let resumed = false;
  try {
    const all = (await DB.all()) || [];
    const last = all.sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
    if (last && last.status === 'entwurf' && last.datum === today() && hasContent(last)){ fill(last); resumed = true; }
  } catch(e){}
  if (!resumed) fresh();
  requestAnimationFrame(() => { sig1.size(); sig2.size(); sig1.load(sig1.url); sig2.load(sig2.url); });
  loadLogo();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
