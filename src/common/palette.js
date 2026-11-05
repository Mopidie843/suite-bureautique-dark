'use strict';
/* Palette de commandes (Ctrl+Maj+P) : retrouve n'importe quel bouton du ruban par son nom */
(function () {
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const KEY = 'wd_recentCmds';
  const recent = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const remember = id => { try { const r = [id].concat(recent().filter(x => x !== id)).slice(0, 8); localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) { /* ignore */ } };
  function commands() {
    const out = [], seen = new Set();
    document.querySelectorAll('#ribbon [data-act], #titlebar [data-act], #backstage [data-act]').forEach(el => {
      const id = el.dataset.act; if (!id || seen.has(id) || /^(aiToggle|closeBackstage)$/.test(id)) return;
      let label = (el.querySelector('span') ? el.querySelector('span').textContent : el.textContent).replace(/\s+/g, ' ').trim() || el.title || '';
      if (!label) return; seen.add(id);
      const panel = el.closest('.ribbon-panel'), tab = panel ? document.querySelector('.ribbon-tab[data-tab="' + panel.id.replace('ribbon-', '') + '"]') : null, grp = el.closest('.group');
      out.push({ id, label, where: [tab && tab.textContent.trim(), grp && grp.dataset.label].filter(Boolean).join(' › '), el, hint: norm(label + ' ' + (el.title || '') + ' ' + id) });
    });
    if (window.electronAPI && window.electronAPI.openVersions) out.push({ id: 'openVersions', label: 'Ouvrir le dossier des versions précédentes', where: 'Sauvegardes', el: { dispatchEvent: () => window.electronAPI.openVersions() }, hint: norm('versions historique sauvegardes dossier precedentes') });
    return out;
  }
  let box = null;
  function open() {
    if (box) { box.querySelector('input').focus(); return; }
    const cmds = commands(), rec = recent();
    box = document.createElement('div'); box.id = 'palette';
    box.innerHTML = '<div class="pal"><input type="text" placeholder="Tapez une commande… (ex : tableau, gras, enregistrer)" spellcheck="false" autocomplete="off"><div class="pal-list"></div><div class="pal-foot">↑↓ choisir · Entrée exécuter · Échap fermer</div></div>';
    document.body.appendChild(box);
    const input = box.querySelector('input'), list = box.querySelector('.pal-list'); let shown = [], idx = 0;
    const render = () => {
      const q = norm(input.value).trim().split(/\s+/).filter(Boolean);
      shown = (q.length ? cmds.filter(c => q.every(t => c.hint.includes(t))) : rec.map(id => cmds.find(c => c.id === id)).filter(Boolean).concat(cmds.filter(c => !rec.includes(c.id)))).slice(0, 40);
      if (q.length) shown.sort((a, b) => (norm(a.label).startsWith(q[0]) ? 0 : 1) - (norm(b.label).startsWith(q[0]) ? 0 : 1));
      idx = Math.min(idx, Math.max(0, shown.length - 1));
      list.innerHTML = shown.length ? shown.map((c, i) => '<div class="pal-it' + (i === idx ? ' on' : '') + '" data-i="' + i + '"><b>' + c.label.replace(/</g, '&lt;') + '</b><small>' + c.where.replace(/</g, '&lt;') + '</small></div>').join('') : '<div class="pal-empty">Aucune commande trouvée</div>';
      const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    };
    const close = () => { box.remove(); box = null; document.removeEventListener('keydown', key, true); };
    const run = c => { close(); if (!c) return; remember(c.id); setTimeout(() => c.el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })), 30); };
    const key = e => {
      if (!box) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(shown.length - 1, idx + 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); run(shown[idx]); }
    };
    document.addEventListener('keydown', key, true);
    input.addEventListener('input', () => { idx = 0; render(); });
    list.addEventListener('click', e => { const it = e.target.closest('.pal-it'); if (it) run(shown[+it.dataset.i]); });
    box.addEventListener('mousedown', e => { if (e.target === box) close(); });
    render(); input.focus();
  }
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); open(); } }, true);
  const addBtn = () => { const right = document.querySelector('#titlebar .tb-right, #titlebar .right, #titlebar'); if (!right || document.getElementById('btn-palette')) return; const b = document.createElement('button'); b.className = 'icon-btn'; b.id = 'btn-palette'; b.title = 'Rechercher une commande (Ctrl+Maj+P)'; b.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>'; b.addEventListener('click', open); right.insertBefore(b, right.firstChild); };
  addBtn(); window.Palette = { open };
})();
