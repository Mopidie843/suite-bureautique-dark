'use strict';
/* ===== petits sons (synthèse WebAudio, aucun fichier) + indicateur d'onglet animé ===== */
(function () {
  const KEY = 'wd_sound'; let ctx = null;
  const enabled = () => { try { return JSON.parse(localStorage.getItem(KEY)) !== false; } catch (e) { return true; } };
  const AC = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (ctx.state === 'suspended') ctx.resume(); return ctx; };
  function tone(f, t0, dur, type, vol, f2) {
    const c = AC(); if (!c) return; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const S = {
    click: () => tone(620, 0, .07, 'sine', .05, 420),
    tab: () => { tone(520, 0, .09, 'triangle', .045, 760); },
    on: () => { tone(520, 0, .09, 'sine', .05); tone(780, .07, .12, 'sine', .05); },
    off: () => { tone(620, 0, .09, 'sine', .05); tone(400, .07, .12, 'sine', .05); },
    pop: () => tone(300, 0, .12, 'sine', .06, 640),
    ok: () => { tone(660, 0, .12, 'sine', .055); tone(880, .09, .12, 'sine', .055); tone(1320, .18, .22, 'sine', .04); },
    err: () => { tone(300, 0, .16, 'triangle', .06, 200); },
    whoosh: () => { tone(220, 0, .35, 'sine', .05, 900); tone(330, .03, .3, 'triangle', .02, 1200); }
  };
  window.NxSound = { play: n => { if (enabled() && S[n]) S[n](); }, toggle: () => { const v = !enabled(); try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* ignore */ } if (v) { S.on(); } return v; }, enabled };
  const P = n => window.NxSound.play(n);
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest && e.target.closest('button,.btn,.tool,.tile,.hub-nav,.ribbon-tab,.stab,.st-it,.thumb,.tpl'); if (!t) return;
    if (t.matches('[data-act=toggleLook],#btn-look')) { P('whoosh'); return; }
    if (t.classList.contains('ribbon-tab')) P('tab'); else if (t.classList.contains('tile')) P('pop'); else P('click');
  }, true);
  new MutationObserver(ms => ms.forEach(m => { m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('toast')) P(n.classList.contains('err') || n.classList.contains('error') ? 'err' : 'ok'); }); if (m.type === 'attributes' && m.target.id === 'modal-backdrop' && m.oldValue && /hidden/.test(m.oldValue) && !m.target.classList.contains('hidden')) P('pop'); }))
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  document.addEventListener('change', e => { const t = e.target; if (t && t.type === 'checkbox') P(t.checked ? 'on' : 'off'); }, true);

  /* indicateur d'onglet : une barre dégradée qui glisse d'un onglet à l'autre */
  function indicator() {
    const nav = document.getElementById('ribbon-tabs'); if (!nav) return; nav.style.position = 'relative';
    const ind = document.createElement('span'); ind.className = 'tab-ind'; nav.appendChild(ind); let first = true;
    const place = () => { const a = nav.querySelector('.ribbon-tab.active'); if (!a) { ind.style.opacity = 0; return; } const l = a.offsetLeft + 10, w = Math.max(10, a.offsetWidth - 20); ind.style.opacity = 1; if (first) { ind.style.transition = 'none'; first = false; requestAnimationFrame(() => { ind.style.transition = ''; }); } ind.style.transform = 'translateX(' + l + 'px)'; ind.style.width = w + 'px'; ind.classList.remove('go'); void ind.offsetWidth; ind.classList.add('go'); };
    new MutationObserver(ms => { if (ms.some(m => m.target.classList && m.target.classList.contains('ribbon-tab'))) place(); }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] }); window.addEventListener('resize', place); setTimeout(place, 60); setTimeout(place, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', indicator); else indicator();
})();
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#btn-sound')) { const v = NxSound.toggle(); const b = document.querySelector('#btn-sound i'); if (b) b.className = 'fa-solid ' + (v ? 'fa-volume-high' : 'fa-volume-xmark'); } });
document.addEventListener('DOMContentLoaded', () => { const b = document.querySelector('#btn-sound i'); if (b && !NxSound.enabled()) b.className = 'fa-solid fa-volume-xmark'; });
