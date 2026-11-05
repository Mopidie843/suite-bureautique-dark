'use strict';
/* ===== Bibliothèque de documents (IndexedDB, repli sur localStorage) ===== */
W.store = (function () {
  let dbp = null;
  const mem = {};
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB indisponible'));
      const r = indexedDB.open('word-dark-edition', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('docs', { keyPath: 'id' }); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return dbp;
  }
  async function run(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction('docs', mode);
      const req = fn(t.objectStore('docs'));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  return {
    async put(rec) { try { return await run('readwrite', s => s.put(rec)); } catch (e) { mem[rec.id] = rec; throw e; } },
    async get(id) { try { return await run('readonly', s => s.get(id)); } catch (e) { return mem[id]; } },
    async del(id) { delete mem[id]; try { return await run('readwrite', s => s.delete(id)); } catch (e) { /* ignoré */ } },
    async all() { try { return (await run('readonly', s => s.getAll())) || []; } catch (e) { return Object.values(mem); } }
  };
})();
