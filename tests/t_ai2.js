const { chromium } = require('playwright'); const SP = process.argv[2];
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const ctx = b.contexts()[0]; const hub = ctx.pages().find(x => x.url().includes('hub')); await hub.click('.tile.ppt'); await hub.waitForTimeout(2500);
  const p = ctx.pages().find(x => x.url().includes('ppt/')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.click('[data-act=aiToggle] >> nth=0'); await p.waitForTimeout(400);
  await p.fill('#ai-input', 'crée une présentation sur le sommeil en 5 diapos'); await p.press('#ai-input', 'Enter'); await p.waitForTimeout(500);
  console.log('offline slides', await p.evaluate(() => PP.deck.slides.length));
  await p.click('#ai-mode'); await p.waitForSelector('#ai-k'); await p.fill('#ai-k', 'sk-ant-fake'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  console.log('mode', await p.textContent('#ai-mode'));
  await p.fill('#ai-input', 'traduis en anglais'); await p.press('#ai-input', 'Enter'); await p.waitForTimeout(5000);
  console.log(await p.evaluate(() => Array.from(document.querySelectorAll('.ai-m')).slice(-2).map(x => x.textContent)));
  await p.click('#ai-mode'); await p.waitForSelector('#ai-k'); await p.fill('#ai-k', ''); await p.keyboard.press('Enter'); await p.waitForTimeout(500); console.log('mode', await p.textContent('#ai-mode'));
  await p.screenshot({ path: SP + '/ai2.png' }); console.log(errs.join('\n') || 'no errors'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
