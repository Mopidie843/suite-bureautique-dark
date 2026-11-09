const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9337'); const hub = b.contexts()[0].pages().find(x => x.url().includes('hub'));
  const ev = (f, a) => hub.evaluate(f, a);
  console.log('status', JSON.stringify(await ev(() => electronAPI.aiStatus())));
  console.log('ask', JSON.stringify(await ev(() => electronAPI.aiAsk({ system: 'Sois bref', prompt: 'Dis bonjour' }))));
  fs.writeFileSync('/tmp/fake_claude_fail', '1');
  console.log('not logged', JSON.stringify(await ev(() => electronAPI.aiCliTest())));
  fs.unlinkSync('/tmp/fake_claude_fail');
  console.log('test ok', JSON.stringify(await ev(() => electronAPI.aiCliTest())));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
