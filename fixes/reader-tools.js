/* Marginalia reader tools: bookmarks with titles and notes, notes on highlights and words, export.
   Loaded from index.html as a module. Remove the script tag to turn it off.
   To add a note: select text or a single word, then tap Note in the selection menu. */
(() => {
  if (window.__marginaliaReaderTools) return;
  window.__marginaliaReaderTools = true;

  const R = () => window.__reader;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = msg => {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._mlT); t._mlT = setTimeout(() => t.classList.remove('on'), 1800);
  };
  const bmKey = id => 'marginalia.bookmarks.' + id;
  const loadBm = id => { try { return JSON.parse(localStorage.getItem(bmKey(id))) || []; } catch (e) { return []; } };
  const saveBm = (id, list) => { try { localStorage.setItem(bmKey(id), JSON.stringify(list)); } catch (e) { /* ignore */ } };
  const newKey = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const chapterName = (book, ch) => (book.chapters[ch] ? book.chapters[ch].title : 'Section ' + (ch + 1));
  const byPlace = (a, b) => a.ch - b.ch || (a.off ?? a.start ?? 0) - (b.off ?? b.start ?? 0);

  function here() {
    const r = R(), app = r && r.App;
    if (!app || !app.book || app.screen !== 'reader' || !app.r) return null;
    let loc; try { loc = app.r.getLoc(); } catch (e) { return null; }
    return { app, book: app.book, ch: loc.ch, off: loc.off == null ? -1 : loc.off };
  }
  // A bookmark counts as "this place" when it is in the same chapter and close by.
  const near = (list, p) => list.find(b => b.ch === p.ch && (p.off < 0 || b.off < 0 || Math.abs(b.off - p.off) < 300)) || null;

  async function snippetAt(book, ch, off) {
    if (book.type === 'pdf') return 'Page ' + (ch + 1);
    try {
      const d = await book.getChapter(ch);
      const t = (d.textContent || '').slice(Math.max(0, off), Math.max(0, off) + 70).replace(/\s+/g, ' ').trim();
      return t ? t + '…' : chapterName(book, ch);
    } catch (e) { return chapterName(book, ch); }
  }

  function markButton() {
    const b = $('#mlBookmarkBtn'); if (!b) return;
    const p = here();
    b.classList.toggle('on', !!(p && near(loadBm(p.book.id), p)));
  }

  // ---- small sheet helper for editors ----
  function overlay(html, bind) {
    const wrap = document.createElement('div');
    wrap.className = 'ml-overlay ml-over2';
    wrap.innerHTML = `<div class="ml-sheet" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    bind(wrap.firstElementChild, close);
    return close;
  }

  // ---- panel ----
  function renderPanel() {
    const p = here(); if (!p) return;
    const book = p.book, bms = loadBm(book.id).sort(byPlace);
    $('#mlBms').innerHTML = bms.length
      ? bms.map(b => `<div class="ml-row2"><button type="button" class="ml-go" data-bm-go="${esc(b.k)}">` +
          `<b>${esc(b.title || chapterName(book, b.ch))}</b>` +
          `<span>${esc(b.title ? chapterName(book, b.ch) + ' · ' : '')}${esc(b.label || '')}</span>` +
          (b.note ? `<small>${esc(b.note)}</small>` : '') + '</button>' +
          `<button type="button" class="ml-ic" data-bm-edit="${esc(b.k)}" aria-label="Edit bookmark">✎</button>` +
          `<button type="button" class="ml-ic" data-bm-rm="${esc(b.k)}" aria-label="Remove bookmark">×</button></div>`).join('')
      : '<p class="ml-hint">No bookmarks yet. Tap “Bookmark this place” while reading.</p>';

    const hls = (R().HL.list || []).slice().sort(byPlace);
    $('#mlNotes').innerHTML = hls.length
      ? hls.map(h => `<div class="ml-row2"><button type="button" class="ml-go" data-hl-go="${esc(h.id)}">` +
          `<b>${esc(chapterName(book, h.ch))}</b><span>“${esc(h.text)}”</span>` +
          (h.note ? `<small>${esc(h.note)}</small>` : '<small class="ml-faint">No note yet</small>') + '</button>' +
          `<button type="button" class="ml-ic" data-hl-edit="${esc(h.id)}" aria-label="Edit note">✎</button></div>`).join('')
      : '<p class="ml-hint">Select text or a single word in the book, then tap Note.</p>';
  }

  function openPanel() {
    if (!here()) return;
    renderPanel();
    $('#mlPanel').classList.remove('hidden');
  }
  const closePanel = () => $('#mlPanel').classList.add('hidden');

  async function addHere() {
    const p = here(); if (!p) return;
    const list = loadBm(p.book.id);
    if (near(list, p)) { toast('This place is already bookmarked.'); return; }
    const label = await snippetAt(p.book, p.ch, p.off);
    list.push({ k: newKey(), ch: p.ch, off: p.off, title: '', note: '', label, t: Date.now() });
    saveBm(p.book.id, list);
    markButton(); renderPanel(); toast('Bookmarked');
  }

  function jumpBookmark(k) {
    const p = here(); if (!p) return;
    const b = loadBm(p.book.id).find(x => x.k === k); if (!b) return;
    closePanel();
    p.app.goTo({ ch: b.ch, off: b.off, frac: 0 });
  }
  function jumpHighlight(id) {
    const p = here(), h = R().HL.get(id); if (!p || !h) return;
    closePanel();
    p.app.goTo({ ch: h.ch, off: h.start, frac: 0 });
  }

  function editBookmark(k) {
    const p = here(); if (!p) return;
    const b = loadBm(p.book.id).find(x => x.k === k); if (!b) return;
    overlay(`<div class="ml-head"><h3>Edit bookmark</h3></div>
      <label class="ml-lbl">Title<input id="mlT" class="ml-input" maxlength="120" placeholder="${esc(chapterName(p.book, b.ch))}" value="${esc(b.title || '')}"></label>
      <label class="ml-lbl">Note<textarea id="mlN" class="ml-area" rows="4" maxlength="2000" placeholder="Write a note…">${esc(b.note || '')}</textarea></label>
      <div class="ml-actions"><button type="button" class="danger" data-del>Delete</button><button type="button" data-cancel>Cancel</button><button type="button" class="primary" data-save>Save</button></div>`,
      (root, close) => {
        root.addEventListener('click', e => {
          if (e.target.closest('[data-cancel]')) { close(); return; }
          if (e.target.closest('[data-del]')) {
            saveBm(p.book.id, loadBm(p.book.id).filter(x => x.k !== k));
            close(); markButton(); renderPanel(); return;
          }
          if (e.target.closest('[data-save]')) {
            const list = loadBm(p.book.id), x = list.find(y => y.k === k);
            if (x) { x.title = root.querySelector('#mlT').value.trim(); x.note = root.querySelector('#mlN').value.trim(); saveBm(p.book.id, list); }
            close(); renderPanel(); toast('Saved');
          }
        });
      });
  }

  function editNote(id) {
    const HL = R().HL, h = HL.get(id); if (!h) return;
    overlay(`<div class="ml-head"><h3>Note</h3></div>
      <blockquote class="ml-quote">${esc(h.text)}</blockquote>
      <label class="ml-lbl">Your note<textarea id="mlN" class="ml-area" rows="5" maxlength="2000" placeholder="Write your thoughts…">${esc(h.note || '')}</textarea></label>
      <div class="ml-actions"><button type="button" class="danger" data-remove>Remove highlight</button><button type="button" data-cancel>Cancel</button><button type="button" class="primary" data-save>Save note</button></div>`,
      (root, close) => {
        root.addEventListener('click', e => {
          if (e.target.closest('[data-cancel]')) { close(); return; }
          if (e.target.closest('[data-remove]')) {
            if (!window.confirm('Remove this highlight and its note?')) return;
            HL.remove(id); close(); renderPanel(); toast('Highlight removed'); return;
          }
          if (e.target.closest('[data-save]')) {
            const v = root.querySelector('#mlN').value.trim();
            const cur = HL.get(id);
            if (cur) { if (v) cur.note = v; else delete cur.note; HL.save(); }
            close(); renderPanel(); toast('Note saved');
          }
        });
      });
  }

  // ---- "Note" button inside the app's selection menu ----
  function onNote() {
    const r = R(), S = r && r.Sel, HL = r && r.HL;
    if (!S || !HL) return;
    if (S.hlId) { editNote(S.hlId); return; }
    if (!S.active || !S.root) return;
    const h = HL.add(S.ch, S.start, S.end, 'yellow', S.root);   // clears the selection; the new highlight gets the note
    editNote(h.id);
  }
  function addNoteButton() {
    const acts = document.querySelector('#selMenu .acts');
    if (!acts || acts.querySelector('[data-ml-note]')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'act'; b.dataset.mlNote = '1'; b.textContent = 'Note';
    b.addEventListener('click', e => { e.stopPropagation(); onNote(); });
    acts.insertBefore(b, acts.firstChild);
  }

  // ---- export ----
  function exportAll() {
    const r = R(), book = r && r.App.book; if (!book) return;
    const hls = (r.HL.list || []).slice().sort(byPlace);
    const bms = loadBm(book.id).sort(byPlace);
    if (!hls.length && !bms.length) { toast('Nothing to export yet.'); return; }
    const L = ['# ' + book.meta.title, ''];
    if (book.meta.author) L.push('*' + book.meta.author + '*', '');
    L.push('Exported from Marginalia on ' + new Date().toLocaleDateString(), '');
    if (hls.length) {
      L.push('## Highlights and notes', '');
      let last = -1;
      for (const h of hls) {
        if (h.ch !== last) { L.push('### ' + chapterName(book, h.ch), ''); last = h.ch; }
        L.push('> ' + String(h.text || '').replace(/\s*\n\s*/g, ' '), '');
        if (h.note) L.push(h.note, '');
      }
    }
    if (bms.length) {
      L.push('## Bookmarks', '');
      bms.forEach(b => L.push('- **' + (b.title || chapterName(book, b.ch)) + '**' +
        (b.note ? ' — ' + b.note.replace(/\s*\n\s*/g, ' ') : '') + (b.title ? ' (' + chapterName(book, b.ch) + ')' : '')));
      L.push('');
    }
    const blob = new Blob([L.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (book.meta.title || 'book').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 60) + ' - notes.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Exported');
  }

  // ---- build ----
  function build() {
    const more = $('#moreBtn');
    if (!more || $('#mlBookmarkBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'mlBookmarkBtn'; btn.type = 'button'; btn.className = 'icon-btn';
    btn.setAttribute('aria-label', 'Bookmarks and notes'); btn.title = 'Bookmarks and notes';
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
    more.parentNode.insertBefore(btn, more);
    btn.addEventListener('click', e => { e.stopPropagation(); openPanel(); });

    const panel = document.createElement('div');
    panel.id = 'mlPanel'; panel.className = 'ml-overlay hidden';
    panel.innerHTML = `<div class="ml-sheet ml-panel" role="dialog" aria-modal="true" aria-label="Bookmarks and notes">
      <div class="ml-head"><h3>Bookmarks &amp; notes</h3><button type="button" class="ml-x" data-x aria-label="Close">×</button></div>
      <button type="button" class="ml-primary" id="mlAddBm">Bookmark this place</button>
      <h4 class="ml-sec">Bookmarks</h4><div id="mlBms"></div>
      <h4 class="ml-sec">Highlights &amp; notes</h4><div id="mlNotes"></div>
      <button type="button" class="ml-soft" id="mlExport">Export as Markdown</button>
    </div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', e => {
      if (e.target === panel || e.target.closest('[data-x]')) { closePanel(); return; }
      if (e.target.closest('#mlAddBm')) { addHere(); return; }
      if (e.target.closest('#mlExport')) { exportAll(); return; }
      const bg = e.target.closest('[data-bm-go]'); if (bg) { jumpBookmark(bg.dataset.bmGo); return; }
      const be = e.target.closest('[data-bm-edit]'); if (be) { editBookmark(be.dataset.bmEdit); return; }
      const br = e.target.closest('[data-bm-rm]');
      if (br) { const p = here(); if (p) { saveBm(p.book.id, loadBm(p.book.id).filter(x => x.k !== br.dataset.bmRm)); markButton(); renderPanel(); } return; }
      const hg = e.target.closest('[data-hl-go]'); if (hg) { jumpHighlight(hg.dataset.hlGo); return; }
      const he = e.target.closest('[data-hl-edit]'); if (he) { editNote(he.dataset.hlEdit); }
    });

    const menu = document.getElementById('selMenu');
    if (menu) new MutationObserver(addNoteButton).observe(menu, { childList: true });
    addNoteButton();

    const css = `
    .ml-overlay{position:fixed;inset:0;z-index:96;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center}
    .ml-over2{z-index:97}
    .ml-sheet{width:100%;max-width:560px;max-height:88vh;max-height:88dvh;overflow:auto;background:var(--sheet);color:var(--fg);border-radius:18px 18px 0 0;padding:16px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -6px 40px rgba(0,0,0,.2);box-sizing:border-box}
    .ml-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
    .ml-head h3{margin:0;font-size:18px}
    .ml-x{width:44px;height:44px;font-size:26px;line-height:1;color:var(--fg);background:none;border:0}
    .ml-primary,.ml-soft{display:block;width:100%;min-height:46px;border-radius:12px;border:0;font:inherit;font-weight:600;margin:8px 0;background:var(--accent);color:#fff}
    .ml-soft{background:var(--card);color:var(--fg)}
    .ml-sec{font-size:13px;color:var(--muted);margin:16px 0 4px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
    .ml-row2{display:flex;align-items:stretch;border-top:.5px solid var(--line)}
    .ml-go{flex:1;min-width:0;text-align:left;padding:10px 4px;background:none;border:0;color:var(--fg);font:inherit}
    .ml-go b,.ml-go span,.ml-go small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ml-go span{color:var(--muted);font-size:13px;margin-top:2px}
    .ml-go small{color:var(--fg);font-size:13px;margin-top:4px;white-space:normal;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
    .ml-faint{color:var(--muted)!important;font-style:italic}
    .ml-ic{width:44px;min-height:44px;background:none;border:0;color:var(--muted);font-size:18px}
    .ml-hint{color:var(--muted);font-size:13px;margin:10px 0}
    .ml-lbl{display:block;color:var(--muted);font-size:13px;margin:14px 0 0}
    .ml-input,.ml-area{display:block;width:100%;margin-top:6px;border-radius:12px;border:.5px solid var(--line);background:var(--card);color:var(--fg);font:inherit;font-size:16px;padding:10px 12px;box-sizing:border-box}
    .ml-input{height:46px}
    .ml-area{resize:vertical;min-height:90px}
    .ml-quote{margin:0 0 6px;padding:8px 12px;border-left:3px solid var(--accent);color:var(--muted);font-family:"Iowan Old Style",Georgia,serif;font-size:15px}
    .ml-overlay button{min-height:44px;padding:0 14px;border-radius:12px;background:var(--card);color:var(--fg);font:inherit;font-weight:600;font-size:15px;border:0}
    .ml-overlay button.primary{background:var(--accent);color:#fff}
    .ml-overlay button.danger{color:#ff3b30}
    .ml-actions{display:flex;gap:10px;margin-top:18px}
    .ml-actions button{flex:1}
    #mlBookmarkBtn.on{color:#ffd60a}
    #mlBookmarkBtn.on svg{fill:#ffd60a}`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    setInterval(markButton, 700);
    markButton();
  }

  build();
})();
