'use strict';
const { app, BrowserWindow, ipcMain, dialog, clipboard, shell, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const http = require('http');
const os = require('os');

const OPENABLE = ['.docx', '.wordweb', '.html', '.htm', '.txt', '.md', '.csv'];
const wins = new Map(); // webContents.id -> { win, kind, closing, startup }
const PAGES = { hub: 'hub.html', word: 'index.html', excel: 'excel/index.html', ppt: 'ppt/index.html' };
const TITLES = { hub: 'Nocte', word: 'Nocte Word', excel: 'Nocte Excel', ppt: 'Nocte PowerPoint' };
const kindOfFile = p => { const e = path.extname(p).toLowerCase(); return ['.xlsx', '.xls', '.csv'].includes(e) ? 'excel' : e === '.pptx' ? 'ppt' : 'word'; };
const OPENABLE_ALL = OPENABLE.concat(['.xlsx', '.pptx']);

/* ---------- Instance unique + fichier passé en argument ---------- */
const argFile = argv => argv.slice(app.isPackaged ? 1 : 2).find(a => !a.startsWith('-') && OPENABLE_ALL.includes(path.extname(a).toLowerCase()) && fs.existsSync(a));
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', (_e, argv) => {
    const f = argFile(argv);
    if (f) createWindow(kindOfFile(f), f); else openHub();
  });
}

async function readForRenderer(p) {
  const buf = await fsp.readFile(p), ext = path.extname(p).toLowerCase().replace('.', '');
  const isText = ['html', 'htm', 'txt', 'md', 'csv', 'wordweb'].includes(ext);
  return { name: path.basename(p), ext, path: p, ...(isText ? { text: buf.toString('utf8').replace(/^﻿/, '') } : { bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) }) };
}
const winOf = e => BrowserWindow.fromWebContents(e.sender);

/* ---------- Fenêtres ---------- */
function openHub() {
  for (const v of wins.values()) if (v.kind === 'hub') { if (v.win.isMinimized()) v.win.restore(); v.win.focus(); return v.win; }
  return createWindow('hub');
}
function createWindow(kind, startupPath) {
  const hub = kind === 'hub';
  const win = new BrowserWindow({
    width: hub ? 1000 : 1360, height: hub ? 660 : 860, minWidth: hub ? 760 : 360, minHeight: hub ? 520 : 480,
    backgroundColor: hub ? '#2b579a' : '#1f1f1f', title: TITLES[kind], icon: path.join(__dirname, 'src', 'icon.png'), show: false, autoHideMenuBar: true, resizable: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: kind !== 'excel' }
  });
  const id = win.webContents.id, rec = { win, kind, closing: false, startup: startupPath || null };
  wins.set(id, rec);
  win.loadFile(path.join(__dirname, 'src', PAGES[kind]));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { openSafe(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); openSafe(url); } else e.preventDefault(); });
  win.on('page-title-updated', e => { if (kind === 'hub') e.preventDefault(); });
  win.on('close', e => {
    if (rec.closing || hub) return;
    e.preventDefault();
    win.webContents.send('app:before-close');
  });
  win.on('unresponsive', () => { rec.closing = true; });
  win.on('closed', () => { wins.delete(id); if (!wins.size) stopShare(); });
  win.webContents.on('context-menu', (_e, p) => {
    const t = [];
    if (p.misspelledWord) {
      p.dictionarySuggestions.slice(0, 5).forEach(s => t.push({ label: s, click: () => win.webContents.replaceMisspelling(s) }));
      if (!p.dictionarySuggestions.length) t.push({ label: 'Aucune suggestion', enabled: false });
      t.push({ label: 'Ajouter au dictionnaire', click: () => win.webContents.session.addWordToSpellCheckerDictionary(p.misspelledWord) }, { type: 'separator' });
    }
    if (p.isEditable) t.push({ label: 'Couper', role: 'cut', enabled: p.editFlags.canCut }, { label: 'Copier', role: 'copy', enabled: p.editFlags.canCopy }, { label: 'Coller', role: 'paste', enabled: p.editFlags.canPaste }, { type: 'separator' }, { label: 'Tout sélectionner', role: 'selectAll' });
    else if (p.selectionText) t.push({ label: 'Copier', role: 'copy' });
    if (t.length) Menu.buildFromTemplate(t).popup({ window: win });
  });
  return win;
}
function openSafe(url) { if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url); }

if (!app.commandLine.hasSwitch('user-data-dir')) try { app.setPath('userData', path.join(app.getPath('appData'), 'Suite Bureautique Dark')); } catch (e) { /* garde le dossier de données historique */ }
app.whenReady().then(() => {
  setupUpdater();
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.defaultSession.setSpellCheckerLanguages(['fr', 'fr-FR'].filter(l => session.defaultSession.availableSpellCheckerLanguages.includes(l)).slice(0, 1));
  Menu.setApplicationMenu(null);
  const f = argFile(process.argv);
  if (f) createWindow(kindOfFile(f), f); else createWindow('hub');
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) openHub(); });
});
app.on('window-all-closed', () => app.quit());

ipcMain.on('app:confirm-close', e => { const r = wins.get(e.sender.id); if (r && !r.win.isDestroyed()) { r.closing = true; r.win.close(); } });
ipcMain.handle('app:startup-file', async e => {
  const r = wins.get(e.sender.id); if (!r || !r.startup) return null;
  const f = r.startup; r.startup = null;
  try { return await readForRenderer(f); } catch (err) { return null; }
});
ipcMain.handle('app:open-hub', () => { openHub(); });
ipcMain.handle('app:open-app', async (e, kind, file) => {
  if (G.isLocked()) return { locked: true };
  if (!PAGES[kind]) return false;
  if (file) { createWindow(kind, file); return true; }
  createWindow(kind); return true;
});
ipcMain.handle('app:recent-open', async (e, kind, p) => { if (p && fs.existsSync(p)) createWindow(kind, p); });

/* ---------- Dialogues ---------- */
ipcMain.handle('dlg:open', async e => {
  const r = await dialog.showOpenDialog(winOf(e), { title: 'Ouvrir un document', properties: ['openFile'], filters: [{ name: 'Documents', extensions: ['docx', 'wordweb', 'html', 'htm', 'txt', 'md', 'csv'] }, { name: 'Tous les fichiers', extensions: ['*'] }] });
  if (r.canceled || !r.filePaths.length) return null;
  return Promise.all(r.filePaths.map(readForRenderer));
});
ipcMain.handle('dlg:open-files', async (e, o) => {
  const r = await dialog.showOpenDialog(winOf(e), { title: 'Ouvrir', properties: ['openFile'], filters: (o && o.filters) || [] });
  if (r.canceled || !r.filePaths.length) return null;
  return Promise.all(r.filePaths.map(readForRenderer));
});
ipcMain.handle('dlg:save', async (e, o) => {
  o = o || {};
  const r = await dialog.showSaveDialog(winOf(e), { title: 'Enregistrer', defaultPath: path.join(app.getPath('documents'), o.defaultName || 'Document.docx'), filters: o.filters || [] });
  return r.canceled ? { canceled: true } : { canceled: false, path: r.filePath };
});

/* ---------- Écriture de fichiers ---------- */
/* Historique de versions : avant d'écraser un fichier, on en garde une copie datée (10 dernières) */
async function backupVersion(p) {
  try {
    await fsp.access(p); const dir = path.join(app.getPath('userData'), 'versions', path.basename(p).replace(/[^\w.\- ]/g, '_'));
    await fsp.mkdir(dir, { recursive: true });
    const d = new Date(), pad = n => String(n).padStart(2, '0'), ts = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    const last = (await fsp.readdir(dir)).sort().pop();
    if (last && Date.now() - (await fsp.stat(path.join(dir, last))).mtimeMs < 60000) return; // pas plus d'une copie par minute
    await fsp.copyFile(p, path.join(dir, ts + path.extname(p)));
    const all = (await fsp.readdir(dir)).sort(); for (const f of all.slice(0, Math.max(0, all.length - 10))) await fsp.unlink(path.join(dir, f));
  } catch (_) { /* pas de fichier précédent ou copie impossible : on ne bloque jamais l'enregistrement */ }
}
async function writeAtomic(p, data) {
  await backupVersion(p);
  const tmp = p + '.tmp-' + process.pid;
  try { await fsp.writeFile(tmp, data); await fsp.rename(tmp, p); G.afterWrite(p); }
  catch (e) { try { await fsp.unlink(tmp); } catch (_) { /* ignore */ } throw e; }
}
/* ----- Excel (exceljs) ----- */
const NF = { '0': '0', '0.00': '0.00', sep: '#,##0.00', '%': '0%', eur: '#,##0.00 "€"', date: 'dd/mm/yyyy', txt: '@' };
const hex = c => 'FF' + String(c || '#000000').replace('#', '').toUpperCase().padStart(6, '0');
const fromArgb = a => (typeof a === 'string' && a.length === 8 ? '#' + a.slice(2).toLowerCase() : null);
const serialToDate = n => new Date(Date.UTC(1899, 11, 30) + Math.round(n * 864e5));
async function xlsxBuild(book) {
  const ExcelJS = require('exceljs'), wb = new ExcelJS.Workbook(); wb.creator = G.authorName() || 'Nocte Excel'; wb.title = book.title;
  for (const sh of book.sheets) {
    const ws = wb.addWorksheet(sh.name.slice(0, 31), sh.freeze && (sh.freeze.r || sh.freeze.c) ? { views: [{ state: 'frozen', xSplit: sh.freeze.c || 0, ySplit: sh.freeze.r || 0 }] } : undefined);
    (sh.merges || []).forEach(g => { try { ws.mergeCells(g.r0 + 1, g.c0 + 1, g.r1 + 1, g.c1 + 1); } catch (e) { /* ignorée */ } });
    Object.entries(sh.colW || {}).forEach(([c, w]) => { ws.getColumn(+c + 1).width = Math.max(3, (w - 5) / 7); });
    for (const c of sh.cells) {
      const cell = ws.getCell(c.k), s = c.s || {};
      if (typeof c.v === 'string' && c.v[0] === '=' && c.v.length > 1) cell.value = { formula: c.v.slice(1).replace(/;/g, ','), result: c.res === null ? undefined : c.res };
      else if (typeof c.v === 'number' && s.nf === 'date') cell.value = serialToDate(c.v);
      else if (c.v !== '' && c.v != null) cell.value = c.v;
      const dp = s.dp != null ? s.dp : null; let fmt = NF[s.nf];
      if (dp != null && s.nf !== 'date' && s.nf !== 'txt') { const z = dp > 0 ? '.' + '0'.repeat(dp) : ''; fmt = s.nf === '%' ? '0' + z + '%' : s.nf === 'eur' ? '#,##0' + z + ' "€"' : s.nf === 'sep' ? '#,##0' + z : '0' + z; }
      if (fmt) cell.numFmt = fmt;
      const font = {}; if (s.b) font.bold = true; if (s.i) font.italic = true; if (s.u) font.underline = true; if (s.color) font.color = { argb: hex(s.color) }; if (s.sz) font.size = s.sz;
      if (Object.keys(font).length) cell.font = font;
      if (s.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hex(s.fill) } };
      if (s.al || s.wrap) cell.alignment = { horizontal: s.al || undefined, wrapText: !!s.wrap };
      if (s.bd) { const b = { style: 'thin', color: { argb: 'FF000000' } }; cell.border = { top: b, left: b, bottom: b, right: b }; }
    }
    for (const g of (sh.dv || [])) { const f = ['"' + g.list.map(v => String(v).replace(/"/g, '""').replace(/,/g, ' ')).join(',') + '"']; let n = 0; for (let r = g.r0; r <= g.r1 && n < 5000; r++) for (let c = g.c0; c <= g.c1 && n < 5000; c++, n++) ws.getCell(r + 1, c + 1).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: true, formulae: f }; }
    if (sh.prot) { try { await ws.protect('', { selectLockedCells: true, selectUnlockedCells: true }); } catch (e) { /* protection ignorée */ } }
  }
  for (const im of (book.images || [])) { try { const id = wb.addImage({ base64: im.png, extension: 'png' }); wb.worksheets[im.sheet].addImage(id, { tl: { col: im.col, row: im.row }, ext: { width: im.w, height: im.h } }); } catch (e) { /* image ignorée */ } }
  for (const [n, ref] of Object.entries(book.names || {})) { try { wb.definedNames.add(String(ref).replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, '$$$2$$$4'), n); } catch (e) { /* nom ignoré */ } }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
function nfBack(f) {
  if (!f || f === 'General') return {};
  if (f.includes('%')) { const m = /\.(0+)%/.exec(f); return { nf: '%', dp: m ? m[1].length : 0 }; }
  if (f.includes('€')) { const m = /\.(0+)/.exec(f); return { nf: 'eur', dp: m ? m[1].length : 0 }; }
  if (/[dmy]{1,4}[/.\-][dmy]{1,4}/i.test(f)) return { nf: 'date' };
  if (f === '@') return { nf: 'txt' };
  if (f.includes('#,##')) { const m = /\.(0+)/.exec(f); return { nf: 'sep', dp: m ? m[1].length : 0 }; }
  const m = /^0(?:\.(0+))?$/.exec(f); if (m) return m[1] ? { nf: '0.00', dp: m[1].length } : { nf: '0' };
  return {};
}
async function xlsxParse(bytes) {
  const ExcelJS = require('exceljs'), wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(bytes));
  const sheets = [];
  wb.eachSheet(ws => {
    const cells = {}, colW = {};
    ws.columns.forEach((col, i) => { if (col && col.width) colW[i] = Math.round(col.width * 7 + 5); });
    ws.eachRow({ includeEmpty: false }, (row, rn) => row.eachCell({ includeEmpty: false }, (cell, cn) => {
      if (rn > 2000 || cn > 26) return;
      let v = cell.value, st = {};
      if (v && typeof v === 'object') { if (v instanceof Date) { st.nf = 'date'; v = (v.getTime() - Date.UTC(1899, 11, 30)) / 864e5; } else if (v.formula) v = '=' + v.formula; else if (v.sharedFormula) v = v.result != null ? v.result : ''; else if (v.richText) v = v.richText.map(t => t.text).join(''); else if (v.text) v = v.text; else if (v.error) v = v.error; else v = String(v.result != null ? v.result : ''); }
      const f = cell.font || {}; if (f.bold) st.b = true; if (f.italic) st.i = true; if (f.underline) st.u = true; const col = f.color && fromArgb(f.color.argb); if (col && col !== '#000000') st.color = col; if (f.size && f.size !== 11) st.sz = f.size;
      if (cell.fill && cell.fill.fgColor) { const fl = fromArgb(cell.fill.fgColor.argb); if (fl && fl !== '#ffffff') st.fill = fl; }
      const al = cell.alignment || {}; if (al.horizontal && ['left', 'center', 'right'].includes(al.horizontal)) st.al = al.horizontal; if (al.wrapText) st.wrap = true;
      if (cell.border && cell.border.top) st.bd = true;
      Object.assign(st, nfBack(cell.numFmt));
      const key = (function (c) { let s = ''; let n = c; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; })(cn) + rn;
      cells[key] = Object.keys(st).length ? { v: v == null ? '' : v, s: st } : { v: v == null ? '' : v };
    }));
    const A1 = k => { const q = /^([A-Z]+)(\d+)$/.exec(k); if (!q) return null; let c = 0; for (const ch of q[1]) c = c * 26 + ch.charCodeAt(0) - 64; return { c: c - 1, r: +q[2] - 1 }; };
    const merges = ((ws.model && ws.model.merges) || []).map(x => { const [a, b] = String(x).split(':'), p = A1(a), q = A1(b || a); return p && q ? { r0: p.r, c0: p.c, r1: q.r, c1: q.c } : null; }).filter(g => g && g.r1 < 2000 && g.c1 < 26 && (g.r1 > g.r0 || g.c1 > g.c0));
    const vw = ws.views && ws.views[0], freeze = vw && vw.state === 'frozen' ? { r: vw.ySplit || 0, c: vw.xSplit || 0 } : undefined;
    const dv = [], dvm = (ws.dataValidations && ws.dataValidations.model) || {};
    Object.entries(dvm).forEach(([k, d]) => { if (!d || d.type !== 'list' || !d.formulae || !/^"/.test(d.formulae[0] || '')) return; const q = k.split(':'), p = A1(q[0]), p2 = A1(q[1] || q[0]); if (!p || !p2) return; const list = d.formulae[0].replace(/^"|"$/g, '').split(',').map(s => s.trim()).filter(Boolean); if (list.length && !dv.some(g => g.r0 === p.r && g.c0 === p.c && g.r1 === p2.r && g.c1 === p2.c)) dv.push({ r0: p.r, c0: p.c, r1: p2.r, c1: p2.c, list }); });
    sheets.push({ name: ws.name, cells, colW, merges, freeze, dv: dv.slice(0, 200), prot: !!(ws.sheetProtection && ws.sheetProtection.sheet) });
  });
  try { const nm = {}; ((wb.definedNames && wb.definedNames.model) || []).forEach(d => { if (d.name && d.ranges && d.ranges[0] && /^[A-Za-zÀ-ÿ_][\wÀ-ÿ.]*$/.test(d.name)) nm[d.name] = String(d.ranges[0]).replace(/\$/g, ''); }); sheets.names = nm; } catch (e) { sheets.names = {}; }
  return sheets;
}
ipcMain.handle('versions:open', async () => { const d = path.join(app.getPath('userData'), 'versions'); await fsp.mkdir(d, { recursive: true }); shell.openPath(d); return d; });
ipcMain.handle('xlsx:write', async (_e, { path: p, book }) => { try { await writeAtomic(p, await xlsxBuild(book)); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('xlsx:parse', async (_e, bytes) => { try { { const sh = await xlsxParse(bytes); return { ok: true, sheets: sh, names: sh.names || {} }; } } catch (e) { return { ok: false, error: e.message }; } });

/* ----- PowerPoint (pptxgenjs) ----- */
async function pptxBuild(deck) {
  const PptxGenJS = require('pptxgenjs'), p = new PptxGenJS();
  p.defineLayout({ name: 'W169', width: 13.333, height: 7.5 }); p.layout = 'W169'; p.title = deck.title; p.author = G.authorName() || 'Nocte PowerPoint';
  const I = n => Math.round(n / 72 * 1000) / 1000, col = c => String(c || '#000000').replace('#', '').toUpperCase();
  for (const sd of deck.slides) {
    const s = p.addSlide(); s.background = { color: col(sd.bg || '#ffffff') };
    for (const o of sd.objs) {
      const pos = { x: I(o.x), y: I(o.y), w: I(o.w), h: I(o.h) };
      if (o.type === 'table' && Array.isArray(o.cells)) {
        const bc = col(o.line || '#8a8a8a'), rowsT = o.cells.map((row, r) => row.map(v => ({ text: String(v || ''), options: o.hdr && r === 0 ? { bold: true, color: 'FFFFFF', fill: { color: col(o.fill || '#2b579a') } } : { color: col(o.color || '#262626'), fill: o.hdr && r % 2 === 0 ? { color: 'EDEDED' } : undefined } })));
        s.addTable(rowsT, { ...pos, fontSize: Math.round((o.fs || 20) * 0.75), fontFace: o.ff || 'Calibri', border: { type: 'solid', color: bc, pt: 1 }, valign: 'middle', margin: 0.06 }); continue;
      }
      const fx = {}; if (o.rot) fx.rotate = o.rot; if (o.shadow) fx.shadow = { type: 'outer', color: '000000', opacity: 0.45, blur: 8, offset: 6, angle: 45 };
      if (o.type === 'image') { if (/^data:image\//.test(o.src || '')) s.addImage({ data: o.src.replace(/^data:/, ''), ...pos, ...(o.rot ? { rotate: o.rot } : {}) }); continue; }
      if (o.type === 'arrow') { s.addShape(p.ShapeType.line, { ...pos, y: pos.y + pos.h / 2, h: 0, line: { color: col(o.line || '#ffffff'), width: o.lw || 4, endArrowType: 'triangle' }, ...fx }); continue; }
      const fill = o.fill ? { color: col(o.fill) } : undefined, line = o.line ? { color: col(o.line), width: o.lw || 1 } : undefined;
      const txt = { fontSize: o.fs || 18, bold: !!o.b, italic: !!o.i, underline: o.u ? { style: 'sng' } : undefined, color: col(o.color || '#000000'), align: o.al || 'left', valign: 'top', fontFace: o.ff || 'Calibri' };
      if (o.type === 'text') s.addText(o.text || '', { ...pos, ...txt, fill, line, margin: 4, fit: 'none', ...fx });
      else s.addShape(o.type === 'ellipse' ? p.ShapeType.ellipse : o.type === 'triangle' ? p.ShapeType.triangle : p.ShapeType.rect, { ...pos, fill: fill || { color: 'FFFFFF' }, line, ...fx });
      if (o.type !== 'text' && o.text) s.addText(o.text, { ...pos, ...txt, valign: 'middle', align: o.al || 'center', ...(o.rot ? { rotate: o.rot } : {}) });
    }
    if (sd.notes) s.addNotes(sd.notes);
  }
  let buf = Buffer.from(await p.write({ outputType: 'nodebuffer' }));
  if (deck.slides.some(x => x.tr && x.tr !== 'none')) {
    try {
      const JSZip = require('jszip'), zip = await JSZip.loadAsync(buf), X = { fade: '<p:fade/>', slide: '<p:cover dir="l"/>', push: '<p:push dir="l"/>', zoom: '<p:zoom dir="in"/>', wipe: '<p:wipe dir="l"/>', flip: '<p:split orient="horz" dir="out"/>', rotate: '<p:zoom dir="out"/>', blur: '<p:fade/>', bounce: '<p:push dir="u"/>', curtain: '<p:split orient="vert" dir="out"/>' };
      for (let i = 0; i < deck.slides.length; i++) {
        const t = X[deck.slides[i].tr], f = zip.file('ppt/slides/slide' + (i + 1) + '.xml'); if (!t || !f) continue;
        const xml = await f.async('string'); if (xml.includes('<p:transition')) continue;
        zip.file('ppt/slides/slide' + (i + 1) + '.xml', xml.replace('</p:clrMapOvr>', '</p:clrMapOvr><p:transition spd="med">' + t + '</p:transition>'));
      }
      buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    } catch (e) { /* transitions non exportées */ }
  }
  return buf;
}
ipcMain.handle('pptx:write', async (_e, { path: p, deck }) => { try { await writeAtomic(p, await pptxBuild(deck)); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });


/* ---------- IA connectée (clé API de l'utilisateur, optionnelle) ---------- */
const AI_MODEL = 'claude-sonnet-5-5', keyFile = () => path.join(app.getPath('userData'), 'ai.key');
function aiKey() { try { const b = fs.readFileSync(keyFile()); const { safeStorage } = require('electron'); return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : b.toString('utf8'); } catch (e) { return ''; } }

/* ----- Compte Google : voir google.js ----- */
const G = require('./google'); G.register();

/* ----- Mise à jour automatique depuis GitHub (versions installées via l'installateur uniquement) ----- */
function setupUpdater() {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return; // pas pour la version portable ni en développement
  try {
    const { autoUpdater } = require('electron-updater'); autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-downloaded', info => {
      dialog.showMessageBox({ type: 'info', buttons: ['Redémarrer maintenant', 'Plus tard'], defaultId: 0, title: 'Mise à jour prête', message: 'La version ' + info.version + ' est téléchargée.', detail: 'Redémarrez pour l\'installer (sinon elle s\'installera à la fermeture).' }).then(r => { if (r.response === 0) autoUpdater.quitAndInstall(); });
    });
    autoUpdater.on('error', () => { /* hors ligne ou dépôt sans version : on ignore */ });
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 8000);
  } catch (e) { /* module absent : pas de mise à jour automatique */ }
}
/* ----- IA connectée : clé API OU abonnement Claude via Claude Code (CLI officiel installé sur le PC) ----- */
const { execFile, spawn } = require('child_process');
let cliCache = null;
function cliInfo(force) {
  if (cliCache && !force) return cliCache;
  return (cliCache = new Promise(res => { try { execFile('claude', ['--version'], { shell: true, windowsHide: true, timeout: 15000 }, (err, out) => res(err ? { installed: false } : { installed: true, version: String(out).trim().split('\n')[0] })); } catch (e) { res({ installed: false }); } }));
}
function cliAsk(system, prompt) {
  return new Promise(resolve => {
    const dir = path.join(app.getPath('userData'), 'ai-cwd'); try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* existe déjà */ }
    let out = '', err = '', done = false; const fin = r => { if (!done) { done = true; clearTimeout(to); resolve(r); } };
    let p; try { p = spawn('claude', ['-p', '--output-format', 'text', '--max-turns', '1'], { cwd: dir, shell: true, windowsHide: true }); } catch (e) { return resolve({ ok: false, error: 'Claude Code introuvable.' }); }
    const to = setTimeout(() => { try { p.kill(); } catch (e) { /* déjà terminé */ } fin({ ok: false, error: 'Délai dépassé (3 min).' }); }, 180000);
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
    p.on('error', e => fin({ ok: false, error: e.message }));
    p.on('close', code => {
      const txt = out.trim(), msg = (txt + ' ' + err).toLowerCase();
      if (code === 0 && txt) return fin({ ok: true, text: txt });
      if (/log ?in|not logged|authenticat|\/login|oauth|credential/.test(msg)) return fin({ ok: false, error: 'Claude Code n\'est pas connecté : ouvrez le terminal de connexion (bouton dans la fenêtre IA).' });
      if (/limit|quota|usage/.test(msg)) return fin({ ok: false, error: 'Limite d\'utilisation de votre abonnement atteinte, réessayez plus tard.' });
      fin({ ok: false, error: (err.trim() || txt || 'Claude Code a échoué (code ' + code + ').').slice(0, 300) });
    });
    p.stdin.on('error', () => { /* fermé tôt */ });
    p.stdin.end((system ? 'Consignes à respecter strictement :\n' + system + '\n\n' : '') + 'Tâche :\n' + prompt + '\n\nRéponds uniquement avec le résultat demandé, sans commentaire ni outils.');
  });
}
ipcMain.handle('ai:status', async () => { const k = !!aiKey(), c = await cliInfo(); return { on: k || c.installed, mode: k ? 'key' : c.installed ? 'cli' : 'off', key: k, cli: !!c.installed, cliVersion: c.version || '' }; });
ipcMain.handle('ai:cli-test', async () => { const c = await cliInfo(true); if (!c.installed) return { ok: false, installed: false, error: 'Claude Code n\'est pas installé.' }; const r = await cliAsk('', 'Réponds exactement : ok'); return Object.assign({ installed: true }, r); });
ipcMain.handle('ai:cli-login', () => { try { if (process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '"Connexion Claude"', 'cmd', '/k', 'claude'], { detached: true, windowsHide: false, stdio: 'ignore' }).unref(); else if (process.platform === 'darwin') spawn('open', ['-a', 'Terminal'], { detached: true, stdio: 'ignore' }).unref(); else spawn('x-terminal-emulator', ['-e', 'claude'], { detached: true, stdio: 'ignore' }).unref(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('ai:set-key', (_e, k) => {
  try { k = String(k || '').trim(); if (!k) { try { fs.unlinkSync(keyFile()); } catch (e) { /* absent */ } return { ok: true, on: false }; }
    const { safeStorage } = require('electron'); fs.writeFileSync(keyFile(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(k) : Buffer.from(k, 'utf8')); return { ok: true, on: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('ai:ask', async (_e, { system, prompt }) => {
  const key = aiKey();
  if (!key) { const c = await cliInfo(); if (c.installed) return cliAsk(system, prompt); return { ok: false, error: 'Aucune clé API ni Claude Code détecté.' }; }
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 60000);
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: AI_MODEL, max_tokens: 2500, system: String(system || '').slice(0, 4000), messages: [{ role: 'user', content: String(prompt || '').slice(0, 20000) }] }) });
    clearTimeout(t); const j = await r.json();
    if (!r.ok) return { ok: false, error: (j && j.error && j.error.message) || ('Erreur ' + r.status) };
    return { ok: true, text: (j.content || []).map(c => c.text || '').join('') };
  } catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'Délai dépassé.' : e.message }; }
});

let docxLib = null;
async function buildDocx(pl) {
  if (!docxLib) { const m = require('html-to-docx'); docxLib = m.default || m; }
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + pl.html + '</body></html>';
  const o = pl.opts || {};
  const out = await docxLib(html, pl.headerHtml || null, {
    orientation: o.orientation, pageSize: o.pageSize, margins: o.margins, title: o.title, creator: G.authorName() || o.creator, font: o.font, fontSize: o.fontSize,
    table: { row: { cantSplit: true } }, header: !!pl.headerHtml, footer: o.footer, pageNumber: o.pageNumber, lang: 'fr-FR'
  }, pl.footerHtml || null);
  return Buffer.isBuffer(out) ? out : Buffer.from(await out.arrayBuffer());
}
ipcMain.handle('file:write', async (_e, { path: p, payload }) => {
  try {
    if (!p || typeof p !== 'string') throw new Error('chemin invalide');
    if (payload.kind === 'docx') await writeAtomic(p, await buildDocx(payload));
    else if (payload.kind === 'text') await writeAtomic(p, Buffer.from((p.toLowerCase().endsWith('.txt') ? '﻿' : '') + payload.text, 'utf8'));
    else throw new Error('type inconnu');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('file:pdf', async (e, { path: p }) => {
  try {
    const data = await e.sender.printToPDF({ printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
    await writeAtomic(p, data); return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

/* ---------- Divers ---------- */
ipcMain.handle('clip:read', () => ({ html: clipboard.readHTML(), text: clipboard.readText() }));
ipcMain.handle('app:info', () => ({ version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, platform: process.platform + ' ' + process.arch, userData: app.getPath('userData') }));
ipcMain.handle('app:external', (_e, u) => { openSafe(String(u)); });
ipcMain.handle('app:spell', (_e, lang) => {
  const map = { fr: 'fr', en: 'en-US', es: 'es', de: 'de', it: 'it' }, l = map[lang] || lang;
  const avail = session.defaultSession.availableSpellCheckerLanguages;
  const pick = avail.find(x => x === l) || avail.find(x => x.startsWith(String(l).slice(0, 2)));
  if (pick) session.defaultSession.setSpellCheckerLanguages([pick]);
});

/* ---------- Partage en réseau local (lecture seule) ---------- */
let server = null, shared = { title: '', html: '', rev: 0 }, port = 0;
const lanIPs = () => Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
function stopShare() { if (server) { try { server.closeAllConnections && server.closeAllConnections(); server.close(); } catch (e) { /* ignore */ } server = null; } }
function urls() { return server ? lanIPs().concat(['localhost']).map(ip => 'http://' + ip + ':' + port + '/') : null; }
function liveHTML(html) {
  const poll = '<script>(function(){var r=' + shared.rev + ';setInterval(function(){fetch("/rev",{cache:"no-store"}).then(function(x){return x.text()}).then(function(t){if(+t!==r)location.reload()}).catch(function(){})},3000)})()</script>';
  return html.replace('</body>', '<p style="text-align:center;color:#888;font:12px sans-serif;margin-top:40px">Lecture seule · mise à jour automatique</p>' + poll + '</body>');
}
ipcMain.handle('share:start', async (_e, o) => {
  shared = { title: o.title, html: o.html, rev: shared.rev + 1 };
  if (!server) {
    server = http.createServer((req, res) => {
      const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'" };
      if (req.url === '/rev') { res.writeHead(200, { ...headers, 'Content-Type': 'text/plain' }); res.end(String(shared.rev)); }
      else if (req.url === '/' || req.url.startsWith('/?')) { res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' }); res.end(liveHTML(shared.html)); }
      else { res.writeHead(404, headers); res.end('Introuvable'); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '0.0.0.0', () => { port = server.address().port; resolve(); }); }).catch(err => { server = null; throw err; });
  }
  return { urls: urls() };
});
ipcMain.handle('share:update', (_e, o) => { if (server) shared = { title: o.title, html: o.html, rev: shared.rev + 1 }; return true; });
ipcMain.handle('share:stop', () => { stopShare(); return true; });
ipcMain.handle('share:urls', () => urls());
