'use strict';
(function () {
  const { $, esc } = A, api = A.api;
  const KINDS = {
    word: { db: 'word-dark-edition', label: 'Word', icon: 'fa-file-word', color: '#2b579a', key: 'lastDoc' },
    excel: { db: 'excel-dark', label: 'Excel', icon: 'fa-file-excel', color: '#217346', key: 'lastXl' },
    ppt: { db: 'ppt-dark', label: 'PowerPoint', icon: 'fa-file-powerpoint', color: '#b7472a', key: 'lastPpt' }
  };
  const open = kind => api && api.openApp(kind);
  document.querySelectorAll('.tile').forEach(t => t.addEventListener('click', () => { A.settings.set(KINDS[t.dataset.app].key, null); open(t.dataset.app); }));
  /* ---------- Compte Google ---------- */
  const setAcc = s => {
    const b = $('#btn-account'), u = s && s.user; $('#acc-label').textContent = u ? u.name : 'Se connecter avec Google';
    b.title = u ? u.email : 'Connexion avec un compte Google'; const old = b.querySelector('img.acc-pic'); if (old) old.remove();
    if (u && u.picture) { const im = document.createElement('img'); im.className = 'acc-pic'; im.src = u.picture; im.alt = ''; b.insertBefore(im, b.firstChild); b.querySelector('i').style.display = 'none'; } else b.querySelector('i').style.display = '';
  };
  const refreshAcc = async () => { if (api && api.googleStatus) setAcc(await api.googleStatus()); };
  async function configGoogle(cur) {
    const body = document.createElement('div');
    body.innerHTML = '<p style="margin-top:0">Pour vous connecter, créez gratuitement vos identifiants Google (une seule fois) :</p><ol style="padding-left:18px;line-height:1.6"><li>Ouvrez <b>console.cloud.google.com</b> › nouveau projet.</li><li><b>API et services › Écran de consentement</b> : type « Externe », ajoutez votre adresse comme utilisateur test.</li><li><b>Identifiants › Créer › ID client OAuth</b> : type <b>Application de bureau</b>.</li><li>Copiez l\'ID client et le code secret ci-dessous.</li></ol><label class="field">ID client<input type="text" id="g-id" value="' + esc(cur.clientId || '') + '"></label><label class="field">Code secret du client<input type="password" id="g-sec" placeholder="' + (cur.configured ? '(déjà enregistré)' : '') + '"></label>';
    const r = await A.dialog({ title: 'Identifiants Google', width: 520, body, buttons: [{ label: 'Annuler', value: null }, { label: 'Enregistrer', primary: true, collect: b => ({ clientId: b.querySelector('#g-id').value, clientSecret: b.querySelector('#g-sec').value }) }] });
    if (!r) return false; const s = await api.googleConfig(r); return s.configured;
  }
  $('#btn-account').addEventListener('click', async () => {
    if (!api || !api.googleStatus) { A.toast('La connexion Google nécessite l\'application Windows.'); return; }
    let s = await api.googleStatus();
    if (s.user) {
      const ch = await A.dialog({ title: 'Compte Google', body: '<div style="display:flex;gap:14px;align-items:center">' + (s.user.picture ? '<img src="' + s.user.picture + '" style="width:56px;height:56px;border-radius:50%">' : '') + '<div><b>' + esc(s.user.name) + '</b><br><span style="opacity:.7">' + esc(s.user.email) + '</span></div></div>', buttons: [{ label: 'Fermer', value: null }, { label: 'Identifiants…', value: 'cfg' }, { label: 'Se déconnecter', danger: true, value: 'out' }] });
      if (ch === 'out') { setAcc(await api.googleSignOut()); A.toast('Déconnecté.'); } else if (ch === 'cfg') { await configGoogle(s); }
      return;
    }
    if (!s.configured && !(await configGoogle(s))) return;
    A.toast('Terminez la connexion dans votre navigateur…'); const r = await api.googleSignIn();
    if (r.ok) { setAcc(r); A.toast('Connecté : ' + r.user.email); } else A.toast('Connexion impossible : ' + r.error);
  });
  refreshAcc();
  $('#btn-look').addEventListener('click', () => A.setLook(A.settings.get('look', 'word') === 'word' ? 'dark' : 'word'));
  $('#btn-open').addEventListener('click', async () => {
    const files = await api.openFiles({ filters: [{ name: 'Documents', extensions: ['docx', 'wordweb', 'html', 'txt', 'xlsx', 'csv', 'pptx'] }] });
    if (files && files[0]) { const e = files[0].ext; api.openApp(/^(xlsx|csv)$/.test(e) ? 'excel' : e === 'pptx' ? 'ppt' : 'word', files[0].path); }
  });
  const COL = { word: '#2b579a', excel: '#217346', ppt: '#b7472a' }, APPN = { word: 'Word', excel: 'Excel', ppt: 'PowerPoint' };
  $('#tpls').innerHTML = TPL.list.map(t => '<button class="tpl-card" data-t="' + t.app + ':' + t.id + '" style="--c:' + COL[t.app] + '"><i class="fa-solid ' + t.icon + '"></i><b>' + esc(t.name) + '</b><small>' + APPN[t.app] + '</small></button>').join('');
  $('#tpls').addEventListener('click', e => { const b = e.target.closest('.tpl-card'); if (!b) return; const [app] = b.dataset.t.split(':'); A.settings.set(KINDS[app].key, null); A.settings.set('template', b.dataset.t); open(app); });
  /* glisser-déposer de fichiers sur l'accueil */
  const KIND_OF = e => /^(xlsx|csv)$/.test(e) ? 'excel' : e === 'pptx' ? 'ppt' : 'word';
  document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dropping'); });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
  document.addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('dropping'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f || !api) return; const p = api.pathForFile(f), ext = (f.name.split('.').pop() || '').toLowerCase(); if (!p) { A.toast('Fichier illisible.', 'err'); return; } if (!/^(docx|wordweb|html|htm|txt|md|csv|xlsx|pptx)$/.test(ext)) { A.toast('Format non pris en charge : .' + ext, 'err'); return; } api.openApp(KIND_OF(ext), p); });
  const name = A.settings.get('userName', ''); $('#hello').textContent = 'Bonjour' + (name ? ', ' + name : '');
  function all(db) { return new Promise(res => { try { const r = indexedDB.open(db); r.onupgradeneeded = () => { r.transaction.abort(); res([]); }; r.onerror = () => res([]); r.onsuccess = () => { const d = r.result; if (!d.objectStoreNames.contains('docs')) { d.close(); return res([]); } const q = d.transaction('docs').objectStore('docs').getAll(); q.onsuccess = () => { d.close(); res(q.result || []); }; q.onerror = () => res([]); }; } catch (e) { res([]); } }); }
  const when = ts => { const d = new Date(ts); return d.toLocaleDateString('fr-FR') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  (async function () {
    const rows = [];
    for (const [k, v] of Object.entries(KINDS)) (await all(v.db)).forEach(d => { if (d.title) rows.push({ k, d }); });
    rows.sort((a, b) => (b.d.modified || 0) - (a.d.modified || 0));
    $('#empty').style.display = rows.length ? 'none' : '';
    $('#recent').innerHTML = rows.slice(0, 15).map((r, i) => { const v = KINDS[r.k]; return '<tr data-i="' + i + '"><td><i class="fa-solid ' + v.icon + '" style="color:' + v.color + '"></i>' + esc(r.d.title) + '</td><td>' + v.label + '</td><td>' + (r.d.modified ? when(r.d.modified) : '') + '</td></tr>'; }).join('');
    $('#recent').addEventListener('click', e => { const tr = e.target.closest('tr'); if (!tr) return; const r = rows[+tr.dataset.i]; A.settings.set(KINDS[r.k].key, r.d.id); open(r.k); });
  })();
})();
