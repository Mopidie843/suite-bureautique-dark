'use strict';
/* ===== Moteur de calcul : références, formules, fonctions ===== */
const E = window.E = {};

E.colName = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
E.colIndex = s => { let n = 0; for (const c of s.toUpperCase()) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
E.key = (c, r) => E.colName(c) + (r + 1);
E.parseKey = k => { const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(k); return m ? { c: E.colIndex(m[1]), r: +m[2] - 1 } : null; };

/* serial Excel <-> date */
E.toSerial = d => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 864e5 * 1e6) / 1e6;
E.fromSerial = n => new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5);
E.fmtDate = n => { const d = E.fromSerial(n); return W2(d.getUTCDate()) + '/' + W2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(); };
const W2 = n => String(n).padStart(2, '0');

/* ---------- Décalage des références d'une formule (copier/coller, recopie) ---------- */
E.shiftFormula = (f, dc, dr) => f.replace(/("[^"]*")|((?:'[^']+'|[A-Za-zÀ-ÿ_][\wÀ-ÿ]*)!)?(\$?)([A-Z]{1,3})(\$?)(\d{1,7})(?![\w(])/g, (m, str, sh, ca, col, ra, row) => {
  if (str) return str;
  const c = ca ? E.colIndex(col) : E.colIndex(col) + dc, r = ra ? +row - 1 : +row - 1 + dr;
  if (c < 0 || r < 0) return '#REF!';
  return (sh || '') + (ca ? '$' : '') + E.colName(c) + (ra ? '$' : '') + (r + 1);
});

/* ---------- Analyse ---------- */
function tokenize(src) {
  const t = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') { let s = ''; i++; while (i < src.length && !(src[i] === '"' && src[i + 1] !== '"')) { if (src[i] === '"') i++; s += src[i++]; } i++; t.push({ t: 'str', v: s }); continue; }
    let m;
    if ((m = /^\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?%?/.exec(src.slice(i))) && /[\d]/.test(c)) { let v = m[0]; let pct = v.endsWith('%'); if (pct) v = v.slice(0, -1); let n = parseFloat(v.replace(',', '.')); if (pct) n /= 100; t.push({ t: 'num', v: n }); i += m[0].length; continue; }
    if ((m = /^(?:'[^']+'|[A-Za-zÀ-ÿ_][\wÀ-ÿ.]*)!/.exec(src.slice(i)))) { t.push({ t: 'sheet', v: m[0].slice(0, -1).replace(/^'|'$/g, '') }); i += m[0].length; continue; }
    if ((m = /^\$?[A-Za-z]{1,3}\$?\d+(?![\w(])/.exec(src.slice(i)))) { t.push({ t: 'ref', v: m[0].replace(/\$/g, '').toUpperCase() }); i += m[0].length; continue; }
    if ((m = /^[A-Za-zÀ-ÿ_][\wÀ-ÿ.]*/.exec(src.slice(i)))) { t.push({ t: 'id', v: m[0].toUpperCase() }); i += m[0].length; continue; }
    if ((m = /^(<=|>=|<>|[-+*/^&=<>(),:;%])/.exec(src.slice(i)))) { t.push({ t: 'op', v: m[0] === ';' ? ',' : m[0] }); i += m[0].length; continue; }
    throw new Error('#NOM?');
  }
  return t;
}
function parse(tokens) {
  let p = 0; const peek = () => tokens[p], next = () => tokens[p++];
  const isOp = v => peek() && peek().t === 'op' && peek().v === v;
  function cmp() { let l = cat(); while (peek() && peek().t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) { const o = next().v; l = { n: 'bin', o, l, r: cat() }; } return l; }
  function cat() { let l = add(); while (isOp('&')) { next(); l = { n: 'bin', o: '&', l, r: add() }; } return l; }
  function add() { let l = mul(); while (isOp('+') || isOp('-')) { const o = next().v; l = { n: 'bin', o, l, r: mul() }; } return l; }
  function mul() { let l = pow(); while (isOp('*') || isOp('/')) { const o = next().v; l = { n: 'bin', o, l, r: pow() }; } return l; }
  function pow() { let l = unary(); while (isOp('^')) { next(); l = { n: 'bin', o: '^', l, r: unary() }; } return l; }
  function unary() { if (isOp('-')) { next(); return { n: 'neg', e: unary() }; } if (isOp('+')) { next(); return unary(); } return post(); }
  function post() { let e = prim(); while (isOp('%')) { next(); e = { n: 'bin', o: '/', l: e, r: { n: 'num', v: 100 } }; } return e; }
  function prim() {
    const k = next(); if (!k) throw new Error('#ERREUR!');
    if (k.t === 'num') return { n: 'num', v: k.v };
    if (k.t === 'str') return { n: 'str', v: k.v };
    if (k.t === 'op' && k.v === '(') { const e = cmp(); if (!isOp(')')) throw new Error('#ERREUR!'); next(); return e; }
    let sheet = null, tk = k;
    if (k.t === 'sheet') { sheet = k.v; tk = next(); if (!tk) throw new Error('#REF!'); }
    if (tk.t === 'ref') {
      if (isOp(':')) { next(); const b = next(); if (!b || b.t !== 'ref') throw new Error('#REF!'); return { n: 'range', a: tk.v, b: b.v, sheet }; }
      return { n: 'ref', a: tk.v, sheet };
    }
    if (tk.t === 'id') {
      if (isOp('(')) { next(); const args = []; if (!isOp(')')) { for (;;) { args.push(cmp()); if (isOp(',')) { next(); continue; } break; } } if (!isOp(')')) throw new Error('#ERREUR!'); next(); return { n: 'fn', name: tk.v, args }; }
      if (tk.v === 'VRAI' || tk.v === 'TRUE') return { n: 'num', v: true };
      if (tk.v === 'FAUX' || tk.v === 'FALSE') return { n: 'num', v: false };
      throw new Error('#NOM?');
    }
    throw new Error('#ERREUR!');
  }
  const e = cmp(); if (p < tokens.length) throw new Error('#ERREUR!'); return e;
}

/* ---------- Fonctions ---------- */
const flat = (args, ctx) => { const o = []; args.forEach(a => { if (a && a.__range) a.cells.forEach(v => o.push(v)); else o.push(a); }); return o; };
const nums = (args, ctx) => flat(args).filter(v => typeof v === 'number' || typeof v === 'boolean').map(Number);
const num = v => { if (v === '' || v == null) return 0; if (typeof v === 'boolean') return v ? 1 : 0; if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(',', '.')); if (isNaN(n) || !isFinite(Number(String(v).replace(',', '.')))) throw new Error('#VALEUR!'); return n; };
const str = v => v == null ? '' : typeof v === 'boolean' ? (v ? 'VRAI' : 'FAUX') : String(v);
const FN = {
  SOMME: a => nums(a).reduce((x, y) => x + y, 0), SUM: a => FN.SOMME(a),
  MOYENNE: a => { const n = nums(a); if (!n.length) throw new Error('#DIV/0!'); return n.reduce((x, y) => x + y, 0) / n.length; },
  MIN: a => { const n = nums(a); return n.length ? Math.min(...n) : 0; }, MAX: a => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
  NB: a => flat(a).filter(v => typeof v === 'number').length, NBVAL: a => flat(a).filter(v => v !== '' && v != null).length,
  ABS: a => Math.abs(num(a[0])), RACINE: a => { const n = num(a[0]); if (n < 0) throw new Error('#NOMBRE!'); return Math.sqrt(n); },
  PUISSANCE: a => Math.pow(num(a[0]), num(a[1])), MOD: a => { const d = num(a[1]); if (!d) throw new Error('#DIV/0!'); return num(a[0]) - d * Math.floor(num(a[0]) / d); },
  ENT: a => Math.floor(num(a[0])), PI: () => Math.PI,
  ARRONDI: a => { const k = Math.pow(10, a[1] == null ? 0 : num(a[1])); return Math.round((num(a[0]) + Number.EPSILON) * k) / k; },
  PRODUIT: a => nums(a).reduce((x, y) => x * y, 1),
  SI: a => (a[0] ? (a[1] === undefined ? true : a[1]) : (a[2] === undefined ? false : a[2])),
  ET: a => flat(a).every(Boolean), OU: a => flat(a).some(Boolean), NON: a => !a[0],
  CONCATENER: a => flat(a).map(str).join(''), CONCAT: a => FN.CONCATENER(a),
  NBCAR: a => str(a[0]).length, MAJUSCULE: a => str(a[0]).toUpperCase(), MINUSCULE: a => str(a[0]).toLowerCase(),
  GAUCHE: a => str(a[0]).slice(0, a[1] == null ? 1 : num(a[1])), DROITE: a => { const s = str(a[0]), n = a[1] == null ? 1 : num(a[1]); return n ? s.slice(-n) : ''; },
  SUPPRESPACE: a => str(a[0]).trim().replace(/\s+/g, ' '),
  AUJOURDHUI: () => E.toSerial(new Date()), MAINTENANT: () => E.toSerial(new Date()) + (new Date().getHours() * 3600 + new Date().getMinutes() * 60) / 86400,
  ANNEE: a => E.fromSerial(num(a[0])).getUTCFullYear(), MOIS: a => E.fromSerial(num(a[0])).getUTCMonth() + 1, JOUR: a => E.fromSerial(num(a[0])).getUTCDate(),
  'SOMME.SI': (a, ctx) => { const r = a[0], crit = a[1], sr = a[2] || a[0]; let s = 0; r.cells.forEach((v, i) => { if (matchCrit(v, crit)) { const x = sr.cells[i]; if (typeof x === 'number') s += x; } }); return s; },
  'NB.SI': a => a[0].cells.filter(v => matchCrit(v, a[1])).length,
  RECHERCHEV: a => { const key = a[0], tbl = a[1], col = num(a[2]), exact = a[3] === undefined ? false : !a[3] === false ? false : !a[3]; const w = tbl.w; for (let r = 0; r < tbl.h; r++) { const v = tbl.cells[r * w]; if (v == key || (typeof v === 'string' && typeof key === 'string' && v.toLowerCase() === key.toLowerCase())) { if (col < 1 || col > w) throw new Error('#REF!'); return tbl.cells[r * w + col - 1]; } } throw new Error('#N/A'); },
  SIERREUR: null, TEXTE: a => { const f = str(a[1]); const n = num(a[0]); const d = (f.split(',')[1] || f.split('.')[1] || '').length; return n.toFixed(d).replace('.', ','); },
  ALEA: () => Math.random(), ALEA_ENTRE_BORNES: null
};
FN['ALEA.ENTRE.BORNES'] = a => { const lo = num(a[0]), hi = num(a[1]); return lo + Math.floor(Math.random() * (hi - lo + 1)); };

/* ---------- Fonctions supplémentaires ---------- */
const rx = c => { // critère -> expression régulière pour les jokers * et ?
  return new RegExp('^' + String(c).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'); };
function crit2(v, crit) {
  if (typeof crit === 'string' && /[*?]/.test(crit) && !/^(<=|>=|<>|<|>|=)/.test(crit)) return typeof v === 'string' && rx(crit).test(v);
  return matchCrit(v, crit);
}
const pairs = (a, from) => { const out = []; for (let i = from; i + 1 < a.length; i += 2) out.push([a[i], a[i + 1]]); return out; };
const allMatch = (ps, i) => ps.every(([r, c]) => crit2(r.cells[i], c));
const sortedNums = a => nums(a).slice().sort((x, y) => x - y);
const serialDate = (y, m, d) => E.toSerial(new Date(Date.UTC(y, m - 1, d)) && new Date(y, m - 1, d));
const toD = n => E.fromSerial(num(n));
Object.assign(FN, {
  'SOMME.SI.ENS': a => { const sr = a[0], ps = pairs(a, 1); let s = 0; sr.cells.forEach((v, i) => { if (typeof v === 'number' && allMatch(ps, i)) s += v; }); return s; },
  'NB.SI.ENS': a => { const ps = pairs(a, 0); return ps[0][0].cells.reduce((n, _, i) => n + (allMatch(ps, i) ? 1 : 0), 0); },
  'MOYENNE.SI': a => { const r = a[0], sr = a[2] || a[0]; const xs = []; r.cells.forEach((v, i) => { if (crit2(v, a[1]) && typeof sr.cells[i] === 'number') xs.push(sr.cells[i]); }); if (!xs.length) throw new Error('#DIV/0!'); return xs.reduce((x, y) => x + y, 0) / xs.length; },
  'MOYENNE.SI.ENS': a => { const sr = a[0], ps = pairs(a, 1), xs = []; sr.cells.forEach((v, i) => { if (typeof v === 'number' && allMatch(ps, i)) xs.push(v); }); if (!xs.length) throw new Error('#DIV/0!'); return xs.reduce((x, y) => x + y, 0) / xs.length; },
  'NB.VIDE': a => flat(a).filter(v => v === '' || v == null).length,
  RECHERCHEH: a => { const key = a[0], t = a[1], row = num(a[2]); for (let c = 0; c < t.w; c++) { const v = t.cells[c]; if (v == key || (typeof v === 'string' && typeof key === 'string' && v.toLowerCase() === key.toLowerCase())) { if (row < 1 || row > t.h) throw new Error('#REF!'); return t.cells[(row - 1) * t.w + c]; } } throw new Error('#N/A'); },
  INDEX: a => { const t = a[0], r = a[1] == null ? 1 : num(a[1]), c = a[2] == null ? 1 : num(a[2]); if (t.h === 1 && a[2] == null) return t.cells[r - 1]; if (r < 1 || c < 1 || r > t.h || c > t.w) throw new Error('#REF!'); return t.cells[(r - 1) * t.w + c - 1]; },
  EQUIV: a => { const key = a[0], t = a[1], mode = a[2] == null ? 1 : num(a[2]); const cs = t.cells;
    if (mode === 0) { const i = cs.findIndex(v => v == key || (typeof v === 'string' && typeof key === 'string' && crit2(v, key))); if (i < 0) throw new Error('#N/A'); return i + 1; }
    let best = -1; cs.forEach((v, i) => { if (typeof v === typeof key && (mode > 0 ? v <= key : v >= key)) { if (best < 0 || (mode > 0 ? v >= cs[best] : v <= cs[best])) best = i; } }); if (best < 0) throw new Error('#N/A'); return best + 1; },
  MEDIANE: a => { const n = sortedNums(a); if (!n.length) throw new Error('#NOMBRE!'); const m = n.length >> 1; return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2; },
  MODE: a => { const n = nums(a), c = new Map(); n.forEach(v => c.set(v, (c.get(v) || 0) + 1)); let b = null, k = 1; c.forEach((q, v) => { if (q > k) { k = q; b = v; } }); if (b === null) throw new Error('#N/A'); return b; },
  VAR: a => { const n = nums(a); if (n.length < 2) throw new Error('#DIV/0!'); const m = n.reduce((x, y) => x + y, 0) / n.length; return n.reduce((s, v) => s + (v - m) * (v - m), 0) / (n.length - 1); },
  ECARTYPE: a => Math.sqrt(FN.VAR(a)),
  'GRANDE.VALEUR': a => { const n = sortedNums([a[0]]).reverse(), k = num(a[1]); if (k < 1 || k > n.length) throw new Error('#NOMBRE!'); return n[k - 1]; },
  'PETITE.VALEUR': a => { const n = sortedNums([a[0]]), k = num(a[1]); if (k < 1 || k > n.length) throw new Error('#NOMBRE!'); return n[k - 1]; },
  RANG: a => { const v = num(a[0]), n = nums([a[1]]), desc = a[2] == null || !num(a[2]); if (!n.includes(v)) throw new Error('#N/A'); return 1 + n.filter(x => desc ? x > v : x < v).length; },
  'ARRONDI.SUP': a => { const k = Math.pow(10, a[1] == null ? 0 : num(a[1])); return Math.ceil(num(a[0]) * k - 1e-9) / k; },
  'ARRONDI.INF': a => { const k = Math.pow(10, a[1] == null ? 0 : num(a[1])); return Math.floor(num(a[0]) * k + 1e-9) / k; },
  SIGNE: a => Math.sign(num(a[0])), EXP: a => Math.exp(num(a[0])), LN: a => { const n = num(a[0]); if (n <= 0) throw new Error('#NOMBRE!'); return Math.log(n); }, LOG10: a => Math.log10(num(a[0])),
  FACT: a => { let n = num(a[0]), r = 1; if (n < 0 || n > 170) throw new Error('#NOMBRE!'); for (n = Math.floor(n); n > 1; n--) r *= n; return r; },
  SOMMEPROD: a => { const rs = a.map(r => (r && r.__range ? r.cells : [r])); return rs[0].reduce((s, _, i) => s + rs.reduce((p, r) => p * (typeof r[i] === 'number' ? r[i] : 0), 1), 0); },
  DATE: a => E.toSerial(new Date(num(a[0]), num(a[1]) - 1, num(a[2]))),
  JOURSEM: a => { const d = toD(a[0]).getUTCDay(), t = a[1] == null ? 1 : num(a[1]); return t === 2 ? (d + 6) % 7 + 1 : t === 3 ? (d + 6) % 7 : d + 1; },
  'FIN.MOIS': a => { const d = toD(a[0]), m = num(a[1]); return E.toSerial(new Date(d.getUTCFullYear(), d.getUTCMonth() + m + 1, 0)); },
  'MOIS.DECALER': a => { const d = toD(a[0]), m = num(a[1]); const t = new Date(d.getUTCFullYear(), d.getUTCMonth() + m, 1); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return E.toSerial(new Date(t.getFullYear(), t.getMonth(), Math.min(d.getUTCDate(), last))); },
  DATEDIF: a => { const x = toD(a[0]), y = toD(a[1]), u = str(a[2]).toUpperCase(); if (y < x) throw new Error('#NOMBRE!'); const months = (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + y.getUTCMonth() - x.getUTCMonth() - (y.getUTCDate() < x.getUTCDate() ? 1 : 0); if (u === 'D') return Math.round((y - x) / 864e5); if (u === 'M') return months; if (u === 'Y') return Math.floor(months / 12); throw new Error('#NOMBRE!'); },
  'JOURS': a => Math.round(num(a[0]) - num(a[1])),
  'NB.JOURS.OUVRES': a => { let s = Math.floor(num(a[0])), e = Math.floor(num(a[1])), n = 0, sg = e >= s ? 1 : -1; for (let d = s; sg > 0 ? d <= e : d >= e; d += sg) { const w = E.fromSerial(d).getUTCDay(); if (w !== 0 && w !== 6) n += sg; } return n; },
  HEURE: a => Math.floor(((num(a[0]) % 1) * 24) + 1e-9), MINUTE: a => Math.floor(((num(a[0]) % 1) * 1440) + 1e-9) % 60,
  STXT: a => { const s = str(a[0]), d = num(a[1]), n = num(a[2]); if (d < 1 || n < 0) throw new Error('#VALEUR!'); return s.substr(d - 1, n); },
  CHERCHE: a => { const i = str(a[1]).toLowerCase().indexOf(str(a[0]).toLowerCase(), a[2] == null ? 0 : num(a[2]) - 1); if (i < 0) throw new Error('#VALEUR!'); return i + 1; },
  TROUVE: a => { const i = str(a[1]).indexOf(str(a[0]), a[2] == null ? 0 : num(a[2]) - 1); if (i < 0) throw new Error('#VALEUR!'); return i + 1; },
  SUBSTITUE: a => { const s = str(a[0]), o = str(a[1]), n = str(a[2]); if (!o) return s; if (a[3] == null) return s.split(o).join(n); let k = num(a[3]), p = -1; while (k-- > 0) { p = s.indexOf(o, p + 1); if (p < 0) return s; } return s.slice(0, p) + n + s.slice(p + o.length); },
  REMPLACER: a => { const s = str(a[0]), d = num(a[1]) - 1, n = num(a[2]); return s.slice(0, d) + str(a[3]) + s.slice(d + n); },
  CNUM: a => num(a[0]), NOMPROPRE: a => str(a[0]).toLowerCase().replace(/(^|[\s'-])(\S)/g, (m, p, c) => p + c.toUpperCase()),
  REPT: a => str(a[0]).repeat(Math.max(0, Math.min(1000, num(a[1])))), EXACT: a => str(a[0]) === str(a[1]),
  CAR: a => String.fromCharCode(num(a[0])), CODE: a => str(a[0]).charCodeAt(0),
  'JOINDRE.TEXTE': a => { const sep = str(a[0]), skip = a[1] !== false && a[1] !== 0; return flat(a.slice(2)).filter(v => !skip || (v !== '' && v != null)).map(str).join(sep); },
  ESTNUM: a => typeof a[0] === 'number', ESTTEXTE: a => typeof a[0] === 'string' && a[0] !== '', ESTVIDE: a => a[0] === '' || a[0] == null, ESTLOGIQUE: a => typeof a[0] === 'boolean',
  XOR: a => flat(a).filter(Boolean).length % 2 === 1, 'OU.EXCLUSIF': a => FN.XOR(a)
});
Object.assign(FN, { OUX: FN.XOR });
const ALIAS2 = { SUMIFS: 'SOMME.SI.ENS', COUNTIFS: 'NB.SI.ENS', AVERAGEIF: 'MOYENNE.SI', AVERAGEIFS: 'MOYENNE.SI.ENS', COUNTBLANK: 'NB.VIDE', HLOOKUP: 'RECHERCHEH', MATCH: 'EQUIV', MEDIAN: 'MEDIANE', STDEV: 'ECARTYPE', LARGE: 'GRANDE.VALEUR', SMALL: 'PETITE.VALEUR', RANK: 'RANG', ROUNDUP: 'ARRONDI.SUP', ROUNDDOWN: 'ARRONDI.INF', SIGN: 'SIGNE', FACT_: 'FACT', SUMPRODUCT: 'SOMMEPROD', WEEKDAY: 'JOURSEM', EOMONTH: 'FIN.MOIS', EDATE: 'MOIS.DECALER', DAYS: 'JOURS', NETWORKDAYS: 'NB.JOURS.OUVRES', HOUR: 'HEURE', MID: 'STXT', SEARCH: 'CHERCHE', FIND: 'TROUVE', SUBSTITUTE: 'SUBSTITUE', REPLACE: 'REMPLACER', VALUE: 'CNUM', PROPER: 'NOMPROPRE', CHAR: 'CAR', TEXTJOIN: 'JOINDRE.TEXTE', ISNUMBER: 'ESTNUM', ISTEXT: 'ESTTEXTE', ISBLANK: 'ESTVIDE', ISLOGICAL: 'ESTLOGIQUE', VAR_: 'VAR' };
Object.entries(ALIAS2).forEach(([k, v]) => { if (FN[v]) FN[k] = FN[v]; });
// RECHERCHEV : correspondance approchée par défaut, exacte si le 4e argument est FAUX
FN.RECHERCHEV = a => {
  const key = a[0], tbl = a[1], col = num(a[2]), approx = a[3] === undefined || !!a[3], w = tbl.w; if (col < 1 || col > w) throw new Error('#REF!');
  if (!approx) { for (let r = 0; r < tbl.h; r++) { const v = tbl.cells[r * w]; if (v == key || (typeof v === 'string' && typeof key === 'string' && v.toLowerCase() === key.toLowerCase())) return tbl.cells[r * w + col - 1]; } throw new Error('#N/A'); }
  let best = -1; for (let r = 0; r < tbl.h; r++) { const v = tbl.cells[r * w]; if (typeof v === typeof key && v <= key) best = r; else if (typeof v === typeof key && v > key) break; }
  if (best < 0) throw new Error('#N/A'); return tbl.cells[best * w + col - 1];
};
FN.VLOOKUP = FN.RECHERCHEV;
// alias anglais
Object.entries({ AVERAGE: 'MOYENNE', COUNT: 'NB', COUNTA: 'NBVAL', IF: 'SI', AND: 'ET', OR: 'OU', NOT: 'NON', ROUND: 'ARRONDI', SQRT: 'RACINE', POWER: 'PUISSANCE', INT: 'ENT', LEN: 'NBCAR', UPPER: 'MAJUSCULE', LOWER: 'MINUSCULE', LEFT: 'GAUCHE', RIGHT: 'DROITE', TODAY: 'AUJOURDHUI', NOW: 'MAINTENANT', VLOOKUP: 'RECHERCHEV', SUMIF: 'SOMME.SI', COUNTIF: 'NB.SI', PRODUCT: 'PRODUIT', TRIM: 'SUPPRESPACE', RAND: 'ALEA', YEAR: 'ANNEE', MONTH: 'MOIS', DAY: 'JOUR' }).forEach(([k, v]) => { FN[k] = FN[v]; });
E.FUNCTIONS = ['SOMME', 'MOYENNE', 'MIN', 'MAX', 'NB', 'NBVAL', 'SI', 'ET', 'OU', 'NON', 'ARRONDI', 'ABS', 'RACINE', 'PUISSANCE', 'MOD', 'ENT', 'PRODUIT', 'SOMME.SI', 'NB.SI', 'RECHERCHEV', 'CONCATENER', 'NBCAR', 'MAJUSCULE', 'MINUSCULE', 'GAUCHE', 'DROITE', 'SUPPRESPACE', 'AUJOURDHUI', 'MAINTENANT', 'ANNEE', 'MOIS', 'JOUR', 'ALEA', 'ALEA.ENTRE.BORNES', 'PI', 'SIERREUR', 'TEXTE', 'SOMME.SI.ENS', 'NB.SI.ENS', 'MOYENNE.SI', 'MOYENNE.SI.ENS', 'NB.VIDE', 'RECHERCHEH', 'INDEX', 'EQUIV', 'MEDIANE', 'MODE', 'VAR', 'ECARTYPE', 'GRANDE.VALEUR', 'PETITE.VALEUR', 'RANG', 'ARRONDI.SUP', 'ARRONDI.INF', 'SIGNE', 'EXP', 'LN', 'LOG10', 'FACT', 'SOMMEPROD', 'DATE', 'JOURSEM', 'FIN.MOIS', 'MOIS.DECALER', 'DATEDIF', 'JOURS', 'NB.JOURS.OUVRES', 'HEURE', 'MINUTE', 'STXT', 'CHERCHE', 'TROUVE', 'SUBSTITUE', 'REMPLACER', 'CNUM', 'NOMPROPRE', 'REPT', 'EXACT', 'CAR', 'CODE', 'JOINDRE.TEXTE', 'ESTNUM', 'ESTTEXTE', 'ESTVIDE', 'ESTLOGIQUE', 'OU.EXCLUSIF', 'SI.CONDITIONS', 'SI.NON.DISP'];
function matchCrit(v, crit) {
  if (typeof crit === 'string') { const m = /^(<=|>=|<>|<|>|=)(.*)$/.exec(crit); if (m) { const n = parseFloat(m[2].replace(',', '.')); const x = isNaN(n) ? m[2].toLowerCase() : n, y = typeof v === 'string' ? v.toLowerCase() : v; switch (m[1]) { case '<': return y < x; case '>': return y > x; case '<=': return y <= x; case '>=': return y >= x; case '<>': return y != x; default: return y == x; } } return typeof v === 'string' && v.toLowerCase() === crit.toLowerCase(); }
  return v === crit;
}

/* ---------- Évaluation ---------- */
/* wb: { sheets:[{name, cells:{A1:{v:'=...'}}}] } ; ctx.get(sheetIdx, c, r) -> valeur calculée */
E.Calc = function (wb) {
  const cache = new Map(), busy = new Set(), parsed = new Map();
  const sheetIdx = name => { const i = wb.sheets.findIndex(s => s.name.toLowerCase() === name.toLowerCase()); if (i < 0) throw new Error('#REF!'); return i; };
  function parseCached(f) { let a = parsed.get(f); if (!a) { a = parse(tokenize(f)); parsed.set(f, a); } return a; }
  const self = {
    value(si, key) {
      const id = si + '!' + key; if (cache.has(id)) return cache.get(id);
      const cell = wb.sheets[si].cells[key]; let v;
      if (!cell || cell.v === '' || cell.v == null) v = '';
      else if (typeof cell.v === 'string' && cell.v[0] === '=' && cell.v.length > 1) {
        if (busy.has(id)) return new Error('#CIRC!');
        busy.add(id);
        try { v = evalNode(parseCached(cell.v.slice(1)), si); if (v && v.__range) v = v.cells[0]; if (v === '' || v == null) v = 0; if (typeof v === 'number' && !isFinite(v)) v = new Error('#DIV/0!'); } catch (e) { v = e instanceof Error ? e : new Error('#ERREUR!'); }
        busy.delete(id);
      } else v = cell.n !== undefined ? cell.n : cell.v;
      cache.set(id, v); return v;
    }
  };
  function chk(v) { if (v instanceof Error) throw v; return v; }
  function rangeOf(n, si) {
    const s = n.sheet ? sheetIdx(n.sheet) : si, a = E.parseKey(n.a), b = E.parseKey(n.b);
    const c0 = Math.min(a.c, b.c), c1 = Math.max(a.c, b.c), r0 = Math.min(a.r, b.r), r1 = Math.max(a.r, b.r), cells = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const v = self.value(s, E.key(c, r)); if (v instanceof Error) throw v; cells.push(v); }
    return { __range: true, cells, w: c1 - c0 + 1, h: r1 - r0 + 1 };
  }
  function evalNode(n, si) {
    switch (n.n) {
      case 'num': return n.v; case 'str': return n.v;
      case 'neg': return -num(chk(evalNode(n.e, si)));
      case 'ref': { const s = n.sheet ? sheetIdx(n.sheet) : si; return chk(self.value(s, n.a)); }
      case 'range': return rangeOf(n, si);
      case 'bin': {
        let l = evalNode(n.l, si), r = evalNode(n.r, si); if (l && l.__range) l = l.cells[0]; if (r && r.__range) r = r.cells[0];
        switch (n.o) {
          case '+': return num(l) + num(r); case '-': return num(l) - num(r); case '*': return num(l) * num(r);
          case '/': { const d = num(r); if (d === 0) throw new Error('#DIV/0!'); return num(l) / d; }
          case '^': return Math.pow(num(l), num(r)); case '&': return str(l) + str(r);
          default: { const a = typeof l === 'string' ? l.toLowerCase() : l, b = typeof r === 'string' ? r.toLowerCase() : r; switch (n.o) { case '=': return a == b; case '<>': return a != b; case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b; } }
        }
        return 0;
      }
      case 'fn': {
        if (n.name === 'SI.CONDITIONS' || n.name === 'IFS') { for (let i = 0; i + 1 < n.args.length; i += 2) { let c = evalNode(n.args[i], si); if (c && c.__range) c = c.cells[0]; if (c) return evalNode(n.args[i + 1], si); } throw new Error('#N/A'); }
        if (n.name === 'SIERREUR' || n.name === 'IFERROR' || n.name === 'SI.NON.DISP' || n.name === 'IFNA') { try { const v = evalNode(n.args[0], si); return v && v.__range ? v.cells[0] : v; } catch (e) { return n.args[1] ? evalNode(n.args[1], si) : ''; } }
        if (n.name === 'SI' || n.name === 'IF') { const c = evalNode(n.args[0], si); const cond = c && c.__range ? c.cells[0] : c; const pick = cond ? n.args[1] : n.args[2]; return pick ? evalNode(pick, si) : (cond ? true : false); }
        const f = FN[n.name]; if (!f) throw new Error('#NOM?');
        return f(n.args.map(a => evalNode(a, si)));
      }
    }
    throw new Error('#ERREUR!');
  }
  return self;
};
E.errText = e => e.message && e.message[0] === '#' ? e.message : '#ERREUR!';
