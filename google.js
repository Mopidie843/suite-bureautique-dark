'use strict';
/* Compte Google : connexion (OAuth 2.0 + PKCE), plusieurs comptes, Google Drive, Gmail (brouillon), réglages synchronisés. */
const { app, ipcMain, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const http = require('http');

const TEST = process.env.GOOGLE_TEST_BASE || ''; // faux serveur Google pour les tests automatiques
const URLS = {
  auth: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: TEST ? TEST + '/token' : 'https://oauth2.googleapis.com/token',
  info: TEST ? TEST + '/userinfo' : 'https://openidconnect.googleapis.com/v1/userinfo',
  revoke: TEST ? TEST + '/revoke' : 'https://oauth2.googleapis.com/revoke',
  drive: TEST ? TEST + '/drive/v3' : 'https://www.googleapis.com/drive/v3',
  upload: TEST ? TEST + '/upload/drive/v3' : 'https://www.googleapis.com/upload/drive/v3',
  gmail: TEST ? TEST + '/gmail/v1' : 'https://gmail.googleapis.com/gmail/v1'
};
const BASE_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const FOLDER = 'Suite Bureautique';

const file = () => path.join(app.getPath('userData'), 'google.json');
const enc = s => (safeStorage.isEncryptionAvailable() ? 'e:' + safeStorage.encryptString(s).toString('base64') : 'p:' + Buffer.from(s).toString('base64'));
const dec = s => { try { const b = Buffer.from(String(s).slice(2), 'base64'); return String(s)[0] === 'e' ? safeStorage.decryptString(b) : b.toString('utf8'); } catch (e) { return ''; } };
const read = () => { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch (e) { return {}; } };
const write = o => fs.writeFileSync(file(), JSON.stringify(o));

function client() {
  const g = read();
  if (g.clientId && g.secret) return { id: g.clientId, secret: dec(g.secret), custom: true };
  try { const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'google-default.json'), 'utf8')); if (d.clientId && d.clientSecret) return { id: d.clientId, secret: d.clientSecret, custom: false }; } catch (e) { /* pas d'identifiants intégrés */ }
  return null;
}
function pub() {
  const g = read(), accs = Object.entries(g.accounts || {}).map(([email, a]) => ({ email, name: a.user.name, picture: a.user.picture, gmail: !!a.gmail }));
  const active = g.active && g.accounts && g.accounts[g.active] ? g.active : (accs[0] && accs[0].email) || null;
  const u = active ? g.accounts[active].user : null;
  return { configured: !!client(), builtin: !!(client() && !client().custom), clientId: g.clientId || '', accounts: accs, active, user: u ? { name: u.name, email: u.email, picture: u.picture, given: u.given } : null, driveSync: !!g.driveSync, lock: !!g.lock, lastSync: g.lastSync || null };
}
const activeEmail = () => pub().active;
const authorName = () => { const u = pub().user; return u ? u.name : ''; };
const isLocked = () => { const s = pub(); return s.lock && !s.user; };

const cache = {};
async function accessToken(email) {
  const c = cache[email]; if (c && c.exp > Date.now() + 30000) return c.at;
  const g = read(), a = g.accounts && g.accounts[email], cl = client(); if (!a || !cl) throw new Error('Compte non connecté.');
  const r = await fetch(URLS.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: cl.id, client_secret: cl.secret, refresh_token: dec(a.refresh), grant_type: 'refresh_token' }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.error || 'Session Google expirée : reconnectez-vous.');
  cache[email] = { at: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }; return j.access_token;
}
async function gapi(email, url, opt) {
  const at = await accessToken(email); opt = opt || {};
  const r = await fetch(url, { method: opt.method || 'GET', headers: Object.assign({ authorization: 'Bearer ' + at }, opt.headers || {}), body: opt.body });
  if (!r.ok) { let m = ''; try { m = (await r.json()).error; m = (m && m.message) || JSON.stringify(m); } catch (e) { /* corps non JSON */ } throw new Error('Google ' + r.status + (m ? ' : ' + m : '')); }
  return opt.raw ? r : r.json();
}

/* ---------- connexion ---------- */
async function signIn(extraScope, hint) {
  const cl = client(); if (!cl) return { ok: false, error: 'Identifiants Google non configurés.' };
  const b64u = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const verifier = b64u(crypto.randomBytes(48)), challenge = b64u(crypto.createHash('sha256').update(verifier).digest()), state = b64u(crypto.randomBytes(16));
  let redirect = '';
  try {
    const code = TEST ? 'testcode' : await new Promise((resolve, reject) => {
      const srv = http.createServer((req, res) => {
        const u = new URL(req.url, 'http://127.0.0.1'); if (u.pathname !== '/cb') { res.writeHead(404); res.end(); return; }
        const ok = u.searchParams.get('code') && u.searchParams.get('state') === state;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><meta charset="utf-8"><body style="font-family:Segoe UI,sans-serif;background:#1e1e1e;color:#eee;text-align:center;padding-top:15vh"><h2>' + (ok ? 'Connexion réussie' : 'Connexion refusée') + '</h2><p>Vous pouvez fermer cet onglet et revenir à la Suite Bureautique.</p>');
        clearTimeout(to); srv.close(); ok ? resolve(u.searchParams.get('code')) : reject(new Error(u.searchParams.get('error') || 'Connexion refusée.'));
      });
      const to = setTimeout(() => { srv.close(); reject(new Error('Délai dépassé (3 min).')); }, 180000);
      srv.listen(0, '127.0.0.1', () => {
        redirect = 'http://127.0.0.1:' + srv.address().port + '/cb';
        const q = new URLSearchParams({ client_id: cl.id, redirect_uri: redirect, response_type: 'code', scope: BASE_SCOPES + (extraScope ? ' ' + extraScope : ''), code_challenge: challenge, code_challenge_method: 'S256', state, access_type: 'offline', include_granted_scopes: 'true', prompt: 'consent select_account' });
        if (hint) q.set('login_hint', hint);
        shell.openExternal(URLS.auth + '?' + q);
      });
    });
    const tr = await fetch(URLS.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: cl.id, client_secret: cl.secret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }) });
    const tj = await tr.json(); if (!tr.ok) throw new Error(tj.error_description || tj.error || 'Échec de l\'échange du code.');
    const ur = await fetch(URLS.info, { headers: { authorization: 'Bearer ' + tj.access_token } }); const uj = await ur.json(); if (!ur.ok) throw new Error('Profil Google illisible.');
    let picture = ''; try { if (uj.picture) { const pr = await fetch(uj.picture); picture = 'data:' + (pr.headers.get('content-type') || 'image/jpeg') + ';base64,' + Buffer.from(await pr.arrayBuffer()).toString('base64'); } } catch (e) { /* photo facultative */ }
    const g = read(); g.accounts = g.accounts || {}; const old = g.accounts[uj.email] || {};
    g.accounts[uj.email] = { user: { name: uj.name || uj.email, email: uj.email, picture, given: uj.given_name || (uj.name || uj.email).split(' ')[0] }, refresh: tj.refresh_token ? enc(tj.refresh_token) : old.refresh, gmail: !!old.gmail || !!extraScope, folder: old.folder };
    g.active = uj.email; write(g); delete cache[uj.email];
    return { ok: true, status: pub() };
  } catch (e) { return { ok: false, error: e.message }; }
}

/* ---------- Drive ---------- */
const q = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function folderId(email) {
  const g = read(), a = g.accounts[email]; if (a.folder) return a.folder;
  const f = await gapi(email, URLS.drive + '/files?' + new URLSearchParams({ q: "name='" + FOLDER + "' and mimeType='application/vnd.google-apps.folder' and trashed=false", fields: 'files(id)', spaces: 'drive' }));
  let id = f.files && f.files[0] && f.files[0].id;
  if (!id) { const c = await gapi(email, URLS.drive + '/files?fields=id', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }) }); id = c.id; }
  const g2 = read(); g2.accounts[email].folder = id; write(g2); return id;
}
const MIME = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', csv: 'text/csv', html: 'text/html', txt: 'text/plain', wordweb: 'application/json' };
function multipart(meta, buf, mime) {
  const bd = 'sbd' + crypto.randomBytes(8).toString('hex');
  const body = Buffer.concat([Buffer.from('--' + bd + '\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + bd + '\r\ncontent-type: ' + mime + '\r\n\r\n'), buf, Buffer.from('\r\n--' + bd + '--')]);
  return { body, headers: { 'content-type': 'multipart/related; boundary=' + bd } };
}
async function driveUpload(email, name, buf, mime, opt) {
  opt = opt || {};
  const parent = opt.appData ? 'appDataFolder' : await folderId(email);
  const ex = await gapi(email, URLS.drive + '/files?' + new URLSearchParams({ q: "name='" + q(name) + "' and '" + parent + "' in parents and trashed=false", fields: 'files(id)', spaces: opt.appData ? 'appDataFolder' : 'drive' }));
  const id = ex.files && ex.files[0] && ex.files[0].id;
  if (id) { const m = multipart({}, buf, mime); const r = await gapi(email, URLS.upload + '/files/' + id + '?uploadType=multipart&fields=id', { method: 'PATCH', body: m.body, headers: m.headers }); return r.id; }
  const m = multipart({ name, parents: [parent] }, buf, mime);
  return (await gapi(email, URLS.upload + '/files?uploadType=multipart&fields=id', { method: 'POST', body: m.body, headers: m.headers })).id;
}
let lastSyncTimer = null;
function noteSync(name, ok, err) { const g = read(); g.lastSync = { name, ok, at: Date.now(), error: err || null }; write(g); clearTimeout(lastSyncTimer); }
/* appelé après chaque enregistrement d'un fichier local */
async function afterWrite(p) {
  try {
    const s = pub(); if (!s.driveSync || !s.active) return;
    const ext = path.extname(p).slice(1).toLowerCase(); if (!MIME[ext]) return;
    await driveUpload(s.active, path.basename(p), await fsp.readFile(p), MIME[ext]); noteSync(path.basename(p), true);
  } catch (e) { noteSync(path.basename(p), false, e.message); }
}

/* ---------- Gmail ---------- */
function mimeMessage({ to, subject, body, filename, bytes }) {
  const bd = 'sbm' + crypto.randomBytes(8).toString('hex'), b64 = b => b.toString('base64').replace(/(.{76})/g, '$1\r\n');
  const head = ['To: ' + to, 'Subject: =?UTF-8?B?' + Buffer.from(subject || '').toString('base64') + '?=', 'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="' + bd + '"', '', ''].join('\r\n');
  const text = '--' + bd + '\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + b64(Buffer.from(body || '')) + '\r\n';
  const ext = path.extname(filename || '').slice(1).toLowerCase();
  const att = bytes ? '--' + bd + '\r\nContent-Type: ' + (MIME[ext] || 'application/octet-stream') + '; name="=?UTF-8?B?' + Buffer.from(filename).toString('base64') + '?="\r\nContent-Disposition: attachment; filename="=?UTF-8?B?' + Buffer.from(filename).toString('base64') + '?="\r\nContent-Transfer-Encoding: base64\r\n\r\n' + b64(bytes) + '\r\n' : '';
  return Buffer.from(head + text + att + '--' + bd + '--');
}

function register(opts) {
  opts = opts || {};
  ipcMain.handle('google:status', () => pub());
  ipcMain.handle('google:config', (_e, { clientId, clientSecret }) => { const g = read(); g.clientId = String(clientId || '').trim(); if (clientSecret) g.secret = enc(String(clientSecret).trim()); if (!g.clientId) { delete g.secret; } write(g); return pub(); });
  ipcMain.handle('google:signin', () => signIn());
  ipcMain.handle('google:switch', (_e, email) => { const g = read(); if (g.accounts && g.accounts[email]) { g.active = email; write(g); } return pub(); });
  ipcMain.handle('google:signout', async (_e, email) => {
    const g = read(); email = email || g.active; const a = g.accounts && g.accounts[email];
    try { if (a && a.refresh) await fetch(URLS.revoke + '?token=' + encodeURIComponent(dec(a.refresh)), { method: 'POST' }); } catch (e) { /* hors ligne : on oublie quand même la session */ }
    if (a) { delete g.accounts[email]; delete cache[email]; if (g.active === email) g.active = Object.keys(g.accounts)[0] || null; write(g); } return pub();
  });
  ipcMain.handle('google:set', (_e, o) => { const g = read(); if ('driveSync' in o) g.driveSync = !!o.driveSync; if ('lock' in o) g.lock = !!o.lock; write(g); return pub(); });
  ipcMain.handle('google:drive-list', async () => {
    try { const e = activeEmail(); if (!e) return { ok: false, error: 'Connectez-vous d\'abord.' }; const id = await folderId(e);
      const r = await gapi(e, URLS.drive + '/files?' + new URLSearchParams({ q: "'" + id + "' in parents and trashed=false", fields: 'files(id,name,modifiedTime,size)', orderBy: 'modifiedTime desc', pageSize: '100' }));
      return { ok: true, files: (r.files || []).filter(f => MIME[path.extname(f.name).slice(1).toLowerCase()]) }; } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('google:drive-open', async (_e, { id, name }) => {
    try { const e = activeEmail(); const r = await gapi(e, URLS.drive + '/files/' + encodeURIComponent(id) + '?alt=media', { raw: true });
      const dir = path.join(app.getPath('userData'), 'drive-cache'); await fsp.mkdir(dir, { recursive: true });
      const safe = path.basename(String(name)).replace(/[^\w.\- ()]/g, '_'), p = path.join(dir, safe); await fsp.writeFile(p, Buffer.from(await r.arrayBuffer()));
      return { ok: true, path: p, ext: path.extname(safe).slice(1).toLowerCase() }; } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('google:drive-upload', async (_e, p) => { try { const e = activeEmail(); if (!e) return { ok: false, error: 'Connectez-vous d\'abord.' }; const ext = path.extname(p).slice(1).toLowerCase(); await driveUpload(e, path.basename(p), await fsp.readFile(p), MIME[ext] || 'application/octet-stream'); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('google:settings-push', async (_e, json) => { try { const e = activeEmail(); if (!e) return { ok: false }; await driveUpload(e, 'settings.json', Buffer.from(JSON.stringify(json)), 'application/json', { appData: true }); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('google:settings-pull', async () => {
    try { const e = activeEmail(); if (!e) return { ok: false };
      const f = await gapi(e, URLS.drive + '/files?' + new URLSearchParams({ q: "name='settings.json' and 'appDataFolder' in parents and trashed=false", fields: 'files(id)', spaces: 'appDataFolder' }));
      const id = f.files && f.files[0] && f.files[0].id; if (!id) return { ok: true, settings: null };
      const r = await gapi(e, URLS.drive + '/files/' + id + '?alt=media', { raw: true }); return { ok: true, settings: JSON.parse(await r.text()) }; } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('google:gmail-draft', async (_e, { to, subject, body, path: p }) => {
    try {
      let e = activeEmail(); if (!e) return { ok: false, error: 'Connectez-vous d\'abord.' };
      if (!read().accounts[e].gmail) { const r = await signIn(GMAIL_SCOPE, e); if (!r.ok) return r; e = activeEmail(); }
      const bytes = p ? await fsp.readFile(p) : null;
      const raw = mimeMessage({ to, subject, body, filename: p ? path.basename(p) : '', bytes }).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const d = await gapi(e, URLS.gmail + '/users/me/drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: { raw } }) });
      if (!TEST) shell.openExternal('https://mail.google.com/mail/u/' + encodeURIComponent(e) + '/#drafts');
      return { ok: true, id: d.id };
    } catch (e) { return { ok: false, error: e.message }; }
  });
}
module.exports = { register, afterWrite, authorName, isLocked, pub };
