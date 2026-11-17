'use strict';
/* ===== Onglets de documents : plusieurs documents ouverts dans la même fenêtre ===== */
(function () {
  const app = /excel\//.test(location.pathname) ? 'excel' : /ppt\//.test(location.pathname) ? 'ppt' : 'word', KEY = 'wd_tabs_' + app;
  let tabs = []; try { tabs = JSON.parse(localStorage.getItem(KEY) || '[]').filter(t => t && t.id); } catch (e) { tabs = []; }
  let host = null, cfg = null, busy = false;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(tabs.slice(0, 20))); } catch (e) { /* ignore */ } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function ensureHost() {
    if (host) return host; const r = document.getElementById('ribbon'); if (!r) return null;
    host = document.createElement('div'); host.id = 'doc-tabs'; r.parentNode.insertBefore(host, r.nextSibling);
    host.addEventListener('click', async e => {
      const x = e.target.closest('.dt-x'), t = e.target.closest('.dt'), plus = e.target.closest('.dt-plus');
      if (plus) return NxTabs.add(); if (!t) return; const id = t.dataset.id;
      if (x) { e.stopPropagation(); return NxTabs.close(id); }
      if (id !== cfg.current().id) NxTabs.open(id);
    });
    host.addEventListener('auxclick', e => { const t = e.target.closest('.dt'); if (t && e.button === 1) { e.preventDefault(); NxTabs.close(t.dataset.id); } });
    return host;
  }
  function render() {
    if (!cfg) return; const h = ensureHost(); if (!h) return; const cur = cfg.current();
    h.classList.toggle('hidden', tabs.length < 2);
    document.body.classList.toggle('has-tabs', tabs.length >= 2);
    h.innerHTML = tabs.map(t => '<div class="dt' + (t.id === cur.id ? ' on' : '') + '" data-id="' + esc(t.id) + '" title="' + esc(t.title) + '"><span class="dt-t">' + esc(t.title || 'Sans titre') + '</span><button class="dt-x" title="Fermer l\'onglet">×</button></div>').join('') + '<button class="dt-plus" title="Nouvel onglet (Ctrl+T)">+</button>';
    if (window.W && window.W.paginate && !render.once) render.once = 1;
  }
  const NxTabs = {
    init(c) { cfg = c; document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 't') { e.preventDefault(); NxTabs.add(); } }); const ti = document.getElementById('doc-title'); if (ti) ti.addEventListener('input', () => NxTabs.sync()); ti && ti.addEventListener('change', () => setTimeout(() => NxTabs.sync(), 50)); },
    sync() {
      if (!cfg) return; const c = cfg.current();
      if (!NxTabs.pruned && cfg.exists) { NxTabs.pruned = true; const ids = tabs.map(t => t.id); Promise.all(ids.map(async id => { try { return (await cfg.exists(id)) ? null : id; } catch (e) { return null; } })).then(gone => { const g = new Set(gone.filter(Boolean)); const cid = cfg.current().id; tabs = tabs.filter(t => !g.has(t.id) || t.id === cid); save(); render(); }); } if (!c || !c.id) return; const t = tabs.find(x => x.id === c.id); if (t) t.title = c.title; else tabs.push({ id: c.id, title: c.title }); save(); render(); },
    async open(id) { if (busy) return; busy = true; try { await cfg.open(id); } catch (e) { tabs = tabs.filter(t => t.id !== id); save(); render(); } finally { busy = false; this.sync(); } },
    async add() { if (busy) return; busy = true; try { await cfg.create(); } finally { busy = false; this.sync(); } },
    async close(id) {
      const i = tabs.findIndex(t => t.id === id); if (i < 0) return; const isCur = id === cfg.current().id;
      if (!isCur) { tabs.splice(i, 1); save(); render(); return; }
      if (cfg.save) await cfg.save();
      tabs.splice(i, 1); save(); const next = tabs[Math.min(i, tabs.length - 1)];
      if (next) { await this.open(next.id); } else { await this.add(); }
      this.sync();
    }
  };
  window.NxTabs = NxTabs;
})();
