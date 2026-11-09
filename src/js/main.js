'use strict';
/* ===== Démarrage, événements de l'éditeur, raccourcis, glisser-déposer ===== */
(function () {
  const $ = W.$, $$ = W.$$, ed = W.editor, ACT = W.ACT;

  if (!ACT.closeBackstage) ACT.closeBackstage = () => W.closeBackstage();

  /* ---------- Saisie ---------- */
  ed.addEventListener('compositionstart', () => { W.composing = true; });
  ed.addEventListener('compositionend', () => { W.composing = false; W.docChanged(); });
  ed.addEventListener('input', e => {
    if (W.paginating) return;
    if (W.composing || e.isComposing) { W.docChanged({ paginate: false }); return; }
    if (W.renumberFootnotes && ed.querySelector('sup.fn, .footnotes')) W.renumberFootnotes();
    W.docChanged();
  });
  // Historique maison : on neutralise celui du navigateur
  ed.addEventListener('beforeinput', e => {
    if (e.inputType === 'historyUndo') { e.preventDefault(); W.history.undo(); }
    else if (e.inputType === 'historyRedo') { e.preventDefault(); W.history.redo(); }
    else if (!W.composing && /^(delete|insertParagraph|insertFromPaste|insertFromDrop|formatBold|formatItalic)/.test(e.inputType)) W.history.flush();
  });

  /* ---------- Presse-papiers ---------- */
  ed.addEventListener('paste', async e => {
    e.preventDefault(); W.history.flush();
    const cd = e.clipboardData; if (!cd) return;
    const files = Array.from(cd.files || []).filter(f => /^image\//.test(f.type));
    const html = cd.getData('text/html'), text = cd.getData('text/plain');
    if (files.length && !html) { W.insertImages(files); return; }
    W.pasteContent(html, text);
  });
  ed.addEventListener('copy', e => {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed || !e.clipboardData) return;
    const d = document.createElement('div'); d.appendChild(s.getRangeAt(0).cloneContents());
    $$('[data-pg]', d).forEach(x => x.removeAttribute('data-pg'));
    e.clipboardData.setData('text/html', '<!--wd-->' + d.innerHTML);
    e.clipboardData.setData('text/plain', s.toString());
    e.preventDefault();
  });
  ed.addEventListener('cut', e => {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed || !e.clipboardData) return;
    W.history.flush();
    const d = document.createElement('div'); d.appendChild(s.getRangeAt(0).cloneContents());
    e.clipboardData.setData('text/html', '<!--wd-->' + d.innerHTML);
    e.clipboardData.setData('text/plain', s.toString());
    e.preventDefault(); document.execCommand('delete');
  });

  /* ---------- Glisser-déposer ---------- */
  const OPENABLE = /\.(docx|wordweb|html?|txt|md|csv)$/i;
  ['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); document.body.classList.add('dragging'); }
  }));
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
  document.addEventListener('drop', async e => {
    document.body.classList.remove('dragging');
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if (!files.length) return;
    e.preventDefault();
    const imgs = files.filter(f => /^image\//.test(f.type));
    if (imgs.length) { W.insertImages(imgs); return; }
    const f = files.find(x => OPENABLE.test(x.name)); if (!f) { W.toast('Format de fichier non pris en charge.', 'err'); return; }
    const path = (W.api && W.api.pathForFile) ? W.api.pathForFile(f) : null;
    await W.importFile({ name: f.name, ext: (f.name.match(/\.([^.]+)$/) || [])[1], bytes: await f.arrayBuffer(), path: path || null });
  });

  /* ---------- Clavier ---------- */
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if (document.body.classList.contains('focus-mode')) { ACT.focus(); return; }
      if (!$('#backstage').classList.contains('hidden')) { W.closeBackstage(); return; }
    }
    if (!ctrl || e.altKey) return;
    const inModal = !$('#modal-backdrop').classList.contains('hidden');
    if (inModal) return;
    let fn = null;
    if (k === 's') fn = e.shiftKey ? () => W.saveDoc({ saveAs: true }) : () => W.saveDoc();
    else if (k === 'o') fn = () => W.openFile();
    else if (k === 'n') fn = () => W.newDoc('blank');
    else if (k === 'p') { if (e.shiftKey) return; fn = () => W.printDoc(); }
    else if (k === 'f') fn = () => W.find.open(false);
    else if (k === 'h') fn = () => W.find.open(true);
    else if (k === 'z' && !e.shiftKey) fn = () => W.history.undo();
    else if (k === 'y' || (k === 'z' && e.shiftKey)) fn = () => W.history.redo();
    else if (k === 'k') fn = () => ACT.link();
    else if (k === 'enter') fn = () => ACT.pageBreak();
    else if (k === '=' || k === '+') fn = () => W.setZoom(Math.min(4, W.zoom + 0.1));
    else if (k === '-') fn = () => W.setZoom(Math.max(0.25, W.zoom - 0.1));
    else if (k === '0') fn = () => W.fitWidth();
    if (fn) { e.preventDefault(); fn(); }
  }, true);

  // Tabulation : insère une tabulation / change de cellule / indente une liste
  ed.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || e.ctrlKey || e.altKey) return;
    const s = getSelection(); if (!s.rangeCount) return;
    const el = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
    if (!el) return; e.preventDefault();
    const li = el.closest('li'), cell = el.closest('td,th');
    if (li) { W.exec(e.shiftKey ? 'outdent' : 'indent'); return; }
    if (cell) {
      const cells = Array.from(cell.closest('table').querySelectorAll('td,th')), i = cells.indexOf(cell) + (e.shiftKey ? -1 : 1);
      if (i >= cells.length) { ACT.rowBelow(); const c2 = Array.from(cell.closest('table').querySelectorAll('td,th'))[i]; if (c2) { const r = document.createRange(); r.selectNodeContents(c2); r.collapse(true); s.removeAllRanges(); s.addRange(r); } return; }
      if (i >= 0) { const r = document.createRange(); r.selectNodeContents(cells[i]); r.collapse(true); s.removeAllRanges(); s.addRange(r); }
      return;
    }
    if (!e.shiftKey) W.exec('insertText', '    ');
  });

  /* ---------- Objets & liens ---------- */
  ed.addEventListener('dblclick', e => {
    const t = e.target.closest && e.target.closest('img, .shape'); if (t) { e.preventDefault(); W.editObject(t); }
  });
  ed.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const h = a.getAttribute('href');
      if (h.startsWith('#')) return;
      if (W.api && W.api.openExternal) W.api.openExternal(h); else window.open(h, '_blank', 'noopener');
    } else W.toast('Ctrl + clic pour ouvrir le lien.');
  });
  // On ne peut pas modifier les blocs non éditables : une touche Suppr les retire proprement
  ed.addEventListener('keydown', e => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return;
    const r = s.getRangeAt(0); let n = r.startContainer, off = r.startOffset, target = null;
    if (e.key === 'Backspace') {
      if (n.nodeType === 3 && off > 0) return;
      let prev = n.nodeType === 3 ? n.previousSibling : n.childNodes[off - 1];
      if (!prev && n.nodeType === 1 && off === 0) prev = n.previousSibling;
      if (prev && prev.nodeType === 1 && prev.classList && (prev.classList.contains('pb') || prev.classList.contains('toc'))) target = prev;
    } else {
      let next = n.nodeType === 3 ? (off >= n.length ? n.nextSibling : null) : n.childNodes[off];
      if (next && next.nodeType === 1 && next.classList && (next.classList.contains('pb') || next.classList.contains('toc'))) target = next;
    }
    if (target) { e.preventDefault(); W.history.flush(); target.remove(); W.docChanged(); W.history.commit(); }
  });

  /* ---------- Fenêtre ---------- */
  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (W.autoFit) W.fitWidth(); else W.updateSizer(); }, 120); });
  window.addEventListener('beforeunload', () => { W.history.flush(); if (W.settings.get('autosave', true)) W.saveLibrary(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && W.settings.get('autosave', true)) W.saveLibrary(); });

  // Fermeture de l'application : proposer d'enregistrer
  if (W.api && W.api.onBeforeClose) {
    W.api.onBeforeClose(async () => {
      W.history.flush();
      if (W.settings.get('autosave', true)) { await W.saveLibrary(); W.api.confirmClose(true); return; }
      if (!W.doc.dirty || W.isBlank()) { W.api.confirmClose(true); return; }
      const r = await W.dialog({ title: 'Nocte Word', body: '<p>Enregistrer les modifications de « ' + W.esc(W.doc.title) + ' » avant de quitter ?</p>', buttons: [{ label: 'Annuler', value: 'cancel' }, { label: 'Ne pas enregistrer', value: 'no' }, { label: 'Enregistrer', primary: true, value: 'yes' }] });
      if (r === 'yes') { const ok = await W.saveDoc(); W.api.confirmClose(ok !== false); }
      else W.api.confirmClose(r === 'no');
    });
  }
  // Ouverture d'un fichier depuis l'explorateur / la ligne de commande
  if (W.api && W.api.onOpenFile) W.api.onOpenFile(f => { W.importFile(f); });

  /* ---------- Démarrage ---------- */
  async function boot() {
    W.syncOptions && W.syncOptions();
    let started = false;
    try {
      if (W.api && W.api.getStartupFile) {
        const f = await W.api.getStartupFile();
        if (f) { started = await W.importFile(f); }
      }
      if (!started) {
        const tp = W.settings.get('template', null);
        if (tp && /^word:/.test(tp)) { W.settings.set('template', null); const t = (window.TPL && TPL.word[tp.slice(5)]) || W.templates[tp.slice(5)]; if (t) { W.loadDoc({ title: t.title, html: t.html, page: W.defaultPage() }); W.doc.dirty = false; started = true; } }
      }
      if (!started) {
        const id = W.settings.get('lastDoc', null), rec = id ? await W.store.get(id) : null;
        if (rec) { W.loadDoc(rec); started = true; }
      }
    } catch (e) { console.error(e); }
    if (!started) { W.loadDoc({ title: W.templates.blank.title, html: W.templates.blank.html, page: W.defaultPage() }); W.doc.dirty = false; W.setBadge('saved'); }
    W.history.reset();
    W.updateCounters();
    document.body.classList.add('ready');
    if (W.settings.get('firstRun', true)) { W.settings.set('firstRun', false); if (W.isBlank()) W.openBackstage && W.openBackstage('home'); }
    else ed.focus({ preventScroll: true });
  }
  boot();
})();
