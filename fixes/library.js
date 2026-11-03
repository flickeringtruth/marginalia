/* Marginalia library: Start-here shelf, pinned books and custom categories.
   Loaded from index.html as a module. Remove the script tag to turn it off. */
(() => {
  if (window.__marginaliaLibrary) return;
  window.__marginaliaLibrary = true;

  const KEY = 'marginalia.library';
  const SUGGESTIONS = ['Fiction', 'Philosophy', 'Poetry', 'Science', 'History', 'Reference', 'Read later'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let data = { pins: {}, cats: {}, custom: [] };
  try { data = Object.assign(data, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* ignore */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } };

  let filter = 'all', featured = [], grid = null, shelf = null, bar = null;
  const obs = new MutationObserver(() => renderAll());

  // Books have no id in the DOM, so pins and categories are keyed by title + author.
  const keyOf = card => {
    const t = card.querySelector('.card-title'), a = card.querySelector('.card-author');
    return (t ? t.textContent.trim() : '') + '|' + (a ? a.textContent.trim() : '');
  };
  const titleOf = key => key.split('|')[0];
  const allCats = () => {
    const set = new Set(data.custom);
    Object.values(data.cats).forEach(c => { if (c) set.add(c); });
    return [...set].sort((a, b) => a.localeCompare(b));
  };

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
      if (b.dataset.f === '__new') { newCategory(); return; }
      filter = b.dataset.f; renderAll();
    });
    grid.addEventListener('click', e => {
      const t = e.target.closest('.ml-tag'); if (!t) return;
      e.stopPropagation(); e.preventDefault();
      openEditor(t.closest('.card').dataset.mlKey);
    }, true);
    return true;
  }

  function addTag(card) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ml-tag'; b.textContent = '⋯';
    b.setAttribute('aria-label', 'Pin or categorize this book');
    card.appendChild(b);
  }

  function renderAll() {
    if (!grid && !ensureUI()) return;
    obs.disconnect();
    try {
      const cats = allCats();
      if (filter.startsWith('cat:') && !cats.includes(filter.slice(4))) filter = 'all';
      const cards = [...grid.querySelectorAll('.card')];
      cards.forEach(card => {
        const key = keyOf(card); card.dataset.mlKey = key;
        if (!card.querySelector('.ml-tag')) addTag(card);
        const pinned = !!data.pins[key], cat = data.cats[key] || '';
        card.classList.toggle('ml-pinned', pinned);
        const tag = card.querySelector('.ml-tag');
        tag.textContent = pinned ? '★' : '⋯';
        tag.classList.toggle('on', pinned || !!cat);
        const show = filter === 'all' || (filter === 'pinned' && pinned) || (filter.startsWith('cat:') && cat === filter.slice(4));
        card.style.display = show ? '' : 'none';
      });
      // Pinned books first; the sort is stable, so everything else keeps its order.
      cards.sort((a, b) => (data.pins[b.dataset.mlKey] ? 1 : 0) - (data.pins[a.dataset.mlKey] ? 1 : 0));
      cards.forEach(c => grid.appendChild(c));
      renderBar(cats); renderShelf(cards);
    } finally {
      obs.observe(grid, { childList: true });
    }
  }

  function renderBar(cats) {
    const chip = (f, label) => `<button type="button" class="ml-chip${filter === f ? ' on' : ''}" data-f="${esc(f)}">${esc(label)}</button>`;
    bar.innerHTML = chip('all', 'All') + chip('pinned', '★ Pinned') +
      cats.map(c => chip('cat:' + c, c)).join('') +
      '<button type="button" class="ml-chip" data-f="__new">+ Category</button>';
  }

  function renderShelf(cards) {
    const have = new Set(cards.map(c => titleOf(keyOf(c)).toLowerCase()));
    const items = featured.filter(f => !have.has(String(f.title).toLowerCase()));
    shelf.classList.toggle('hidden', !items.length || filter !== 'all');
    shelf.innerHTML = items.length
      ? '<h2 class="ml-h">Start here</h2><div class="ml-feat">' + items.map(f =>
          `<div class="ml-fcard"><b>${esc(f.title)}</b><span>${esc((f.authors || []).join(', '))}</span><small>${esc(f.note || '')}</small>` +
          `<a class="ml-dl" href="https://www.gutenberg.org/ebooks/${Number(f.id)}.epub.noimages" target="_blank" rel="noopener">Download EPUB</a>` +
          '<em>Then tap Import above</em></div>').join('') + '</div>'
      : '';
  }

  function openEditor(key) {
    const cur = data.cats[key] || '';
    const wrap = document.createElement('div');
    wrap.className = 'ml-overlay';
    const sugg = [...new Set([...allCats(), ...SUGGESTIONS])];
    wrap.innerHTML = `<div class="ml-sheet" role="dialog" aria-label="Organize book">
      <h3>${esc(titleOf(key))}</h3>
      <label class="ml-row"><input type="checkbox" id="mlPin"${data.pins[key] ? ' checked' : ''}> Pin to top</label>
      <p class="ml-hint">Category</p>
      <div class="ml-chips" id="mlSug">${sugg.map(s => `<button type="button" class="ml-chip${s === cur ? ' on' : ''}" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <input id="mlCat" class="ml-input" type="text" maxlength="30" placeholder="Or type a new category" autocomplete="off" value="${esc(cur)}">
      <div class="ml-actions"><button type="button" id="mlCancel">Cancel</button><button type="button" id="mlSave" class="primary">Save</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const input = wrap.querySelector('#mlCat');
    wrap.querySelector('#mlSug').addEventListener('click', e => {
      const b = e.target.closest('[data-s]'); if (b) input.value = b.dataset.s;
    });
    const close = () => wrap.remove();
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    wrap.querySelector('#mlCancel').addEventListener('click', close);
    wrap.querySelector('#mlSave').addEventListener('click', () => {
      const name = input.value.trim().slice(0, 30);
      if (wrap.querySelector('#mlPin').checked) data.pins[key] = true; else delete data.pins[key];
      if (name) {
        data.cats[key] = name;
        if (!SUGGESTIONS.includes(name) && !data.custom.includes(name)) data.custom.push(name);
      } else delete data.cats[key];
      persist(); close(); renderAll();
    });
    setTimeout(() => input.focus(), 50);
  }

  function newCategory() {
    const name = (window.prompt('Name for the new category') || '').trim().slice(0, 30);
    if (!name) return;
    if (!data.custom.includes(name) && !SUGGESTIONS.includes(name)) data.custom.push(name);
    persist();
    filter = 'cat:' + name;
    renderAll();
  }

  const css = `
  .ml-tag{position:absolute;top:0;left:0;width:44px;height:44px;z-index:3;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;background:none;border:0;text-shadow:0 1px 3px rgba(0,0,0,.6)}
  .ml-tag.on{color:#ffd60a}
  .card.ml-pinned .cover-btn{box-shadow:0 0 0 2px #ffd60a,0 8px 22px rgba(0,0,0,.14)}
  .ml-bar{display:flex;gap:8px;overflow-x:auto;max-width:1100px;margin:0 auto 18px;padding:2px 0 6px;scrollbar-width:none}
  .ml-bar::-webkit-scrollbar{display:none}
  .ml-chip{flex:none;min-height:40px;padding:0 14px;border-radius:20px;background:var(--card);color:var(--fg);font:inherit;font-size:14px;font-weight:500;border:0}
  .ml-chip.on{background:var(--accent);color:#fff}
  .ml-shelf{max-width:1100px;margin:0 auto 26px}
  .ml-h{font-size:20px;margin:0 0 10px;font-weight:700;color:var(--fg)}
  .ml-feat{display:flex;gap:12px;overflow-x:auto;padding-bottom:6px}
  .ml-fcard{flex:0 0 240px;display:flex;flex-direction:column;gap:4px;padding:14px;border-radius:14px;background:var(--card);color:var(--fg)}
  .ml-fcard b{font-family:"Iowan Old Style",Georgia,serif;font-size:17px}
  .ml-fcard span,.ml-fcard small,.ml-fcard em{color:var(--muted);font-size:13px;font-style:normal}
  .ml-dl{margin-top:8px;align-self:flex-start;min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border-radius:22px;background:var(--accent);color:#fff;text-decoration:none;font-weight:600;font-size:14px}
  .ml-overlay{position:fixed;inset:0;z-index:96;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;justify-content:center}
  .ml-sheet{width:100%;max-width:520px;background:var(--sheet);color:var(--fg);border-radius:18px 18px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -6px 40px rgba(0,0,0,.2)}
  .ml-sheet h3{margin:0 0 12px;font-size:18px}
  .ml-row{display:flex;align-items:center;gap:10px;min-height:44px;font-size:15px}
  .ml-row input{width:22px;height:22px}
  .ml-hint{color:var(--muted);font-size:13px;margin:12px 0 6px}
  .ml-sheet .ml-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
  .ml-input{width:100%;height:46px;border-radius:12px;border:.5px solid var(--line);background:var(--card);color:var(--fg);font:inherit;font-size:16px;padding:0 12px;box-sizing:border-box}
  .ml-actions{display:flex;gap:10px;margin-top:14px}
  .ml-actions button{flex:1;min-height:46px;border-radius:12px;background:var(--card);color:var(--fg);font:inherit;font-weight:600;border:0}
  .ml-actions .primary{background:var(--accent);color:#fff}`;

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
