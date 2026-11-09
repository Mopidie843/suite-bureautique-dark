'use strict';
(function () {
  const { $, esc } = A, api = A.api;
  const KINDS = {
    word: { db: 'word-dark-edition', label: 'Word', icon: 'fa-file-word', color: '#2b579a', key: 'lastDoc' },
    excel: { db: 'excel-dark', label: 'Excel', icon: 'fa-file-excel', color: '#217346', key: 'lastXl' },
    ppt: { db: 'ppt-dark', label: 'PowerPoint', icon: 'fa-file-powerpoint', color: '#b7472a', key: 'lastPpt' }
  };
  const open = async kind => { if (!api) return; const r = await api.openApp(kind); if (r && r.locked) A.toast('Connectez-vous pour utiliser l\'application.', 'err'); };
  document.querySelectorAll('.tile').forEach(t => t.addEventListener('click', () => { A.settings.set(KINDS[t.dataset.app].key, null); open(t.dataset.app); }));
  /* ---------- Compte Google ---------- */
  const SYNC_KEYS = ['look', 'wstyles', 'userName', 'recentTpl', 'defFont', 'defSize'];
  let ST = null;
  const setAcc = s => {
    ST = s; const b = $('#btn-account'), u = s && s.user; $('#acc-label').textContent = u ? u.name : 'Se connecter avec Google';
    b.title = u ? u.email : 'Connexion avec un compte Google'; const old = b.querySelector('img.acc-pic'); if (old) old.remove();
    if (u && u.picture) { const im = document.createElement('img'); im.className = 'acc-pic'; im.src = u.picture; im.alt = ''; b.insertBefore(im, b.firstChild); b.querySelector('i').style.display = 'none'; } else b.querySelector('i').style.display = '';
    const h = $('#hello'); h.textContent = 'Bonjour' + (u ? ', ' + (u.given || u.name) : (A.settings.get('userName', '') ? ', ' + A.settings.get('userName', '') : ''));
    $('#lock').classList.toggle('hidden', !(s && s.lock && !u));
  };
  const refreshAcc = async () => { if (api && api.googleStatus) { const s = await api.googleStatus(); setAcc(s); try { A.settings.set('gcache', { user: s.user, lock: s.lock }); } catch (e) { /* cache facultatif */ } } };
  try { const c = A.settings.get('gcache', null); if (c && c.user) setAcc({ user: c.user, lock: c.lock }); } catch (e) { /* cache facultatif */ }
  async function configGoogle(cur) {
    const body = document.createElement('div');
    body.innerHTML = '<p style="margin-top:0">La connexion Google n\'est pas encore activée dans cette version de Nocte.</p><p class="muted">Elle sera disponible dans une prochaine mise à jour : il suffira de cliquer sur « Se connecter avec Google » et de choisir votre compte Gmail, sans rien configurer.</p>';
    const r = await A.dialog({ title: 'Connexion Google', width: 460, body, buttons: [{ label: 'Fermer', primary: true, value: null }, { label: 'Je suis le développeur…', value: 'dev' }] });
    if (r !== 'dev') return false; return configGoogleDev(cur);
  }
  async function configGoogleDev(cur) {
    const body = document.createElement('div');
    body.innerHTML = '<p style="margin-top:0">Réservé au développeur : collez l\'ID client OAuth (type « Application de bureau ») créé sur console.cloud.google.com. Pour que tout le monde se connecte sans rien saisir, placez plutôt un fichier <b>google-default.json</b> à côté de l\'application (ou via les secrets GitHub).</p><label class="field">ID client<input type="text" id="g-id" value="' + esc(cur.clientId || '') + '"></label><label class="field">Code secret du client<input type="password" id="g-sec"></label>';
    const r = await A.dialog({ title: 'Identifiants Google (développeur)', width: 540, body, buttons: [{ label: 'Annuler', value: null }, { label: 'Enregistrer', primary: true, collect: b => ({ clientId: b.querySelector('#g-id').value, clientSecret: b.querySelector('#g-sec').value }) }] });
    if (!r) return false; const s = await api.googleConfig(r); setAcc(s); return s.configured;
  }
  const settingsObj = () => { const o = {}; SYNC_KEYS.forEach(k => { const v = A.settings.get(k, undefined); if (v !== undefined) o[k] = v; }); return o; };
  async function pullSettings() { const r = await api.settingsPull(); if (r.ok && r.settings) { Object.entries(r.settings).forEach(([k, v]) => { if (SYNC_KEYS.includes(k)) A.settings.set(k, v); }); A.setLook(A.settings.get('look', 'word')); return true; } return false; }
  async function addAccount() {
    if (!ST.configured && !(await configGoogle(ST))) return;
    A.toast('Terminez la connexion dans votre navigateur…'); const r = await api.googleSignIn();
    if (!r.ok) { A.toast('Connexion impossible : ' + r.error, 'err'); return; }
    setAcc(r.status); A.toast('Connecté : ' + r.status.user.email); if (await pullSettings()) A.toast('Réglages restaurés depuis votre Drive.');
  }
  async function accountPanel() {
    const s = await api.googleStatus(); setAcc(s);
    const body = document.createElement('div');
    body.innerHTML = '<div class="acc-list">' + s.accounts.map(a => '<div class="acc-row' + (a.email === s.active ? ' on' : '') + '" data-e="' + esc(a.email) + '">' + (a.picture ? '<img src="' + a.picture + '">' : '<i class="fa-solid fa-circle-user"></i>') + '<div><b>' + esc(a.name) + '</b><small>' + esc(a.email) + '</small></div>' + (a.email === s.active ? '<span class="tag">Actif</span>' : '<button type="button" class="mini" data-sw="' + esc(a.email) + '">Utiliser</button>') + '<button type="button" class="mini danger" data-out="' + esc(a.email) + '" title="Se déconnecter"><i class="fa-solid fa-right-from-bracket"></i></button></div>').join('') + '</div>'
      + '<button type="button" class="mini big" id="acc-add"><i class="fa-solid fa-plus"></i> Ajouter un compte Google</button>'
      + (s.user ? '<label class="chk"><input type="checkbox" id="o-sync"' + (s.driveSync ? ' checked' : '') + '> Enregistrer une copie de chaque document dans mon Google Drive (dossier « Nocte »)</label><label class="chk"><input type="checkbox" id="o-lock"' + (s.lock ? ' checked' : '') + '> Verrouiller l\'application tant qu\'aucun compte n\'est connecté</label>'
        + '<div class="muted" style="margin-top:8px">' + (s.lastSync ? 'Dernière copie : ' + esc(s.lastSync.name) + (s.lastSync.ok ? ' ✓' : ' ✗ ' + esc(s.lastSync.error || '')) : 'Aucune copie envoyée pour l\'instant.') + '</div>' : '')
      + '<div class="muted" style="margin-top:6px"><a href="#" id="acc-cfg">Développeur…</a></div>';
    const r = await A.dialog({ title: 'Comptes Google', width: 520, body, buttons: [{ label: 'Fermer', primary: true, collect: b => ({ sync: b.querySelector('#o-sync') && b.querySelector('#o-sync').checked, lock: b.querySelector('#o-lock') && b.querySelector('#o-lock').checked }) }],
      onOpen: (b, fin) => {
        b.querySelectorAll('[data-sw]').forEach(x => x.onclick = async () => { setAcc(await api.googleSwitch(x.dataset.sw)); await pullSettings(); fin({ again: true }); });
        b.querySelectorAll('[data-out]').forEach(x => x.onclick = async () => { setAcc(await api.googleSignOut(x.dataset.out)); A.toast('Déconnecté.'); fin({ again: true }); });
        b.querySelector('#acc-add').onclick = () => fin({ add: true }); b.querySelector('#acc-cfg').onclick = e => { e.preventDefault(); fin({ cfg: true }); };
      } });
    if (!r) return;
    if (r.again) return accountPanel(); if (r.add) return addAccount(); if (r.cfg) { await configGoogleDev(s); return; }
    if (s.user && r.sync !== undefined && r.sync !== null) { setAcc(await api.googleSet({ driveSync: r.sync, lock: r.lock })); if (r.sync) await api.settingsPush(settingsObj()); }
  }
  $('#btn-account').addEventListener('click', async () => {
    if (!api || !api.googleStatus) { A.toast('La connexion Google nécessite l\'application Windows.'); return; }
    const s = await api.googleStatus(); setAcc(s);
    if (!s.user) { await addAccount(); return; } await accountPanel();
  });
  $('#lock-go').addEventListener('click', addAccount);
  $('#btn-drive').addEventListener('click', async () => {
    if (!api || !api.driveList) { A.toast('Google Drive nécessite l\'application Windows.'); return; }
    if (!ST || !ST.user) { await addAccount(); if (!ST || !ST.user) return; }
    const r = await api.driveList(); if (!r.ok) { A.toast(r.error, 'err'); return; }
    const body = document.createElement('div');
    body.innerHTML = r.files.length ? '<div class="drive-list">' + r.files.map((f, i) => '<button type="button" class="drive-it" data-i="' + i + '"><b>' + esc(f.name) + '</b><small>' + new Date(f.modifiedTime).toLocaleString('fr-FR') + '</small></button>').join('') + '</div><div class="muted" style="margin-top:8px">Dossier « Nocte » de votre Drive. Seuls les fichiers créés par cette application y apparaissent.</div>' : '<p>Aucun document dans le dossier « Nocte » pour le moment. Activez la copie automatique dans « Comptes Google » : vos prochains enregistrements y apparaîtront.</p>';
    const i = await A.dialog({ title: 'Ouvrir depuis Google Drive', width: 520, body, buttons: [{ label: 'Fermer', value: null }], onOpen: (b, fin) => b.querySelectorAll('.drive-it').forEach(x => x.onclick = () => fin(+x.dataset.i)) });
    if (i === null || i === undefined) return; const f = r.files[i]; A.toast('Téléchargement…');
    const d = await api.driveOpen({ id: f.id, name: f.name, modifiedTime: f.modifiedTime }); if (!d.ok) { A.toast(d.error, 'err'); return; } api.openApp(/^(xlsx|csv)$/.test(d.ext) ? 'excel' : d.ext === 'pptx' ? 'ppt' : 'word', d.path);
  });
  $('#btn-mail').addEventListener('click', async () => {
    if (!api || !api.gmailDraft) { A.toast('Gmail nécessite l\'application Windows.'); return; }
    if (!ST || !ST.user) { await addAccount(); if (!ST || !ST.user) return; }
    const files = await api.openFiles({ filters: [{ name: 'Documents', extensions: ['docx', 'xlsx', 'pptx', 'csv', 'html', 'txt'] }] }); if (!files || !files[0]) return;
    const body = document.createElement('div');
    body.innerHTML = '<label class="field">Destinataire<input type="text" id="m-to" placeholder="nom@exemple.fr"></label><label class="field">Objet<input type="text" id="m-sub" value="' + esc(files[0].name || '') + '"></label><label class="field">Message<textarea id="m-body" rows="4" style="width:100%"></textarea></label><div class="muted">Pièce jointe : ' + esc(files[0].name || files[0].path) + '. Un brouillon est créé dans Gmail : vous le relisez avant d\'envoyer.</div>';
    const r = await A.dialog({ title: 'Envoyer par Gmail', width: 520, body, buttons: [{ label: 'Annuler', value: null }, { label: 'Créer le brouillon', primary: true, collect: b => ({ to: b.querySelector('#m-to').value.trim(), subject: b.querySelector('#m-sub').value, body: b.querySelector('#m-body').value }) }] });
    if (!r) return; A.toast('Création du brouillon…'); const x = await api.gmailDraft({ to: r.to, subject: r.subject, body: r.body, path: files[0].path });
    A.toast(x.ok ? 'Brouillon créé dans Gmail.' : 'Échec : ' + x.error, x.ok ? undefined : 'err'); refreshAcc();
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
