// Faux serveur Google (token, userinfo, Drive, Gmail) pour tester sans compte réel.
// Usage : node tests/fake-google.js 9400   puis lancer l'app avec GOOGLE_TEST_BASE=http://127.0.0.1:9400
const http = require('http'); const port = +process.argv[2] || 9400;
const files = {}; let n = 0, logins = 0; const log = [];
const send = (res, o, code) => { res.writeHead(code || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
    const body = Buffer.concat(chunks); const p = u.pathname; log.push(req.method + ' ' + p); if (+process.env.FAKE_DELAY && p !== '/__log') return setTimeout(() => handle(req, res, u, body, p), +process.env.FAKE_DELAY); handle(req, res, u, body, p); });
}).listen(port, '127.0.0.1', () => console.log('fake google on', port));
function handle(req, res, u, body, p) { {
    if (p === '/token') { const f = new URLSearchParams(body.toString()); if (f.get('grant_type') === 'authorization_code') { logins++; return send(res, { access_token: 'at' + logins, refresh_token: 'rt' + logins, expires_in: 3600 }); } return send(res, { access_token: 'atr', expires_in: 3600 }); }
    if (p === '/userinfo') { const k = String(logins <= 1 ? 1 : 2); return send(res, { email: 'user' + k + '@gmail.com', name: 'Utilisateur ' + k + ' Test', given_name: 'Utilisateur' + k }); }
    if (p === '/revoke') return send(res, {});
    if (p === '/__log') return send(res, { log, files: Object.fromEntries(Object.entries(files).map(([id, f]) => [id, { name: f.name, parents: f.parents, size: f.data.length, mime: f.mime }])) });
    if (p === '/drive/v3/files' && req.method === 'GET') {
      const q = u.searchParams.get('q') || ''; let m, out = [];
      const nm = /name='((?:[^'\\]|\\.)*)'/.exec(q), par = /'([^']+)' in parents/.exec(q), folder = /mimeType='application\/vnd.google-apps.folder'/.test(q);
      for (const [id, f] of Object.entries(files)) { if (nm && f.name !== nm[1].replace(/\\(.)/g, '$1')) continue; if (par && !(f.parents || []).includes(par[1])) continue; if (folder && f.mime !== 'application/vnd.google-apps.folder') continue; out.push({ id, name: f.name, modifiedTime: new Date().toISOString(), size: String(f.data.length) }); }
      return send(res, { files: out });
    }
    if (p === '/drive/v3/files' && req.method === 'POST') { const j = JSON.parse(body.toString()); const id = 'f' + (++n); files[id] = { name: j.name, mime: j.mimeType, parents: j.parents || [], data: Buffer.alloc(0) }; return send(res, { id }); }
    let m;
    if ((m = /^\/upload\/drive\/v3\/files(?:\/(\w+))?$/.exec(p))) {
      const ct = req.headers['content-type'] || ''; const bd = /boundary=(.+)$/.exec(ct)[1]; const parts = body.toString('latin1').split('--' + bd).slice(1, -1);
      const meta = JSON.parse(parts[0].split('\r\n\r\n')[1].replace(/\r\n$/, '')); const raw = parts[1]; const bi = raw.indexOf('\r\n\r\n') + 4; const data = Buffer.from(raw.slice(bi, raw.length - 2), 'latin1');
      const id = m[1] || 'f' + (++n); if (m[1]) files[id].data = data; else files[id] = { name: meta.name, parents: meta.parents || [], data, mime: 'x' }; return send(res, { id });
    }
    if ((m = /^\/drive\/v3\/files\/(\w+)$/.exec(p)) && u.searchParams.get('alt') === 'media') { const f = files[m[1]]; if (!f) return send(res, { error: { message: 'nf' } }, 404); res.writeHead(200); return res.end(f.data); }
    if (p === '/gmail/v1/users/me/drafts' && req.method === 'POST') { const raw = JSON.parse(body.toString()).message.raw; files['draft' + (++n)] = { name: '__draft', parents: [], data: Buffer.from(raw, 'base64'), mime: 'message/rfc822' }; return send(res, { id: 'd' + n }); }
    send(res, { error: { message: 'inconnu ' + p } }, 404);
} }
