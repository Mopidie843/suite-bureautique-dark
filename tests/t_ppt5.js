const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const ctx = b.contexts()[0]; const hub = ctx.pages().find(x => x.url().includes('hub')); await hub.click('.tile.ppt'); await hub.waitForTimeout(2500);
  const p = ctx.pages().filter(x => x.url().includes('ppt/')).pop(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (n, v) => console.log((v ? 'OK  ' : 'KO  ') + n);
  const objs = () => p.evaluate(() => PP.deck.slides[PP.h.cur].objs);
  await p.click('.ribbon-tab[data-tab=insertion]');
  // formes
  for (const k of ['star5', 'heart', 'callout', 'line']) await p.selectOption('#sel-shape', k);
  let o = await objs(); ok('4 formes ajoutées', o.filter(x => x.type === 'poly').length === 4);
  ok('svg rendu', await p.evaluate(() => document.querySelectorAll('#stage .pobj svg.psvg path').length) === 4);
  // graphiques
  await p.click('#ribbon-insertion [data-act=chartBar]'); await p.click('#ribbon-insertion [data-act=chartPie]');
  ok('2 graphiques', (await objs()).filter(x => x.type === 'chart').length === 2);
  ok('svg graphique', await p.evaluate(() => document.querySelectorAll('#stage .pobj.chart svg rect').length) > 3);
  // modifier les données : double-clic sur le dernier graphique
  const c = await p.evaluate(() => { const e = [...document.querySelectorAll('#stage .pobj.chart')].pop(); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.dblclick(c.x, c.y); await p.waitForTimeout(400);
  ok('dialogue graphique', await p.evaluate(() => !!document.querySelector('#ch-d')));
  await p.fill('#ch-d', 'Cat;Chiffre\nUn;10\nDeux;30\nTrois;60'); await p.fill('#ch-t', 'Mon titre'); await p.click('#modal-foot .primary'); await p.waitForTimeout(300);
  const ch = (await objs()).filter(x => x.type === 'chart').pop(); ok('données mises à jour', ch.title === 'Mon titre' && ch.labels.length === 3 && ch.series[0].values[2] === 60);
  // lien
  const sh = await p.evaluate(() => { const e = document.querySelector('#stage .pobj.shape'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.click(sh.x, sh.y); await p.click('#ribbon-insertion [data-act=linkSet]'); await p.waitForTimeout(300); await p.fill('#at-v', 'example.com'); await p.click('#modal-foot .primary'); await p.waitForTimeout(200);
  ok('lien normalisé', (await objs()).some(x => x.link === 'https://example.com'));
  // Format
  await p.click('.ribbon-tab[data-tab=format]'); await p.waitForTimeout(200);
  ok('champ X renseigné', (await p.inputValue('#f-x')) !== '');
  await p.fill('#f-w', '333'); await p.press('#f-w', 'Tab'); await p.waitForTimeout(200);
  ok('largeur appliquée', (await objs()).some(x => x.w === 333));
  await p.selectOption('#sel-op', '0.5'); await p.selectOption('#sel-dash', 'dash'); await p.selectOption('#sel-lw', '6'); await p.click('[data-act=flipH]');
  const f = (await objs()).find(x => x.w === 333); ok('opacité/tirets/épaisseur/flip', f.op === 0.5 && f.dash === 'dash' && f.lw === 6 && f.flipH === true);
  ok('style DOM', await p.evaluate(id => { const e = document.querySelector('[data-id="' + id + '"]'); return e.style.opacity === '0.5' && /scaleX\(-1\)/.test(e.style.transform); }, f.id));
  // texte : puces
  await p.click('.ribbon-tab[data-tab=insertion]'); await p.click('#ribbon-insertion [data-act=addText]'); await p.dblclick('#stage .pobj.text:last-child'); await p.keyboard.press('Control+A'); await p.keyboard.type('un\ndeux'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('.ribbon-tab[data-tab=format]'); await p.click('[data-act=bullets]'); await p.waitForTimeout(150);
  const tx = (await objs()).find(x => x.type === 'text' && /deux/.test(x.text || '')); ok('puces', tx && /^• un\n• deux$/.test(tx.text));
  await p.click('[data-act=numbers]'); ok('numérotation', /^1\. un\n2\. deux$/.test((await objs()).find(x => /deux/.test(x.text || '')).text));
  // répartir : 3 formes sélectionnées au lasso
  await p.evaluate(() => { PP.deck.slides[0].objs = PP.deck.slides[0].objs.filter(o => o.type === 'poly').slice(0, 3); const os = PP.deck.slides[0].objs; os.forEach((o, i) => { o.y = 100 + i * 120; o.h = 80; o.rot = 0; o.flipH = false; }); os[0].x = 10; os[0].w = 80; os[1].x = 200; os[1].w = 80; os[2].x = 700; os[2].w = 80; PP.renderAll(); });
  const st = await p.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(st.x + 2, st.y + 2); await p.mouse.down(); await p.mouse.move(st.x + st.w - 2, st.y + st.h - 2, { steps: 5 }); await p.mouse.up();
  await p.click('[data-act=distH]'); await p.waitForTimeout(200);
  const xs = await p.evaluate(() => PP.deck.slides[0].objs.filter(o => o.type === 'poly').slice(0, 3).map(o => ({ x: o.x, w: o.w })).sort((a, b) => a.x - b.x)); const g1 = xs[1].x - (xs[0].x + xs[0].w), g2 = xs[2].x - (xs[1].x + xs[1].w); ok('répartir H (écarts ' + g1 + '/' + g2 + ')', Math.abs(g1 - g2) <= 2);
  // reproduire la mise en forme
  await p.evaluate(() => { PP.h.selectObj(0, PP.deck.slides[0].objs.filter(o => o.type === 'poly')[0].id); });
  await p.evaluate(() => { const os = PP.deck.slides[0].objs.filter(o => o.type === 'poly'); os[0].fill = '#123456'; PP.renderAll(); PP.h.selectObj(0, os[0].id); });
  await p.click('[data-act=fmtPaint]'); const t1 = await p.evaluate(() => { const os = PP.deck.slides[0].objs.filter(o => o.type === 'poly'); const e = document.querySelector('#stage [data-id="' + os[1].id + '"]'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, id: os[1].id }; });
  await p.mouse.click(t1.x, t1.y); await p.waitForTimeout(200); ok('reproduire format', (await objs()).find(x => x.id === t1.id).fill === '#123456');
  // masquer / auto / boucle
  await p.click('.ribbon-tab[data-tab=diaporama]'); await p.click('[data-act=addSlide]').catch(() => {}); await p.click('.ribbon-tab[data-tab=accueil]'); await p.click('[data-act=addSlide]'); await p.click('.ribbon-tab[data-tab=diaporama]');
  await p.click('[data-act=hideSlide]'); await p.selectOption('#sel-auto', '3'); await p.click('[data-act=loopToggle]');
  ok('diapo masquée + auto + boucle', await p.evaluate(() => { const s = PP.deck.slides[PP.h.cur]; return s.hidden === true && s.auto === 3 && PP.deck.loop === true; }));
  // trieur
  await p.click('.ribbon-tab[data-tab=affichage]'); await p.click('[data-act=sorter]'); await p.waitForTimeout(400);
  ok('trieur', await p.evaluate(() => document.querySelectorAll('#sorter .so-card').length) >= 2);
  const n0 = await p.evaluate(() => PP.deck.slides.length); await p.click('#sorter [data-s=dup]'); await p.waitForTimeout(200); ok('dupliquer depuis le trieur', await p.evaluate(() => PP.deck.slides.length) === n0 + 1);
  await p.screenshot({ path: '/tmp/p5_sorter.png' }); await p.click('#sorter [data-s=close]'); await p.waitForTimeout(200);
  // grille
  await p.click('[data-act=gridToggle]'); ok('grille', await p.evaluate(() => document.getElementById('stage').classList.contains('grid-on')));
  await p.click('[data-act=gridToggle]');
  // rechercher/remplacer
  await p.click('.ribbon-tab[data-tab=insertion]'); await p.click('[data-act=findOpen]'); await p.waitForTimeout(300); await p.fill('#fd-q', 'deux'); await p.fill('#fd-r', 'DEUX');
  await p.click('#modal-foot button:nth-child(2)'); await p.waitForTimeout(250); const msg = await p.textContent('#fd-s'); await p.click('#modal-foot button:nth-child(3)'); await p.waitForTimeout(200);
  ok('remplacer tout (' + msg + ')', /remplacement/.test(msg) && (await p.evaluate(() => PP.deck.slides.some(s => s.objs.some(o => /DEUX/.test(o.text || ''))))));
  // pied de page
  await p.click('[data-act=footer]'); await p.waitForTimeout(300); await p.fill('#ft-t', 'Ma société'); await p.check('#ft-n'); await p.click('#modal-foot .primary'); await p.waitForTimeout(300);
  ok('pied de page master', await p.evaluate(() => PP.deck.master.objs.some(o => o.ft === 'foot' && o.text === 'Ma société') && PP.deck.master.objs.some(o => o.ft === 'num')));
  await p.screenshot({ path: '/tmp/p5.png' });
  // export
  const r = await p.evaluate(async path => electronAPI.pptxWrite({ path, deck: { title: 't', master: PP.deck.master, slides: PP.deck.slides.map(s => ({ bg: s.bg, notes: s.notes, tr: s.tr, hideMaster: !!s.hideMaster, hidden: !!s.hidden, auto: s.auto || 0, objs: s.objs })) } }), '/tmp/o5.pptx');
  ok('export pptx ' + JSON.stringify(r), r && r.ok);
  const JSZip = require('/home/claude/word-dark/node_modules/jszip'); const z = await JSZip.loadAsync(fs.readFileSync('/tmp/o5.pptx')); const names = Object.keys(z.files);
  ok('graphiques dans le pptx', names.filter(n => /ppt\/charts\/chart\d+\.xml/.test(n)).length === 2);
  const s1 = await z.file('ppt/slides/slide1.xml').async('string'); ok('prst star5/heart/callout', /prst="star5"/.test(s1) && /prst="heart"/.test(s1) && /wedgeRoundRectCallout/.test(s1));
  // réimport
  const back = await p.evaluate(async () => { const b = await electronAPI.readFile ? null : null; return null; });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
