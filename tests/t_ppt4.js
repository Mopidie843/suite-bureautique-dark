const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const ctx = b.contexts()[0]; const hub = ctx.pages().find(x => x.url().includes('hub')); await hub.click('.tile.ppt'); await hub.waitForTimeout(2500);
  const p = ctx.pages().filter(x => x.url().includes('ppt/')).pop(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.click('.ribbon-tab[data-tab=insertion]'); await p.click('#ribbon-insertion [data-act=addRect]'); await p.click('[data-act=addArrow]'); await p.click('#ribbon-insertion [data-act=addEllipse]');
  const n0 = await p.evaluate(() => PP.deck.slides[0].objs.length); console.log('objs', n0);
  // lasso : tout sélectionner en glissant depuis le coin vide
  const st = await p.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(st.x + 3, st.y + 3); await p.mouse.down(); await p.mouse.move(st.x + st.w - 3, st.y + st.h - 3, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
  console.log('sélection', await p.evaluate(() => document.querySelectorAll('#stage .pobj.selected, #stage .pobj.msel').length));
  await p.click('.ribbon-tab[data-tab=accueil]'); await p.click('[data-act=group]'); await p.waitForTimeout(200);
  console.log('gid', await p.evaluate(() => new Set(PP.deck.slides[0].objs.map(o => o.gid)).size + ' ' + PP.deck.slides[0].objs.every(o => o.gid)));
  // déplacer le groupe en tirant un membre
  const before = await p.evaluate(() => PP.deck.slides[0].objs.map(o => o.x + ',' + o.y).join('|'));
  const c = await p.evaluate(() => { const e = document.querySelector('#stage .pobj.shape:not(.msel)') || document.querySelector('#stage .pobj.selected'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x + 40, c.y + 30, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
  const after = await p.evaluate(() => PP.deck.slides[0].objs.map(o => o.x + ',' + o.y).join('|')); console.log('groupe déplacé ensemble', before !== after, before, '->', after);
  await p.click('[data-act=ungroup]'); console.log('dissocié', await p.evaluate(() => PP.deck.slides[0].objs.every(o => !o.gid)));
  // masque
  await p.click('.ribbon-tab[data-tab=creation]'); await p.click('[data-act=masterNum]'); await p.waitForTimeout(300);
  console.log('mode masque', await p.evaluate(() => !!document.getElementById('master-banner') + ' ' + PP.deck.master.objs.length));
  await p.click('[data-act=masterToggle]'); await p.waitForTimeout(300); await p.click('#ribbon-creation [data-act=masterToggle]').catch(() => {});
  console.log('mobj sur la diapo', await p.evaluate(() => document.querySelectorAll('#stage .mobj').length + ' ' + (document.querySelector('#stage .mobj') || {}).textContent));
  await p.evaluate(() => { PP.deck.slides[0].objs[0].anim = 'fade'; });
  await p.screenshot({ path: '/tmp/p4.png' });
  const r = await p.evaluate(async path => electronAPI.pptxWrite({ path, deck: { title: 't', master: PP.deck.master, slides: PP.deck.slides.map(s => ({ bg: s.bg, notes: s.notes, tr: s.tr, hideMaster: !!s.hideMaster, objs: s.objs })) } }), '/tmp/o4.pptx');
  console.log('export', JSON.stringify(r));
  const JSZip = require('/home/claude/word-dark/node_modules/jszip'); const z = await JSZip.loadAsync(fs.readFileSync('/tmp/o4.pptx')); const x = await z.file('ppt/slides/slide1.xml').async('string'); console.log('timing', /<p:timing>/.test(x), 'numéro', />1</.test(x));
  console.log(errs.join('\n') || 'no errors'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
