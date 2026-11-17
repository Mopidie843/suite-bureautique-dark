'use strict';
/* ===== Nocte PowerPoint 3.11 : formes, graphiques, liens, Format, trieur, rechercher, pied de page ===== */
(function () {
  const { $, $$, esc, ACT } = A, H = PP.h, X = PPX, toast = A.toast, stage = $('#stage');
  const D = () => PP.deck, curSlide = () => D().slides[H.cur];
  const need = () => { const o = H.selObj(); if (!o) toast('Sélectionnez d\'abord un objet.'); return o; };
  const one = patch => { const o = need(); if (o) PP.mutate(() => Object.assign(o, patch)); };

  /* ---------- Formes ---------- */
  $('#sel-shape').insertAdjacentHTML('beforeend', X.KINDS.map(k => '<option value="' + k.k + '">' + k.n + '</option>').join(''));
  $('#sel-shape').addEventListener('change', e => {
    const k = e.target.value; e.target.value = ''; if (!k) return;
    const th = H.themeOf(), line = k === 'line';
    H.add({ id: A.uid(), type: 'poly', kind: k, x: line ? 300 : 380, y: line ? 260 : 190, w: line ? 300 : 200, h: line ? 20 : 140, fill: line ? '' : th.accent, line: line ? '#e8833a' : '#1f3a5f', lw: line ? 4 : 2, text: '', fs: 24, color: '#ffffff', al: 'center' });
  });

  /* ---------- Date, pied de page ---------- */
  const today = () => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  ACT.addDate = () => H.add(H.text(300, 200, 360, 60, today(), { fs: 28 }));
  ACT.footer = async () => {
    const m = (D().master && D().master.objs) || [], f = m.find(o => o.ft === 'foot');
    const v = await A.dialog({ title: 'En-tête et pied de page', width: 400, body: '<label class="field">Pied de page<input type="text" id="ft-t" value="' + esc(f ? f.text : '') + '" placeholder="Ex. : Nom de la société"></label><label class="field" style="flex-direction:row;gap:8px"><input type="checkbox" id="ft-n"' + (m.some(o => o.ft === 'num') ? ' checked' : '') + '> Numéro de diapositive</label><label class="field" style="flex-direction:row;gap:8px"><input type="checkbox" id="ft-d"' + (m.some(o => o.ft === 'date') ? ' checked' : '') + '> Date du jour</label>', buttons: [{ label: 'Annuler', value: null }, { label: 'Appliquer à toutes', primary: true, collect: b => ({ t: b.querySelector('#ft-t').value.trim(), n: b.querySelector('#ft-n').checked, d: b.querySelector('#ft-d').checked }) }] });
    if (!v) return; const th = H.themeOf(), mk = (x, y, w, t, al, ft) => Object.assign(H.text(x, y, w, 30, t, { fs: 14, al, color: th.text, ft }), { op: .75 });
    PP.mutate(() => { const d = D(); d.master = d.master || { objs: [] }; d.master.objs = d.master.objs.filter(o => !o.ft); if (v.t) d.master.objs.push(mk(60, 498, 500, v.t, 'left', 'foot')); if (v.d) d.master.objs.push(mk(560, 498, 240, today(), 'right', 'date')); if (v.n) d.master.objs.push(mk(810, 498, 90, '{n}', 'right', 'num')); });
    toast('Pied de page appliqué à toutes les diapositives.');
  };

  /* ---------- Graphiques ---------- */
  const CT = [['bar', 'Histogramme'], ['line', 'Courbe'], ['pie', 'Secteurs'], ['area', 'Aire'], ['doughnut', 'Anneau']];
  function addChart(ctype) {
    const smp = JSON.parse(JSON.stringify(X.SAMPLE)); if (ctype === 'pie' || ctype === 'doughnut') smp.series = smp.series.slice(0, 1);
    H.add({ id: A.uid(), type: 'chart', ctype, x: 140, y: 130, w: 680, h: 340, title: 'Titre du graphique', labels: smp.labels, series: smp.series, fs: 14 });
    toast('Double-clic sur le graphique pour modifier les données.');
  }
  Object.assign(ACT, { chartBar: () => addChart('bar'), chartLine: () => addChart('line'), chartPie: () => addChart('pie'), chartArea: () => addChart('area'), chartDonut: () => addChart('doughnut') });
  async function chartDialog(o) {
    const v = await A.dialog({
      title: 'Données du graphique', width: 540,
      body: '<label class="field">Titre<input type="text" id="ch-t"></label><label class="field">Type<select id="ch-k">' + CT.map(c => '<option value="' + c[0] + '">' + c[1] + '</option>').join('') + '</select></label><label class="field">Données — 1re ligne : noms des séries ; ensuite « catégorie ; valeur ; valeur… » (Secteurs et Anneau : 1re série seulement)<textarea id="ch-d" rows="9" spellcheck="false" style="width:100%;font-family:Consolas,monospace;font-size:13px"></textarea></label>',
      onOpen: b => { b.querySelector('#ch-t').value = o.title || ''; b.querySelector('#ch-k').value = o.ctype; b.querySelector('#ch-d').value = X.toCsv(o); },
      buttons: [{ label: 'Annuler', value: null }, { label: 'OK', primary: true, collect: b => { const d = X.fromCsv(b.querySelector('#ch-d').value); if (!d) { toast('Données invalides : il faut au moins une série et une catégorie.', 'err'); return false; } return { title: b.querySelector('#ch-t').value, ctype: b.querySelector('#ch-k').value, d }; } }]
    });
    if (v) PP.mutate(() => Object.assign(o, { title: v.title, ctype: v.ctype, labels: v.d.labels, series: v.d.series }));
  }
  ACT.chartEdit = () => { const o = H.selObj(); if (!o || o.type !== 'chart') { toast('Sélectionnez d\'abord un graphique.'); return; } chartDialog(o); };
  stage.addEventListener('dblclick', e => { const d = e.target.closest('.pobj.chart'); if (!d) return; const o = H.find(d.dataset.id); if (o) chartDialog(o); });

  /* ---------- Liens ---------- */
  const fixUrl = u => { u = String(u || '').trim(); if (!u) return ''; if (/^(https?:|mailto:)/i.test(u)) return u; if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return 'mailto:' + u; return 'https://' + u; };
  const openUrl = u => { if (!/^(https?:|mailto:)/i.test(u)) return; if (A.api && A.api.openExternal) A.api.openExternal(u); else window.open(u, '_blank'); };
  ACT.linkSet = async () => { const o = need(); if (!o) return; const u = await A.askText('Lien hypertexte', 'Adresse (https://… ou courriel)', o.link || 'https://'); if (u == null) return; const f = fixUrl(u === 'https://' ? '' : u); PP.mutate(() => { if (f) o.link = f; else delete o.link; }); toast(f ? 'Lien ajouté (visible en diaporama, Ctrl+clic ici).' : 'Lien retiré.'); };
  ACT.linkDel = () => { const o = need(); if (!o) return; if (!o.link) { toast('Cet objet n\'a pas de lien.'); return; } PP.mutate(() => { delete o.link; }); toast('Lien retiré.'); };
  stage.addEventListener('click', e => { if (!e.ctrlKey) return; const d = e.target.closest('[data-link]'); if (d) openUrl(d.dataset.link); });
  $('#present').addEventListener('click', e => { const d = e.target.closest('[data-link]'); if (d) { e.stopImmediatePropagation(); openUrl(d.dataset.link); } }, true);

  /* ---------- Format : taille, contour, effets, texte ---------- */
  const F = { x: $('#f-x'), y: $('#f-y'), w: $('#f-w'), h: $('#f-h'), rot: $('#f-rot') };
  [['x', 'x'], ['y', 'y'], ['w', 'w'], ['h', 'h'], ['rot', 'rot']].forEach(([id, k]) => F[id].addEventListener('change', () => { let v = parseFloat(F[id].value); if (isNaN(v)) return; if (k === 'w' || k === 'h') v = Math.max(10, v); if (k === 'rot') v = ((v % 360) + 360) % 360; one({ [k]: Math.round(v) }); }));
  const selApply = (id, k, num) => $(id).addEventListener('change', e => H.edit({ [k]: num ? +e.target.value : e.target.value }));
  selApply('#sel-lw', 'lw', 1); selApply('#sel-dash', 'dash'); selApply('#sel-op', 'op', 1); selApply('#sel-cr', 'cr', 1); selApply('#sel-ls', 'ls', 1); selApply('#sel-va', 'va');
  const flip = k => { const os = H.selObjs(); if (!os.length) { toast('Sélectionnez d\'abord un objet.'); return; } PP.mutate(() => os.forEach(o => { o[k] = !o[k]; })); };
  ACT.flipH = () => flip('flipH'); ACT.flipV = () => flip('flipV');
  ACT.fsUp = () => { const os = H.selObjs().filter(o => o.type !== 'image'); if (!os.length) { toast('Sélectionnez d\'abord un texte.'); return; } PP.mutate(() => os.forEach(o => { o.fs = Math.min(200, (o.fs || 18) + 2); })); };
  ACT.fsDown = () => { const os = H.selObjs().filter(o => o.type !== 'image'); if (!os.length) { toast('Sélectionnez d\'abord un texte.'); return; } PP.mutate(() => os.forEach(o => { o.fs = Math.max(6, (o.fs || 18) - 2); })); };
  function listify(kind) {
    const os = H.selObjs().filter(o => (o.type === 'text' || o.type === 'rect' || o.type === 'poly' || o.type === 'ellipse') && (o.text || '').trim()); if (!os.length) { toast('Sélectionnez une zone de texte.'); return; }
    const rxB = /^\s*[•\-•]\s+/, rxN = /^\s*\d+[.)]\s+/;
    PP.mutate(() => os.forEach(o => {
      const ls = o.text.split('\n'), real = ls.filter(l => l.trim()), on = real.every(l => (kind === 'b' ? rxB : rxN).test(l)); let n = 0;
      o.text = ls.map(l => { if (!l.trim()) return l; const bare = l.replace(rxB, '').replace(rxN, ''); return on ? bare : (kind === 'b' ? '• ' : (++n) + '. ') + bare; }).join('\n');
    }));
  }
  ACT.bullets = () => listify('b'); ACT.numbers = () => listify('n');

  /* ---------- Organiser ---------- */
  ACT.dupObj = () => { if (!H.selObjs().length) { toast('Sélectionnez d\'abord un objet.'); return; } ACT.copy(); ACT.paste(); };
  const step = d => { const o = need(); if (!o) return; const a = H.sl().objs, i = a.indexOf(o), j = i + d; if (j < 0 || j >= a.length) return; PP.mutate(() => { a.splice(i, 1); a.splice(j, 0, o); }); };
  ACT.forward = () => step(1); ACT.backward = () => step(-1);
  function dist(axis) {
    const os = H.selObjs(); if (os.length < 3) { toast('Sélectionnez au moins 3 objets.'); return; }
    const p = axis === 'x' ? 'x' : 'y', sz = axis === 'x' ? 'w' : 'h', s = os.slice().sort((a, b) => a[p] - b[p]), first = s[0], last = s[s.length - 1], total = (last[p] + last[sz]) - first[p], used = s.reduce((t, o) => t + o[sz], 0), gap = (total - used) / (s.length - 1);
    PP.mutate(() => { let c = first[p]; s.forEach(o => { o[p] = Math.round(c); c += o[sz] + gap; }); });
  }
  ACT.distH = () => dist('x'); ACT.distV = () => dist('y');
  let painter = null; const PK = ['fill', 'line', 'lw', 'dash', 'color', 'fs', 'ff', 'b', 'i', 'u', 'al', 'shadow', 'grad', 'op', 'cr', 'ls', 'va'];
  ACT.fmtPaint = () => { const o = need(); if (!o) return; painter = {}; PK.forEach(k => { if (o[k] !== undefined) painter[k] = o[k]; }); document.body.classList.add('painting'); toast('Cliquez sur l\'objet à mettre en forme (clic dans le vide pour annuler).'); };
  stage.addEventListener('mousedown', e => {
    if (!painter) return; const d = e.target.closest('.pobj'), p = painter; painter = null; document.body.classList.remove('painting');
    e.stopPropagation(); e.preventDefault(); if (!d || !d.dataset.id) return; const o = H.find(d.dataset.id); if (!o) return;
    PP.mutate(() => { PK.forEach(k => { if (k in p) o[k] = p[k]; else delete o[k]; }); }); toast('Mise en forme reproduite.');
  }, true);

  /* ---------- Diaporama : masquer, boucle, avance auto ---------- */
  ACT.hideSlide = () => { if (H.masterMode) return; const s = curSlide(); PP.mutate(() => { s.hidden = !s.hidden; }); toast(s.hidden ? 'Diapositive masquée (ignorée en diaporama).' : 'Diapositive réaffichée.'); };
  ACT.loopToggle = () => { PP.deck.loop = !PP.deck.loop; $('#b-loop').classList.toggle('on', !!PP.deck.loop); toast(PP.deck.loop ? 'Diaporama en boucle.' : 'Boucle désactivée.'); };
  $('#sel-auto').addEventListener('change', e => { const s = curSlide(), v = +e.target.value; PP.mutate(() => { s.auto = v; }); });

  /* ---------- Affichage : grille, notes ---------- */
  ACT.gridToggle = () => { X.grid = !X.grid; stage.classList.toggle('grid-on', X.grid); $('#b-grid').classList.toggle('on', X.grid); toast(X.grid ? 'Grille et aimantation activées.' : 'Grille désactivée.'); };
  ACT.notesToggle = () => { const n = $('#notes'); n.style.display = n.style.display === 'none' ? '' : 'none'; window.dispatchEvent(new Event('resize')); };

  /* ---------- Trieur de diapositives ---------- */
  ACT.sorter = () => {
    if ($('#sorter')) return; PP.h.commitEdit(); const ov = document.createElement('div'); ov.id = 'sorter';
    ov.innerHTML = '<div class="so-head"><b><i class="fa-solid fa-table-cells"></i> Trieur de diapositives</b><span>Glisser = réordonner · double-clic = modifier · Suppr = supprimer</span><div class="so-btns"><button data-s="dup">Dupliquer</button><button data-s="hide">Masquer</button><button data-s="del">Supprimer</button><button data-s="add">Nouvelle</button><button data-s="close" class="primary">Fermer</button></div></div><div class="so-grid"></div>';
    document.body.appendChild(ov); const grid = ov.querySelector('.so-grid'); let from = null;
    const draw = () => { grid.innerHTML = ''; D().slides.forEach((sd, i) => { const c = document.createElement('div'); c.className = 'so-card' + (i === H.cur ? ' on' : '') + (sd.hidden ? ' hid' : ''); c.dataset.i = i; c.draggable = true; c.innerHTML = '<span class="so-n">' + (i + 1) + '</span><div class="so-tp"></div>' + (sd.auto ? '<span class="so-t"><i class="fa-regular fa-clock"></i> ' + sd.auto + ' s</span>' : ''); c.querySelector('.so-tp').appendChild(H.slideEl(sd)); grid.appendChild(c); }); };
    const close = () => { document.removeEventListener('keydown', key, true); ov.remove(); PP.renderAll(); };
    const sel = i => { H.cur = i; PP.renderAll(); draw(); };
    const key = e => { e.stopImmediatePropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Delete') { e.preventDefault(); ACT.delSlide(); draw(); } else if (e.key === 'ArrowRight' && H.cur < D().slides.length - 1) sel(H.cur + 1); else if (e.key === 'ArrowLeft' && H.cur > 0) sel(H.cur - 1); };
    document.addEventListener('keydown', key, true);
    ov.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { const a = b.dataset.s; if (a === 'close') close(); else if (a === 'dup') { ACT.dupSlide(); draw(); } else if (a === 'del') { ACT.delSlide(); draw(); } else if (a === 'add') { ACT.addSlide(); draw(); } else if (a === 'hide') { ACT.hideSlide(); draw(); } return; } const c = e.target.closest('.so-card'); if (c) sel(+c.dataset.i); });
    ov.addEventListener('dblclick', e => { if (e.target.closest('.so-card')) close(); });
    grid.addEventListener('dragstart', e => { const c = e.target.closest('.so-card'); if (c) { from = +c.dataset.i; e.dataTransfer.effectAllowed = 'move'; } });
    grid.addEventListener('dragover', e => e.preventDefault());
    grid.addEventListener('drop', e => { e.preventDefault(); const c = e.target.closest('.so-card'); if (!c || from == null) return; const to = +c.dataset.i; if (to === from) return; PP.mutate(() => { const [s] = D().slides.splice(from, 1); D().slides.splice(to, 0, s); H.cur = to; }); from = null; draw(); });
    draw();
  };

  /* ---------- Rechercher / Remplacer ---------- */
  let lastHit = -1;
  const cellsOf = o => (o.type === 'table' && o.cells) ? [].concat(...o.cells.map((r, ri) => r.map((v, ci) => ({ get: () => v, set: t => { o.cells[ri][ci] = t; } })))) : [];
  function fields(o) { const r = []; if (o.type === 'chart') { r.push({ get: () => o.title || '', set: t => { o.title = t; } }); return r; } if (o.type === 'table') return cellsOf(o); if (o.type === 'image' || o.type === 'arrow') return r; r.push({ get: () => o.text || '', set: t => { o.text = t; } }); return r; }
  const rxOf = (q, cs) => new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), cs ? 'g' : 'gi');
  function hits(q, cs) { const out = [], rx = rxOf(q, cs); D().slides.forEach((s, si) => s.objs.forEach(o => { const n = fields(o).reduce((t, f) => t + ((f.get().match(rx) || []).length), 0); if (n) out.push({ si, id: o.id, n }); })); return out; }
  ACT.findOpen = async () => {
    const seed = (H.selObj() && H.selObj().text || '').split('\n')[0].slice(0, 40);
    await A.dialog({
      title: 'Rechercher et remplacer', width: 420,
      body: '<label class="field">Rechercher<input type="text" id="fd-q" value="' + esc(seed) + '"></label><label class="field">Remplacer par<input type="text" id="fd-r"></label><label class="field" style="flex-direction:row;gap:8px"><input type="checkbox" id="fd-c"> Respecter la casse</label><p id="fd-s" class="muted" style="margin:6px 0 0;font-size:12px"></p>',
      buttons: [
        { label: 'Suivant', collect: b => { const q = b.querySelector('#fd-q').value, st = b.querySelector('#fd-s'); if (!q) { st.textContent = 'Saisissez un texte à rechercher.'; return false; } const h = hits(q, b.querySelector('#fd-c').checked); if (!h.length) { st.textContent = 'Aucun résultat.'; return false; } lastHit = (lastHit + 1) % h.length; const t = h[lastHit]; H.selectObj(t.si, t.id); st.textContent = 'Résultat ' + (lastHit + 1) + ' sur ' + h.length + ' (diapositive ' + (t.si + 1) + ').'; return false; } },
        { label: 'Remplacer tout', collect: b => { const q = b.querySelector('#fd-q').value, r = b.querySelector('#fd-r').value, st = b.querySelector('#fd-s'); if (!q) { st.textContent = 'Saisissez un texte à rechercher.'; return false; } const cs = b.querySelector('#fd-c').checked, rx = rxOf(q, cs); let n = 0; PP.mutate(() => D().slides.forEach(s => s.objs.forEach(o => fields(o).forEach(f => { const t = f.get(), m = t.match(rx); if (m) { n += m.length; f.set(t.replace(rx, () => r)); } })))); st.textContent = n ? n + ' remplacement(s) effectué(s).' : 'Aucun résultat.'; return false; } },
        { label: 'Fermer', primary: true, value: true }
      ]
    });
    lastHit = -1;
  };
  document.addEventListener('keydown', e => { if (!(e.ctrlKey || e.metaKey) || $('#modal-backdrop') || $('#sorter')) return; const k = e.key.toLowerCase(); if (k === 'f' || k === 'h') { if (e.target.matches('input,textarea,select') || e.target.isContentEditable) return; e.preventDefault(); ACT.findOpen(); } });

  /* ---------- Synchronisation du ruban avec la sélection ---------- */
  function sync() {
    const o = H.selObj(), has = !!o;
    ['x', 'y', 'w', 'h', 'rot'].forEach(k => { F[k].disabled = !has; if (document.activeElement !== F[k]) F[k].value = has ? Math.round(o[k] || 0) : ''; });
    $('#sel-lw').value = has && o.lw ? o.lw : (has && (o.type === 'arrow') ? 4 : 2); $('#sel-dash').value = (has && o.dash) || 'solid'; $('#sel-op').value = has && o.op != null ? String(o.op) : '1';
    $('#sel-cr').value = has && o.cr ? String(o.cr) : '0'; $('#sel-ls').value = has && o.ls ? String(o.ls) : '1.2'; $('#sel-va').value = (has && o.va) || (has && o.type === 'text' ? 'top' : 'middle');
    const s = curSlide(); if (s) $('#sel-auto').value = String(s.auto || 0); $('#b-loop').classList.toggle('on', !!D().loop);
  }
  const NEAR = (v, list) => list.includes(String(v)) ? String(v) : list[0];
  new MutationObserver(() => { try { sync(); } catch (e) { /* ignore */ } }).observe(stage, { childList: true });
  setTimeout(() => { try { sync(); } catch (e) { /* ignore */ } }, 50);
})();
