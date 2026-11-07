/* Marginalia read on site: "Read on site" opens a Project Gutenberg book inside the reader.
   The book is kept only while you read it and is removed when you leave the reader.
   Gutenberg blocks direct downloads from web pages (this is what fails on iPhone Safari), so the EPUB is
   fetched through your Cloudflare Worker's /book route (the same Worker address used for Edge voices).
   Loaded from index.html as a module. Remove the script tag to restore the old link. */
(() => {
  if (window.__marginaliaReadOnSite) return;
  window.__marginaliaReadOnSite = true;

  const $ = s => document.querySelector(s);
  const toast = msg => {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._mlT); t._mlT = setTimeout(() => t.classList.remove('on'), 4200);
  };
  const changed = () => document.dispatchEvent(new CustomEvent('catalog:library-updated'));
  const TEMP_KEY = 'marginalia.tempBooks';
  const temps = () => { try { return JSON.parse(localStorage.getItem(TEMP_KEY)) || []; } catch (e) { return []; } };
  const setTemps = l => { try { localStorage.setItem(TEMP_KEY, JSON.stringify(l)); } catch (e) { /* ignore */ } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const proxyBase = () => {
    try { return (localStorage.getItem('marginalia.voiceProxy') || '').trim().replace(/\/+$/, ''); } catch (e) { return ''; }
  };

  // Temporary copies stay out of the library list.
  const style = document.createElement('style');
  style.textContent = '#libGrid .card[data-ml-id^="site-"]{display:none!important}';
  document.head.appendChild(style);

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

  async function removeTemps() {
    const ids = temps();
    if (!ids.length) return;
    for (const id of ids) {
      await tx('meta', 'readwrite', s => s.delete(id)).catch(() => {});
      await tx('files', 'readwrite', s => s.delete(id)).catch(() => {});
      ['reader.pos.', 'reader.hl.', 'reader.speed.position.', 'reader.audiopos.', 'reader.autoscroll.'].forEach(p => {
        try { localStorage.removeItem(p + id); } catch (e) { /* ignore */ }
      });
      try { localStorage.removeItem('marginalia.notes.' + id); localStorage.removeItem('marginalia.bookmarks.' + id); } catch (e) { /* ignore */ }
    }
    try {
      const last = JSON.parse(localStorage.getItem('reader.last'));
      if (last && ids.includes(last)) { localStorage.removeItem('reader.last'); localStorage.setItem('reader.wasOpen', 'false'); }
    } catch (e) { /* ignore */ }
    setTemps([]);
    changed();
  }

  // Leaving the reader removes the temporary copy. A reload also clears leftovers.
  setInterval(() => {
    const reader = document.getElementById('reader');
    if (temps().length && reader && reader.classList.contains('hidden')) removeTemps();
  }, 1200);
  removeTemps();

  function closeCatalog() {
    const c = document.querySelector('#catalogSheet [data-close]');
    if (c) c.click();
  }

  // Waits for the library card to appear, then clicks it. That is how the app opens a book.
  async function openCard(id) {
    // v2 library has no old grid cards to click, so it opens the book directly.
    let v2 = false; try { v2 = localStorage.getItem('marginalia.ui') === 'v2'; } catch (e) { /* ignore */ }
    if (v2 && window.__reader && window.__reader.openBook) { await window.__reader.openBook(id); return true; }
    const t0 = Date.now();
    while (Date.now() - t0 < 4000) {
      const cover = document.querySelector('#libGrid .card[data-ml-id="' + id + '"] .cover-btn');
      if (cover) { cover.click(); return true; }
      await sleep(120);
    }
    return false;
  }

  const isZip = buf => {
    if (!buf || buf.byteLength < 4) return false;
    const h = new Uint8Array(buf, 0, 2);
    return h[0] === 0x50 && h[1] === 0x4B;
  };

  // Downloads the EPUB through the Worker's /book route. A direct download is tried second,
  // because Gutenberg usually blocks it in the browser.
  async function downloadEpub(b) {
    const base = proxyBase();
    const urls = [];
    if (base) urls.push(base + '/book?id=' + b.id);
    urls.push(b.epub);
    let status = 0, sawNonEpub = false;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) { status = res.status; continue; }
        const buf = await res.arrayBuffer();
        if (isZip(buf)) return buf;
        sawNonEpub = true;
      } catch (e) { /* blocked by the browser: try the next address */ }
    }
    if (!base) {
      throw new Error('Read on site needs your Cloudflare Worker address (the one used for Edge voices) saved in Settings. Add it, then try again.');
    }
    if (sawNonEpub || status === 404) {
      throw new Error('Your Cloudflare Worker is out of date. Redeploy it from the latest code, then try again.');
    }
    throw new Error('Could not download this book' + (status ? ' (HTTP ' + status + ')' : '') + '. Check your connection and try again.');
  }

  async function readOnSite(b) {
    const saved = (await allMeta()).find(m => m.gid === b.id && !m.temp);
    const id = saved ? saved.id : 'site-' + b.id;
    if (!saved) {
      toast('Opening book…');
      const buf = await downloadEpub(b);
      await tx('files', 'readwrite', s => s.put(buf, id));
      await tx('meta', 'readwrite', s => s.put({
        id, type: 'epub', name: b.title + '.epub', size: buf.byteLength, split: true,
        title: b.title, author: (b.authors || []).join(', '), added: Date.now(), opened: 0, gid: b.id, temp: true
      }));
      setTemps(Array.from(new Set([...temps(), id])));
      changed();
      await sleep(150);
    }
    closeCatalog();
    if (!(await openCard(id))) toast('Open the book from your library.');
  }
  window.__marginaliaReadOnSite = readOnSite;

  // Capture phase: runs before the link's own navigation, so the Gutenberg page never opens.
  document.addEventListener('click', e => {
    const a = e.target && e.target.closest && e.target.closest('a[href*="gutenberg.org/ebooks/"]');
    if (!a) return;
    const m = a.getAttribute('href').match(/\/ebooks\/(\d+)\.html/);
    if (!m) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const card = a.closest('.catalog-book, .ml-fcard');
    const t = card && card.querySelector('b');
    const s = card && card.querySelector('span');
    const title = t ? t.textContent.trim() : 'Gutenberg book';
    const author = s ? s.textContent.trim() : '';
    readOnSite({
      id: Number(m[1]), title, authors: author ? [author] : [],
      epub: 'https://www.gutenberg.org/ebooks/' + m[1] + '.epub.noimages'
    }).catch(err => toast(err.message || 'Could not open this book.'));
  }, true);
})();
