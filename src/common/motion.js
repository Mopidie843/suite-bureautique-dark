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
    document.body.classList.add('look-switching'); setTimeout(() => document.body.classList.remove('look-switching'), 700);
  }, true);
  const obs = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('toast')) setTimeout(() => n.classList.add('out'), 2800); })));
  const th = () => { const h = document.getElementById('toast-host'); if (h) obs.observe(h, { childList: true }); else setTimeout(th, 500); }; th();
  try { if (JSON.parse(localStorage.getItem('wd_noMotion'))) document.body.classList.add('no-motion'); } catch (e) { /* ignore */ }
})();
