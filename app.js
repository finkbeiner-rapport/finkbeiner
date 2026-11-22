'use strict';
/* Tagesrapport – Fliesen Finkbeiner | eigenständige PWA (iPhone + Android) */

const VERSION = '3.0';
const $ = id => document.getElementById(id);
const MAT_UNITS = ['m²','lfm','m','kg','g','l','Stk','Kartusche','Sack','Eimer','Pkt','Gebinde','m³','t'];
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

/* ---------- Arbeitszeit ---------- */
const tmin = x => { const p = String(x || '').split(':'); return p.length === 2 && p[0] !== '' && p[1] !== '' ? +p[0] * 60 + +p[1] : NaN; };
function workTime(r){
  const names = splitNames(r.mitarbeiter); const ov = r.maStd || {};
  const calc = (von, bis, pause) => { const a = tmin(von), b = tmin(bis); if (isNaN(a) || isNaN(b)) return 0; const m = b - a - (num(pause) || 0); return m > 0 ? m : 0; };
  const list = (names.length ? names : ['']).map(n => {
    const o = (ov[n] && typeof ov[n] === 'object') ? ov[n] : {};
    const von = o.von || r.von || '', bis = o.bis || r.bis || '', pause = (o.pause !== undefined && o.pause !== '') ? o.pause : (r.pause || '');
    return { name: n, von, bis, pause, mins: calc(von, bis, pause), own: !!(o.von || o.bis || (o.pause !== undefined && o.pause !== '')) };
  });
  const man = list.reduce((s, x) => s + x.mins, 0); if (!man) return null;
  return { mins: calc(r.von, r.bis, r.pause) || list[0].mins, n: list.length, list, man };
}
const fmtHM = m => Math.floor(m / 60) + ' Std ' + String(Math.round(m % 60)).padStart(2, '0') + ' Min';
const fmtDec = m => (Math.round(m / 6) / 10).toFixed(1).replace('.', ',') + ' Std';
const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const curWT = () => workTime({ von: $('von').value, bis: $('bis').value, pause: $('pause').value, mitarbeiter: $('mitarbeiter').value, maStd: cur.maStd });
function updateStd(){
  const el = $('stdInfo'); if (!el || el.contains(document.activeElement)) return;
  const names = splitNames($('mitarbeiter').value); const ov = cur.maStd || {};
  let h = '';
  if (names.length){
    h += '<div class="hint" style="margin:0 0 4px">Jeder Mitarbeiter stempelt für sich. Leere Felder übernehmen Beginn/Ende/Pause von oben.</div>';
    names.forEach(n => {
      const o = (ov[n] && typeof ov[n] === 'object') ? ov[n] : {};
      h += `<div class="mst" data-n="${esc(n)}"><b>${esc(n)}</b>
        <div class="mrow"><button class="btn sec" type="button" data-k="von">▶ Kommen</button><input type="time" data-f="von" value="${esc(o.von || '')}">
        <button class="btn sec" type="button" data-k="bis">■ Gehen</button><input type="time" data-f="bis" value="${esc(o.bis || '')}">
        <input type="number" inputmode="numeric" data-f="pause" min="0" placeholder="Pause" value="${esc(o.pause === undefined ? '' : o.pause)}"></div>
        <div class="mh"></div></div>`;
    });
  }
  h += '<div id="stdTot"></div>';
  el.innerHTML = h; stdRefresh();
  el.querySelectorAll('.mst').forEach(row => {
    const n = row.dataset.n;
    const set = (f, v) => { cur.maStd = cur.maStd || {}; const o = (cur.maStd[n] && typeof cur.maStd[n] === 'object') ? cur.maStd[n] : (cur.maStd[n] = {}); o[f] = v; markDirty(); stdRefresh(); };
    row.querySelectorAll('input').forEach(inp => ['input', 'change'].forEach(ev => inp.addEventListener(ev, () => set(inp.dataset.f, inp.value))));
    row.querySelectorAll('button').forEach(btn => btn.onclick = () => { const f = btn.dataset.k, t = nowHM(); row.querySelector(`input[data-f="${f}"]`).value = t; set(f, t); toast(n + (f === 'von' ? ' ist gekommen: ' : ' ist gegangen: ') + t, 2500); });
  });
}
function stdRefresh(){
  const el = $('stdInfo'); if (!el) return; const t = $('stdTot'); if (!t) return;
  const w = curWT();
  el.querySelectorAll('.mst').forEach(row => {
    const x = w && w.list.find(y => y.name === row.dataset.n); const m = row.querySelector('.mh');
    m.textContent = x && x.mins ? `${x.von}–${x.bis} Uhr${x.pause ? ', Pause ' + x.pause + ' Min.' : ''} = ${fmtHM(x.mins)} (${fmtDec(x.mins)})` : 'Zeit noch nicht erfasst';
  });
  t.innerHTML = w ? `<b>Gesamtstunden${w.n > 1 ? ' (alle Mitarbeiter)' : ''}: ${fmtHM(w.man)} (${fmtDec(w.man)})</b>` : 'Gesamtstunden: Beginn und Ende eintragen oder stempeln.';
}
['von', 'bis', 'pause'].forEach(id => ['input', 'change'].forEach(ev => $(id).addEventListener(ev, () => { if ($('stdTot')) stdRefresh(); else updateStd(); })));
$('mitarbeiter').addEventListener('input', updateStd);
$('mitarbeiter').addEventListener('input', () => {});

/* ---------- Zustand ---------- */
let cur = { id: uid(), fotos: [], status: 'entwurf' };
let dirty = false;
const markDirty = () => { dirty = true; };
const FIELDS = ['datum','nr','objekt','projekt','wetter','adresse','kunde','bauleiter','mitarbeiter','von','bis','pause','anfahrt','anfahrtInfo','diktat','taetigkeit','bemerkung','kundeName'];

function collect(){
  const r = { id: cur.id, fotos: cur.fotos, status: cur.status || 'entwurf', created: cur.created || Date.now() };
  FIELDS.forEach(f => r[f] = $(f).value.trim ? $(f).value.trim() : $(f).value);
  r.diktat = $('diktat').value; r.taetigkeit = $('taetigkeit').value; r.bemerkung = $('bemerkung').value;
  r.material = rows('mat'); r.geraete = rows('ger');
  r.sig1 = sig1.data(); r.sig2 = sig2.data();
  r.maStd = cur.maStd || {}; r.updated = Date.now();
  return r;
}
function hasContent(r){
  return !!(r.objekt || r.projekt || r.kunde || r.adresse || r.diktat || r.taetigkeit || r.bemerkung ||
    (r.material || []).length || (r.geraete || []).length || (r.fotos || []).length || r.sig1 || r.sig2);
}
function fill(r){
  cur = { id: r.id, fotos: r.fotos || [], status: r.status || 'entwurf', created: r.created, maStd: r.maStd || {} };
  FIELDS.forEach(f => $(f).value = r[f] || '');
  $('mat').innerHTML = ''; $('ger').innerHTML = '';
  (r.material || []).forEach(m => addRow('mat', m));
  (r.geraete || []).forEach(m => addRow('ger', m));
  if (!(r.material || []).length) addRow('mat');
  if (!(r.geraete || []).length) addRow('ger');
  renderPhotos();
  sig1.load(r.sig1 || ''); sig2.load(r.sig2 || '');
  updateStd();
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
  el.innerHTML = `<input class="n" list="dl-${kind}" placeholder="${kind === 'mat' ? 'Material' : 'Gerät'}" value="${esc(d.name || '')}" autocomplete="off">
    <input class="q" inputmode="decimal" placeholder="Menge" value="${esc(fmtNum(d.menge))}">
    <select class="u">${u.map(x => `<option${x === (d.einheit || u[0]) ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
    <button class="x" type="button" aria-label="Zeile entfernen">✕</button>`;
  el.dataset.orig = d.raw || '';
  if (d.keepUnit) el.dataset.u = '1';
  el.querySelector('.x').onclick = () => { el.remove(); markDirty(); };
  el.querySelector('.n').addEventListener('change', () => onRowName(kind, el));
  el.querySelector('.u').addEventListener('change', () => {
    el.dataset.u = '1'; const nm = el.querySelector('.n').value.trim();
    if (nm){ const m = canonName(kind, nm); D.get().units[kind][sq(m && m.len >= 4 ? m.e.n : nm)] = el.querySelector('.u').value; D.save(); }
    markDirty();
  });
  $(kind).appendChild(el);
}
/* Name geändert: Fachbegriff erkennen/korrigieren, Einheit vorschlagen, Korrektur merken */
function onRowName(kind, el){
  const n = el.querySelector('.n'), sel = el.querySelector('.u'); const v = n.value.trim(); if (!v) return;
  const m = canonName(kind, v); let final = v;
  if (m && m.len >= 4){
    final = m.e.n + (m.rest ? ' ' + m.rest : '');
    if (!el.dataset.u){
      if (![...sel.options].some(o => o.value === m.e.u)) sel.add(new Option(m.e.u, m.e.u));
      sel.value = m.e.u;
    }
  }
  n.value = final;
  if (!m || m.len < 4){
    const d = D.get(); if (final.length >= 3 && !d.custom[kind].some(c => sq(c.n) === sq(final))){ d.custom[kind].push({ n: final, u: sel.value }); D.save(); toast('Neu gelernt: „' + final + '“ (' + sel.value + ')'); }
  }
  const orig = (el.dataset.orig || '').trim();
  if (orig && sq(orig) !== sq(final)){ D.get().alias[kind][orig.toLowerCase()] = { n: m && m.len >= 4 ? m.e.n : final, u: sel.value }; D.save(); toast('Gemerkt: „' + orig + '“ → „' + final + '“'); }
  markDirty();
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
      area.value = base + (interim ? (base ? ' ' : '') + interim : ''); markDirty(); liveScan();
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

/* ---------- Gespeicherte Listen & Gelerntes ---------- */
const D = (() => {
  const KEY = 'rp_data'; let c = null;
  const def = () => ({ kunden: [], ma: [], custom: { mat: [], ger: [] }, alias: { mat: {}, ger: {} }, units: { mat: {}, ger: {} }, use: { mat: {}, ger: {} }, vocab: {} });
  const load = () => {
    if (c) return c;
    let s = {}; try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e){}
    c = Object.assign(def(), s);
    ['custom', 'alias', 'units', 'use'].forEach(k => { c[k] = Object.assign(def()[k], s[k] || {}); });
    return c;
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch(e){} CAT.invalidate(); refreshDatalists(); };
  return { get: load, save };
})();

/* ---------- Katalog & Erkennung ---------- */
const UNIT_MAP = [
  [/^(m²|m2|qm|quadratmeter)$/i, 'm²'], [/^(lfm|lfdm|laufende[nr]? meter|lfd\.? ?m)$/i, 'lfm'],
  [/^(m³|m3|kubikmeter|cbm)$/i, 'm³'], [/^(meter|m)$/i, 'm'], [/^(kg|kilo|kilogramm)$/i, 'kg'],
  [/^(g|gramm)$/i, 'g'], [/^(l|liter)$/i, 'l'], [/^(stk|stück|stueck|st|rollen?)$/i, 'Stk'], [/^(tube|tuben|kartuschen?)$/i, 'Kartusche'],
  [/^(sack|säcke|saecke)$/i, 'Sack'], [/^(eimer)$/i, 'Eimer'], [/^(pkt|paket|pakete|packung|packungen)$/i, 'Pkt'],
  [/^(gebinde|kanister)$/i, 'Gebinde'], [/^(t|tonnen?)$/i, 't'],
  [/^(std|stunden?|h)$/i, 'Std'], [/^(tage?|tag)$/i, 'Tage'], [/^(min|minuten)$/i, 'Min']
];
function normUnit(u){ if (!u) return null; u = String(u).trim(); for (const [re, n] of UNIT_MAP) if (re.test(u)) return n; return null; }
const UNITRE = 'm²|m2|m³|m3|qm|quadratmeter|kubikmeter|lfm|lfdm|laufende[nr]? meter|kilogramm|kilo|kg|gramm|liter|stück|stk|säcke|sack|eimer|pakete|paket|packungen|packung|tuben|tube|kartuschen|kartusche|rollen|rolle|gebinde|kanister|tonnen|stunden|stunde|std|minuten|min|tage|tag|meter|m|g|l|t|h';
const GERAET_RE = /(schneider|rührgerät|ruehrgeraet|rührer|bohrmaschine|bohrhammer|gerüst|gerueste|mischer|rüttler|rüttelplatte|schleifer|flex|laser|kompressor|sauger|staubsauger|leiter|hubwagen|kran|aufzug|maschine|gerät|wasserwaage|pumpe|heizer|trockner)/i;
const NUM_WORDS = { ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12 };
const NUMWORD_RE = new RegExp('\\b(ein|eine|einen|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\\b(?=\\s+(?:' + UNITRE + ')(?=[\\s,.;:)]|$))', 'gi');
const VERB_RE = /\s+(?:verlegt|verbraucht|benutzt|verwendet|eingesetzt|gebraucht|wurde|wurden|gefliest|gelegt|geklebt|verfugt|angemischt|montiert|eingebaut|gesetzt|abgedichtet|gespachtelt|verarbeitet)\b.*$/i;
const STOP_RE = /\s+(?:und|sowie|anschließend|anschliessend|danach|dann|außerdem|ausserdem|wir|haben|hat|mit|dem|der|den|wurde|wurden|wurd|ist|sind|noch|dazu|zusätzlich)\b.*$/i;
const FILLER_RE = /^(?:ca\.?|circa|etwa|ungefähr|insgesamt|noch|weitere?n?|zusätzlich|nochmal|davon|von|an|vom|der|die|das|des|und|sowie|verlegt|verbraucht|benutzt|verwendet|eingesetzt|wurden|wurde)\s+/i;
const cap = n => n.charAt(0).toUpperCase() + n.slice(1);
const sq = s => String(s || '').toLowerCase().replace(/ß/g, 'ss').replace(/[^a-z0-9äöü]/g, '');
const escRe = c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termBody = t => [...sq(t)].map(escRe).join('[\\s\\-]?');
const splitNames = s => String(s || '').split(/,|;|&|\sund\s/i).map(x => x.trim()).filter(Boolean);
function lev(a, b){
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++){ const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[n];
}

const CAT = (() => {
  let cache = {};
  const build = kind => {
    const d = D.get();
    const dflt = kind === 'mat' ? 'Stk' : 'Std';
    const entries = KATALOG[kind].map(([g, n, u, al]) => ({ g, n, u, kind, terms: [n].concat(al ? al.split('|') : []) }));
    const byName = new Map(entries.map(e => [sq(e.n), e]));
    const ensure = (n, u) => { let e = byName.get(sq(n)); if (!e){ e = { g: 'Eigene', n, u: u || dflt, kind, custom: true, terms: [n] }; entries.push(e); byName.set(sq(n), e); } return e; };
    d.custom[kind].forEach(c => ensure(c.n, c.u));
    Object.entries(d.alias[kind]).forEach(([raw, t]) => { ensure(t.n, t.u).terms.push(raw); });
    entries.forEach(e => {
      const pu = d.units[kind][sq(e.n)]; if (pu) e.u = pu;
      e.tt = e.terms.map(t => { const s = sq(t); const body = termBody(t); return { t, s, body, re: '(^|[^a-zäöüß0-9])(' + body + ')(?:n|en|e|s|er|es)?(?![a-zäöüß])' }; }).filter(x => x.s.length >= 3);
    });
    return entries;
  };
  return { get(kind){ return cache[kind] || (cache[kind] = build(kind)); }, invalidate(){ cache = {}; } };
})();

function canonName(kind, raw){
  raw = String(raw || '').trim(); if (!raw) return null;
  const entries = CAT.get(kind); let best = null;
  for (const e of entries) for (const x of e.tt){
    const m = new RegExp(x.re, 'i').exec(raw);
    if (m && (!best || x.s.length > best.len)) best = { e, len: x.s.length, m };
  }
  if (best){
    const m = best.m; const start = m.index + m[1].length, end = m.index + m[0].length;
    return { e: best.e, len: best.len, rest: (raw.slice(0, start) + ' ' + raw.slice(end)).replace(/\s+/g, ' ').trim() };
  }
  const s = sq(raw);
  if (s.length >= 6){
    let bd = 9, be = null;
    for (const e of entries) for (const x of e.tt){
      if (Math.abs(x.s.length - s.length) > 2) continue;
      const d = lev(s, x.s), lim = s.length >= 10 ? 2 : 1;
      if (d <= lim && d < bd){ bd = d; be = e; }
    }
    if (be) return { e: be, len: s.length, rest: '' };
  }
  return null;
}
function canonAny(raw){
  const a = canonName('ger', raw), b = canonName('mat', raw);
  if (a && b) return a.len >= b.len ? a : b; return a || b;
}
function specOf(rest){
  const m = String(rest || '').match(/\d+(?:[.,]\d+)?\s?[x×]\s?\d+(?:\s?[x×]\s?\d+)?(?:\s?(?:cm|mm))?|\d+\s?(?:cm|mm)\b/i);
  return m ? m[0].replace(/\s+/g, '').replace('×', 'x') : '';
}

/* Fachbegriffe richtig schreiben (Zusammenschreibung, Groß-/Kleinschreibung) + eigene Korrekturen */
function applyVocab(text){
  let t = String(text || '');
  Object.entries(D.get().vocab).forEach(([from, to]) => {
    const re = new RegExp('(^|[^A-Za-zÄÖÜäöüß0-9])' + escRe(from) + '(?![A-Za-zÄÖÜäöüß0-9])', 'gi');
    t = t.replace(re, (m, p) => p + to);
  });
  ['ger', 'mat'].forEach(k => CAT.get(k).forEach(e => {
    if (e.n.length < 7 || e.n === 'Fliesen') return;
    const re = new RegExp('(^|[^a-zäöüß0-9])(' + termBody(e.n) + ')(?![a-zäöüß])', 'gi');
    t = t.replace(re, (m, p, w) => w === e.n ? m : p + e.n);
  }));
  return t;
}

/* Tätigkeit -> Gerät (Wortstämme) */
const VERB_GER = [
  [/(abgesaugt|absaug|aufgesaugt|gesaugt|staubgesaugt|saugen)/i, 'Bausauger'],
  [/(zugeschnitten|geschnitten|zuschnitt|zugeschnitt|gesägt)/i, 'Fliesenschneider'],
  [/(gebohrt|gebohrten|durchbohrt|löcher gebohrt)/i, 'Bohrmaschine'],
  [/(angerührt|angemischt|angeruehrt|gerührt|aufgerührt|angemixt)/i, 'Rührgerät'],
  [/(gestemmt|gemeißelt|gemeisselt|aufgestemmt|abgestemmt|aufgeschlagen|abgeschlagen)/i, 'Bohrhammer'],
  [/(geflext|abgeflext|angeflext)/i, 'Winkelschleifer'],
  [/(nivelliert|ausgelasert|eingelasert|mit laser)/i, 'Rotationslaser'],
  [/(getrocknet|trocknung|aufgeheizt)/i, 'Bautrockner']
];
function parseAnfahrt(t){
  t = String(t || ''); let an = '', info = '';
  if (/(keine|ohne|ohne eine|nicht)\s+(anfahrt|anreise|anfahrtskosten)|anfahrt\s*(nein|entfällt|entfaellt|keine)/i.test(t)) an = 'Nein';
  else if (/(anfahrt|angefahren|anreise|angereist|hinfahrt|rückfahrt|fahrzeit)/i.test(t)) an = 'Ja';
  if (an === 'Ja'){
    const m = t.match(/(?:anfahrt|anreise|fahrzeit|hinfahrt)\D{0,25}?(\d+(?:[.,]\d+)?)\s*(km|kilometer|minuten|min|stunden|std|h)\b/i) || t.match(/(\d+(?:[.,]\d+)?)\s*(km|kilometer|minuten|min|stunden|std|h)\s*(?:anfahrt|anreise|fahrzeit)/i);
    if (m) info = m[1].replace('.', ',') + ' ' + (/^(km|kilometer)$/i.test(m[2]) ? 'km' : /^(min|minuten)$/i.test(m[2]) ? 'Min.' : 'Std');
  }
  return { anfahrt: an, info };
}

/* Live-Erkennung beim Sprechen/Tippen: Anfahrt wird sofort eingetragen */
function liveScan(){
  try { liveGer(); } catch(e){}
  const an = parseAnfahrt($('diktat').value + ' ' + $('taetigkeit').value);
  const sel = $('anfahrt'), inf = $('anfahrtInfo');
  if (an.anfahrt && (!sel.value || sel.dataset.auto === '1') && sel.value !== an.anfahrt){
    sel.value = an.anfahrt; sel.dataset.auto = '1'; toast('Anfahrt erkannt: ' + an.anfahrt + (an.info ? ' (' + an.info + ')' : ''), 3000);
  }
  if (an.info && sel.dataset.auto === '1' && (!inf.value || inf.dataset.auto === '1')){ inf.value = an.info; inf.dataset.auto = '1'; }
}
function liveGer(){
  const text = $('diktat').value + ' ' + $('taetigkeit').value; cur.autoGer = cur.autoGer || [];
  VERB_GER.forEach(([re, name]) => {
    if (!re.test(text) || cur.autoGer.includes(name)) return;
    if (rows('ger').some(x => sq(x.name) === sq(name))){ cur.autoGer.push(name); return; }
    const e = CAT.get('ger').find(x => x.n === name); if (!e) return;
    cur.autoGer.push(name); const last = $('ger').lastElementChild;
    if (last && !last.querySelector('.n').value.trim()) last.remove();
    addRow('ger', { name: e.n, einheit: e.u === 'Tage' ? 'Tage' : 'Std', raw: e.n }); markDirty(); toast('Gerät erkannt: ' + e.n, 3000);
  });
}
$('anfahrt').addEventListener('change', () => { $('anfahrt').dataset.auto = ''; });
$('anfahrtInfo').addEventListener('input', () => { $('anfahrtInfo').dataset.auto = ''; });
['diktat', 'taetigkeit'].forEach(id => $(id).addEventListener('input', liveScan));

/* ---------- Auswertung (lokal): Katalog + Mustererkennung ---------- */
function parseLocal(text0){
  const text = applyVocab(text0);
  let t = text.replace(/\s+/g, ' ').replace(NUMWORD_RE, m => NUM_WORDS[m.toLowerCase()]).replace(/(\d)\s*(?:[x×]|mal)\s*(\d)/gi, '$1x$2');
  const out = { mat: [], ger: [] }; const seen = new Set(); const gebinde = {};
  const push = (kind, name, menge, unit, raw) => {
    if (kind === 'ger' && !GER_UNITS.includes(unit)) unit = 'Stk';
    const key = [kind, name.toLowerCase(), unit, menge].join('|'); if (seen.has(key)) return; seen.add(key);
    out[kind].push({ name, menge, einheit: unit, raw: raw || name });
  };
  // Gebinde: "3 Sack Fliesenkleber à 25 kg"  /  "3 Sack Fliesenkleber 25 kg"
  t = t.replace(/(\d+(?:[.,]\d+)?\s*(?:sack|säcke|eimer|pakete?|packungen?|kartuschen?|gebinde|kanister|rollen?)\s+)([^,.;:\d]*?)\s*(?:à|a|je|zu)?\s*(\d+(?:[.,]\d+)?)\s*(kg|l|g)\b/gi,
    (m, pre, nm, q, u) => { nm = nm.trim(); if (nm.length < 2) return m; gebinde[sq(nm)] = 'à ' + q + ' ' + u; return pre + nm; });

  // A) Katalogbegriff vor Menge: "Nassschneider 4 Stunden", "Fugenmasse 2 kg"
  const terms = [];
  ['ger', 'mat'].forEach(k => CAT.get(k).forEach(e => e.tt.forEach(x => terms.push({ e, x }))));
  terms.sort((a, b) => b.x.s.length - a.x.s.length);
  terms.forEach(({ e, x }) => {
    const re = new RegExp('(^|[^a-zäöüß0-9])(?:' + x.body + ')(?:n|en|e|s|er|es)?(?![a-zäöüß])\\s*[:=\\-–]?\\s*(?:von\\s+|je\\s+)?(\\d+(?:[.,]\\d+)?)\\s*(' + UNITRE + ')(?=[\\s,.;:)]|$)', 'gi');
    t = t.replace(re, (m, pre, q, u, off, whole) => { const un = normUnit(u); if (!un) return m;
      if (new RegExp('\\d\\s*(?:' + UNITRE + ')\\s*(?:von\\s+)?$', 'i').test(whole.slice(0, off + pre.length))) return m;
      push(e.kind, e.n, num(q), un, x.t); return pre + ' '; });
  });

  // B) Menge vor Name: "14 Quadratmeter Bodenfliesen 60x60", "4 Stunden Nassschneider"
  const reB = new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(' + UNITRE + ')(?=[\\s,.;:)]|$)\\s*((?:[^,.;:\\d]|\\d+x\\d+(?:x\\d+)?)*?)(?:\\s*(?:à|a)\\s*(\\d+(?:[.,]\\d+)?)\\s*(kg|l|g)\\b)?(?=[,.;:]|\\s+und\\s+\\d|\\s+\\d(?!\\d*x)|$)', 'gi');
  t = t.replace(reB, (m, q, u, nm, gq, gu) => {
    const unit = normUnit(u); nm = (nm || '').replace(/\s+/g, ' ').trim();
    if (!unit) return m; if (!nm) return ' ';
    let guard = 0; while (FILLER_RE.test(nm) && guard++ < 4) nm = nm.replace(FILLER_RE, '');
    const full = nm;
    let rawName = nm.replace(VERB_RE, '').replace(STOP_RE, '').trim();
    rawName = rawName.split(' ').slice(0, 5).join(' ');
    const leftover = full.slice(full.indexOf(rawName) + rawName.length);
    if (rawName.length < 2) return ' ';
    let name, kind; const r = canonAny(rawName);
    if (r){ const sp = specOf(r.rest); const col = (r.rest.match(/\b(grau|graue|graues|weiß|weiße|schwarz|schwarze|beige|anthrazit|braun|braune|creme|grün|blau|rot)\b/i) || [])[0]; name = r.e.n + (col ? ' ' + col.toLowerCase().replace(/e$/, '') : '') + (sp ? ' ' + sp : ''); kind = r.e.kind; }
    else { name = cap(rawName); kind = (['Std', 'Tage', 'Min'].includes(unit) || GERAET_RE.test(rawName)) ? 'ger' : 'mat'; }
    const g = gq ? 'à ' + gq + ' ' + gu : gebinde[sq(rawName)];
    if (g && kind === 'mat') name += ' (' + g + ')';
    push(kind, name, num(q), unit, rawName);
    return ' ' + leftover + ' ';
  });

  // C) Geräte ohne Mengenangabe ("Benutzt wurden Nassschneider und Rührgerät")
  CAT.get('ger').forEach(e => {
    if (out.ger.some(x => sq(x.name) === sq(e.n))) return;
    if (e.tt.some(x => x.s.length >= 4 && new RegExp(x.re, 'i').test(t))) push('ger', e.n, null, e.u === 'Tage' ? 'Tage' : 'Std', e.n);
  });
  // D) Geräte aus Tätigkeiten ableiten: "abgesaugt" -> Bausauger usw.
  VERB_GER.forEach(([re, name]) => {
    if (re.test(text) && !out.ger.some(x => sq(x.name) === sq(name))){ const e = CAT.get('ger').find(x => x.n === name); if (e) push('ger', e.n, null, e.u === 'Tage' ? 'Tage' : 'Std', e.n); }
  });
  const an = parseAnfahrt(text);
  return { taetigkeit: text.trim(), material: out.mat, geraete: out.ger, bemerkung: '', anfahrt: an.anfahrt, anfahrtInfo: an.info };
}

/* ---------- Auswertung (Claude) ---------- */
async function parseAI(text, key){
  const d = D.get();
  const list = k => CAT.get(k).map(e => `${e.n} (${e.u})`).join(', ');
  const learned = ['mat', 'ger'].flatMap(k => Object.entries(d.alias[k]).map(([raw, t]) => `${raw} → ${t.n}`)).concat(Object.entries(d.vocab).map(([a, b]) => `${a} → ${b}`));
  const sys = `Du bist Assistent für einen Fliesenlegerbetrieb und wertest diktierte Tagesrapporte aus (die Spracherkennung macht oft Fehler, z. B. getrennt geschriebene Wörter). Antworte NUR mit gültigem JSON ohne Erklärung, Format:
{"taetigkeit":"sachlich formulierte, sprachlich korrigierte Zusammenfassung der ausgeführten Arbeiten in kurzen Sätzen oder Stichpunkten (Raum/Bereich, Arbeitsschritte)","material":[{"name":"","menge":0,"einheit":""}],"geraete":[{"name":"","menge":0,"einheit":""}],"bemerkung":"","anfahrt":"Ja|Nein|","anfahrtInfo":""}
Regeln: "anfahrt": "Ja", wenn eine Anfahrt/Fahrt zur Baustelle erwähnt wird, "Nein" wenn ausdrücklich keine, sonst leer; "anfahrtInfo" = Kilometer/Fahrzeit, falls genannt. Geräte werden auch aus Tätigkeiten abgeleitet (z. B. „Boden abgesaugt“ → Bausauger/Staubsauger, „Fliesen zugeschnitten“ → Fliesenschneider/Nassschneider, „Löcher gebohrt“ → Bohrmaschine) und mit menge null aufgenommen. Verbrauchte Werkstoffe/Material (Fliesen, Kleber, Fugenmasse, Profile, Grundierung, Abdichtung …) kommen in "material", Maschinen/Werkzeuge/Gerüste in "geraete". Einheiten bei material nur aus: ${MAT_UNITS.join(', ')}. Einheiten bei geraete nur aus: ${GER_UNITS.join(', ')}. Mengen als Zahl (Punkt als Dezimaltrenner). Quadratmeter = m², laufende Meter = lfm, Kilogramm = kg, Säcke = Sack. Format/Größe/Typ gehört in den Namen (z. B. "Bodenfliesen 60x60"). Erfinde NIE Mengen: ist keine genannt, setze menge null. Geräte ohne Zeitangabe trotzdem aufnehmen (menge null). "bemerkung" nur für Mängel, Behinderungen, Absprachen, Zusatzleistungen, sonst leer.
Bekannte Materialnamen (Standard-Einheit): ${list('mat')}.
Bekannte Geräte: ${list('ger')}.
Verwende exakt diese Namen, wenn der Gegenstand gemeint ist, auch bei Schreib- oder Hörfehlern.${learned.length ? '\nGelernte Zuordnungen (gesprochen → richtig): ' + learned.join('; ') + '.' : ''}`;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 40000);
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2500, system: sys, messages: [{ role: 'user', content: text }] })
    });
  } finally { clearTimeout(to); }
  if (r.status === 401) { const e = new Error('Schlüssel ungültig'); e.auth = true; throw e; }
  if (!r.ok) throw new Error('API ' + r.status);
  const j = await r.json();
  const raw = (j.content || []).map(c => c.text || '').join('').replace(/^```(?:json)?|```$/gim, '').trim();
  const o = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  const clean = (a, kind) => {
    const units = kind === 'mat' ? MAT_UNITS : GER_UNITS;
    return (Array.isArray(a) ? a : []).filter(x => x && x.name).map(x => {
      const rawName = String(x.name); const m = canonName(kind, rawName); let name = rawName, def = units[0];
      if (m && m.len >= 4){ const sp = specOf(m.rest); name = m.e.n + (sp ? ' ' + sp : (m.rest ? ' ' + m.rest : '')); def = m.e.u; }
      const un = units.includes(x.einheit) ? x.einheit : (normUnit(x.einheit) && units.includes(normUnit(x.einheit)) ? normUnit(x.einheit) : def);
      return { name, menge: num(x.menge), einheit: un, raw: rawName };
    });
  };
  return { taetigkeit: applyVocab(o.taetigkeit || text), material: clean(o.material, 'mat'), geraete: clean(o.geraete, 'ger'), bemerkung: o.bemerkung || '', anfahrt: /^(ja|nein)$/i.test(o.anfahrt || '') ? cap(String(o.anfahrt).toLowerCase()) : '', anfahrtInfo: o.anfahrtInfo || '' };
}

$('ki').onclick = async () => {
  const text = $('diktat').value.trim();
  if (!text) return toast('Bitte zuerst etwas sprechen oder eintippen.');
  if (activeMic) activeMic.stop();
  const key = (S.get().key || '').trim(); const b = $('ki'); b.disabled = true; const old = b.textContent; b.textContent = '… wertet aus';
  let res, how = 'KI';
  try {
    if (key && navigator.onLine) res = await parseAI(text, key); else { res = parseLocal(text); how = 'Katalog'; }
  } catch(e){ res = parseLocal(text); how = e.auth ? 'Katalog – API-Schlüssel ungültig' : 'Katalog – KI nicht erreichbar'; }
  b.disabled = false; b.textContent = old;
  const ta = $('taetigkeit');
  if (res.taetigkeit){
    if (!ta.value.trim()) ta.value = res.taetigkeit;
    else if (ta.value.trim() !== res.taetigkeit.trim() && confirm('Vorhandenen Text unter „Ausgeführte Arbeiten“ durch die neue, korrigierte Fassung ersetzen?')) ta.value = res.taetigkeit;
  }
  if (res.bemerkung && !$('bemerkung').value.includes(res.bemerkung)) $('bemerkung').value = ($('bemerkung').value ? $('bemerkung').value + '\n' : '') + res.bemerkung;
  const merge = (kind, list) => {
    const have = rows(kind); const kf = x => [x.name.toLowerCase(), x.einheit, x.menge].join('|');
    const seen = new Set(have.map(kf)); const add = list.filter(x => !seen.has(kf(x)));
    $(kind).innerHTML = ''; have.forEach(x => addRow(kind, { ...x, keepUnit: true })); add.forEach(x => addRow(kind, { ...x, keepUnit: true }));
    if (!have.length && !add.length) addRow(kind);
  };
  merge('mat', res.material); merge('ger', res.geraete);
  if (res.anfahrt && !$('anfahrt').value){ $('anfahrt').value = res.anfahrt; if (res.anfahrtInfo && !$('anfahrtInfo').value) $('anfahrtInfo').value = res.anfahrtInfo; }
  updateStd(); markDirty();
  toast(`Ausgewertet (${how}): ${res.material.length} Material, ${res.geraete.length} Geräte – bitte prüfen. Korrekturen merkt sich die App.`, 5000);
};

/* ---------- Lernen aus Rapporten ---------- */
function learnFromReport(r){
  const d = D.get(); let ch = false;
  [['mat', r.material], ['ger', r.geraete]].forEach(([k, arr]) => (arr || []).forEach(x => {
    const m = canonName(k, x.name);
    if ((!m || m.len < 4) && x.name.length >= 3 && d.custom[k].length < 400 && !d.custom[k].some(c => sq(c.n) === sq(x.name))){ d.custom[k].push({ n: x.name, u: x.einheit }); ch = true; }
  }));
  if (r.kunde){
    const key = sq(r.kunde); const k = d.kunden.find(x => sq(x.name) === key);
    if (!k){ d.kunden.push({ name: r.kunde, adresse: r.adresse || '', bauleiter: r.bauleiter || '' }); ch = true; }
    else {
      if (r.adresse && k.adresse !== r.adresse){ k.adresse = r.adresse; ch = true; }
      if (r.bauleiter && k.bauleiter !== r.bauleiter){ k.bauleiter = r.bauleiter; ch = true; }
    }
  }
  splitNames(r.mitarbeiter).forEach(n => { if (!d.ma.some(x => sq(x) === sq(n))){ d.ma.push(n); ch = true; } });
  if (ch) D.save();
}
function learnUsage(r){
  const d = D.get();
  [['mat', r.material], ['ger', r.geraete]].forEach(([k, arr]) => (arr || []).forEach(x => {
    const m = canonName(k, x.name); const key = (m && m.len >= 4) ? m.e.n : x.name;
    d.use[k][key] = (d.use[k][key] || 0) + 1;
  }));
  D.save();
}
function refreshDatalists(){
  ['mat', 'ger'].forEach(k => {
    const el = $('dl-' + k); if (!el) return;
    el.innerHTML = CAT.get(k).map(e => `<option value="${esc(e.n)}">`).join('');
  });
}

/* ---------- Auswahl-Menüs (Material, Geräte, Kunden, Mitarbeiter) ---------- */
const PK = { mode: null, kind: null, sel: new Set(), added: 0, last: null };
function openPicker(mode, kind){
  PK.mode = mode; PK.kind = kind; PK.added = 0; PK.last = null; $('pSearch').value = '';
  $('pTitle').textContent = { item: kind === 'mat' ? 'Material wählen' : 'Geräte wählen', kunde: 'Kunde wählen', ma: 'Mitarbeiter wählen' }[mode];
  if (mode === 'ma') PK.sel = new Set(splitNames($('mitarbeiter').value));
  $('pDone').textContent = mode === 'kunde' ? 'Schließen' : 'Fertig';
  $('picker').style.display = 'flex'; renderPicker();
}
function closePicker(){
  if (PK.mode === 'ma'){ $('mitarbeiter').value = [...PK.sel].join(', '); markDirty(); updateStd(); }
  $('picker').style.display = 'none';
  if (PK.last){ const q = PK.last.querySelector('.q'); PK.last.scrollIntoView({ block: 'center' }); setTimeout(() => q.focus(), 50); }
}
function pickedRow(kind, name, unit){
  const ex = [...$(kind).children].find(el => sq(el.querySelector('.n').value) === sq(name) && !el.querySelector('.q').value);
  const el = ex || (() => { addRow(kind, { name, einheit: unit }); return $(kind).lastElementChild; })();
  PK.last = el; PK.added++; markDirty();
  $('pHint').textContent = PK.added + ' Eintrag/Einträge hinzugefügt – Mengen trägst du nach „Fertig“ ein.';
}
function renderPicker(){
  const raw = $('pSearch').value.trim(), q = sq(raw), box = $('pList'); box.innerHTML = '';
  const sec = t => { const h = document.createElement('div'); h.className = 'psec'; h.textContent = t; box.appendChild(h); };
  const row = (label, sub, fn, on) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pit' + (on ? ' on' : '');
    b.innerHTML = `<span>${esc(label)}</span><small>${esc(sub || '')}</small>`;
    b.onclick = () => { fn(b); }; box.appendChild(b); return b;
  };
  if (PK.mode === 'item'){
    const kind = PK.kind, entries = CAT.get(kind), use = D.get().use[kind];
    const match = e => !q || sq(e.n).includes(q) || e.tt.some(x => x.s.includes(q));
    const add = e => row(e.n, e.u, b => { pickedRow(kind, e.n, e.u); b.classList.add('on'); b.querySelector('small').textContent = '✓ ' + e.u; });
    if (!q){ const top = entries.filter(e => use[e.n] > 0).sort((a, b) => use[b.n] - use[a.n]).slice(0, 8); if (top.length){ sec('Häufig verwendet'); top.forEach(add); } }
    const groups = []; entries.filter(match).forEach(e => { let g = groups.find(x => x.g === e.g); if (!g) groups.push(g = { g: e.g, list: [] }); g.list.push(e); });
    groups.forEach(g => { sec(g.g); g.list.forEach(add); });
    if (raw && !entries.some(e => sq(e.n) === q)) row('＋ „' + raw + '“ neu hinzufügen', kind === 'mat' ? 'wird für später gemerkt' : 'wird für später gemerkt', b => { pickedRow(kind, raw, kind === 'mat' ? 'Stk' : 'Std'); b.classList.add('on'); });
    if (!groups.length && !raw) box.textContent = 'Keine Einträge.';
  } else if (PK.mode === 'kunde'){
    const list = D.get().kunden.filter(k => !q || sq(k.name + ' ' + (k.adresse || '')).includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (list.length) sec('Gespeicherte Kunden'); else box.textContent = 'Noch keine Kunden gespeichert. Tippe oben einen Namen ein und lege ihn neu an.';
    list.forEach(k => row(k.name, [k.adresse, k.bauleiter && 'Bauleiter: ' + k.bauleiter].filter(Boolean).join(' · '), () => {
      $('kunde').value = k.name; if (k.adresse) $('adresse').value = k.adresse; if (k.bauleiter) $('bauleiter').value = k.bauleiter;
      markDirty(); closePicker();
    }));
    if (raw && !D.get().kunden.some(k => sq(k.name) === q)) row('＋ Neuen Kunden „' + raw + '“ anlegen', '', () => {
      D.get().kunden.push({ name: raw, adresse: '', bauleiter: '' }); D.save(); $('kunde').value = raw; markDirty(); closePicker();
    });
  } else if (PK.mode === 'ma'){
    const d = D.get(); const list = d.ma.filter(n => !q || sq(n).includes(q)).sort((a, b) => a.localeCompare(b, 'de'));
    PK.sel.forEach(n => { if (!d.ma.some(x => sq(x) === sq(n)) && (!q || sq(n).includes(q))) list.push(n); });
    if (list.length) sec('Mitarbeiter (antippen zum Auswählen)'); else box.textContent = 'Noch keine Mitarbeiter gespeichert. Tippe oben einen Namen ein.';
    list.forEach(n => row(n, '', b => { const hit = [...PK.sel].find(x => sq(x) === sq(n)); if (hit) PK.sel.delete(hit); else PK.sel.add(n); b.classList.toggle('on', !hit); b.querySelector('small').textContent = hit ? '' : '✓'; }, [...PK.sel].some(x => sq(x) === sq(n))));
    if (raw && !d.ma.some(x => sq(x) === q)) row('＋ „' + raw + '“ als Mitarbeiter anlegen', '', () => { d.ma.push(raw); D.save(); PK.sel.add(raw); $('pSearch').value = ''; renderPicker(); });
  }
}
$('pSearch').addEventListener('input', renderPicker);
$('pDone').onclick = closePicker;
$('picker').addEventListener('click', e => { if (e.target === $('picker')) closePicker(); });
$('pickMat').onclick = () => openPicker('item', 'mat');
$('pickGer').onclick = () => openPicker('item', 'ger');
$('pickKunde').onclick = () => openPicker('kunde');
$('pickMa').onclick = () => openPicker('ma');

/* ---------- Verwaltung in den Einstellungen ---------- */
function listItem(box, title, sub, onDel, onTap){
  const d = document.createElement('div'); d.className = 'it2';
  d.innerHTML = `<div class="m"><b>${esc(title)}</b>${sub ? '<span class="hint">' + esc(sub) + '</span>' : ''}</div><button class="btn red" type="button" aria-label="Löschen">✕</button>`;
  if (onTap) d.querySelector('.m').onclick = onTap;
  d.querySelector('button').onclick = () => { onDel(); renderLists(); };
  box.appendChild(d);
}
function renderLists(){
  const d = D.get(); const clear = id => { const b = $(id); b.innerHTML = ''; return b; };
  let b = clear('l_ma'); if (!d.ma.length) b.innerHTML = '<div class="hint">Noch keine Mitarbeiter.</div>';
  d.ma.forEach((n, i) => listItem(b, n, '', () => d.ma.splice(i, 1) && D.save()));
  b = clear('l_kunden'); if (!d.kunden.length) b.innerHTML = '<div class="hint">Noch keine Kunden. Sie werden auch automatisch beim Speichern eines Rapports angelegt.</div>';
  d.kunden.forEach((k, i) => listItem(b, k.name, [k.adresse, k.bauleiter && 'Bauleiter: ' + k.bauleiter].filter(Boolean).join(' · '), () => d.kunden.splice(i, 1) && D.save(), () => { $('k_name').value = k.name; $('k_adr').value = k.adresse || ''; $('k_bl').value = k.bauleiter || ''; window.scrollTo(0, $('k_name').getBoundingClientRect().top + scrollY - 140); }));
  [['l_cmat', 'mat'], ['l_cger', 'ger']].forEach(([id, k]) => {
    b = clear(id); if (!d.custom[k].length) b.innerHTML = '<div class="hint">Noch nichts gelernt.</div>';
    d.custom[k].forEach((c, i) => listItem(b, c.n, 'Einheit: ' + c.u, () => d.custom[k].splice(i, 1) && D.save()));
  });
  b = clear('l_alias'); let n = 0;
  ['mat', 'ger'].forEach(k => Object.entries(d.alias[k]).forEach(([raw, t]) => { n++; listItem(b, raw + '  →  ' + t.n, (k === 'mat' ? 'Material' : 'Gerät') + ' · ' + (t.u || ''), () => { delete d.alias[k][raw]; D.save(); }); }));
  if (!n) b.innerHTML = '<div class="hint">Noch keine Zuordnungen. Sie entstehen, wenn du eine erkannte Bezeichnung in der Liste korrigierst.</div>';
  b = clear('l_vocab'); const vk = Object.entries(d.vocab); if (!vk.length) b.innerHTML = '<div class="hint">Noch keine eigenen Korrekturen.</div>';
  vk.forEach(([a, c]) => listItem(b, a + '  →  ' + c, '', () => { delete d.vocab[a]; D.save(); }));
}
$('ma_add').onclick = () => { const v = $('ma_new').value.trim(); if (!v) return; const d = D.get(); if (!d.ma.some(x => sq(x) === sq(v))) d.ma.push(v); D.save(); $('ma_new').value = ''; renderLists(); };
$('k_save').onclick = () => {
  const name = $('k_name').value.trim(); if (!name) return toast('Bitte einen Kundennamen eingeben.');
  const d = D.get(); const k = d.kunden.find(x => sq(x.name) === sq(name)); const rec = { name, adresse: $('k_adr').value.trim(), bauleiter: $('k_bl').value.trim() };
  if (k) Object.assign(k, rec); else d.kunden.push(rec);
  D.save(); ['k_name', 'k_adr', 'k_bl'].forEach(i => $(i).value = ''); renderLists(); toast('Kunde gespeichert');
};
$('v_add').onclick = () => {
  const a = $('v_from').value.trim(), c = $('v_to').value.trim(); if (!a || !c) return toast('Bitte beide Felder ausfüllen.');
  D.get().vocab[a] = c; D.save(); $('v_from').value = ''; $('v_to').value = ''; renderLists(); toast('Korrektur gespeichert');
};
$('learnReset').onclick = () => {
  if (!confirm('Alle gelernten Einträge löschen (eigene Material-/Geräte-Namen, Zuordnungen, Korrekturen, Häufigkeiten)? Kunden und Mitarbeiter bleiben erhalten.')) return;
  const d = D.get(); d.custom = { mat: [], ger: [] }; d.alias = { mat: {}, ger: {} }; d.units = { mat: {}, ger: {} }; d.use = { mat: {}, ger: {} }; d.vocab = {}; D.save(); renderLists(); toast('Gelerntes gelöscht');
};

/* ---------- Speichern / Archiv ---------- */
async function save(silent){
  const r = collect();
  if (!hasContent(r)){ if (!silent) toast('Nichts zu speichern – der Rapport ist noch leer.'); return r; }
  if (!r.nr){ r.nr = nextNr(); $('nr').value = r.nr; }
  try { await DB.put(r); dirty = false; learnFromReport(r); if (!silent) toast('Gespeichert'); }
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
    const badge = r.status === 'versendet' ? '<span class="badge v">versendet</span>' : '<span class="badge">' + (r.status === 'pdf' ? 'PDF erstellt' : r.status === 'fertig' ? 'fertig' : 'Entwurf') + '</span>';
    d.innerHTML = `<div class="m"><b>${esc(fmtDate(r.datum))} – ${esc(r.objekt || 'ohne Objekt')}</b><span class="hint">${esc(r.nr || '')}${r.mitarbeiter ? ' · ' + esc(r.mitarbeiter) : ''}${r.fotos && r.fotos.length ? ' · ' + r.fotos.length + ' Foto(s)' : ''}</span>${badge}</div>
      <div class="bar" style="margin:0;flex-wrap:nowrap"><button class="btn sec o" type="button">Öffnen</button><button class="btn sec p" type="button">PDF</button><button class="btn red d" type="button" aria-label="Löschen">✕</button></div>`;
    d.querySelector('.o').onclick = async () => {
      if (dirty) { try { await save(true); } catch(e){} }
      fill(r); show('neu'); window.scrollTo(0, 0);
    };
    d.querySelector('.p').onclick = () => makePDF(r, false);
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
  const wt = workTime(r);
  if (r.von && r.bis) zeit = `${r.von}–${r.bis} Uhr` + (r.pause ? `, Pause ${r.pause} Min.` : '');
  else if (r.von || r.bis) zeit = (r.von ? 'ab ' + r.von : 'bis ' + r.bis) + ' Uhr';
  const ges = wt ? `${fmtHM(wt.man)} (${fmtDec(wt.man)})` : '–';
  const anf = r.anfahrt ? (r.anfahrt + (r.anfahrtInfo ? ' – ' + r.anfahrtInfo : '')) : 'nicht angegeben';
  cellRow([{ l: 'Datum', v: fmtDate(r.datum), f: .30 }, { l: 'Rapport-Nr.', v: r.nr, f: .30 }, { l: 'Projekt-/Auftrags-Nr.', v: r.projekt, f: .40 }]);
  cellRow([{ l: 'Objekt / Baustelle', v: r.objekt, f: .60 }, { l: 'Wetter', v: r.wetter, f: .40 }]);
  cellRow([{ l: 'Adresse der Baustelle', v: r.adresse, f: .50 }, { l: 'Auftraggeber / Kunde', v: r.kunde, f: .50 }]);
  cellRow([{ l: 'Bauleiter / Ansprechpartner', v: r.bauleiter, f: .50 }, { l: 'Mitarbeiter', v: r.mitarbeiter, f: .50 }]);
  if (!(wt && wt.list[0].name)) cellRow([{ l: 'Arbeitszeit', v: zeit + (wt ? ' = ' + fmtHM(wt.mins) : ''), f: 1 }]);
  else wt.list.forEach(x => cellRow([{ l: 'Mitarbeiter', v: x.name, f: .35 }, { l: 'Arbeitszeit (Kommen–Gehen, Pause)', v: x.mins ? `${x.von}–${x.bis} Uhr${x.pause ? ', Pause ' + x.pause + ' Min.' : ''}` : '–', f: .35 }, { l: 'Stunden', v: x.mins ? fmtHM(x.mins) + ' (' + fmtDec(x.mins) + ')' : '–', f: .30 }]));
  cellRow([{ l: 'Gesamtstunden' + (wt && wt.n > 1 ? ' (alle Mitarbeiter)' : ''), v: ges, f: 1 }]);
  cellRow([{ l: 'Anfahrt', v: anf, f: 1 }]);
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
async function makePDF(r, auto = false){
  let doc;
  try { doc = buildPDF(r); } catch(e){ console.error(e); return toast('PDF-Erstellung fehlgeschlagen: ' + e.message, 6000); }
  const safe = (r.objekt || 'Rapport').replace(/[^\wäöüÄÖÜß\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'Rapport';
  const name = `Tagesrapport_${r.datum || today()}_${safe}.pdf`;
  const blob = doc.output('blob'); const file = new File([blob], name, { type: 'application/pdf' });
  const subject = `Tagesrapport ${fmtDate(r.datum)}${r.nr ? ' (' + r.nr + ')' : ''}${r.objekt ? ' – ' + r.objekt : ''}`;
  const body = `Guten Tag,\n\nanbei der Tagesrapport vom ${fmtDate(r.datum)}${r.objekt ? ' für ' + r.objekt : ''}.\n\nMit freundlichen Grüßen\n${r.mitarbeiter || eff('firma')}`;
  if (pack && pack.url) URL.revokeObjectURL(pack.url);
  pack = { r, blob, file, name, subject, body, url: URL.createObjectURL(blob) };
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  $('mInfo').textContent = `${name} · ${Math.round(blob.size / 1024)} KB`;
  $('mShare').classList.toggle('hide', !canShare);
  // Direkt das Teilen-Menü öffnen: dort „Mail“ wählen, das PDF hängt automatisch an
  $('mTitle').textContent = 'Rapport fertig – was möchtest du tun?';
  if (auto && canShare){
    try {
      await navigator.share({ files: [file], title: subject, text: body });
      await setStatus('versendet'); toast('PDF wurde geteilt (als Anhang)'); return;
    } catch(e){
      if (e && e.name !== 'AbortError') toast('Direktes Teilen wurde vom Handy blockiert – bitte unten auf „Per Mail senden“ tippen.', 5000);
    }
  }
  $('modal').style.display = 'flex';
}
async function setStatus(st){
  if (!pack) return; const r = pack.r;
  if (r.status === 'versendet' || (st === 'pdf' && r.status === 'fertig')) return;
  r.status = st; if (cur.id === r.id) cur.status = st;
  try { const stored = r.id === cur.id ? collect() : r; stored.status = st; await DB.put(stored); } catch(e){}
}
$('mClose').onclick = () => { $('modal').style.display = 'none'; };
$('mDone').onclick = async () => { await setStatus('fertig'); $('modal').style.display = 'none'; toast('Im Archiv gespeichert', 3000); };
$('mNew').onclick = async () => { await setStatus('fertig'); $('modal').style.display = 'none'; fresh(); window.scrollTo(0, 0); toast('Neuer Rapport – der vorige liegt im Archiv', 3500); };
$('modal').onclick = e => { if (e.target === $('modal')) $('modal').style.display = 'none'; };
$('mShare').onclick = async () => {
  try { await navigator.share({ files: [pack.file], title: pack.subject, text: pack.body }); await setStatus('versendet'); $('modal').style.display = 'none'; toast('Geteilt'); }
  catch(e){ if (e && e.name !== 'AbortError') toast('Teilen nicht möglich – bitte „PDF speichern“ nutzen.', 5000); }
};
$('mMail').onclick = async () => {
  const to = S.get().mail || '';
  await setStatus('versendet');
  location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(pack.subject)}&body=${encodeURIComponent(pack.body + '\n\n(PDF „' + pack.name + '“ bitte anhängen)')}`;
  toast('Mail-Text geöffnet – das PDF bitte vorher über „PDF speichern“ sichern und anhängen.', 6000);
};
$('mView').onclick = () => { const w = window.open(pack.url, '_blank'); if (!w) toast('Ansicht blockiert – bitte „PDF speichern“ nutzen.', 4500); };
$('mSave').onclick = async () => {
  const a = document.createElement('a'); a.href = pack.url; a.download = pack.name; document.body.appendChild(a); a.click(); a.remove();
  await setStatus('pdf'); toast('PDF gespeichert (Ordner „Downloads“ / „Dateien“).', 4000);
};
$('send').onclick = () => {
  const r = collect();
  if (!hasContent(r)) return toast('Der Rapport ist noch leer.');
  if (!r.anfahrt && !confirm('Anfahrt ist nicht angegeben (Ja/Nein). Trotzdem PDF erstellen?')) return;
  if (!r.sig1 && !confirm('Es fehlt die Unterschrift des Mitarbeiters. Trotzdem PDF erstellen?')) return;
  if (!r.nr){ r.nr = nextNr(); $('nr').value = r.nr; }
  DB.put(r).then(() => { dirty = false; }).catch(() => {});
  try { learnFromReport(r); learnUsage(r); } catch(e){}
  makePDF(r, false);
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
  if (v === 'set'){ renderLists(); dbInfo(); }
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

/* ---------- Datenbank: Sicherung / Wiederherstellung ---------- */
async function dbInfo(){
  try { const all = (await DB.all()) || []; $('dbInfo').textContent = `Auf diesem Gerät gespeichert: ${all.length} Rapport(e), ${D.get().kunden.length} Kunde(n), ${D.get().ma.length} Mitarbeiter.`; } catch(e){ $('dbInfo').textContent = 'Datenbank nicht lesbar.'; }
}
$('dbExport').onclick = async () => {
  try {
    const s = Object.assign({}, S.get()); delete s.key;
    const dump = { app: 'finkbeiner-rapport', version: VERSION, exportiert: new Date().toISOString(), rapporte: (await DB.all()) || [], daten: D.get(), einstellungen: s, nr: localStorage.getItem('rp_nr') || '' };
    const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
    const fn = `Finkbeiner_Rapport_Sicherung_${today()}.json`; const file = new File([blob], fn, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })){ try { await navigator.share({ files: [file], title: fn }); return toast('Sicherung geteilt'); } catch(e){ if (e && e.name === 'AbortError') return; } }
    const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = fn; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000);
    toast('Sicherung gespeichert (Downloads / Dateien)', 4000);
  } catch(e){ toast('Sicherung fehlgeschlagen: ' + (e && e.message || e), 5000); }
};
$('dbImport').onclick = () => $('dbFile').click();
$('dbFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const dump = JSON.parse(await f.text()); if (dump.app !== 'finkbeiner-rapport') throw new Error('Keine Sicherungsdatei dieser App');
    if (!confirm('Sicherung einspielen? Rapporte werden zusammengeführt (der neuere Stand gewinnt), Kunden, Mitarbeiter und Gelerntes ersetzt.')) return;
    const have = new Map(((await DB.all()) || []).map(r => [r.id, r])); let n = 0;
    for (const r of dump.rapporte || []){ const x = have.get(r.id); if (!x || (r.updated || 0) > (x.updated || 0)){ await DB.put(r); n++; } }
    if (dump.daten){ localStorage.setItem('rp_data', JSON.stringify(dump.daten)); location.reload(); return; }
    toast(n + ' Rapport(e) übernommen', 4000); dbInfo();
  } catch(err){ toast('Einspielen fehlgeschlagen: ' + (err && err.message || err), 5000); }
};

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
  refreshDatalists(); renderLists();
  requestAnimationFrame(() => { sig1.size(); sig2.size(); sig1.load(sig1.url); sig2.load(sig2.url); });
  loadLogo();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
