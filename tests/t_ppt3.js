const { chromium } = require('playwright'); const SP = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const ctx = b.contexts()[0]; const hub = ctx.pages().find(x => x.url().includes('hub')); await hub.click('.tile.ppt'); await hub.waitForTimeout(2500);
  const p = ctx.pages().filter(x => x.url().includes('ppt/')).pop(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.click('.ribbon-tab[data-tab=insertion]'); await p.click('[data-act=addArrow]'); await p.waitForTimeout(300);
  await p.click('[data-act=rotR]'); await p.click('[data-act=shadow]');
  await p.click('#ribbon-insertion [data-act=addRect]'); await p.evaluate(() => { const o = PP.deck.slides[0].objs.slice(-1)[0]; o.grad = '#ff0066'; PP.renderAll(); });
  console.log(await p.evaluate(() => JSON.stringify(PP.deck.slides[0].objs.slice(-2).map(o => ({ t: o.type, rot: o.rot, sh: o.shadow, g: o.grad })))));
  console.log(await p.evaluate(() => Array.from(document.querySelectorAll('#stage .pobj')).slice(-2).map(e => e.style.transform + '|' + (e.style.boxShadow || e.style.filter) + '|' + e.style.background.slice(0, 40))));
  // snap : déplacer le rectangle près du centre horizontal
  const box = await p.evaluate(() => { const e = document.querySelectorAll('#stage .pobj')[document.querySelectorAll('#stage .pobj').length - 1].getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; });
  await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.mouse.move(box.x + 3, box.y + 40, { steps: 4 });
  console.log('guides', await p.evaluate(() => document.querySelectorAll('#stage .guide').length)); await p.mouse.up();
  await p.screenshot({ path: SP + '/p3.png' });
  const r = await p.evaluate(async path => { const pay = { title: 't', slides: PP.deck.slides.map(s => ({ bg: s.bg, notes: s.notes, tr: s.tr, objs: s.objs })) }; return await electronAPI.pptxWrite({ path, deck: pay }); }, SP + '/o.pptx');
  console.log('export', JSON.stringify(r), fs.existsSync(SP + '/o.pptx'));
  await p.evaluate(() => { PP.deck.slides[0].notes = 'Dire bonjour'; }); await p.click('.ribbon-tab[data-tab=diaporama]');
  await p.evaluate(() => document.querySelector('[data-act=playFrom0]').click()); await p.waitForTimeout(600);
  await p.keyboard.press('p'); await p.waitForTimeout(1200);
  console.log('presenter', await p.evaluate(() => document.getElementById('present').className + ' | ' + document.getElementById('pres-timer').textContent + ' | ' + document.querySelector('#pres-panel .pp-n').textContent));
  await p.screenshot({ path: SP + '/p3b.png' }); await p.keyboard.press('Escape');
  console.log(errs.join('\n') || 'no errors'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
