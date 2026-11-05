'use strict';
/* ===== Excel Dark : grille, sélection, édition, formats, fichiers ===== */
(function () {
  const { $, $$, esc, ACT } = A, api = A.api;
  const ROWS0 = 200, COLS = 26, DEFW = 90, DEFH = 22;
  let ROWS = ROWS0;
  const store = A.store('excel-dark');
  let wb = null, calc = null, sel = { r0: 0, c0: 0, r1: 0, c1: 0 }, act = { r: 0, c: 0 }, anchor = { r: 0, c: 0 };
  let tds = [], host = $('#grid-host'), wrap = $('#grid-wrap'), editor = $('#cell-edit'), editing = false, clip = null;
  let undoStack = [], redoStack = [], zoom = 1, dragging = false, dirty = false;

  const newSheet = name => ({ name, cells: {}, colW: {}, rowH: {} });
  const newBook = () => ({ id: A.uid(), title: 'Classeur1', path: null, fmt: 'xlsx', sheets: [newSheet('Feuil1')], cur: 0, created: Date.now() });
  const sh = () => wb.sheets[wb.cur];
  const cellAt = (c, r) => sh().cells[E.key(c, r)];
  const colW = c => sh().colW[c] || DEFW;

  /* ---------- Mise en forme des valeurs ---------- */
  function fmtNum(v, s) {
    const nf = (s && s.nf) || 'g', dp = s && s.dp != null ? s.dp : null, L = 'fr-FR';
    const f = (n, d) => n.toLocaleString(L, { minimumFractionDigits: d, maximumFractionDigits: d });
    switch (nf) {
      case '0': return f(v, dp != null ? dp : 0).replace(/ | /g, '');
      case '0.00': return f(v, dp != null ? dp : 2).replace(/ | /g, '');
      case 'sep': return f(v, dp != null ? dp : 2);
      case '%': return f(v * 100, dp != null ? dp : 0) + ' %';
      case 'eur': return f(v, dp != null ? dp : 2) + ' €';
      case 'date': return E.fmtDate(v);
      default:
        if (dp != null) return f(v, dp).replace(/ | /g, '');
        return String(Math.round(v * 1e10) / 1e10).replace('.', ',');
    }
  }
  function display(v, s) {
    if (v instanceof Error) return E.errText(v);
    if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
    if (typeof v === 'number') return fmtNum(v, s);
    return v == null ? '' : String(v);
  }

  /* ---------- Construction de la grille ---------- */
  function build() {
    const h = ['<table class="grid' + (A.settings.get('xlGrid', true) ? '' : ' nogrid') + '"><colgroup><col style="width:46px">'];
    for (let c = 0; c < COLS; c++) h.push('<col style="width:' + colW(c) + 'px">');
    h.push('</colgroup><thead><tr><th class="rh corner"></th>');
    for (let c = 0; c < COLS; c++) h.push('<th data-c="' + c + '">' + E.colName(c) + '</th>');
    h.push('</tr></thead><tbody>');
    for (let r = 0; r < ROWS; r++) { h.push('<tr><th class="rh" data-r="' + r + '">' + (r + 1) + '</th>'); for (let c = 0; c < COLS; c++) h.push('<td data-c="' + c + '" data-r="' + r + '"></td>'); h.push('</tr>'); }
    h.push('</tbody></table>');
    host.innerHTML = h.join('');
    tds = []; const trs = host.querySelectorAll('tbody tr');
    trs.forEach((tr, r) => { tds[r] = Array.from(tr.querySelectorAll('td')); const rh = sh().rowH[r]; if (rh) tr.style.height = rh + 'px'; });
    host.style.zoom = zoom;
    refreshAll(); renderSel(); renderTabs();
  }
  function paintCell(c, r) {
    const td = tds[r] && tds[r][c]; if (!td) return;
    const cell = cellAt(c, r), s = (cell && cell.s) || {};
    const v = cell ? calc.value(wb.cur, E.key(c, r)) : '';
    td.textContent = display(v, s);
    let cls = '';
    if (v instanceof Error) cls = 'err'; else if (typeof v === 'number' && !s.al) cls = 'num';
    if (s.wrap) cls += ' wrap';
    td.className = cls + (inSel(c, r) ? ' insel' : '') + (act.r === r && act.c === c ? ' active' : '');
    const st = td.style;
    st.fontWeight = s.b ? '700' : ''; st.fontStyle = s.i ? 'italic' : ''; st.textDecoration = s.u ? 'underline' : '';
    st.textAlign = s.al || ''; st.color = s.color || ''; st.backgroundColor = s.fill || ''; st.fontSize = s.sz ? s.sz + 'pt' : '';
    st.border = ''; if (s.bd) { st.borderRight = st.borderBottom = st.borderTop = st.borderLeft = '1px solid #000'; }
    if (window.XLX && cell) XLX.cf(c, r, v, td);
  }
  function refreshAll() { calc = new E.Calc(wb); for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) paintCell(c, r); updateStats(); if (window.XLX) XLX.refresh(); }
  const inSel = (c, r) => c >= sel.c0 && c <= sel.c1 && r >= sel.r0 && r <= sel.r1;

  function renderSel() {
    $$('.insel,.active', host).forEach(t => t.classList.remove('insel', 'active'));
    $$('th.sel', host).forEach(t => t.classList.remove('sel'));
    for (let r = sel.r0; r <= sel.r1 && r < ROWS; r++) for (let c = sel.c0; c <= sel.c1 && c < COLS; c++) { const td = tds[r][c]; td.classList.add('insel'); }
    const a = tds[act.r] && tds[act.r][act.c]; if (a) { a.classList.add('active'); a.classList.remove('insel'); }
    for (let c = sel.c0; c <= sel.c1; c++) { const th = host.querySelector('thead th[data-c="' + c + '"]'); if (th) th.classList.add('sel'); }
    for (let r = sel.r0; r <= sel.r1; r++) { const th = host.querySelector('tbody th[data-r="' + r + '"]'); if (th) th.classList.add('sel'); }
    $('#name-box').value = (sel.r0 === sel.r1 && sel.c0 === sel.c1) ? E.key(act.c, act.r) : E.key(sel.c0, sel.r0) + ':' + E.key(sel.c1, sel.r1);
    if (!editing) $('#formula').value = rawOf(act.c, act.r);
    syncToolbar(); updateStats();
  }
  const rawOf = (c, r) => { const x = cellAt(c, r); if (!x || x.v == null) return ''; if (typeof x.v === 'number') { const s = x.s || {}; if (s.nf === 'date') return E.fmtDate(x.v); if (s.nf === '%') return String(x.v * 100).replace('.', ',') + '%'; return String(x.v).replace('.', ','); } return String(x.v); };

  function updateStats() {
    const nums = []; let n = 0;
    for (let r = sel.r0; r <= sel.r1 && r < ROWS; r++) for (let c = sel.c0; c <= sel.c1 && c < COLS; c++) { const x = cellAt(c, r); if (x && x.v !== '' && x.v != null) { n++; const v = calc.value(wb.cur, E.key(c, r)); if (typeof v === 'number') nums.push(v); } }
    const el = $('#sb-stats');
    if (n > 1 && nums.length) { const s = nums.reduce((a, b) => a + b, 0); el.textContent = 'Moyenne : ' + fmtNum(s / nums.length) + '   NB : ' + n + '   Somme : ' + fmtNum(s); } else el.textContent = '';
  }
  function syncToolbar() {
    const c = cellAt(act.c, act.r), s = (c && c.s) || {};
    $('#t-bold').classList.toggle('on', !!s.b); $('#t-italic').classList.toggle('on', !!s.i); $('#t-underline').classList.toggle('on', !!s.u); $('#t-wrap').classList.toggle('on', !!s.wrap); $('#t-borders').classList.toggle('on', !!s.bd);
    $('#sel-nf').value = s.nf || 'g'; $('#sel-size').value = String(s.sz || 11);
  }

  /* ---------- Modèle : modifications, annuler/rétablir, sauvegarde ---------- */
  const snap = () => JSON.stringify({ s: wb.sheets, cur: wb.cur });
  function mutate(fn, opt) {
    stopEdit(true);
    undoStack.push(snap()); if (undoStack.length > 100) undoStack.shift(); redoStack = [];
    fn(); afterChange(opt);
  }
  function afterChange(opt) { dirty = true; setBadge('pending'); refreshAll(); renderSel(); autosave(); if (opt && opt.tabs) renderTabs(); }
  function restore(js) { const o = JSON.parse(js); wb.sheets = o.s; wb.cur = Math.min(o.cur, o.s.length - 1); build(); dirty = true; autosave(); setBadge('pending'); }
  ACT.undo = () => { if (!undoStack.length) return; redoStack.push(snap()); restore(undoStack.pop()); };
  ACT.redo = () => { if (!redoStack.length) return; undoStack.push(snap()); restore(redoStack.pop()); };

  function setBadge(k) { const b = $('#save-badge'); b.className = 'badge ' + (k === 'saved' ? 'saved' : 'dirty'); b.textContent = k === 'saved' ? 'Enregistré' : k === 'auto' ? 'Copie auto enregistrée' : 'Modifié'; if (k === 'auto') b.className = 'badge saved'; }
  const doSave = async () => { try { await store.put({ id: wb.id, title: wb.title, path: wb.path, fmt: wb.fmt, sheets: wb.sheets, cur: wb.cur, created: wb.created, modified: Date.now() }); A.settings.set('lastXl', wb.id); return true; } catch (e) { return false; } };
  const autosave = A.debounce(async () => { if (A.settings.get('autosave', true) && await doSave()) setBadge('auto'); }, 1200);

  /* ---------- Saisie ---------- */
  function parseInput(txt, cell) {
    const t = txt.trim(), s = cell && cell.s;
    if (txt === '') return { v: '' };
    if (txt[0] === '=' && txt.length > 1) return { v: txt };
    if (s && s.nf === 'txt') return { v: txt };
    if (/^[-+]?\d+([.,]\d+)?$/.test(t)) return { v: parseFloat(t.replace(',', '.')) };
    if (/^[-+]?\d+([.,]\d+)?\s?%$/.test(t)) { const dc = (/[.,](\d+)/.exec(t) || [, ''])[1].length; return { v: Math.round(parseFloat(t.replace(',', '.')) * 1e8) / 1e10, nf: '%', dp: dc }; }
    const d = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t); if (d) { const dt = new Date(+d[3], +d[2] - 1, +d[1]); if (dt.getMonth() === +d[2] - 1) return { v: E.toSerial(dt), nf: 'date' }; }
    const m = /^([-+]?\d+(?:[.,]\d+)?)\s?€$/.exec(t); if (m) return { v: parseFloat(m[1].replace(',', '.')), nf: 'eur' };
    return { v: txt };
  }
  function setRaw(c, r, txt) {
    const k = E.key(c, r), cell = sh().cells[k], p = parseInput(txt, cell);
    if (p.v === '' && !(cell && cell.s)) { delete sh().cells[k]; return; }
    const n = cell || (sh().cells[k] = {}); n.v = p.v; if (p.nf && (!n.s || !n.s.nf)) { n.s = Object.assign({}, n.s, { nf: p.nf }, p.dp != null ? { dp: p.dp } : {}); }
    if (p.v === '' && !n.s) delete sh().cells[k];
  }
  function startEdit(init) {
    if (editing) return; editing = true;
    const td = tds[act.r][act.c], tr = td.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    editor.style.left = (tr.left - wr.left + wrap.scrollLeft) + 'px'; editor.style.top = (tr.top - wr.top + wrap.scrollTop) + 'px';
    editor.style.width = Math.max(tr.width, 120) + 'px'; editor.style.height = tr.height + 'px';
    editor.value = init != null ? init : rawOf(act.c, act.r); editor.classList.remove('hidden'); editor.focus();
    if (init == null) editor.setSelectionRange(editor.value.length, editor.value.length);
    $('#formula').value = editor.value;
  }
  function stopEdit(commit, move) {
    if (!editing) return; editing = false; const val = editor.value; editor.classList.add('hidden');
    if (commit) {
      if (val !== rawOf(act.c, act.r)) { undoStack.push(snap()); redoStack = []; setRaw(act.c, act.r, val); afterChange(); }
      if (move) go(move.dr, move.dc);
    }
    wrap.focus({ preventScroll: true });
  }
  editor.addEventListener('input', () => { $('#formula').value = editor.value; });
  editor.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); stopEdit(true, { dr: e.shiftKey ? -1 : 1, dc: 0 }); }
    else if (e.key === 'Tab') { e.preventDefault(); stopEdit(true, { dr: 0, dc: e.shiftKey ? -1 : 1 }); }
    else if (e.key === 'Escape') { e.preventDefault(); stopEdit(false); renderSel(); }
    e.stopPropagation();
  });
  $('#formula').addEventListener('focus', () => { /* édition dans la barre */ });
  $('#formula').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); const v = $('#formula').value; if (v !== rawOf(act.c, act.r)) mutate(() => setRaw(act.c, act.r, v)); wrap.focus(); }
    else if (e.key === 'Escape') { $('#formula').value = rawOf(act.c, act.r); wrap.focus(); }
    e.stopPropagation();
  });
  $('#name-box').addEventListener('keydown', e => {
    if (e.key !== 'Enter') { e.stopPropagation(); return; } e.preventDefault();
    const m = /^([A-Za-z]{1,3}\d+)(?::([A-Za-z]{1,3}\d+))?$/.exec($('#name-box').value.trim()); if (m) { const a = E.parseKey(m[1]), b = m[2] ? E.parseKey(m[2]) : a; if (a.r < ROWS && b.r < ROWS && a.c < COLS && b.c < COLS) { anchor = a; act = { r: a.r, c: a.c }; setSel(a, b); } }
    wrap.focus();
  });

  /* ---------- Sélection & navigation ---------- */
  function setSel(a, b) { sel = { r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) }; renderSel(); ensureVisible(act.c, act.r); }
  function ensureVisible(c, r) { const td = tds[r] && tds[r][c]; if (!td) return; const t = td.getBoundingClientRect(), w = wrap.getBoundingClientRect(); if (t.bottom > w.bottom) wrap.scrollTop += t.bottom - w.bottom + 4; if (t.top < w.top + 24) wrap.scrollTop -= w.top + 24 - t.top; if (t.right > w.right) wrap.scrollLeft += t.right - w.right + 4; if (t.left < w.left + 46) wrap.scrollLeft -= w.left + 46 - t.left; }
  function go(dr, dc, extend) {
    const nr = Math.max(0, Math.min(ROWS - 1, (extend ? focusCell().r : act.r) + dr)), nc = Math.max(0, Math.min(COLS - 1, (extend ? focusCell().c : act.c) + dc));
    if (extend) { fc = { r: nr, c: nc }; sel = { r0: Math.min(anchor.r, nr), c0: Math.min(anchor.c, nc), r1: Math.max(anchor.r, nr), c1: Math.max(anchor.c, nc) }; renderSel(); ensureVisible(nc, nr); }
    else { act = { r: nr, c: nc }; anchor = { r: nr, c: nc }; fc = null; setSel(act, act); }
    if (nr >= ROWS - 3) growRows();
  }
  let fc = null; const focusCell = () => fc || act;
  function growRows() { if (ROWS >= 2000) return; ROWS += 100; const keep = { ...sel }; build(); sel = keep; renderSel(); }
  host.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const th = e.target.closest('th'), td = e.target.closest('td');
    if (editing) { if (td && editor.value.startsWith('=') && /[-+*/^&=<>(,;:]$/.test(editor.value)) { e.preventDefault(); editor.value += E.key(+td.dataset.c, +td.dataset.r); editor.focus(); return; } stopEdit(true); }
    if (th && th.dataset.c != null) {
      const rect = th.getBoundingClientRect(); if (e.clientX > rect.right - 5) { startResize(+th.dataset.c, e); return; }
      const c = +th.dataset.c; anchor = { r: 0, c }; act = { r: 0, c }; sel = { r0: 0, c0: c, r1: ROWS - 1, c1: c }; fc = null; renderSel(); dragging = 'col'; return;
    }
    if (th && th.dataset.r != null) { const r = +th.dataset.r; anchor = { r, c: 0 }; act = { r, c: 0 }; sel = { r0: r, c0: 0, r1: r, c1: COLS - 1 }; fc = null; renderSel(); dragging = 'row'; return; }
    if (td) { const p = { r: +td.dataset.r, c: +td.dataset.c }; if (e.shiftKey) { fc = p; setSel(anchor, p); } else { act = p; anchor = p; fc = null; setSel(p, p); } dragging = 'cell'; wrap.focus({ preventScroll: true }); }
  });
  host.addEventListener('mousemove', e => {
    const th = e.target.closest('thead th[data-c]'); if (th && !dragging) { const r = th.getBoundingClientRect(); host.style.cursor = e.clientX > r.right - 5 ? 'col-resize' : ''; } else if (!dragging) host.style.cursor = '';
    if (!dragging || dragging === 'resize') return;
    const el = document.elementFromPoint(e.clientX, e.clientY), td = el && el.closest && el.closest('td'); if (!td || dragging !== 'cell') return;
    const p = { r: +td.dataset.r, c: +td.dataset.c }; fc = p; sel = { r0: Math.min(anchor.r, p.r), c0: Math.min(anchor.c, p.c), r1: Math.max(anchor.r, p.r), c1: Math.max(anchor.c, p.c) }; renderSel();
  });
  document.addEventListener('mouseup', () => { if (dragging !== 'resize') dragging = false; });
  host.addEventListener('dblclick', e => { const td = e.target.closest('td'); if (td) startEdit(); });
  function startResize(c, e) {
    dragging = 'resize'; const x0 = e.clientX, w0 = colW(c), col = host.querySelectorAll('col')[c + 1];
    const mv = ev => { const w = Math.max(24, w0 + (ev.clientX - x0) / zoom); col.style.width = w + 'px'; sh().colW[c] = Math.round(w); };
    const up = () => { dragging = false; document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); dirty = true; autosave(); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); e.preventDefault();
  }

  /* ---------- Clavier ---------- */
  wrap.tabIndex = 0;
  document.addEventListener('keydown', e => {
    if (editing || e.target.matches('input,textarea,select')) return;
    if ($('#modal-backdrop')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key;
    if (ctrl) {
      const f = { s: ACT.save, z: ACT.undo, y: ACT.redo, b: ACT.bold, i: ACT.italic, u: ACT.underline, d: () => fill('down'), r: () => fill('right'), o: ACT.open, n: ACT.newBook }[k.toLowerCase()];
      if (f) { e.preventDefault(); f(); return; }
      if (k === 'a') { e.preventDefault(); sel = { r0: 0, c0: 0, r1: ROWS - 1, c1: COLS - 1 }; renderSel(); }
      return;
    }
    if (k === 'ArrowDown') { e.preventDefault(); go(1, 0, e.shiftKey); } else if (k === 'ArrowUp') { e.preventDefault(); go(-1, 0, e.shiftKey); }
    else if (k === 'ArrowLeft') { e.preventDefault(); go(0, -1, e.shiftKey); } else if (k === 'ArrowRight') { e.preventDefault(); go(0, 1, e.shiftKey); }
    else if (k === 'Tab') { e.preventDefault(); go(0, e.shiftKey ? -1 : 1); } else if (k === 'Enter') { e.preventDefault(); go(e.shiftKey ? -1 : 1, 0); }
    else if (k === 'F2') { e.preventDefault(); startEdit(); }
    else if (k === 'PageDown') { e.preventDefault(); go(20, 0); } else if (k === 'PageUp') { e.preventDefault(); go(-20, 0); }
    else if (k === 'Home') { e.preventDefault(); go(0, -act.c); }
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); mutate(() => eachSel(k2 => { const c = sh().cells[k2]; if (c) { c.v = ''; if (!c.s) delete sh().cells[k2]; } })); }
    else if (k.length === 1 && !e.altKey) { e.preventDefault(); startEdit(k); }
  });
  function eachSel(fn) { for (let r = sel.r0; r <= sel.r1 && r < ROWS; r++) for (let c = sel.c0; c <= sel.c1 && c < COLS; c++) fn(E.key(c, r), c, r); }

  /* ---------- Presse-papiers ---------- */
  function selTSV() { const rows = []; for (let r = sel.r0; r <= sel.r1; r++) { const row = []; for (let c = sel.c0; c <= sel.c1; c++) row.push(display(calc.value(wb.cur, E.key(c, r)), (cellAt(c, r) || {}).s)); rows.push(row.join('\t')); } return rows.join('\n'); }
  function copyData() { const cells = []; for (let r = sel.r0; r <= sel.r1; r++) { const row = []; for (let c = sel.c0; c <= sel.c1; c++) { const x = cellAt(c, r); row.push(x ? JSON.parse(JSON.stringify(x)) : null); } cells.push(row); } return { r: sel.r0, c: sel.c0, cells, tsv: selTSV() }; }
  function pasteAt(text, mode) {
    mutate(() => {
      if (clip && clip.tsv === text) {
        clip.cells.forEach((row, i) => row.forEach((x, j) => { const c = act.c + j, r = act.r + i; if (c >= COLS || r >= ROWS) return; const k = E.key(c, r); if (!x) { delete sh().cells[k]; return; } const n = JSON.parse(JSON.stringify(x)); if (typeof n.v === 'string' && n.v[0] === '=') n.v = E.shiftFormula(n.v, c - (clip.c + j), r - (clip.r + i)); sh().cells[k] = n; }));
        sel = { r0: act.r, c0: act.c, r1: Math.min(ROWS - 1, act.r + clip.cells.length - 1), c1: Math.min(COLS - 1, act.c + clip.cells[0].length - 1) };
      } else {
        const rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
        rows.forEach((row, i) => row.forEach((t, j) => { const c = act.c + j, r = act.r + i; if (c < COLS && r < ROWS) setRaw(c, r, t); }));
        sel = { r0: act.r, c0: act.c, r1: Math.min(ROWS - 1, act.r + rows.length - 1), c1: Math.min(COLS - 1, act.c + rows[0].length - 1) };
      }
    });
  }
  document.addEventListener('copy', e => { if (editing || e.target.matches('input,textarea')) return; clip = copyData(); e.clipboardData.setData('text/plain', clip.tsv); e.preventDefault(); A.toast('Copié.'); });
  document.addEventListener('cut', e => { if (editing || e.target.matches('input,textarea')) return; clip = copyData(); e.clipboardData.setData('text/plain', clip.tsv); e.preventDefault(); mutate(() => eachSel(k => { delete sh().cells[k]; })); });
  document.addEventListener('paste', e => { if (editing || e.target.matches('input,textarea')) return; e.preventDefault(); const t = e.clipboardData.getData('text/plain'); if (t) pasteAt(t); });
  ACT.copy = () => { clip = copyData(); navigator.clipboard.writeText(clip.tsv).then(() => A.toast('Copié.')).catch(() => {}); };
  ACT.cut = () => { clip = copyData(); navigator.clipboard.writeText(clip.tsv).catch(() => {}); mutate(() => eachSel(k => { delete sh().cells[k]; })); };
  ACT.paste = async () => { const c = api && api.clipboardRead ? await api.clipboardRead() : { text: await navigator.clipboard.readText() }; if (c && c.text) pasteAt(c.text); };
  function fill(dir) {
    mutate(() => {
      if (dir === 'down') for (let c = sel.c0; c <= sel.c1; c++) { const src = cellAt(c, sel.r0); for (let r = sel.r0 + 1; r <= sel.r1; r++) { const k = E.key(c, r); if (!src) { delete sh().cells[k]; continue; } const n = JSON.parse(JSON.stringify(src)); if (typeof n.v === 'string' && n.v[0] === '=') n.v = E.shiftFormula(n.v, 0, r - sel.r0); sh().cells[k] = n; } }
      else for (let r = sel.r0; r <= sel.r1; r++) { const src = cellAt(sel.c0, r); for (let c = sel.c0 + 1; c <= sel.c1; c++) { const k = E.key(c, r); if (!src) { delete sh().cells[k]; continue; } const n = JSON.parse(JSON.stringify(src)); if (typeof n.v === 'string' && n.v[0] === '=') n.v = E.shiftFormula(n.v, c - sel.c0, 0); sh().cells[k] = n; } }
    });
  }

  /* ---------- Styles ---------- */
  function setStyle(patch) { mutate(() => eachSel(k => { const c = sh().cells[k] || (sh().cells[k] = { v: '' }); c.s = Object.assign({}, c.s, patch); Object.keys(c.s).forEach(p => { if (c.s[p] === undefined || c.s[p] === false || c.s[p] === '') delete c.s[p]; }); if (!Object.keys(c.s).length) delete c.s; if (c.v === '' && !c.s) delete sh().cells[k]; })); }
  const toggle = p => { const c = cellAt(act.c, act.r), cur = !!(c && c.s && c.s[p]); setStyle({ [p]: cur ? false : true }); };
  Object.assign(ACT, {
    bold: () => toggle('b'), italic: () => toggle('i'), underline: () => toggle('u'), wrap: () => toggle('wrap'), borders: () => toggle('bd'),
    alignL: () => setStyle({ al: 'left' }), alignC: () => setStyle({ al: 'center' }), alignR: () => setStyle({ al: 'right' }),
    clearStyle: () => mutate(() => eachSel(k => { const c = sh().cells[k]; if (c) { delete c.s; if (c.v === '') delete sh().cells[k]; } })),
    nfEur: () => setStyle({ nf: 'eur' }), nfPct: () => setStyle({ nf: '%' }),
    decMore: () => { const c = cellAt(act.c, act.r), s = (c && c.s) || {}, dp = s.dp != null ? s.dp : (s.nf === '0' ? 0 : s.nf === '%' ? 0 : 2); setStyle({ dp: Math.min(10, dp + 1) }); },
    decLess: () => { const c = cellAt(act.c, act.r), s = (c && c.s) || {}, dp = s.dp != null ? s.dp : (s.nf === '0' ? 0 : s.nf === '%' ? 0 : 2); setStyle({ dp: Math.max(0, dp - 1) }); }
  });
  $('#sel-nf').addEventListener('change', e => { const v = e.target.value; setStyle({ nf: v === 'g' ? undefined : v, dp: undefined }); wrap.focus(); });
  $('#sel-size').addEventListener('change', e => { setStyle({ sz: +e.target.value === 11 ? undefined : +e.target.value }); wrap.focus(); });
  $('#in-color').addEventListener('input', e => { $('#bar-color').style.background = e.target.value; setStyle({ color: e.target.value }); });
  $('#in-fill').addEventListener('input', e => { $('#bar-fill').style.background = e.target.value; setStyle({ fill: e.target.value }); });

  /* ---------- Fonctions, somme auto, tri ---------- */
  function putFormula(fn) {
    mutate(() => {
      if (sel.r0 === sel.r1 && sel.c0 === sel.c1) {
        let r = act.r - 1; while (r >= 0 && typeof calc.value(wb.cur, E.key(act.c, r)) === 'number') r--;
        if (r < act.r - 1) { setRaw(act.c, act.r, '=' + fn + '(' + E.key(act.c, r + 1) + ':' + E.key(act.c, act.r - 1) + ')'); return; }
        let c = act.c - 1; while (c >= 0 && typeof calc.value(wb.cur, E.key(c, act.r)) === 'number') c--;
        if (c < act.c - 1) { setRaw(act.c, act.r, '=' + fn + '(' + E.key(c + 1, act.r) + ':' + E.key(act.c - 1, act.r) + ')'); return; }
        setRaw(act.c, act.r, '=' + fn + '()');
      } else if (sel.c0 === sel.c1 || sel.r1 - sel.r0 >= sel.c1 - sel.c0) setRaw(sel.c1, Math.min(ROWS - 1, sel.r1 + 1), '=' + fn + '(' + E.key(sel.c0, sel.r0) + ':' + E.key(sel.c1, sel.r1) + ')');
      else setRaw(Math.min(COLS - 1, sel.c1 + 1), sel.r1, '=' + fn + '(' + E.key(sel.c0, sel.r0) + ':' + E.key(sel.c1, sel.r1) + ')');
    });
  }
  Object.assign(ACT, { autoSum: () => putFormula('SOMME'), fnSum: () => putFormula('SOMME'), fnAvg: () => putFormula('MOYENNE'), fnMin: () => putFormula('MIN'), fnMax: () => putFormula('MAX'), fnCount: () => putFormula('NB'), recalc: () => { refreshAll(); renderSel(); A.toast('Recalculé.'); } });
  ACT.insertFn = async () => {
    const body = document.createElement('div'); body.innerHTML = '<div class="export-list" style="max-height:340px;overflow:auto;gap:4px">' + E.FUNCTIONS.map(f => '<button type="button" data-f="' + f + '" style="padding:6px 12px"><b>' + f + '</b></button>').join('') + '</div>';
    const f = await A.dialog({ title: 'Insérer une fonction', width: 360, body, buttons: [{ label: 'Annuler', value: null }], onOpen: (b, fin) => b.querySelectorAll('[data-f]').forEach(x => x.onclick = () => fin(x.dataset.f)) });
    if (f) { startEdit('=' + f + '('); }
  };
  function region() {
    if (sel.r0 !== sel.r1 || sel.c0 !== sel.c1) return { r0: sel.r0, r1: sel.r1, c0: sel.c0, c1: sel.c1 };
    let r0 = act.r, r1 = act.r, c0 = act.c, c1 = act.c; const has = (c, r) => { const x = cellAt(c, r); return x && x.v !== '' && x.v != null; };
    let ch = true; while (ch) { ch = false; for (let r = r0 - 1; r <= r1 + 1; r++) for (let c = c0 - 1; c <= c1 + 1; c++) { if (r < 0 || c < 0 || r >= ROWS || c >= COLS) continue; if (has(c, r)) { if (r < r0) { r0 = r; ch = true; } if (r > r1) { r1 = r; ch = true; } if (c < c0) { c0 = c; ch = true; } if (c > c1) { c1 = c; ch = true; } } } }
    return { r0, r1, c0, c1 };
  }
  function sortSel(desc) {
    const g = region(), col = Math.max(g.c0, Math.min(g.c1, act.c));
    let start = g.r0; const hv = calc.value(wb.cur, E.key(col, g.r0)), nv = g.r1 > g.r0 ? calc.value(wb.cur, E.key(col, g.r0 + 1)) : null;
    if (sel.r0 === sel.r1 && typeof hv === 'string' && typeof nv === 'number') start = g.r0 + 1;
    if (g.r1 <= start) return;
    mutate(() => {
      const rows = []; for (let r = start; r <= g.r1; r++) { const row = []; for (let c = g.c0; c <= g.c1; c++) row.push(sh().cells[E.key(c, r)] || null); rows.push({ r, row, key: calc.value(wb.cur, E.key(col, r)) }); }
      const cmp = (a, b) => { const x = a.key, y = b.key; const ex = x === '' || x == null, ey = y === '' || y == null; if (ex || ey) return ex === ey ? 0 : ex ? 1 : -1; if (typeof x === 'number' && typeof y === 'number') return x - y; return String(x).localeCompare(String(y), 'fr', { sensitivity: 'base', numeric: true }); };
      rows.sort((a, b) => desc ? -cmp(a, b) || 0 : cmp(a, b));
      rows.forEach((o, i) => { const nr = start + i; o.row.forEach((x, j) => { const k = E.key(g.c0 + j, nr); if (!x) { delete sh().cells[k]; return; } const n = JSON.parse(JSON.stringify(x)); if (typeof n.v === 'string' && n.v[0] === '=') n.v = E.shiftFormula(n.v, 0, nr - o.r); sh().cells[k] = n; }); });
    });
  }
  ACT.sortAsc = () => sortSel(false); ACT.sortDesc = () => sortSel(true);

  /* ---------- Insertion / suppression de lignes et colonnes ---------- */
  function adjust(f, axis, idx, delta, sheetName, own) {
    return f.replace(/("[^"]*")|((?:'[^']+'|[A-Za-zÀ-ÿ_][\wÀ-ÿ]*)!)?(\$?)([A-Z]{1,3})(\$?)(\d{1,7})(?![\w(])/g, (m, str, shp, ca, col, ra, row) => {
      if (str) return str;
      const target = shp ? shp.slice(0, -1).replace(/^'|'$/g, '').toLowerCase() === sheetName.toLowerCase() : own; if (!target) return m;
      let c = E.colIndex(col), r = +row - 1;
      if (axis === 'r') { if (delta > 0 ? r >= idx : false) r += delta; else if (delta < 0) { if (r === idx) return '#REF!'; if (r > idx) r--; } }
      else { if (delta > 0 ? c >= idx : false) c += delta; else if (delta < 0) { if (c === idx) return '#REF!'; if (c > idx) c--; } }
      return (shp || '') + ca + E.colName(c) + ra + (r + 1);
    });
  }
  function shiftStruct(axis, idx, delta) {
    mutate(() => {
      wb.sheets.forEach((s, si) => { Object.values(s.cells).forEach(c => { if (typeof c.v === 'string' && c.v[0] === '=') c.v = adjust(c.v, axis, idx, delta, sh().name, si === wb.cur); }); });
      const cells = sh().cells, out = {};
      Object.keys(cells).forEach(k => { const p = E.parseKey(k); let { c, r } = p; if (axis === 'r') { if (delta < 0 && r === idx) return; if (r >= idx) r += delta > 0 ? delta : 0; if (delta < 0 && p.r > idx) r = p.r - 1; } else { if (delta < 0 && c === idx) return; if (c >= idx) c += delta > 0 ? delta : 0; if (delta < 0 && p.c > idx) c = p.c - 1; } out[E.key(c, r)] = cells[k]; });
      sh().cells = out;
    });
  }
  Object.assign(ACT, { insRow: () => shiftStruct('r', act.r, 1), insCol: () => shiftStruct('c', act.c, 1), delRow: () => shiftStruct('r', act.r, -1), delCol: () => shiftStruct('c', act.c, -1) });

  /* ---------- Feuilles ---------- */
  function renderTabs() {
    $('#tabs').innerHTML = wb.sheets.map((s, i) => '<div class="stab' + (i === wb.cur ? ' on' : '') + '" data-i="' + i + '">' + esc(s.name) + '</div>').join('');
  }
  $('#tabs').addEventListener('click', e => { const t = e.target.closest('.stab'); if (!t) return; stopEdit(true); wb.cur = +t.dataset.i; act = { r: 0, c: 0 }; anchor = act; sel = { r0: 0, c0: 0, r1: 0, c1: 0 }; build(); });
  $('#tabs').addEventListener('dblclick', e => { if (e.target.closest('.stab')) ACT.renameSheet(); });
  ACT.addSheet = () => mutate(() => { let n = wb.sheets.length + 1; while (wb.sheets.some(s => s.name === 'Feuil' + n)) n++; wb.sheets.push(newSheet('Feuil' + n)); wb.cur = wb.sheets.length - 1; build(); }, { tabs: true });
  ACT.renameSheet = async () => { const n = await A.askText('Renommer la feuille', 'Nom', sh().name); if (!n || !n.trim()) return; if (wb.sheets.some((s, i) => i !== wb.cur && s.name.toLowerCase() === n.trim().toLowerCase())) { A.toast('Ce nom existe déjà.', 'err'); return; } mutate(() => { const old = sh().name; wb.sheets.forEach(s => Object.values(s.cells).forEach(c => { if (typeof c.v === 'string' && c.v[0] === '=') c.v = c.v.split(old + '!').join(n.trim() + '!'); })); sh().name = n.trim(); }, { tabs: true }); };
  ACT.delSheet = async () => { if (wb.sheets.length < 2) { A.toast('Un classeur doit contenir au moins une feuille.', 'err'); return; } if (!await A.confirmBox('Supprimer la feuille', 'Supprimer « ' + sh().name + ' » ?', 'Supprimer', true)) return; mutate(() => { wb.sheets.splice(wb.cur, 1); wb.cur = Math.max(0, wb.cur - 1); build(); }, { tabs: true }); };
  ACT.toggleGrid = () => { A.settings.set('xlGrid', !A.settings.get('xlGrid', true)); host.querySelector('table').classList.toggle('nogrid', !A.settings.get('xlGrid', true)); };
  const setZoom = z => { zoom = Math.max(.5, Math.min(2, z)); host.style.zoom = zoom; $('#sb-zoom').textContent = Math.round(zoom * 100) + ' %'; };
  ACT.zoomIn = () => setZoom(zoom + .1); ACT.zoomOut = () => setZoom(zoom - .1); ACT.zoom100 = () => setZoom(1);
  wrap.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); setZoom(zoom + (e.deltaY < 0 ? .1 : -.1)); } }, { passive: false });

  /* ---------- Fichiers ---------- */
  function exportPayload() {
    return { title: wb.title, sheets: wb.sheets.map((s, si) => { calc = new E.Calc(wb); return { name: s.name, colW: s.colW, merges: s.merges || [], freeze: s.freeze, cells: Object.keys(s.cells).filter(k => s.cells[k].v !== '' || s.cells[k].s).map(k => { const c = s.cells[k], isF = typeof c.v === 'string' && c.v[0] === '='; let res = null; if (isF) { const v = calc.value(si, k); res = v instanceof Error ? E.errText(v) : v; } return { k, v: c.v, s: c.s || null, res }; }) }; }) };
  }
  const csvCell = t => /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  function toCSV() { const g = usedRange(); const rows = []; for (let r = 0; r <= g.r; r++) { const row = []; for (let c = 0; c <= g.c; c++) row.push(csvCell(display(calc.value(wb.cur, E.key(c, r)), (cellAt(c, r) || {}).s))); rows.push(row.join(';')); } return '﻿' + rows.join('\r\n'); }
  function usedRange() { let R = 0, C = 0; Object.keys(sh().cells).forEach(k => { const p = E.parseKey(k), x = sh().cells[k]; if (x.v !== '' && x.v != null) { R = Math.max(R, p.r); C = Math.max(C, p.c); } }); return { r: R, c: C }; }
  ACT.exportCsv = async () => {
    const txt = toCSV();
    if (api) { const r = await api.pickSavePath({ defaultName: A.safeName(wb.title) + '.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] }); if (!r || r.canceled) return; const res = await api.writeFile({ path: r.path, payload: { kind: 'text', text: txt.replace(/^﻿/, '') } }); A.toast(res.ok ? 'CSV exporté.' : 'Échec : ' + res.error, res.ok ? 'ok' : 'err'); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv' })); a.download = A.safeName(wb.title) + '.csv'; a.click(); }
  };
  ACT.save = async (e, t, saveAs) => {
    stopEdit(true);
    if (!api) { A.toast('L\'enregistrement .xlsx nécessite l\'application Windows ; une copie est conservée dans la bibliothèque.'); await doSave(); setBadge('saved'); return false; }
    let path = saveAs ? null : wb.path;
    if (!path) { const r = await api.pickSavePath({ defaultName: A.safeName(wb.title) + '.xlsx', filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }] }); if (!r || r.canceled) return false; path = /\.xlsx$/i.test(r.path) ? r.path : r.path + '.xlsx'; }
    const res = await api.xlsxWrite({ path, book: exportPayload() });
    if (!res || !res.ok) { A.toast('Échec de l\'enregistrement : ' + (res && res.error), 'err'); return false; }
    wb.path = path; wb.title = A.baseName(path); $('#doc-title').value = wb.title; document.title = wb.title + ' - Excel Dark'; await doSave(); dirty = false; setBadge('saved'); A.toast('Enregistré : ' + path.replace(/^.*[\\/]/, ''), 'ok'); return true;
  };
  ACT.saveAs = () => ACT.save(null, null, true);
  function load(b) { wb = b; sel = { r0: 0, c0: 0, r1: 0, c1: 0 }; act = { r: 0, c: 0 }; anchor = act; undoStack = []; redoStack = []; ROWS = ROWS0; $('#doc-title').value = wb.title; document.title = wb.title + ' - Excel Dark'; build(); setBadge('saved'); dirty = false; }
  ACT.newBook = async () => { await doSave(); load(newBook()); };
  async function openFile(f) {
    const ext = (f.ext || '').toLowerCase(); let b;
    try {
      if (ext === 'xlsx') { const r = await api.xlsxParse(f.bytes); if (!r.ok) throw new Error(r.error); b = Object.assign(newBook(), { title: A.baseName(f.name), path: f.path || null, sheets: r.sheets.map(s => ({ name: s.name, cells: s.cells, colW: s.colW || {}, rowH: {}, merges: s.merges || [], freeze: s.freeze })), cur: 0 }); }
      else if (ext === 'csv' || ext === 'txt') { const text = typeof f.text === 'string' ? f.text : new TextDecoder().decode(f.bytes); const rows = parseCsv(text); const s = newSheet('Feuil1'); rows.forEach((row, r) => row.forEach((t, c) => { if (c < COLS && t !== '') { const p = parseInput(t); s.cells[E.key(c, r)] = { v: p.v, ...(p.nf ? { s: { nf: p.nf } } : {}) }; } })); b = Object.assign(newBook(), { title: A.baseName(f.name), sheets: [s] }); }
      else throw new Error('format non pris en charge');
    } catch (e) { A.toast('Impossible d\'ouvrir : ' + e.message, 'err'); return; }
    await doSave(); load(b); if (f.path && ext === 'xlsx') wb.path = f.path; A.toast('« ' + wb.title + ' » ouvert.', 'ok');
  }
  function parseCsv(text) { text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n'); const first = text.split('\n')[0]; const d = [';', '\t', ','].map(x => [x, first.split(x).length]).sort((a, b) => b[1] - a[1])[0][0]; const rows = []; let row = [], cur = '', q = false; for (let i = 0; i < text.length; i++) { const ch = text[i]; if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === d) { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch; } if (cur !== '' || row.length) { row.push(cur); rows.push(row); } return rows; }
  ACT.open = async () => { if (!api) { A.toast('Ouvrir des fichiers nécessite l\'application Windows.'); return; } const files = await api.openFiles({ filters: [{ name: 'Classeurs', extensions: ['xlsx', 'csv', 'txt'] }] }); if (files && files[0]) openFile(files[0]); };
  ACT.fileMenu = async () => {
    const recents = (await store.all()).sort((a, b) => b.modified - a.modified).slice(0, 8);
    const body = document.createElement('div');
    body.innerHTML = '<div class="export-list" style="gap:6px;max-width:none">' + [['newBook', 'fa-file', 'Nouveau classeur'], ['open', 'fa-folder-open', 'Ouvrir…'], ['save', 'fa-floppy-disk', 'Enregistrer'], ['saveAs', 'fa-file-export', 'Enregistrer sous…'], ['exportCsv', 'fa-file-csv', 'Exporter en CSV']].map(x => '<button type="button" data-a="' + x[0] + '" style="padding:9px 14px"><i class="fa-solid ' + x[1] + '" style="font-size:16px;width:22px"></i><b>' + x[2] + '</b></button>').join('') + '</div>' +
      (recents.length ? '<p style="margin:14px 0 6px;font-weight:600">Documents récents</p><div class="export-list" style="gap:4px;max-width:none">' + recents.map(r => '<button type="button" data-d="' + esc(r.id) + '" style="padding:6px 14px"><i class="fa-solid fa-table" style="font-size:14px;width:22px;color:#217346"></i>' + esc(r.title) + '</button>').join('') + '</div>' : '');
    const v = await A.dialog({ title: 'Fichier', width: 420, body, buttons: [{ label: 'Fermer', value: null }], onOpen: (b, fin) => { b.querySelectorAll('[data-a]').forEach(x => x.onclick = () => fin({ a: x.dataset.a })); b.querySelectorAll('[data-d]').forEach(x => x.onclick = () => fin({ d: x.dataset.d })); } });
    if (!v) return; if (v.a) ACT[v.a](); else if (v.d) { await doSave(); const rec = await store.get(v.d); if (rec) load(rec); }
  };
  $('#doc-title').addEventListener('change', e => { wb.title = e.target.value.trim() || 'Classeur1'; e.target.value = wb.title; document.title = wb.title + ' - Excel Dark'; dirty = true; autosave(); });
  window.addEventListener('beforeunload', () => { doSave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) doSave(); });
  if (api && api.onBeforeClose) api.onBeforeClose(async () => { if (dirty && !A.settings.get('autosave', true)) { const ok = await A.confirmBox('Excel Dark', 'Enregistrer les modifications de « ' + wb.title + ' » ?', 'Enregistrer'); if (ok) await ACT.save(); } await doSave(); api.confirmClose(true); });
  if (api && api.onOpenFile) api.onOpenFile(f => openFile(f));

  /* ---------- Démarrage ---------- */
  (async function boot() {
    let b = null; if (!(A.settings.get('template', null) || '').startsWith('excel:')) try { const id = A.settings.get('lastXl', null); if (id) b = await store.get(id); } catch (e) { /* ignore */ }
    if (api && api.getStartupFile) { try { const f = await api.getStartupFile('xlsx'); if (f) { await openFile(f); wrap.focus(); return; } } catch (e) { /* ignore */ } }
    const tp = A.settings.get('template', null);
    if (tp && /^excel:/.test(tp) && TPL.excel[tp.slice(6)]) { A.settings.set('template', null); const t = TPL.excel[tp.slice(6)](); load(Object.assign(newBook(), { title: t.title, sheets: t.sheets })); wrap.focus(); return; }
    load(b || newBook()); wrap.focus();
  })();
  window.XL = { get wb() { return wb; }, get sel() { return sel; }, get act() { return act; }, get zoom() { return zoom; }, get ROWS() { return ROWS; }, COLS, sh, cellAt, region, colW, setRaw, mutate, refreshAll, get calc() { return calc; }, display, host, wrap, build, tds: () => tds };
})();
