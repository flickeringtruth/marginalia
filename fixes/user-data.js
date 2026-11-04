/* Marginalia user settings: export everything to one backup file, and import someone else's backup.
   COPY replaces the items you choose. ADD only fills in what you don't have yet.
   Loaded from index.html as a module. Remove the script tag to turn it off.
   Backups are not encrypted. Share them only with people you trust. */
(() => {
  if (window.__marginaliaUserData) return;
  window.__marginaliaUserData = true;

  const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = msg => {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._mlT); t._mlT = setTimeout(() => t.classList.remove('on'), 2400);
  };
  const changed = () => document.dispatchEvent(new CustomEvent('catalog:library-updated'));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  const TEMP_KEY = 'marginalia.tempBooks';

  function loadJSZip() {
    if (window.JSZip) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = JSZIP_URL;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load the file tools. Check your connection.'));
      document.head.appendChild(s);
    });
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('books-reader', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function run(store, mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => { db.close(); resolve(req ? req.result : undefined); };
      t.onerror = () => { db.close(); reject(t.error); };
      t.onabort = () => { db.close(); reject(t.error || new Error('Storage is unavailable.')); };
    });
  }
  const dbAllMeta = () => run('meta', 'readonly', s => s.getAll()).catch(() => []);
  const dbMeta = id => run('meta', 'readonly', s => s.get(id));
  const dbFile = id => run('files', 'readonly', s => s.get(id));
  const dbPutMeta = m => run('meta', 'readwrite', s => s.put(m));
  const dbPutFile = (id, buf) => run('files', 'readwrite', s => s.put(buf, id));

  // Builds the backup zip from everything the reader keeps on this device.
  async function collect() {
    const z = new window.JSZip();
    const metas = (await dbAllMeta()).filter(m => !m.temp);
    const m = {
      format: 'marginalia-backup', version: 1, created: new Date().toISOString(),
      name: lsGet('marginalia.name', ''),
      appearance: lsGet('reader.settings', null),
      audio: lsGet('reader.audio', null),
      voiceProxy: (() => { try { return localStorage.getItem('marginalia.voiceProxy') || ''; } catch (e) { return ''; } })(),
      vocabulary: lsGet('reader.vocabulary.v1', []),
      library: lsGet('marginalia.library', null),
      books: [], highlights: {}, notes: {}, bookmarks: {}, progress: {}
    };
    for (const meta of metas) {
      const entry = Object.assign({}, meta);
      delete entry.coverBuf;
      entry.hasCover = !!meta.coverBuf;
      const file = await dbFile(meta.id);
      if (file) z.file('books/' + meta.id + '.bin', file);
      if (meta.coverBuf) z.file('covers/' + meta.id + '.bin', meta.coverBuf);
      m.books.push(entry);
      const id = meta.id;
      m.highlights[id] = lsGet('reader.hl.' + id, []);
      m.notes[id] = lsGet('marginalia.notes.' + id, []);
      m.bookmarks[id] = lsGet('marginalia.bookmarks.' + id, []);
      m.progress[id] = {
        pos: lsGet('reader.pos.' + id, null),
        speed: lsGet('reader.speed.position.' + id, null),
        audio: lsGet('reader.audiopos.' + id, null),
        auto: lsGet('reader.autoscroll.' + id, false)
      };
    }
    z.file('manifest.json', JSON.stringify(m));
    return z.generateAsync({ type: 'blob' });
  }

  async function exportBackup() {
    toast('Preparing your backup…');
    try {
      await loadJSZip();
      const blob = await collect();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'marginalia-backup-' + new Date().toISOString().slice(0, 10) + '.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Backup saved');
    } catch (e) { toast('Export failed: ' + (e.message || e)); }
  }

  // ---- screens ----
  let wrap = null;
  function show(html, bind) {
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'mlu-overlay';
      document.body.appendChild(wrap);
      wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    }
    wrap.innerHTML = `<div class="mlu-sheet" role="dialog" aria-modal="true" aria-label="User settings">${html}</div>`;
    bind(wrap.firstElementChild);
  }
  function close() { if (wrap) { wrap.remove(); wrap = null; } }

  function home() {
    const name = lsGet('marginalia.name', '');
    show(`<div class="mlu-head"><h2>User settings</h2><button type="button" class="mlu-x" data-close aria-label="Close">×</button></div>
      <section class="mlu-card"><h3>Profile</h3>
        <label class="mlu-lbl">Your name<input id="mluName" class="mlu-input" maxlength="30" value="${esc(name)}"></label>
        <button type="button" class="mlu-btn" data-savename>Save name</button>
      </section>
      <section class="mlu-card"><h3>Export</h3>
        <p class="mlu-p">One backup file with your appearance, audio settings, reading progress, highlights, notes, bookmarks, vocabulary, library and the books themselves.</p>
        <button type="button" class="mlu-primary" data-export>Export my backup</button>
      </section>
      <section class="mlu-card"><h3>Import</h3>
        <p class="mlu-p">Open a backup someone shared with you. You choose what to bring in, and whether to copy it over or only add what you’re missing.</p>
        <button type="button" class="mlu-btn" data-import>Import a backup</button>
        <input type="file" id="mluFile" accept=".zip,application/zip" hidden>
      </section>`,
      root => {
        root.addEventListener('click', e => {
          if (e.target.closest('[data-close]')) { close(); return; }
          if (e.target.closest('[data-savename]')) {
            lsSet('marginalia.name', root.querySelector('#mluName').value.trim().slice(0, 30));
            toast('Name saved'); return;
          }
          if (e.target.closest('[data-export]')) { exportBackup(); return; }
          if (e.target.closest('[data-import]')) { root.querySelector('#mluFile').click(); }
        });
        root.querySelector('#mluFile').addEventListener('change', async e => {
          const f = e.target.files && e.target.files[0]; if (!f) return;
          await readBackup(f);
          e.target.value = '';
        });
      });
  }

  async function readBackup(file) {
    try {
      await loadJSZip();
      const zip = await window.JSZip.loadAsync(file);
      const mf = zip.file('manifest.json');
      if (!mf) throw new Error('This is not a Marginalia backup.');
      const m = JSON.parse(await mf.async('string'));
      if (!m || m.format !== 'marginalia-backup') throw new Error('This is not a Marginalia backup.');
      preview(zip, m);
    } catch (e) { toast(e.message || 'Could not read this backup.'); }
  }

  const count = o => Object.values(o || {}).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);

  function preview(zip, m) {
    const items = [];
    if (m.name) items.push({ k: 'profile', t: 'Profile', d: 'Name: ' + m.name });
    if (m.appearance) items.push({ k: 'appearance', t: 'Appearance', d: 'Theme, fonts, layout and colours' });
    if (m.audio) items.push({ k: 'audio', t: 'Audio', d: 'Voice, speed, highlighting and sleep timer' });
    if (m.books && m.books.length) items.push({ k: 'books', t: 'Books', d: m.books.length + (m.books.length === 1 ? ' book' : ' books') + ' with covers' });
    if (m.progress && Object.keys(m.progress).length) items.push({ k: 'progress', t: 'Reading progress', d: 'Where you stopped in each book' });
    const hl = count(m.highlights), nt = count(m.notes), bm = count(m.bookmarks);
    if (hl) items.push({ k: 'highlights', t: 'Highlights', d: hl + (hl === 1 ? ' highlight' : ' highlights') });
    if (nt) items.push({ k: 'notes', t: 'Notes', d: nt + (nt === 1 ? ' note' : ' notes') });
    if (bm) items.push({ k: 'bookmarks', t: 'Bookmarks', d: bm + (bm === 1 ? ' bookmark' : ' bookmarks') });
    if (m.vocabulary && m.vocabulary.length) items.push({ k: 'vocabulary', t: 'Vocabulary', d: m.vocabulary.length + ' saved words' });
    if (m.library) items.push({ k: 'library', t: 'Pins & categories', d: 'How you organised your library' });

    show(`<div class="mlu-head"><h2>Import backup</h2><button type="button" class="mlu-x" data-close aria-label="Close">×</button></div>
      <p class="mlu-from">From <b>${esc(m.name || 'someone')}</b> · ${esc(new Date(m.created).toLocaleDateString())}</p>
      <div class="mlu-seg" role="radiogroup" aria-label="Import mode">
        <button type="button" data-mode="copy" class="on" role="radio" aria-checked="true">Copy</button>
        <button type="button" data-mode="add" role="radio" aria-checked="false">Add</button>
      </div>
      <p class="mlu-hint" id="mluHint"></p>
      <div class="mlu-list">${items.map(i => `<label class="mlu-item"><input type="checkbox" data-pick="${i.k}" checked><span><b>${esc(i.t)}</b><small>${esc(i.d)}</small></span></label>`).join('') || '<p class="mlu-p">This backup has nothing to import.</p>'}</div>
      <div class="mlu-actions"><button type="button" class="mlu-btn" data-back>Back</button><button type="button" class="mlu-primary" data-review>Review</button></div>`,
      root => {
        let mode = 'copy';
        const hint = () => {
          root.querySelector('#mluHint').textContent = mode === 'copy'
            ? 'Copy replaces the items you choose with the ones from this backup.'
            : 'Add keeps what you have and only brings in what’s missing.';
        };
        hint();
        root.addEventListener('click', e => {
          if (e.target.closest('[data-close]')) { close(); return; }
          if (e.target.closest('[data-back]')) { home(); return; }
          const modeBtn = e.target.closest('[data-mode]');
          if (modeBtn) {
            mode = modeBtn.dataset.mode;
            root.querySelectorAll('[data-mode]').forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
            hint(); return;
          }
          if (e.target.closest('[data-review]')) {
            const picks = [...root.querySelectorAll('[data-pick]:checked')].map(i => i.dataset.pick);
            if (!picks.length) { toast('Choose at least one item.'); return; }
            review(zip, m, picks, mode);
          }
        });
      });
  }

  function review(zip, m, picks, mode) {
    const names = { profile: 'Profile', appearance: 'Appearance', audio: 'Audio', books: 'Books', progress: 'Reading progress', highlights: 'Highlights', notes: 'Notes', bookmarks: 'Bookmarks', vocabulary: 'Vocabulary', library: 'Pins & categories' };
    const list = picks.map(p => names[p]).join(', ');
    const copy = mode === 'copy';
    show(`<div class="mlu-head"><h2>${copy ? 'Copy from backup' : 'Add from backup'}</h2><button type="button" class="mlu-x" data-close aria-label="Close">×</button></div>
      <div class="mlu-warn ${copy ? 'danger' : ''}">
        <b>${copy ? 'This replaces what you have.' : 'This adds only what’s missing.'}</b>
        <p>${copy ? `The chosen items on this device will be overwritten with those from ${esc(m.name || 'the backup')}.` : 'Nothing you already have will be changed or removed.'}</p>
        <p class="mlu-p"><b>Brings in:</b> ${esc(list)}</p>
      </div>
      ${copy ? '<label class="mlu-lbl">Type IMPORT to confirm<input id="mluConfirm" class="mlu-input" autocomplete="off" autocapitalize="characters"></label>' : ''}
      <div class="mlu-actions"><button type="button" class="mlu-btn" data-back>Back</button><button type="button" class="mlu-primary" data-go disabled>Import</button></div>`,
      root => {
        const go = root.querySelector('[data-go]');
        const confirm = root.querySelector('#mluConfirm');
        if (confirm) {
          confirm.addEventListener('input', () => { go.disabled = confirm.value.trim() !== 'IMPORT'; });
        } else go.disabled = false;
        root.addEventListener('click', async e => {
          if (e.target.closest('[data-close]')) { close(); return; }
          if (e.target.closest('[data-back]')) { preview(zip, m); return; }
          if (e.target.closest('[data-go]') && !go.disabled) {
            go.disabled = true; go.textContent = 'Importing…';
            try {
              const n = await apply(zip, m, new Set(picks), !copy);
              done(n);
            } catch (err) {
              go.disabled = false; go.textContent = 'Import';
              toast('Import failed: ' + (err.message || err));
            }
          }
        });
      });
  }

  async function apply(zip, m, picks, add) {
    const pick = k => picks.has(k);
    if (pick('profile') && (!add || !lsGet('marginalia.name', ''))) lsSet('marginalia.name', m.name || '');
    if (pick('appearance') && m.appearance) lsSet('reader.settings', add ? Object.assign({}, m.appearance, lsGet('reader.settings', {})) : m.appearance);
    if (pick('audio') && m.audio) lsSet('reader.audio', add ? Object.assign({}, m.audio, lsGet('reader.audio', {})) : m.audio);
    if (pick('audio') && m.voiceProxy && (!add || !(() => { try { return localStorage.getItem('marginalia.voiceProxy'); } catch (e) { return ''; } })())) {
      try { localStorage.setItem('marginalia.voiceProxy', m.voiceProxy); } catch (e) { /* ignore */ }
    }
    if (pick('vocabulary') && Array.isArray(m.vocabulary)) {
      const mine = lsGet('reader.vocabulary.v1', []);
      if (!add) lsSet('reader.vocabulary.v1', m.vocabulary);
      else {
        const have = new Set(mine.map(w => String(w.word).toLocaleLowerCase()));
        lsSet('reader.vocabulary.v1', mine.concat(m.vocabulary.filter(w => !have.has(String(w.word).toLocaleLowerCase()))));
      }
    }
    if (pick('library') && m.library) {
      if (!add) lsSet('marginalia.library', m.library);
      else {
        const mine = lsGet('marginalia.library', { pins: {}, cats: {}, custom: [] });
        lsSet('marginalia.library', {
          pins: Object.assign({}, m.library.pins || {}, mine.pins || {}),
          cats: Object.assign({}, m.library.cats || {}, mine.cats || {}),
          custom: [...new Set([...(mine.custom || []), ...(m.library.custom || [])])]
        });
      }
    }
    if (pick('progress')) {
      for (const id of Object.keys(m.progress || {})) {
        const p = m.progress[id] || {};
        const set = (key, val) => {
          if (val == null || val === false) return;
          if (add && lsGet(key, null) != null) return;
          lsSet(key, val);
        };
        set('reader.pos.' + id, p.pos);
        set('reader.speed.position.' + id, p.speed);
        set('reader.audiopos.' + id, p.audio);
        set('reader.autoscroll.' + id, p.auto);
      }
    }
    const mergeList = (key, incoming) => {
      if (!add) { lsSet(key, incoming); return; }
      const mine = lsGet(key, []);
      const have = new Set(mine.map(x => x.k || x.id));
      lsSet(key, mine.concat((incoming || []).filter(x => !have.has(x.k || x.id))));
    };
    if (pick('highlights')) for (const id of Object.keys(m.highlights || {})) mergeList('reader.hl.' + id, m.highlights[id]);
    if (pick('notes')) for (const id of Object.keys(m.notes || {})) mergeList('marginalia.notes.' + id, m.notes[id]);
    if (pick('bookmarks')) for (const id of Object.keys(m.bookmarks || {})) mergeList('marginalia.bookmarks.' + id, m.bookmarks[id]);

    let booksDone = 0;
    if (pick('books')) {
      const temps = (() => { try { return JSON.parse(localStorage.getItem(TEMP_KEY)) || []; } catch (e) { return []; } })();
      for (const meta of m.books || []) {
        if (add && await dbMeta(meta.id)) continue;
        const file = zip.file('books/' + meta.id + '.bin');
        if (!file) continue;
        const rec = Object.assign({}, meta);
        delete rec.hasCover; delete rec.temp;
        if (meta.hasCover) {
          const c = zip.file('covers/' + meta.id + '.bin');
          if (c) { rec.coverBuf = await c.async('arraybuffer'); rec.coverType = meta.coverType || 'image/jpeg'; }
        }
        await dbPutFile(meta.id, await file.async('arraybuffer'));
        await dbPutMeta(rec);
        booksDone++;
        void temps;
      }
    }
    changed();
    return booksDone;
  }

  function done(n) {
    show(`<div class="mlu-head"><h2>Done</h2><button type="button" class="mlu-x" data-close aria-label="Close">×</button></div>
      <p class="mlu-p">${n ? n + (n === 1 ? ' book' : ' books') + ' imported. ' : ''}Reload the app to apply appearance and audio changes.</p>
      <div class="mlu-actions"><button type="button" class="mlu-btn" data-close>Later</button><button type="button" class="mlu-primary" data-reload>Reload now</button></div>`,
      root => {
        root.addEventListener('click', e => {
          if (e.target.closest('[data-reload]')) { location.reload(); return; }
          if (e.target.closest('[data-close]')) close();
        });
      });
  }

  // Entry point at the bottom of the settings sheet.
  function addEntry() {
    const body = $('#settingsBody');
    if (!body || body.querySelector('#mluOpen')) return;
    const entry = document.createElement('div');
    entry.className = 'mlu-entry';
    entry.innerHTML = '<h3>Your data</h3><p>Export a backup of everything on this device, or import one someone shared with you.</p>' +
      '<button type="button" class="mlu-open" id="mluOpen">User settings</button>';
    body.appendChild(entry);
    entry.querySelector('#mluOpen').addEventListener('click', home);
  }

  const css = `
  .mlu-entry{margin-top:18px;padding:16px;border-radius:16px;background:var(--card)}
  .mlu-entry h3{margin:0 0 4px;font-size:15px}
  .mlu-entry p{margin:0 0 12px;color:var(--muted);font-size:13px;line-height:1.45}
  .mlu-open{width:100%;min-height:48px;border-radius:12px;border:0;background:var(--accent);color:#fff;font:inherit;font-weight:600;font-size:16px}
  .mlu-overlay{position:fixed;inset:0;z-index:98;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center}
  .mlu-sheet{width:100%;max-width:560px;max-height:90vh;max-height:90dvh;overflow:auto;background:var(--sheet);color:var(--fg);border-radius:20px 20px 0 0;padding:14px 18px calc(20px + env(safe-area-inset-bottom,0px));box-sizing:border-box;box-shadow:0 -6px 40px rgba(0,0,0,.2)}
  .mlu-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .mlu-head h2{margin:0;font-size:20px}
  .mlu-x{width:44px;height:44px;font-size:26px;line-height:1;color:var(--fg);background:none;border:0}
  .mlu-card{padding:14px 0;border-top:.5px solid var(--line)}
  .mlu-card:first-of-type{border-top:0}
  .mlu-card h3{margin:0 0 6px;font-size:15px}
  .mlu-p{margin:0 0 12px;color:var(--muted);font-size:14px;line-height:1.5}
  .mlu-hint{color:var(--muted);font-size:13px;margin:10px 0 12px}
  .mlu-from{color:var(--muted);font-size:14px;margin:0 0 12px}
  .mlu-lbl{display:block;color:var(--muted);font-size:13px;margin:12px 0 0}
  .mlu-input{display:block;width:100%;height:46px;margin-top:6px;border-radius:12px;border:.5px solid var(--line);background:var(--card);color:var(--fg);font:inherit;font-size:16px;padding:0 12px;box-sizing:border-box}
  .mlu-btn,.mlu-primary{min-height:46px;padding:0 16px;border-radius:12px;border:0;font:inherit;font-weight:600;font-size:15px;background:var(--card);color:var(--fg);width:100%;margin-top:8px}
  .mlu-primary{background:var(--accent);color:#fff}
  .mlu-primary:disabled{opacity:.4}
  .mlu-actions{display:flex;gap:10px;margin-top:16px}
  .mlu-actions button{flex:1;margin-top:0}
  .mlu-seg{display:flex;background:var(--card);border-radius:12px;padding:4px;gap:4px}
  .mlu-seg button{flex:1;min-height:42px;border-radius:9px;border:0;background:none;color:var(--fg);font:inherit;font-weight:600}
  .mlu-seg button.on{background:var(--sheet);box-shadow:0 1px 4px rgba(0,0,0,.15)}
  .mlu-list{display:flex;flex-direction:column;border-top:.5px solid var(--line)}
  .mlu-item{display:flex;align-items:center;gap:14px;min-height:60px;border-bottom:.5px solid var(--line);padding:6px 0}
  .mlu-item input{width:24px;height:24px;flex:none;accent-color:var(--accent)}
  .mlu-item b{display:block;font-size:15px}
  .mlu-item small{display:block;color:var(--muted);font-size:13px;margin-top:2px}
  .mlu-warn{padding:14px;border-radius:14px;background:var(--card);margin-bottom:6px}
  .mlu-warn.danger{background:rgba(255,59,48,.12)}
  .mlu-warn b{font-size:15px}
  .mlu-warn p{margin:6px 0 0;font-size:14px;line-height:1.45}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  addEntry();
  window.__marginaliaUserDataOpen = home;
})();
