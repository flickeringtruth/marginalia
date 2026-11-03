/* Marginalia library: Start-here shelf, book editing (title, author, cover), pins, categories,
   and saving Project Gutenberg books to this device.
   Loaded from index.html as a module. Remove the script tag to turn it off. */
(() => {
  if (window.__marginaliaLibrary) return;
  window.__marginaliaLibrary = true;

  const KEY = 'marginalia.library';
  const SUGGESTIONS = ['Fiction', 'Philosophy', 'Poetry', 'Science', 'History', 'Reference', 'Read later'];
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = msg => {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._mlT); t._mlT = setTimeout(() => t.classList.remove('on'), 2200);
  };
  // The app re-reads the library when this event fires.
  const changed = () => document.dispatchEvent(new CustomEvent('catalog:library-updated'));

  // Pins and categories are keyed by book id, so they survive renames.
  let data = { pins: {}, cats: {}, custom: [] };
  try { data = Object.assign(data, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* ignore */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } };
  const allCats = () => {
    const s = new Set(data.custom);
    Object.values(data.cats).forEach(c => { if (c) s.add(c); });
    return [...s].sort((a, b) => a.localeCompare(b));
  };

  let grid = null, bar = null, shelf = null, filter = 'all', featured = [], token = 0;
  const obs = new MutationObserver(() => renderAll());

  // The reader's own IndexedDB ('books-reader'), with the same stores the app creates.
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
  async function tx(store, mode, run) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = run(t.objectStore(store));
      t.oncomplete = () => { db.close(); resolve(req ? req.result : undefined); };
      t.onerror = () => { db.close(); reject(t.error); };
      t.onabort = () => { db.close(); reject(t.error || new Error('Storage is unavailable.')); };
    });
  }
  const allMeta = () => tx('meta', 'readonly', s => s.getAll()).catch(() => []);
  const getMeta = id => tx('meta', 'readonly', s => s.get(id));
  const putMeta = m => tx('meta', 'readwrite', s => s.put(m));
  const putFile = (id, buf) => tx('files', 'readwrite', s => s.put(buf, id));

  // Makes any picture into a small JPEG so the library stays light.
  async function toJpeg(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const k = Math.min(1, 600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
      return { buf: await blob.arrayBuffer(), type: 'image/jpeg' };
    } finally { URL.revokeObjectURL(url); }
  }

  function ensureUI() {
    grid = document.getElementById('libGrid');
    if (!grid) return false;
    if (document.getElementById('mlBar')) return true;
    bar = document.createElement('div'); bar.id = 'mlBar'; bar.className = 'ml-bar';
    shelf = document.createElement('section'); shelf.id = 'mlShelf'; shelf.className = 'ml-shelf hidden';
    grid.parentNode.insertBefore(shelf, grid);
    grid.parentNode.insertBefore(bar, grid);
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      if (b.dataset.f === '__manage') openCategories();
      else { filter = b.dataset.f; renderAll(); }
    });
    shelf.addEventListener('click', e => {
      const b = e.target.closest('[data-feat]'); if (!b) return;
      const f = featured.find(x => String(x.id) === b.dataset.feat);
      if (f) saveBtn({ id: Number(f.id), title: f.title, authors: f.authors || [], epub: 'https://www.gutenberg.org/ebooks/' + Number(f.id) + '.epub.noimages' }, b);
    });
    grid.addEventListener('click', e => {
      const t = e.target.closest('.ml-tag'); if (!t) return;
      e.preventDefault(); e.stopPropagation();
      openBookEditor(t.closest('.card'));
    }, true);
    return true;
  }

  function addTag(card) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ml-tag';
    b.setAttribute('aria-label', 'Edit book');
    card.appendChild(b);
  }

  // Matches each card to its stored book, and moves any pin or category saved under an old title key.
  async function renderAll() {
    if (!grid && !ensureUI()) return;
    const my = ++token;
    const metas = await allMeta();
    if (my !== token) return;
    const cards = [...grid.querySelectorAll('.card')];
    const titles = new Set();
    cards.forEach(card => {
      const t = ((card.querySelector('.card-title') || {}).textContent || '').trim();
      const a = ((card.querySelector('.card-author') || {}).textContent || '').trim();
      const m = metas.find(x => (x.title || '') === t && ((x.author || (x.type || '').toUpperCase()) === a));
      card.dataset.mlId = m ? m.id : '';
      titles.add(t.toLowerCase());
      if (m) {
        const legacy = t + '|' + a;
        if (data.pins[legacy]) { data.pins[m.id] = true; delete data.pins[legacy]; persist(); }
        if (data.cats[legacy]) { if (!data.cats[m.id]) data.cats[m.id] = data.cats[legacy]; delete data.cats[legacy]; persist(); }
      }
    });
    obs.disconnect();
    try {
      const cats = allCats();
      if (filter.startsWith('cat:') && !cats.includes(filter.slice(4))) filter = 'all';
      cards.forEach(card => {
        const id = card.dataset.mlId;
        if (!card.querySelector('.ml-tag')) addTag(card);
        const pinned = !!(id && data.pins[id]), cat = id ? (data.cats[id] || '') : '';
        card.classList.toggle('ml-pinned', pinned);
        const tag = card.querySelector('.ml-tag');
        tag.classList.toggle('on', pinned);
        const show = filter === 'all' || (filter === 'pinned' && pinned) || (filter.startsWith('cat:') && cat === filter.slice(4));
        card.style.display = show ? '' : 'none';
      });
      cards.sort((a, b) => (data.pins[b.dataset.mlId] ? 1 : 0) - (data.pins[a.dataset.mlId] ? 1 : 0));
      cards.forEach(c => grid.appendChild(c));
      renderBar(cats);
      renderShelf(titles);
    } finally {
      obs.observe(grid, { childList: true });
    }
  }

  function renderBar(cats) {
    const chip = (f, label) => `<button type="button" class="ml-chip${filter === f ? ' on' : ''}" data-f="${esc(f)}">${esc(label)}</button>`;
    bar.innerHTML = chip('all', 'All') + chip('pinned', '★ Pinned') +
      cats.map(c => chip('cat:' + c, c)).join('') + chip('__manage', '⚙ Categories');
  }

  function renderShelf(titles) {
    const items = featured.filter(f => !titles.has(String(f.title).toLowerCase()));
    shelf.classList.toggle('hidden', !items.length || filter !== 'all');
    shelf.innerHTML = items.length
      ? '<h2 class="ml-h">Start here</h2><div class="ml-feat">' + items.map(f =>
          `<div class="ml-fcard"><b>${esc(f.title)}</b><span>${esc((f.authors || []).join(', '))}</span>` +
          `<small>${esc(f.note || '')}</small><div class="ml-fbtns">` +
          `<button type="button" class="ml-dl" data-feat="${Number(f.id)}">Save to device</button>` +
          `<a class="ml-link" href="https://www.gutenberg.org/ebooks/${Number(f.id)}.html.images" target="_blank" rel="noopener">Read on site</a>` +
          '</div></div>').join('') + '</div>'
      : '';
  }

  // Saves a Project Gutenberg EPUB into this device's library.
  async function saveBook(b) {
    const existing = await allMeta();
    if (existing.some(m => m.gid === b.id)) { toast('Already on this device'); return; }
    let res;
    try { res = await fetch(b.epub); }
    catch (e) { throw new Error('The browser blocked the download. Use “Read on site”, or download the EPUB and use Import.'); }
    if (!res.ok) throw new Error('Download failed (HTTP ' + res.status + ').');
    const buf = await res.arrayBuffer();
    const h = new Uint8Array(buf, 0, 2);
    if (h[0] !== 0x50 || h[1] !== 0x4B) throw new Error('That download is not an EPUB file.');
    const id = 'g' + b.id;
    await putFile(id, buf);
    await putMeta({ id, type: 'epub', name: b.title + '.epub', size: buf.byteLength, split: true,
      title: b.title, author: (b.authors || []).join(', '), added: Date.now(), opened: 0, gid: b.id });
    toast('Saved to this device');
    changed();
  }
  window.__marginaliaSaveBook = saveBook;

  async function saveBtn(b, btn) {
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Saving…';
    try { await saveBook(b); btn.textContent = 'Saved ✓'; }
    catch (err) { btn.disabled = false; btn.textContent = label; toast(err.message || 'Could not save this book.'); }
  }

  function newCategoryName() {
    const n = (window.prompt('New category name') || '').trim().slice(0, 30);
    if (!n) return '';
    if (!data.custom.includes(n)) data.custom.push(n);
    persist();
    return n;
  }

  async function openBookEditor(card) {
    const id = card && card.dataset.mlId;
    const m = id ? await getMeta(id).catch(() => null) : null;
    if (!m) { toast('This book can’t be edited right now.'); return; }
    let picked = data.cats[id] || '', newCover = null, removeCover = false;

    const wrap = document.createElement('div');
    wrap.className = 'ml-overlay';
    wrap.innerHTML = `<div class="ml-sheet" role="dialog" aria-modal="true" aria-label="Edit book">
      <div class="ml-head"><h3>Edit book</h3></div>
      <div class="ml-cover-row">
        <div class="ml-cover" id="mlCov"></div>
        <div class="ml-cover-btns">
          <button type="button" id="mlPickCover">Change cover</button>
          <button type="button" id="mlNoCover">Remove cover</button>
        </div>
        <input type="file" id="mlFile" accept="image/*" hidden>
      </div>
      <label class="ml-lbl">Title<input id="mlTitle" class="ml-input" maxlength="200"></label>
      <label class="ml-lbl">Author<input id="mlAuthor" class="ml-input" maxlength="200" placeholder="Unknown"></label>
      <label class="ml-row"><input type="checkbox" id="mlPin"> Pin to top</label>
      <p class="ml-lbl">Category</p>
      <div class="ml-chips" id="mlCats"></div>
      <div class="ml-actions"><button type="button" data-cancel>Cancel</button><button type="button" class="primary" data-save>Save</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const root = wrap.firstElementChild;
    const q = s => root.querySelector(s);
    q('#mlTitle').value = m.title || '';
    q('#mlAuthor').value = m.author || '';
    q('#mlPin').checked = !!data.pins[id];

    const paintCover = () => {
      const cov = q('#mlCov'); cov.innerHTML = '';
      const src = newCover || (m.coverBuf && !removeCover ? { buf: m.coverBuf, type: m.coverType || 'image/jpeg' } : null);
      if (src) {
        const img = new Image(); img.alt = '';
        img.src = URL.createObjectURL(new Blob([src.buf], { type: src.type }));
        cov.appendChild(img);
      } else {
        const s = document.createElement('span');
        s.textContent = (m.title || '?').trim().charAt(0).toUpperCase();
        cov.appendChild(s);
      }
    };
    const paintCats = () => {
      q('#mlCats').innerHTML = `<button type="button" class="ml-chip${!picked ? ' on' : ''}" data-cat="">None</button>` +
        allCats().map(c => `<button type="button" class="ml-chip${picked === c ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('') +
        '<button type="button" class="ml-chip" data-newcat>+ New</button>';
    };
    paintCover(); paintCats();

    const close = () => wrap.remove();
    async function saveEdit() {
      const title = q('#mlTitle').value.trim().slice(0, 200);
      if (!title) { toast('A book needs a title.'); q('#mlTitle').focus(); return; }
      const author = q('#mlAuthor').value.trim().slice(0, 200);
      try {
        const cur = await getMeta(id);
        if (!cur) throw new Error('missing');
        cur.title = title; cur.author = author;
        if (newCover) { cur.coverBuf = newCover.buf; cur.coverType = newCover.type; }
        else if (removeCover) { delete cur.coverBuf; delete cur.coverType; }
        await putMeta(cur);
      } catch (e) { toast('Could not save changes.'); return; }
      if (q('#mlPin').checked) data.pins[id] = true; else delete data.pins[id];
      if (picked) data.cats[id] = picked; else delete data.cats[id];
      persist(); close(); changed();
    }
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('[data-cancel]')) { close(); return; }
      if (e.target.closest('#mlPickCover')) { q('#mlFile').click(); return; }
      if (e.target.closest('#mlNoCover')) { newCover = null; removeCover = true; paintCover(); return; }
      const c = e.target.closest('[data-cat]'); if (c) { picked = c.dataset.cat; paintCats(); return; }
      if (e.target.closest('[data-newcat]')) { const n = newCategoryName(); if (n) { picked = n; paintCats(); } return; }
      if (e.target.closest('[data-save]')) saveEdit();
    });
    q('#mlFile').addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try { newCover = await toJpeg(f); removeCover = false; paintCover(); }
      catch (err) { toast('That picture could not be used.'); }
    });
  }

  function renameCategory(old, next) {
    data.custom = data.custom.map(c => c === old ? next : c);
    if (!data.custom.includes(next)) data.custom.push(next);
    Object.keys(data.cats).forEach(k => { if (data.cats[k] === old) data.cats[k] = next; });
    if (filter === 'cat:' + old) filter = 'cat:' + next;
    persist();
  }
  function deleteCategory(name) {
    data.custom = data.custom.filter(c => c !== name);
    Object.keys(data.cats).forEach(k => { if (data.cats[k] === name) delete data.cats[k]; });
    if (filter === 'cat:' + name) filter = 'all';
    persist();
  }

  function openCategories() {
    const wrap = document.createElement('div');
    wrap.className = 'ml-overlay';
    const draw = () => {
      const cats = allCats();
      wrap.innerHTML = `<div class="ml-sheet" role="dialog" aria-modal="true" aria-label="Categories">
        <div class="ml-head"><h3>Categories</h3></div>` +
        (cats.length ? cats.map(c => `<div class="ml-catrow"><span>${esc(c)}</span>` +
          `<button type="button" data-ren="${esc(c)}">Rename</button>` +
          `<button type="button" class="danger" data-del="${esc(c)}">Delete</button></div>`).join('')
          : '<p class="ml-hint">No categories yet. Add one below, or create one from a book’s Edit screen.</p>') +
        `<button type="button" class="ml-full primary" data-add>+ Add category</button>
         <p class="ml-hint">Deleting a category only removes the label. Books stay in your library.</p>
         <div class="ml-actions"><button type="button" class="primary" data-done>Done</button></div></div>`;
    };
    draw();
    document.body.appendChild(wrap);
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('[data-done]')) { wrap.remove(); renderAll(); return; }
      if (e.target.closest('[data-add]')) { newCategoryName(); draw(); renderAll(); return; }
      const ren = e.target.closest('[data-ren]');
      if (ren) {
        const old = ren.dataset.ren;
        const next = (window.prompt('Rename category', old) || '').trim().slice(0, 30);
        if (!next || next === old) return;
        if (allCats().includes(next)) { toast('That category already exists.'); return; }
        renameCategory(old, next); draw(); renderAll(); return;
      }
      const del = e.target.closest('[data-del]');
      if (del) {
        const name = del.dataset.del;
        if (!window.confirm('Delete “' + name + '”? Books stay in your library.')) return;
        deleteCategory(name); draw(); renderAll();
      }
    });
  }

  const css = `
  .ml-tag{position:absolute;top:0;left:0;width:44px;height:44px;z-index:3;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;color:#fff;background:none;border:0;text-shadow:0 1px 3px rgba(0,0,0,.6)}
  .ml-tag::before{content:"⋯"}
  .ml-tag.on::before{content:"★"}
  .ml-tag.on{color:#ffd60a}
  .card.ml-pinned .cover-btn{box-shadow:0 0 0 2px #ffd60a,0 8px 22px rgba(0,0,0,.14)}
  .ml-bar{display:flex;gap:8px;overflow-x:auto;max-width:1100px;margin:0 auto 18px;padding:2px 0 6px;scrollbar-width:none}
  .ml-bar::-webkit-scrollbar{display:none}
  .ml-chip{flex:none;min-height:40px;padding:0 14px;border-radius:20px;background:var(--card);color:var(--fg);font:inherit;font-size:14px;font-weight:500;border:0}
  .ml-chip.on{background:var(--accent);color:#fff}
  .ml-shelf{max-width:1100px;margin:0 auto 26px}
  .ml-shelf.hidden{display:none}
  .ml-h{font-size:20px;margin:0 0 10px;font-weight:700;color:var(--fg)}
  .ml-feat{display:flex;gap:12px;overflow-x:auto;padding-bottom:6px}
  .ml-fcard{flex:0 0 250px;display:flex;flex-direction:column;gap:4px;padding:14px;border-radius:14px;background:var(--card);color:var(--fg)}
  .ml-fcard b{font-family:"Iowan Old Style",Georgia,serif;font-size:17px}
  .ml-fcard span,.ml-fcard small{color:var(--muted);font-size:13px}
  .ml-fbtns{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .ml-dl,.ml-link{min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border-radius:22px;text-decoration:none;font:inherit;font-weight:600;font-size:14px;border:0}
  .ml-dl{background:var(--accent);color:#fff}
  .ml-link{background:var(--card);color:var(--fg)}
  .ml-overlay{position:fixed;inset:0;z-index:96;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center}
  .ml-sheet{width:100%;max-width:520px;max-height:88vh;max-height:88dvh;overflow:auto;background:var(--sheet);color:var(--fg);border-radius:18px 18px 0 0;padding:16px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -6px 40px rgba(0,0,0,.2);box-sizing:border-box}
  .ml-head h3{margin:0 0 10px;font-size:18px}
  .ml-row{display:flex;align-items:center;gap:10px;min-height:44px;font-size:15px;margin-top:10px}
  .ml-row input{width:22px;height:22px}
  .ml-lbl{display:block;color:var(--muted);font-size:13px;margin:14px 0 0}
  .ml-input{display:block;width:100%;height:46px;margin-top:6px;border-radius:12px;border:.5px solid var(--line);background:var(--card);color:var(--fg);font:inherit;font-size:16px;padding:0 12px;box-sizing:border-box}
  .ml-hint{color:var(--muted);font-size:13px;margin:10px 0}
  .ml-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .ml-cover-row{display:flex;gap:14px;align-items:center}
  .ml-cover{width:84px;height:126px;flex:none;border-radius:6px;background:var(--card);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:600;color:var(--muted)}
  .ml-cover img{width:100%;height:100%;object-fit:cover;display:block}
  .ml-cover-btns{display:flex;flex-direction:column;gap:8px;flex:1;min-width:0}
  .ml-overlay button,.ml-sheet button{min-height:44px;padding:0 14px;border-radius:12px;background:var(--card);color:var(--fg);font:inherit;font-weight:600;font-size:15px;border:0}
  .ml-overlay button.primary{background:var(--accent);color:#fff}
  .ml-overlay button.danger{color:#ff3b30}
  .ml-actions{display:flex;gap:10px;margin-top:18px}
  .ml-actions button{flex:1}
  .ml-full{width:100%;margin-top:12px}
  .ml-catrow{display:flex;align-items:center;gap:8px;min-height:50px;border-top:.5px solid var(--line)}
  .ml-catrow span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ml-catrow button{min-height:40px;padding:0 12px;font-size:14px}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  if (ensureUI()) {
    renderAll();
    fetch('featured.json', { cache: 'no-cache' })
      .then(r => r.json())
      .then(j => { featured = Array.isArray(j.featured) ? j.featured : []; renderAll(); })
      .catch(() => renderAll());
  }
})();
