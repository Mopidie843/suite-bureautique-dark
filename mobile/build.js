'use strict';
/* Construit mobile/www : copie de src/, ajout du pont Android, bundle des générateurs de fichiers (docx/xlsx/pptx) extraits de main.js. */
const fs = require('fs'), path = require('path'), esbuild = require('esbuild'), { polyfillNode } = require('esbuild-plugin-polyfill-node');
const root = path.join(__dirname, '..'), SRC = path.join(root, 'src'), WWW = path.join(__dirname, 'www'), GEN = path.join(__dirname, '.gen');
(async () => {
fs.rmSync(WWW, { recursive: true, force: true }); fs.rmSync(GEN, { recursive: true, force: true }); fs.mkdirSync(GEN, { recursive: true });
fs.cpSync(SRC, WWW, { recursive: true });
/* retire ce qui ne sert à rien sur téléphone */
['hub.css.map'].forEach(f => fs.rmSync(path.join(WWW, f), { force: true }));

/* ---------- extraction des générateurs depuis main.js ---------- */
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const block = name => {
  const m = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(main); if (!m) throw new Error('fonction introuvable : ' + name);
  const end = main.indexOf('\n}\n', m.index); if (end < 0) throw new Error('fin introuvable : ' + name);
  return main.slice(m.index, end + 3);
};
const consts = ['NF', 'hex', 'fromArgb', 'serialToDate'].map(n => { const m = new RegExp('^const ' + n + ' = .*$', 'm').exec(main); if (!m) throw new Error('const introuvable : ' + n); return m[0]; }).join('\n');
let body = ['xlsxBuild', 'nfBack', 'xlsxParse', 'pptxBuild', 'buildDocx'].map(block).join('\n');
body = body.replace(/const (ExcelJS|PptxGenJS|JSZip) = require\('[a-z]+'\), /g, 'const ').replace(/require\('exceljs'\)/g, 'ExcelJS').replace(/require\('pptxgenjs'\)/g, 'PptxGenJS').replace(/require\('jszip'\)/g, 'JSZip')
  .replace("if (!docxLib) { const m = require('html-to-docx'); docxLib = m.default || m; }", '')
  .replace("outputType: 'nodebuffer'", "outputType: 'arraybuffer'");
if (/require\(/.test(body)) throw new Error('require restant dans le code extrait');
fs.writeFileSync(path.join(GEN, 'pre.js'), "import { Buffer } from 'buffer'; import JSZip from 'jszip'; window.Buffer = window.Buffer || Buffer; window.JSZip = JSZip;\n");
const entry = `
import './pre.js';
import ExcelJS from '../node_modules/exceljs/dist/exceljs.min.js';
import PptxMod from '../node_modules/pptxgenjs/dist/pptxgen.es.js';
const PptxGenJS = PptxMod.default || PptxMod;
import JSZip from 'jszip';
import htmlToDocxMod from '../node_modules/html-to-docx/dist/html-to-docx.esm.js';
const docxLib = htmlToDocxMod.default || htmlToDocxMod;
const G = { authorName: () => { try { return JSON.parse(localStorage.getItem('wd_userName')) || ''; } catch (e) { return ''; } } };
${consts}
${body}
window.NocteCore = { xlsxBuild, xlsxParse, pptxBuild, buildDocx };
`;
fs.writeFileSync(path.join(GEN, 'core.entry.js'), entry);
await esbuild.build({ plugins: [polyfillNode()], entryPoints: [path.join(GEN, 'core.entry.js')], bundle: true, minify: true, format: 'iife', outfile: path.join(WWW, 'common', 'mobile-core.js'), platform: 'browser', target: 'chrome100', nodePaths: [path.join(__dirname, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"', global: 'window' }, logLevel: 'error', external: [] });

/* ---------- pont + styles ---------- */
fs.copyFileSync(path.join(__dirname, 'mobile.js'), path.join(WWW, 'common', 'mobile.js'));
fs.copyFileSync(path.join(__dirname, 'mobile.css'), path.join(WWW, 'common', 'mobile.css'));
for (const [f, pre] of [['hub.html', ''], ['index.html', ''], ['excel/index.html', '../'], ['ppt/index.html', '../']]) {
  const p = path.join(WWW, f); let h = fs.readFileSync(p, 'utf8');
  h = h.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,minimum-scale=1,maximum-scale=5">');
  h = h.replace('</title>', '</title>\n<script src="' + pre + 'common/mobile.js"></script>\n<link rel="stylesheet" href="' + pre + 'common/mobile.css">');
  if (!h.includes('common/mobile.js')) throw new Error('injection impossible dans ' + f);
  fs.writeFileSync(p, h);
}
console.log('www prêt');
})().catch(e => { console.error(e.message || e); process.exit(1); });
