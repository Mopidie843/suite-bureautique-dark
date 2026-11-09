const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const ctx = b.contexts()[0]; const hub = ctx.pages().find(x => x.url().includes('hub')); await hub.click('.tile.word'); await hub.waitForTimeout(2500);
  const p = ctx.pages().filter(x => /index\.html/.test(x.url()) && !/excel|ppt/.test(x.url())).pop(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => W.closeBackstage && W.closeBackstage());
  const r = await p.evaluate(() => { const old = '<h1>Contrat</h1><p>Le client paie 100 euros avant le 1 mars.</p><p>Paragraphe supprimé.</p><p>Fin.</p>', nw = '<h1>Contrat</h1><p>Le client paie 150 euros avant le 15 mars.</p><p>Fin.</p><p>Nouvel article.</p>'; const c = W.compareHtml(old, nw); W.loadDoc({ title: 'Comparaison', html: c.html, page: W.defaultPage() }); return { stats: c.stats, ins: W.editor.querySelectorAll('ins.rev').length, del: W.editor.querySelectorAll('del.rev').length, text: W.editor.innerText.replace(/\n+/g, ' | ').slice(0, 160) }; });
  console.log(JSON.stringify(r));
  console.log('txt->html', await p.evaluate(async () => { const h = await W.fileToHtml({ name: 'a.txt', text: 'Bonjour\n\nMonde' }); return h; }));
  console.log(errs.join('\n') || 'no errors'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
