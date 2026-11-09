const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const ctx = b.contexts()[0]; const hub = ctx.pages().find(x => x.url().includes('hub')); await hub.click('.tile.word'); await hub.waitForTimeout(2500);
  const p = ctx.pages().filter(x => /index\.html/.test(x.url()) && !/excel|ppt/.test(x.url())).pop(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => W.closeBackstage && W.closeBackstage()); await p.waitForTimeout(300); await p.click('#editor'); await p.keyboard.type('Texte un'); await p.keyboard.press('Enter'); await p.keyboard.type('Ligne deux'); await p.keyboard.press('Control+End');
  await p.selectOption('#sel-font', 'Georgia'); await p.selectOption('#sel-size', '14'); await p.waitForTimeout(300);
  console.log('defaults', await p.evaluate(() => JSON.stringify([localStorage.getItem('wd_defFont'), localStorage.getItem('wd_defSize'), W.editor.style.fontFamily, W.editor.style.fontSize])));
  // sélection partielle : ne change pas le défaut
  await p.keyboard.press('Shift+Home'); await p.selectOption('#sel-font', 'Courier New'); await p.waitForTimeout(300);
  console.log('after partial', await p.evaluate(() => localStorage.getItem('wd_defFont')));
  // nouveau doc : police conservée
  await p.reload(); await p.waitForTimeout(1500); await p.evaluate(() => W.closeBackstage && W.closeBackstage());
  console.log('after reload', await p.evaluate(() => W.editor.style.fontFamily + ' ' + W.editor.style.fontSize));
  console.log(errs.join('\n') || 'no errors'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
