'use strict';
/* ===== Modèles de documents (Word, Excel, PowerPoint) ===== */
window.TPL = (function () {
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const T = { list: [
    { app: 'word', id: 'cv', name: 'C.V. moderne', icon: 'fa-id-card' },
    { app: 'word', id: 'letter', name: 'Lettre de motivation', icon: 'fa-envelope-open-text' },
    { app: 'word', id: 'invoice', name: 'Facture', icon: 'fa-file-invoice-dollar' },
    { app: 'word', id: 'report', name: 'Rapport', icon: 'fa-file-lines' },
    { app: 'word', id: 'minutes', name: 'Compte rendu de réunion', icon: 'fa-users' },
    { app: 'excel', id: 'budget', name: 'Budget mensuel', icon: 'fa-piggy-bank' },
    { app: 'excel', id: 'invoice', name: 'Facture avec TVA', icon: 'fa-file-invoice' },
    { app: 'excel', id: 'tasks', name: 'Suivi de tâches', icon: 'fa-list-check' },
    { app: 'excel', id: 'grades', name: 'Moyenne pondérée', icon: 'fa-graduation-cap' },
    { app: 'ppt', id: 'pitch', name: 'Présentation type (projet)', icon: 'fa-rocket' },
    { app: 'ppt', id: 'report', name: 'Rapport d\'activité', icon: 'fa-chart-line' }
  ] };

  /* ----- Word ----- */
  const cell = (t, st) => '<td style="border:1px solid #8a8a8a;padding:4px 8px;' + (st || '') + '">' + t + '</td>';
  const hcell = t => '<td style="border:1px solid #8a8a8a;padding:4px 8px;background-color:#2b579a;color:#ffffff;font-weight:700">' + t + '</td>';
  T.word = {
    invoice: { title: 'Facture', html: '<h1>FACTURE</h1><p><b>Votre entreprise</b><br>Adresse · Code postal Ville<br>SIRET : 000 000 000 00000 · Tél. : 00 00 00 00 00</p><p><b>Facture n° :</b> 2026-001<br><b>Date :</b> ' + new Date().toLocaleDateString('fr-FR') + '<br><b>Échéance :</b> 30 jours</p><p><b>Facturé à :</b><br>Nom du client<br>Adresse du client</p>' +
      '<table style="border-collapse:collapse;width:100%"><tr>' + hcell('Désignation') + hcell('Qté') + hcell('Prix unitaire') + hcell('Total') + '</tr><tr>' + cell('Prestation 1') + cell('1') + cell('0,00 €') + cell('0,00 €') + '</tr><tr>' + cell('Prestation 2') + cell('1') + cell('0,00 €') + cell('0,00 €') + '</tr><tr>' + cell('') + cell('') + cell('<b>Total HT</b>') + cell('0,00 €') + '</tr><tr>' + cell('') + cell('') + cell('<b>TVA 20 %</b>') + cell('0,00 €') + '</tr><tr>' + cell('') + cell('') + cell('<b>Total TTC</b>') + cell('<b>0,00 €</b>') + '</tr></table><p><br></p><p>Paiement par virement : IBAN FR00 0000 0000 0000 0000 0000 000</p><p>En cas de retard, une pénalité de 3 fois le taux d\'intérêt légal sera appliquée, ainsi qu\'une indemnité forfaitaire de 40 € pour frais de recouvrement.</p>' },
    report: { title: 'Rapport', html: '<h1>Titre du rapport</h1><p><i>Auteur · Date · Service</i></p><h2>Résumé</h2><p>Présentez en quelques lignes l\'objet du rapport, la méthode et les conclusions principales.</p><h2>1. Introduction</h2><p>Contexte et objectifs.</p><h2>2. Analyse</h2><h3>2.1 Constats</h3><ul><li>Premier constat</li><li>Deuxième constat</li></ul><h3>2.2 Interprétation</h3><p>Texte.</p><h2>3. Recommandations</h2><ol><li>Première recommandation</li><li>Deuxième recommandation</li></ol><h2>Conclusion</h2><p>Synthèse et prochaines étapes.</p><h2>Annexes</h2><p>Documents, tableaux, sources.</p>' },
    minutes: { title: 'Compte rendu de réunion', html: '<h1>Compte rendu de réunion</h1><p><b>Date :</b> ' + new Date().toLocaleDateString('fr-FR') + ' · <b>Lieu :</b> … · <b>Durée :</b> …</p><p><b>Participants :</b> …</p><p><b>Excusés :</b> …</p><h2>Ordre du jour</h2><ol><li>Point 1</li><li>Point 2</li></ol><h2>Décisions prises</h2><ul><li>Décision 1</li></ul><h2>Actions à mener</h2><table style="border-collapse:collapse;width:100%"><tr>' + hcell('Action') + hcell('Responsable') + hcell('Échéance') + '</tr><tr>' + cell('…') + cell('…') + cell('…') + '</tr></table><h2>Prochaine réunion</h2><p>Date et ordre du jour prévisionnel.</p>' }
  };

  /* ----- Excel ----- */
  const H = { b: true, fill: '#217346', color: '#ffffff' }, S = (c, r, v, s) => ({ k: c + r, v, s });
  const mk = (title, sheetName, rows, colW, extra) => { const cells = {}; rows.forEach(c => { cells[c.k] = c.s ? { v: c.v, s: c.s } : { v: c.v }; }); return Object.assign({ title, sheets: [Object.assign({ name: sheetName, cells, colW, rowH: {} }, extra || {})] }, {}); };
  T.excel = {
    budget: () => { const r = [], hd = ['Catégorie', 'Prévu', 'Réel', 'Écart']; hd.forEach((h, i) => r.push(S('ABCD'[i], 1, h, H)));
      const rev = [['Salaire', 2000, 2000], ['Autres revenus', 100, 80]], dep = [['Loyer', 700, 700], ['Alimentation', 300, 340], ['Transport', 90, 75], ['Loisirs', 120, 150], ['Épargne', 200, 200]];
      r.push(S('A', 2, 'REVENUS', { b: true, fill: '#e2efda' })); let n = 3; rev.forEach(x => { r.push(S('A', n, x[0]), S('B', n, x[1], { nf: 'eur' }), S('C', n, x[2], { nf: 'eur' }), S('D', n, '=C' + n + '-B' + n, { nf: 'eur' })); n++; });
      r.push(S('A', n, 'Total revenus', { b: true }), S('B', n, '=SOMME(B3:B' + (n - 1) + ')', { b: true, nf: 'eur' }), S('C', n, '=SOMME(C3:C' + (n - 1) + ')', { b: true, nf: 'eur' }), S('D', n, '=C' + n + '-B' + n, { b: true, nf: 'eur' })); const tr = n; n += 2;
      r.push(S('A', n, 'DÉPENSES', { b: true, fill: '#fce4d6' })); n++; const d0 = n; dep.forEach(x => { r.push(S('A', n, x[0]), S('B', n, x[1], { nf: 'eur' }), S('C', n, x[2], { nf: 'eur' }), S('D', n, '=B' + n + '-C' + n, { nf: 'eur' })); n++; });
      r.push(S('A', n, 'Total dépenses', { b: true }), S('B', n, '=SOMME(B' + d0 + ':B' + (n - 1) + ')', { b: true, nf: 'eur' }), S('C', n, '=SOMME(C' + d0 + ':C' + (n - 1) + ')', { b: true, nf: 'eur' }), S('D', n, '=B' + n + '-C' + n, { b: true, nf: 'eur' })); const td = n; n += 2;
      r.push(S('A', n, 'SOLDE DU MOIS', { b: true, fill: '#ffeb9c' }), S('B', n, '=B' + tr + '-B' + td, { b: true, nf: 'eur', fill: '#ffeb9c' }), S('C', n, '=C' + tr + '-C' + td, { b: true, nf: 'eur', fill: '#ffeb9c' }));
      return mk('Budget mensuel', 'Budget', r, { 0: 170, 1: 100, 2: 100, 3: 100 }, { cf: [{ r0: 2, c0: 3, r1: n - 1, c1: 3, op: 'lt', a: '0', b: '', fill: '#ffc7ce', color: '#9c0006' }] }); },
    invoice: () => { const r = [S('A', 1, 'FACTURE', { b: true, sz: 20, color: '#217346' }), S('A', 2, 'Votre entreprise'), S('A', 3, 'Adresse · SIRET'), S('D', 1, 'N° 2026-001', { b: true, al: 'right' }), S('D', 2, '=AUJOURDHUI()', { nf: 'date', al: 'right' }), S('A', 5, 'Facturé à :', { b: true }), S('A', 6, 'Nom du client')];
      ['Désignation', 'Quantité', 'Prix unitaire', 'Total'].forEach((h, i) => r.push(S('ABCD'[i], 8, h, H)));
      for (let n = 9; n <= 13; n++) r.push(S('A', n, n === 9 ? 'Prestation 1' : n === 10 ? 'Prestation 2' : ''), S('B', n, n < 11 ? 1 : ''), S('C', n, n < 11 ? 0 : '', { nf: 'eur' }), S('D', n, '=SI(B' + n + '="";"";B' + n + '*C' + n + ')', { nf: 'eur' }));
      r.push(S('C', 15, 'Total HT', { b: true, al: 'right' }), S('D', 15, '=SOMME(D9:D13)', { nf: 'eur', b: true }), S('C', 16, 'Taux de TVA', { al: 'right' }), S('D', 16, 0.2, { nf: '%' }), S('C', 17, 'TVA', { al: 'right' }), S('D', 17, '=D15*D16', { nf: 'eur' }), S('C', 18, 'Total TTC', { b: true, al: 'right' }), S('D', 18, '=D15+D17', { nf: 'eur', b: true, fill: '#e2efda' }));
      return mk('Facture', 'Facture', r, { 0: 220, 1: 90, 2: 110, 3: 110 }); },
    tasks: () => { const r = []; ['Tâche', 'Responsable', 'Échéance', 'Statut', 'Priorité'].forEach((h, i) => r.push(S('ABCDE'[i], 1, h, H)));
      [['Définir le cahier des charges', 'Alice', 46350, 'Terminé', 'Haute'], ['Maquettes', 'Bob', 46365, 'En cours', 'Haute'], ['Développement', 'Claire', 46400, 'À faire', 'Moyenne'], ['Tests', 'Bob', 46420, 'À faire', 'Moyenne'], ['Livraison', 'Alice', 46430, 'À faire', 'Basse']].forEach((x, i) => { const n = i + 2; r.push(S('A', n, x[0]), S('B', n, x[1]), S('C', n, x[2], { nf: 'date' }), S('D', n, x[3]), S('E', n, x[4])); });
      r.push(S('G', 1, 'Avancement', { b: true }), S('G', 2, '=NB.SI(D2:D100;"Terminé")/NBVAL(A2:A100)', { nf: '%', b: true }));
      return mk('Suivi de tâches', 'Tâches', r, { 0: 240, 1: 120, 2: 110, 3: 100, 4: 100, 5: 30, 6: 100 }, { cf: [{ r0: 1, c0: 3, r1: 99, c1: 3, op: 'text', a: 'Terminé', b: '', fill: '#c6efce', color: '#006100' }, { r0: 1, c0: 3, r1: 99, c1: 3, op: 'text', a: 'En cours', b: '', fill: '#ffeb9c', color: '#9c5700' }, { r0: 1, c0: 4, r1: 99, c1: 4, op: 'text', a: 'Haute', b: '', fill: '#ffc7ce', color: '#9c0006' }] }); },
    grades: () => { const r = []; ['Matière', 'Coefficient', 'Note /20', 'Points'].forEach((h, i) => r.push(S('ABCD'[i], 1, h, H)));
      [['Mathématiques', 4, 14], ['Français', 4, 12.5], ['Histoire-Géo', 3, 15], ['Anglais', 3, 16], ['Sciences', 3, 13]].forEach((x, i) => { const n = i + 2; r.push(S('A', n, x[0]), S('B', n, x[1]), S('C', n, x[2], { nf: '0.00' }), S('D', n, '=B' + n + '*C' + n, { nf: '0.00' })); });
      r.push(S('A', 8, 'MOYENNE', { b: true, fill: '#e2efda' }), S('B', 8, '=SOMME(B2:B7)', { b: true, fill: '#e2efda' }), S('C', 8, '=SOMME(D2:D7)/SOMME(B2:B7)', { b: true, nf: '0.00', fill: '#e2efda' }));
      return mk('Moyenne pondérée', 'Notes', r, { 0: 170, 1: 100, 2: 100, 3: 90 }); }
  };

  /* ----- PowerPoint ----- */
  const tx = (x, y, w, h, t, o) => Object.assign({ id: uid(), type: 'text', x, y, w, h, text: t, fs: 24, color: '#262626', al: 'left', ff: 'Calibri' }, o);
  const bar = (c) => ({ id: uid(), type: 'rect', x: 0, y: 0, w: 960, h: 14, fill: c, line: '', text: '', fs: 12, color: '#fff', al: 'center' });
  const content = (title, pts, th) => ({ id: uid(), bg: th.bg, notes: '', tr: 'fade', objs: [bar(th.accent), tx(60, 36, 840, 90, title, { fs: 40, b: true, color: th.title }), tx(60, 140, 840, 340, pts.map(p => '• ' + p).join('\n'), { fs: 26, color: th.text })] });
  T.ppt = {
    pitch: () => { const th = { n: 'Océan', bg: '#0b3d5c', title: '#ffffff', text: '#d9eefb', accent: '#35a7d8' };
      return { title: 'Présentation de projet', theme: 1, slides: [
        { id: uid(), bg: th.bg, notes: '', tr: 'fade', objs: [tx(80, 170, 800, 110, 'Nom du projet', { fs: 60, b: true, color: th.title, al: 'center' }), tx(160, 300, 640, 70, 'Une phrase qui résume la proposition de valeur', { fs: 26, color: th.text, al: 'center' }), { id: uid(), type: 'rect', x: 400, y: 285, w: 160, h: 5, fill: th.accent, line: '', text: '', fs: 12, color: '#fff', al: 'center' }] },
        content('Le problème', ['Qui est concerné ?', 'Quelle difficulté rencontre-t-il ?', 'Pourquoi les solutions actuelles ne suffisent pas'], th),
        content('Notre solution', ['Ce que nous proposons', 'Comment cela fonctionne', 'Ce qui nous différencie'], th),
        content('Chiffres clés', ['Taille du marché ou du public visé', 'Résultats déjà obtenus', 'Objectifs à 12 mois'], th),
        content('Plan d\'action', ['Étape 1 : …', 'Étape 2 : …', 'Étape 3 : …'], th),
        { id: uid(), bg: th.bg, notes: '', tr: 'fade', objs: [tx(80, 190, 800, 110, 'Merci !', { fs: 60, b: true, color: th.title, al: 'center' }), tx(160, 310, 640, 60, 'Questions ? · contact@exemple.fr', { fs: 26, color: th.text, al: 'center' })] }] }; },
    report: () => { const th = { n: 'Office', bg: '#ffffff', title: '#2b579a', text: '#262626', accent: '#2b579a' };
      const tbl = { id: uid(), type: 'table', x: 60, y: 150, w: 840, h: 200, cells: [['Indicateur', 'Objectif', 'Réalisé', 'Écart'], ['Chiffre d\'affaires', '100 k€', '108 k€', '+8 %'], ['Nouveaux clients', '40', '35', '-5'], ['Satisfaction', '90 %', '93 %', '+3 pts']], hdr: true, fs: 22, color: th.text, fill: th.accent, line: '#8a8a8a' };
      return { title: 'Rapport d\'activité', theme: 0, slides: [
        { id: uid(), bg: th.bg, notes: '', tr: 'push', objs: [bar(th.accent), tx(80, 170, 800, 110, 'Rapport d\'activité', { fs: 54, b: true, color: th.title, al: 'center' }), tx(160, 300, 640, 70, 'Trimestre · Équipe · Date', { fs: 26, color: th.text, al: 'center' })] },
        content('Sommaire', ['Faits marquants', 'Résultats chiffrés', 'Difficultés rencontrées', 'Perspectives'], th),
        { id: uid(), bg: th.bg, notes: '', tr: 'push', objs: [bar(th.accent), tx(60, 36, 840, 90, 'Résultats chiffrés', { fs: 40, b: true, color: th.title }), tbl] },
        content('Difficultés rencontrées', ['Problème 1 et solution envisagée', 'Problème 2 et solution envisagée'], th),
        content('Perspectives', ['Objectifs du prochain trimestre', 'Ressources nécessaires', 'Décisions attendues'], th)] }; }
  };
  return T;
})();
