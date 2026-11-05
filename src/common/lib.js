'use strict';
/* ===== Bibliothèque commune Excel / PowerPoint ===== */
const A = window.A = {
  $: (s, r = document) => r.querySelector(s),
  $$: (s, r = document) => Array.from(r.querySelectorAll(s)),
  esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
  api: window.electronAPI || null,
  debounce(fn, ms) { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = () => {}; return d; },
  settings: {
    get(k, def) { try { const v = localStorage.getItem('wd_' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem('wd_' + k, JSON.stringify(v)); } catch (e) { /* plein */ } }
  },
  safeName: t => (t || 'Document').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Document',
  baseName: n => String(n).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')
};
A.setLook = v => { A.settings.set('look', v); document.body.classList.toggle('look-word', v === 'word'); };
document.body.classList.toggle('look-word', A.settings.get('look', 'word') === 'word');

A.toast = (msg, type) => {
  let h = A.$('#toast-host'); if (!h) { h = document.createElement('div'); h.id = 'toast-host'; document.body.appendChild(h); }
  const t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.textContent = msg; h.appendChild(t);
  setTimeout(() => t.remove(), 3200);
};
/* dialog({title, body(html|Node), buttons:[{label,value,primary,danger,collect(bodyEl)}], width}) -> valeur */
A.dialog = o => new Promise(resolve => {
  const bd = document.createElement('div'); bd.id = 'modal-backdrop';
  const m = document.createElement('div'); m.id = 'modal'; if (o.width) m.style.width = o.width + 'px';
  m.innerHTML = '<div class="m-head"><h3></h3><button class="icon-btn" id="modal-x">✕</button></div><div class="m-body" id="modal-body"></div><div class="m-foot" id="modal-foot"></div>';
  m.querySelector('h3').textContent = o.title || '';
  const body = m.querySelector('#modal-body'); if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
  const foot = m.querySelector('#modal-foot');
  const fin = v => { document.removeEventListener('keydown', onKey, true); bd.remove(); resolve(v); };
  (o.buttons || [{ label: 'OK', primary: true, value: true }]).forEach(b => {
    const el = document.createElement('button'); el.textContent = b.label; if (b.primary) el.className = 'primary'; if (b.danger) el.className = 'danger';
    el.onclick = () => { if (b.collect) { const v = b.collect(body); if (v === false) return; fin(v); } else fin(b.value); };
    foot.appendChild(el);
  });
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); fin(null); } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { const p = foot.querySelector('.primary'); if (p) { e.preventDefault(); p.click(); } } };
  document.addEventListener('keydown', onKey, true);
  m.querySelector('#modal-x').onclick = () => fin(null);
  bd.appendChild(m); document.body.appendChild(bd);
  if (o.onOpen) o.onOpen(body, fin);
  const f = body.querySelector('input,textarea,select'); if (f) { f.focus(); if (f.select) f.select(); }
});
A.askText = (title, label, value) => A.dialog({
  title, body: '<label class="field">' + A.esc(label) + '<input type="text" id="at-v" value="' + A.esc(value || '') + '"></label>',
  buttons: [{ label: 'Annuler', value: null }, { label: 'OK', primary: true, collect: b => b.querySelector('#at-v').value }]
});
A.confirmBox = (title, msg, ok, danger) => A.dialog({ title, body: '<p>' + A.esc(msg) + '</p>', buttons: [{ label: 'Annuler', value: false }, { label: ok || 'OK', primary: !danger, danger: !!danger, value: true }] });

/* actions du ruban : data-act */
A.ACT = {};
document.addEventListener('mousedown', e => { if (e.target.closest('#ribbon .btn, #ribbon .tool, .style-card') && !e.target.closest('select,input')) e.preventDefault(); });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const f = A.ACT[t.dataset.act]; if (!f) return;
  try { const r = f(e, t); if (r && r.catch) r.catch(err => A.toast('Erreur : ' + err.message, 'err')); } catch (err) { console.error(err); A.toast('Erreur : ' + err.message, 'err'); }
});
A.ACT.toggleLook = () => A.setLook(A.settings.get('look', 'word') === 'word' ? 'dark' : 'word');
A.ACT.home = () => A.api && A.api.openHub && A.api.openHub();
document.querySelectorAll('.ribbon-tab').forEach(t => t.addEventListener('click', () => {
  A.$$('.ribbon-tab').forEach(x => x.classList.toggle('active', x === t));
  A.$$('.ribbon-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'ribbon-' + t.dataset.tab));
}));
/* bibliothèque IndexedDB générique */
A.store = (dbName) => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open(dbName, 1); r.onupgradeneeded = () => r.result.createObjectStore('docs', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('docs', mode), q = fn(t.objectStore('docs')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  return { put: d => tx('readwrite', s => s.put(d)), get: id => tx('readonly', s => s.get(id)), del: id => tx('readwrite', s => s.delete(id)), all: () => tx('readonly', s => s.getAll()) };
};
