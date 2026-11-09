'use strict';
/* Excel : validation de données (listes déroulantes), protection de feuille, noms définis, graphiques exportés en image */
(function () {
  const X = window.XL, A = window.A, ACT = A.ACT, sh = X.sh, wrap = X.wrap;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const selRect = () => X.sel;
  const inR = (g, c, r) => c >= g.c0 && c <= g.c1 && r >= g.r0 && r <= g.r1;
  const dvAt = (c, r) => (sh().dv || []).find(g => inR(g, c, r));
  /* ---- validation ---- */
  XLX.dvCheck = (c, r, txt) => { const g = dvAt(c, r); if (!g || txt === '' || txt == null) return true; if (g.list.some(x => String(x).toLowerCase() === String(txt).trim().toLowerCase())) return true; A.toast('Valeur refusée. Choisissez dans la liste : ' + g.list.slice(0, 6).join(', ') + (g.list.length > 6 ? '…' : ''), 'err'); return false; };
  ACT.dvAdd = async () => {
    const g = selRect(); const body = document.createElement('div');
    body.innerHTML = '<label class="field">Valeurs autorisées (séparées par des virgules ou des points-virgules)<textarea id="dv-l" rows="3" style="width:100%" placeholder="Oui, Non, Peut-être"></textarea></label><div class="muted">S\'applique à la sélection actuelle. Une flèche ▾ apparaît dans la cellule.</div>';
    const r = await A.dialog({ title: 'Validation de données : liste', width: 460, body, buttons: [{ label: 'Annuler', value: null }, { label: 'Appliquer', primary: true, collect: b => b.querySelector('#dv-l').value }] });
    if (r === null) return; const list = r.split(/[;,\n]/).map(s => s.trim()).filter(Boolean);
    if (!list.length) { A.toast('Saisissez au moins une valeur.', 'err'); return; }
    X.mutate(() => { sh().dv = (sh().dv || []).filter(d => !(d.r0 >= g.r0 && d.r1 <= g.r1 && d.c0 >= g.c0 && d.c1 <= g.c1)); sh().dv.push({ r0: g.r0, c0: g.c0, r1: g.r1, c1: g.c1, list }); }, { force: false });
    A.toast('Liste déroulante appliquée.', 'ok');
  };
  ACT.dvClear = () => { const g = selRect(); X.mutate(() => { sh().dv = (sh().dv || []).filter(d => !(d.c0 <= g.c1 && d.c1 >= g.c0 && d.r0 <= g.r1 && d.r1 >= g.r0)); }); A.toast('Validation supprimée de la sélection.'); };
  let btn = null, menu = null;
  const closeMenu = () => { if (menu) { menu.remove(); menu = null; } };
  function placeBtn() {
    if (btn) { btn.remove(); btn = null; } closeMenu();
    const a = X.act, g = dvAt(a.c, a.r); if (!g) return; const td = X.tds()[a.r] && X.tds()[a.r][a.c]; if (!td) return;
    const t = td.getBoundingClientRect(), w = wrap.getBoundingClientRect(), z = X.zoom || 1;
    btn = document.createElement('button'); btn.className = 'dv-btn'; btn.type = 'button'; btn.textContent = '▾'; btn.title = 'Choisir dans la liste';
    btn.style.cssText = 'position:absolute;z-index:30;width:18px;height:' + Math.max(16, t.height - 2) + 'px;left:' + (t.right - w.left + wrap.scrollLeft - 19) + 'px;top:' + (t.top - w.top + wrap.scrollTop + 1) + 'px;border:1px solid #8a8a8a;background:#f3f3f3;color:#333;border-radius:3px;font-size:10px;line-height:1;padding:0;cursor:pointer';
    btn.onmousedown = e => e.stopPropagation();
    btn.onclick = e => {
      e.stopPropagation(); if (menu) { closeMenu(); return; }
      menu = document.createElement('div'); menu.className = 'dv-menu';
      menu.style.cssText = 'position:absolute;z-index:40;background:#fff;color:#222;border:1px solid #999;border-radius:6px;box-shadow:0 8px 22px rgba(0,0,0,.3);max-height:220px;overflow:auto;min-width:' + Math.max(110, t.width) + 'px;left:' + btn.style.left + ';top:' + (parseFloat(btn.style.top) + t.height) + 'px;animation:mFadeDown .15s backwards';
      menu.innerHTML = g.list.map((v, i) => '<div class="dv-it" data-i="' + i + '" style="padding:6px 12px;cursor:pointer;font-size:13px">' + esc(v) + '</div>').join('');
      menu.onmouseover = ev => { const it = ev.target.closest('.dv-it'); menu.querySelectorAll('.dv-it').forEach(x => x.style.background = x === it ? '#dbe8fb' : ''); };
      menu.onmousedown = ev => ev.stopPropagation();
      menu.onclick = ev => { const it = ev.target.closest('.dv-it'); if (!it) return; const v = g.list[+it.dataset.i]; closeMenu(); X.mutate(() => X.setRaw(a.c, a.r, String(v))); };
      wrap.appendChild(menu);
    };
    wrap.appendChild(btn);
  }
  document.addEventListener('mousedown', e => { if (menu && !e.target.closest('.dv-menu')) closeMenu(); });
  XLX.onSel = placeBtn;
  wrap.addEventListener('scroll', () => { if (btn) placeBtn(); });
  /* ---- protection de feuille ---- */
  ACT.protect = () => { const s = sh(); s.prot = !s.prot; X.mutate(() => { }, { force: true, tabs: true }); A.toast(s.prot ? 'Feuille protégée : modifications bloquées (sans mot de passe).' : 'Protection retirée.', 'ok'); document.querySelectorAll('[data-act=protect] span').forEach(sp => sp.textContent = s.prot ? 'Déprotéger la feuille' : 'Protéger la feuille'); };
  /* ---- noms définis ---- */
  ACT.names = async () => {
    const wb = X.wb; wb.names = wb.names || {};
    const body = document.createElement('div'), draw = () => { body.innerHTML = '<div class="nm-list">' + (Object.keys(wb.names).map(n => '<div class="nm-row" style="display:flex;gap:8px;align-items:center;margin:4px 0"><b style="min-width:110px">' + esc(n) + '</b><code style="flex:1">' + esc(wb.names[n]) + '</code><button type="button" class="mini" data-del="' + esc(n) + '">Supprimer</button></div>').join('') || '<div class="muted">Aucun nom défini.</div>') + '</div><hr style="opacity:.2"><label class="field">Nouveau nom<input id="nm-n" type="text" placeholder="Ventes"></label><label class="field">Référence<input id="nm-r" type="text" placeholder="Feuille1!B2:B9"></label>'; const g = selRect(); if (g) body.querySelector('#nm-r').value = (X.sh().name.match(/^[A-Za-z0-9_]+$/) ? X.sh().name : "'" + X.sh().name + "'") + '!' + window.E.colName(g.c0) + (g.r0 + 1) + (g.r0 === g.r1 && g.c0 === g.c1 ? '' : ':' + window.E.colName(g.c1) + (g.r1 + 1)); };
    draw();
    const r = await A.dialog({ title: 'Noms définis', width: 520, body, buttons: [{ label: 'Fermer', value: null }, { label: 'Ajouter', primary: true, collect: b => ({ n: b.querySelector('#nm-n').value.trim(), r: b.querySelector('#nm-r').value.trim() }) }], onOpen: (b, fin) => b.addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) fin({ del: d.dataset.del }); }) });
    if (!r) return;
    if (r.del) { X.mutate(() => { delete wb.names[r.del]; }); return ACT.names(); }
    if (!r.n) return; if (!/^[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_.]*$/.test(r.n) || /^[A-Za-z]{1,3}\d+$/i.test(r.n)) { A.toast('Nom invalide (lettres, chiffres, _ ; ne ressemble pas à une cellule).', 'err'); return; }
    if (!r.r) { A.toast('Indiquez une référence.', 'err'); return; }
    X.mutate(() => { wb.names[r.n] = r.r; }); A.toast('Nom « ' + r.n + ' » ajouté.', 'ok'); return ACT.names();
  };
  /* ---- graphiques en image pour l'export .xlsx ---- */
  const raster = (svg, w, h) => new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png').split(',')[1]); }; im.onerror = () => res(null); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  XLX.chartImages = async () => {
    const wb = X.wb, keep = wb.cur, out = [];
    try {
      for (let si = 0; si < wb.sheets.length; si++) {
        const s = wb.sheets[si]; if (!(s.charts || []).length) continue;
        wb.cur = si; X.refreshAll && 0;
        for (const ch of s.charts) {
          const svg = XLX.render(ch); const png = await raster(svg, ch.w, ch.h); if (!png) continue;
          let c = 0, x = 0; while (c < 25 && x + (s.colW[c] || 90) <= ch.x) { x += s.colW[c] || 90; c++; }
          let r = 0, y = 0; while (r < 500 && y + ((s.rowH || {})[r] || 22) <= ch.y) { y += (s.rowH || {})[r] || 22; r++; }
          out.push({ sheet: si, png, col: c + (ch.x - x) / (s.colW[c] || 90), row: r + (ch.y - y) / ((s.rowH || {})[r] || 22), w: ch.w, h: ch.h });
        }
      }
    } finally { wb.cur = keep; }
    return out;
  };
})();
