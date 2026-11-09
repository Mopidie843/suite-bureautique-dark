'use strict';
/* ===== Documents : bibliothèque, ouverture, enregistrement réel, import/export DOCX, PDF, partage ===== */
(function () {
  const ed = W.editor, $ = W.$;
  const badge = $('#save-badge');

  W.templates = {
    blank: { title: 'Document1', html: '<p><br></p>' },
    single: { title: 'Document1', html: '<p style="line-height:1"><br></p>' },
    welcome: { title: 'Bienvenue', html:
      '<h1>Bienvenue dans Nocte Word</h1><p><i>Guide de démarrage rapide</i></p><hr>' +
      '<p>Ce document est un modèle pour explorer les fonctionnalités. Vous pouvez modifier ce texte, insérer des tableaux, des images, changer l\'orientation ou le thème de la page depuis les onglets du ruban.</p>' +
      '<h2>Ce que vous pouvez faire</h2><ul><li><b>Mettre en forme</b> : police, taille, couleurs, listes, alignement, interligne.</li><li><b>Insérer</b> : tableaux, images depuis votre ordinateur, liens, sauts de page, table des matières.</li><li><b>Enregistrer</b> : vrais fichiers Word (.docx), PDF, HTML ou texte.</li><li><b>Publipostage</b> : fusionner un fichier CSV avec une lettre type.</li></ul>' +
      '<p>Commencez à saisir votre texte directement sur la page.</p>' },
    cv: { title: 'CV', html:
      '<h1>PRÉNOM NOM</h1><p><b>Intitulé du poste recherché</b></p><p>Adresse · Téléphone · Courriel</p><hr>' +
      '<h3>PROFIL PROFESSIONNEL</h3><p>Présentez en deux ou trois phrases votre expérience, vos points forts et votre projet.</p>' +
      '<h3>EXPÉRIENCE</h3><p><b>Poste</b> — Entreprise, Ville <i>(2022 – 2025)</i></p><ul><li>Réalisation ou responsabilité principale</li><li>Résultat chiffré ou compétence mise en œuvre</li></ul>' +
      '<h3>FORMATION</h3><p><b>Diplôme</b> — Établissement <i>(2019 – 2022)</i></p><h3>COMPÉTENCES</h3><p>Compétence 1 · Compétence 2 · Compétence 3</p>' },
    letter: { title: 'Lettre', html: () =>
      '<p>Prénom Nom<br>Adresse<br>Code postal Ville</p><p style="text-align:right">' + W.esc(W.today()) + '</p>' +
      '<p><b>Objet : Candidature spontanée</b></p><p>Madame, Monsieur,</p>' +
      '<p>C\'est avec un grand intérêt que je vous adresse ma candidature pour rejoindre votre équipe…</p><p>Je reste à votre disposition pour un entretien et vous prie d\'agréer, Madame, Monsieur, l\'expression de mes salutations distinguées.</p><p>Prénom Nom</p>' }
  };

  /* ---------- État du document courant ---------- */
  W.doc = { id: W.uid(), title: 'Document1', path: null, fmt: 'docx', comments: [], created: Date.now(), dirty: false };

  function setBadge(kind) {
    const m = { saved: ['Enregistré', 'saved'], auto: ['Copie auto enregistrée', ''], pending: ['Modifié…', 'dirty'], dirty: ['Modifié, non enregistré', 'dirty'] }[kind] || ['', ''];
    badge.textContent = m[0]; badge.className = 'badge ' + m[1];
  }
  W.setBadge = setBadge;

  W.docRecord = function () {
    return { id: W.doc.id, title: W.doc.title, path: W.doc.path, fmt: W.doc.fmt, created: W.doc.created, dirty: W.doc.dirty,
      page: Object.assign({}, W.page), comments: W.doc.comments, html: W.cleanHTML(), modified: Date.now() };
  };
  W.isBlank = () => W.cleanHTML().replace(/<(p|br)[^>]*>|<\/p>|\s/g, '') === '' && W.doc.title === 'Document1';

  W.saveLibrary = async function () {
    if (W.isBlank()) return false;
    try { await W.store.put(W.docRecord()); W.settings.set('lastDoc', W.doc.id); return true; } catch (e) { return false; }
  };
  const autosaveSoon = W.debounce(async () => {
    if (!W.settings.get('autosave', true)) return;
    if (await W.saveLibrary() && W.doc.dirty) setBadge('auto');
  }, 1500);

  W.docChanged = function (o) {
    o = o || {};
    if (o.history !== false) W.history.touch();
    if (!o.noDirty) {
      W.doc.dirty = true;
      if (W.settings.get('autosave', true)) { setBadge('pending'); autosaveSoon(); } else setBadge('dirty');
    }
    if (o.paginate !== false) W.schedulePaginate();
    if (W.updateCounters) W.updateCounters();
    if (W.find.isOpen()) W.find.refresh();
    if (W.sharing) shareSoon();
  };

  /* ---------- Charger un document ---------- */
  W.loadDoc = function (rec) {
    if (W.mm && W.mm.preview) W.mmSetPreview(false);
    W.doc = { id: rec.id || W.uid(), title: rec.title || 'Document1', path: rec.path || null, fmt: rec.fmt || 'docx', comments: Array.isArray(rec.comments) ? rec.comments : [], created: rec.created || Date.now(), dirty: !!rec.dirty };
    W.page = Object.assign(W.defaultPage(), rec.page || {});
    $('#doc-title').value = W.doc.title; document.title = W.doc.title + ' - Nocte Word';
    W.applyPageCSS(); if (W.syncPageControls) W.syncPageControls();
    W.setHTML(typeof rec.html === 'function' ? rec.html() : rec.html);
    W.history.reset();
    W.docChanged({ history: false, noDirty: true, paginate: false });
    if (W.renderComments) W.renderComments();
    setBadge(W.doc.dirty ? 'dirty' : 'saved');
    if (W.autoFit) W.fitWidth();
    W.settings.set('lastDoc', W.doc.id);
    ed.scrollTop = 0; $('#workspace').scrollTop = 0;
  };
  W.newDoc = async function (tplKey) {
    await W.saveLibrary();
    const t = W.templates[tplKey || 'blank'] || (window.TPL && TPL.word[tplKey]) || W.templates.blank;
    W.loadDoc({ title: t.title, html: t.html, page: W.defaultPage() });
    W.doc.dirty = false; setBadge('saved');
    ed.focus();
  };
  W.openLibraryDoc = async function (id) {
    const rec = await W.store.get(id);
    if (!rec) { W.toast('Document introuvable.', 'err'); return; }
    if (W.doc.id !== id) await W.saveLibrary();
    W.loadDoc(rec);
  };

  /* ---------- Importation ---------- */
  const baseName = n => String(n).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  W.importFile = async function (f) {
    const ext = (f.ext || (f.name.match(/\.([^.]+)$/) || [])[1] || '').toLowerCase().replace('.', '');
    let html, title = baseName(f.name), page = null, comments = [];
    try {
      if (ext === 'docx') {
        if (!window.mammoth) throw new Error('Module DOCX indisponible');
        const ab = f.bytes instanceof ArrayBuffer ? f.bytes : f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength);
        const r = await mammoth.convertToHtml({ arrayBuffer: ab }, {
          convertImage: mammoth.images.imgElement(img => img.read('base64').then(b => ({ src: 'data:' + img.contentType + ';base64,' + b }))),
          styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Titre'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh", "p[style-name='Sous-titre'] => h2:fresh", "br[type='page'] => hr.pb", 'u => u']
        });
        html = W.sanitize(r.value);
        { const t = document.createElement('div'); t.innerHTML = html;
          t.querySelectorAll('hr.pb').forEach(h => { const d = document.createElement('div'); d.className = 'pb'; d.setAttribute('contenteditable', 'false'); h.replaceWith(d); });
          t.querySelectorAll('p').forEach(p => { if (!p.childNodes.length) p.remove(); });
          html = t.innerHTML; }
        if (r.messages.some(m => m.type === 'warning')) W.toast('Certains éléments avancés du fichier Word ont été simplifiés.');
      } else if (ext === 'wordweb') {
        const j = JSON.parse(typeof f.text === 'string' ? f.text : new TextDecoder().decode(f.bytes));
        if (j.format !== 'wordweb' || typeof j.html !== 'string') throw new Error('Fichier .wordweb invalide');
        html = W.sanitize(j.html, { keepColors: true }); title = j.title || title; page = j.page; comments = Array.isArray(j.comments) ? j.comments.map(c => ({ id: String(c.id), author: String(c.author || ''), text: String(c.text || ''), date: +c.date || Date.now(), resolved: !!c.resolved, quote: String(c.quote || '') })) : [];
      } else if (ext === 'html' || ext === 'htm') {
        html = W.sanitize(typeof f.text === 'string' ? f.text : new TextDecoder().decode(f.bytes));
      } else if (ext === 'txt' || ext === 'md' || ext === 'csv') {
        html = W.textToHTML(typeof f.text === 'string' ? f.text : new TextDecoder().decode(f.bytes));
      } else throw new Error('Format .' + ext + ' non pris en charge');
    } catch (e) { W.toast('Impossible d\'ouvrir « ' + f.name + ' » : ' + e.message, 'err'); return false; }
    await W.saveLibrary();
    W.loadDoc({ title, html, path: f.path || null, fmt: ['docx', 'wordweb', 'html', 'txt'].includes(ext) ? ext : 'docx', page: Object.assign(W.defaultPage(), page || {}), comments });
    W.doc.dirty = false; setBadge('saved');
    if (!f.path && ext !== 'wordweb') W.doc.path = null;
    W.toast('« ' + title + ' » ouvert.', 'ok');
    return true;
  };
  W.openFile = async function () {
    if (W.api) {
      const files = await W.api.openDialog();
      if (files && files[0]) return W.importFile(files[0]);
    } else $('#file-input').click();
  };
  $('#file-input').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const ext = (f.name.match(/\.([^.]+)$/) || [])[1] || '';
    W.importFile({ name: f.name, ext, bytes: await f.arrayBuffer() });
  });

  /* ---------- Export : fabrication du contenu ---------- */
  const unwrap = el => { while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el); el.remove(); };
  W.exportHTML = function () {
    const live = Array.from(ed.querySelectorAll('img'));
    const d = document.createElement('div'); d.innerHTML = W.cleanHTML();
    const g = W.geom(), maxW = g.pw - g.ml - g.mr;
    Array.from(d.querySelectorAll('img')).forEach((img, i) => {
      const l = live[i]; let w = l && l.offsetWidth ? l.offsetWidth : (parseInt(img.getAttribute('width')) || 300), h = l && l.offsetHeight ? l.offsetHeight : (parseInt(img.getAttribute('height')) || 200);
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      img.setAttribute('width', w); img.setAttribute('height', h); img.removeAttribute('style');
    });
    d.querySelectorAll('.pb').forEach(p => { const x = document.createElement('div'); x.className = 'page-break'; x.setAttribute('style', 'page-break-after: always;'); p.replaceWith(x); });
    d.querySelectorAll('.cmt').forEach(unwrap);
    d.querySelectorAll('.mf').forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
    d.querySelectorAll('.toc').forEach(t => {
      const title = t.querySelector('.toc-title'); const box = document.createElement('div');
      if (title) { const h = document.createElement('h2'); h.textContent = title.textContent; box.appendChild(h); }
      t.querySelectorAll('.toc-line').forEach(l => { const p = document.createElement('p'); p.textContent = (l.querySelector('.t') || l).textContent + ' ........ ' + (l.querySelector('.n') ? l.querySelector('.n').textContent : ''); box.appendChild(p); });
      t.replaceWith(...Array.from(box.childNodes));
    });
    d.querySelectorAll('del.rev').forEach(x => x.remove());
    d.querySelectorAll('ins.rev').forEach(x => x.replaceWith(...Array.from(x.childNodes)));
    d.querySelectorAll('.shape').forEach(s => s.remove());
    d.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
    d.querySelectorAll('[data-fn],[data-field],[data-cid],[class]').forEach(e => { if (!['page-break'].includes(e.className)) { e.removeAttribute('class'); e.removeAttribute('data-fn'); e.removeAttribute('data-field'); e.removeAttribute('data-cid'); } });
    // html-to-docx perd les espaces isolés entre deux éléments en ligne : on les rattache à l'élément précédent
    const walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT), ws = [];
    while (walker.nextNode()) { const t = walker.currentNode; if (/^\s+$/.test(t.nodeValue) && t.previousSibling && t.previousSibling.nodeType === 1 && /^(B|I|U|S|SPAN|STRONG|EM|A|FONT|SUB|SUP)$/.test(t.previousSibling.tagName)) ws.push(t); }
    ws.forEach(t => { const prev = t.previousSibling; const lw = document.createTreeWalker(prev, NodeFilter.SHOW_TEXT); let last = null; while (lw.nextNode()) last = lw.currentNode; if (last) { last.nodeValue += ' '; t.remove(); } });
    return d.innerHTML.replace(/​/g, '');
  };
  W.docxOptions = function () {
    const P = W.PAGES[W.page.size] || W.PAGES.A4, p = W.page, land = p.orient === 'landscape';
    return {
      orientation: land ? 'landscape' : 'portrait',
      pageSize: { width: P.tw[0], height: P.tw[1] },
      margins: { top: Math.round(p.mt * 15), right: Math.round(p.mr * 15), bottom: Math.round(p.mb * 15), left: Math.round(p.ml * 15), header: 720, footer: 720, gutter: 0 },
      title: W.doc.title, creator: W.settings.get('userName', 'Utilisateur'), font: W.settings.get('defFont', '') || 'Calibri', fontSize: Math.round((W.settings.get('defSize', 0) || 11) * 2),
      header: !!p.header, footer: !!(p.footer || p.numbers !== 'none'), pageNumber: p.numbers !== 'none'
    };
  };
  const para = (t, al) => '<p style="text-align:' + al + '">' + W.esc(t) + '</p>';
  function standaloneHTML() {
    const d = document.createElement('div'); d.innerHTML = W.exportHTML();
    d.querySelectorAll('.page-break').forEach(x => { x.replaceWith(document.createElement('hr')); });
    const css = 'body{font-family:Calibri,Carlito,"Segoe UI",Arial,sans-serif;font-size:11pt;line-height:1.5;max-width:820px;margin:32px auto;padding:0 24px;color:#111}table{border-collapse:collapse}td,th{border:1px solid #888;padding:4px 8px}img{max-width:100%;height:auto}blockquote{border-left:3px solid #4da3ff;margin-left:0;padding-left:14px;font-style:italic}';
    return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + W.esc(W.doc.title) + '</title><style>' + css + '</style></head><body>' + d.innerHTML + '</body></html>';
  }
  W.standaloneHTML = standaloneHTML;

  async function payloadFor(ext) {
    if (ext === 'docx') {
      const p = W.page;
      return { kind: 'docx', html: W.exportHTML(), headerHtml: p.header ? para(p.header, 'center') : '', footerHtml: para(p.footer || '', p.numbers === 'left' ? 'right' : 'left'), opts: W.docxOptions() };
    }
    if (ext === 'wordweb') return { kind: 'text', text: JSON.stringify({ format: 'wordweb', version: 1, title: W.doc.title, page: W.page, comments: W.doc.comments, html: W.cleanHTML(), saved: new Date().toISOString() }) };
    if (ext === 'html') return { kind: 'text', text: standaloneHTML() };
    if (ext === 'txt') return { kind: 'text', text: W.htmlToText(W.exportHTML()) };
    throw new Error('Format inconnu : ' + ext);
  }
  const FILTERS = {
    docx: [{ name: 'Document Word', extensions: ['docx'] }],
    wordweb: [{ name: 'Document Word Dark (.wordweb)', extensions: ['wordweb'] }],
    html: [{ name: 'Page web', extensions: ['html'] }],
    txt: [{ name: 'Texte brut', extensions: ['txt'] }],
    pdf: [{ name: 'Document PDF', extensions: ['pdf'] }]
  };
  const SAVE_AS_FILTERS = [].concat(FILTERS.docx, FILTERS.wordweb, FILTERS.html, FILTERS.txt);
  const safeName = t => (t || 'Document').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Document';
  function download(blobOrText, name, type) {
    const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type: type || 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- Enregistrer ---------- */
  W.saveDoc = async function (opt) {
    opt = opt || {};
    W.history.flush();
    if (W.mm && W.mm.preview) W.mmSetPreview(false);
    let path = opt.saveAs ? null : W.doc.path, ext = W.doc.fmt || 'docx';
    if (!W.api) {
      // navigateur : copie dans la bibliothèque + téléchargement du format natif
      await W.saveLibrary();
      const pl = await payloadFor('wordweb'); download(pl.text, safeName(W.doc.title) + '.wordweb', 'application/json');
      W.doc.dirty = false; setBadge('saved'); W.toast('Document téléchargé (.wordweb) et conservé dans la bibliothèque.', 'ok'); return true;
    }
    if (!path) {
      const r = await W.api.pickSavePath({ defaultName: safeName(W.doc.title) + '.' + ext, filters: SAVE_AS_FILTERS });
      if (!r || r.canceled) return false;
      path = r.path;
    }
    ext = (path.match(/\.([^.\\/]+)$/) || [, 'docx'])[1].toLowerCase();
    if (!FILTERS[ext]) { ext = 'docx'; path += '.docx'; }
    try {
      const res = await W.api.writeFile({ path, payload: await payloadFor(ext) });
      if (!res || !res.ok) throw new Error((res && res.error) || 'écriture impossible');
      W.doc.path = path; W.doc.fmt = ext; W.doc.dirty = false;
      if (opt.saveAs || W.doc.title === 'Document1') { W.doc.title = baseName(path); $('#doc-title').value = W.doc.title; document.title = W.doc.title + ' - Nocte Word'; }
      await W.saveLibrary(); setBadge('saved');
      W.toast('Enregistré : ' + path.replace(/^.*[\\/]/, ''), 'ok'); return true;
    } catch (e) { W.toast('Échec de l\'enregistrement : ' + e.message, 'err'); return false; }
  };

  /* ---------- Exporter (sans changer le fichier courant) ---------- */
  W.exportAs = async function (fmt) {
    W.history.flush();
    if (W.mm && W.mm.preview) W.mmSetPreview(false);
    const name = safeName(W.doc.title) + '.' + fmt;
    if (!W.api) {
      if (fmt === 'docx') { W.toast('L\'export DOCX nécessite l\'application Windows. Utilisez le format .wordweb ou HTML.', 'err'); return; }
      if (fmt === 'pdf') { W.printDoc(); return; }
      const pl = await payloadFor(fmt); download(pl.text, name, fmt === 'html' ? 'text/html' : 'text/plain'); return;
    }
    const r = await W.api.pickSavePath({ defaultName: name, filters: FILTERS[fmt] });
    if (!r || r.canceled) return;
    try {
      let res;
      if (fmt === 'pdf') { W.fillPrintRoot(); res = await W.api.writePdf({ path: r.path }); W.clearPrintRoot(); }
      else res = await W.api.writeFile({ path: r.path, payload: await payloadFor(fmt) });
      if (!res || !res.ok) throw new Error((res && res.error) || 'écriture impossible');
      W.toast('Exporté : ' + r.path.replace(/^.*[\\/]/, ''), 'ok');
    } catch (e) { W.clearPrintRoot(); W.toast('Échec de l\'export : ' + e.message, 'err'); }
  };

  /* ---------- Impression ---------- */
  W.fillPrintRoot = function () {
    const d = document.createElement('div'); d.innerHTML = W.cleanHTML();
    d.querySelectorAll('.cmt').forEach(unwrap);
    d.querySelectorAll('.mf').forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
    d.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
    if (W.page.watermark) { const w = document.createElement('div'); w.className = 'pr-wm'; w.textContent = W.page.watermark; d.appendChild(w); }
    $('#print-root').innerHTML = d.innerHTML;
  };
  W.clearPrintRoot = function () { $('#print-root').innerHTML = ''; };
  W.printDoc = function () { W.history.flush(); setTimeout(() => window.print(), 50); };
  window.addEventListener('beforeprint', () => W.fillPrintRoot());
  window.addEventListener('afterprint', () => W.clearPrintRoot());

  /* ---------- Partage sur le réseau local (lecture seule, mise à jour en direct) ---------- */
  W.sharing = false;
  const shareSoon = W.debounce(() => { if (W.sharing && W.api) W.api.shareUpdate({ title: W.doc.title, html: standaloneHTML() }); }, 1200);
  W.shareStart = async function () {
    const r = await W.api.shareStart({ title: W.doc.title, html: standaloneHTML() });
    W.sharing = !!(r && r.urls && r.urls.length); return r;
  };
  W.shareStop = async function () { if (W.api) await W.api.shareStop(); W.sharing = false; };
  W.safeName = safeName; W.download = download; W.baseName = baseName;
})();
