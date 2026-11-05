'use strict';
/* ===== Recherche et remplacement fiables (sans window.find, sans innerHTML.replaceAll) ===== */
(function () {
  const ed = W.editor, $ = W.$;
  const panel = $('#find-panel'), inp = $('#find-input'), rep = $('#replace-input'), cnt = $('#find-count');
  const optCase = $('#find-case'), optWord = $('#find-word'), workspace = $('#workspace');
  const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,td,th,div,blockquote,pre,figcaption,caption';
  let matches = [], cur = -1, replaceMode = false;

  function regex(term) {
    if (!term) return null;
    let src = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (optWord.checked) src = '(?<![\\p{L}\\p{N}_])' + src + '(?![\\p{L}\\p{N}_])';
    return new RegExp(src, 'gu' + (optCase.checked ? '' : 'i'));
  }
  function collect() {
    const out = []; let g = null;
    const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && n.parentElement.closest('.pb,.mf') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    while (w.nextNode()) {
      const t = w.currentNode; let b = t.parentElement.closest(BLOCKS) || ed;
      while (b !== ed && b.hasAttribute('data-cont') && b.previousElementSibling) b = b.previousElementSibling;
      if (!g || g.block !== b) { g = { block: b, nodes: [], text: '' }; out.push(g); }
      g.nodes.push(t); g.text += t.nodeValue;
    }
    return out;
  }
  function mapIdx(g, i, isEnd) {
    let acc = 0;
    for (const n of g.nodes) {
      const L = n.nodeValue.length;
      if (isEnd ? (i > acc && i <= acc + L) : (i >= acc && i < acc + L)) return [n, i - acc];
      acc += L;
    }
    const n = g.nodes[g.nodes.length - 1]; return [n, n.nodeValue.length];
  }
  function compute() {
    matches = [];
    const re = regex(inp.value);
    if (!re) return;
    for (const g of collect()) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(g.text)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        const [sn, so] = mapIdx(g, m.index, false), [en, eo] = mapIdx(g, m.index + m[0].length, true);
        const r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo); matches.push(r);
      }
    }
  }
  function paint() {
    if (window.CSS && CSS.highlights) {
      CSS.highlights.delete('find-all'); CSS.highlights.delete('find-current');
      if (matches.length) {
        CSS.highlights.set('find-all', new Highlight(...matches));
        if (cur >= 0 && matches[cur]) CSS.highlights.set('find-current', new Highlight(matches[cur]));
      }
    }
    cnt.textContent = matches.length ? (cur >= 0 ? cur + 1 : 0) + '/' + matches.length : (inp.value ? '0/0' : '');
    cnt.style.color = inp.value && !matches.length ? '#f87171' : '';
  }
  function scrollTo(range) {
    const r = range.getBoundingClientRect(), w = workspace.getBoundingClientRect();
    if (r.top < w.top + 40 || r.bottom > w.bottom - 40) workspace.scrollBy({ top: r.top - w.top - w.height / 3, behavior: 'auto' });
    if (r.left < w.left || r.right > w.right) workspace.scrollBy({ left: r.left - w.left - 60, behavior: 'auto' });
  }
  function nearestIndex() {
    const s = getSelection();
    if (!s.rangeCount || !ed.contains(s.anchorNode)) return 0;
    const pt = s.getRangeAt(0);
    for (let i = 0; i < matches.length; i++) if (matches[i].compareBoundaryPoints(Range.START_TO_START, pt) >= 0) return i;
    return 0;
  }
  function refresh(keep) {
    if (panel.classList.contains('hidden')) return;
    const prev = keep && cur >= 0 ? cur : -1;
    compute();
    cur = matches.length ? (prev >= 0 ? Math.min(prev, matches.length - 1) : nearestIndex()) : -1;
    paint();
  }
  const refreshSoon = W.debounce(() => refresh(true), 160);

  function step(dir) {
    if (!inp.value) { open(replaceMode); return; }
    if (!matches.length || cur < 0) refresh(false);
    if (!matches.length) return;
    cur = (cur + dir + matches.length) % matches.length;
    paint(); scrollTo(matches[cur]);
  }
  function replaceRange(r, text) {
    r.deleteContents();
    if (text) r.insertNode(document.createTextNode(text));
  }
  function replaceOne() {
    if (!matches.length) { refresh(false); if (!matches.length) return; }
    if (cur < 0) cur = 0;
    const i = cur; W.history.flush();
    replaceRange(matches[i], rep.value);
    ed.normalize(); W.docChanged(); W.history.commit();
    compute(); cur = matches.length ? Math.min(i, matches.length - 1) : -1;
    paint(); if (cur >= 0) scrollTo(matches[cur]);
  }
  function replaceAll() {
    if (!inp.value) return;
    compute(); const n = matches.length;
    if (!n) { W.toast('Aucune occurrence trouvée.'); return; }
    W.history.flush();
    for (let i = matches.length - 1; i >= 0; i--) replaceRange(matches[i], rep.value);
    ed.normalize(); W.docChanged(); W.history.commit();
    compute(); cur = -1; paint();
    W.toast(n + (n > 1 ? ' remplacements effectués.' : ' remplacement effectué.'), 'ok');
  }
  function setReplace(on) {
    replaceMode = on;
    $('#replace-row').classList.toggle('hidden', !on);
    $('#btn-toggle-replace').textContent = on ? 'Masquer' : 'Remplacer…';
  }
  function open(withReplace, term) {
    panel.classList.remove('hidden'); setReplace(!!withReplace);
    const s = getSelection();
    const sel = term || (s.rangeCount && ed.contains(s.anchorNode) && !s.isCollapsed ? s.toString() : '');
    if (sel && sel.length < 120 && !/\n/.test(sel)) inp.value = sel;
    inp.focus(); inp.select();
    refresh(false);
  }
  function close() {
    const keep = cur >= 0 ? matches[cur] : null;
    panel.classList.add('hidden');
    if (window.CSS && CSS.highlights) { CSS.highlights.delete('find-all'); CSS.highlights.delete('find-current'); }
    ed.focus({ preventScroll: true });
    if (keep) { try { const s = getSelection(); s.removeAllRanges(); s.addRange(keep.cloneRange()); } catch (e) { /* ignoré */ } }
    matches = []; cur = -1;
  }

  inp.addEventListener('input', () => { refresh(false); if (matches.length && cur >= 0) scrollTo(matches[cur]); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { e.preventDefault(); close(); } });
  rep.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } else if (e.key === 'Escape') { e.preventDefault(); close(); } });
  [optCase, optWord].forEach(o => o.addEventListener('change', () => refresh(false)));

  W.find = { open, close, step, replaceOne, replaceAll, refresh: () => refreshSoon(), toggleReplace: () => setReplace(!replaceMode), isOpen: () => !panel.classList.contains('hidden') };
})();
