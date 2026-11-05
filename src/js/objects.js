'use strict';
/* ===== Images (barre flottante, redimensionnement), style de tableau, suivi des modifications ===== */
(function () {
  const $ = W.$, $$ = W.$$, ed = W.editor, ACT = W.ACT;
  const done = () => { W.docChanged(); W.history.commit(); };
  const blockOf = n => { let e = n.nodeType === 1 ? n : n.parentElement; while (e && e !== ed && !/^(P|DIV|H[1-6]|LI|TD|TH|BLOCKQUOTE)$/.test(e.tagName)) e = e.parentElement; return e; };

  /* ---------- Image sélectionnée : barre flottante + poignée ---------- */
  const bar = document.createElement('div'); bar.id = 'obj-bar'; bar.className = 'hidden';
  bar.innerHTML = '<button data-o="l" title="Aligner à gauche"><i class="fa-solid fa-align-left"></i></button><button data-o="c" title="Centrer"><i class="fa-solid fa-align-center"></i></button><button data-o="r" title="Aligner à droite"><i class="fa-solid fa-align-right"></i></button><span class="sp"></span>' +
    '<button data-o="25" title="25 % de la largeur">25 %</button><button data-o="50" title="50 %">50 %</button><button data-o="100" title="Pleine largeur">100 %</button><span class="sp"></span>' +
    '<button data-o="cap" title="Ajouter une légende"><i class="fa-regular fa-rectangle-list"></i></button><button data-o="fmt" title="Format…"><i class="fa-solid fa-sliders"></i></button><button data-o="del" title="Supprimer"><i class="fa-solid fa-trash"></i></button>';
  const handle = document.createElement('div'); handle.id = 'obj-handle'; handle.className = 'hidden';
  document.body.append(bar, handle);
  let img = null;
  function place() {
    if (!img || !document.contains(img)) { hide(); return; }
    const r = img.getBoundingClientRect(); bar.classList.remove('hidden'); handle.classList.remove('hidden');
    bar.style.left = Math.max(6, Math.min(innerWidth - bar.offsetWidth - 6, r.left)) + 'px'; bar.style.top = Math.max(6, r.top - bar.offsetHeight - 6) + 'px';
    handle.style.left = (r.right - 7) + 'px'; handle.style.top = (r.bottom - 7) + 'px';
  }
  function hide() { if (img) img.classList.remove('sel'); img = null; bar.classList.add('hidden'); handle.classList.add('hidden'); }
  function select(i) { if (img && img !== i) img.classList.remove('sel'); img = i; img.classList.add('sel'); place(); }
  ed.addEventListener('click', e => { const i = e.target.closest && e.target.closest('img'); if (i) select(i); else hide(); });
  document.addEventListener('mousedown', e => { if (img && !e.target.closest('#obj-bar,#obj-handle') && !(e.target.closest && e.target.closest('#editor img'))) hide(); }, true);
  ed.addEventListener('keydown', () => { if (img) hide(); });
  const reposition = () => { if (img) place(); };
  window.addEventListener('resize', reposition); document.addEventListener('scroll', reposition, true);
  const origDone = W.docChanged; // repositionner après pagination
  W.docChanged = function () { const r = origDone.apply(this, arguments); setTimeout(reposition, 30); return r; };

  function align(i, how) {
    let b = blockOf(i); if (!b || b === ed) { const p = document.createElement('p'); i.replaceWith(p); p.appendChild(i); b = p; }
    b.style.textAlign = how; done();
  }
  function setWidthPct(i, pct) { const g = W.geom(), w = Math.round((g.pw - g.ml - g.mr) * pct / 100); i.style.width = w + 'px'; i.style.height = 'auto'; i.style.maxWidth = '100%'; i.removeAttribute('width'); i.removeAttribute('height'); done(); }
  async function caption(i) {
    const t = await W.askText('Légende de l\'image', 'Texte de la légende', ''); if (t === null) return;
    const n = $$('.caption', ed).filter(c => c.textContent.startsWith('Figure ')).length + 1;
    const p = document.createElement('p'); p.className = 'caption'; p.textContent = 'Figure ' + n + (t.trim() ? ' : ' + t.trim() : '');
    W.history.flush(); const b = blockOf(i); (b && b !== ed ? b : i).after(p); done();
  }
  bar.addEventListener('mousedown', e => e.preventDefault());
  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !img) return; const o = b.dataset.o, i = img;
    W.history.flush();
    if (o === 'l') align(i, 'left'); else if (o === 'c') align(i, 'center'); else if (o === 'r') align(i, 'right');
    else if (o === '25' || o === '50' || o === '100') setWidthPct(i, +o);
    else if (o === 'cap') caption(i); else if (o === 'fmt') W.editObject(i);
    else if (o === 'del') { hide(); i.remove(); done(); return; }
    setTimeout(() => { if (document.contains(i)) select(i); }, 60);
  });
  handle.addEventListener('mousedown', e => {
    if (!img) return; e.preventDefault(); const i = img, x0 = e.clientX, w0 = i.offsetWidth, g = W.geom(), maxW = g.pw - g.ml - g.mr; W.history.flush();
    const sc = ed.offsetWidth ? ed.getBoundingClientRect().width / ed.offsetWidth : 1;
    const mv = ev => { const w = Math.max(24, Math.min(maxW, w0 + (ev.clientX - x0) / sc)); i.style.width = Math.round(w) + 'px'; i.style.height = 'auto'; i.style.maxWidth = '100%'; place(); };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); i.removeAttribute('width'); i.removeAttribute('height'); done(); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });

  /* ---------- Style de tableau ---------- */
  const tableOfSel = () => { const s = getSelection(); const n = s.rangeCount ? s.anchorNode : null; const el = n && (n.nodeType === 1 ? n : n.parentElement); return el && ed.contains(el) ? el.closest('table') : null; };
  ACT.tableStyle = async () => {
    const t = tableOfSel(); if (!t) { W.toast('Placez le curseur dans un tableau.'); return; }
    const body = document.createElement('div');
    body.innerHTML = '<label class="check"><input type="checkbox" id="ts-h" checked> Ligne d\'en-tête colorée</label><div class="two"><label class="field">Couleur de l\'en-tête<input type="color" id="ts-hc" value="#2b579a"></label><label class="field">Couleur des bordures<input type="color" id="ts-bc" value="#8a8a8a"></label></div>' +
      '<div class="two"><label class="field">Bordures<select id="ts-bw" class="office-select" style="max-width:none"><option value="1">Fines</option><option value="2">Épaisses</option><option value="0">Aucune</option></select></label><label class="field">Alignement du tableau<select id="ts-al" class="office-select" style="max-width:none"><option value="left">À gauche</option><option value="center">Centré</option><option value="right">À droite</option></select></label></div>' +
      '<label class="check"><input type="checkbox" id="ts-z"> Lignes alternées (grisées)</label><label class="check"><input type="checkbox" id="ts-full" checked> Occuper toute la largeur</label>';
    const r = await W.dialog({ title: 'Style du tableau', width: 420, body, buttons: [{ label: 'Annuler', value: null }, { label: 'Appliquer', primary: true, collect: b => ({ h: b.querySelector('#ts-h').checked, hc: b.querySelector('#ts-hc').value, bc: b.querySelector('#ts-bc').value, bw: +b.querySelector('#ts-bw').value, al: b.querySelector('#ts-al').value, z: b.querySelector('#ts-z').checked, full: b.querySelector('#ts-full').checked }) }] });
    if (!r) return; W.history.flush();
    t.style.borderCollapse = 'collapse'; t.style.width = r.full ? '100%' : 'auto';
    t.style.marginLeft = r.al === 'left' ? '0' : 'auto'; t.style.marginRight = r.al === 'right' ? '0' : r.al === 'center' ? 'auto' : '0';
    const rows = Array.from(t.rows);
    rows.forEach((tr, ri) => Array.from(tr.cells).forEach(c => {
      c.style.border = r.bw ? r.bw + 'px solid ' + r.bc : 'none'; c.style.padding = '4px 8px';
      if (r.h && ri === 0) { c.style.backgroundColor = r.hc; c.style.color = '#ffffff'; c.style.fontWeight = '700'; }
      else { c.style.color = ''; c.style.fontWeight = ''; c.style.backgroundColor = r.z && ri % 2 === 0 ? '#f2f2f2' : ''; }
    }));
    done();
  };
  ACT.tableEqual = () => { const t = tableOfSel(); if (!t) { W.toast('Placez le curseur dans un tableau.'); return; } W.history.flush(); const n = Math.max(...Array.from(t.rows).map(r => r.cells.length)); t.style.tableLayout = 'fixed'; Array.from(t.rows).forEach(r => Array.from(r.cells).forEach(c => { c.style.width = (100 / n).toFixed(2) + '%'; })); done(); };

  /* ---------- Suivi des modifications ---------- */
  let track = false;
  const who = () => W.settings.get('userName', '') || 'Utilisateur';
  const mk = tag => { const e = document.createElement(tag); e.className = 'rev'; e.title = who() + ' · ' + new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); return e; };
  const inTag = (n, tag) => { const e = n && (n.nodeType === 1 ? n : n.parentElement); return e && e.closest ? e.closest(tag + '.rev') : null; };
  function mergeAround(el) {
    const same = x => x && x.nodeType === 1 && x.tagName === el.tagName && x.classList.contains('rev');
    while (same(el.previousSibling)) { const p = el.previousSibling; while (p.lastChild) el.insertBefore(p.lastChild, el.firstChild); p.remove(); }
    while (same(el.nextSibling)) { const n = el.nextSibling; while (n.firstChild) el.appendChild(n.firstChild); n.remove(); }
  }
  /* Marque la plage comme supprimée ; renvoie le premier/dernier <del> créé, ou null s'il n'y avait rien à marquer */
  function markDeleted(range) {
    const nodes = []; const root = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => (n.nodeType === 3 || n.tagName === 'IMG') && range.intersectsNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP });
    if (root.nodeType === 3 || root === range.startContainer && root.nodeType === 3) nodes.push(root); while (tw.nextNode()) nodes.push(tw.currentNode);
    if (range.commonAncestorContainer.nodeType === 3 && !nodes.includes(range.commonAncestorContainer)) nodes.push(range.commonAncestorContainer);
    let first = null, last = null;
    nodes.forEach(n => {
      if (n.nodeType === 1) { if (inTag(n, 'del')) return; if (inTag(n, 'ins')) { n.remove(); return; } const d = mk('del'); n.replaceWith(d); d.appendChild(n); first = first || d; last = d; return; }
      if (inTag(n, 'del') || !n.nodeValue) return;
      let s = n === range.startContainer ? range.startOffset : 0, e = n === range.endContainer ? range.endOffset : n.nodeValue.length; if (e <= s) return;
      if (inTag(n, 'ins')) { n.deleteData(s, e - s); return; }
      const mid = n.splitText(s); if (e - s < mid.nodeValue.length) mid.splitText(e - s);
      const d = mk('del'); mid.replaceWith(d); d.appendChild(mid); first = first || d; last = d;
    });
    [first, last].forEach(d => { if (d && d.parentNode) mergeAround(d); });
    return first ? { first: first.parentNode ? first : null, last: last } : null;
  }
  const rangeFrom = sr => { const r = document.createRange(); r.setStart(sr.startContainer, sr.startOffset); r.setEnd(sr.endContainer, sr.endOffset); return r; };
  function caretAfter(el) { const r = document.createRange(); r.setStartAfter(el); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function caretBefore(el) { const r = document.createRange(); r.setStartBefore(el); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function afterEdit() { W.docChanged(); W.history.touch(); }

  ed.addEventListener('beforeinput', e => {
    if (!track || W.composing || e.isComposing) return;
    const t = e.inputType, sel = getSelection(); if (!sel.rangeCount) return;
    if (/^delete(ContentBackward|ContentForward|WordBackward|WordForward|ByCut|SoftLineBackward|HardLineBackward)$/.test(t)) {
      const tr = e.getTargetRanges && e.getTargetRanges()[0]; const rg = tr ? rangeFrom(tr) : sel.getRangeAt(0); if (rg.collapsed) return;
      const insOnly = inTag(rg.startContainer, 'ins') && inTag(rg.endContainer, 'ins') && inTag(rg.startContainer, 'ins') === inTag(rg.endContainer, 'ins');
      if (insOnly) return; // suppression de sa propre insertion : comportement normal
      W.history.flush(); const res = markDeleted(rg); if (!res) return;
      e.preventDefault(); if (/Backward/.test(t)) caretBefore(res.first); else caretAfter(res.last); afterEdit(); return;
    }
    if (t === 'insertText' && e.data) {
      let rg = sel.getRangeAt(0); if (!ed.contains(rg.startContainer)) return;
      if (!rg.collapsed) { const res = markDeleted(rg); e.preventDefault(); W.history.flush(); if (res) caretAfter(res.last); rg = getSelection().getRangeAt(0); }
      else if (inTag(rg.startContainer, 'ins') && rg.startContainer.nodeType === 3) { e.preventDefault(); const tn0 = rg.startContainer, off = rg.startOffset; tn0.insertData(off, e.data); const r0 = document.createRange(); r0.setStart(tn0, off + e.data.length); r0.collapse(true); sel.removeAllRanges(); sel.addRange(r0); afterEdit(); return; }
      else e.preventDefault();
      if (inTag(rg.startContainer, 'del')) { const d = inTag(rg.startContainer, 'del'); caretAfter(d); rg = getSelection().getRangeAt(0); }
      const i = mk('ins'), tn = document.createTextNode(e.data); i.appendChild(tn); rg.insertNode(i); mergeAround(i);
      const r2 = document.createRange(); r2.setStart(tn.parentNode === i ? tn : i.lastChild, (tn.parentNode === i ? tn : i.lastChild).nodeValue.length); r2.collapse(true); sel.removeAllRanges(); sel.addRange(r2); afterEdit();
    }
  }, true);

  const revs = () => $$('ins.rev, del.rev', ed);
  function updateRevUI() { const b = $('#btn-track'); if (b) b.classList.toggle('on', track); const c = $('#rev-count'); if (c) c.textContent = revs().length ? revs().length + ' modification(s) suivie(s)' : (track ? 'Suivi activé' : ''); }
  function resolve(el, accept) {
    const isIns = el.tagName === 'INS';
    if (accept === isIns) { while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el); el.remove(); } else el.remove();
  }
  function current() { const s = getSelection(); if (!s.rangeCount) return null; return inTag(s.anchorNode, 'ins') || inTag(s.anchorNode, 'del'); }
  function go(dir) {
    const list = revs(); if (!list.length) { W.toast('Aucune modification suivie.'); return; }
    const cur = current(); let i = cur ? list.indexOf(cur) + dir : (dir > 0 ? 0 : list.length - 1); i = (i + list.length) % list.length;
    const r = document.createRange(); r.selectNodeContents(list[i]); const s = getSelection(); s.removeAllRanges(); s.addRange(r); list[i].scrollIntoView({ block: 'center' });
  }
  Object.assign(ACT, {
    toggleTrack: () => { track = !track; updateRevUI(); W.toast(track ? 'Suivi des modifications activé : vos changements sont marqués.' : 'Suivi des modifications désactivé.'); W.focusEditor && W.focusEditor(); },
    revNext: () => go(1), revPrev: () => go(-1),
    revAccept: () => { const c = current(); if (!c) { go(1); return; } W.history.flush(); resolve(c, true); done(); updateRevUI(); },
    revReject: () => { const c = current(); if (!c) { go(1); return; } W.history.flush(); resolve(c, false); done(); updateRevUI(); },
    revAcceptAll: () => { const l = revs(); if (!l.length) return; W.history.flush(); l.forEach(x => resolve(x, true)); done(); updateRevUI(); W.toast(l.length + ' modification(s) acceptée(s).', 'ok'); },
    revRejectAll: () => { const l = revs(); if (!l.length) return; W.history.flush(); l.forEach(x => resolve(x, false)); done(); updateRevUI(); W.toast(l.length + ' modification(s) refusée(s).', 'ok'); }
  });
  ed.addEventListener('input', updateRevUI); ed.addEventListener('keyup', updateRevUI);
  W.hasRevisions = () => revs().length > 0;
  updateRevUI();
})();
