const { chromium } = require('playwright'); const SP = process.argv[2];
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const hub = b.contexts()[0].pages().find(x => x.url().includes('hub')); const errs = []; hub.on('pageerror', e => errs.push(e.message));
  await hub.reload(); await hub.waitForTimeout(800);
  console.log('label', await hub.textContent('#acc-label'));
  await hub.click('#btn-account'); await hub.waitForSelector('#g-id'); await hub.fill('#g-id', '123-abc.apps.googleusercontent.com'); await hub.fill('#g-sec', 'GOCSPX-test'); await hub.screenshot({ path: SP + '/g1.png' });
  await hub.evaluate(() => { const bs = [...document.querySelectorAll('button')].find(x => x.textContent === 'Enregistrer'); bs.click(); }); await hub.waitForTimeout(800);
  console.log('status', JSON.stringify(await hub.evaluate(() => electronAPI.googleStatus())));
  // le clic a lancé la connexion (navigateur) : on vérifie qu'un serveur local écoute puis on l'abandonne
  console.log('toast', await hub.evaluate(() => (document.querySelector('.toast') || {}).textContent));
  console.log(errs.join('\n') || 'no errors'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
