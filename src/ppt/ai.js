'use strict';
/* ===== Assistant intégré (hors ligne) : génère des plans de diapositives et exécute des commandes en français ===== */
(function () {
  const { $, esc, ACT } = A, H = PP.h, panel = $('#ai-panel'), log = $('#ai-log'), input = $('#ai-input');
  const say = (t, who) => { const d = document.createElement('div'); d.className = 'ai-m ' + (who || 'bot'); d.textContent = t; log.appendChild(d); log.scrollTop = log.scrollHeight; };
  ACT.aiToggle = () => { panel.classList.toggle('hidden'); if (!panel.classList.contains('hidden')) { input.focus(); if (!log.children.length) intro(); } window.dispatchEvent(new Event('resize')); };
  let online = false;
  let aiMode = 'off';
  const refresh = async () => { let st = { on: false, mode: 'off' }; try { if (A.api && A.api.aiStatus) st = await A.api.aiStatus(); } catch (e) { /* hors application Windows */ } online = !!st.on; aiMode = st.mode; const b = $('#ai-mode'); if (b) { b.textContent = st.mode === 'cli' ? 'Claude (abonnement) ✓' : st.mode === 'key' ? 'IA connectée ✓' : 'Hors ligne'; b.classList.toggle('on', online); } };
  ACT.aiKey = async () => {
    if (!A.api || !A.api.aiSetKey) { A.toast('Disponible dans l\'application Windows.'); return; }
    const st = A.api.aiStatus ? await A.api.aiStatus() : {};
    const body = document.createElement('div');
    body.innerHTML = '<p style="margin:0 0 10px"><b>Option 1 : votre abonnement Claude (Pro ou Max), sans clé API.</b><br>L\'application utilise <b>Claude Code</b> installé sur ce PC, avec votre propre connexion Claude. ' + (st.cli ? '<span style="color:#3fa66b">Claude Code détecté (' + A.esc(st.cliVersion || '') + ').</span>' : '<span style="color:#d08a2e">Claude Code non détecté.</span>') + '</p>'
      + (st.cli ? '' : '<ol style="margin:0 0 10px;padding-left:18px;line-height:1.6"><li>Installez Claude Code : <b>claude.com/product/claude-code</b> (ou <code>npm i -g @anthropic-ai/claude-code</code>).</li><li>Cliquez « Me connecter » puis tapez <code>/login</code> et choisissez votre compte Claude.</li><li>Revenez ici et cliquez « Tester ».</li></ol>')
      + '<p style="margin:0 0 6px;opacity:.8;font-size:12px">Les textes concernés par votre demande sont envoyés à Anthropic via votre abonnement ; l\'utilisation compte dans les limites de votre forfait.</p><hr style="opacity:.2"><p style="margin:10px 0 6px"><b>Option 2 : clé API Anthropic</b> (facturée à l\'usage, séparée de l\'abonnement). Laissez vide puis validez pour supprimer la clé.</p><label class="field">Clé API<input type="password" id="ai-k" placeholder="sk-ant-…" autocomplete="off"></label>';
    const r = await A.dialog({ title: 'IA connectée (facultatif)', width: 540, body, buttons: [{ label: 'Annuler', value: null }, { label: 'Me connecter', value: { login: true } }, { label: 'Tester mon abonnement', value: { test: true } }, { label: 'Enregistrer la clé', primary: true, collect: b => ({ key: b.querySelector('#ai-k').value }) }] });
    if (r === null) return;
    if (r.login) { const x = await A.api.aiCliLogin(); say(x.ok ? 'Terminal ouvert : tapez /login, choisissez votre compte Claude, puis revenez et cliquez « Tester mon abonnement ».' : 'Impossible d\'ouvrir le terminal : ' + x.error); return; }
    if (r.test) { say('Test de Claude Code en cours…'); const x = await A.api.aiCliTest(); await refresh(); say(x.ok ? 'Abonnement Claude connecté : je peux rédiger, reformuler et traduire.' : (x.installed === false ? 'Claude Code n\'est pas installé sur ce PC.' : 'Échec : ' + x.error)); return; }
    const res = await A.api.aiSetKey(r.key); await refresh(); say(res.ok ? (res.on ? 'Clé API enregistrée : IA connectée activée.' : 'Clé supprimée.' + (aiMode === 'cli' ? ' Je continue avec votre abonnement Claude.' : ' Retour au mode hors ligne.')) : 'Échec : ' + res.error);
  };
  const askModel = async (system, prompt) => { const r = await A.api.aiAsk({ system, prompt }); if (!r.ok) throw new Error(r.error); return r.text; };
  const jsonOf = t => { const m = /\{[\s\S]*\}/.exec(t); if (!m) throw new Error('réponse inattendue'); return JSON.parse(m[0]); };
  async function onlineGenerate(topic, n) {
    say('Rédaction en cours avec l\'IA connectée…');
    const t = await askModel('Tu crées le contenu de diaporamas en français. Réponds UNIQUEMENT par un objet JSON : {"title":"...","slides":[{"title":"...","pts":["...","..."]}]}. Chaque diapositive a un titre court et 3 à 5 puces concises (moins de 14 mots). N\'inclus pas la diapositive de titre. N\'invente aucun chiffre précis ni source si tu n\'en es pas sûr.', 'Sujet : ' + topic + '\nNombre de diapositives de contenu : ' + Math.max(1, n - 1));
    const j = jsonOf(t); const content = (j.slides || []).map(x => ({ title: String(x.title || ''), pts: (x.pts || []).map(String) })).filter(x => x.title);
    if (!content.length) throw new Error('aucun contenu reçu'); const c = build(cap(j.title || topic), content);
    say('Voilà : ' + c + ' diapositives rédigées par l\'IA. Relisez et vérifiez les informations avant de présenter.');
  }
  async function onlineFree(txt) {
    const o = H.selObj(), ctx = H.sl().objs.filter(x => x.text).map(x => x.text).join('\n---\n');
    const t = await askModel('Tu es l\'assistant d\'un logiciel de présentation. Réponds UNIQUEMENT par un objet JSON. Si l\'utilisateur demande de réécrire, reformuler, traduire, raccourcir ou corriger du texte, renvoie {"action":"text","text":"nouveau texte"} (le texte remplace l\'objet sélectionné, ou le contenu principal de la diapositive ; garde les retours à la ligne et les puces « • »). Si il demande de créer une présentation, renvoie {"action":"slides","title":"...","slides":[{"title":"...","pts":["..."]}]}. Sinon renvoie {"action":"reply","text":"réponse courte en français"}.', 'Demande : ' + txt + '\n\nTexte de l\'objet sélectionné :\n' + (o && o.text ? o.text : '(aucun)') + '\n\nTexte de la diapositive courante :\n' + ctx);
    const j = jsonOf(t);
    if (j.action === 'text' && j.text) { const tg = o && o.type !== 'image' ? o : H.sl().objs.filter(x => x.text && x.type !== 'image')[1] || H.sl().objs.find(x => x.text); if (!tg) { say(j.text); return; } PP.mutate(() => { tg.text = String(j.text); }); say('Texte modifié par l\'IA (Ctrl+Z pour annuler).'); }
    else if (j.action === 'slides' && Array.isArray(j.slides)) { const c = build(cap(j.title || 'Présentation'), j.slides.map(x => ({ title: String(x.title || ''), pts: (x.pts || []).map(String) }))); say(c + ' diapositives créées.'); }
    else say(String(j.text || 'Je n\'ai rien à ajouter.'));
  }
  function intro() {
    say('Bonjour ! Je suis l\'assistant de Nocte PowerPoint. ' + (online ? 'L\'IA connectée est activée : je peux aussi rédiger, reformuler et traduire.' : 'Je fonctionne hors ligne : je structure vos idées en diapositives et j\'exécute vos commandes, mais je ne rédige pas de contenu (bouton « Hors ligne » en haut pour activer une IA connectée avec votre clé API).') + '\n\nEssayez : « crée une présentation sur le recyclage en 6 diapos », ou collez un texte avec « transforme ce texte en diaporama ».');
    chips();
  }
  const CHIPS = [['Créer une présentation…', () => genDialog()], ['Ajouter une diapo', 'ajoute une diapo'], ['Changer le thème', 'thème océan'], ['Texte plus grand', 'agrandis le texte'], ['Mettre en liste', 'mets en liste'], ['Résumer', 'résume'], ['Lancer le diaporama', 'lance le diaporama']];
  function chips() { const c = $('#ai-chips'); c.innerHTML = ''; CHIPS.forEach(([l, a]) => { const b = document.createElement('button'); b.textContent = l; b.onclick = () => typeof a === 'function' ? a() : run(a); c.appendChild(b); }); }

  /* ---------- Génération de plan ---------- */
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const clip = (s, n) => s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
  function fromText(txt, n) {
    const blocks = txt.replace(/\r/g, '').split(/\n\s*\n/).map(b => b.split('\n').map(l => l.trim()).filter(Boolean)).filter(b => b.length);
    let slides = [];
    const isTitle = l => /^#{1,3}\s/.test(l) || (l.length <= 60 && !/[.!?;,:]$/.test(l) && l.split(' ').length <= 9);
    const bullet = l => l.replace(/^(#{1,3}\s|[-*•]\s|\d+[.)]\s)/, '').trim();
    const sentences = p => p.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    if (blocks.length === 1 && blocks[0].length > 6 && blocks[0].every(l => l.length < 90)) { const g = []; for (let i = 0; i < blocks[0].length; i += 4) g.push(blocks[0].slice(i, i + 4)); blocks.splice(0, 1, ...g); }
    blocks.forEach(b => {
      if (b.length > 1 && isTitle(b[0])) slides.push({ title: bullet(b[0]), pts: b.slice(1).flatMap(l => l.length > 140 ? sentences(l) : [l]).map(bullet) });
      else if (b.length === 1 && isTitle(b[0])) slides.push({ title: bullet(b[0]), pts: [] });
      else { const ss = b.flatMap(l => l.length > 140 ? sentences(l) : [l]).map(bullet); slides.push({ title: clip(cap(ss[0].replace(/[.!?]+$/, '')), 48), pts: ss.slice(1).length ? ss.slice(1) : ss }); }
    });
    // un titre seul est fusionné avec le bloc suivant
    const merged = []; slides.forEach(s => { const p = merged[merged.length - 1]; if (p && !p.pts.length && s.pts.length && /^#{0}/.test('')) { p.pts = s.pts.concat(); if (s.title) p.pts.unshift(s.title); } else merged.push(s); });
    slides = merged.map(s => ({ title: s.title, pts: s.pts.map(p => clip(p, 110)).slice(0, 6) }));
    if (n && slides.length > n) slides = slides.slice(0, n);
    return slides;
  }
  function skeleton(topic, n) {
    const T = topic.trim(), t = T.toLowerCase();
    const all = [
      { title: 'Introduction', pts: ['Présentation du sujet : ' + t, 'Pourquoi ce sujet est important', 'Objectifs de cette présentation'] },
      { title: 'Contexte et définitions', pts: ['Définir : ' + t, 'Quelques repères historiques ou chiffres clés', 'Les acteurs concernés'] },
      { title: 'Point clé n°1', pts: ['Idée principale', 'Un exemple concret', 'Ce qu\'il faut retenir'] },
      { title: 'Point clé n°2', pts: ['Idée principale', 'Un exemple concret', 'Ce qu\'il faut retenir'] },
      { title: 'Point clé n°3', pts: ['Idée principale', 'Un exemple concret', 'Ce qu\'il faut retenir'] },
      { title: 'Avantages et limites', pts: ['Les avantages', 'Les limites ou risques', 'Comment les gérer'] },
      { title: 'Exemples et cas pratiques', pts: ['Cas n°1', 'Cas n°2', 'Enseignements'] },
      { title: 'Conclusion', pts: ['Les idées essentielles de ' + t, 'Les prochaines étapes', 'Perspectives'] },
      { title: 'Questions ?', pts: ['Merci pour votre attention'] }
    ];
    const keep = Math.max(1, n - 1); let pick;
    if (keep >= all.length) pick = all; else { // on garde introduction, conclusion et questions, puis on complète
      const core = [all[0], all[7]], mid = [all[1], all[2], all[3], all[5], all[4], all[6]]; pick = [all[0]].concat(mid.slice(0, Math.max(0, keep - 2)), [all[7]]); if (keep < 2) pick = [all[0]]; }
    if (keep >= 2 && pick[pick.length - 1] !== all[8] && n >= 3) pick = pick.concat([all[8]]);
    return pick.slice(0, Math.max(1, n - 1));
  }
  function build(topic, content, replace) {
    const th = H.themeOf();
    const ts = { id: A.uid(), bg: th.bg, notes: '', objs: [H.text(80, 170, 800, 110, topic, { fs: 54, b: true, color: th.title, al: 'center' }), H.text(160, 300, 640, 70, 'Présentation · ' + new Date().toLocaleDateString('fr-FR'), { fs: 26, al: 'center' })] };
    const body = content.map(c => { const s = H.makeSlide('content'); s.objs[0].text = c.title; s.objs[1].text = c.pts.length ? c.pts.map(p => '• ' + p).join('\n') : ''; if (!c.pts.length) s.objs.pop(); else s.objs[1].fs = c.pts.length > 4 ? 22 : 26; return s; });
    PP.mutate(() => { const d = PP.deck; const onlyBlank = d.slides.length === 1 && d.slides[0].objs.every(o => /^(Titre de la présentation|Sous-titre)$/.test(o.text || '')); const all = [ts].concat(body); if (replace || onlyBlank) { d.slides.splice(0, d.slides.length, ...all); H.cur = 0; } else { d.slides.push(...all); H.cur = d.slides.length - all.length; } if (PP.deck.title.startsWith('Présentation1')) { PP.deck.title = cap(topic); $('#doc-title').value = PP.deck.title; } });
    return body.length + 1;
  }
  async function genDialog(prefTopic) {
    const body = document.createElement('div');
    body.innerHTML = '<label class="field">Sujet de la présentation<input type="text" id="g-topic" value="' + esc(prefTopic || '') + '" placeholder="Ex : Le recyclage des déchets"></label><label class="field">Nombre de diapositives<select id="g-n"><option>4</option><option selected>6</option><option>8</option><option>10</option><option>12</option></select></label><label class="field">Votre texte (facultatif) — collez vos notes, je les découpe en diapositives<textarea id="g-text" style="min-height:130px;font-family:inherit"></textarea></label>';
    const r = await A.dialog({ title: 'Créer une présentation', width: 520, body, buttons: [{ label: 'Annuler', value: null }, { label: 'Créer', primary: true, collect: b => { const t = b.querySelector('#g-topic').value.trim(), x = b.querySelector('#g-text').value.trim(); if (!t && !x) { A.toast('Indiquez un sujet ou collez un texte.', 'err'); return false; } return { t, x, n: +b.querySelector('#g-n').value }; } }] });
    if (r) generate(r.t, r.x, r.n);
  }
  async function generate(topic, text, n) {
    n = n || 6; let content, title = topic;
    if (online && !text) { try { await onlineGenerate(topic, n); return; } catch (e) { say('L\'IA connectée a échoué (' + e.message + '). Je crée un plan type à la place.'); } }
    if (text) { content = fromText(text, n - 1); if (!title) { title = content.length && content[0].title.length < 50 ? content[0].title : 'Ma présentation'; } if (!content.length) { say('Je n\'ai pas trouvé de contenu exploitable dans ce texte.'); return; } }
    else content = skeleton(topic, n);
    const c = build(cap(title), content);
    say('Voilà : ' + c + ' diapositives créées.' + (text ? ' J\'ai découpé votre texte par titres et paragraphes ; relisez et ajustez les formulations.' : ' C\'est un plan type avec des intitulés à compléter : je ne recherche pas d\'informations, c\'est à vous de les remplir (ou collez vos notes et je les mettrai en forme).'));
  }

  /* ---------- Commandes ---------- */
  const COLORS = { rouge: '#d13438', bleu: '#2b579a', vert: '#2f8f46', jaune: '#f5c400', orange: '#e8833a', noir: '#000000', blanc: '#ffffff', violet: '#7a49b0', rose: '#e0599a', gris: '#777777' };
  const targets = () => { const o = H.selObj(); return o && o.type !== 'image' ? [o] : H.sl().objs.filter(x => x.type === 'text' || x.text); };
  const mapT = fn => { const ts = targets(); if (!ts.length) return false; PP.mutate(() => ts.forEach(fn)); return true; };
  const colorIn = q => { for (const k of Object.keys(COLORS)) if (new RegExp('\\b' + k).test(q)) return COLORS[k]; return null; };
  const RULES = [
    [/(cr[ée]+|fais|g[ée]n[èe]re|construis).*(pr[ée]sentation|diaporama|diapos?)\s+(?:sur|à propos de|autour de|pour)\s+(.+)/, (q, m) => { let t = m[3]; let n = 6; const nm = /(\d+)\s*(?:diapos?|slides?|pages?)/.exec(q); if (nm) { n = Math.max(3, Math.min(20, +nm[1])); t = t.replace(nm[0], '').replace(/\b(en|avec)\s*$/, ''); } generate(t.replace(/[«»"]/g, '').replace(/\s+(en|avec)\s*$/, '').trim(), '', n); }],
    [/(transforme|convertis|d[ée]coupe).*(texte|notes)/, () => genDialog()],
    [/(cr[ée]+|fais|g[ée]n[èe]re).*(pr[ée]sentation|diaporama)/, () => genDialog()],
    [/(ajoute|nouvelle|cr[ée]e|insère).*(diapo|slide)/, (q, m) => { const t = /(?:intitul[ée]e?|titre|nomm[ée]e?|appel[ée]e?|sur)\s*:?\s*[«"]?(.+?)[»"]?$/.exec(q); ACT.addSlide(); if (t) { PP.mutate(() => { const o = H.sl().objs[0]; if (o) o.text = cap(t[1]); }); } say('Diapositive ajoutée' + (t ? ' : « ' + cap(t[1]) + ' »' : '') + '.'); }],
    [/(supprime|enl[èe]ve|efface).*(diapo|slide)/, () => { ACT.delSlide(); say('Diapositive supprimée (Ctrl+Z pour annuler).'); }],
    [/(duplique|copie).*(diapo|slide)/, () => { ACT.dupSlide(); say('Diapositive dupliquée.'); }],
    [/th[èe]me\s*(.*)/, (q, m) => { const i = H.THEMES.findIndex(t => q.includes(t.n.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')) || q.includes(t.n.toLowerCase())); const n = i >= 0 ? i : null; if (n === null) { say('Thèmes disponibles : ' + H.THEMES.map(t => t.n).join(', ') + '.'); return; } H.setTheme(n); say('Thème « ' + H.THEMES[n].n + ' » appliqué.'); }],
    [/(fond|arri[èe]re-plan).*/, q => { const c = colorIn(q); if (!c) { say('Dites par exemple « fond bleu ».'); return; } PP.mutate(() => { H.sl().bg = c; }); say('Fond modifié.'); }],
    [/(couleur|en)\s+(rouge|bleu|vert|jaune|orange|noir|blanc|violet|rose|gris)/, q => { const c = colorIn(q); if (!mapT(o => { o.color = c; })) say('Il n\'y a pas de texte sur cette diapositive.'); else say('Couleur du texte modifiée.'); }],
    [/(agrandis|plus grand|augmente)/, () => { if (mapT(o => { o.fs = Math.min(120, (o.fs || 18) + 4); })) say('Texte agrandi.'); }],
    [/(r[ée]duis|plus petit|diminue|rapetisse)/, () => { if (mapT(o => { o.fs = Math.max(8, (o.fs || 18) - 4); })) say('Texte réduit.'); }],
    [/gras/, () => { if (mapT(o => { o.b = true; })) say('Texte en gras.'); }],
    [/italique/, () => { if (mapT(o => { o.i = true; })) say('Texte en italique.'); }],
    [/centr/, () => { if (mapT(o => { o.al = 'center'; })) say('Texte centré.'); }],
    [/(align|mets).*gauche/, () => { if (mapT(o => { o.al = 'left'; })) say('Texte aligné à gauche.'); }],
    [/(align|mets).*droite/, () => { if (mapT(o => { o.al = 'right'; })) say('Texte aligné à droite.'); }],
    [/majuscule/, () => { if (mapT(o => { o.text = String(o.text || '').toUpperCase(); })) say('Mis en majuscules.'); }],
    [/minuscule/, () => { if (mapT(o => { o.text = String(o.text || '').toLowerCase(); })) say('Mis en minuscules.'); }],
    [/(liste|puces)/, () => { if (mapT(o => { const ls = String(o.text || '').split(/\n|(?<=[.!?])\s+/).map(l => l.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean); o.text = ls.map(l => '• ' + l).join('\n'); })) say('Texte mis sous forme de liste à puces.'); }],
    [/(r[ée]sum|raccourci|condense)/, () => { if (mapT(o => { const ss = String(o.text || '').split(/\n|(?<=[.!?])\s+/).map(l => l.trim()).filter(Boolean); if (ss.length > 3) o.text = ss.slice(0, 3).join('\n'); else o.text = ss.map(l => clip(l, 70)).join('\n'); })) say('Texte raccourci (3 lignes maximum, 70 caractères par ligne). Relisez-le : je coupe, je ne reformule pas.'); }],
    [/(rectangle|carr[ée])/, () => { ACT.addRect(); say('Rectangle ajouté.'); }],
    [/(cercle|ellipse)/, () => { ACT.addEllipse(); say('Ellipse ajoutée.'); }],
    [/triangle/, () => { ACT.addTriangle(); say('Triangle ajouté.'); }],
    [/(zone de texte|ajoute.*texte)\s*:?\s*[«"]?(.*?)[»"]?$/, (q, m) => { ACT.addText(); if (m[2] && m[2].length > 1) PP.mutate(() => { const o = H.sl().objs[H.sl().objs.length - 1]; o.text = cap(m[2]); }); say('Zone de texte ajoutée.'); }],
    [/image|photo/, () => { say('Choisissez l\'image sur votre ordinateur.'); ACT.addImage(); }],
    [/notes?\s*:?\s*(.+)/, (q, m) => { PP.mutate(() => { H.sl().notes = m[1]; }); say('Notes du présentateur ajoutées à cette diapositive.'); }],
    [/(lance|d[ée]marre|pr[ée]sente|diaporama)/, () => { H.play(0); }],
    [/(enregistre|sauvegarde)/, () => { ACT.save(); }],
    [/pdf/, () => { ACT.exportPdf(); }],
    [/(annule)/, () => { ACT.undo(); say('Annulé.'); }]
  ];
  const norm = s => s.toLowerCase().trim();
  function run(txt) {
    const q = norm(txt); if (!q) return; say(txt, 'me');
    const qa = q.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    for (const [re, fn] of RULES) { const m = re.exec(q) || re.exec(qa); if (m) { try { fn(qa.length === q.length ? q : q, m); } catch (e) { say('Je n\'ai pas pu faire ça : ' + e.message); } return; } }
    if (online) { onlineFree(txt).catch(e => say('L\'IA connectée a échoué : ' + e.message)); return; }
    say('Je n\'ai pas compris. Voici ce que je sais faire :\n• créer une présentation sur un sujet (« … sur le recyclage en 8 diapos »)\n• ajouter / supprimer / dupliquer une diapo\n• changer le thème ou le fond (« thème forêt », « fond bleu »)\n• agrandir / réduire le texte, gras, italique, centrer, couleur\n• mettre en liste, résumer, mettre en majuscules\n• ajouter une forme, une zone de texte, des notes\n• lancer le diaporama, enregistrer, exporter en PDF\n\nPour le reste (rédiger, traduire, reformuler), activez l\'IA connectée avec le bouton « Hors ligne » en haut du panneau.');
  }
  $('#ai-send').addEventListener('click', () => { const v = input.value; input.value = ''; run(v); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const v = input.value; input.value = ''; run(v); } e.stopPropagation(); });
  refresh();
  window.AI = { run, generate, fromText, skeleton };
})();
