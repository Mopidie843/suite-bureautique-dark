'use strict';
/* ===== Nocte PowerPoint : bibliothèque de formes et de graphiques (rendu SVG) ===== */
(function () {
  const RR = r => 'M' + r + ' 0H' + (100 - r) + 'Q100 0 100 ' + r + 'V' + (100 - r) + 'Q100 100 ' + (100 - r) + ' 100H' + r + 'Q0 100 0 ' + (100 - r) + 'V' + r + 'Q0 0 ' + r + ' 0Z';
  /* k : identifiant ; n : libellé ; p : tracé (0-100) ; prst : forme PowerPoint */
  const KINDS = [
    { k: 'roundRect', n: 'Rectangle arrondi', p: RR(14), prst: 'roundRect' },
    { k: 'diamond', n: 'Losange', p: 'M50 0L100 50L50 100L0 50Z', prst: 'diamond' },
    { k: 'pentagon', n: 'Pentagone', p: 'M50 0L100 38L81 100L19 100L0 38Z', prst: 'pentagon' },
    { k: 'hexagon', n: 'Hexagone', p: 'M25 0L75 0L100 50L75 100L25 100L0 50Z', prst: 'hexagon' },
    { k: 'octagon', n: 'Octogone', p: 'M30 0L70 0L100 30L100 70L70 100L30 100L0 70L0 30Z', prst: 'octagon' },
    { k: 'star5', n: 'Étoile à 5 branches', p: 'M50 0L61 35L98 35L68 57L79 91L50 70L21 91L32 57L2 35L39 35Z', prst: 'star5' },
    { k: 'star4', n: 'Étoile à 4 branches', p: 'M50 0L62 38L100 50L62 62L50 100L38 62L0 50L38 38Z', prst: 'star4' },
    { k: 'chevron', n: 'Chevron', p: 'M0 0L70 0L100 50L70 100L0 100L30 50Z', prst: 'chevron' },
    { k: 'rightArrow', n: 'Flèche droite', p: 'M0 30L60 30L60 0L100 50L60 100L60 70L0 70Z', prst: 'rightArrow' },
    { k: 'leftArrow', n: 'Flèche gauche', p: 'M100 30L40 30L40 0L0 50L40 100L40 70L100 70Z', prst: 'leftArrow' },
    { k: 'upArrow', n: 'Flèche haut', p: 'M30 100L30 40L0 40L50 0L100 40L70 40L70 100Z', prst: 'upArrow' },
    { k: 'downArrow', n: 'Flèche bas', p: 'M30 0L70 0L70 60L100 60L50 100L0 60L30 60Z', prst: 'downArrow' },
    { k: 'heart', n: 'Cœur', p: 'M50 92C10 62 0 38 0 26C0 9 12 0 27 0C38 0 46 6 50 15C54 6 62 0 73 0C88 0 100 9 100 26C100 38 90 62 50 92Z', prst: 'heart' },
    { k: 'callout', n: 'Bulle de dialogue', p: 'M5 0H95Q100 0 100 5V65Q100 70 95 70H38L18 98L24 70H5Q0 70 0 65V5Q0 0 5 0Z', prst: 'wedgeRoundRectCallout' },
    { k: 'plus', n: 'Croix', p: 'M35 0H65V35H100V65H65V100H35V65H0V35H35Z', prst: 'mathPlus' },
    { k: 'parallelogram', n: 'Parallélogramme', p: 'M20 0H100L80 100H0Z', prst: 'parallelogram' },
    { k: 'trapezoid', n: 'Trapèze', p: 'M20 0H80L100 100H0Z', prst: 'trapezoid' },
    { k: 'rtTriangle', n: 'Triangle rectangle', p: 'M0 0L100 100H0Z', prst: 'rtTriangle' },
    { k: 'bolt', n: 'Éclair', p: 'M60 0L12 56H44L34 100L88 38H56Z', prst: 'lightningBolt' },
    { k: 'line', n: 'Ligne', p: 'M0 50L100 50', prst: 'line', stroke: true }
  ];
  const BY = {}, BYPRST = {}; KINDS.forEach(x => { BY[x.k] = x; BYPRST[x.prst] = x.k; });
  const NS = 'http://www.w3.org/2000/svg';
  const PAL = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#9c755f'];
  const E = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Forme : SVG à insérer dans l'élément de l'objet ---------- */
  function shapeSvg(o) {
    const d = BY[o.kind] || KINDS[0], lw = o.lw || 2, st = d.stroke ? (o.line || o.fill || '#ffffff') : (o.line || 'none');
    const fill = d.stroke ? 'none' : (o.fill || 'transparent');
    const dash = o.dash === 'dash' ? '10 6' : o.dash === 'dot' ? '2 5' : '';
    const sv = document.createElementNS(NS, 'svg'); sv.setAttribute('viewBox', '0 0 100 100'); sv.setAttribute('preserveAspectRatio', 'none'); sv.setAttribute('class', 'psvg');
    sv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none';
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d.p); p.setAttribute('fill', fill); p.setAttribute('stroke', st); p.setAttribute('stroke-width', st === 'none' ? 0 : lw);
    p.setAttribute('vector-effect', 'non-scaling-stroke'); p.setAttribute('stroke-linejoin', 'round'); if (dash) p.setAttribute('stroke-dasharray', dash);
    if (o.grad && !d.stroke) { const id = 'g' + o.id, df = document.createElementNS(NS, 'defs'); df.innerHTML = '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + E(o.fill || '#fff') + '"/><stop offset="1" stop-color="' + E(o.grad) + '"/></linearGradient>'; sv.appendChild(df); p.setAttribute('fill', 'url(#' + id + ')'); }
    sv.appendChild(p); return sv;
  }
  const pathOf = k => (BY[k] || KINDS[0]).p;

  /* ---------- Graphique : SVG de la taille exacte de l'objet ---------- */
  const nice = mx => { if (mx <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(mx))), f = mx / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
  function chartSvg(o, theme) {
    const W = Math.max(60, o.w), H = Math.max(60, o.h), tc = o.color || (theme && theme.text) || '#262626', fs = o.fs || 14, labels = o.labels || [], ser = (o.series || []).filter(s => s && s.values);
    const cols = o.colors && o.colors.length ? o.colors : PAL, t = o.ctype || 'bar'; let g = '';
    const title = o.title ? '<text x="' + W / 2 + '" y="' + (fs + 6) + '" text-anchor="middle" font-size="' + (fs + 4) + '" font-weight="700" fill="' + tc + '">' + E(o.title) + '</text>' : '';
    const top = o.title ? fs + 22 : 12, legendH = (t === 'pie' || t === 'doughnut' || ser.length > 1) ? fs + 14 : 0, L = 44, R = 12, B = 26 + legendH, T = top;
    const names = (t === 'pie' || t === 'doughnut') ? labels : ser.map(s => s.name || '');
    let legend = ''; if (legendH) { const items = names.map((n, i) => ({ n, c: cols[i % cols.length] })); const cw = Math.max(50, W / Math.max(1, items.length)); items.forEach((it, i) => { const x = i * cw + 14; legend += '<rect x="' + x + '" y="' + (H - fs - 4) + '" width="' + (fs - 2) + '" height="' + (fs - 2) + '" fill="' + it.c + '"/><text x="' + (x + fs) + '" y="' + (H - 5) + '" font-size="' + (fs - 1) + '" fill="' + tc + '">' + E(it.n) + '</text>'; }); }
    if (t === 'pie' || t === 'doughnut') {
      const vals = (ser[0] ? ser[0].values : []).map(v => Math.max(0, +v || 0)), sum = vals.reduce((a, b) => a + b, 0) || 1, cx = W / 2, cy = T + (H - T - legendH - 10) / 2, r = Math.max(10, Math.min(W / 2 - 14, (H - T - legendH - 14) / 2)); let a0 = -Math.PI / 2;
      vals.forEach((v, i) => {
        const a1 = a0 + v / sum * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, c = cols[i % cols.length];
        if (vals.length === 1) g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + c + '"/>';
        else g += '<path d="M' + cx + ' ' + cy + 'L' + (cx + r * Math.cos(a0)) + ' ' + (cy + r * Math.sin(a0)) + 'A' + r + ' ' + r + ' 0 ' + big + ' 1 ' + (cx + r * Math.cos(a1)) + ' ' + (cy + r * Math.sin(a1)) + 'Z" fill="' + c + '" stroke="' + ((theme && theme.bg) || '#fff') + '" stroke-width="2"/>';
        const am = (a0 + a1) / 2, pr = t === 'doughnut' ? r * .8 : r * .65; if (v / sum > .04) g += '<text x="' + (cx + pr * Math.cos(am)) + '" y="' + (cy + pr * Math.sin(am) + fs / 3) + '" text-anchor="middle" font-size="' + (fs - 1) + '" font-weight="700" fill="#fff">' + Math.round(v / sum * 100) + ' %</text>';
        a0 = a1;
      });
      if (t === 'doughnut') g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r * .5 + '" fill="' + ((theme && theme.bg) || '#fff') + '"/>';
    } else {
      let mx = 0, mn = 0; ser.forEach(s => s.values.forEach(v => { v = +v || 0; if (v > mx) mx = v; if (v < mn) mn = v; }));
      const top2 = nice(mx), n = Math.max(labels.length, ...ser.map(s => s.values.length), 1), pw = W - L - R, ph = H - T - B, X0 = L, Y0 = T + ph, sc = v => Y0 - (v - mn) / ((top2 - mn) || 1) * ph;
      for (let i = 0; i <= 4; i++) { const v = mn + (top2 - mn) * i / 4, y = sc(v); g += '<line x1="' + X0 + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="' + tc + '" stroke-opacity=".18"/><text x="' + (X0 - 6) + '" y="' + (y + fs / 3) + '" text-anchor="end" font-size="' + (fs - 2) + '" fill="' + tc + '">' + (Math.round(v * 100) / 100) + '</text>'; }
      const bw = pw / n;
      labels.forEach((lb, i) => { g += '<text x="' + (X0 + bw * (i + .5)) + '" y="' + (Y0 + fs + 4) + '" text-anchor="middle" font-size="' + (fs - 2) + '" fill="' + tc + '">' + E(lb) + '</text>'; });
      if (t === 'bar') {
        const m = ser.length || 1, gw = bw * .72, w1 = gw / m;
        ser.forEach((s, si) => s.values.forEach((v, i) => { v = +v || 0; const x = X0 + bw * i + (bw - gw) / 2 + w1 * si, y = Math.min(sc(v), sc(0)), h = Math.abs(sc(v) - sc(0)); g += '<rect x="' + x + '" y="' + y + '" width="' + Math.max(1, w1 - 2) + '" height="' + h + '" fill="' + cols[si % cols.length] + '" rx="2"/>'; }));
      } else {
        ser.forEach((s, si) => {
          const pts = s.values.map((v, i) => [X0 + bw * (i + .5), sc(+v || 0)]), c = cols[si % cols.length], d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join('');
          if (t === 'area' && pts.length) g += '<path d="' + d + 'L' + pts[pts.length - 1][0] + ' ' + Y0 + 'L' + pts[0][0] + ' ' + Y0 + 'Z" fill="' + c + '" fill-opacity=".35"/>';
          g += '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="3" stroke-linejoin="round"/>'; pts.forEach(p => { g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="' + c + '"/>'; });
        });
      }
      g += '<line x1="' + X0 + '" x2="' + (W - R) + '" y1="' + sc(0) + '" y2="' + sc(0) + '" stroke="' + tc + '" stroke-opacity=".5"/>';
    }
    return '<svg xmlns="' + NS + '" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="' + E(o.ff || 'Calibri') + ', sans-serif">' + title + g + legend + '</svg>';
  }

  /* Données de graphique <-> texte « CSV » (séparateur ; , ou tabulation) */
  const SAMPLE = { labels: ['T1', 'T2', 'T3', 'T4'], series: [{ name: 'Ventes', values: [12, 19, 8, 15] }, { name: 'Coûts', values: [7, 11, 6, 9] }] };
  function toCsv(o) { const ss = o.series || []; return ['Catégorie;' + ss.map(s => s.name).join(';')].concat((o.labels || []).map((l, i) => l + ';' + ss.map(s => (s.values[i] == null ? '' : s.values[i])).join(';'))).join('\n'); }
  function fromCsv(txt) {
    const rows = String(txt || '').split(/\r?\n/).map(r => r.trim()).filter(Boolean).map(r => r.split(/[;\t]/).map(c => c.trim()));
    if (rows.length < 2 || rows[0].length < 2) return null;
    const names = rows[0].slice(1), labels = rows.slice(1).map(r => r[0] || ''), series = names.map((n, j) => ({ name: n || 'Série ' + (j + 1), values: rows.slice(1).map(r => { const v = parseFloat(String(r[j + 1] || '0').replace(',', '.')); return isNaN(v) ? 0 : v; }) }));
    return { labels, series };
  }
  window.PPX = { KINDS, BY, BYPRST, PAL, shapeSvg, pathOf, chartSvg, SAMPLE, toCsv, fromCsv, grid: false };
})();
