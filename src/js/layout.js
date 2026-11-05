'use strict';
/* ===== Mise en page : vraies pages A4, sauts de page, état de sélection, zoom ===== */
(function () {
  const ed = W.editor = document.getElementById('editor');
  const docCol = document.getElementById('doc-column');
  const sizer = document.getElementById('zoom-sizer');
  const wrapper = document.getElementById('page-wrapper');
  const overlay = document.getElementById('page-overlay');
  const workspace = document.getElementById('workspace');

  W.PAGES = {
    A4: { w: 794, h: 1123, mm: [210, 297], tw: [11906, 16838] },
    Letter: { w: 816, h: 1056, mm: [215.9, 279.4], tw: [12240, 15840] },
    A5: { w: 559, h: 794, mm: [148, 210], tw: [8392, 11906] }
  };
  W.defaultPage = () => ({ size: 'A4', orient: 'portrait', mt: 96, mb: 96, ml: 96, mr: 96, theme: W.settings.get('theme', W.look() === 'word' ? 'white' : 'dark'), header: '', footer: '', numbers: 'none', watermark: '' });
  W.page = W.defaultPage();
  W.view = 'print';
  W.zoom = 1;
  W.pageCount = 1;
  W.autoFit = false;

  W.geom = function () {
    const P = W.PAGES[W.page.size] || W.PAGES.A4, land = W.page.orient === 'landscape';
    return { pw: land ? P.h : P.w, ph: land ? P.w : P.h, mt: W.page.mt, mb: W.page.mb, ml: W.page.ml, mr: W.page.mr, gap: 28 };
  };

  W.applyPageCSS = function () {
    const g = W.geom(), root = document.documentElement.style;
    root.setProperty('--pw', g.pw + 'px'); root.setProperty('--ph', g.ph + 'px');
    root.setProperty('--mt', g.mt + 'px'); root.setProperty('--mb', g.mb + 'px');
    root.setProperty('--ml', g.ml + 'px'); root.setProperty('--mr', g.mr + 'px'); root.setProperty('--gap', g.gap + 'px');
    ed.classList.remove('dark-doc', 'white-doc', 'sepia-doc');
    ed.classList.add((W.page.theme === 'white' ? 'white' : W.page.theme === 'sepia' ? 'sepia' : 'dark') + '-doc');
    const P = W.PAGES[W.page.size] || W.PAGES.A4, land = W.page.orient === 'landscape';
    const mm = v => (v / 96 * 25.4).toFixed(2) + 'mm';
    const q = t => '"' + String(t || '').replace(/[\\"]/g, '').replace(/[\r\n]+/g, ' ') + '"';
    const pg = W.page, box = 'font:9pt Calibri,Carlito,Arial,sans-serif;color:#555;';
    let boxes = '';
    if (pg.header) boxes += '@top-center{content:' + q(pg.header) + ';' + box + '}';
    const num = pg.numbers !== 'none', pos = { left: '@bottom-left', center: '@bottom-center', right: '@bottom-right' }[pg.numbers] || '@bottom-center';
    if (pg.footer) boxes += (num && pos === '@bottom-left' ? '@bottom-center' : '@bottom-left') + '{content:' + q(pg.footer) + ';' + box + '}';
    if (num) boxes += pos + '{content:"Page " counter(page) " / " counter(pages);' + box + '}';
    document.getElementById('print-page-style').textContent =
      '@page{size:' + (land ? P.mm[1] : P.mm[0]) + 'mm ' + (land ? P.mm[0] : P.mm[1]) + 'mm;margin:' + mm(g.mt) + ' ' + mm(g.mr) + ' ' + mm(g.mb) + ' ' + mm(g.ml) + ';' + boxes + '}';
  };

  /* ---------- Sélection sous forme d'état stable (indépendant des fragments de pagination) ---------- */
  const isCont = n => n.nodeType === 1 && n.hasAttribute('data-cont');
  const atomsIn = n => n.nodeType === 3 ? n.nodeValue.length : n.textContent.length + n.querySelectorAll('br,img,hr').length;
  const topBlocks = () => Array.from(ed.childNodes).filter(n => !isCont(n));
  function atomsBefore(root, node, off) {
    if (root.nodeType === 3 && node === root) return off;
    const r = document.createRange(); r.setStart(root, 0); r.setEnd(node, off);
    return atomsIn(r.cloneContents());
  }
  function pointState(node, off) {
    if (node === ed) {
      const child = ed.childNodes[off]; const blocks = topBlocks();
      if (!child) return { b: blocks.length, o: 0, end: 1 };
      let c = child; while (isCont(c) && c.previousSibling) c = c.previousSibling;
      return { b: blocks.indexOf(c), o: 0 };
    }
    let top = node; while (top && top.parentNode !== ed) top = top.parentNode;
    if (!top) return null;
    let head = top; while (isCont(head) && head.previousSibling) head = head.previousSibling;
    let before = 0, fi = 0;
    for (let n = head; n && n !== top; n = n.nextSibling) { before += atomsIn(n); fi++; }
    return { b: topBlocks().indexOf(head), o: before + atomsBefore(top, node, off), fi };
  }
  function placeIn(el, o) {
    if (el.nodeType === 3) return [el, Math.min(o, el.nodeValue.length)];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    while (w.nextNode()) {
      const n = w.currentNode;
      if (n.nodeType === 3) { const L = n.nodeValue.length; if (o <= L) return [n, o]; o -= L; }
      else if (n.matches('br,img,hr')) { if (o === 0) return [n.parentNode, Array.prototype.indexOf.call(n.parentNode.childNodes, n)]; o -= 1; }
    }
    return [el, el.childNodes.length];
  }
  function locatePoint(p) {
    const blocks = topBlocks();
    if (p.end || p.b < 0 || p.b >= blocks.length) return [ed, ed.childNodes.length];
    const chain = [blocks[p.b]]; let n = blocks[p.b].nextSibling;
    while (n && isCont(n)) { chain.push(n); n = n.nextSibling; }
    let o = p.o, acc = 0;
    for (let i = 0; i < chain.length; i++) {
      const L = atomsIn(chain[i]), last = i === chain.length - 1;
      if (o <= acc + L && (last || !(o === acc + L && (p.fi || 0) > i))) return placeIn(chain[i], o - acc);
      acc += L;
    }
    const lastEl = chain[chain.length - 1];
    return placeIn(lastEl, atomsIn(lastEl));
  }
  W.saveSel = function () {
    const s = getSelection(); if (!s.rangeCount) return null;
    const r = s.getRangeAt(0);
    if (!ed.contains(r.startContainer) || !ed.contains(r.endContainer)) return null;
    const a = pointState(r.startContainer, r.startOffset), f = r.collapsed ? a : pointState(r.endContainer, r.endOffset);
    return a && f ? { a, f } : null;
  };
  W.loadSel = function (st) {
    if (!st) return;
    try {
      const [sn, so] = locatePoint(st.a), [en, eo] = locatePoint(st.f);
      const r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    } catch (e) { /* position introuvable : on laisse la sélection telle quelle */ }
  };

  /* ---------- Fragments de pagination ---------- */
  const INLINE = new Set(['A', 'B', 'I', 'U', 'S', 'SPAN', 'FONT', 'STRONG', 'EM', 'SUB', 'SUP', 'CODE', 'MARK', 'STRIKE', 'SMALL', 'IMG', 'BR']);
  const sameAttrs = (a, b) => a.attributes.length === b.attributes.length && Array.from(a.attributes).every(t => b.getAttribute(t.name) === t.value);
  function mergeInto(prev, el) {
    let a = prev.lastChild;
    while (el.firstChild) prev.appendChild(el.firstChild);
    let b = a ? a.nextSibling : prev.firstChild;
    while (a && b && a.nodeType === 1 && b.nodeType === 1 && a.tagName === b.tagName && INLINE.has(a.tagName) && !['IMG', 'BR'].includes(a.tagName) && sameAttrs(a, b)) {
      const nextA = a.lastChild;
      while (b.firstChild) a.appendChild(b.firstChild);
      b.remove();
      a = nextA; b = a ? a.nextSibling : null;
    }
    prev.normalize();
  }
  function unpaginate(root) {
    root.querySelectorAll('[data-cont]').forEach(el => {
      const prev = el.previousElementSibling;
      if (!prev) { el.removeAttribute('data-cont'); return; }
      mergeInto(prev, el); el.remove();
    });
    root.querySelectorAll('[data-pg]').forEach(el => {
      el.style.removeProperty('margin-top'); el.removeAttribute('data-pg');
      if (!el.getAttribute('style')) el.removeAttribute('style');
    });
  }
  function pruneEmpty(root) {
    let changed = true;
    while (changed) {
      changed = false;
      root.querySelectorAll('b,i,u,s,strong,em,span,font,a,sub,sup,mark,code,strike').forEach(e => {
        if (e.classList.contains('shape') || e.classList.contains('mf')) return;
        if (!e.firstChild || (e.textContent === '' && !e.querySelector('br,img,hr,.shape'))) { e.remove(); changed = true; }
      });
    }
  }

  /* ---------- Normalisation du premier niveau ---------- */
  const INLINE_TAGS = new Set(['A', 'B', 'I', 'U', 'S', 'SPAN', 'FONT', 'STRONG', 'EM', 'SUB', 'SUP', 'CODE', 'MARK', 'STRIKE', 'SMALL', 'IMG', 'BR']);
  function needsNormalize() {
    if (!ed.firstChild) return true;
    for (const n of ed.childNodes) { if (n.nodeType === 3 || (n.nodeType === 1 && INLINE_TAGS.has(n.tagName))) return true; }
    const last = ed.lastElementChild;
    return !!(last && (last.classList.contains('pb') || last.classList.contains('toc')));
  }
  function normalizeTop() {
    if (!needsNormalize()) return;
    const s = getSelection(); let refs = null;
    if (s.rangeCount && ed.contains(s.anchorNode)) { const r = s.getRangeAt(0); refs = { sc: r.startContainer, so: r.startOffset, ec: r.endContainer, eo: r.endOffset }; }
    let n = ed.firstChild;
    while (n) {
      if (n.nodeType === 3 && !n.nodeValue.trim()) { const nx = n.nextSibling; n.remove(); n = nx; continue; }
      if (n.nodeType === 3 || (n.nodeType === 1 && INLINE_TAGS.has(n.tagName))) {
        const p = document.createElement('p'); ed.insertBefore(p, n);
        let m = n;
        while (m && (m.nodeType === 3 || (m.nodeType === 1 && INLINE_TAGS.has(m.tagName)))) { const nx = m.nextSibling; p.appendChild(m); m = nx; }
        n = m; continue;
      }
      n = n.nextSibling;
    }
    if (!ed.firstChild) ed.innerHTML = '<p><br></p>';
    const last = ed.lastElementChild;
    if (last && (last.classList.contains('pb') || last.classList.contains('toc'))) { const p = document.createElement('p'); p.innerHTML = '<br>'; ed.appendChild(p); }
    if (refs && document.activeElement === ed) {
      try {
        if (ed.contains(refs.sc) && ed.contains(refs.ec) && refs.sc !== ed && refs.ec !== ed) {
          const r = document.createRange(); r.setStart(refs.sc, refs.so); r.setEnd(refs.ec, refs.eo); s.removeAllRanges(); s.addRange(r);
        }
      } catch (e) { /* ignoré */ }
    }
  }

  /* ---------- Coupe d'un paragraphe à la limite de page ---------- */
  function trySplit(el, limit, sc) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [], starts = []; let total = 0;
    while (walker.nextNode()) { const t = walker.currentNode; if (t.nodeValue.length) { nodes.push(t); starts.push(total); total += t.nodeValue.length; } }
    if (total < 2) return null;
    const cs = getComputedStyle(el); let lh = parseFloat(cs.lineHeight); if (!lh) lh = parseFloat(cs.fontSize) * 1.3;
    const et = ed.getBoundingClientRect().top, rg = document.createRange();
    const where = i => { let lo = 0, hi = nodes.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= i) lo = m; else hi = m - 1; } return [nodes[lo], i - starts[lo]]; };
    const box = i => {
      for (let j = i; j < Math.min(total, i + 8); j++) {
        const [n, o] = where(j); rg.setStart(n, o); rg.setEnd(n, o + 1);
        const rs = rg.getClientRects();
        if (rs.length) { const r = rs[0], top = (r.top - et) / sc, bot = (r.bottom - et) / sc, h = bot - top; return { top, bottom: bot + Math.max(0, (lh - h) / 2) }; }
      }
      return null;
    };
    const lastBox = box(total - 1);
    if (!lastBox || lastBox.bottom <= limit + 0.5) return null;
    let lo = 0, hi = total - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1, b = box(mid); if (b && b.bottom > limit + 0.5) hi = mid; else lo = mid + 1; }
    let idx = lo; const bi = box(idx); if (!bi) return null;
    while (idx > 0) { const p = box(idx - 1); if (p && Math.abs(p.top - bi.top) < lh * 0.4) idx--; else break; }
    const b0 = box(0);
    if (idx === 0 || !b0 || (bi.top - b0.top) / lh < 1.5) return null; // au moins 2 lignes en bas de page
    const [n, o] = where(idx);
    const r = document.createRange(); r.setStart(n, o); r.setEnd(el, el.childNodes.length);
    const frag = r.extractContents();
    const part = el.cloneNode(false);
    part.removeAttribute('id'); part.removeAttribute('data-pg'); part.style.removeProperty('margin-top');
    if (!part.getAttribute('style')) part.removeAttribute('style');
    part.setAttribute('data-cont', '1'); part.appendChild(frag);
    el.after(part); pruneEmpty(el); pruneEmpty(part);
    return part;
  }

  /* ---------- Passe de pagination ---------- */
  function layoutPass() {
    const g = W.geom(), pitch = g.ph + g.gap, contentH = g.ph - g.mt - g.mb;
    const sc = ed.offsetWidth ? ed.getBoundingClientRect().width / ed.offsetWidth : 1;
    const Y = (el, w) => { const r = el.getBoundingClientRect(), t = ed.getBoundingClientRect().top; return ((w === 'b' ? r.bottom : r.top) - t) / sc; };
    const startOf = k => k * pitch + g.mt, endOf = k => k * pitch + g.ph - g.mb;
    const pageOf = y => Math.max(0, Math.floor((y + 0.01) / pitch));
    const kindOf = el => {
      if (el.classList.contains('pb')) return 'pb';
      if (/^H[1-6]$/.test(el.tagName)) return 'h';
      if (el.tagName === 'P') return 'p';
      if (el.tagName === 'DIV' && !el.hasAttribute('contenteditable') && !el.querySelector('div,p,table,ul,ol,h1,h2,h3,h4,h5,h6,blockquote')) return 'p';
      return 'o';
    };
    const units = [];
    for (const el of Array.from(ed.children)) {
      if (el.matches('ul,ol')) Array.from(el.children).forEach(li => { if (li.tagName === 'LI') units.push({ el: li, kind: 'li' }); });
      else if (el.classList.contains('footnotes')) Array.from(el.children).forEach(c => units.push({ el: c, kind: kindOf(c) === 'p' ? 'p' : 'o' }));
      else units.push({ el, kind: kindOf(el) });
    }
    const pushTo = (el, target) => {
      const prev = el.previousElementSibling;
      const pmb = prev ? (parseFloat(getComputedStyle(prev).marginBottom) || 0) : 0;
      const d0 = target - Y(el, 't'); if (Math.abs(d0) < 0.6) return;
      let mt = Math.max(0, d0 + pmb);
      el.style.marginTop = mt + 'px'; el.setAttribute('data-pg', '1');
      for (let i = 0; i < 3; i++) { const d = target - Y(el, 't'); if (Math.abs(d) < 0.6) break; mt = Math.max(0, mt + d); el.style.marginTop = mt + 'px'; }
    };
    let pendingBreakPage = -1, lastBottom = g.mt;
    for (const u of units) {
      let el = u.el, kind = u.kind, guard = 0;
      while (el && guard++ < 60) {
        let T = Y(el, 't'), B = Y(el, 'b'), k = pageOf(T);
        if (pendingBreakPage >= 0) { const tgt = startOf(pendingBreakPage + 1); pendingBreakPage = -1; if (T < tgt - 0.5) { pushTo(el, tgt); T = Y(el, 't'); B = Y(el, 'b'); k = pageOf(T); } }
        if (T >= endOf(k) - 0.5) { pushTo(el, startOf(k + 1)); T = Y(el, 't'); B = Y(el, 'b'); k = pageOf(T); }
        else if (B > endOf(k) + 0.5 && kind !== 'pb') {
          const h = B - T;
          if (kind === 'p') { const part = trySplit(el, endOf(k), sc); if (part) { pushTo(part, startOf(k + 1)); el = part; continue; } }
          if (h <= contentH) { pushTo(el, startOf(k + 1)); T = Y(el, 't'); B = Y(el, 'b'); k = pageOf(T); }
        }
        if (kind === 'h') { const t2 = Y(el, 't'), k2 = pageOf(t2); if (Y(el, 'b') + 50 > endOf(k2) && t2 > startOf(k2) + 2) pushTo(el, startOf(k2 + 1)); }
        if (kind === 'pb') pendingBreakPage = pageOf(Y(el, 't'));
        break;
      }
      lastBottom = Math.max(lastBottom, Y(el, 'b'));
    }
    return Math.max(1, Math.floor((lastBottom - 1) / pitch) + 1);
  }

  W.paginate = function (opts) {
    opts = opts || {};
    if (W.paginating || W.composing) return;
    W.paginating = true;
    try {
      normalizeTop();
      const g = W.geom();
      if (W.view === 'web') {
        unpaginate(ed);
        W.pageCount = Math.max(1, Math.ceil(ed.offsetHeight / g.ph));
        ed.style.minHeight = '';
      } else {
        const focused = document.activeElement === ed;
        const st = opts.sel !== undefined ? opts.sel : (focused ? W.saveSel() : null);
        unpaginate(ed);
        ed.style.minHeight = g.ph + 'px';
        const pages = layoutPass();
        W.pageCount = pages;
        ed.style.minHeight = (pages * (g.ph + g.gap) - g.gap) + 'px';
        if (st) W.loadSel(st);
      }
      updateSizer(); renderOverlay();
    } finally { W.paginating = false; }
    if (W.afterPaginate) W.afterPaginate();
  };
  W.schedulePaginate = W.debounce(() => W.paginate(), 140);

  function updateSizer() {
    const g = W.geom();
    if (W.view === 'web') { docCol.style.width = ''; sizer.style.height = ''; wrapper.style.transform = ''; return; }
    docCol.style.width = (g.pw * W.zoom) + 'px';
    sizer.style.height = (ed.offsetHeight * W.zoom) + 'px';
    wrapper.style.transform = 'scale(' + W.zoom + ')';
  }

  function renderOverlay() {
    const g = W.geom(), p = W.page, pitch = g.ph + g.gap;
    if (W.view === 'web') { overlay.innerHTML = ''; return; }
    overlay.style.height = ed.offsetHeight + 'px';
    const hasAny = p.header || p.footer || p.numbers !== 'none' || p.watermark;
    if (!hasAny) { overlay.innerHTML = ''; return; }
    let html = '';
    for (let k = 0; k < W.pageCount; k++) {
      const num = '<span>' + (k + 1) + '</span>', ft = W.esc(p.footer || '');
      let foot = '';
      if (p.numbers === 'right') foot = '<span class="l">' + ft + '</span><span class="r">' + num + '</span>';
      else if (p.numbers === 'left') foot = '<span class="l">' + num + '</span><span class="r">' + ft + '</span>';
      else if (p.numbers === 'center') foot = '<span class="l">' + ft + '</span><span class="c">' + num + '</span><span class="r"></span>';
      else foot = '<span class="c">' + ft + '</span>';
      html += '<div class="ov-page" style="top:' + (k * pitch) + 'px;height:' + g.ph + 'px">' +
        (p.header ? '<div class="ov-header">' + W.esc(p.header) + '</div>' : '') +
        ((p.footer || p.numbers !== 'none') ? '<div class="ov-footer">' + foot + '</div>' : '') +
        (p.watermark ? '<div class="ov-wm">' + W.esc(p.watermark) + '</div>' : '') + '</div>';
    }
    overlay.innerHTML = html;
  }

  /* ---------- HTML « propre » (sans artefacts de pagination) ---------- */
  W.cleanHTML = function () {
    const c = ed.cloneNode(true);
    unpaginate(c);
    c.querySelectorAll('.mf').forEach(m => { m.textContent = '«' + (m.getAttribute('data-field') || '') + '»'; });
    c.querySelectorAll('.active').forEach(e => e.classList.remove('active'));
    c.querySelectorAll('img.sel').forEach(e => e.classList.remove('sel'));
    return c.innerHTML;
  };
  W.setHTML = function (html) {
    ed.innerHTML = html && html.trim() ? html : '<p><br></p>';
    W.paginate({ sel: null });
  };

  /* ---------- Page courante (barre d'état) ---------- */
  W.currentPage = function () {
    const g = W.geom(), pitch = g.ph + g.gap;
    const sc = ed.offsetWidth ? ed.getBoundingClientRect().width / ed.offsetWidth : 1;
    let y = null;
    const s = getSelection();
    if (s.rangeCount && ed.contains(s.anchorNode)) {
      const el = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
      const r0 = s.getRangeAt(0).cloneRange(); let rect = r0.getClientRects()[0];
      if (!rect || (!rect.top && !rect.bottom)) rect = (el.childNodes[s.anchorOffset] && el.childNodes[s.anchorOffset].nodeType === 1 ? el.childNodes[s.anchorOffset] : el).getBoundingClientRect();
      y = (rect.top - ed.getBoundingClientRect().top) / sc + 2;
    }
    if (y === null) { const wr = workspace.getBoundingClientRect(); y = (wr.top + wr.height / 3 - ed.getBoundingClientRect().top) / sc; }
    return Math.min(W.pageCount, Math.max(1, Math.floor(y / pitch) + 1));
  };

  /* ---------- Zoom ---------- */
  W.setZoom = function (z, silent) {
    z = Math.min(2, Math.max(0.3, z));
    W.zoom = Math.round(z * 100) / 100;
    document.getElementById('zoom-slider').value = Math.round(W.zoom * 100);
    document.getElementById('zoom-text').textContent = Math.round(W.zoom * 100) + ' %';
    if (!silent) W.autoFit = false;
    updateSizer(); if (W.onZoom) W.onZoom();
  };
  W.fitWidth = function () { const g = W.geom(); W.setZoom(Math.min(2, (workspace.clientWidth - 40) / g.pw), true); };
  W.fitPage = function () { const g = W.geom(); W.setZoom(Math.min((workspace.clientHeight - 50) / g.ph, (workspace.clientWidth - 40) / g.pw), true); };
  W.updateSizer = updateSizer;
  W.renderOverlay = renderOverlay;
})();
