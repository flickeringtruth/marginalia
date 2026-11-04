/* Marginalia reader tools: bookmarks, notes (kept apart from highlights), highlights, export.
   Loaded from index.html as a module. Remove the script tag to turn it off.
   Notes: select text or a single word, then tap Note. A note shows as a dotted underline, not a highlight.
   Tap a note in the text to read or edit it. */
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
  const HL_HEX = { yellow: '#ffcc00', green: '#34c759', blue: '#0a84ff', pink: '#ff375f', purple: '#af52de' };
  const empty = t => `<p class="ml-hint">${t}</p>`;
  const lsList = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  const lsSaveList = (k, l) => { try { localStorage.setItem(k, JSON.stringify(l)); } catch (e) { /* ignore */ } };
  const bmList = id => lsList('marginalia.bookmarks.' + id);
  const ntList = id => lsList('marginalia.notes.' + id);
  const saveBm = (id, l) => lsSaveList('marginalia.bookmarks.' + id, l);
  const saveNt = (id, l) => lsSaveList('marginalia.notes.' + id, l);
  const newKey = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
    b.classList.toggle('on', !!(p && near(bmList(p.book.id), p)));
  }

  // ---- notes are painted as their own marks, separate from highlights ----
  function wrapRange(root, start, end, k) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const parts = []; let pos = 0, n;
    while ((n = walker.nextNode())) {
      const len = n.nodeValue.length, s = pos, e = pos + len;
      pos = e;
      if (!len || e <= start || s >= end) continue;
      if (n.parentNode.closest && n.parentNode.closest('svg,math')) continue;
      parts.push([n, Math.max(0, start - s), Math.min(len, end - s)]);
    }
    for (const [node, a, b] of parts) {
      let seg = node;
      if (a > 0) seg = seg.splitText(a);
      if (b - a < seg.nodeValue.length) seg.splitText(b - a);
      const m = document.createElement('mark');
      m.className = 'ml-note'; m.dataset.nk = k;
      seg.parentNode.insertBefore(m, seg);
      m.appendChild(seg);
    }
  }
  function unwrapNote(k) {
    document.querySelectorAll('mark.ml-note[data-nk="' + k + '"]').forEach(m => {
      const p = m.parentNode;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
    });
  }
  // Older versions stored notes as highlights with a note attached. Move those into the notes list once per book.
  function migrate(book) {
    const flag = 'marginalia.notesMigrated.' + book.id;
    if (localStorage.getItem(flag)) return;
    const HL = R().HL, old = (HL.list || []).filter(h => h.note);
    if (old.length) {
      const notes = ntList(book.id);
      old.forEach(h => notes.push({ k: newKey(), ch: h.ch, start: h.start, end: h.end, text: h.text, note: h.note, t: h.t || Date.now() }));
      saveNt(book.id, notes);
      old.forEach(h => HL.remove(h.id));
    }
    try { localStorage.setItem(flag, '1'); } catch (e) { /* ignore */ }
  }
  let queued = false;
  function paint() {
    queued = false;
    const r = R(), book = r && r.App && r.App.book; if (!book) return;
    migrate(book);
    const notes = ntList(book.id); if (!notes.length) return;
    document.querySelectorAll('.chap[data-ch]').forEach(root => {
      const ch = +root.dataset.ch;
      notes.forEach(n => {
        if (n.ch === ch && !root.querySelector('mark.ml-note[data-nk="' + n.k + '"]')) wrapRange(root, n.start, n.end, n.k);
      });
    });
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };

  // ---- editors ----
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

  function openNoteEditor(k, creating) {
    const p = here(); if (!p) return;
    const n = ntList(p.book.id).find(x => x.k === k); if (!n) return;
    overlay(`<div class="ml-head"><h3><span class="ml-noteicon">✎</span> Note</h3></div>
      <blockquote class="ml-quote">${esc(n.text)}</blockquote>
      <label class="ml-lbl">Your note<textarea id="mlN" class="ml-area" rows="5" maxlength="4000" placeholder="Write your thoughts…">${esc(n.note || '')}</textarea></label>
      <div class="ml-actions"><button type="button" class="danger" data-del>Delete note</button><button type="button" data-cancel>${creating ? 'Discard' : 'Cancel'}</button><button type="button" class="primary" data-save>Save note</button></div>`,
      (root, close) => {
        root.addEventListener('click', e => {
          if (e.target.closest('[data-cancel]')) {
            if (creating && !n.note) saveNt(p.book.id, ntList(p.book.id).filter(x => x.k !== k)), unwrapNote(k);
            close(); renderPanel(); return;
          }
          if (e.target.closest('[data-del]')) {
            if (!window.confirm('Delete this note?')) return;
            saveNt(p.book.id, ntList(p.book.id).filter(x => x.k !== k));
            unwrapNote(k); close(); renderPanel(); toast('Note deleted'); return;
          }
          if (e.target.closest('[data-save]')) {
            const v = root.querySelector('#mlN').value.trim();
            const list = ntList(p.book.id), x = list.find(y => y.k === k);
            if (x) { x.note = v; saveNt(p.book.id, list); }
            close(); renderPanel(); toast('Note saved');
          }
        });
        if (creating) setTimeout(() => root.querySelector('#mlN').focus(), 60);
      });
  }

  function editBookmark(k) {
    const p = here(); if (!p) return;
    const b = bmList(p.book.id).find(x => x.k === k); if (!b) return;
    overlay(`<div class="ml-head"><h3>Edit bookmark</h3></div>
      <label class="ml-lbl">Title<input id="mlT" class="ml-input" maxlength="120" placeholder="${esc(chapterName(p.book, b.ch))}" value="${esc(b.title || '')}"></label>
      <label class="ml-lbl">Note<textarea id="mlN" class="ml-area" rows="4" maxlength="2000" placeholder="Write a note…">${esc(b.note || '')}</textarea></label>
      <div class="ml-actions"><button type="button" class="danger" data-del>Delete</button><button type="button" data-cancel>Cancel</button><button type="button" class="primary" data-save>Save</button></div>`,
      (root, close) => {
        root.addEventListener('click', e => {
          if (e.target.closest('[data-cancel]')) { close(); return; }
          if (e.target.closest('[data-del]')) { saveBm(p.book.id, bmList(p.book.id).filter(x => x.k !== k)); close(); markButton(); renderPanel(); return; }
          if (e.target.closest('[data-save]')) {
            const list = bmList(p.book.id), x = list.find(y => y.k === k);
            if (x) { x.title = root.querySelector('#mlT').value.trim(); x.note = root.querySelector('#mlN').value.trim(); saveBm(p.book.id, list); }
            close(); renderPanel(); toast('Saved');
          }
        });
      });
  }

  // ---- notes from the selection menu ----
  function clearSel() {
    const r = R(), S = r && r.Sel; if (!S) return;
    if (S.root) S.root.querySelectorAll('mark.sel').forEach(m => {
      const p = m.parentNode;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
    });
    S.active = false; S.hlId = null; S.root = null;
    const menu = $('#selMenu'); if (menu) menu.classList.remove('show');
    ['#hStart', '#hEnd'].forEach(s => { const h = $(s); if (h) h.style.display = 'none'; });
  }
  function onNote() {
    const r = R(), S = r && r.Sel, p = here(); if (!S || !p) return;
    let ch, start, end, text;
    if (S.hlId) {
      const h = r.HL.get(S.hlId); if (!h) return;
      ch = h.ch; start = h.start; end = h.end; text = h.text;
    } else {
      if (!S.active || !S.root) return;
      ch = S.ch; start = S.start; end = S.end;
      text = S.root.textContent.slice(start, end).replace(/\s+/g, ' ').trim();
    }
    if (!text) return;
    const k = newKey();
    const list = ntList(p.book.id); list.push({ k, ch, start, end, text, note: '', t: Date.now() });
    saveNt(p.book.id, list);
    clearSel();
    schedule();
    openNoteEditor(k, true);
  }
  function addNoteButton() {
    const acts = document.querySelector('#selMenu .acts');
    if (!acts || acts.querySelector('[data-ml-note]')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'act'; b.dataset.mlNote = '1'; b.textContent = 'Note';
    b.addEventListener('click', e => { e.stopPropagation(); onNote(); });
    acts.insertBefore(b, acts.firstChild);
  }

  // ---- panel: three separate tabs ----
  let tab = 'bm';
  function renderPanel() {
    const p = here(); if (!p) return;
    const book = p.book;
    const bms = bmList(book.id).sort(byPlace), nts = ntList(book.id).sort(byPlace), hls = (R().HL.list || []).slice().sort(byPlace);
    $('#mlTabs').innerHTML = [['bm', 'Bookmarks', bms.length], ['nt', 'Notes', nts.length], ['hl', 'Highlights', hls.length]]
      .map(([k, l, n]) => `<button type="button" class="ml-tab${tab === k ? ' on' : ''}" data-tab="${k}">${l}<em>${n}</em></button>`).join('');
    let html = '';
    if (tab === 'bm') {
      html = '<button type="button" class="ml-primary" id="mlAddBm">Bookmark this place</button>' +
        (bms.length ? bms.map(b => `<div class="ml-row2"><button type="button" class="ml-go" data-bm-go="${esc(b.k)}">` +
          `<b>${esc(b.title || chapterName(book, b.ch))}</b>` +
          `<span>${esc(b.title ? chapterName(book, b.ch) + (b.label ? ' · ' : '') : '')}${esc(b.label || '')}</span>` +
          (b.note ? `<small>${esc(b.note)}</small>` : '') + '</button>' +
          `<button type="button" class="ml-ic" data-bm-edit="${esc(b.k)}" aria-label="Edit bookmark">✎</button>` +
          `<button type="button" class="ml-ic" data-bm-rm="${esc(b.k)}" aria-label="Remove bookmark">×</button></div>`).join('')
          : empty('No bookmarks yet. Tap “Bookmark this place” while reading.'));
    } else if (tab === 'nt') {
      html = nts.length ? nts.map(n => `<div class="ml-row2 ml-notecard"><button type="button" class="ml-go" data-nt-go="${esc(n.k)}">` +
        `<q>${esc(n.text)}</q>${n.note ? `<small>${esc(n.note)}</small>` : '<small class="ml-faint">No note text yet</small>'}` +
        `<span>${esc(chapterName(book, n.ch))}</span></button>` +
        `<button type="button" class="ml-ic" data-nt-edit="${esc(n.k)}" aria-label="Edit note">✎</button></div>`).join('')
        : empty('Select text or a single word in the book, then tap Note.');
    } else {
      html = hls.length ? hls.map(h => `<div class="ml-row2"><button type="button" class="ml-go" data-hl-go="${esc(h.id)}">` +
        `<b><i class="ml-dot" style="background:${HL_HEX[h.color] || '#ffcc00'}"></i>${esc(chapterName(book, h.ch))}</b>` +
        `<span>${esc(h.text)}</span></button>` +
        `<button type="button" class="ml-ic" data-hl-rm="${esc(h.id)}" aria-label="Remove highlight">×</button></div>`).join('')
        : empty('No highlights yet. Select text and pick a colour.');
    }
    $('#mlBody').innerHTML = html;
  }
  function openPanel() {
    if (!here()) return;
    renderPanel();
    $('#mlPanel').classList.remove('hidden');
  }
  const closePanel = () => $('#mlPanel').classList.add('hidden');

  async function addBookmark() {
    const p = here(); if (!p) return;
    const list = bmList(p.book.id);
    if (near(list, p)) { toast('This place is already bookmarked.'); return; }
    const label = await snippetAt(p.book, p.ch, p.off);
    list.push({ k: newKey(), ch: p.ch, off: p.off, title: '', note: '', label, t: Date.now() });
    saveBm(p.book.id, list);
    markButton(); renderPanel(); toast('Bookmarked');
  }
  function jumpTo(ch, off) {
    const p = here(); if (!p) return;
    closePanel();
    p.app.goTo({ ch, off, frac: 0 });
  }

  // ---- export ----
  function exportAll() {
    const r = R(), book = r && r.App.book; if (!book) return;
    const hls = (r.HL.list || []).slice().sort(byPlace), nts = ntList(book.id).sort(byPlace), bms = bmList(book.id).sort(byPlace);
    if (!hls.length && !nts.length && !bms.length) { toast('Nothing to export yet.'); return; }
    const L = ['# ' + book.meta.title, ''];
    if (book.meta.author) L.push('*' + book.meta.author + '*', '');
    L.push('Exported from Marginalia on ' + new Date().toLocaleDateString(), '');
    if (nts.length) {
      L.push('## Notes', '');
      nts.forEach(n => { L.push('### ' + chapterName(book, n.ch), '', '> ' + n.text.replace(/\s*\n\s*/g, ' '), ''); if (n.note) L.push(n.note, ''); });
    }
    if (hls.length) {
      L.push('## Highlights', '');
      hls.forEach(h => L.push('- ' + h.text.replace(/\s*\n\s*/g, ' ') + ' (' + chapterName(book, h.ch) + ')'));
      L.push('');
    }
    if (bms.length) {
      L.push('## Bookmarks', '');
      bms.forEach(b => L.push('- **' + (b.title || chapterName(book, b.ch)) + '**' + (b.note ? ' — ' + b.note.replace(/\s*\n\s*/g, ' ') : '')));
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

  // ---- events ----
  let down = null;
  document.addEventListener('pointerdown', e => { down = { t: performance.now(), x: e.clientX, y: e.clientY }; }, true);
  document.addEventListener('pointerup', e => {
    const d = down; down = null;
    if (!d || performance.now() - d.t > 400 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
    // The stage captures the pointer, so look up the element under the finger instead of e.target.
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const m = el && el.closest && el.closest('mark.ml-note');
    if (m) openNoteEditor(m.dataset.nk, false);
  }, true);

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
    panel.innerHTML = `<div class="ml-sheet ml-panel" role="dialog" aria-modal="true" aria-label="Bookmarks, notes and highlights">
      <div class="ml-head"><h3>Your reading</h3><button type="button" class="ml-x" data-x aria-label="Close">×</button></div>
      <div class="ml-tabs" id="mlTabs"></div>
      <div id="mlBody"></div>
      <button type="button" class="ml-soft" id="mlExport">Export as Markdown</button>
    </div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', e => {
      if (e.target === panel || e.target.closest('[data-x]')) { closePanel(); return; }
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; renderPanel(); return; }
      if (e.target.closest('#mlAddBm')) { addBookmark(); return; }
      if (e.target.closest('#mlExport')) { exportAll(); return; }
      const bg = e.target.closest('[data-bm-go]');
      if (bg) { const p = here(), b = p && bmList(p.book.id).find(x => x.k === bg.dataset.bmGo); if (b) jumpTo(b.ch, b.off); return; }
      const be = e.target.closest('[data-bm-edit]'); if (be) { editBookmark(be.dataset.bmEdit); return; }
      const br = e.target.closest('[data-bm-rm]');
      if (br) { const p = here(); if (p) { saveBm(p.book.id, bmList(p.book.id).filter(x => x.k !== br.dataset.bmRm)); markButton(); renderPanel(); } return; }
      const ng = e.target.closest('[data-nt-go]');
      if (ng) { const p = here(), n = p && ntList(p.book.id).find(x => x.k === ng.dataset.ntGo); if (n) jumpTo(n.ch, n.start); return; }
      const ne = e.target.closest('[data-nt-edit]'); if (ne) { openNoteEditor(ne.dataset.ntEdit, false); return; }
      const hg = e.target.closest('[data-hl-go]');
      if (hg) { const h = R().HL.get(hg.dataset.hlGo); if (h) jumpTo(h.ch, h.start); return; }
      const hr = e.target.closest('[data-hl-rm]');
      if (hr) { R().HL.remove(hr.dataset.hlRm); renderPanel(); }
    });

    const menu = document.getElementById('selMenu');
    if (menu) new MutationObserver(addNoteButton).observe(menu, { childList: true });
    addNoteButton();

    ['#viewport', '#scroller'].forEach(s => {
      const n = $(s);
      if (n) new MutationObserver(schedule).observe(n, { childList: true, subtree: true });
    });
    schedule();

    const css = `
    .ml-overlay{position:fixed;inset:0;z-index:96;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center}
    .ml-over2{z-index:97}
    .ml-sheet{width:100%;max-width:560px;max-height:88vh;max-height:88dvh;overflow:auto;background:var(--sheet);color:var(--fg);border-radius:18px 18px 0 0;padding:16px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -6px 40px rgba(0,0,0,.2);box-sizing:border-box}
    .ml-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
    .ml-head h3{margin:0;font-size:18px}
    .ml-x{width:44px;height:44px;font-size:26px;line-height:1;color:var(--fg);background:none;border:0}
    .ml-tabs{display:flex;gap:6px;background:var(--card);border-radius:12px;padding:4px;margin-bottom:10px}
    .ml-tab{flex:1;min-height:40px;border-radius:9px;background:none;border:0;color:var(--fg);font:inherit;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px}
    .ml-tab em{font-style:normal;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
    .ml-tab.on{background:var(--sheet);box-shadow:0 1px 4px rgba(0,0,0,.15)}
    .ml-primary,.ml-soft{display:block;width:100%;min-height:46px;border-radius:12px;border:0;font:inherit;font-weight:600;margin:8px 0;background:var(--accent);color:#fff}
    .ml-soft{background:var(--card);color:var(--fg);margin-top:14px}
    .ml-row2{display:flex;align-items:stretch;border-top:.5px solid var(--line)}
    .ml-go{flex:1;min-width:0;text-align:left;padding:12px 4px;background:none;border:0;color:var(--fg);font:inherit}
    .ml-go b,.ml-go span,.ml-go small{display:block;overflow:hidden;text-overflow:ellipsis}
    .ml-go b{white-space:nowrap}
    .ml-go span{color:var(--muted);font-size:13px;margin-top:2px}
    .ml-go small{font-size:13px;margin-top:4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;white-space:normal}
    .ml-go q,.ml-quote{font-family:"Iowan Old Style",Georgia,serif;font-size:15px;line-height:1.4;quotes:"“" "”";color:var(--fg)}
    .ml-go q{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;border-bottom:2px dotted var(--accent);padding-bottom:2px;display:block}
    .ml-quote{margin:0 0 8px;padding:6px 0 6px 12px;border-left:3px solid var(--accent)}
    .ml-noteicon{color:var(--accent)}
    .ml-faint{color:var(--muted)!important;font-style:italic}
    .ml-dot{display:inline-block;width:10px;height:10px;border-radius:5px;margin-right:6px;vertical-align:middle}
    .ml-ic{width:44px;min-height:44px;background:none;border:0;color:var(--muted);font-size:18px}
    .ml-hint{color:var(--muted);font-size:14px;margin:14px 0;line-height:1.45}
    .ml-lbl{display:block;color:var(--muted);font-size:13px;margin:14px 0 0}
    .ml-input,.ml-area{display:block;width:100%;margin-top:6px;border-radius:12px;border:.5px solid var(--line);background:var(--card);color:var(--fg);font:inherit;font-size:16px;padding:10px 12px;box-sizing:border-box}
    .ml-input{height:46px}
    .ml-area{resize:vertical;min-height:100px}
    .ml-overlay button{min-height:44px;padding:0 14px;border-radius:12px;background:var(--card);color:var(--fg);font:inherit;font-weight:600;font-size:15px;border:0}
    .ml-overlay button.primary{background:var(--accent);color:#fff}
    .ml-overlay button.danger{color:#ff3b30}
    .ml-actions{display:flex;gap:10px;margin-top:18px}
    .ml-actions button{flex:1}
    #mlBookmarkBtn.on{color:#ffd60a}
    #mlBookmarkBtn.on svg{fill:#ffd60a}
    mark.ml-note{background:none;color:inherit;border-bottom:2px dotted var(--accent);padding-bottom:1px;cursor:pointer}`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    setInterval(markButton, 700);
    markButton();
  }

  build();
})();
