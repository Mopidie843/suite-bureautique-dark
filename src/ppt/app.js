'use strict';
/* ===== PowerPoint Dark : diapositives, objets, diaporama, fichiers ===== */
(function () {
  const { $, $$, esc, ACT } = A, api = A.api;
  const store = A.store('ppt-dark'), W0 = 960, H0 = 540;
  const stage = $('#stage'), thumbs = $('#thumbs'), notes = $('#notes');
  let deck = null, cur = 0, selId = null, scale = 1, userZoom = 1, undoStack = [], redoStack = [], clip = null, editingId = null, dirty = false;

  const THEMES = [
    { n: 'Office', bg: '#ffffff', title: '#2b579a', text: '#262626', accent: '#2b579a' },
    { n: 'Océan', bg: '#0b3d5c', title: '#ffffff', text: '#d9eefb', accent: '#35a7d8' },
    { n: 'Forêt', bg: '#17392b', title: '#ffe9a8', text: '#e6f4ea', accent: '#4caf7a' },
    { n: 'Sombre', bg: '#1f1f23', title: '#ffffff', text: '#d4d4d8', accent: '#8b7cf6' },
    { n: 'Coucher de soleil', bg: '#fff1e0', title: '#b7472a', text: '#4a2a1a', accent: '#e8833a' },
    { n: 'Ardoise', bg: '#eef1f5', title: '#1f3a5f', text: '#33415c', accent: '#3d5a80' }
  ];
  const themeOf = () => THEMES[deck.theme || 0];
  const sl = () => deck.slides[cur];
  const find = id => sl().objs.find(o => o.id === id);

  /* ---------- Modèle ---------- */
  function text(x, y, w, h, t, o) { return Object.assign({ id: A.uid(), type: 'text', x, y, w, h, text: t, fs: 24, color: themeOf().text, al: 'left', ff: A.settings.get('defFont', '') || 'Calibri' }, o); }
  function makeSlide(layout) {
    const th = themeOf(), objs = [];
    if (layout === 'title') { objs.push(text(80, 170, 800, 110, 'Titre de la présentation', { fs: 54, b: true, color: th.title, al: 'center' }), text(160, 300, 640, 70, 'Sous-titre', { fs: 28, al: 'center' })); }
    else if (layout === 'content') { objs.push(text(60, 36, 840, 90, 'Titre de la diapositive', { fs: 40, b: true, color: th.title }), text(60, 140, 840, 340, '• Premier point\n• Deuxième point\n• Troisième point', { fs: 26 })); }
    else if (layout === 'two') { objs.push(text(60, 36, 840, 90, 'Titre de la diapositive', { fs: 40, b: true, color: th.title }), text(60, 140, 410, 340, '• Contenu de gauche', { fs: 24 }), text(490, 140, 410, 340, '• Contenu de droite', { fs: 24 })); }
    else if (layout === 'titleonly') objs.push(text(60, 36, 840, 90, 'Titre de la diapositive', { fs: 40, b: true, color: th.title }));
    else if (layout === 'section') objs.push(text(80, 190, 800, 110, 'Titre de la section', { fs: 52, b: true, color: th.title, al: 'center' }), { id: A.uid(), type: 'rect', x: 380, y: 315, w: 200, h: 6, fill: th.accent, line: '', text: '', fs: 12, color: '#fff', al: 'center' }, text(160, 340, 640, 60, 'Sous-titre de la section', { fs: 24, al: 'center' }));
    else if (layout === 'compare') objs.push(text(60, 36, 840, 90, 'Comparaison', { fs: 40, b: true, color: th.title }), text(60, 140, 410, 50, 'Option A', { fs: 28, b: true, color: th.accent }), text(60, 195, 410, 285, '• Point 1\n• Point 2', { fs: 24 }), text(490, 140, 410, 50, 'Option B', { fs: 28, b: true, color: th.accent }), text(490, 195, 410, 285, '• Point 1\n• Point 2', { fs: 24 }));
    else if (layout === 'imgtext') objs.push(text(60, 36, 840, 90, 'Titre de la diapositive', { fs: 40, b: true, color: th.title }), text(60, 140, 430, 340, '• Premier point\n• Deuxième point', { fs: 24 }), { id: A.uid(), type: 'rect', x: 520, y: 140, w: 380, h: 340, fill: th.accent, line: '', text: 'Zone d\'image\n(Insertion › Image)', fs: 20, color: '#ffffff', al: 'center' });
    else if (layout === 'quote') objs.push(text(100, 150, 760, 200, '« Une citation marquante »', { fs: 40, i: true, color: th.title, al: 'center' }), text(100, 370, 760, 50, '— Auteur', { fs: 24, al: 'right' }));
    return { id: A.uid(), bg: th.bg, objs, notes: '', tr: 'none' };
  }
  const newDeck = () => { const d = { id: A.uid(), title: 'Présentation1', path: null, theme: 0, slides: [], created: Date.now() }; deck = d; d.slides.push(makeSlide('title')); return d; };
  const snap = () => JSON.stringify({ s: deck.slides, c: cur, t: deck.theme });
  function mutate(fn) { undoStack.push(snap()); if (undoStack.length > 80) undoStack.shift(); redoStack = []; fn(); changed(); }
  function changed(noRender) { dirty = true; setBadge('pending'); if (!noRender) renderAll(); else renderThumb(cur); autosave(); }
  function restore(js) { const o = JSON.parse(js); deck.slides = o.s; cur = Math.min(o.c, o.s.length - 1); deck.theme = o.t; selId = null; editingId = null; renderAll(); dirty = true; autosave(); }
  ACT.undo = () => { if (!undoStack.length) return; redoStack.push(snap()); restore(undoStack.pop()); };
  ACT.redo = () => { if (!redoStack.length) return; undoStack.push(snap()); restore(redoStack.pop()); };
  function setBadge(k) { const b = $('#save-badge'); b.className = 'badge ' + (k === 'pending' ? 'dirty' : 'saved'); b.textContent = k === 'saved' ? 'Enregistré' : k === 'auto' ? 'Copie auto enregistrée' : 'Modifié'; }
  const doSave = async () => { try { await store.put({ id: deck.id, title: deck.title, path: deck.path, theme: deck.theme, slides: deck.slides, created: deck.created, modified: Date.now() }); A.settings.set('lastPpt', deck.id); return true; } catch (e) { return false; } };
  const autosave = A.debounce(async () => { if (A.settings.get('autosave', true) && await doSave()) setBadge('auto'); }, 1200);

  /* ---------- Rendu ---------- */
  function tableEl(o) {
    const d = document.createElement('div'); d.className = 'pobj tbl'; d.dataset.id = o.id; const s = d.style; s.left = o.x + 'px'; s.top = o.y + 'px'; s.width = o.w + 'px'; s.height = o.h + 'px';
    const t = document.createElement('table'), bd = '1px solid ' + (o.line || '#8a8a8a'), th = themeOf();
    t.style.cssText = 'width:100%;height:100%;border-collapse:collapse;table-layout:fixed;font-family:' + (o.ff || 'Calibri') + ';font-size:' + (o.fs || 20) + 'px;color:' + (o.color || th.text);
    o.cells.forEach((row, r) => { const tr = document.createElement('tr'); row.forEach((v, c) => { const td = document.createElement(o.hdr && r === 0 ? 'th' : 'td'); td.textContent = v; td.dataset.r = r; td.dataset.c = c; td.style.cssText = 'border:' + bd + ';padding:4px 8px;vertical-align:middle;overflow:hidden;word-break:break-word;' + (o.hdr && r === 0 ? 'background:' + (o.fill || th.accent) + ';color:#fff;font-weight:700;text-align:left' : (r % 2 === 0 && o.hdr ? 'background:rgba(127,127,127,.12)' : '')); tr.appendChild(td); }); t.appendChild(tr); });
    d.appendChild(t); return d;
  }
  function deco(d, o) { const s = d.style; if (o.rot) s.transform = 'rotate(' + o.rot + 'deg)'; if (o.shadow) s.boxShadow = o.type === 'image' || o.type === 'arrow' || o.type === 'triangle' ? '' : '6px 8px 14px rgba(0,0,0,.45)'; if (o.shadow && (o.type === 'image' || o.type === 'arrow' || o.type === 'triangle')) s.filter = 'drop-shadow(6px 8px 8px rgba(0,0,0,.5))'; if (o.grad && o.type !== 'image' && o.type !== 'arrow' && o.type !== 'triangle') s.background = 'linear-gradient(135deg,' + (o.fill || '#2b579a') + ',' + o.grad + ')'; if (o.grad && o.type === 'triangle') { const t = d.querySelector('.tri'); if (t) t.style.background = 'linear-gradient(135deg,' + (o.fill || '#2b579a') + ',' + o.grad + ')'; } }
  function objEl(o, live) {
    if (o.type === 'table') { const t = tableEl(o); deco(t, o); return t; }
    const d = document.createElement('div'); d.className = 'pobj ' + (o.type === 'text' ? 'text' : o.type === 'image' ? 'image' : 'shape'); d.dataset.id = o.id;
    const s = d.style; s.left = o.x + 'px'; s.top = o.y + 'px'; s.width = o.w + 'px'; s.height = o.h + 'px';
    if (o.type === 'image') { const im = document.createElement('img'); im.src = o.src; im.alt = ''; d.appendChild(im); deco(d, o); return d; }
    if (o.type === 'arrow') { d.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 ' + o.w + ' ' + o.h + '" preserveAspectRatio="none"><line x1="0" y1="' + o.h / 2 + '" x2="' + (o.w - 14) + '" y2="' + o.h / 2 + '" stroke="' + (o.line || '#ffffff') + '" stroke-width="' + (o.lw || 4) + '"/><polygon points="' + o.w + ',' + o.h / 2 + ' ' + (o.w - 20) + ',' + (o.h / 2 - 11) + ' ' + (o.w - 20) + ',' + (o.h / 2 + 11) + '" fill="' + (o.line || '#ffffff') + '"/></svg>'; deco(d, o); return d; }
    s.fontFamily = o.ff || 'Calibri'; s.fontSize = (o.fs || 18) + 'px'; s.fontWeight = o.b ? '700' : '400'; s.fontStyle = o.i ? 'italic' : 'normal'; s.textDecoration = o.u ? 'underline' : 'none'; s.color = o.color || '#000'; s.textAlign = o.al || 'left';
    if (o.type === 'text') { if (o.fill) s.backgroundColor = o.fill; if (o.line) s.border = '1px solid ' + o.line; }
    else {
      if (o.type === 'ellipse') s.borderRadius = '50%';
      if (o.type === 'triangle') { const t = document.createElement('div'); t.className = 'tri'; t.style.background = o.fill || '#fff'; t.style.clipPath = 'polygon(50% 0,100% 100%,0 100%)'; d.appendChild(t); }
      else { s.backgroundColor = o.fill || 'transparent'; if (o.line) s.border = '2px solid ' + o.line; }
    }
    deco(d, o);
    const span = document.createElement('span'); span.className = 'tx'; span.textContent = o.text || ''; span.style.position = 'relative'; span.style.width = '100%'; if (o.type === 'text') span.style.display = 'block'; d.appendChild(span);
    return d;
  }
  function slideEl(sd, live) { const el = document.createElement('div'); el.className = 'pslide'; el.style.background = sd.bg || '#fff'; sd.objs.forEach(o => el.appendChild(objEl(o, live))); return el; }
  function renderStage() {
    stage.innerHTML = ''; const el = slideEl(sl(), true); stage.appendChild(el); stage.style.background = sl().bg;
    $$('.pobj', el).forEach(d => { if (d.dataset.id === selId) { d.classList.add('selected'); addHandles(d); } if (d.dataset.id === editingId) startEditDom(d); });
    $('#sb-slide').textContent = 'Diapositive ' + (cur + 1) + ' sur ' + deck.slides.length;
    notes.value = sl().notes || '';
    syncTools(); syncAnim();
  }
  function renderThumb(i) { const t = thumbs.children[i]; if (!t) return; const tp = t.querySelector('.tp'); tp.innerHTML = ''; tp.appendChild(slideEl(deck.slides[i])); }
  function renderThumbs() {
    thumbs.innerHTML = '';
    deck.slides.forEach((sd, i) => { const t = document.createElement('div'); t.className = 'thumb' + (i === cur ? ' on' : ''); t.dataset.i = i; t.draggable = true; t.innerHTML = '<span class="n">' + (i + 1) + '</span><div class="tp"></div>'; t.querySelector('.tp').appendChild(slideEl(sd)); thumbs.appendChild(t); });
  }
  let lastCur = -1;
  function renderAll() { renderThumbs(); renderStage(); fit(); if (lastCur !== cur) { stage.classList.remove('switching'); void stage.offsetWidth; stage.classList.add('switching'); lastCur = cur; } }
  function fit() {
    const a = $('#stage-area'), aw = a.clientWidth - 40, ah = a.clientHeight - 40; const base = Math.max(.2, Math.min(aw / W0, ah / H0)); scale = base * userZoom;
    stage.style.transform = 'scale(' + scale + ')'; $('#stage-size').style.width = W0 * scale + 'px'; $('#stage-size').style.height = H0 * scale + 'px'; $('#sb-zoom').textContent = Math.round(userZoom * 100) + ' %';
  }
  window.addEventListener('resize', fit);
  ACT.zoomIn = () => { userZoom = Math.min(3, userZoom + .1); fit(); }; ACT.zoomOut = () => { userZoom = Math.max(.3, userZoom - .1); fit(); }; ACT.zoomFit = () => { userZoom = 1; fit(); };

  /* ---------- Poignées, déplacement, redimensionnement ---------- */
  const HD = [['nw', 0, 0], ['n', .5, 0], ['ne', 1, 0], ['e', 1, .5], ['se', 1, 1], ['s', .5, 1], ['sw', 0, 1], ['w', 0, .5]];
  function addHandles(d) { HD.forEach(([k, fx, fy]) => { const h = document.createElement('div'); h.className = 'hdl'; h.dataset.h = k; h.style.left = `calc(${fx * 100}% - 5px)`; h.style.top = `calc(${fy * 100}% - 5px)`; h.style.cursor = (k === 'n' || k === 's' ? 'ns' : k === 'e' || k === 'w' ? 'ew' : k === 'nw' || k === 'se' ? 'nwse' : 'nesw') + '-resize'; d.appendChild(h); }); }
  function clearGuides() { stage.querySelectorAll('.guide').forEach(g => g.remove()); }
  function snapTo(o, off) {
    clearGuides(); if (off) return; const T = 6, xs = [0, W0 / 2, W0], ys = [0, H0 / 2, H0];
    sl().objs.forEach(q => { if (q === o) return; xs.push(q.x, q.x + q.w / 2, q.x + q.w); ys.push(q.y, q.y + q.h / 2, q.y + q.h); });
    let gx = null, gy = null;
    [[0, o.w], [o.w / 2, o.w / 2], [o.w, 0]].forEach(([off1]) => { xs.forEach(x => { const d = x - (o.x + off1); if (Math.abs(d) <= T && (gx === null || Math.abs(d) < Math.abs(gx.d))) gx = { d, at: x }; }); });
    [[0], [o.h / 2], [o.h]].forEach(([off1]) => { ys.forEach(y => { const d = y - (o.y + off1); if (Math.abs(d) <= T && (gy === null || Math.abs(d) < Math.abs(gy.d))) gy = { d, at: y }; }); });
    const mk = (v, h) => { const g = document.createElement('div'); g.className = 'guide'; g.style.cssText = h ? 'left:0;right:0;top:' + v + 'px;height:0;border-top:1px dashed #ff4fa3' : 'top:0;bottom:0;left:' + v + 'px;width:0;border-left:1px dashed #ff4fa3'; stage.appendChild(g); };
    if (gx) { o.x = Math.round(o.x + gx.d); mk(gx.at, false); } if (gy) { o.y = Math.round(o.y + gy.d); mk(gy.at, true); }
  }
  const pt = e => { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; };
  stage.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const d = e.target.closest('.pobj'), h = e.target.closest('.hdl');
    if (e.target.isContentEditable) return;
    { const ae = document.activeElement; if (ae && ae.isContentEditable && ae.closest && ae.closest('.tbl')) ae.blur(); }
    if (editingId && !(d && d.dataset.id === editingId)) commitEdit();
    if (!d) { selId = null; renderStage(); return; }
    if (d.classList.contains('editing')) return;
    const id = d.dataset.id; if (selId !== id) { selId = id; renderStage(); }
    const o = find(id), p0 = pt(e), start = { x: o.x, y: o.y, w: o.w, h: o.h }; let moved = false, pushed = false;
    const mode = h ? h.dataset.h : 'move';
    const mv = ev => {
      const p = pt(ev), dx = p.x - p0.x, dy = p.y - p0.y; if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return; moved = true;
      if (!pushed) { undoStack.push(snap()); redoStack = []; pushed = true; }
      if (mode === 'move') { o.x = Math.round(start.x + dx); o.y = Math.round(start.y + dy); snapTo(o, ev.altKey); }
      else { let x = start.x, y = start.y, w = start.w, hh = start.h; if (mode.includes('e')) w = start.w + dx; if (mode.includes('s')) hh = start.h + dy; if (mode.includes('w')) { x = start.x + dx; w = start.w - dx; } if (mode.includes('n')) { y = start.y + dy; hh = start.h - dy; } if (w < 20) { if (mode.includes('w')) x -= 20 - w; w = 20; } if (hh < 20) { if (mode.includes('n')) y -= 20 - hh; hh = 20; } o.x = Math.round(x); o.y = Math.round(y); o.w = Math.round(w); o.h = Math.round(hh); }
      const el = stage.querySelector('[data-id="' + id + '"]'); el.style.left = o.x + 'px'; el.style.top = o.y + 'px'; el.style.width = o.w + 'px'; el.style.height = o.h + 'px';
    };
    const up = () => { clearGuides(); document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); if (moved) changed(true); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); e.preventDefault();
  });
  stage.addEventListener('dblclick', e => { const d = e.target.closest('.pobj'); if (!d || d.classList.contains('image') || d.classList.contains('tbl')) return; selId = d.dataset.id; editingId = selId; renderStage(); const el = stage.querySelector('.pobj.editing .tx') || stage.querySelector('.pobj.editing'); if (el) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); } });
  function startEditDom(d) { d.classList.add('editing'); d.querySelectorAll('.hdl').forEach(h => h.remove()); const tx = d.querySelector('.tx'); tx.contentEditable = 'plaintext-only'; tx.style.outline = 'none'; tx.style.display = 'block'; tx.style.minHeight = '1em'; tx.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); commitEdit(); } ev.stopPropagation(); }); setTimeout(() => tx.focus(), 0); }
  function commitEdit() {
    if (!editingId) return; const d = stage.querySelector('.pobj.editing'), o = find(editingId); editingId = null;
    if (d && o) { const t = d.querySelector('.tx').innerText.replace(/\n$/, ''); if (t !== (o.text || '')) { undoStack.push(snap()); redoStack = []; o.text = t; changed(true); } }
    renderStage();
  }
  document.addEventListener('mousedown', e => { if (editingId && !e.target.closest('#stage')) commitEdit(); }, true);
  notes.addEventListener('input', () => { sl().notes = notes.value; dirty = true; autosave(); });

  /* ---------- Diapositives ---------- */
  thumbs.addEventListener('click', e => { const t = e.target.closest('.thumb'); if (!t) return; commitEdit(); cur = +t.dataset.i; selId = null; renderAll(); });
  let dragI = null;
  thumbs.addEventListener('dragstart', e => { const t = e.target.closest('.thumb'); if (t) dragI = +t.dataset.i; });
  thumbs.addEventListener('dragover', e => e.preventDefault());
  thumbs.addEventListener('drop', e => { const t = e.target.closest('.thumb'); if (!t || dragI == null) return; const to = +t.dataset.i; if (to === dragI) return; mutate(() => { const [s] = deck.slides.splice(dragI, 1); deck.slides.splice(to, 0, s); cur = to; }); dragI = null; });
  ACT.addSlide = () => mutate(() => { deck.slides.splice(cur + 1, 0, makeSlide($('#sel-layout').value)); cur++; selId = null; });
  ACT.dupSlide = () => mutate(() => { const c = JSON.parse(JSON.stringify(sl())); c.id = A.uid(); c.objs.forEach(o => { o.id = A.uid(); }); deck.slides.splice(cur + 1, 0, c); cur++; });
  ACT.delSlide = () => { if (deck.slides.length < 2) { A.toast('Une présentation doit contenir au moins une diapositive.'); return; } mutate(() => { deck.slides.splice(cur, 1); cur = Math.max(0, cur - 1); selId = null; }); };

  /* ---------- Objets ---------- */
  const add = o => mutate(() => { sl().objs.push(o); selId = o.id; });
  ACT.addText = () => add(text(300, 200, 360, 80, 'Zone de texte', { fs: 28 }));
  const shape = (type, fill) => ({ id: A.uid(), type, x: 380, y: 190, w: 200, h: 140, fill, line: '#1f3a5f', text: '', fs: 24, color: '#ffffff', al: 'center' });
  ACT.addRect = () => add(shape('rect', themeOf().accent)); ACT.addEllipse = () => add(shape('ellipse', '#e8833a')); ACT.addTriangle = () => add(shape('triangle', '#4caf7a'));
  ACT.addArrow = () => add({ id: A.uid(), type: 'arrow', x: 300, y: 250, w: 300, h: 40, line: '#e8833a', lw: 6, text: '' });
  ACT.rotR = () => { const o = selObj(); if (o) edit({ rot: ((o.rot || 0) + 15) % 360 }); else A.toast('Sélectionnez d\'abord un objet.'); };
  ACT.rotL = () => { const o = selObj(); if (o) edit({ rot: ((o.rot || 0) + 345) % 360 }); else A.toast('Sélectionnez d\'abord un objet.'); };
  ACT.shadow = () => { const o = selObj(); if (o) edit({ shadow: !o.shadow }); else A.toast('Sélectionnez d\'abord un objet.'); };
  ACT.grad = () => { const o = selObj(); if (!o) { A.toast('Sélectionnez d\'abord un objet.'); return; } if (o.grad) edit({ grad: '' }); else $('#in-grad').click(); };
  ACT.addImage = () => $('#image-input').click();
  $('#image-input').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const src = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f); });
    const dim = await new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.width, h: im.height }); im.onerror = () => res({ w: 400, h: 300 }); im.src = src; });
    // réduction des très grandes images
    let url = src; if (dim.w > 1920) { const c = document.createElement('canvas'); c.width = 1920; c.height = Math.round(dim.h * 1920 / dim.w); const im = new Image(); await new Promise(r => { im.onload = r; im.src = src; }); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); url = c.toDataURL(f.type === 'image/png' ? 'image/png' : 'image/jpeg', .9); }
    const k = Math.min(1, 700 / dim.w, 400 / dim.h), w = Math.round(dim.w * k), h = Math.round(dim.h * k);
    add({ id: A.uid(), type: 'image', x: Math.round((W0 - w) / 2), y: Math.round((H0 - h) / 2), w, h, src: url });
  });
  const selObj = () => selId && find(selId);
  const edit = patch => { const o = selObj(); if (!o) { A.toast('Sélectionnez d\'abord un objet.'); return; } mutate(() => Object.assign(o, patch)); };
  const tog = k => { const o = selObj(); if (o) edit({ [k]: !o[k] }); else A.toast('Sélectionnez d\'abord un objet.'); };
  Object.assign(ACT, {
    bold: () => tog('b'), italic: () => tog('i'), underline: () => tog('u'), alignL: () => edit({ al: 'left' }), alignC: () => edit({ al: 'center' }), alignR: () => edit({ al: 'right' }),
    noFill: () => edit({ fill: '' }),
    toFront: () => { const o = selObj(); if (o) mutate(() => { sl().objs.splice(sl().objs.indexOf(o), 1); sl().objs.push(o); }); },
    toBack: () => { const o = selObj(); if (o) mutate(() => { sl().objs.splice(sl().objs.indexOf(o), 1); sl().objs.unshift(o); }); },
    copy: () => { const o = selObj(); if (o) { clip = JSON.parse(JSON.stringify(o)); A.toast('Copié.'); } },
    cut: () => { const o = selObj(); if (o) { clip = JSON.parse(JSON.stringify(o)); mutate(() => { sl().objs.splice(sl().objs.indexOf(o), 1); selId = null; }); } },
    paste: () => { if (!clip) return; const c = JSON.parse(JSON.stringify(clip)); c.id = A.uid(); c.x += 20; c.y += 20; add(c); },
    del: () => { const o = selObj(); if (o) mutate(() => { sl().objs.splice(sl().objs.indexOf(o), 1); selId = null; }); }
  });
  $('#sel-font').addEventListener('change', e => { A.settings.set('defFont', e.target.value); edit({ ff: e.target.value }); });
  $('#sel-size').addEventListener('change', e => edit({ fs: +e.target.value }));
  $('#in-color').addEventListener('input', e => { $('#bar-color').style.background = e.target.value; const o = selObj(); if (o) { o.color = e.target.value; changed(true); renderStage(); } });
  $('#in-fill').addEventListener('input', e => { $('#bar-fill').style.background = e.target.value; const o = selObj(); if (o) { o.fill = e.target.value; changed(true); renderStage(); } });
  $('#in-line').addEventListener('input', e => { $('#bar-line').style.background = e.target.value; const o = selObj(); if (o) { o.line = e.target.value; changed(true); renderStage(); } });
  $('#in-grad').addEventListener('input', e => { const o = selObj(); if (o) { o.grad = e.target.value; changed(true); renderStage(); } });
  $('#in-bg').addEventListener('input', e => { sl().bg = e.target.value; changed(true); renderStage(); });
  ACT.bgAll = () => mutate(() => deck.slides.forEach(s => { s.bg = sl().bg; }));
  function syncTools() { const o = selObj(); ['bold:b', 'italic:i', 'underline:u'].forEach(x => { const [n, k] = x.split(':'); $('#t-' + n).classList.toggle('on', !!(o && o[k])); }); if (o && o.type !== 'image' && o.type !== 'table') { $('#sel-font').value = o.ff || 'Calibri'; $('#sel-size').value = String(o.fs || 18); } }

  /* ---------- Tableaux ---------- */
  stage.addEventListener('dblclick', e => { const td = e.target.closest('.pobj.tbl td, .pobj.tbl th'); if (td) editCell(td); });
  function editCell(td) {
    const o = find(td.closest('.pobj').dataset.id); if (!o) return; const r = +td.dataset.r, c = +td.dataset.c;
    td.contentEditable = 'plaintext-only'; td.style.outline = '2px solid ' + themeOf().accent; td.focus(); const rg = document.createRange(); rg.selectNodeContents(td); getSelection().removeAllRanges(); getSelection().addRange(rg);
    const done = () => { td.removeEventListener('blur', done); td.contentEditable = 'false'; td.style.outline = ''; const t = td.innerText.replace(/\n$/, ''); if (t !== o.cells[r][c]) { undoStack.push(snap()); redoStack = []; o.cells[r][c] = t; changed(true); } };
    td.addEventListener('blur', done);
    td.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Escape') { ev.preventDefault(); td.blur(); }
      else if (ev.key === 'Tab') { ev.preventDefault(); const all = Array.from(td.closest('table').querySelectorAll('td,th')), n = all[all.indexOf(td) + (ev.shiftKey ? -1 : 1)]; td.blur(); if (n) editCell(n); }
      else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); td.blur(); }
    });
  }
  ACT.addTable = async () => {
    const v = await A.dialog({ title: 'Insérer un tableau', width: 320, body: '<label class="field">Colonnes<input type="number" id="tb-c" value="3" min="1" max="8"></label><label class="field">Lignes<input type="number" id="tb-r" value="4" min="1" max="12"></label>', buttons: [{ label: 'Annuler', value: null }, { label: 'Insérer', primary: true, collect: b => ({ c: Math.max(1, Math.min(8, +b.querySelector('#tb-c').value || 3)), r: Math.max(1, Math.min(12, +b.querySelector('#tb-r').value || 4)) }) }] });
    if (!v) return; const cells = []; for (let r = 0; r < v.r; r++) { const row = []; for (let c = 0; c < v.c; c++) row.push(r === 0 ? 'Colonne ' + (c + 1) : ''); cells.push(row); }
    const h = Math.min(440, v.r * 48); add({ id: A.uid(), type: 'table', x: 60, y: 150, w: 840, h, cells, hdr: true, fs: 22, color: themeOf().text, fill: themeOf().accent, line: '#8a8a8a' });
  };
  const tbl = () => { const o = selObj(); if (!o || o.type !== 'table') { A.toast('Sélectionnez d\'abord un tableau.'); return null; } return o; };
  Object.assign(ACT, {
    tblAddRow: () => { const o = tbl(); if (o) mutate(() => { o.cells.push(o.cells[0].map(() => '')); o.h = Math.min(480, o.h + 44); }); },
    tblAddCol: () => { const o = tbl(); if (o && o.cells[0].length < 10) mutate(() => o.cells.forEach((r, i) => r.push(i === 0 ? 'Colonne ' + (r.length + 1) : ''))); },
    tblDelRow: () => { const o = tbl(); if (o && o.cells.length > 1) mutate(() => { o.cells.pop(); o.h = Math.max(40, o.h - 44); }); },
    tblDelCol: () => { const o = tbl(); if (o && o.cells[0].length > 1) mutate(() => o.cells.forEach(r => r.pop())); },
    tblHeader: () => { const o = tbl(); if (o) mutate(() => { o.hdr = !o.hdr; }); }
  });

  /* ---------- Transitions et animations ---------- */
  const TR = $('#sel-tr'), AN = $('#sel-anim');
  TR.addEventListener('change', () => mutate(() => { sl().tr = TR.value; }));
  ACT.trAll = () => mutate(() => deck.slides.forEach(s => { s.tr = sl().tr || 'none'; }));
  AN.addEventListener('change', () => { const o = selObj(); if (!o) { A.toast('Sélectionnez d\'abord un objet.'); AN.value = 'none'; return; } mutate(() => { o.anim = AN.value; }); });
  const syncAnim = () => { TR.value = sl().tr || 'none'; const o = selObj(); AN.value = (o && o.anim) || 'none'; };

  /* ---------- Thèmes ---------- */
  $('#themes').innerHTML = THEMES.map((t, i) => '<div class="theme" data-t="' + i + '" style="background:' + t.bg + ';color:' + t.title + '">' + t.n + '<small style="color:' + t.text + '">Texte</small></div>').join('');
  $('#themes').addEventListener('click', e => {
    const t = e.target.closest('.theme'); if (!t) return; const old = themeOf(), nw = THEMES[+t.dataset.t];
    mutate(() => { deck.slides.forEach(s => { if (s.bg === old.bg) s.bg = nw.bg; s.objs.forEach(o => { if (o.color === old.title) o.color = nw.title; else if (o.color === old.text) o.color = nw.text; if (o.fill === old.accent) o.fill = nw.accent; }); }); deck.theme = +t.dataset.t; });
  });

  /* ---------- Clavier ---------- */
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,select,textarea') || $('#modal-backdrop')) { return; }
    if (!$('#present').classList.contains('hidden')) return;
    if (editingId) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key;
    if (ctrl) { const f = { s: ACT.save, z: ACT.undo, y: ACT.redo, c: ACT.copy, x: ACT.cut, v: ACT.paste, d: () => { const o = selObj(); if (o) { clip = JSON.parse(JSON.stringify(o)); ACT.paste(); } }, m: ACT.addSlide, o: ACT.open, n: ACT.newDeck }[k.toLowerCase()]; if (f) { e.preventDefault(); f(); } return; }
    if (k === 'F5') { e.preventDefault(); play(e.shiftKey ? cur : 0); return; }
    const o = selObj();
    if (k === 'Delete' || k === 'Backspace') { if (o) { e.preventDefault(); ACT.del(); } else if (document.activeElement === document.body) { /* rien */ } return; }
    if (o && k.startsWith('Arrow')) { e.preventDefault(); const st = e.shiftKey ? 1 : 10; undoStack.length < 80 && undoStack.push(snap()); redoStack = []; if (k === 'ArrowLeft') o.x -= st; else if (k === 'ArrowRight') o.x += st; else if (k === 'ArrowUp') o.y -= st; else o.y += st; changed(true); renderStage(); return; }
    if (o && k === 'Enter' && o.type !== 'image' && o.type !== 'table') { e.preventDefault(); editingId = o.id; renderStage(); return; }
    if (!o && (k === 'ArrowDown' || k === 'PageDown')) { if (cur < deck.slides.length - 1) { cur++; renderAll(); } }
    if (!o && (k === 'ArrowUp' || k === 'PageUp')) { if (cur > 0) { cur--; renderAll(); } }
  });

  /* ---------- Diaporama ---------- */
  const pres = $('#present'); let pi = 0;
  let steps = [];
  function showSlide(withTr) { const sd = deck.slides[pi], el = slideEl(sd); steps = sd.objs.filter(o => o.anim && o.anim !== 'none'); steps.forEach(o => { const x = el.querySelector('[data-id="' + o.id + '"]'); if (x) x.classList.add('anim-wait'); }); if (withTr && sd.tr && sd.tr !== 'none') el.classList.add('tr-' + sd.tr); const ps = $('#pres-slide'); ps.innerHTML = ''; ps.appendChild(el); const aw = pres.classList.contains('presenter') ? innerWidth * 0.64 : innerWidth, k = Math.min(aw / W0, innerHeight / H0); ps.style.transform = 'scale(' + k + ')'; ps.style.left = (aw - W0 * k) / 2 + 'px'; ps.style.top = (innerHeight - H0 * k) / 2 + 'px'; $('#pres-info').textContent = (pi + 1) + ' / ' + deck.slides.length; presPanel(); }
  let t0 = 0, tmr = null;
  const fmt = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  function presPanel() { const p = $('#pres-panel'); if (!p) return; const nx = deck.slides[pi + 1], tx = s => s ? ((s.objs.find(o => o.type === 'text' && o.text) || {}).text || 'Diapositive suivante') : 'Fin de la présentation'; p.querySelector('.pp-n').textContent = (deck.slides[pi].notes || '').trim() || 'Aucune note pour cette diapositive.'; p.querySelector('.pp-x').textContent = tx(nx).split('\n')[0]; p.querySelector('.pp-c').textContent = 'Diapo ' + (pi + 1) + ' / ' + deck.slides.length; }
  ACT.presenter = () => { pres.classList.toggle('presenter'); showSlide(); };
  function play(i) { commitEdit(); t0 = Date.now(); clearInterval(tmr); tmr = setInterval(() => { const e = $('#pres-timer'); if (e) e.textContent = fmt(Date.now() - t0); }, 500); pi = i; pres.classList.remove('hidden'); showSlide(true); if (pres.requestFullscreen) pres.requestFullscreen().catch(() => {}); }
  function stopPlay() { clearInterval(tmr); pres.classList.add('hidden'); pres.classList.remove('presenter'); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); cur = pi; selId = null; renderAll(); }
  ACT.playFrom0 = () => play(0); ACT.playFromCur = () => play(cur);
  const nextS = () => {
    if (steps.length) { const o = steps.shift(), x = $('#pres-slide [data-id="' + o.id + '"]'); if (x) { x.classList.remove('anim-wait'); x.classList.add('anim-' + o.anim); } return; }
    if (pi < deck.slides.length - 1) { pi++; showSlide(true); } else stopPlay();
  }, prevS = () => { if (pi > 0) { pi--; showSlide(); } };
  document.addEventListener('keydown', e => { if (pres.classList.contains('hidden')) return; e.preventDefault(); e.stopPropagation(); if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) nextS(); else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) prevS(); else if (e.key === 'Escape') stopPlay(); else if (e.key.toLowerCase() === 'p') ACT.presenter(); else if (e.key === 'Home') { pi = 0; showSlide(); } else if (e.key === 'End') { pi = deck.slides.length - 1; showSlide(); } }, true);
  pres.addEventListener('click', nextS); pres.addEventListener('contextmenu', e => { e.preventDefault(); prevS(); });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !pres.classList.contains('hidden')) stopPlay(); });
  window.addEventListener('resize', () => { if (!pres.classList.contains('hidden')) showSlide(); });

  /* ---------- Exports ---------- */
  ACT.exportPdf = async () => {
    commitEdit();
    if (!api) { A.toast('L\'export PDF nécessite l\'application Windows.'); return; }
    const r = await api.pickSavePath({ defaultName: A.safeName(deck.title) + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] }); if (!r || r.canceled) return;
    const root = $('#print-root'); root.innerHTML = ''; deck.slides.forEach(s => root.appendChild(slideEl(s)));
    await new Promise(r2 => setTimeout(r2, 300)); const res = await api.writePdf({ path: r.path }); root.innerHTML = '';
    A.toast(res.ok ? 'PDF exporté.' : 'Échec : ' + res.error, res.ok ? 'ok' : 'err');
  };
  ACT.exportPng = async () => {
    commitEdit();
    const c = document.createElement('canvas'); c.width = W0 * 2; c.height = H0 * 2; const g = c.getContext('2d'); g.scale(2, 2); g.fillStyle = sl().bg; g.fillRect(0, 0, W0, H0);
    for (const o of sl().objs) {
      if (o.type === 'image') { const im = new Image(); await new Promise(r => { im.onload = r; im.src = o.src; }); g.drawImage(im, o.x, o.y, o.w, o.h); continue; }
      if (o.type !== 'text') { g.fillStyle = o.fill || '#ffffff'; if (o.type === 'ellipse') { g.beginPath(); g.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, 7); g.fill(); } else if (o.type === 'triangle') { g.beginPath(); g.moveTo(o.x + o.w / 2, o.y); g.lineTo(o.x + o.w, o.y + o.h); g.lineTo(o.x, o.y + o.h); g.fill(); } else g.fillRect(o.x, o.y, o.w, o.h); }
      else if (o.fill) { g.fillStyle = o.fill; g.fillRect(o.x, o.y, o.w, o.h); }
      g.fillStyle = o.color || '#000'; g.font = (o.i ? 'italic ' : '') + (o.b ? '700 ' : '') + (o.fs || 18) + 'px ' + (o.ff || 'Calibri'); g.textBaseline = 'top'; g.textAlign = o.al === 'center' ? 'center' : o.al === 'right' ? 'right' : 'left';
      const lines = String(o.text || '').split('\n'), lh = (o.fs || 18) * 1.2, x = o.al === 'center' ? o.x + o.w / 2 : o.al === 'right' ? o.x + o.w - 6 : o.x + 6, y0 = o.type === 'text' ? o.y + 4 : o.y + (o.h - lines.length * lh) / 2;
      lines.forEach((l, i) => g.fillText(l, x, y0 + i * lh));
    }
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = A.safeName(deck.title) + '-diapo' + (cur + 1) + '.png'; a.click();
  };

  /* ---------- Fichiers ---------- */
  function payload() { return { title: deck.title, slides: deck.slides.map(s => ({ bg: s.bg, notes: s.notes, tr: s.tr, objs: s.objs })) }; }
  ACT.save = async (e, t, saveAs) => {
    commitEdit();
    if (!api) { A.toast('L\'enregistrement .pptx nécessite l\'application Windows ; une copie est conservée dans la bibliothèque.'); await doSave(); setBadge('saved'); return false; }
    let path = saveAs ? null : deck.path;
    if (!path) { const r = await api.pickSavePath({ defaultName: A.safeName(deck.title) + '.pptx', filters: [{ name: 'Présentation PowerPoint', extensions: ['pptx'] }] }); if (!r || r.canceled) return false; path = /\.pptx$/i.test(r.path) ? r.path : r.path + '.pptx'; }
    const res = await api.pptxWrite({ path, deck: payload() });
    if (!res || !res.ok) { A.toast('Échec de l\'enregistrement : ' + (res && res.error), 'err'); return false; }
    deck.path = path; deck.title = A.baseName(path); $('#doc-title').value = deck.title; document.title = deck.title + ' - PowerPoint Dark'; await doSave(); dirty = false; setBadge('saved'); A.toast('Enregistré : ' + path.replace(/^.*[\\/]/, ''), 'ok'); return true;
  };
  ACT.saveAs = () => ACT.save(null, null, true);
  function load(d) { deck = d; cur = 0; selId = null; editingId = null; undoStack = []; redoStack = []; $('#doc-title').value = d.title; document.title = d.title + ' - PowerPoint Dark'; renderAll(); setBadge('saved'); dirty = false; }
  ACT.newDeck = async () => { await doSave(); load(newDeck()); };
  ACT.open = async () => { if (!api) { A.toast('Ouvrir des fichiers nécessite l\'application Windows.'); return; } const f = await api.openFiles({ filters: [{ name: 'Présentations', extensions: ['pptx'] }] }); if (f && f[0]) openFile(f[0]); };
  async function importPptx(bytes) {
    const zip = await JSZip.loadAsync(bytes), pres = await zip.file('ppt/presentation.xml').async('string');
    const sz = /<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/.exec(pres), k = W0 / (sz ? +sz[1] : 12192000), P = new DOMParser();
    const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
    const slides = [];
    for (const n of names) {
      const xml = P.parseFromString(await zip.file(n).async('string'), 'application/xml'), relF = zip.file(n.replace('slides/', 'slides/_rels/') + '.rels'), rels = {};
      if (relF) { const rx = P.parseFromString(await relF.async('string'), 'application/xml'); rx.querySelectorAll('Relationship').forEach(r => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); }); }
      const objs = [], emu = v => Math.round(+v * k), g = (el, tag) => el.getElementsByTagName(tag)[0];
      const spTree = g(xml, 'p:spTree'); if (!spTree) { slides.push({ id: A.uid(), bg: '#ffffff', objs: [], notes: '' }); continue; }
      for (const el of Array.from(spTree.children)) {
        if (el.tagName === 'p:graphicFrame') {
          const tb = g(el, 'a:tbl'), px = g(el, 'p:xfrm'), po = px && g(px, 'a:off'), pe = px && g(px, 'a:ext'); if (!tb || !po || !pe) continue;
          const cells = Array.from(tb.getElementsByTagName('a:tr')).map(tr => Array.from(tr.getElementsByTagName('a:tc')).map(tc => Array.from(tc.getElementsByTagName('a:t')).map(t => t.textContent).join('\n')));
          if (cells.length && cells[0].length) objs.push({ id: A.uid(), type: 'table', x: emu(po.getAttribute('x')), y: emu(po.getAttribute('y')), w: Math.max(40, emu(pe.getAttribute('cx'))), h: Math.max(30, emu(pe.getAttribute('cy'))), cells, hdr: true, fs: 18, color: '#262626', fill: '#2b579a', line: '#8a8a8a' });
          continue;
        }
        const xf = g(el, 'a:xfrm'), off = xf && g(xf, 'a:off'), ext = xf && g(xf, 'a:ext'); if (!off || !ext) continue;
        const box = { x: emu(off.getAttribute('x')), y: emu(off.getAttribute('y')), w: Math.max(10, emu(ext.getAttribute('cx'))), h: Math.max(10, emu(ext.getAttribute('cy'))) };
        if (el.tagName === 'p:pic') {
          const bl = g(el, 'a:blip'), rid = bl && bl.getAttribute('r:embed'), tgt = rid && rels[rid]; if (!tgt) continue;
          const f = zip.file('ppt/' + tgt.replace(/^\.\.\//, '')); if (!f) continue; const ext2 = (tgt.match(/\.(\w+)$/) || [, 'png'])[1].toLowerCase(); if (!/^(png|jpe?g|gif|webp)$/.test(ext2)) continue;
          objs.push({ id: A.uid(), type: 'image', ...box, src: 'data:image/' + (ext2 === 'jpg' ? 'jpeg' : ext2) + ';base64,' + await f.async('base64') }); continue;
        }
        if (el.tagName !== 'p:sp') continue;
        const paras = Array.from(el.getElementsByTagName('a:p')).map(p => Array.from(p.getElementsByTagName('a:t')).map(t => t.textContent).join('')), txt = paras.join('\n').trim();
        const rpr = g(el, 'a:rPr'), spPr = g(el, 'p:spPr'), fillEl = spPr && Array.from(spPr.children).find(c => c.tagName === 'a:solidFill'), fc = fillEl && g(fillEl, 'a:srgbClr');
        const tcol = rpr && g(rpr, 'a:solidFill') && g(g(rpr, 'a:solidFill'), 'a:srgbClr'), geom = spPr && g(spPr, 'a:prstGeom'), prst = geom && geom.getAttribute('prst');
        const o = { id: A.uid(), type: prst === 'ellipse' ? 'ellipse' : prst === 'triangle' ? 'triangle' : (fc && !txt) || (prst && prst !== 'rect') ? 'rect' : 'text', ...box, text: txt, fs: rpr && rpr.getAttribute('sz') ? Math.round(+rpr.getAttribute('sz') / 100) : 18, b: !!(rpr && rpr.getAttribute('b') === '1'), i: !!(rpr && rpr.getAttribute('i') === '1'), color: tcol ? '#' + tcol.getAttribute('val') : '#262626', fill: fc ? '#' + fc.getAttribute('val') : '', al: ({ ctr: 'center', r: 'right' })[(g(el, 'a:pPr') || { getAttribute: () => '' }).getAttribute('algn')] || 'left', ff: 'Calibri' };
        if (o.type === 'text' && !txt) continue; if (o.type !== 'text' && txt) o.type = o.type === 'rect' && !prst ? 'text' : o.type; objs.push(o);
      }
      const bgc = xml.querySelector('bg solidFill srgbClr, p\\:bg a\\:srgbClr'); slides.push({ id: A.uid(), bg: bgc ? '#' + bgc.getAttribute('val') : '#ffffff', objs, notes: '' });
    }
    if (!slides.length) throw new Error('aucune diapositive trouvée');
    return slides;
  }
  async function openFile(f) {
    try { if (f.ext !== 'pptx') throw new Error('format non pris en charge'); const slides = await importPptx(f.bytes); await doSave(); load({ id: A.uid(), title: A.baseName(f.name), path: f.path || null, theme: 0, slides, created: Date.now() }); A.toast('« ' + deck.title + ' » ouvert (mise en page simplifiée).', 'ok'); }
    catch (e) { A.toast('Impossible d\'ouvrir : ' + e.message, 'err'); }
  }
  ACT.fileMenu = async () => {
    const recents = (await store.all()).sort((a, b) => b.modified - a.modified).slice(0, 8);
    const body = document.createElement('div');
    body.innerHTML = '<div class="export-list" style="gap:6px;max-width:none">' + [['newDeck', 'fa-file', 'Nouvelle présentation'], ['open', 'fa-folder-open', 'Ouvrir…'], ['save', 'fa-floppy-disk', 'Enregistrer'], ['saveAs', 'fa-file-export', 'Enregistrer sous…'], ['exportPdf', 'fa-file-pdf', 'Exporter en PDF']].map(x => '<button type="button" data-a="' + x[0] + '" style="padding:9px 14px"><i class="fa-solid ' + x[1] + '" style="font-size:16px;width:22px"></i><b>' + x[2] + '</b></button>').join('') + '</div>' +
      (recents.length ? '<p style="margin:14px 0 6px;font-weight:600">Documents récents</p><div class="export-list" style="gap:4px;max-width:none">' + recents.map(r => '<button type="button" data-d="' + esc(r.id) + '" style="padding:6px 14px"><i class="fa-solid fa-display" style="font-size:14px;width:22px;color:#b7472a"></i>' + esc(r.title) + '</button>').join('') + '</div>' : '');
    const v = await A.dialog({ title: 'Fichier', width: 420, body, buttons: [{ label: 'Fermer', value: null }], onOpen: (b, fin) => { b.querySelectorAll('[data-a]').forEach(x => x.onclick = () => fin({ a: x.dataset.a })); b.querySelectorAll('[data-d]').forEach(x => x.onclick = () => fin({ d: x.dataset.d })); } });
    if (!v) return; if (v.a) ACT[v.a](); else if (v.d) { await doSave(); const rec = await store.get(v.d); if (rec) load(rec); }
  };
  $('#doc-title').addEventListener('change', e => { deck.title = e.target.value.trim() || 'Présentation1'; e.target.value = deck.title; document.title = deck.title + ' - PowerPoint Dark'; dirty = true; autosave(); });
  window.addEventListener('beforeunload', () => { doSave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) doSave(); });
  if (api && api.onBeforeClose) api.onBeforeClose(async () => { commitEdit(); if (dirty && !A.settings.get('autosave', true)) { if (await A.confirmBox('PowerPoint Dark', 'Enregistrer les modifications de « ' + deck.title + ' » ?', 'Enregistrer')) await ACT.save(); } await doSave(); api.confirmClose(true); });
  if (api && api.onOpenFile) api.onOpenFile(f => openFile(f));

  (async function boot() {
    if (api && api.getStartupFile) { try { const f = await api.getStartupFile(); if (f) { await openFile(f); if (deck) return; } } catch (e) { /* ignore */ } }
    const tp = A.settings.get('template', null);
    if (tp && /^ppt:/.test(tp) && TPL.ppt[tp.slice(4)]) { A.settings.set('template', null); const t = TPL.ppt[tp.slice(4)](); load({ id: A.uid(), title: t.title, path: null, theme: t.theme || 0, slides: t.slides, created: Date.now() }); return; }
    let d = null; try { const id = A.settings.get('lastPpt', null); if (id) d = await store.get(id); } catch (e) { /* ignore */ }
    load(d || newDeck());
  })();
  window.PP = { get deck() { return deck; }, mutate, renderAll, importPptx,
    h: { text, themeOf, THEMES, makeSlide, sl: () => sl(), selObj, get cur() { return cur; }, set cur(v) { cur = v; selId = null; }, setTheme: i => { const old = themeOf(), nw = THEMES[i]; mutate(() => { deck.slides.forEach(s => { if (s.bg === old.bg) s.bg = nw.bg; s.objs.forEach(o => { if (o.color === old.title) o.color = nw.title; else if (o.color === old.text) o.color = nw.text; if (o.fill === old.accent) o.fill = nw.accent; }); }); deck.theme = i; }); }, play: i => play(i) } };
})();
