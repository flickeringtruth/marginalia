/* Marginalia reader tools: bookmarks and highlight export.
   Loaded from index.html as a module. Remove the script tag to turn it off.
   Reading progress already exists in the app (saved per book and shown on library cards). */
(() => {
  if (window.__marginaliaReaderTools) return;
  window.__marginaliaReaderTools = true;

  const R = () => window.__reader;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bmKey = id => 'marginalia.bookmarks.' + id;
  const loadBm = id => { try { return JSON.parse(localStorage.getItem(bmKey(id))) || []; } catch (e) { return []; } };
  const saveBm = (id, list) => { try { localStorage.setItem(bmKey(id), JSON.stringify(list)); } catch (e) { /* ignore */ } };
  const toast = msg => {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._mlT); t._mlT = setTimeout(() => t.classList.remove('on'), 1800);
  };

  function here() {
    const r = R(), app = r && r.App;
    if (!app || !app.book || app.screen !== 'reader' || !app.r) return null;
    let loc; try { loc = app.r.getLoc(); } catch (e) { return null; }
    return { app, book: app.book, ch: loc.ch, off: loc.off == null ? -1 : loc.off };
  }
  // A bookmark counts as "here" when it is in the same chapter and close to this position.
  const near = (list, p) => list.find(b => b.ch === p.ch && (p.off < 0 || b.off < 0 || Math.abs(b.off - p.off) < 300)) || null;

  async function snippetAt(book, ch, off) {
    if (book.type === 'pdf') return 'Page ' + (ch + 1);
    try {
      const d = await book.getChapter(ch);
      const t = (d.textContent || '').slice(Math.max(0, off), Math.max(0, off) + 70).replace(/\s+/g, ' ').trim();
      return t ? t + '…' : (book.chapters[ch] ? book.chapters[ch].title : '');
    } catch (e) { return ''; }
  }

  function markButton() {
    const b = $('#mlBookmarkBtn'); if (!b) return;
    const p = here();
    const on = !!(p && near(loadBm(p.book.id), p));
    b.classList.toggle('on', on);
  }

  function renderList(id) {
    const book = R().App.book;
    const list = loadBm(id).sort((a, b) => a.ch - b.ch || a.off - b.off);
    $('#mlBmList').innerHTML = list.length
      ? list.map(b => `<div class="ml-bm-row"><button type="button" class="ml-bm-go" data-go="${esc(b.k)}">` +
          `<b>${esc(book.chapters[b.ch] ? book.chapters[b.ch].title : 'Chapter ' + (b.ch + 1))}</b>` +
          `<span>${esc(b.label || '')}</span><small>${new Date(b.t).toLocaleDateString()}</small></button>` +
          `<button type="button" class="ml-bm-rm" data-rm="${esc(b.k)}" aria-label="Remove bookmark">×</button></div>`).join('')
      : '<p class="ml-bm-hint">No bookmarks yet. Tap “Bookmark this place” while reading.</p>';
  }

  function openPanel() {
    const p = here(); if (!p) return;
    renderList(p.book.id);
    $('#mlBmHint').textContent = '';
    $('#mlBm').classList.remove('hidden');
  }
  const closePanel = () => $('#mlBm').classList.add('hidden');

  async function addHere() {
    const p = here(); if (!p) return;
    const list = loadBm(p.book.id);
    if (near(list, p)) { $('#mlBmHint').textContent = 'This place is already bookmarked.'; return; }
    const label = await snippetAt(p.book, p.ch, p.off);
    list.push({ k: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ch: p.ch, off: p.off, label, t: Date.now() });
    saveBm(p.book.id, list);
    renderList(p.book.id); markButton(); toast('Bookmark added');
  }

  function removeBm(k) {
    const p = here(); if (!p) return;
    saveBm(p.book.id, loadBm(p.book.id).filter(b => b.k !== k));
    renderList(p.book.id); markButton();
  }

  function jump(k) {
    const p = here(); if (!p) return;
    const b = loadBm(p.book.id).find(x => x.k === k); if (!b) return;
    closePanel();
    p.app.goTo({ ch: b.ch, off: b.off, frac: 0 });
  }

  function exportHighlights() {
    const r = R(), book = r && r.App.book; if (!book) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem('reader.hl.' + book.id)) || []; } catch (e) { /* ignore */ }
    if (!list.length) { $('#mlBmHint').textContent = 'No highlights in this book yet.'; return; }
    const sorted = list.slice().sort((a, b) => a.ch - b.ch || a.start - b.start);
    const lines = ['# ' + book.meta.title, ''];
    if (book.meta.author) lines.push('*' + book.meta.author + '*', '');
    lines.push('Highlights exported from Marginalia on ' + new Date().toLocaleDateString(), '');
    let lastCh = -1;
    for (const h of sorted) {
      if (h.ch !== lastCh) {
        lines.push('## ' + (book.chapters[h.ch] ? book.chapters[h.ch].title : 'Section ' + (h.ch + 1)), '');
        lastCh = h.ch;
      }
      lines.push('> ' + String(h.text || '').replace(/\s*\n\s*/g, ' '), '', '_' + h.color + ' highlight_', '');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (book.meta.title || 'book').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 60) + ' - highlights.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    $('#mlBmHint').textContent = 'Exported ' + sorted.length + (sorted.length === 1 ? ' highlight.' : ' highlights.');
  }

  function build() {
    const more = $('#moreBtn');
    if (!more || $('#mlBookmarkBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'mlBookmarkBtn'; btn.type = 'button'; btn.className = 'icon-btn';
    btn.setAttribute('aria-label', 'Bookmarks'); btn.title = 'Bookmarks';
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
    more.parentNode.insertBefore(btn, more);
    btn.addEventListener('click', e => { e.stopPropagation(); openPanel(); });

    const panel = document.createElement('div');
    panel.id = 'mlBm'; panel.className = 'hidden';
    panel.innerHTML = `<div class="ml-bm-scrim" data-x></div>
      <div class="ml-bm-sheet" role="dialog" aria-label="Bookmarks">
        <div class="ml-bm-head"><h2>Bookmarks</h2><button type="button" class="ml-bm-x" data-x aria-label="Close">×</button></div>
        <button type="button" class="ml-bm-add" id="mlBmAdd">Bookmark this place</button>
        <div id="mlBmList"></div>
        <button type="button" class="ml-bm-exp" id="mlBmExport">Export highlights as Markdown</button>
        <p class="ml-bm-hint" id="mlBmHint"></p>
      </div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', e => {
      if (e.target.closest('[data-x]')) { closePanel(); return; }
      if (e.target.closest('#mlBmAdd')) { addHere(); return; }
      if (e.target.closest('#mlBmExport')) { exportHighlights(); return; }
      const rm = e.target.closest('[data-rm]'); if (rm) { removeBm(rm.dataset.rm); return; }
      const go = e.target.closest('[data-go]'); if (go) jump(go.dataset.go);
    });

    const css = `
    #mlBm{position:fixed;inset:0;z-index:60}
    .ml-bm-scrim{position:absolute;inset:0;background:rgba(0,0,0,.35)}
    .ml-bm-sheet{position:absolute;left:0;right:0;bottom:0;max-height:82vh;max-height:82dvh;overflow:auto;margin:0 auto;max-width:560px;background:var(--sheet);color:var(--fg);border-radius:16px 16px 0 0;padding:14px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -6px 40px rgba(0,0,0,.2)}
    .ml-bm-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
    .ml-bm-head h2{margin:0;font-size:18px}
    .ml-bm-x{width:44px;height:44px;font-size:24px;color:var(--fg);background:none;border:0}
    .ml-bm-add,.ml-bm-exp{width:100%;min-height:46px;border-radius:12px;border:0;font:inherit;font-weight:600;margin:8px 0;background:var(--accent);color:#fff}
    .ml-bm-exp{background:var(--card);color:var(--fg)}
    .ml-bm-row{display:flex;align-items:stretch;border-top:.5px solid var(--line)}
    .ml-bm-go{flex:1;min-width:0;text-align:left;padding:10px 4px;background:none;border:0;color:var(--fg);font:inherit}
    .ml-bm-go b,.ml-bm-go span,.ml-bm-go small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ml-bm-go span{color:var(--muted);font-size:13px;margin-top:2px}
    .ml-bm-go small{color:var(--muted);font-size:11px;margin-top:2px}
    .ml-bm-rm{width:44px;min-height:44px;background:none;border:0;color:var(--muted);font-size:22px}
    .ml-bm-hint{color:var(--muted);font-size:13px;margin:8px 0}
    #mlBookmarkBtn.on{color:#ffd60a}`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    setInterval(markButton, 700);
    markButton();
  }

  build();
})();
