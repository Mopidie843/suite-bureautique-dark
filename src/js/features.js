'use strict';
/* ===== Fonctions : tableaux, images, formes, liens, en-têtes, références, commentaires, publipostage ===== */
(function () {
  const $ = W.$, $$ = W.$$, ed = W.editor, ACT = W.ACT;
  const done = () => { W.docChanged(); W.history.commit(); };
  const BLOCK_SEL = 'p,h1,h2,h3,h4,h5,h6,li,td,th,div,blockquote,pre';
  const topBlockOf = node => { let t = node; while (t && t.parentNode !== ed) t = t.parentNode; return t; };

  /* ---------- Tableaux ---------- */
  const CELL = '<td style="border:1px solid #808080;padding:4px 8px"><br></td>';
  function tableHTML(r, c) {
    let h = '<table border="1" style="border-collapse:collapse;width:100%">';
    for (let i = 0; i < r; i++) { h += '<tr>' + CELL.repeat(c) + '</tr>'; }
    return h + '</table><p><br></p>';
  }
  const grid = $('#table-grid');
  for (let r = 1; r <= 6; r++) for (let c = 1; c <= 8; c++) {
    const d = document.createElement('div'); d.className = 'tg-cell'; d.dataset.r = r; d.dataset.c = c; grid.appendChild(d);
  }
  grid.addEventListener('mouseover', e => {
    const t = e.target.closest('.tg-cell'); if (!t) return; const r = +t.dataset.r, c = +t.dataset.c;
    $('#table-grid-label').textContent = 'Tableau ' + r + ' × ' + c;
    $$('.tg-cell', grid).forEach(x => x.classList.toggle('on', +x.dataset.r <= r && +x.dataset.c <= c));
  });
  grid.addEventListener('mouseleave', () => { $('#table-grid-label').textContent = 'Insérer un tableau'; $$('.tg-cell', grid).forEach(x => x.classList.remove('on')); });
  grid.addEventListener('click', e => {
    const t = e.target.closest('.tg-cell'); if (!t) return;
    W.insertHTML(tableHTML(+t.dataset.r, +t.dataset.c));
    document.activeElement.blur && 0; $('#btn-table').blur();
  });

  function currentCell() {
    const s = getSelection(); const n = s.rangeCount ? s.anchorNode : null;
    const el = n && (n.nodeType === 1 ? n : n.parentElement);
    const cell = el && ed.contains(el) ? el.closest('td,th') : null;
    if (!cell) W.toast('Placez le curseur dans une cellule de tableau.');
    return cell;
  }
  const blankCell = src => { const c = src.cloneNode(false); c.removeAttribute('colspan'); c.removeAttribute('rowspan'); c.innerHTML = '<br>'; return c; };
  function tableOp(fn) { const cell = currentCell(); if (!cell) return; W.history.flush(); fn(cell, cell.parentElement, cell.closest('table')); done(); }
  Object.assign(ACT, {
    rowBelow: () => tableOp((c, tr) => { const n = tr.cloneNode(false); Array.from(tr.cells).forEach(x => n.appendChild(blankCell(x))); tr.after(n); }),
    rowAbove: () => tableOp((c, tr) => { const n = tr.cloneNode(false); Array.from(tr.cells).forEach(x => n.appendChild(blankCell(x))); tr.before(n); }),
    colRight: () => tableOp((c, tr, tb) => { const i = c.cellIndex; Array.from(tb.rows).forEach(r => { const ref = r.cells[i] || r.cells[r.cells.length - 1]; if (ref) ref.after(blankCell(ref)); }); }),
    colLeft: () => tableOp((c, tr, tb) => { const i = c.cellIndex; Array.from(tb.rows).forEach(r => { const ref = r.cells[i] || r.cells[r.cells.length - 1]; if (ref) ref.before(blankCell(ref)); }); }),
    delRow: () => tableOp((c, tr, tb) => { tr.remove(); if (!tb.rows.length) tb.remove(); }),
    delCol: () => tableOp((c, tr, tb) => { const i = c.cellIndex; Array.from(tb.rows).forEach(r => { if (r.cells[i]) r.cells[i].remove(); }); if (!tb.querySelector('td,th')) tb.remove(); }),
    delTable: () => tableOp((c, tr, tb) => tb.remove())
  });

  /* ---------- Images ---------- */
  W.insertImages = async function (files) {
    for (const f of Array.from(files)) {
      if (!/^image\//.test(f.type)) continue;
      try {
        const url = await W.readImage(f);
        if (!url) { W.toast('Les images SVG ne sont pas prises en charge.', 'err'); continue; }
        W.focusEditor(); W.insertHTML('<img src="' + url + '" alt="' + W.esc(f.name.replace(/\.[^.]+$/, '')) + '" style="max-width:100%">');
      } catch (e) { W.toast('Image illisible : ' + f.name, 'err'); }
    }
  };
  ACT.imageFile = () => $('#image-input').click();
  $('#image-input').addEventListener('change', e => { const f = Array.from(e.target.files); e.target.value = ''; W.insertImages(f); });
  ACT.imageUrl = async () => {
    const u = await W.askText('Image en ligne', 'Adresse de l\'image (https://…)', 'https://');
    if (!u) return;
    if (!/^https?:\/\//i.test(u.trim())) { W.toast('L\'adresse doit commencer par http:// ou https://', 'err'); return; }
    W.focusEditor(); W.insertHTML('<img src="' + W.esc(u.trim()) + '" alt="" style="max-width:100%">');
  };
  W.editObject = async function (el) {
    const isImg = el.tagName === 'IMG', w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    const body = document.createElement('div');
    body.innerHTML = '<div class="two"><label class="field">Largeur (px)<input type="number" id="ob-w" min="10" max="3000" value="' + w + '"></label><label class="field">Hauteur (px)<input type="number" id="ob-h" min="10" max="3000" value="' + h + '"></label></div>' +
      (isImg ? '<label class="check"><input type="checkbox" id="ob-lock" checked> Conserver les proportions</label><label class="field">Texte alternatif<input type="text" id="ob-alt" value="' + W.esc(el.getAttribute('alt') || '') + '"></label>'
        : '<label class="field">Couleur<input type="color" id="ob-col" value="' + (rgbHex(getComputedStyle(el).backgroundColor) || '#2f7fd0') + '"></label>');
    const r = await W.dialog({
      title: isImg ? 'Format de l\'image' : 'Format de la forme', width: 380, body,
      buttons: [{ label: 'Supprimer', danger: true, value: 'del' }, { label: 'Annuler', value: null }, { label: 'OK', primary: true, collect: b => ({ w: +b.querySelector('#ob-w').value, h: +b.querySelector('#ob-h').value, lock: !!(b.querySelector('#ob-lock') || {}).checked, alt: (b.querySelector('#ob-alt') || {}).value, col: (b.querySelector('#ob-col') || {}).value }) }]
    });
    if (!r) return; W.history.flush();
    if (r === 'del') el.remove();
    else {
      if (r.w > 0) el.style.width = r.w + 'px';
      if (isImg) { el.style.height = r.lock || !(r.h > 0) ? 'auto' : r.h + 'px'; el.removeAttribute('width'); el.removeAttribute('height'); el.style.maxWidth = '100%'; el.setAttribute('alt', r.alt || ''); }
      else { if (r.h > 0) el.style.height = r.h + 'px'; if (r.col) el.style.backgroundColor = r.col; }
    }
    done();
  };
  function rgbHex(c) { const m = (c || '').match(/\d+/g); return m && m.length >= 3 ? '#' + m.slice(0, 3).map(x => (+x).toString(16).padStart(2, '0')).join('') : null; }

  /* ---------- Formes, lien, ligne, zone de texte, symboles, date ---------- */
  const shape = css => () => { const e = document.createElement('span'); e.className = 'shape'; e.contentEditable = 'false'; e.setAttribute('style', css); W.insertInline(e); };
  Object.assign(ACT, {
    shapeRect: shape('width:120px;height:80px;background-color:#2f7fd0;border-radius:4px'),
    shapeCircle: shape('width:90px;height:90px;background-color:#e5484d;border-radius:50%'),
    shapeTriangle: shape('width:100px;height:90px;background-color:#30a46c;clip-path:polygon(50% 0,100% 100%,0 100%)'),
    shapeStar: shape('width:100px;height:96px;background-color:#f5b301;clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)'),
    hr: () => W.insertHTML('<hr>'),
    pageBreak: () => W.insertHTML('<div class="pb" contenteditable="false"></div>'),
    textBox: () => W.insertHTML('<div class="tb"><p>Zone de texte</p></div><p><br></p>'),
    dateTime: () => W.exec('insertText', W.today()),
    quote: () => W.exec('formatBlock', 'blockquote')
  });
  ACT.link = async () => {
    const s = getSelection(), had = s.rangeCount && !s.isCollapsed && ed.contains(s.anchorNode), txt = had ? s.toString() : '';
    const body = document.createElement('div');
    body.innerHTML = '<label class="field">Adresse<input type="text" id="lk-url" placeholder="https://exemple.fr"></label>' + (had ? '' : '<label class="field">Texte à afficher<input type="text" id="lk-txt"></label>');
    const r = await W.dialog({ title: 'Insérer un lien', body, buttons: [{ label: 'Annuler', value: null }, { label: 'OK', primary: true, collect: b => { const u = b.querySelector('#lk-url').value.trim(); if (!u) return false; return { u, t: (b.querySelector('#lk-txt') || {}).value }; } }] });
    if (!r) return;
    let u = r.u; if (!/^(https?:|mailto:|tel:|#)/i.test(u)) u = /@/.test(u) && !/\s/.test(u) ? 'mailto:' + u : 'https://' + u;
    if (/^javascript:/i.test(u)) return;
    if (had) W.exec('createLink', u); else W.insertHTML('<a href="' + W.esc(u) + '">' + W.esc(r.t || r.u) + '</a>');
  };
  ACT.symbols = async () => {
    const syms = 'ΩαβγδεθλμπσφψΔΣ±×÷≠≈≤≥∞√∑∫∂∈∉∪∩⊂⊃→←↑↓↔⇒⇔°′″‰§¶©®™€£¥¢•…–—«»‹›“”‘’½¼¾²³¹⁰✓✔✗★☆♥♦♣♠♪☎✉'.split('');
    const body = document.createElement('div'); body.innerHTML = '<div class="sym-grid">' + syms.map(c => '<button type="button">' + c + '</button>').join('') + '</div>';
    const ch = await W.dialog({ title: 'Insérer un symbole', width: 500, body, buttons: [{ label: 'Fermer', value: null }], onOpen: (b, fin) => b.querySelectorAll('button').forEach(x => x.onclick = () => fin(x.textContent)) });
    if (ch) { W.focusEditor(); W.exec('insertText', ch); }
  };

  /* ---------- En-tête, pied de page, numéros, filigrane ---------- */
  async function headerFooter(focusNum) {
    const p = W.page, body = document.createElement('div');
    body.innerHTML = '<label class="field">Texte d\'en-tête<input type="text" id="hf-h" value="' + W.esc(p.header) + '"></label><label class="field">Texte de pied de page<input type="text" id="hf-f" value="' + W.esc(p.footer) + '"></label>' +
      '<label class="field">Numéros de page<select id="hf-n" class="office-select" style="max-width:none"><option value="none">Aucun</option><option value="left">En bas à gauche</option><option value="center">En bas au centre</option><option value="right">En bas à droite</option></select></label>';
    body.querySelector('#hf-n').value = p.numbers;
    const r = await W.dialog({ title: 'En-tête et pied de page', body, buttons: [{ label: 'Annuler', value: null }, { label: 'OK', primary: true, collect: b => ({ h: b.querySelector('#hf-h').value, f: b.querySelector('#hf-f').value, n: b.querySelector('#hf-n').value }) }] });
    if (!r) return; Object.assign(W.page, { header: r.h, footer: r.f, numbers: r.n }); W.pageChanged();
  }
  ACT.headerFooter = () => headerFooter(); ACT.pageNumber = () => { if (W.page.numbers === 'none') W.page.numbers = 'center'; W.pageChanged(); W.toast('Numéros de page affichés en bas de page.'); };
  ACT.watermark = async () => { const t = await W.askText('Filigrane', 'Texte du filigrane', W.page.watermark || 'CONFIDENTIEL'); if (t === null) return; W.page.watermark = t.trim(); W.pageChanged(); };
  ACT.removeWatermark = () => { W.page.watermark = ''; W.pageChanged(); };

  /* ---------- Table des matières ---------- */
  const headingsOf = () => $$('h1,h2,h3', ed).filter(h => !h.closest('.toc') && h.textContent.trim());
  function pageOfEl(el) {
    const g = W.geom(), pitch = g.ph + g.gap, sc = ed.offsetWidth ? ed.getBoundingClientRect().width / ed.offsetWidth : 1;
    return Math.max(1, Math.floor(((el.getBoundingClientRect().top - ed.getBoundingClientRect().top) / sc) / pitch) + 1);
  }
  function buildToc(entries) {
    return '<div class="toc-title">Table des matières</div>' + entries.map(e => '<div class="toc-line l' + e.level + '"><span class="t">' + W.esc(e.text) + '</span><span class="dots"></span><span class="n">' + (e.page || '') + '</span></div>').join('');
  }
  function refreshToc(toc) {
    const hs = headingsOf();
    const entries = hs.map(h => ({ level: +h.tagName[1], text: h.textContent.trim(), el: h, page: '' }));
    toc.innerHTML = buildToc(entries); W.paginate({ sel: W.saveSel() });
    if (W.view === 'print') { entries.forEach(e => { e.page = pageOfEl(e.el); }); toc.innerHTML = buildToc(entries); W.paginate({ sel: W.saveSel() }); }
  }
  ACT.toc = () => {
    if (ed.querySelector('.toc')) return ACT.updateToc();
    if (!headingsOf().length) { W.toast('Appliquez d\'abord des styles « Titre 1/2/3 » à vos titres.'); return; }
    W.history.flush(); W.focusEditor();
    document.execCommand('insertHTML', false, '<div class="toc" contenteditable="false" data-toc="1"></div>');
    const toc = ed.querySelector('.toc'); if (toc) refreshToc(toc); done();
  };
  ACT.updateToc = () => { const toc = ed.querySelector('.toc'); if (!toc) { W.toast('Aucune table des matières à mettre à jour.'); return; } W.history.flush(); refreshToc(toc); done(); W.toast('Table des matières mise à jour.', 'ok'); };

  /* ---------- Notes de fin ---------- */
  W.renumberFootnotes = function () {
    const sups = $$('sup.fn', ed); let box = ed.querySelector('.footnotes');
    if (!sups.length) { if (box) { box.remove(); return true; } return false; }
    if (!box) { box = document.createElement('div'); box.className = 'footnotes'; ed.appendChild(box); }
    const notes = new Map(); box.querySelectorAll('p[data-fn]').forEach(p => notes.set(p.getAttribute('data-fn'), p));
    let changed = false;
    sups.forEach((s, i) => {
      const lab = '[' + (i + 1) + ']'; if (s.textContent !== lab) { s.textContent = lab; changed = true; }
      let p = notes.get(s.getAttribute('data-fn'));
      if (!p) { p = document.createElement('p'); p.setAttribute('data-fn', s.getAttribute('data-fn')); p.innerHTML = '<b class="fnum"></b> <span>Note</span>'; changed = true; }
      const num = p.querySelector('.fnum'); if (num && num.textContent !== (i + 1) + '.') { num.textContent = (i + 1) + '.'; changed = true; }
      if (box.children[i] !== p) { box.insertBefore(p, box.children[i] || null); changed = true; }
    });
    while (box.children.length > sups.length) { box.lastElementChild.remove(); changed = true; }
    return changed;
  };
  ACT.footnote = async () => {
    const t = await W.askText('Insérer une note', 'Texte de la note (affichée en fin de document)', '');
    if (!t || !t.trim()) return;
    const id = W.uid();
    W.focusEditor(); W.history.flush();
    document.execCommand('insertHTML', false, '<sup class="fn" data-fn="' + id + '">[0]</sup>');
    W.renumberFootnotes();
    const p = ed.querySelector('.footnotes p[data-fn="' + id + '"] span'); if (p) p.textContent = t.trim();
    done();
  };

  /* ---------- Légendes ---------- */
  ACT.caption = async () => {
    const body = document.createElement('div');
    body.innerHTML = '<label class="field">Étiquette<select id="cp-l" class="office-select" style="max-width:none"><option>Figure</option><option>Tableau</option><option>Illustration</option></select></label><label class="field">Texte de la légende<input type="text" id="cp-t"></label>';
    const r = await W.dialog({ title: 'Insérer une légende', body, buttons: [{ label: 'Annuler', value: null }, { label: 'OK', primary: true, collect: b => ({ l: b.querySelector('#cp-l').value, t: b.querySelector('#cp-t').value.trim() }) }] });
    if (!r) return;
    const n = $$('.caption', ed).filter(c => c.textContent.startsWith(r.l + ' ')).length + 1;
    const p = document.createElement('p'); p.className = 'caption'; p.textContent = r.l + ' ' + n + (r.t ? ' : ' + r.t : '');
    W.history.flush();
    const s = getSelection(); let top = s.rangeCount && ed.contains(s.anchorNode) ? topBlockOf(s.anchorNode) : null;
    if (top && top !== ed) top.after(p); else ed.appendChild(p);
    done();
  };

  /* ---------- Commentaires ---------- */
  const author = () => W.settings.get('userName', '') || 'Utilisateur';
  function renderComments() {
    const list = $('#comment-list'), cs = W.doc.comments;
    if (!cs.length) { list.innerHTML = '<div class="cm-empty">Aucun commentaire. Sélectionnez du texte puis choisissez « Nouveau commentaire ».</div>'; return; }
    list.innerHTML = cs.map(c => {
      const alive = !!ed.querySelector('[data-cid="' + c.id + '"]');
      return '<div class="cm-card' + (c.resolved ? ' res' : '') + '" data-cid="' + W.esc(c.id) + '"><div class="who"><b>' + W.esc(c.author) + '</b><span>' + W.esc(W.fmtDate(c.date)) + '</span></div>' +
        (c.quote ? '<div class="q">' + W.esc(c.quote) + (alive ? '' : ' (texte supprimé)') + '</div>' : '') + '<div class="tx">' + W.esc(c.text) + '</div>' +
        '<div class="acts"><button class="mini" data-cm="res">' + (c.resolved ? 'Rouvrir' : 'Résoudre') + '</button><button class="mini" data-cm="del">Supprimer</button></div></div>';
    }).join('');
  }
  W.renderComments = renderComments;
  $('#comment-list').addEventListener('click', e => {
    const card = e.target.closest('.cm-card'); if (!card) return;
    const id = card.dataset.cid, c = W.doc.comments.find(x => x.id === id), act = e.target.closest('[data-cm]');
    if (act && act.dataset.cm === 'del') { W.history.flush(); const sp = ed.querySelector('[data-cid="' + id + '"]'); if (sp) { while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp); sp.remove(); } W.doc.comments = W.doc.comments.filter(x => x.id !== id); renderComments(); done(); return; }
    if (act && act.dataset.cm === 'res') { c.resolved = !c.resolved; renderComments(); W.docChanged({ history: false, paginate: false }); return; }
    const sp = ed.querySelector('[data-cid="' + id + '"]');
    if (sp) { $$('.cmt.active', ed).forEach(x => x.classList.remove('active')); sp.classList.add('active'); sp.scrollIntoView({ block: 'center' }); }
  });
  ACT.toggleComments = () => { $('#side-panel').classList.toggle('hidden'); renderComments(); if (W.autoFit) setTimeout(() => W.fitWidth(), 0); };
  ACT.newComment = async () => {
    W.focusEditor(); const s = getSelection();
    if (!s.rangeCount || s.isCollapsed || !ed.contains(s.anchorNode) || !ed.contains(s.focusNode)) { W.toast('Sélectionnez d\'abord le texte à commenter.'); return; }
    const r = s.getRangeAt(0), b1 = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest(BLOCK_SEL), b2 = (r.endContainer.nodeType === 1 ? r.endContainer : r.endContainer.parentElement).closest(BLOCK_SEL);
    if (b1 !== b2) { W.toast('Sélectionnez du texte dans un seul paragraphe.'); return; }
    const quote = s.toString().slice(0, 120), saved = W.saveSel();
    const body = document.createElement('div'); body.innerHTML = '<div class="note" style="margin:0 0 10px">« ' + W.esc(quote) + ' »</div><label class="field">Commentaire<textarea id="cm-t" style="font-family:inherit;min-height:100px"></textarea></label>';
    const t = await W.dialog({ title: 'Nouveau commentaire', body, buttons: [{ label: 'Annuler', value: null }, { label: 'Publier', primary: true, collect: bd => { const v = bd.querySelector('#cm-t').value.trim(); return v || false; } }] });
    if (!t) return;
    W.history.flush(); ed.focus(); W.loadSel(saved);
    const rg = getSelection().getRangeAt(0), id = W.uid(), sp = document.createElement('span');
    sp.className = 'cmt'; sp.setAttribute('data-cid', id); sp.appendChild(rg.extractContents()); rg.insertNode(sp);
    W.doc.comments.push({ id, author: author(), text: t, date: Date.now(), resolved: false, quote });
    $('#side-panel').classList.remove('hidden'); renderComments(); done();
  };
  ed.addEventListener('click', e => {
    const sp = e.target.closest && e.target.closest('.cmt'); if (!sp) return;
    if (!$('#side-panel').classList.contains('hidden')) { const card = $('.cm-card[data-cid="' + sp.getAttribute('data-cid') + '"]'); if (card) card.scrollIntoView({ block: 'nearest' }); }
  });

  /* ---------- Publipostage ---------- */
  const mm = W.mm = { fields: [], rows: [], preview: false, idx: 0 };
  const mmStatus = () => { $('#mm-status').textContent = !mm.rows.length ? 'Aucun destinataire' : (mm.preview ? 'Aperçu ' + (mm.idx + 1) + '/' + mm.rows.length : mm.rows.length + ' destinataire' + (mm.rows.length > 1 ? 's' : '')); };
  function mmApply() {
    $$('.mf', ed).forEach(m => { const f = m.getAttribute('data-field'); m.textContent = mm.preview ? (mm.rows[mm.idx] && mm.rows[mm.idx][f] !== undefined ? mm.rows[mm.idx][f] : '') : '«' + f + '»'; });
    $('#btn-mmpreview').classList.toggle('active', mm.preview); mmStatus(); W.paginate();
  }
  W.mmSetPreview = on => { mm.preview = on; mmApply(); };
  const toCSV = () => [mm.fields.join(';')].concat(mm.rows.map(r => mm.fields.map(f => r[f]).join(';'))).join('\n');
  ACT.mmRecipients = async () => {
    const body = document.createElement('div');
    body.innerHTML = '<p>Collez les destinataires (depuis Excel ou un fichier CSV) ou importez un fichier. La <b>première ligne</b> contient les noms des champs.</p><button type="button" class="mini" id="mm-file" style="margin-bottom:10px">Choisir un fichier CSV…</button><label class="field"><textarea id="mm-text" spellcheck="false"></textarea></label>';
    const ta = body.querySelector('#mm-text'); ta.value = mm.fields.length ? toCSV() : 'prenom;nom;ville\nMarie;Dupont;Lyon\nPaul;Martin;Nantes';
    body.querySelector('#mm-file').onclick = () => $('#csv-input').click();
    mm.fill = txt => { ta.value = txt; };
    const r = await W.dialog({ title: 'Destinataires', width: 560, body, buttons: [{ label: 'Annuler', value: null }, { label: 'Utiliser ces données', primary: true, collect: b => { const d = W.parseCSV(b.querySelector('#mm-text').value); if (!d.fields.length || !d.rows.length) { W.toast('Il faut une ligne d\'en-tête et au moins un destinataire.', 'err'); return false; } return d; } }] });
    mm.fill = null; if (!r) return;
    mm.fields = r.fields; mm.rows = r.rows; mm.idx = 0; mm.preview = false; mmApply(); W.toast(r.rows.length + ' destinataire(s) chargé(s).', 'ok');
  };
  $('#csv-input').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const buf = await f.arrayBuffer(); let txt = new TextDecoder('utf-8').decode(buf); if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);
    if (mm.fill) mm.fill(txt);
  });
  ACT.mmField = async () => {
    if (!mm.fields.length) { W.toast('Chargez d\'abord les destinataires.'); return ACT.mmRecipients(); }
    const body = document.createElement('div'); body.innerHTML = '<p>Choisissez le champ à insérer :</p><div class="export-list" style="gap:6px">' + mm.fields.map(f => '<button type="button" data-f="' + W.esc(f) + '"><i class="fa-solid fa-code c-purple" style="font-size:16px;width:20px"></i><div><b>«' + W.esc(f) + '»</b></div></button>').join('') + '</div>';
    const f = await W.dialog({ title: 'Insérer un champ de fusion', width: 380, body, buttons: [{ label: 'Annuler', value: null }], onOpen: (b, fin) => b.querySelectorAll('[data-f]').forEach(x => x.onclick = () => fin(x.dataset.f)) });
    if (!f) return; W.focusEditor();
    const e = document.createElement('span'); e.className = 'mf'; e.contentEditable = 'false'; e.setAttribute('data-field', f); e.textContent = '«' + f + '»'; W.insertInline(e);
  };
  ACT.mmSample = () => {
    if (!mm.fields.length) { W.toast('Chargez d\'abord les destinataires.'); return ACT.mmRecipients(); }
    const mf = f => '<span class="mf" contenteditable="false" data-field="' + W.esc(f) + '">«' + W.esc(f) + '»</span>';
    const [a, b, ...rest] = mm.fields;
    W.focusEditor();
    W.insertHTML('<p style="text-align:right">' + W.esc(W.today()) + '</p><p>' + mf(a) + (b ? ' ' + mf(b) : '') + (rest.length ? '<br>' + rest.map(mf).join('<br>') : '') + '</p><p>Madame, Monsieur,</p><p>Nous avons le plaisir de vous écrire au sujet de…</p><p>Cordialement,</p><p><br></p>');
  };
  ACT.mmPreview = () => { if (!mm.rows.length) { W.toast('Chargez d\'abord les destinataires.'); return ACT.mmRecipients(); } W.mmSetPreview(!mm.preview); };
  ACT.mmNext = () => { if (!mm.rows.length) return; mm.idx = (mm.idx + 1) % mm.rows.length; mm.preview = true; mmApply(); };
  ACT.mmPrev = () => { if (!mm.rows.length) return; mm.idx = (mm.idx - 1 + mm.rows.length) % mm.rows.length; mm.preview = true; mmApply(); };
  ACT.mmFinish = async () => {
    if (!mm.rows.length) { W.toast('Chargez d\'abord les destinataires.'); return ACT.mmRecipients(); }
    if (!$$('.mf', ed).length) { W.toast('Insérez au moins un champ de fusion dans le document.'); return; }
    if (!await W.confirmBox('Terminer et fusionner', mm.rows.length + ' lettre(s) seront générées dans un nouveau document (une par page). Le modèle reste disponible dans les documents récents.', 'Fusionner')) return;
    if (mm.preview) W.mmSetPreview(false);
    const tpl = W.cleanHTML(), parts = mm.rows.map(r => {
      const d = document.createElement('div'); d.innerHTML = tpl;
      d.querySelectorAll('.mf').forEach(m => m.replaceWith(document.createTextNode(r[m.getAttribute('data-field')] || '')));
      return d.innerHTML.replace(/\u200b/g, '');
    });
    const title = 'Fusion - ' + W.doc.title, page = Object.assign({}, W.page);
    await W.saveLibrary();
    W.loadDoc({ title, html: parts.join('<div class="pb" contenteditable="false"></div>'), page });
    W.toast('Fusion terminée : ' + mm.rows.length + ' page(s).', 'ok');
  };
})();
