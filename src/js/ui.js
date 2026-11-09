'use strict';
/* ===== Interface : boîtes de dialogue, ruban, mise en forme, vue, fichier (backstage) ===== */
(function () {
  const $ = W.$, $$ = W.$$, ed = W.editor;
  const ACT = W.ACT = {};

  /* ---------- Notifications ---------- */
  W.toast = function (msg, type) {
    const t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.textContent = msg;
    $('#toast-host').appendChild(t); setTimeout(() => t.remove(), type === 'err' ? 6000 : 3200);
  };

  /* ---------- Boîte de dialogue générique (remplace prompt/alert/confirm) ---------- */
  W.dialog = function (o) {
    return new Promise(resolve => {
      const bd = $('#modal-backdrop'), m = $('#modal'), body = $('#modal-body'), foot = $('#modal-foot');
      $('#modal-title').textContent = o.title || '';
      body.innerHTML = ''; if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
      m.style.width = o.width ? o.width + 'px' : '';
      foot.innerHTML = ''; let done = false;
      const finish = v => { if (done) return; done = true; bd.classList.add('hidden'); document.removeEventListener('keydown', onKey, true); bd.onmousedown = null; $('#modal-x').onclick = null; resolve(v); };
      (o.buttons || [{ label: 'OK', primary: true, value: true }]).forEach(b => {
        const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = b.label;
        if (b.primary) btn.classList.add('primary'); if (b.danger) btn.classList.add('danger');
        btn.onclick = () => { if (b.collect) { const v = b.collect(body); if (v === false) return; finish(v); } else finish(b.value === undefined ? true : b.value); };
        foot.appendChild(btn);
      });
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); }
        else if (e.key === 'Enter' && !['TEXTAREA', 'BUTTON', 'SELECT'].includes(e.target.tagName)) { const p = foot.querySelector('.primary'); if (p) { e.preventDefault(); e.stopPropagation(); p.click(); } }
      }
      document.addEventListener('keydown', onKey, true);
      bd.onmousedown = e => { if (e.target === bd) finish(null); };
      $('#modal-x').onclick = () => finish(null);
      bd.classList.remove('hidden');
      if (o.onOpen) o.onOpen(body, finish);
      const f = body.querySelector('input:not([type=checkbox]),textarea,select'); (f || foot.querySelector('.primary') || foot.firstChild).focus();
    });
  };
  W.askText = (title, label, value, extra) => W.dialog({
    title, body: '<label class="field">' + W.esc(label) + '<input type="text" id="dlg-in" value="' + W.esc(value || '') + '" ' + (extra || '') + '></label>',
    buttons: [{ label: 'Annuler', value: null }, { label: 'OK', primary: true, collect: b => b.querySelector('#dlg-in').value }]
  });
  W.confirmBox = (title, msg, okLabel, danger) => W.dialog({ title, body: '<p>' + W.esc(msg) + '</p>', buttons: [{ label: 'Annuler', value: false }, { label: okLabel || 'OK', primary: !danger, danger: !!danger, value: true }] });

  /* ---------- Suivi de la sélection (pour les menus et boîtes de dialogue) ---------- */
  let lastState = null;
  document.addEventListener('selectionchange', () => {
    const s = getSelection();
    if (s.rangeCount && ed.contains(s.anchorNode) && ed.contains(s.focusNode)) { lastState = W.saveSel(); updateToolbarState(); updatePageIndicator(); }
  });
  W.focusEditor = function (restore) {
    ed.focus({ preventScroll: true });
    if (restore !== false && lastState && document.activeElement === ed) { try { W.loadSel(lastState); } catch (e) { /* état périmé */ } }
    const s = getSelection();
    if (document.activeElement === ed && (!s.rangeCount || !ed.contains(s.anchorNode))) {
      const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); s.removeAllRanges(); s.addRange(r);
    }
  };
  W.scrollToSel = function () {
    const s = getSelection(); if (!s.rangeCount) return;
    const r = s.getRangeAt(0); let rect = r.getClientRects()[0];
    if (!rect) { const el = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement; rect = el.getBoundingClientRect(); }
    const w = $('#workspace').getBoundingClientRect();
    if (rect.top < w.top + 30 || rect.bottom > w.bottom - 30) $('#workspace').scrollBy({ top: rect.top - w.top - w.height / 3 });
  };

  /* ---------- Barre d'état ---------- */
  function updatePageIndicator() { $('#page-count').textContent = 'Page ' + W.currentPage() + ' sur ' + W.pageCount; }
  W.updateCounters = W.debounce(() => {
    const text = (ed.innerText || '').replace(/​/g, '');
    const t = text.trim();
    $('#word-count').textContent = (t ? t.split(/\s+/).length : 0) + ' mots';
    $('#char-count').textContent = text.replace(/\n$/, '').length + ' caractères';
    updatePageIndicator();
  }, 200);
  W.afterPaginate = function () { updatePageIndicator(); if (W.find && W.find.isOpen()) W.find.refresh(); if ($('#ruler') && !$('#ruler').classList.contains('hidden')) renderRuler(); };

  /* ---------- Onglets ---------- */
  function switchTab(name) {
    $$('.ribbon-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $$('.ribbon-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'ribbon-' + name));
  }
  $('#ribbon-tabs').addEventListener('click', e => { const t = e.target.closest('.ribbon-tab'); if (t) switchTab(t.dataset.tab); });

  /* ---------- Ruban : clic délégué sans voler le focus de l'éditeur ---------- */
  document.addEventListener('mousedown', e => {
    const t = e.target;
    if (t.closest('#ribbon, #statusbar, #ribbon-tabs, #titlebar .icon-btn, #side-panel .cm-card, .style-card') && !t.closest('select, input, textarea')) e.preventDefault();
  });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const fn = ACT[t.dataset.act];
    if (fn) { try { const r = fn(e, t); if (r && r.catch) r.catch(err => W.toast('Erreur : ' + err.message, 'err')); } catch (err) { console.error(err); W.toast('Erreur : ' + err.message, 'err'); } }
  });

  /* ---------- Commandes de mise en forme ---------- */
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('defaultParagraphSeparator', false, 'p');
  function done() { W.docChanged(); W.history.commit(); updateToolbarState(); }
  W.exec = function (cmd, val) {
    W.history.flush(); W.focusEditor();
    document.execCommand(cmd, false, val === undefined ? null : val);
    done();
  };
  W.insertHTML = function (html) { W.exec('insertHTML', html); };
  // Insertion d'un nœud en ligne (champ de fusion, forme) : plus fiable qu'insertHTML pour les éléments non éditables
  W.insertInline = function (node) {
    W.history.flush(); W.focusEditor();
    const s = getSelection(), r = s.getRangeAt(0); r.deleteContents(); r.insertNode(node);
    const after = document.createTextNode('\u200b'); node.after(after);
    r.setStart(after, 1); r.collapse(true); s.removeAllRanges(); s.addRange(r);
    done();
  };
  W.insertTextAtCaret = function (txt) { W.exec('insertText', txt); };

  const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
  function convertFontTags(pt) {
    const fonts = ed.querySelectorAll('font[size]'); if (!fonts.length) return;
    const st = W.saveSel(), map = { 1: 8, 2: 10, 3: 12, 4: 14, 5: 18, 6: 24, 7: pt || 36 };
    fonts.forEach(f => {
      const sp = document.createElement('span'); sp.style.fontSize = (map[f.getAttribute('size')] || 11) + 'pt';
      if (f.getAttribute('face')) sp.style.fontFamily = f.getAttribute('face');
      while (f.firstChild) sp.appendChild(f.firstChild); f.replaceWith(sp);
    });
    W.loadSel(st);
  }
  W.convertFontTags = convertFontTags;
  function setFontSize(pt) {
    W.history.flush(); W.focusEditor();
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontSize', false, '7');
    document.execCommand('styleWithCSS', false, true);
    W.pendingFontPt = pt; convertFontTags(pt); done();
  }
  function currentSizePt() {
    const s = getSelection(); const n = s.anchorNode; if (!n) return 11;
    const el = n.nodeType === 1 ? n : n.parentElement; return Math.round(parseFloat(getComputedStyle(el).fontSize) * 0.75 * 10) / 10;
  }
  function stepSize(dir) {
    const cur = currentSizePt();
    const next = dir > 0 ? (SIZES.find(x => x > cur + 0.01) || SIZES[SIZES.length - 1]) : (SIZES.slice().reverse().find(x => x < cur - 0.01) || SIZES[0]);
    setFontSize(next);
  }
  function selectedBlocks() {
    const s = getSelection(); if (!s.rangeCount) return [];
    const r = s.getRangeAt(0), tags = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,div,pre';
    return Array.from(ed.querySelectorAll(tags)).filter(b => !b.classList.contains('pb') && !b.classList.contains('toc') && !b.querySelector(tags) && !b.closest('.toc') && r.intersectsNode(b));
  }
  W.selectedBlocks = selectedBlocks;

  Object.assign(ACT, {
    bold: () => W.exec('bold'), italic: () => W.exec('italic'), underline: () => W.exec('underline'), strike: () => W.exec('strikeThrough'),
    subscript: () => W.exec('subscript'), superscript: () => W.exec('superscript'),
    bullets: () => W.exec('insertUnorderedList'), numbers: () => W.exec('insertOrderedList'),
    outdent: () => W.exec('outdent'), indent: () => W.exec('indent'),
    alignL: () => W.exec('justifyLeft'), alignC: () => W.exec('justifyCenter'), alignR: () => W.exec('justifyRight'), alignJ: () => W.exec('justifyFull'),
    clearFormat: () => W.exec('removeFormat'),
    fontGrow: () => stepSize(1), fontShrink: () => stepSize(-1),
    styleNormal: () => W.exec('formatBlock', 'p'), styleH1: () => W.exec('formatBlock', 'h1'), styleH2: () => W.exec('formatBlock', 'h2'), styleH3: () => W.exec('formatBlock', 'h3'),
    selectAll: () => { W.focusEditor(false); document.execCommand('selectAll'); },
    undo: () => { W.history.undo(); }, redo: () => { W.history.redo(); },
    cut: () => { W.focusEditor(); document.execCommand('cut'); setTimeout(done, 0); },
    copy: () => { W.focusEditor(); document.execCommand('copy'); W.toast('Copié.'); },
    paste: async () => { W.focusEditor(); const c = await readClipboard(); if (c) W.pasteContent(c.html, c.text); }
  });
  async function readClipboard() {
    try {
      if (W.api && W.api.clipboardRead) return await W.api.clipboardRead();
      if (navigator.clipboard && navigator.clipboard.readText) return { html: '', text: await navigator.clipboard.readText() };
    } catch (e) { /* refusé */ }
    W.toast('Utilisez Ctrl+V pour coller.'); return null;
  }
  W.pasteContent = function (html, text) {
    if (html && html.trim()) {
      const internal = html.indexOf('<!--wd-->') >= 0;
      const clean = W.sanitize(html.replace('<!--wd-->', ''), { keepColors: internal });
      if (clean.trim()) { W.insertHTML(clean); return; }
    }
    if (text) { if (/\n/.test(text)) W.insertHTML(W.textToHTML(text)); else W.exec('insertText', text); }
  };

  $('#sel-font').addEventListener('change', e => { W.exec('fontName', e.target.value); });
  $('#sel-size').addEventListener('change', e => { setFontSize(parseFloat(e.target.value)); });
  $('#sel-spacing').addEventListener('change', e => {
    const v = e.target.value; e.target.value = ''; if (!v) return;
    W.history.flush(); W.focusEditor();
    selectedBlocks().forEach(b => { b.style.lineHeight = v; }); done();
  });
  $('#in-color').addEventListener('change', e => { $('#bar-color').style.background = e.target.value; W.exec('foreColor', e.target.value); });
  $('#in-hilite').addEventListener('change', e => { $('#bar-hilite').style.background = e.target.value; W.exec('hiliteColor', e.target.value); });

  function updateToolbarState() {
    $$('[data-state]').forEach(b => { let on = false; try { on = document.queryCommandState(b.dataset.state); } catch (e) { /* ignoré */ } b.classList.toggle('on', !!on); });
    const s = getSelection(); if (!s.rangeCount || !ed.contains(s.anchorNode)) return;
    const el = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement; if (!el) return;
    const cs = getComputedStyle(el), fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const fs = $('#sel-font'); if (document.activeElement !== fs) { const opt = Array.from(fs.options).find(o => o.value.toLowerCase() === fam.toLowerCase()); fs.value = opt ? opt.value : fs.options[0].value; }
    const ss = $('#sel-size'); if (document.activeElement !== ss) { const v = String(Math.round(parseFloat(cs.fontSize) * 0.75)); ss.value = Array.from(ss.options).some(o => o.value === v) ? v : ''; }
  }

  /* ---------- Reproduire la mise en forme ---------- */
  let painter = null;
  ACT.painter = () => {
    const s = getSelection(); if (!s.rangeCount || !ed.contains(s.anchorNode)) { W.toast('Placez le curseur dans le texte à copier.'); return; }
    const el = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement, cs = getComputedStyle(el);
    const rgb2hex = c => { const m = c.match(/\d+/g); return m ? '#' + m.slice(0, 3).map(x => (+x).toString(16).padStart(2, '0')).join('') : null; };
    painter = { family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), pt: Math.round(parseFloat(cs.fontSize) * 0.75 * 10) / 10, color: rgb2hex(cs.color), bold: +cs.fontWeight >= 600, italic: cs.fontStyle === 'italic', underline: /underline/.test(cs.textDecorationLine) };
    $('#btn-painter').classList.add('active'); W.toast('Sélectionnez le texte à mettre en forme.');
  };
  ed.addEventListener('mouseup', () => {
    if (!painter) return; const s = getSelection(); if (s.isCollapsed) return;
    const p = painter; painter = null; $('#btn-painter').classList.remove('active');
    W.history.flush();
    document.execCommand('fontName', false, p.family);
    if (p.color) document.execCommand('foreColor', false, p.color);
    ['bold', 'italic', 'underline'].forEach(c => { if (document.queryCommandState(c) !== p[c]) document.execCommand(c); });
    setFontSize(p.pt);
  });

  /* ---------- Zoom ---------- */
  Object.assign(ACT, {
    zoomIn: () => W.setZoom(W.zoom + 0.1), zoomOut: () => W.setZoom(W.zoom - 0.1), zoom100: () => W.setZoom(1),
    fitWidth: () => { W.fitWidth(); W.autoFit = true; }, fitPage: () => { W.fitPage(); }
  });
  $('#zoom-slider').addEventListener('input', e => W.setZoom(e.target.value / 100));
  $('#workspace').addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); W.setZoom(W.zoom + (e.deltaY < 0 ? 0.1 : -0.1)); } }, { passive: false });
  window.addEventListener('resize', () => { if (W.autoFit) W.fitWidth(); if (!$('#ruler').classList.contains('hidden')) renderRuler(); });

  /* ---------- Règle avec marges déplaçables ---------- */
  function renderRuler() {
    const g = W.geom(), z = W.view === 'web' ? 1 : W.zoom, ruler = $('#ruler'), ticks = $('#ruler-ticks');
    const cm = 96 / 2.54; let html = '';
    html += '<div class="zone" style="left:0;width:' + (g.ml * z) + 'px"></div><div class="zone" style="right:0;width:' + (g.mr * z) + 'px"></div>';
    for (let i = 0; i * cm / 2 <= g.pw; i++) {
      const x = (i * cm / 2) * z, major = i % 2 === 0;
      html += '<div class="tk' + (major ? ' mj' : '') + '" style="left:' + x + 'px"></div>';
      if (major && i > 0 && x < g.pw * z - 8) html += '<div class="tn" style="left:' + x + 'px">' + (i / 2) + '</div>';
    }
    ticks.innerHTML = html;
    $('#rh-left').style.left = (g.ml * z) + 'px'; $('#rh-right').style.left = ((g.pw - g.mr) * z) + 'px';
    ruler.style.width = (g.pw * z) + 'px';
  }
  W.renderRuler = renderRuler; W.onZoom = () => { if (!$('#ruler').classList.contains('hidden')) renderRuler(); };
  ACT.ruler = () => { $('#ruler').classList.toggle('hidden'); renderRuler(); };
  [['rh-left', 'ml'], ['rh-right', 'mr']].forEach(([id, key]) => {
    const h = document.getElementById(id);
    h.addEventListener('pointerdown', e => {
      e.preventDefault(); h.setPointerCapture(e.pointerId);
      const rect = $('#ruler').getBoundingClientRect(), g = W.geom(), z = W.zoom;
      const move = ev => {
        const x = (ev.clientX - rect.left) / z;
        const v = key === 'ml' ? x : g.pw - x;
        W.page[key] = Math.round(Math.min(Math.max(v, 24), g.pw / 2 - 40));
        W.applyPageCSS(); renderRuler(); W.schedulePaginate();
      };
      const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); W.syncPageControls(); W.docChanged(); W.history.commit(); };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up);
    });
  });

  /* ---------- Vue (page / web / focus) ---------- */
  function setView(v) {
    W.view = v;
    document.body.classList.toggle('web-view', v === 'web'); ed.classList.toggle('web-mode', v === 'web');
    $('#sb-print').classList.toggle('on', v === 'print'); $('#sb-web').classList.toggle('on', v === 'web');
    W.paginate({ sel: W.saveSel() }); if (v === 'print' && W.autoFit) W.fitWidth();
    if (!$('#ruler').classList.contains('hidden')) renderRuler();
  }
  ACT.viewPrint = () => setView('print'); ACT.viewWeb = () => setView('web');
  ACT.focus = () => {
    const on = !document.body.classList.contains('focus-mode');
    document.body.classList.toggle('focus-mode', on); $('#focus-exit').classList.toggle('hidden', !on);
    if (W.autoFit) W.fitWidth();
    if (on) W.focusEditor();
  };

  /* ---------- Mise en page (Conception / Mise en page) ---------- */
  W.syncPageControls = function () {
    const p = W.page, m = String(p.mt === p.mb && p.mt === p.ml && p.ml === p.mr ? p.mt : '');
    const sm = $('#sel-margins'); sm.value = Array.from(sm.options).some(o => o.value === m) ? m : '96';
    $('#sel-orient').value = p.orient; $('#sel-papersize').value = p.size;
    if (!$('#ruler').classList.contains('hidden')) renderRuler();
  };
  function pageChanged() { W.applyPageCSS(); W.paginate(); if (W.autoFit) W.fitWidth(); W.syncPageControls(); W.docChanged({ paginate: false }); W.history.commit(); }
  $('#sel-margins').addEventListener('change', e => { const v = +e.target.value; Object.assign(W.page, { mt: v, mb: v, ml: v, mr: v }); pageChanged(); });
  $('#sel-orient').addEventListener('change', e => { W.page.orient = e.target.value; pageChanged(); });
  $('#sel-papersize').addEventListener('change', e => { W.page.size = e.target.value; pageChanged(); });
  const setTheme = t => () => { W.page.theme = t; W.settings.set('theme', t); pageChanged(); };
  Object.assign(ACT, { themeDark: setTheme('dark'), themeWhite: setTheme('white'), themeSepia: setTheme('sepia') });
  W.pageChanged = pageChanged;

  /* ---------- Fichier (backstage) ---------- */
  function openBackstage(pane) {
    $('#backstage').classList.remove('hidden'); showPane(pane || 'home'); renderTemplates(); renderRecent();
    $('#bs-hello').textContent = 'Bonjour' + (W.settings.get('userName', '') ? ', ' + W.settings.get('userName', '') : '');
  }
  function closeBackstage() { $('#backstage').classList.add('hidden'); W.focusEditor(); }
  function showPane(name) {
    $$('.bs-pane').forEach(p => p.classList.toggle('hidden', p.id !== 'bs-' + name));
    $$('.bs-btn[data-bs]').forEach(b => b.classList.toggle('active', b.dataset.bs === name));
    if (name === 'home') renderRecent();
  }
  W.openBackstage = openBackstage; W.closeBackstage = closeBackstage;
  $$('.bs-btn[data-bs]').forEach(b => b.addEventListener('click', () => showPane(b.dataset.bs)));
  Object.assign(ACT, {
    openBackstage: () => openBackstage('home'), closeBackstage,
    bsNew: () => showPane('home'),
    openFile: async () => { closeBackstage(); await W.openFile(); },
    saveClose: async () => { closeBackstage(); await W.saveDoc(); },
    saveAs: async () => { closeBackstage(); await W.saveDoc({ saveAs: true }); },
    save: () => W.saveDoc(),
    printDoc: () => { closeBackstage(); W.printDoc(); },
    shareClose: () => { closeBackstage(); ACT.share(); },
    aboutClose: () => { closeBackstage(); ACT.about(); },
    openAccount: () => openBackstage('account'),
    toggleAutosave: () => { const v = !W.settings.get('autosave', true); W.settings.set('autosave', v); syncOptions(); W.toast(v ? 'Copie de récupération automatique activée.' : 'Copie automatique désactivée : pensez à enregistrer (Ctrl+S).'); }
  });
  $$('.export-list [data-exp]').forEach(b => b.addEventListener('click', () => { closeBackstage(); W.exportAs(b.dataset.exp); }));

  function renderTemplates() {
    const tpls = [['blank', 'Document vierge', '<div class="pg" style="color:#fff"></div>'],
      ['welcome', 'Bienvenue dans Word', '<div class="pg">Bienvenue dans Word<i></i><i class="s"></i></div>'],
      ['single', 'Espacement unique', '<div class="pg">Aa<i></i><i></i><i class="s"></i></div>'],
      ['cv', 'C.V. moderne', '<div class="pg">PRÉNOM NOM<i></i><i class="s"></i><i class="xs"></i></div>'],
      ['letter', 'Lettre de motivation', '<div class="pg"><i class="s"></i><i></i><i></i><i class="xs"></i></div>'],
      ['invoice', 'Facture', '<div class="pg">FACTURE<i></i><i class="s"></i><i class="xs"></i></div>'],
      ['report', 'Rapport', '<div class="pg">Rapport<i></i><i class="s"></i><i></i></div>'],
      ['minutes', 'Compte rendu de réunion', '<div class="pg">Compte rendu<i></i><i class="s"></i><i></i></div>']];
    $('#tpl-grid').innerHTML = tpls.map(t => '<div class="tpl" data-tpl="' + t[0] + '"><div class="th">' + t[2] + '</div><p>' + t[1] + '</p></div>').join('');
    $$('#tpl-grid .tpl').forEach(el => el.addEventListener('click', async () => { closeBackstage(); await W.newDoc(el.dataset.tpl); }));
  }
  async function renderRecent() {
    await W.saveLibrary();
    const docs = (await W.store.all()).sort((a, b) => b.modified - a.modified);
    const body = $('#recent-body');
    body.innerHTML = docs.map(d => '<tr data-id="' + W.esc(d.id) + '"><td class="nm"><i class="fa-solid fa-file-word"></i><span>' + W.esc(d.title || 'Sans titre') + (d.id === W.doc.id ? ' <small class="muted">(ouvert)</small>' : '') + '</span></td><td class="muted">' + W.esc(d.path ? d.path.replace(/[\\/][^\\/]*$/, '') : 'Bibliothèque locale') + '</td><td class="muted">' + W.esc(W.fmtDate(d.modified)) + '</td><td class="act" data-del="1" title="Supprimer de la bibliothèque"><i class="fa-regular fa-trash-can"></i></td></tr>').join('');
    $('#recent-empty').classList.toggle('hidden', docs.length > 0);
    $$('#recent-body tr').forEach(tr => tr.addEventListener('click', async e => {
      const id = tr.dataset.id;
      if (e.target.closest('[data-del]')) {
        if (id === W.doc.id) { W.toast('Ce document est actuellement ouvert.'); return; }
        if (await W.confirmBox('Supprimer le document', 'Retirer ce document de la bibliothèque locale ? Le fichier enregistré sur le disque, s\'il existe, n\'est pas supprimé.', 'Supprimer', true)) { await W.store.del(id); renderRecent(); }
        return;
      }
      closeBackstage(); await W.openLibraryDoc(id);
    }));
  }
  function syncOptions() {
    const on = W.settings.get('autosave', true);
    $('#autosave-icon').className = 'fa-solid ' + (on ? 'fa-toggle-on' : 'fa-toggle-off'); $('#autosave-toggle').classList.toggle('off', !on);
    $('#opt-autosave').checked = on;
    const name = W.settings.get('userName', ''); $('#opt-username').value = name;
    $('#user-name').textContent = name || 'Utilisateur';
    $('#user-initials').textContent = (name || 'U').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';
    $('#opt-theme').value = W.settings.get('theme', W.look() === 'word' ? 'white' : 'dark'); $('#opt-look').value = W.look();
    $('#opt-spell').checked = ed.spellcheck;
    $('#btn-spell').classList.toggle('active', ed.spellcheck);
  }
  W.syncOptions = syncOptions;
  $('#opt-autosave').addEventListener('change', e => { W.settings.set('autosave', e.target.checked); syncOptions(); });
  $('#opt-username').addEventListener('input', e => { W.settings.set('userName', e.target.value.trim()); syncOptions(); });
  ACT.suiteHome = () => { if (W.api && W.api.openHub) W.api.openHub(); else W.toast('Disponible dans l\'application Windows.'); };
  ACT.toggleLook = () => { const v = W.look() === 'word' ? 'dark' : 'word'; $('#opt-look').value = v; $('#opt-look').dispatchEvent(new Event('change')); };
  $('#opt-look').addEventListener('change', e => {
    const v = e.target.value; W.settings.set('look', v); document.body.classList.toggle('look-word', v === 'word');
    const th = v === 'word' ? 'white' : 'dark'; W.settings.set('theme', th); W.page.theme = th; pageChanged(); syncOptions();
  });
  $('#opt-theme').addEventListener('change', e => { W.settings.set('theme', e.target.value); W.page.theme = e.target.value; pageChanged(); });
  $('#opt-spell').addEventListener('change', e => { setSpell(e.target.checked); });
  function setSpell(on) { ed.spellcheck = on; W.settings.set('spell', on); syncOptions(); }
  ACT.spell = () => setSpell(!ed.spellcheck);
  $('#sel-lang').addEventListener('change', e => {
    const v = e.target.value; ed.lang = v.split('-')[0]; $('#lang-label').textContent = e.target.options[e.target.selectedIndex].text; W.settings.set('lang', v);
    if (W.api && W.api.setSpellLang) W.api.setSpellLang(v);
  });
  W.renderTemplates = renderTemplates;

  /* ---------- Titre ---------- */
  $('#doc-title').addEventListener('change', e => {
    W.doc.title = e.target.value.trim() || 'Document1'; e.target.value = W.doc.title; document.title = W.doc.title + ' - Nocte Word';
    W.docChanged({ history: false, paginate: false });
  });
  $('#doc-title').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); W.focusEditor(false); } });

  /* ---------- Recherche ---------- */
  Object.assign(ACT, {
    find: () => W.find.open(false), replace: () => W.find.open(true),
    findNext: () => W.find.step(1), findPrev: () => W.find.step(-1), findClose: () => W.find.close(),
    replaceOne: () => W.find.replaceOne(), replaceAll: () => W.find.replaceAll(), toggleReplace: () => W.find.toggleReplace()
  });
  $('#global-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); const t = e.target.value; if (t) { W.find.open(false, t); W.find.step(1); } }
  });

  /* ---------- Aide ---------- */
  ACT.shortcuts = () => {
    const rows = [['Ctrl + S', 'Enregistrer'], ['Ctrl + O', 'Ouvrir un fichier'], ['Ctrl + N', 'Nouveau document'], ['Ctrl + P', 'Imprimer'], ['Ctrl + Z / Ctrl + Y', 'Annuler / Rétablir'], ['Ctrl + F', 'Rechercher'], ['Ctrl + H', 'Remplacer'], ['Ctrl + B / I / U', 'Gras / Italique / Souligné'], ['Ctrl + Entrée', 'Saut de page'], ['Ctrl + K', 'Insérer un lien'], ['Ctrl + molette', 'Zoom'], ['Ctrl + clic sur un lien', 'Ouvrir le lien'], ['Double-clic sur une image', 'Taille de l\'image'], ['Échap', 'Fermer la recherche / quitter le mode Focus']];
    return W.dialog({ title: 'Raccourcis clavier', width: 520, body: '<table class="kbd-table">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>' });
  };
  ACT.about = async () => {
    const info = W.api ? await W.api.info() : null;
    return W.dialog({ title: 'À propos', body: '<p><b>Nocte Word</b> — version ' + W.version + '</p><p>Éditeur de documents (apparence Word clair ou sombre) : vraies pages A4, enregistrement réel en .docx, import/export, publipostage, commentaires.</p>' + (info ? '<p class="muted">Electron ' + W.esc(info.electron) + ' · Chromium ' + W.esc(info.chrome) + ' · ' + W.esc(info.platform) + '</p>' : '<p class="muted">Version navigateur</p>') + '<p class="note">Les fichiers .docx sont convertis depuis/vers du HTML : les mises en page très avancées (colonnes, zones de texte flottantes, suivi des modifications) peuvent être simplifiées.</p>' });
  };

  /* ---------- Fenêtre de partage ---------- */
  ACT.share = async () => {
    const box = document.createElement('div');
    const render = (urls) => {
      box.innerHTML =
        '<p>Choisissez comment partager <b>' + W.esc(W.doc.title) + '</b> :</p>' +
        '<div class="export-list" style="gap:8px">' +
        '<button data-s="copy"><i class="fa-solid fa-file-word c-blue"></i><div><b>Enregistrer une copie à envoyer</b><small>Crée un fichier ' + (W.api ? '.docx' : '.wordweb') + ' que vous joignez à un e-mail ou déposez où vous voulez</small></div></button>' +
        (W.api ? '<button data-s="mail"><i class="fa-regular fa-envelope c-yellow"></i><div><b>Préparer un e-mail</b><small>Ouvre votre messagerie (pensez à joindre la copie enregistrée)</small></div></button>' : '') +
        (W.api ? '<button data-s="lan"><i class="fa-solid fa-wifi c-green"></i><div><b>' + (urls ? 'Partage réseau actif' : 'Lien de partage (réseau local)') + '</b><small>Lecture seule en direct, accessible depuis les appareils du même réseau</small></div></button>' : '') +
        '</div>' +
        (urls ? '<div style="margin-top:12px"><p>Lien à communiquer (mis à jour automatiquement à chaque modification) :</p>' + urls.map(u => '<div class="share-url" style="margin-bottom:6px"><input readonly value="' + W.esc(u) + '"><button class="mini" data-copy="' + W.esc(u) + '">Copier</button></div>').join('') + '<p class="note">Toute personne connectée au même réseau et possédant ce lien peut lire le document. Arrêtez le partage dès que vous n\'en avez plus besoin.</p><button class="mini danger" data-s="stop" style="margin-top:8px;background:#b91c1c;border-color:#b91c1c">Arrêter le partage</button></div>' : '<p class="note">Il ne s\'agit pas d\'un partage cloud ni d\'une co-édition en temps réel : le lien réseau est en lecture seule.</p>');
      box.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => {
        const k = b.dataset.s;
        if (k === 'copy') { await W.exportAs(W.api ? 'docx' : 'wordweb'); }
        else if (k === 'mail') { W.api.openExternal('mailto:?subject=' + encodeURIComponent(W.doc.title) + '&body=' + encodeURIComponent('Bonjour,\n\nVous trouverez ci-joint le document « ' + W.doc.title + ' ».\n')); }
        else if (k === 'lan') { try { const r = await W.shareStart(); if (r && r.urls && r.urls.length) render(r.urls); else W.toast('Impossible de démarrer le partage réseau.', 'err'); } catch (e) { W.toast('Partage impossible : ' + e.message, 'err'); } }
        else if (k === 'stop') { await W.shareStop(); render(null); W.toast('Partage arrêté.'); }
      });
      box.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy).then(() => W.toast('Lien copié.', 'ok'), () => W.toast('Copie impossible, sélectionnez le lien manuellement.', 'err')); });
    };
    render(W.sharing && W.api ? await W.api.shareUrls() : null);
    await W.dialog({ title: 'Partager', width: 520, body: box, buttons: [{ label: 'Fermer', primary: true, value: true }] });
  };

  /* ---------- Statistiques ---------- */
  ACT.stats = () => {
    const text = (ed.innerText || '').replace(/​/g, ''), t = text.trim();
    const words = t ? t.split(/\s+/).length : 0, chars = text.replace(/\n$/, '').length, noSp = text.replace(/\s/g, '').length;
    const paras = W.$$('p,h1,h2,h3,h4,h5,h6,li', ed).filter(p => p.textContent.trim()).length;
    const mins = Math.max(1, Math.round(words / 200));
    return W.dialog({ title: 'Statistiques', width: 380, body: '<div class="stat-grid"><span>Pages</span><b>' + W.pageCount + '</b><span>Mots</span><b>' + words + '</b><span>Caractères (espaces compris)</span><b>' + chars + '</b><span>Caractères (sans espaces)</span><b>' + noSp + '</b><span>Paragraphes</span><b>' + paras + '</b><span>Temps de lecture estimé</span><b>' + mins + ' min</b></div>' });
  };
})();
