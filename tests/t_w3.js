const { chromium } = require('playwright'); const SP = process.argv[2];
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const ctx = b.contexts()[0]; const hub = ctx.pages().find(x => x.url().includes('hub')); await hub.click('.tile.word'); await hub.waitForTimeout(2500);
  const p = ctx.pages().filter(x => /index\.html/.test(x.url()) && !/excel|ppt/.test(x.url())).pop(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => W.closeBackstage && W.closeBackstage()); await p.waitForTimeout(400); await p.click('#editor'); await p.keyboard.type('Bonjour ');
  await p.click('.ribbon-tab[data-tab=insertion]'); await p.click('[data-act=equation]'); await p.waitForSelector('#eq-in'); await p.fill('#eq-in', '(a+b)/2 + x^2 + sqrt(b^2-4ac) + \\alpha_i'); await p.waitForTimeout(200);
  console.log('prev', await p.evaluate(() => document.getElementById('eq-prev').innerHTML));
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  console.log('eq in doc', await p.evaluate(() => W.editor.querySelectorAll('.eq').length + ' ' + W.editor.querySelector('.eq').textContent));
  await p.click('.ribbon-tab[data-tab=accueil]'); await p.click('#editor'); await p.keyboard.press('Control+A'); await p.keyboard.press('Control+B');
  await p.click('[data-act=styleNew]'); await p.waitForSelector('#dlg-in'); await p.fill('#dlg-in', 'Mon gras'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  console.log('styles', await p.evaluate(() => localStorage.getItem('wd_wstyles')));
  await p.click('#editor'); await p.keyboard.press('Control+A'); await p.click('[data-act=styleApply]'); await p.waitForSelector('.st-it'); await p.click('.st-it'); await p.waitForTimeout(400);
  console.log('html', await p.evaluate(() => W.editor.innerHTML.slice(0, 260)));
  console.log('versions dir', await p.evaluate(async () => await electronAPI.openVersions()));
  await p.screenshot({ path: SP + '/w3.png' });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
