'use strict';
/* ===== Annuler / Rétablir : historique maison, indépendant du navigateur ===== */
(function () {
  const ed = W.editor, MAX = 300;
  const stack = []; let idx = -1, applying = false;
  const snap = () => ({ html: W.cleanHTML(), sel: W.saveSel() });

  function updateButtons() {
    W.$$('[data-act=undo]').forEach(b => b.style.opacity = idx > 0 ? '1' : '.4');
    W.$$('[data-act=redo]').forEach(b => b.style.opacity = idx < stack.length - 1 ? '1' : '.4');
  }
  function record() {
    if (applying) return;
    const s = snap(), cur = stack[idx];
    if (cur && cur.html === s.html) { if (s.sel) cur.sel = s.sel; return; }
    stack.length = idx + 1; stack.push(s);
    if (stack.length > MAX) stack.shift();
    idx = stack.length - 1; updateButtons();
  }
  const soon = W.debounce(record, 400);

  function apply(s) {
    applying = true;
    try {
      ed.innerHTML = s.html;
      W.paginate({ sel: null });
      ed.focus({ preventScroll: true });
      W.loadSel(s.sel);
    } finally { applying = false; }
    updateButtons();
    if (W.docChanged) W.docChanged({ history: false });
    if (W.scrollToSel) W.scrollToSel();
  }

  W.history = {
    reset() { soon.cancel(); stack.length = 0; idx = -1; record(); },
    touch() { if (!applying) soon(); },
    commit() { soon.cancel(); record(); },
    flush() { soon.flush(); },
    undo() { soon.flush(); if (idx > 0) { idx--; apply(stack[idx]); return true; } return false; },
    redo() { soon.flush(); if (idx < stack.length - 1) { idx++; apply(stack[idx]); return true; } return false; },
    updateButtons
  };
})();
