'use strict';
/* ===== Assistant Claude dans Word : utilise l'abonnement Claude (via Claude Code) ou une clé API ===== */
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const api = window.electronAPI;
  const toHtml = t => t.split(/\n{2,}/).map(p => '<p>' + esc(p.trim()).replace(/\n/g, '<br>') + '</p>').join('');
  async function status() { try { return (api && api.aiStatus) ? await api.aiStatus() : { on: false, mode: 'off' }; } catch (e) { return { on: false, mode: 'off' }; } }
  async function connect() {
    const st = await status();
    const body = document.createElement('div');
    body.innerHTML = '<p style="margin-top:0">Utilisez votre abonnement <b>Claude Pro / Max</b>, sans clé API :</p><ol style="padding-left:18px;line-height:1.7"><li>Installez <b>Claude Code</b> (gratuit, une seule fois).</li><li>Cliquez sur « Me connecter » : une fenêtre s\'ouvre, connectez-vous avec votre compte Claude.</li><li>Revenez ici et cliquez sur « Tester ».</li></ol><p>État : ' + (st.cli ? '<span style="color:#3fa66b">Claude Code détecté ' + esc(st.cliVersion || '') + '</span>' : '<span style="color:#d08a2e">Claude Code non installé</span>') + '</p>';
    const r = await W.dialog({ title: 'Connecter Claude', width: 500, body, buttons: [{ label: 'Fermer', value: null }, { label: 'Installer Claude Code', value: 'install' }, { label: 'Me connecter', value: 'login' }, { label: 'Tester', primary: true, value: 'test' }] });
    if (r === 'install') { api.openExternal('https://claude.com/product/claude-code'); return; }
    if (r === 'login') { const x = await api.aiCliLogin(); W.toast(x.ok ? 'Fenêtre ouverte : connectez-vous, puis cliquez sur Tester.' : 'Impossible : ' + x.error); return; }
    if (r === 'test') { W.toast('Test en cours…'); const x = await api.aiCliTest(); W.toast(x.ok ? 'Claude est connecté ✓' : (x.error || 'Échec'), x.ok ? undefined : 'err'); }
  }
  W.connectClaude = connect;
  async function assistant() {
    if (!api || !api.aiAsk) { W.toast('Disponible dans l\'application Windows.'); return; }
    const st = await status(); if (!st.on) { await connect(); return; }
    const sel = getSelection(), hasSel = sel.rangeCount && !sel.isCollapsed && W.editor.contains(sel.anchorNode); const selText = hasSel ? sel.toString() : '';
    const saved = hasSel ? sel.getRangeAt(0).cloneRange() : null;
    const body = document.createElement('div');
    body.innerHTML = '<label class="field">Que voulez-vous que Claude fasse ?<textarea id="cl-q" rows="3" placeholder="Ex : reformule en plus professionnel · corrige les fautes · résume · écris une lettre de motivation"></textarea></label>'
      + '<label class="field">Sur quel texte ?<select id="cl-s"><option value="sel"' + (hasSel ? '' : ' disabled') + '>Le texte sélectionné' + (hasSel ? '' : ' (aucun)') + '</option><option value="doc">Tout le document</option><option value="none">Aucun (écrire un nouveau texte)</option></select></label>'
      + '<label class="field">Résultat<textarea id="cl-r" rows="8" placeholder="La réponse de Claude apparaîtra ici (modifiable)."></textarea></label><div class="muted" id="cl-st"></div>';
    body.querySelector('#cl-s').value = hasSel ? 'sel' : 'doc';
    const r = await W.dialog({ title: 'Claude', width: 620, body, buttons: [{ label: 'Fermer', value: null },
      { label: 'Demander', collect: b => { const q = b.querySelector('#cl-q').value.trim(); if (!q) { W.toast('Écrivez une demande.'); return false; } const sc = b.querySelector('#cl-s').value, ctx = sc === 'sel' ? selText : sc === 'doc' ? W.editor.innerText : ''; const stt = b.querySelector('#cl-st'); stt.textContent = 'Claude réfléchit…';
        api.aiAsk({ system: 'Tu es un assistant de traitement de texte. Réponds uniquement par le texte demandé, en français sauf demande contraire, sans commentaire, sans balises markdown ni guillemets autour.', prompt: (ctx ? 'Texte :\n"""\n' + ctx.slice(0, 20000) + '\n"""\n\n' : '') + 'Demande : ' + q }).then(x => { if (x.ok) { b.querySelector('#cl-r').value = (x.text || '').trim(); stt.textContent = ''; } else stt.textContent = 'Erreur : ' + x.error; }).catch(e => { stt.textContent = 'Erreur : ' + e.message; });
        return false; } },
      { label: 'Insérer', primary: true, collect: b => { const t = b.querySelector('#cl-r').value.trim(); if (!t) { W.toast('Pas encore de résultat.'); return false; } return { text: t, scope: b.querySelector('#cl-s').value }; } }] });
    if (!r || !r.text) return; W.focusEditor();
    if (saved) { const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(saved); if (r.scope !== 'sel') s2.collapseToEnd(); }
    W.insertHTML(toHtml(r.text)); W.toast('Texte inséré.');
  }
  /* plein écran d'écriture : masque rubans et barres, F11 ou Échap pour sortir */
  const zen = on => { const d = document.documentElement, z = on === undefined ? !document.body.classList.contains('zen') : on; document.body.classList.toggle('zen', z); try { if (z && !document.fullscreenElement) d.requestFullscreen(); else if (!z && document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* plein écran indisponible */ } if (W.paginate) setTimeout(() => W.paginate(), 150); if (z) W.toast('Plein écran : F11 ou Échap pour revenir.'); };
  W.ACT.zen = () => zen();
  document.addEventListener('keydown', e => { if (e.key === 'F11') { e.preventDefault(); zen(); } else if (e.key === 'Escape' && document.body.classList.contains('zen') && !document.querySelector('#modal-backdrop:not(.hidden)')) zen(false); });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('zen')) zen(false); });
  W.ACT.claude = assistant; W.ACT.claudeConnect = connect;
})();

/* ===== animation d'apparition des lettres à la frappe (calque temporaire, ne touche pas au document) ===== */
(function () {
  const W = window.W, ed = W.editor; if (!ed) return;
  const KEY = 'typeAnim'; const on = () => W.settings.get(KEY, true) !== false;
  const st = document.createElement('style'); st.textContent = '.type-ghost{position:fixed;pointer-events:none;z-index:50;white-space:pre;animation:typeIn .28s cubic-bezier(.2,.9,.3,1.3) forwards;text-shadow:0 0 8px rgba(120,150,255,.9)}@keyframes typeIn{0%{opacity:.95;transform:translateY(-7px) scale(1.5);filter:blur(1.5px)}60%{opacity:.7}100%{opacity:0;transform:translateY(0) scale(1);filter:blur(0)}}@media (prefers-reduced-motion:reduce){.type-ghost{display:none}}';
  document.head.appendChild(st);
  let last = 0;
  ed.addEventListener('input', e => {
    if (!on() || e.inputType !== 'insertText' || !e.data || /^\s$/.test(e.data)) return;
    const now = performance.now(); if (now - last < 25) return; last = now;
    const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return; const n = sel.anchorNode, o = sel.anchorOffset; if (!n || n.nodeType !== 3 || o < 1) return;
    const r = document.createRange(); r.setStart(n, o - 1); r.setEnd(n, o); const b = r.getBoundingClientRect(); if (!b.width && !b.height) return;
    const cs = getComputedStyle(n.parentElement), g = document.createElement('span'); g.className = 'type-ghost'; g.textContent = n.data.slice(o - 1, o);
    g.style.cssText += ';left:' + b.left + 'px;top:' + b.top + 'px;font:' + cs.font + ';color:' + (getComputedStyle(document.body).getPropertyValue('--accent') || '#7b96ff') + ';line-height:' + b.height + 'px';
    document.body.appendChild(g); setTimeout(() => g.remove(), 320);
  });
  W.ACT.soundToggle = () => { const v = window.NxSound.toggle(); W.toast('Sons : ' + (v ? 'activés' : 'coupés')); };
  W.ACT.typeAnim = () => { const v = !on(); W.settings.set(KEY, v); W.toast('Animation de frappe : ' + (v ? 'activée' : 'désactivée')); };
})();
