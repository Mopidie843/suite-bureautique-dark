const { chromium } = require('playwright'); const SP = process.argv[2]; const fs = require('fs');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const ctx = b.contexts()[0]; const hub = ctx.pages().find(x => x.url().includes('hub')); await hub.click('.tile.excel'); await hub.waitForTimeout(2500);
  const p = ctx.pages().filter(x => x.url().includes('excel/')).pop(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { XL.mutate(() => { [['Mois', 'Ventes'], ['Jan', 10], ['Fév', 20], ['Mar', 30]].forEach((row, r) => row.forEach((v, c) => XL.setRaw(c, r, String(v)))); }); });
  // liste déroulante sur D1:D3
  await p.fill('#name-box', 'D1:D3'); await p.press('#name-box', 'Enter'); await p.click('.ribbon-tab[data-tab=donnees]'); await p.click('[data-act=dvAdd]'); await p.waitForSelector('#dv-l'); await p.fill('#dv-l', 'Oui, Non, Peut-être'); await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent === 'Appliquer').click()); await p.waitForTimeout(400);
  await p.fill('#name-box', 'D1'); await p.press('#name-box', 'Enter'); await p.waitForTimeout(300);
  console.log('dv btn', await p.locator('.dv-btn').count());
  await p.click('.dv-btn'); await p.waitForSelector('.dv-menu'); await p.click('.dv-it >> nth=1'); await p.waitForTimeout(300);
  console.log('D1 =', await p.evaluate(() => XL.display(XL.calc.value(0, 'D1'))));
  await p.evaluate(() => XL.mutate(() => XL.setRaw(3, 1, 'Banane'))); await p.waitForTimeout(300);
  console.log('D2 refusé =', await p.evaluate(() => JSON.stringify(XL.sh().cells['D2'] || null)));
  // noms définis
  await p.evaluate(() => { XL.wb.names = { Ventes: 'Feuil1!B2:B4' }; XL.refreshAll(); });
  await p.evaluate(() => XL.mutate(() => XL.setRaw(4, 0, '=SOMME(Ventes)'))); await p.waitForTimeout(300);
  console.log('SOMME(Ventes) =', await p.evaluate(() => XL.display(XL.calc.value(0, 'E1'))), await p.evaluate(() => XL.sh().name));
  // graphique
  await p.fill('#name-box', 'A1:B4'); await p.press('#name-box', 'Enter'); await p.click('.ribbon-tab[data-tab=insertion]'); await p.click('[data-act=chartBar]'); await p.waitForSelector('#modal-backdrop'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  console.log('charts', await p.evaluate(() => (XL.sh().charts || []).length), await p.evaluate(() => (document.querySelector('.toast') || {}).textContent), await p.evaluate(() => Array.from(document.querySelectorAll('.ribbon-tab')).map(t => t.dataset.tab).join(',')));
  // protection
  await p.click('.ribbon-tab[data-tab=donnees]'); await p.click('[data-act=protect]'); await p.waitForTimeout(300);
  await p.evaluate(() => XL.mutate(() => XL.setRaw(0, 10, 'interdit'))); console.log('protégé, A11 =', await p.evaluate(() => JSON.stringify(XL.sh().cells['A11'] || null)));
  await p.screenshot({ path: SP + '/x3.png' });
  // export + relecture
  const r = await p.evaluate(async path => { const book = { title: 't', names: XL.wb.names, images: await XLX.chartImages(), sheets: XL.wb.sheets.map((s, si) => ({ name: s.name, colW: s.colW, merges: [], dv: s.dv || [], prot: !!s.prot, cells: Object.keys(s.cells).map(k => ({ k, v: s.cells[k].v, s: s.cells[k].s || null, res: null })) })) }; return await electronAPI.xlsxWrite({ path, book }); }, SP + '/o3.xlsx');
  console.log('export', JSON.stringify(r));
  const JSZip = require('/home/claude/word-dark/node_modules/jszip'); const z = await JSZip.loadAsync(fs.readFileSync(SP + '/o3.xlsx')); console.log('files', Object.keys(z.files).filter(f => /media|drawing|definedName|sheet1/.test(f)).join(' '));
  const wbx = await z.file('xl/workbook.xml').async('string'); console.log('definedName', /<definedName[^>]*>[^<]*/.exec(wbx) && /<definedName[^>]*>[^<]*/.exec(wbx)[0]);
  const s1 = await z.file('xl/worksheets/sheet1.xml').async('string'); console.log('dataValidation', /<dataValidation [^>]*type="list"[^>]*>/.test(s1), 'sheetProtection', /<sheetProtection/.test(s1));
  const bytes = fs.readFileSync(SP + '/o3.xlsx').toString('base64');
  console.log('reimport', await p.evaluate(async b64 => { const r = await electronAPI.xlsxParse(Uint8Array.from(atob(b64), c => c.charCodeAt(0))); return JSON.stringify({ dv: r.sheets[0].dv.length, prot: r.sheets[0].prot, names: r.names }); }, bytes));
  console.log(errs.join('\n') || 'no errors'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
