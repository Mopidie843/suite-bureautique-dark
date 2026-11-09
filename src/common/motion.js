'use strict';
/* Petits effets animés communs : ondulation au clic, bascule de thème, sortie des notifications */
(function () {
  const rm = () => document.body.classList.contains('no-motion');
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.btn,.tool,.icon-btn,.btn-file'); if (!b || rm()) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), d = document.createElement('span');
    d.className = 'ripple'; d.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
    b.appendChild(d); setTimeout(() => d.remove(), 650);
  }, true);
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-act="toggleLook"],#btn-look')) return;
    document.body.classList.add('look-switching'); setTimeout(() => document.body.classList.remove('look-switching'), 250);
  }, true);
  const obs = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('toast')) setTimeout(() => n.classList.add('out'), 2800); })));
  const th = () => { const h = document.getElementById('toast-host'); if (h) obs.observe(h, { childList: true }); else setTimeout(th, 500); }; th();
  try { if (JSON.parse(localStorage.getItem('wd_noMotion'))) document.body.classList.add('no-motion'); } catch (e) { /* ignore */ }
})();
/* lueur qui suit la souris sur les tuiles de l'accueil */
document.addEventListener('mousemove', e => { const t = e.target.closest && e.target.closest('.tile'); if (!t) return; const r = t.getBoundingClientRect(); t.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%'); t.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%'); });
/* icônes du ruban colorées partout (thèmes clair « Word » et sombre) : couleur stable par icône quand aucune n'est définie */
(function () {
  const PAL = ['c-blue', 'c-green', 'c-orange', 'c-purple', 'c-red', 'c-amber', 'c-pink'];
  const SEM = { 'fa-scissors': 'c-red', 'fa-copy': 'c-blue', 'fa-paste': 'c-amber', 'fa-trash': 'c-red', 'fa-trash-can': 'c-red', 'fa-list-ul': 'c-green', 'fa-list-ol': 'c-green', 'fa-image': 'c-green', 'fa-table': 'c-blue', 'fa-link': 'c-blue', 'fa-print': 'c-purple', 'fa-floppy-disk': 'c-blue', 'fa-rotate-left': 'c-orange', 'fa-rotate-right': 'c-orange', 'fa-bold': 'c-blue', 'fa-italic': 'c-blue', 'fa-underline': 'c-blue', 'fa-plus': 'c-green', 'fa-minus': 'c-red', 'fa-check': 'c-green', 'fa-xmark': 'c-red', 'fa-lock': 'c-amber' };
  function paint() {
    document.querySelectorAll('.ribbon-panel i[class*="fa-"], #ribbon i[class*="fa-"]').forEach(i => {
      if (i.dataset.painted || /\bc-[a-z]+\b/.test(i.className)) return; i.dataset.painted = '1';
      const names = i.className.split(/\s+/).filter(c => /^fa-/.test(c) && !/^fa-(solid|regular|brands|fw|lg|sm|xs)$/.test(c)), n = names[0] || '';
      let c = SEM[n]; if (!c) { let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0; c = PAL[h % PAL.length]; }
      i.classList.add(c);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();
  setTimeout(paint, 600);
})();
