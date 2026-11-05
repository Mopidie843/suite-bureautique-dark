'use strict';
/* ===== Utilitaires communs + assainissement HTML ===== */
const W = window.W = {
  $: (s, r = document) => r.querySelector(s),
  $$: (s, r = document) => Array.from(r.querySelectorAll(s)),
  esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
  api: window.electronAPI || null,
  version: '3.0.0',
  debounce(fn, ms) {
    let t = null, args = null;
    const d = (...a) => { args = a; clearTimeout(t); t = setTimeout(() => { t = null; fn(...args); }, ms); };
    d.flush = () => { if (t) { clearTimeout(t); t = null; fn(...args); } };
    d.cancel = () => { clearTimeout(t); t = null; };
    d.pending = () => t !== null;
    return d;
  },
  settings: {
    get(k, def) { try { const v = localStorage.getItem('wd_' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem('wd_' + k, JSON.stringify(v)); } catch (e) { /* stockage plein ou indisponible */ } }
  },
  pad2: n => String(n).padStart(2, '0'),
  fmtDate(ts) {
    const d = new Date(ts), now = new Date();
    const hm = W.pad2(d.getHours()) + ':' + W.pad2(d.getMinutes());
    if (d.toDateString() === now.toDateString()) return "Aujourd'hui à " + hm;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Hier à ' + hm;
    return d.toLocaleDateString('fr-FR') + ' ' + hm;
  },
  today() { return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
};

/* Apparence de l'application : « Word » (clair, par défaut) ou « dark » */
W.look = () => W.settings.get('look', 'word');
document.body.classList.toggle('look-word', W.look() === 'word');

/* ---------- Assainissement du HTML externe (collage, import) ---------- */
W.sanitize = (function () {
  const ALLOWED = new Set(('a abbr b blockquote br caption cite code col colgroup dd del div dl dt em figcaption figure font h1 h2 h3 h4 h5 h6 hr i img ins li mark ol p pre q s small span strike strong sub sup table tbody td tfoot th thead tr u ul').split(' '));
  const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form', 'input', 'button', 'textarea', 'select', 'svg', 'math', 'noscript', 'template', 'base', 'frame', 'frameset', 'audio', 'video', 'canvas', 'title', 'head', 'applet']);
  const OWN_CLASSES = new Set(['pb', 'toc', 'toc-title', 'toc-line', 'l1', 'l2', 'l3', 't', 'n', 'dots', 'fnum', 'fn', 'cmt', 'caption', 'footnotes', 'mf', 'shape', 'tb', 'rev', 'eq', 'eqf']);
  const STYLE_OK = /^(color|background-color|font-family|font-size|font-weight|font-style|text-decoration|text-decoration-line|text-align|text-indent|line-height|letter-spacing|margin(-top|-bottom|-left|-right)?|padding(-top|-bottom|-left|-right)?|border(-top|-bottom|-left|-right)?(-width|-style|-color)?|border-collapse|border-radius|width|height|max-width|min-height|vertical-align|display|list-style-type|clip-path|white-space)$/;
  const BAD_VALUE = /url\s*\(|expression|javascript:|@import|behavior|<|\\|-moz-binding/i;

  function cleanStyle(css, keepColors) {
    const out = [];
    css.split(';').forEach(decl => {
      const i = decl.indexOf(':'); if (i < 0) return;
      const prop = decl.slice(0, i).trim().toLowerCase(), val = decl.slice(i + 1).trim();
      if (!STYLE_OK.test(prop) || !val || BAD_VALUE.test(val)) return;
      if (!keepColors && (prop === 'color' || prop === 'background-color')) return;
      if (prop === 'display' && !/^(inline-block|block|inline|none)$/.test(val)) return;
      if (/^margin/.test(prop) && /-?\d{4,}/.test(val)) return;
      out.push(prop + ':' + val);
    });
    return out.join(';');
  }
  function safeUrl(u, allowData) {
    u = (u || '').trim();
    if (/^(https?:|mailto:|tel:|#)/i.test(u)) return u;
    if (allowData && /^data:image\/(png|jpe?g|gif|webp|bmp);base64,[a-z0-9+/=\s]+$/i.test(u)) return u;
    return null;
  }
  function copyAttrs(src, el, tag, opt) {
    const st = src.getAttribute('style'); if (st) { const c = cleanStyle(st, opt.keepColors); if (c) el.setAttribute('style', c); }
    const cls = src.getAttribute('class');
    if (cls) { const k = cls.split(/\s+/).filter(x => OWN_CLASSES.has(x)); if (k.length) el.setAttribute('class', k.join(' ')); }
    ['title', 'dir', 'lang'].forEach(a => { if (src.hasAttribute(a)) el.setAttribute(a, src.getAttribute(a)); });
    if (tag === 'a') { const h = safeUrl(src.getAttribute('href'), false); if (h) el.setAttribute('href', h); }
    if (tag === 'img') { const s = safeUrl(src.getAttribute('src'), true); if (s) el.setAttribute('src', s); if (src.hasAttribute('alt')) el.setAttribute('alt', src.getAttribute('alt')); ['width', 'height'].forEach(a => { const v = src.getAttribute(a); if (v && /^\d{1,4}%?$/.test(v)) el.setAttribute(a, v); }); }
    if (tag === 'td' || tag === 'th') ['colspan', 'rowspan'].forEach(a => { const v = src.getAttribute(a); if (v && /^\d{1,3}$/.test(v)) el.setAttribute(a, v); });
    if (tag === 'font') { ['face', 'size'].forEach(a => { const v = src.getAttribute(a); if (v && /^[\w ,'-]{1,60}$/.test(v)) el.setAttribute(a, v); }); if (opt.keepColors) { const c = src.getAttribute('color'); if (c && /^#?[\w]{3,20}$/.test(c)) el.setAttribute('color', c); } }
    if (tag === 'ol') { const s = src.getAttribute('start'); if (s && /^\d{1,4}$/.test(s)) el.setAttribute('start', s); }
    ['data-field', 'data-cid', 'data-fn'].forEach(a => { if (src.hasAttribute(a) && /^[\w.-]{1,60}$/.test(src.getAttribute(a))) el.setAttribute(a, src.getAttribute(a)); });
    if (src.classList && (src.classList.contains('pb') || src.classList.contains('toc') || src.classList.contains('mf'))) el.setAttribute('contenteditable', 'false');
  }
  function walk(node, out, opt) {
    for (const ch of Array.from(node.childNodes)) {
      if (ch.nodeType === 3) { out.appendChild(document.createTextNode(ch.nodeValue)); continue; }
      if (ch.nodeType !== 1) continue;
      const tag = ch.tagName.toLowerCase();
      if (DROP.has(tag)) continue;
      if (!ALLOWED.has(tag)) { walk(ch, out, opt); continue; }
      if (tag === 'img' && !safeUrl(ch.getAttribute('src'), true)) continue;
      const el = document.createElement(tag);
      copyAttrs(ch, el, tag, opt);
      if (tag !== 'br' && tag !== 'hr' && tag !== 'img') walk(ch, el, opt);
      out.appendChild(el);
    }
  }
  return function sanitize(html, opt) {
    opt = Object.assign({ keepColors: false }, opt);
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    const wrap = document.createElement('div');
    walk(doc.body, wrap, opt);
    return wrap.innerHTML;
  };
})();

/* ---------- Texte <-> HTML ---------- */
W.textToHTML = function (text) {
  return String(text).replace(/\r\n?/g, '\n').split('\n').map(l => l.trim() === '' && l === '' ? '<p><br></p>' : '<p>' + W.esc(l) + '</p>').join('');
};
W.htmlToText = function (html) {
  const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
  const BLOCK = /^(P|DIV|H[1-6]|LI|TR|BLOCKQUOTE|PRE|TABLE|UL|OL)$/;
  let out = '';
  (function rec(n) {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeType === 1) {
        if (c.tagName === 'BR') { out += '\n'; continue; }
        if (c.classList.contains('pb')) { out += '\n\n'; continue; }
        if (c.tagName === 'LI') out += (c.parentNode.tagName === 'OL' ? (Array.prototype.indexOf.call(c.parentNode.children, c) + 1) + '. ' : '• ');
        if (c.tagName === 'TD' || c.tagName === 'TH') { rec(c); out += '\t'; continue; }
        rec(c);
        if (BLOCK.test(c.tagName) && !out.endsWith('\n')) out += '\n';
      }
    }
  })(doc.body);
  return out.replace(/​/g, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
};

/* ---------- CSV / TSV (publipostage) ---------- */
W.parseCSV = function (text) {
  text = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const first = text.split('\n')[0] || '';
  const delim = [';', '\t', ','].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const clean = rows.filter(r => r.some(x => x.trim() !== ''));
  if (!clean.length) return { fields: [], rows: [] };
  const fields = clean[0].map((f, i) => f.trim() || 'colonne' + (i + 1));
  return { fields, rows: clean.slice(1).map(r => Object.fromEntries(fields.map((f, i) => [f, (r[i] || '').trim()]))) };
};

/* ---------- Images : redimensionnement avant insertion ---------- */
W.readImage = function (file, maxW = 1600) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      if (file.type === 'image/gif' || file.type === 'image/svg+xml') return resolve(file.type === 'image/svg+xml' ? null : fr.result);
      const img = new Image();
      img.onerror = () => resolve(fr.result);
      img.onload = () => {
        if (img.width <= maxW) return resolve(fr.result);
        const c = document.createElement('canvas'); c.width = maxW; c.height = Math.round(img.height * maxW / img.width);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
};
