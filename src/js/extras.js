'use strict';
/* Word : équations et styles personnalisés */
(function () {
  const W = window.W, ACT = W.ACT, ed = W.editor;
  const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', phi: 'φ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', infty: '∞', pm: '±', times: '×', leq: '≤', geq: '≥', neq: '≠', approx: '≈', sum: '∑', int: '∫', rightarrow: '→', degree: '°' };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // mini-langage : a/b  x^2  x_i  sqrt(x)  \alpha  ; fractions « (a+b)/(c) »
  function eq2html(src) {
    let s = src.replace(/\\([A-Za-z]+)/g, (m, n) => GREEK[n] || m);
    const grp = (str, i) => { // renvoie [contenu, nouvel index] d'un groupe (…) ou d'un mot
      if (str[i] === '(') { let d = 0, j = i; for (; j < str.length; j++) { if (str[j] === '(') d++; else if (str[j] === ')' && --d === 0) break; } return [str.slice(i + 1, j), j + 1]; }
      const m = /^[A-Za-z0-9.α-ωΑ-Ω]+/.exec(str.slice(i)); return m ? [m[0], i + m[0].length] : [str[i] || '', i + 1];
    };
    function parse(str) {
      let out = '', i = 0;
      while (i < str.length) {
        const rest = str.slice(i);
        let m;
        if ((m = /^sqrt\s*\(/.exec(rest))) { const [c, j] = grp(str, i + m[0].length - 1); out += '√<span style="text-decoration:overline">' + parse(c) + '</span>'; i = j; continue; }
        const [tok, j] = grp(str, i);
        let base = str[i] === '(' ? '(' + parse(tok) + ')' : esc(tok), k = j;
        while (str[k] === '^' || str[k] === '_') { const [e, k2] = grp(str, k + 1); base += (str[k] === '^' ? '<sup>' : '<sub>') + parse(e) + (str[k] === '^' ? '</sup>' : '</sub>'); k = k2; }
        if (str[k] === '/') { const [d, k2] = grp(str, k + 1); const num = str[i] === '(' ? parse(tok) : base; out += '<span class="eqf"><sup>' + num + '</sup>⁄<sub>' + parse(d) + '</sub></span>'; i = k2; continue; }
        out += base; i = k; if (i === j && j === i && tok === '') i++;
      }
      return out;
    }
    return parse(s).replace(/\s+/g, ' ');
  }
  ACT.equation = async () => {
    const body = document.createElement('div');
    body.innerHTML = '<label class="field">Équation<input type="text" id="eq-in" placeholder="ex : x^2 + y^2 = r^2   ·   (a+b)/2   ·   sqrt(b^2-4ac)   ·   \\alpha_i"></label><div class="eq-prev" id="eq-prev" style="margin-top:10px;padding:14px;border:1px dashed #666;border-radius:8px;font:italic 22px Cambria,serif;min-height:34px"></div><small style="opacity:.6">Symboles : ^ exposant · _ indice · / fraction · sqrt( ) racine · \\alpha \\beta \\pi \\sigma \\infty \\pm \\leq \\geq \\sum…</small>';
    const r = await W.dialog({
      title: 'Insérer une équation', width: 560, body,
      buttons: [{ label: 'Annuler', value: null }, { label: 'Insérer', primary: true, collect: b => b.querySelector('#eq-in').value.trim() || false }],
      onOpen: b => { const i = b.querySelector('#eq-in'), p = b.querySelector('#eq-prev'); i.addEventListener('input', () => { p.innerHTML = eq2html(i.value); }); i.focus(); }
    });
    if (!r) return; W.focusEditor();
    W.insertHTML('<span class="eq" style="font-family:Cambria Math,Cambria,serif;font-style:italic">' + eq2html(r) + '</span>&nbsp;');
  };
  // styles personnalisés
  const KEY = 'wstyles', load = () => { try { const v = W.settings.get(KEY); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  function sample() {
    const s = getSelection(); let n = s.rangeCount ? s.getRangeAt(0).startContainer : null; if (n && n.nodeType === 3) n = n.parentElement; if (!n || !ed.contains(n)) return null;
    const c = getComputedStyle(n); return { ff: c.fontFamily.split(',')[0].replace(/["']/g, '').trim(), fs: c.fontSize, color: c.color, b: +c.fontWeight >= 600, i: c.fontStyle === 'italic', u: c.textDecorationLine.includes('underline') };
  }
  ACT.styleNew = async () => {
    const smp = sample(); if (!smp) { W.toast('Placez le curseur dans un texte mis en forme.'); return; }
    const name = await W.askText('Nouveau style', 'Nom du style (basé sur la mise en forme du texte sélectionné)', ''); if (!name || !name.trim()) return;
    const all = load().filter(x => x.name !== name.trim()); all.push(Object.assign({ name: name.trim() }, smp)); W.settings.set(KEY, all); W.toast('Style « ' + name.trim() + ' » enregistré.');
  };
  ACT.styleApply = async () => {
    const all = load(); if (!all.length) { W.toast('Aucun style : créez-en un avec « Créer un style ».'); return; }
    const body = document.createElement('div');
    body.innerHTML = all.map((s, i) => '<div class="st-it" data-i="' + i + '" style="padding:8px 12px;margin:4px 0;border:1px solid #555;border-radius:6px;cursor:pointer;font-family:' + esc(s.ff) + ';font-size:18px;color:' + s.color + ';font-weight:' + (s.b ? 700 : 400) + ';font-style:' + (s.i ? 'italic' : 'normal') + ';text-decoration:' + (s.u ? 'underline' : 'none') + '">' + esc(s.name) + '</div>').join('');
    const i = await W.dialog({ title: 'Mes styles', body, buttons: [{ label: 'Fermer', value: null }], onOpen: (b, fin) => b.querySelectorAll('.st-it').forEach(x => x.onclick = () => fin(+x.dataset.i)) });
    if (i === null || i === undefined) return; const s = all[i], sel = getSelection(); W.focusEditor();
    if (!sel.rangeCount || sel.isCollapsed) { W.toast('Sélectionnez le texte à mettre en forme.'); return; }
    const div = document.createElement('div'); div.appendChild(sel.getRangeAt(0).cloneContents());
    W.insertHTML('<span style="font-family:' + esc(s.ff) + ';font-size:' + s.fs + ';color:' + s.color + ';font-weight:' + (s.b ? 700 : 400) + ';font-style:' + (s.i ? 'italic' : 'normal') + ';text-decoration:' + (s.u ? 'underline' : 'none') + '">' + div.innerHTML + '</span>');
  };

  /* police par défaut : mémorisée en permanence, change seulement quand on la change (curseur seul ou tout sélectionné) */
  function applyDefaults() {
    const f = W.settings.get('defFont', ''), s = W.settings.get('defSize', 0);
    ed.style.fontFamily = f ? '"' + f + '",Calibri,Carlito,"Segoe UI",Arial,sans-serif' : ''; ed.style.fontSize = s ? s + 'pt' : '';
  }
  const wholeDoc = () => { const sel = getSelection(); if (!sel.rangeCount) return false; if (sel.isCollapsed) return true; const t = (sel.toString() || '').replace(/\s+/g, ''); return !!t && t === (ed.textContent || '').replace(/\s+/g, ''); };
  const SF = document.getElementById('sel-font'), SS = document.getElementById('sel-size');
  const keep = (el, key, conv) => el.addEventListener('change', () => { const w = wholeDoc(), v = el.value; if (!w) return; W.settings.set(key, conv(v)); applyDefaults(); if (W.paginate) W.paginate(); }, true); // capture : lit la valeur avant la resynchronisation de la barre
  if (SF) keep(SF, 'defFont', v => v); if (SS) keep(SS, 'defSize', v => parseFloat(v) || 0);
  applyDefaults(); W.applyDefaults = applyDefaults;

  /* ---- comparer avec un autre document : crée un nouveau document avec les différences en suivi des modifications ---- */
  const blocksOf = html => { const d = document.createElement('div'); d.innerHTML = html; const out = []; d.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,td,th').forEach(e => { if (e.querySelector('p,h1,h2,h3,h4,h5,h6,li')) return; const t = (e.textContent || '').replace(/\s+/g, ' ').trim(); if (t) out.push({ tag: /^(h[1-6])$/i.test(e.tagName) ? e.tagName.toLowerCase() : 'p', text: t }); }); return out; };
  function lcs(a, b, eq) { const n = a.length, m = b.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1)); for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = eq(a[i], b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]); const out = []; let i = 0, j = 0; while (i < n && j < m) { if (eq(a[i], b[j])) { out.push([i, j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; } return out; }
  const wordDiff = (a, b) => { const A = a.split(/(\s+)/).filter(s => s !== ''), B = b.split(/(\s+)/).filter(s => s !== ''), m = lcs(A, B, (x, y) => x === y); let i = 0, j = 0, h = ''; const del = s => s ? '<del class="rev">' + esc(s) + '</del>' : '', ins = s => s ? '<ins class="rev">' + esc(s) + '</ins>' : ''; m.concat([[A.length, B.length]]).forEach(([p, q]) => { h += del(A.slice(i, p).join('')) + ins(B.slice(j, q).join('')); if (p < A.length) h += esc(A[p]); i = p + 1; j = q + 1; }); return h; };
  W.compareHtml = (oldHtml, newHtml) => {
    const A = blocksOf(oldHtml), B = blocksOf(newHtml), m = lcs(A, B, (x, y) => x.text === y.text); let i = 0, j = 0, out = '', stats = { ins: 0, del: 0, mod: 0 };
    const tagp = (t, h) => '<' + t + '>' + h + '</' + t + '>';
    m.concat([[A.length, B.length]]).forEach(([p, q]) => {
      const olds = A.slice(i, p), news = B.slice(j, q), k = Math.max(olds.length, news.length);
      for (let n = 0; n < k; n++) { const o = olds[n], w = news[n];
        if (o && w) { out += tagp(w.tag, wordDiff(o.text, w.text)); stats.mod++; }
        else if (o) { out += tagp(o.tag, '<del class="rev">' + esc(o.text) + '</del>'); stats.del++; }
        else { out += tagp(w.tag, '<ins class="rev">' + esc(w.text) + '</ins>'); stats.ins++; } }
      if (p < A.length) out += tagp(B[q].tag, esc(B[q].text)); i = p + 1; j = q + 1;
    });
    return { html: out, stats };
  };
  ACT.compareDocs = async () => {
    if (!W.api || !W.api.openDialog) { W.toast('La comparaison nécessite l\'application Windows.'); return; }
    const files = await W.api.openDialog(); if (!files || !files[0]) return; const f = files[0];
    let other; try { other = await W.fileToHtml(f); } catch (e) { W.toast('Lecture impossible : ' + e.message, 'err'); return; }
    const r = W.compareHtml(other, W.cleanHTML ? W.cleanHTML() : ed.innerHTML);
    if (!r.stats.ins && !r.stats.del && !r.stats.mod) { W.toast('Les deux documents ont le même texte.', 'ok'); return; }
    await W.saveLibrary(); W.loadDoc({ title: 'Comparaison - ' + (W.doc.title || 'Document'), html: r.html, page: W.defaultPage() }); W.doc.dirty = true;
    W.toast(r.stats.mod + ' paragraphe(s) modifié(s), ' + r.stats.ins + ' ajouté(s), ' + r.stats.del + ' supprimé(s). Acceptez ou refusez dans Révision.', 'ok');
  };
})();
