const { chromium } = require('playwright'); const SP = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const ctx = b.contexts()[0]; const hub = ctx.pages().find(x => x.url().includes('hub')); await hub.click('.tile.excel'); await hub.waitForTimeout(2500);
  const p = ctx.pages().find(x => x.url().includes('excel/')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const data = [['Fruit', 'Région', 'Ventes'], ['Pomme', 'Nord', 10], ['Poire', 'Sud', 20], ['Pomme', 'Sud', 30], ['Kiwi', 'Nord', 5], ['Poire', 'Nord', 7]];
  await p.evaluate(d => { XL.mutate(() => d.forEach((row, r) => row.forEach((v, c) => XL.setRaw(c, r, String(v))))); }, data);
  await p.fill('#name-box', 'A2'); await p.press('#name-box', 'Enter');
  await p.click('.ribbon-tab[data-tab=donnees]'); await p.click('[data-act=pivot]'); await p.waitForSelector('#pv-r');
  await p.selectOption('#pv-r', '0'); await p.selectOption('#pv-c', '1'); await p.selectOption('#pv-v', '2'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  console.log('sheet', await p.evaluate(() => XL.sh().name));
  console.log(await p.evaluate(() => { const o = []; for (let r = 0; r < 6; r++) { const row = []; for (let c = 0; c < 5; c++) { const td = document.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]'); row.push(td.textContent); } o.push(row.join(' | ')); } return o.join('\n'); }));
  // merge + freeze + row height sur feuille 1
  await p.evaluate(() => { document.querySelector('.stab[data-i="0"]').click(); });
  await p.waitForTimeout(300);
  await p.fill('#name-box', 'A1:B1'); await p.press('#name-box', 'Enter'); await p.click('.ribbon-tab[data-tab=accueil]'); await p.click('[data-act=toggleMerge]'); await p.waitForTimeout(200);
  console.log('merge', await p.evaluate(() => JSON.stringify(XL.sh().merges) + ' colspan=' + document.querySelector('td[data-r="0"][data-c="0"]').colSpan + ' B1 display=' + document.querySelector('td[data-r="0"][data-c="1"]').style.display));
  await p.fill('#name-box', 'B2'); await p.press('#name-box', 'Enter'); await p.click('.ribbon-tab[data-tab=affichage]'); await p.click('[data-act=toggleFreeze]'); await p.waitForTimeout(200);
  console.log('freeze', await p.evaluate(() => JSON.stringify(XL.sh().freeze) + ' sticky=' + document.querySelector('td[data-r="0"][data-c="0"]').style.position));
  const th = await p.evaluate(() => { const r = document.querySelector('tbody th.rh[data-r="2"]').getBoundingClientRect(); return { x: r.x + 10, y: r.bottom - 2 }; });
  await p.mouse.move(th.x, th.y); await p.mouse.down(); await p.mouse.move(th.x, th.y + 20, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200);
  console.log('rowH', await p.evaluate(() => JSON.stringify(XL.sh().rowH)));
  // xlsx aller-retour
  const rt = await p.evaluate(async path => { const calc = XL.calc; const pay = { title: 't', sheets: XL.wb.sheets.map((s, si) => ({ name: s.name, colW: s.colW, merges: s.merges || [], freeze: s.freeze, cells: Object.keys(s.cells).map(k => { const c = s.cells[k], f = typeof c.v === 'string' && c.v[0] === '='; let res = null; if (f) { const v = calc.value(si, k); res = v instanceof Error ? '#ERR' : v; } return { k, v: c.v, s: c.s || null, res }; }) })) }; return await electronAPI.xlsxWrite({ path, book: pay }); }, SP + '/o.xlsx');
  console.log(rt); const bytes = fs.readFileSync(SP + '/o.xlsx').toString('base64');
  console.log(await p.evaluate(async b64 => { const r = await electronAPI.xlsxParse(Uint8Array.from(atob(b64), c => c.charCodeAt(0))); return JSON.stringify(r.sheets.map(s => ({ n: s.name, m: s.merges, f: s.freeze }))); }, bytes));
  // PDF
  await p.click('.ribbon-tab[data-tab=donnees]');
  // remplacer le sélecteur de fichier : appel direct
  console.log(errs.join('\n') || 'no errors'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
