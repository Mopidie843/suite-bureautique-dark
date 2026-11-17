const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const ctx = b.contexts()[0]; const hub = ctx.pages().find(x => x.url().includes('hub'));
  const out = {}; const errs = [];
  for (const [k, sel, urlRe] of [['word', '.tile.word', /index\.html/], ['excel', '.tile.excel', /excel\//], ['ppt', '.tile.ppt', /ppt\//]]) {
    await hub.click(sel); await hub.waitForTimeout(2500);
    const p = ctx.pages().filter(x => urlRe.test(x.url()) && (k !== 'word' || !/excel|ppt/.test(x.url()))).pop(); p.on('pageerror', e => errs.push(k + ': ' + e.message));
    if (k === 'word') await p.evaluate(() => W.closeBackstage && W.closeBackstage());
    await p.waitForTimeout(500);
    const n1 = await p.evaluate(() => document.querySelectorAll('#doc-tabs .dt').length + ' hidden=' + document.getElementById('doc-tabs').classList.contains('hidden'));
    await p.keyboard.press('Control+t'); await p.waitForTimeout(1200);
    const n2 = await p.evaluate(() => document.querySelectorAll('#doc-tabs .dt').length + ' visible=' + !document.getElementById('doc-tabs').classList.contains('hidden'));
    // clic sur le premier onglet
    await p.click('#doc-tabs .dt >> nth=0'); await p.waitForTimeout(1200);
    const on = await p.evaluate(() => [...document.querySelectorAll('#doc-tabs .dt')].map(d => d.classList.contains('on') ? 1 : 0).join(''));
    await p.click('#doc-tabs .dt >> nth=0 >> .dt-x'); await p.waitForTimeout(1200);
    const n3 = await p.evaluate(() => document.querySelectorAll('#doc-tabs .dt').length);
    out[k] = [n1, n2, on, n3].join(' | '); if (k === 'word') await p.screenshot({ path: '/tmp/tabs_w.png' });
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1)); console.log(errs.join('\n') || 'no errors'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
