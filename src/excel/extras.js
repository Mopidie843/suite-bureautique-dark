'use strict';
/* ===== Nocte Excel : graphiques, filtres, mise en forme conditionnelle ===== */
(function () {
  const { $, esc, ACT } = A, X = window.XL, wrap = X.wrap;
  const PAL = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#264478', '#9e480e'];
  const NS = 'http://www.w3.org/2000/svg';
  const nfmt = n => (Math.abs(n) >= 1e6 ? (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M' : Math.abs(n) >= 1e4 ? (n / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' k' : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }));
  const sh = () => X.sh();
  const valAt = (c, r) => X.calc.value(X.wb.cur, E.key(c, r));
  const selRect = () => { const s = X.sel; return { r0: s.r0, c0: s.c0, r1: s.r1, c1: s.c1 }; };

  /* ---------- Données d'un graphique ---------- */
  function chartData(ch) {
    const g = ch.range, rows = [];
    for (let r = g.r0; r <= g.r1; r++) { const row = []; for (let c = g.c0; c <= g.c1; c++) row.push(valAt(c, r)); rows.push(row); }
    if (!rows.length) return null;
    const isNum = v => typeof v === 'number', isTxt = v => typeof v === 'string' && v !== '';
    const hasHead = rows.length > 1 && rows[0].slice(1).some(isTxt) && rows.slice(1).some(r => r.slice(1).some(isNum));
    const hasCat = rows.length > 0 && rows.slice(hasHead ? 1 : 0).every(r => isTxt(r[0]) || r[0] === '' || (!isNum(r[0]) )) && g.c1 > g.c0;
    const body = rows.slice(hasHead ? 1 : 0), c0 = hasCat ? 1 : 0;
    const cats = body.map((r, i) => hasCat ? String(r[0] === '' ? '' : r[0]) : String(i + 1));
    const series = [];
    for (let j = c0; j < rows[0].length; j++) series.push({ name: hasHead ? String(rows[0][j] || 'Série ' + (series.length + 1)) : 'Série ' + (series.length + 1), v: body.map(r => isNum(r[j]) ? r[j] : 0) });
    return { cats, series };
  }

  /* ---------- Rendu SVG ---------- */
  function ticks(min, max) {
    if (min === max) { max = min + 1; }
    const span = max - min, raw = span / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, t = [];
    for (let v = lo; v <= hi + step / 2; v += step) t.push(Math.round(v / step) * step);
    return t;
  }
  function render(ch) {
    const W = ch.w, H = ch.h, d = chartData(ch), out = [];
    out.push('<svg xmlns="' + NS + '" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="Calibri,Segoe UI,Arial,sans-serif" font-size="11">');
    out.push('<text x="' + W / 2 + '" y="20" text-anchor="middle" font-size="15" fill="#333">' + esc(ch.title || '') + '</text>');
    if (!d || !d.series.length) { out.push('<text x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle" fill="#888">Aucune donnée numérique</text></svg>'); return out.join(''); }
    const legendH = d.series.length > 1 || ch.type === 'pie' ? 22 : 0, top = 34, bot = H - 26 - legendH, left = 50, right = W - 14;
    const legend = () => {
      const items = ch.type === 'pie' ? d.cats.map((c, i) => [c, PAL[i % PAL.length]]) : d.series.map((s, i) => [s.name, PAL[i % PAL.length]]); let x = 12;
      items.forEach(it => { out.push('<rect x="' + x + '" y="' + (H - 18) + '" width="10" height="10" fill="' + it[1] + '"/><text x="' + (x + 14) + '" y="' + (H - 9) + '" fill="#444">' + esc(it[0].slice(0, 14)) + '</text>'); x += 26 + Math.min(it[0].length, 14) * 6; });
    };
    if (ch.type === 'pie') {
      const s = d.series[0], tot = s.v.reduce((a, b) => a + Math.max(0, b), 0) || 1, cx = W / 2, cy = (top + bot) / 2 + 4, R = Math.max(20, Math.min(W / 2 - 20, (bot - top) / 2 - 4));
      let a0 = -Math.PI / 2;
      s.v.forEach((v, i) => {
        v = Math.max(0, v); if (!v) return; const a1 = a0 + v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0;
        if (v / tot > .9999) out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="' + PAL[i % PAL.length] + '"/>');
        else out.push('<path d="M' + cx + ',' + cy + ' L' + (cx + R * Math.cos(a0)) + ',' + (cy + R * Math.sin(a0)) + ' A' + R + ',' + R + ' 0 ' + big + ' 1 ' + (cx + R * Math.cos(a1)) + ',' + (cy + R * Math.sin(a1)) + ' Z" fill="' + PAL[i % PAL.length] + '" stroke="#fff" stroke-width="1.5"/>');
        if (v / tot > .05) { const am = (a0 + a1) / 2; out.push('<text x="' + (cx + R * .65 * Math.cos(am)) + '" y="' + (cy + R * .65 * Math.sin(am) + 4) + '" text-anchor="middle" fill="#fff" font-weight="700">' + Math.round(v / tot * 100) + ' %</text>'); }
        a0 = a1;
      });
      legend(); out.push('</svg>'); return out.join('');
    }
    let min = 0, max = 0; d.series.forEach(s => s.v.forEach(v => { min = Math.min(min, v); max = Math.max(max, v); }));
    const tk = ticks(min, max), lo = tk[0], hi = tk[tk.length - 1], Y = v => bot - (v - lo) / (hi - lo || 1) * (bot - top), n = d.cats.length, bw = (right - left) / Math.max(1, n);
    tk.forEach(t => out.push('<line x1="' + left + '" x2="' + right + '" y1="' + Y(t) + '" y2="' + Y(t) + '" stroke="#e0e0e0"/><text x="' + (left - 6) + '" y="' + (Y(t) + 4) + '" text-anchor="end" fill="#666">' + nfmt(t) + '</text>'));
    out.push('<line x1="' + left + '" x2="' + right + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#999"/>');
    const skip = Math.ceil(n / Math.max(1, Math.floor((right - left) / 56)));
    d.cats.forEach((c, i) => { if (i % skip === 0) out.push('<text x="' + (left + bw * (i + .5)) + '" y="' + (bot + 15) + '" text-anchor="middle" fill="#555">' + esc(c.slice(0, 10)) + '</text>'); });
    if (ch.type === 'bar') {
      const k = d.series.length, gw = bw * .72, w1 = gw / k;
      d.series.forEach((s, j) => s.v.forEach((v, i) => { const x = left + bw * i + (bw - gw) / 2 + j * w1, y = Y(Math.max(v, 0)), h = Math.abs(Y(v) - Y(0)); out.push('<rect x="' + x + '" y="' + y + '" width="' + Math.max(1, w1 - 1) + '" height="' + Math.max(0, h) + '" fill="' + PAL[j % PAL.length] + '"><title>' + esc(s.name + ' · ' + d.cats[i] + ' : ' + nfmt(v)) + '</title></rect>'); }));
    } else {
      d.series.forEach((s, j) => {
        const pts = s.v.map((v, i) => [left + bw * (i + .5), Y(v)]), col = PAL[j % PAL.length];
        if (ch.type === 'area') out.push('<polygon points="' + pts.map(p => p.join(',')).concat([pts[pts.length - 1][0] + ',' + Y(0), pts[0][0] + ',' + Y(0)]).join(' ') + '" fill="' + col + '" fill-opacity=".35"/>');
        out.push('<polyline fill="none" stroke="' + col + '" stroke-width="2.2" points="' + pts.map(p => p.join(',')).join(' ') + '"/>');
        pts.forEach((p, i) => out.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.2" fill="' + col + '"><title>' + esc(s.name + ' · ' + d.cats[i] + ' : ' + nfmt(s.v[i])) + '</title></circle>'));
      });
    }
    if (legendH) legend();
    out.push('</svg>'); return out.join('');
  }

  /* ---------- Calque des graphiques ---------- */
  const layer = document.createElement('div'); layer.id = 'chart-layer'; wrap.appendChild(layer);
  let selChart = null;
  function drawCharts() {
    const list = sh().charts || [], cur = new Set(list.map(c => c.id)); layer.style.zoom = X.zoom;
    Array.from(layer.children).forEach(el => { if (!cur.has(el.dataset.id)) el.remove(); });
    list.forEach(ch => {
      let el = layer.querySelector('[data-id="' + ch.id + '"]');
      if (!el) { el = document.createElement('div'); el.className = 'chart'; el.dataset.id = ch.id; el.innerHTML = '<div class="cv"></div><button class="cx" title="Supprimer le graphique">×</button><button class="cc" title="Changer le type">⇄</button><span class="rz"></span>'; layer.appendChild(el); }
      el.style.left = ch.x + 'px'; el.style.top = ch.y + 'px'; el.style.width = ch.w + 'px'; el.style.height = ch.h + 'px';
      el.classList.toggle('on', selChart === ch.id); el.querySelector('.cv').innerHTML = render(ch);
    });
  }
  const findCh = id => (sh().charts || []).find(c => c.id === id);
  layer.addEventListener('mousedown', e => {
    const el = e.target.closest('.chart'); if (!el) return; e.stopPropagation(); e.preventDefault();
    const id = el.dataset.id, ch = findCh(id); if (!ch) return;
    if (e.target.closest('.cx')) { X.mutate(() => { sh().charts = sh().charts.filter(c => c.id !== id); }); selChart = null; return; }
    if (e.target.closest('.cc')) { const o = ['bar', 'line', 'area', 'pie']; X.mutate(() => { ch.type = o[(o.indexOf(ch.type) + 1) % o.length]; }); return; }
    selChart = id; Array.from(layer.children).forEach(x => x.classList.toggle('on', x === el)); wrap.focus({ preventScroll: true });
    const resize = !!e.target.closest('.rz'), x0 = e.clientX, y0 = e.clientY, ox = ch.x, oy = ch.y, ow = ch.w, oh = ch.h; let moved = false, nx = ox, ny = oy, nw = ow, nh = oh; const z = X.zoom;
    const mv = ev => {
      moved = true; const dx = (ev.clientX - x0) / z, dy = (ev.clientY - y0) / z;
      if (resize) { nw = Math.max(200, ow + dx); nh = Math.max(140, oh + dy); el.style.width = nw + 'px'; el.style.height = nh + 'px'; }
      else { nx = Math.max(0, ox + dx); ny = Math.max(0, oy + dy); el.style.left = nx + 'px'; el.style.top = ny + 'px'; }
    };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); if (moved) X.mutate(() => { ch.x = Math.round(nx); ch.y = Math.round(ny); ch.w = Math.round(nw); ch.h = Math.round(nh); }); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
  X.host.addEventListener('mousedown', () => { if (selChart) { selChart = null; layer.querySelectorAll('.chart.on').forEach(x => x.classList.remove('on')); } }, true);
  layer.addEventListener('dblclick', async e => { const el = e.target.closest('.chart'); if (!el) return; const ch = findCh(el.dataset.id); const t = await A.askText('Titre du graphique', 'Titre', ch.title); if (t != null) X.mutate(() => { ch.title = t; }); });
  document.addEventListener('keydown', e => {
    if (!selChart || e.target.matches('input,textarea,select') || $('#modal-backdrop')) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); const id = selChart; selChart = null; X.mutate(() => { sh().charts = (sh().charts || []).filter(c => c.id !== id); }); }
  }, true);

  async function insertChart(type) {
    const g = selRect(), single = g.r0 === g.r1 && g.c0 === g.c1, rg = single ? X.region() : g;
    if (rg.r1 === rg.r0 && rg.c1 === rg.c0) { A.toast('Sélectionnez d\'abord des données (étiquettes + valeurs).', 'err'); return; }
    const title = await A.askText('Nouveau graphique', 'Titre du graphique', ''); if (title === null) return;
    const n = (sh().charts || []).length;
    X.mutate(() => { (sh().charts = sh().charts || []).push({ id: A.uid(), type, title, range: { r0: rg.r0, c0: rg.c0, r1: rg.r1, c1: rg.c1 }, x: 60 + n * 24, y: 40 + n * 24, w: 460, h: 300 }); });
    A.toast('Graphique ajouté — glissez-le, redimensionnez-le, double-clic pour le titre.', 'ok');
  }
  Object.assign(ACT, { chartBar: () => insertChart('bar'), chartLine: () => insertChart('line'), chartPie: () => insertChart('pie'), chartArea: () => insertChart('area') });

  /* ---------- Filtre ---------- */
  function applyFilter() {
    const f = sh().flt, hid = {}; if (f) { for (let r = f.r0 + 1; r <= f.r1; r++) for (const col of Object.keys(f.crit)) { const v = X.display(valAt(+col, r), (X.cellAt(+col, r) || {}).s); if (!f.crit[col].includes(v)) { hid[r] = true; break; } } }
    sh().hid = hid;
  }
  function paintRows() {
    const hid = sh().hid || {}, f = sh().flt, t = X.tds();
    for (let r = 0; r < t.length; r++) { const tr = t[r][0] && t[r][0].parentNode; if (tr) tr.style.display = hid[r] ? 'none' : ''; }
    X.host.querySelectorAll('thead th').forEach(th => th.classList.toggle('filtered', !!(f && th.dataset.c != null && f.crit[th.dataset.c])));
    $('#sb-msg').textContent = f && Object.keys(f.crit).length ? Object.keys(hid).length + ' ligne(s) masquée(s) par le filtre' : 'Prêt';
  }
  ACT.filterCol = async () => {
    let f = sh().flt; const col = X.act.c;
    if (!f) { const g = X.region(); if (g.r1 <= g.r0) { A.toast('Placez-vous dans un tableau de données (avec une ligne d\'en-tête).', 'err'); return; } f = { r0: g.r0, r1: g.r1, crit: {} }; }
    const vals = []; for (let r = f.r0 + 1; r <= f.r1; r++) { const v = X.display(valAt(col, r), (X.cellAt(col, r) || {}).s); if (!vals.includes(v)) vals.push(v); }
    vals.sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    const allowed = f.crit[col] || vals;
    const body = document.createElement('div');
    body.innerHTML = '<p style="margin:0 0 8px">Colonne <b>' + E.colName(col) + '</b> — « ' + esc(String(X.display(valAt(col, f.r0)))) + ' »</p><div style="max-height:280px;overflow:auto;border:1px solid var(--line);padding:6px">' +
      '<label style="display:block;font-weight:700"><input type="checkbox" id="fl-all" checked> (Tout sélectionner)</label>' + vals.map((v, i) => '<label style="display:block"><input type="checkbox" class="fl" data-i="' + i + '"' + (allowed.includes(v) ? ' checked' : '') + '> ' + (v === '' ? '(Vides)' : esc(v)) + '</label>').join('') + '</div>';
    const all = body.querySelector('#fl-all'); all.onchange = () => body.querySelectorAll('.fl').forEach(x => x.checked = all.checked);
    const res = await A.dialog({ title: 'Filtrer', width: 380, body, buttons: [{ label: 'Annuler', value: null }, { label: 'Appliquer', primary: true, collect: b => Array.from(b.querySelectorAll('.fl')).filter(x => x.checked).map(x => vals[+x.dataset.i]) }] });
    if (!res) return;
    X.mutate(() => { const nf = JSON.parse(JSON.stringify(f)); if (res.length === vals.length) delete nf.crit[col]; else nf.crit[col] = res; sh().flt = Object.keys(nf.crit).length ? nf : undefined; applyFilter(); });
  };
  ACT.filterClear = () => { if (!sh().flt) return; X.mutate(() => { sh().flt = undefined; sh().hid = {}; }); };

  /* ---------- Mise en forme conditionnelle ---------- */
  const CK = new WeakMap();
  function cache(rule) {
    const old = CK.get(rule); if (old && old.calc === X.calc) return old.k; const k = { nums: [], seen: {} };
    for (let r = rule.r0; r <= rule.r1; r++) for (let c = rule.c0; c <= rule.c1; c++) { const v = valAt(c, r); if (typeof v === 'number') k.nums.push(v); if (v !== '' && v != null) { const s = String(v); k.seen[s] = (k.seen[s] || 0) + 1; } }
    k.min = Math.min(...k.nums, 0); k.max = Math.max(...k.nums, 1); CK.set(rule, { calc: X.calc, k }); return k;
  }
  function cf(c, r, v, td) {
    const rules = sh().cf; if (!rules || !rules.length) return;
    for (const q of rules) {
      if (c < q.c0 || c > q.c1 || r < q.r0 || r > q.r1) continue;
      let hit = false; const num = typeof v === 'number', a = parseFloat(String(q.a).replace(',', '.')), b = parseFloat(String(q.b).replace(',', '.'));
      switch (q.op) {
        case 'gt': hit = num && v > a; break; case 'lt': hit = num && v < a; break; case 'eq': hit = num ? v === a : String(v).toLowerCase() === String(q.a).toLowerCase(); break;
        case 'between': hit = num && v >= Math.min(a, b) && v <= Math.max(a, b); break;
        case 'text': hit = typeof v === 'string' && v.toLowerCase().includes(String(q.a).toLowerCase()) && q.a !== ''; break;
        case 'dup': hit = v !== '' && v != null && cache(q).seen[String(v)] > 1; break;
        case 'bar': if (num) { const k = cache(q), p = Math.max(0, Math.min(1, (v - Math.min(0, k.min)) / ((k.max - Math.min(0, k.min)) || 1))); td.style.backgroundImage = 'linear-gradient(90deg,' + q.fill + ' ' + p * 100 + '%,transparent ' + p * 100 + '%)'; td.style.backgroundColor = ''; } continue;
        case 'scale': if (num) { const k = cache(q), p = (v - k.min) / ((k.max - k.min) || 1), mix = (x, y) => Math.round(x + (y - x) * p), h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A1 = h(q.fill), B1 = h(q.color); td.style.backgroundColor = 'rgb(' + [0, 1, 2].map(i => mix(A1[i], B1[i])).join(',') + ')'; } continue;
      }
      if (hit) { if (q.fill) td.style.backgroundColor = q.fill; if (q.color) td.style.color = q.color; }
    }
  }
  ACT.cfAdd = async () => {
    const g = selRect(); if (g.r0 === g.r1 && g.c0 === g.c1) { A.toast('Sélectionnez d\'abord la plage de cellules.', 'err'); return; }
    const body = document.createElement('div');
    body.innerHTML = '<label class="field">Condition<select id="cf-op"><option value="gt">Supérieur à</option><option value="lt">Inférieur à</option><option value="eq">Égal à</option><option value="between">Entre</option><option value="text">Texte contenant</option><option value="dup">Valeurs en double</option><option value="bar">Barres de données</option><option value="scale">Dégradé de couleurs (min → max)</option></select></label>' +
      '<div style="display:flex;gap:8px"><label class="field" style="flex:1">Valeur<input id="cf-a" type="text"></label><label class="field" style="flex:1" id="cf-bl">et<input id="cf-b" type="text"></label></div>' +
      '<div style="display:flex;gap:14px;margin-top:8px;align-items:center"><label>Remplissage / début&nbsp;<input type="color" id="cf-f" value="#ffc7ce"></label><label>Texte / fin&nbsp;<input type="color" id="cf-c" value="#9c0006"></label></div>';
    const op = body.querySelector('#cf-op'), upd = () => { body.querySelector('#cf-a').parentNode.style.display = ['dup', 'bar', 'scale'].includes(op.value) ? 'none' : ''; body.querySelector('#cf-bl').style.display = op.value === 'between' ? '' : 'none'; if (op.value === 'bar') body.querySelector('#cf-f').value = '#8fbfe8'; if (op.value === 'scale') { body.querySelector('#cf-f').value = '#ffffff'; body.querySelector('#cf-c').value = '#63be7b'; } };
    op.onchange = upd; upd();
    const r = await A.dialog({ title: 'Mise en forme conditionnelle', width: 420, body, buttons: [{ label: 'Annuler', value: null }, { label: 'Appliquer', primary: true, collect: b => ({ op: op.value, a: b.querySelector('#cf-a').value, b: b.querySelector('#cf-b').value, fill: b.querySelector('#cf-f').value, color: b.querySelector('#cf-c').value }) }] });
    if (!r) return; X.mutate(() => { (sh().cf = sh().cf || []).push(Object.assign({ r0: g.r0, c0: g.c0, r1: g.r1, c1: g.c1 }, r)); });
    A.toast('Règle appliquée.', 'ok');
  };
  ACT.cfClear = () => {
    const g = selRect(); const keep = (sh().cf || []).filter(q => q.c1 < g.c0 || q.c0 > g.c1 || q.r1 < g.r0 || q.r0 > g.r1);
    if (keep.length === (sh().cf || []).length) { A.toast('Aucune règle sur la sélection.'); return; }
    X.mutate(() => { sh().cf = keep; }); A.toast('Règles effacées.', 'ok');
  };

  window.XLX = { cf, refresh() { if (sh().flt) applyFilter(); paintRows(); drawCharts(); } };
  XLX.refresh();
})();
