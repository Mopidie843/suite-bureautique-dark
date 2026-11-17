const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const ctx = b.contexts()[0]; const hub = ctx.pages().find(x => x.url().includes('hub')); const errs = []; hub.on('pageerror', e => errs.push(e.message));
  await hub.reload(); await hub.waitForTimeout(1500);
  const mk = (owner, title) => hub.evaluate(async ([owner, title]) => { localStorage.setItem('wd_owner', JSON.stringify(owner)); const st = A.store('word-dark-edition'); await st.put({ id: 'd' + Math.random(), title, modified: Date.now(), html: '<p>x</p>' }); }, [owner, title]);
  await mk('', 'Sans compte'); await mk('a@gmail.com', 'Doc de A'); await mk('b@gmail.com', 'Doc de B');
  for (const o of ['a@gmail.com', 'b@gmail.com', '']) {
    await hub.evaluate(o => __hub.setAcc(o ? { user: { email: o, name: o } } : { user: null }), o); await hub.waitForTimeout(500);
    console.log(o || '(déconnecté)', '->', await hub.evaluate(() => [...document.querySelectorAll('#recent tr td:first-child')].map(t => t.textContent).join(', ')));
  }
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
