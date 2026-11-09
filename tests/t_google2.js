const { chromium } = require('playwright'); const fs = require('fs'); const SP = process.argv[2];
const L = async () => (await fetch('http://127.0.0.1:9400/__log')).json();
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const hub = b.contexts()[0].pages().find(x => x.url().includes('hub')); const errs = []; hub.on('pageerror', e => errs.push(e.message));
  const ev = (f, a) => hub.evaluate(f, a);
  await hub.reload(); await hub.waitForTimeout(600);
  await ev(() => electronAPI.googleConfig({ clientId: 'cid', clientSecret: 'sec' }));
  let r = await ev(() => electronAPI.googleSignIn()); console.log('signin1', r.ok, r.status && r.status.user.email);
  r = await ev(() => electronAPI.googleSignIn()); console.log('signin2', r.ok, r.status.accounts.map(a => a.email).join(','), 'actif', r.status.active);
  console.log('switch', (await ev(() => electronAPI.googleSwitch('user1@gmail.com'))).active);
  await ev(() => electronAPI.googleSet({ driveSync: true }));
  // enregistrement -> copie Drive automatique + auteur
  const book = { title: 't', sheets: [{ name: 'S', colW: {}, cells: [{ k: 'A1', v: 'bonjour', s: null, res: null }] }] };
  console.log('write', JSON.stringify(await ev(b => electronAPI.xlsxWrite({ path: '/tmp/gtest.xlsx', book: b }), book))); await hub.waitForTimeout(1500);
  const lg = await L(); console.log('drive files', JSON.stringify(Object.values(lg.files).map(f => f.name + ':' + f.size)));
  console.log('status sync', JSON.stringify((await ev(() => electronAPI.googleStatus())).lastSync && { ok: (await ev(() => electronAPI.googleStatus())).lastSync.ok }));
  // 2e enregistrement = mise à jour (pas de doublon, sans recherche)
  const n0 = (await L()).log.length;
  await ev(b => electronAPI.xlsxWrite({ path: '/tmp/gtest.xlsx', book: b }), book); await hub.waitForTimeout(1200);
  console.log('requêtes 2e save', JSON.stringify((await L()).log.slice(n0)));
  console.log('after update', JSON.stringify(Object.values((await L()).files).filter(f => f.name === 'gtest.xlsx').length));
  const ls = await ev(() => electronAPI.driveList()); console.log('list', ls.ok, ls.files.map(f => f.name));
  const dl = await ev(f => electronAPI.driveOpen({ id: f.id, name: f.name }), ls.files[0]); console.log('download', dl.ok, dl.ext, fs.existsSync(dl.path) && fs.statSync(dl.path).size > 1000);
  // auteur dans le xlsx
  const JSZip = require(require.resolve('jszip', { paths: ['/home/claude/word-dark'] })); const z = await JSZip.loadAsync(fs.readFileSync('/tmp/gtest.xlsx')); console.log('creator', /<dc:creator>([^<]*)/.exec(await z.file('docProps/core.xml').async('string'))[1]);
  // réglages
  console.log('push', JSON.stringify(await ev(() => electronAPI.settingsPush({ look: 'dark', wstyles: [1] }))), 'pull', JSON.stringify(await ev(() => electronAPI.settingsPull())));
  // Gmail
  const g = await ev(() => electronAPI.gmailDraft({ to: 'a@b.fr', subject: 'Sujet é', body: 'Salut', path: '/tmp/gtest.xlsx' })); console.log('gmail', JSON.stringify(g));
  const dr = Object.values((await L()).files).find(f => f.name === '__draft'); console.log('draft size', dr && dr.size);
  // verrouillage
  await ev(() => electronAPI.googleSet({ lock: true })); console.log('lock open (connecté)', JSON.stringify(await ev(() => electronAPI.openApp('nope'))));
  await ev(() => electronAPI.googleSignOut('user1@gmail.com')); const so = await ev(() => electronAPI.googleSignOut('user2@gmail.com')); console.log('after signout', so.accounts.length, so.lock);
  console.log('lock open (déconnecté)', JSON.stringify(await ev(() => electronAPI.openApp('word'))));
  await hub.reload(); await hub.waitForTimeout(700); console.log('overlay visible', await hub.isVisible('#lock'));
  await hub.screenshot({ path: SP + '/lock.png' });
  await ev(() => electronAPI.googleSet({ lock: false }));
  console.log(errs.join('\n') || 'no errors'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
