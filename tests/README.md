# Tests automatisés (Playwright + Electron)

1. Lancer l'application avec le débogage activé :
   `npx electron . --no-sandbox --remote-debugging-port=9337 --user-data-dir=/tmp/ud`
   (sous Linux sans écran : `xvfb-run -a ...`)
2. Dans un autre terminal : `NODE_PATH=$(npm root -g) node tests/t_tpl.js /tmp` (modèles + palette),
   `t_xl2.js` (Excel : tableau croisé, fusion, figer, xlsx), `t_ppt3.js` (PowerPoint : flèche, rotation, ombre, dégradé, repères, mode présentateur),
   `t_w3.js` (Word : équation, styles), `t_ai2.js` (IA connectée, clé factice).
Chaque script affiche les résultats et « no errors » si aucune erreur JavaScript n'est levée. Playwright doit être installé (`npm i -g playwright`).
