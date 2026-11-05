'use strict';
/* ===== Excel Dark : fusion, volets figés, hauteur de ligne, impression PDF, tableau croisé ===== */
(function () {
  const { $, esc, ACT } = A, X = window.XL, api = A.api;
  const sh = () => X.sh();
  const nameRef = n => /^[A-Za-zÀ-ÿ_][\wÀ-ÿ]*$/.test(n) ? n : "'" + n + "'";

  /* ---------- Mise en page : cellules fusionnées, volets figés ---------- */
  function layout() {
    const t = X.tds(), merges = sh().merges || [], fr = sh().freeze || { r: 0, c: 0 };
    const hid = sh().hid || {};
    for (let r = 0; r < t.length; r++) for (let c = 0; c < t[r].length; c++) { const td = t[r][c]; td.colSpan = 1; td.rowSpan = 1; td.style.display = ''; td.style.position = ''; td.style.left = ''; td.style.top = ''; td.style.zIndex = ''; }
    merges.forEach(g => {
      for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) if ((r !== g.r0 || c !== g.c0) && t[r] && t[r][c]) t[r][c].style.display = 'none';
      const m = t[g.r0] && t[g.r0][g.c0]; if (m) { m.colSpan = g.c1 - g.c0 + 1; m.rowSpan = g.r1 - g.r0 + 1; m.style.textAlign = m.style.textAlign || 'center'; m.style.verticalAlign = 'middle'; }
    });
    if (fr.r || fr.c) {
      const lefts = [46]; for (let c = 0; c < fr.c; c++) lefts.push(lefts[c] + X.colW(c));
      const tops = [22]; for (let r = 0; r < fr.r; r++) { const tr = t[r][0].parentNode; tops.push(tops[r] + (hid[r] ? 0 : tr.getBoundingClientRect().height / (X.zoom || 1))); }
      for (let r = 0; r < t.length; r++) for (let c = 0; c < t[r].length; c++) {
        if (r >= fr.r && c >= fr.c) continue; const td = t[r][c]; td.style.position = 'sticky';
        if (c < fr.c) td.style.left = lefts[c] + 'px'; if (r < fr.r) td.style.top = tops[r] + 'px'; td.style.zIndex = r < fr.r && c < fr.c ? '2' : '1';
        if (!td.style.backgroundColor) td.style.backgroundColor = getComputedStyle(document.body).getPropertyValue('--grid-bg') || (document.body.classList.contains('look-word') ? '#fff' : '#1b1b1b');
      }
      const th = X.host.querySelectorAll('tbody th.rh'); th.forEach((x, i) => { x.style.zIndex = i < fr.r ? '3' : ''; });
    }
  }
  const prev = XLX.refresh; XLX.refresh = function () { prev(); layout(); };
  XLX.layout = layout;

  ACT.toggleFreeze = () => { const s = sh(); if (s.freeze && (s.freeze.r || s.freeze.c)) { X.mutate(() => { s.freeze = undefined; }); A.toast('Volets libérés.'); } else { const a = X.act; if (!a.r && !a.c) { A.toast('Sélectionnez la cellule située sous et à droite de ce que vous voulez figer.'); return; } X.mutate(() => { s.freeze = { r: a.r, c: a.c }; }); A.toast('Volets figés au-dessus de la ligne ' + (a.r + 1) + ' et à gauche de la colonne ' + E.colName(a.c) + '.', 'ok'); } };
  ACT.freezeTopRow = () => X.mutate(() => { sh().freeze = { r: 1, c: 0 }; });
  ACT.freezeFirstCol = () => X.mutate(() => { sh().freeze = { r: 0, c: 1 }; });

  ACT.toggleMerge = () => {
    const g = X.sel, s = sh(), list = s.merges || [];
    const hit = list.filter(m => !(m.r1 < g.r0 || m.r0 > g.r1 || m.c1 < g.c0 || m.c0 > g.c1));
    if (hit.length) { X.mutate(() => { s.merges = list.filter(m => !hit.includes(m)); }); A.toast('Fusion annulée.'); return; }
    if (g.r0 === g.r1 && g.c0 === g.c1) { A.toast('Sélectionnez au moins deux cellules.'); return; }
    X.mutate(() => { for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) if (r !== g.r0 || c !== g.c0) delete s.cells[E.key(c, r)]; s.merges = list.concat([{ r0: g.r0, c0: g.c0, r1: g.r1, c1: g.c1 }]); });
  };

  /* ---------- Hauteur de ligne à la souris ---------- */
  X.host.addEventListener('mousemove', e => { const th = e.target.closest('tbody th.rh'); if (th && !e.buttons) { const r = th.getBoundingClientRect(); th.style.cursor = e.clientY > r.bottom - 4 ? 'row-resize' : ''; } }, true);
  X.host.addEventListener('mousedown', e => {
    const th = e.target.closest('tbody th.rh'); if (!th || e.button !== 0) return; const r = th.getBoundingClientRect(); if (e.clientY < r.bottom - 4) return;
    e.stopPropagation(); e.preventDefault(); const row = +th.dataset.r, tr = th.parentNode, y0 = e.clientY, h0 = r.height / (X.zoom || 1);
    const mv = ev => { const h = Math.max(14, h0 + (ev.clientY - y0) / (X.zoom || 1)); tr.style.height = h + 'px'; };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); const h = Math.round(parseFloat(tr.style.height) || h0); X.mutate(() => { sh().rowH[row] = h; }); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  }, true);
  X.host.addEventListener('dblclick', e => { const th = e.target.closest('tbody th.rh'); if (!th) return; const r = th.getBoundingClientRect(); if (e.clientY >= r.bottom - 4) X.mutate(() => { delete sh().rowH[+th.dataset.r]; }); }, true);

  /* ---------- Impression / PDF ---------- */
  function used() { let R = 0, C = 0; Object.keys(sh().cells).forEach(k => { const p = E.parseKey(k), x = sh().cells[k]; if (x.v !== '' && x.v != null) { R = Math.max(R, p.r); C = Math.max(C, p.c); } }); return { r: R, c: C }; }
  ACT.exportPdf = async () => {
    if (!api) { A.toast('L\'export PDF nécessite l\'application Windows.'); return; }
    const g = used(); if (!Object.keys(sh().cells).length) { A.toast('La feuille est vide.'); return; }
    const body = document.createElement('div');
    body.innerHTML = '<label class="field">Orientation<select id="pp-o"><option value="landscape">Paysage</option><option value="portrait">Portrait</option></select></label><label class="check"><input type="checkbox" id="pp-g" checked> Imprimer le quadrillage</label><label class="check"><input type="checkbox" id="pp-h"> Imprimer les en-têtes de lignes et de colonnes (A, B, 1, 2…)</label><label class="check"><input type="checkbox" id="pp-t" checked> Répéter la première ligne sur chaque page</label><label class="check"><input type="checkbox" id="pp-f" checked> Titre et numéro de page</label>';
    const o = await A.dialog({ title: 'Imprimer / exporter en PDF', width: 420, body, buttons: [{ label: 'Annuler', value: null }, { label: 'Exporter', primary: true, collect: b => ({ o: b.querySelector('#pp-o').value, g: b.querySelector('#pp-g').checked, h: b.querySelector('#pp-h').checked, t: b.querySelector('#pp-t').checked, f: b.querySelector('#pp-f').checked }) }] });
    if (!o) return;
    const r = await api.pickSavePath({ defaultName: A.safeName(X.wb.title) + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] }); if (!r || r.canceled) return;
    const merged = {}; (sh().merges || []).forEach(m => { merged[m.r0 + ',' + m.c0] = m; for (let rr = m.r0; rr <= m.r1; rr++) for (let cc = m.c0; cc <= m.c1; cc++) if (rr !== m.r0 || cc !== m.c0) merged[rr + ',' + cc] = 'x'; });
    const hid = sh().hid || {}, head = [];
    if (o.h) { head.push('<th class="ph"></th>'); for (let c = 0; c <= g.c; c++) head.push('<th class="ph">' + E.colName(c) + '</th>'); }
    const rowHtml = r2 => { if (hid[r2]) return ''; const tds = []; if (o.h) tds.push('<th class="ph">' + (r2 + 1) + '</th>'); for (let c = 0; c <= g.c; c++) { const m = merged[r2 + ',' + c]; if (m === 'x') continue; const cell = sh().cells[E.key(c, r2)] || {}, s = cell.s || {}, v = X.calc.value(X.wb.cur, E.key(c, r2));
      const st = [s.b ? 'font-weight:700' : '', s.i ? 'font-style:italic' : '', s.u ? 'text-decoration:underline' : '', s.al ? 'text-align:' + s.al : (typeof v === 'number' ? 'text-align:right' : ''), s.color ? 'color:' + s.color : '', s.fill ? 'background:' + s.fill : '', s.bd ? 'border:1px solid #000' : '', s.sz ? 'font-size:' + s.sz + 'pt' : ''].filter(Boolean).join(';');
      tds.push('<td style="' + st + '"' + (m ? ' colspan="' + (m.c1 - m.c0 + 1) + '" rowspan="' + (m.r1 - m.r0 + 1) + '"' : '') + '>' + esc(X.display(v, s)) + '</td>'); } return '<tr' + (sh().rowH[r2] ? ' style="height:' + sh().rowH[r2] + 'px"' : '') + '>' + tds.join('') + '</tr>'; };
    const cols = ['<colgroup>' + (o.h ? '<col style="width:34px">' : '') + Array.from({ length: g.c + 1 }, (_, c) => '<col style="width:' + X.colW(c) + 'px">').join('') + '</colgroup>'];
    const thead = (head.length ? '<tr>' + head.join('') + '</tr>' : '') + (o.t ? rowHtml(0) : '');
    const rows = []; for (let r2 = o.t ? 1 : 0; r2 <= g.r; r2++) rows.push(rowHtml(r2));
    let root = $('#print-root'); if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
    const tw = Array.from({ length: g.c + 1 }, (_, c) => X.colW(c)).reduce((a, b) => a + b, 0) + (o.h ? 34 : 0), pw = o.o === 'landscape' ? 1030 : 700, k = Math.min(1, pw / tw);
    const q = t => String(t).replace(/["\\]/g, ' ').replace(/\n/g, ' ');
    root.innerHTML = '<style>@page{size:A4 ' + o.o + ';margin:12mm 10mm 16mm' + (o.f ? ';@bottom-left{content:"' + q(X.wb.title + ' — ' + sh().name) + '";font-size:9pt;color:#555}@bottom-right{content:"Page " counter(page) " / " counter(pages);font-size:9pt;color:#555}' : '') + '}@media print{#print-root table{zoom:' + k.toFixed(3) + '}}</style>' + '<table class="pt-table' + (o.g ? ' grid' : '') + '">' + cols.join('') + '<thead>' + thead + '</thead><tbody>' + rows.join('') + '</tbody></table>';
    document.body.classList.add('printing'); await new Promise(res => setTimeout(res, 300));
    const res = await api.writePdf({ path: r.path });
    document.body.classList.remove('printing'); root.innerHTML = ''; A.toast(res.ok ? 'PDF exporté.' : 'Échec : ' + res.error, res.ok ? 'ok' : 'err');
  };

  /* ---------- Tableau croisé dynamique ---------- */
  ACT.pivot = async () => {
    const g = X.region(); if (g.r1 - g.r0 < 1 || g.c1 === g.c0) { A.toast('Placez-vous dans un tableau de données avec une ligne d\'en-tête (au moins 2 colonnes).', 'err'); return; }
    const heads = []; for (let c = g.c0; c <= g.c1; c++) heads.push(String(X.calc.value(X.wb.cur, E.key(c, g.r0)) || 'Colonne ' + E.colName(c)));
    const opts = i => heads.map((h, j) => '<option value="' + j + '"' + (j === i ? ' selected' : '') + '>' + esc(h) + '</option>').join('');
    const body = document.createElement('div');
    body.innerHTML = '<label class="field">Lignes (regrouper par)<select id="pv-r">' + opts(0) + '</select></label><label class="field">Colonnes (facultatif)<select id="pv-c"><option value="-1">(aucune)</option>' + opts(-1) + '</select></label><label class="field">Valeurs<select id="pv-v">' + opts(Math.min(1, heads.length - 1)) + '</select></label><label class="field">Calcul<select id="pv-a"><option value="SOMME">Somme</option><option value="NB">Nombre</option><option value="MOYENNE">Moyenne</option></select></label>';
    const o = await A.dialog({ title: 'Tableau croisé dynamique', width: 440, body, buttons: [{ label: 'Annuler', value: null }, { label: 'Créer', primary: true, collect: b => ({ r: +b.querySelector('#pv-r').value, c: +b.querySelector('#pv-c').value, v: +b.querySelector('#pv-v').value, a: b.querySelector('#pv-a').value }) }] });
    if (!o) return; if (o.c === o.r) { A.toast('Choisissez des champs différents pour les lignes et les colonnes.', 'err'); return; }
    const src = nameRef(sh().name), rng = c => src + '!$' + E.colName(g.c0 + c) + '$' + (g.r0 + 2) + ':$' + E.colName(g.c0 + c) + '$' + (g.r1 + 1);
    const uniq = c => { const u = []; for (let r = g.r0 + 1; r <= g.r1; r++) { const v = X.calc.value(X.wb.cur, E.key(g.c0 + c, r)); if (v !== '' && v != null && !u.some(x => x === v)) u.push(v); } return u.sort((x, y) => String(x).localeCompare(String(y), 'fr', { numeric: true })); };
    const rowsV = uniq(o.r), colsV = o.c >= 0 ? uniq(o.c) : [], lit = v => typeof v === 'number' ? String(v) : '"' + String(v).replace(/"/g, '""') + '"';
    const cell = (rv, cv) => { const parts = []; if (rv !== null) parts.push(rng(o.r) + ',' + lit(rv)); if (cv !== null) parts.push(rng(o.c) + ',' + lit(cv)); const crit = parts.join(',');
      if (!parts.length) return '=' + (o.a === 'NB' ? 'NB(' + rng(o.v) + ')' : o.a + '(' + rng(o.v) + ')');
      return '=' + (o.a === 'NB' ? 'NB.SI.ENS(' + crit + ')' : o.a === 'MOYENNE' ? 'SIERREUR(MOYENNE.SI.ENS(' + rng(o.v) + ',' + crit + '),0)' : 'SOMME.SI.ENS(' + rng(o.v) + ',' + crit + ')'); };
    let nm = 'TCD', n = 1; while (X.wb.sheets.some(s => s.name === nm)) nm = 'TCD' + (++n);
    X.mutate(() => {
      const ns = { name: nm, cells: {}, colW: { 0: 190 }, rowH: {} }, put = (c, r, v, st) => { ns.cells[E.key(c, r)] = st ? { v, s: st } : { v }; }, bold = { b: true, fill: '#dbe7f5' }, nf = o.a === 'MOYENNE' ? { nf: '0.00' } : undefined, tot = Object.assign({ b: true }, nf);
      const lab = { SOMME: 'Somme', NB: 'Nombre', MOYENNE: 'Moyenne' }[o.a] + ' de ' + heads[o.v];
      if (o.c >= 0) {
        put(0, 0, lab, bold); put(1, 0, 'Colonnes : ' + heads[o.c], bold); put(0, 1, 'Lignes : ' + heads[o.r], bold);
        colsV.forEach((cv, j) => put(1 + j, 1, cv, bold)); put(1 + colsV.length, 1, 'Total général', bold);
        rowsV.forEach((rv, i) => { put(0, 2 + i, rv); colsV.forEach((cv, j) => put(1 + j, 2 + i, cell(rv, cv), nf)); put(1 + colsV.length, 2 + i, cell(rv, null), tot); });
        put(0, 2 + rowsV.length, 'Total général', bold); colsV.forEach((cv, j) => put(1 + j, 2 + rowsV.length, cell(null, cv), tot)); put(1 + colsV.length, 2 + rowsV.length, cell(null, null), tot);
      } else {
        put(0, 0, 'Lignes : ' + heads[o.r], bold); put(1, 0, lab, bold);
        rowsV.forEach((rv, i) => { put(0, 1 + i, rv); put(1, 1 + i, cell(rv, null), nf); });
        put(0, 1 + rowsV.length, 'Total général', bold); put(1, 1 + rowsV.length, cell(null, null), tot);
      }
      X.wb.sheets.push(ns); X.wb.cur = X.wb.sheets.length - 1; X.build();
    }, { tabs: true });
    A.toast('Tableau croisé créé dans la feuille « ' + nm + ' » : les valeurs se mettent à jour avec les données (recréez-le si de nouvelles étiquettes apparaissent).', 'ok');
  };
  layout();
})();
