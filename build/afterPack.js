const { execFileSync } = require('child_process'); const path = require('path'); const fs = require('fs');
exports.default = async function (ctx) {
  const exe = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.exe');
  const rc = path.join(__dirname, '..', 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe');
  const ico = path.join(__dirname, 'icon.ico');
  if (!fs.existsSync(rc) || !fs.existsSync(exe)) return;
  const win = process.platform === 'win32';
  try { execFileSync(win ? rc : 'wine', (win ? [] : [rc]).concat([exe, '--set-icon', ico, '--set-version-string', 'FileDescription', 'Suite Bureautique Dark']), { stdio: 'ignore', timeout: 120000 }); }
  catch (e) { console.log('icône exe non appliquée:', e.message); }
};
