'use strict';
/* Nocte Android : remplace l'API Electron (window.electronAPI) par une version téléphone.
   Fichiers : sélecteur Android, stockage privé (Données/docs), partage/export via la feuille de partage.
   Générateurs docx/xlsx/pptx : common/mobile-core.js (chargé à la demande). */
(function () {
  const Cap = window.Capacitor, native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const P = (Cap && Cap.Plugins) || {}; window.__NOCTE_MOBILE = true; document.documentElement.classList.add('is-mobile');
  const VERSION = '3.9.0', toast = (m, t) => { try { (window.W && W.toast ? W.toast : window.A && A.toast)(m, t); } catch (e) { /* pas prêt */ } };
  const base = location.href.replace(/(?:excel\/|ppt\/)?[^\/]*$/, '');
  const PAGES = { word: 'index.html', excel: 'excel/index.html', ppt: 'ppt/index.html' };
  const go = url => { location.href = url; };
  const goHub = () => go(base + 'hub.html');

  /* ---- chargement paresseux du bundle (exceljs, pptxgenjs, html-to-docx) ---- */
  let corePromise = null;
  const core = () => corePromise || (corePromise = new Promise((res, rej) => { if (window.NocteCore) return res(window.NocteCore); const s = document.createElement('script'); s.src = base + 'common/mobile-core.js'; s.onload = () => res(window.NocteCore); s.onerror = () => rej(new Error('module de fichiers introuvable')); document.head.appendChild(s); }));

  /* ---- octets <-> base64 ---- */
  const toB64 = u8 => { let s = ''; const n = 0x8000; for (let i = 0; i < u8.length; i += n) s += String.fromCharCode.apply(null, u8.subarray(i, i + n)); return btoa(s); };
  const fromB64 = b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const safe = n => String(n || 'Document').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
  const TEXT = ['html', 'htm', 'txt', 'md', 'csv', 'wordweb'];
  const fileObj = (name, bytes, path) => { const ext = (name.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase(), o = { name, ext, path: path || ('docs/' + name) }; if (TEXT.includes(ext)) o.text = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, ''); else o.bytes = bytes; return o; };

  /* ---- stockage privé ---- */
  const FS = P.Filesystem;
  async function store(path, bytes) {
    if (FS) { await FS.writeFile({ path, data: toB64(bytes), directory: 'DATA', recursive: true }); const u = await FS.getUri({ path, directory: 'DATA' }); return u.uri; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes])); a.download = path.split('/').pop(); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return null;
  }
  async function load(path) {
    if (!FS) return null; const r = await FS.readFile({ path, directory: 'DATA' }); return fromB64(r.data);
  }
  const pendingShare = new Set();
  async function saveBytes(path, bytes) {
    const uri = await store(path, bytes);
    if (pendingShare.has(path)) { pendingShare.delete(path); if (P.Share && uri) { try { await P.Share.share({ title: path.split('/').pop(), url: uri, dialogTitle: 'Enregistrer ou envoyer' }); } catch (e) { /* annulé */ } } else toast('Fichier enregistré.'); }
    return { ok: true };
  }

  /* ---- sélecteur de fichiers ---- */
  function pick() {
    return new Promise(resolve => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = '*/*'; i.style.display = 'none'; document.body.appendChild(i); let done = false;
      const fin = v => { if (done) return; done = true; i.remove(); resolve(v); };
      i.addEventListener('change', async () => { const f = i.files && i.files[0]; if (!f) return fin(null); try { const bytes = new Uint8Array(await f.arrayBuffer()), o = fileObj(f.name, bytes); try { await store(o.path, bytes); } catch (e) { /* stockage facultatif */ } fin([o]); } catch (e) { fin(null); } });
      i.addEventListener('cancel', () => fin(null)); i.click();
    });
  }

  /* ---- IA : clé API (l'abonnement Claude Pro/Max passe par Claude Code, absent du téléphone) ---- */
  const aiKey = () => { try { return localStorage.getItem('nocte_aikey') || ''; } catch (e) { return ''; } };
  const unavailable = what => async () => ({ ok: false, error: (what || 'Fonction') + ' : indisponible sur téléphone.' });

  /* ---- navigation / fermeture ---- */
  let beforeCb = null;
  function openApp(kind, file) {
    const url = base + (PAGES[kind] || PAGES.word);
    try { if (file) localStorage.setItem('nocte_startup', JSON.stringify(typeof file === 'string' ? { path: file } : { path: file.path })); else localStorage.removeItem('nocte_startup'); } catch (e) { /* ignore */ }
    go(url); return Promise.resolve({});
  }
  async function startupFile() {
    let s = null; try { s = JSON.parse(localStorage.getItem('nocte_startup') || 'null'); localStorage.removeItem('nocte_startup'); } catch (e) { /* ignore */ }
    if (!s || !s.path) return null;
    try { const b = await load(s.path); return b ? fileObj(s.path.split('/').pop(), b, s.path) : null; } catch (e) { return null; }
  }
  const isHub = () => /hub\.html$/.test(location.pathname) || location.pathname.endsWith('/');

  window.electronAPI = {
    openDialog: () => pick(),
    openFiles: () => pick(),
    pickSavePath: async o => { const p = 'docs/' + safe((o && o.defaultName) || 'Document.docx'); pendingShare.add(p); return { canceled: false, path: p }; },
    writeFile: async ({ path, payload }) => {
      try {
        if (payload.kind === 'docx') { const c = await core(); return await saveBytes(path, new Uint8Array(await c.buildDocx(payload))); }
        if (payload.kind === 'text') return await saveBytes(path, new TextEncoder().encode((/\.txt$/i.test(path) ? '﻿' : '') + payload.text));
        throw new Error('type inconnu');
      } catch (e) { return { ok: false, error: e.message }; }
    },
    xlsxWrite: async ({ path, book }) => { try { const c = await core(); return await saveBytes(path, new Uint8Array(await c.xlsxBuild(book))); } catch (e) { return { ok: false, error: e.message }; } },
    xlsxParse: async bytes => { try { const c = await core(), sh = await c.xlsxParse(bytes); return { ok: true, sheets: sh, names: sh.names || {} }; } catch (e) { return { ok: false, error: e.message }; } },
    pptxWrite: async ({ path, deck }) => { try { const c = await core(); return await saveBytes(path, new Uint8Array(await c.pptxBuild(deck))); } catch (e) { return { ok: false, error: e.message }; } },
    writePdf: async () => { try { if (P.NoctePrint) await P.NoctePrint.print({ name: document.title || 'Nocte' }); else window.print(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    clipboardRead: async () => { try { return { html: '', text: await navigator.clipboard.readText() }; } catch (e) { return { html: '', text: '' }; } },
    info: async () => ({ version: VERSION, electron: 'Android', chrome: (navigator.userAgent.match(/Chrome\/([\d.]+)/) || [, ''])[1], node: '', platform: 'android' }),
    openExternal: async u => { if (/^(https?:|mailto:)/i.test(u)) window.open(u, '_blank'); },
    setSpellLang: async () => ({}),
    shareStart: unavailable('Partage en direct'), shareUpdate: unavailable('Partage en direct'), shareStop: async () => ({}), shareUrls: async () => [],
    getStartupFile: startupFile,
    openVersions: async () => { toast('Historique des versions : indisponible sur téléphone.'); return ''; },
    googleStatus: async () => ({ configured: false, user: null, accounts: [], lock: false }),
    googleConfig: async () => ({ configured: false }), googleSignIn: unavailable('Connexion Google'), googleSwitch: unavailable('Google'), googleSignOut: unavailable('Google'), googleSet: unavailable('Google'),
    driveList: unavailable('Drive'), driveOpen: unavailable('Drive'), driveUpload: unavailable('Drive'), settingsPush: unavailable('Synchronisation'), settingsPull: unavailable('Synchronisation'), gmailDraft: unavailable('Gmail'),
    aiStatus: async () => { const k = !!aiKey(); return { on: k, mode: k ? 'key' : 'off', key: k, cli: false, cliVersion: '', mobile: true }; },
    aiCliTest: unavailable('Claude Code'), aiCliLogin: unavailable('Claude Code'),
    aiSetKey: async k => { try { k = String(k || '').trim(); if (k) localStorage.setItem('nocte_aikey', k); else localStorage.removeItem('nocte_aikey'); return { ok: true, on: !!k }; } catch (e) { return { ok: false, error: e.message }; } },
    aiAsk: async ({ system, prompt }) => {
      const key = aiKey(); if (!key) return { ok: false, error: 'Ajoutez une clé API Claude (Connecter Claude).' };
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 60000);
        const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 2500, system: String(system || '').slice(0, 4000), messages: [{ role: 'user', content: String(prompt || '').slice(0, 20000) }] }) });
        clearTimeout(t); const j = await r.json(); if (!r.ok) return { ok: false, error: (j && j.error && j.error.message) || ('Erreur ' + r.status) };
        return { ok: true, text: (j.content || []).map(c => c.text || '').join('') };
      } catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'Délai dépassé.' : e.message }; }
    },
    openHub: async () => { goHub(); return {}; },
    openApp,
    pathForFile: () => null,
    onBeforeClose: cb => { beforeCb = cb; },
    confirmClose: ok => { if (ok) goHub(); },
    onOpenFile: () => {}
  };

  /* ---- bouton Retour Android ---- */
  function backPressed() {
    const m = document.querySelector('#modal-backdrop:not(.hidden)'); if (m) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); if (document.querySelector('#modal-backdrop:not(.hidden)')) { const c = m.querySelector('[data-dismiss],.modal-close,button'); if (c) c.click(); } return; }
    if (document.body.classList.contains('zen')) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return; }
    if (isHub()) { if (P.App && P.App.exitApp) P.App.exitApp(); return; }
    if (beforeCb) { try { beforeCb(); } catch (e) { goHub(); } } else goHub();
  }
  if (P.App && P.App.addListener) P.App.addListener('backButton', backPressed);
  window.__noctBack = backPressed;
  if (P.StatusBar && P.StatusBar.setStyle) { try { P.StatusBar.setStyle({ style: 'DARK' }); P.StatusBar.setBackgroundColor({ color: '#0f1424' }); } catch (e) { /* ignore */ } }

  /* ---- Word : ajuster la page à la largeur de l'écran ---- */
  window.addEventListener('load', () => { let n = 0; const t = setInterval(() => { if (window.W && W.fitWidth) { try { W.fitWidth(); } catch (e) { /* ignore */ } clearInterval(t); } else if (++n > 30) clearInterval(t); }, 200); });
})();
