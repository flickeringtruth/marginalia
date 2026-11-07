/* v2 Contents sheet: table of contents, bookmarks, notes and highlights, plus Markdown export.
   Replaces the engine's drawer (#tocDrawer) and the panel from fixes/reader-tools.js.
   Same storage as before: localStorage marginalia.bookmarks.<id> and marginalia.notes.<id>,
   highlights through the engine's HL. Notes are still painted into the text by reader-tools.js. */
import { h, addStyle, reader, readJSON, writeJSON } from '../dom.js';
import { Button, IconButton, Field, Segmented, Sheet, Menu, confirmSheet, showToast, EmptyState } from '../components.js';
const HL_HEX = { yellow: '#ffcc00', green: '#34c759', blue: '#0a84ff', pink: '#ff375f', purple: '#af52de' };
const CSS = `
.v2-contents .v2-seg{margin:0 0 var(--v2-s3)}
.v2-rows{display:flex;flex-direction:column}
.v2-row{display:flex;align-items:stretch;border-top:1px solid var(--v2-line)}
.v2-row:first-child{border-top:0}
.v2-row>.go{flex:1;min-width:0;min-height:var(--v2-tap);padding:10px 4px;border:0;background:none;color:var(--v2-fg);text-align:left;font:inherit;cursor:pointer;border-radius:var(--v2-r-sm)}
.v2-row>.go:hover{background:var(--v2-surface)}
.v2-row>.v2-ibtn{align-self:center;color:var(--v2-muted)}
.v2-row b,.v2-row small,.v2-row q,.v2-row span.meta{display:block;overflow:hidden;text-overflow:ellipsis}
.v2-row b{font:600 var(--v2-t-base)/1.3 var(--v2-sans);white-space:nowrap}
.v2-row span.meta{margin-top:2px;font:400 var(--v2-t-xs)/1.35 var(--v2-sans);color:var(--v2-muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.v2-row q{font:400 15px/1.4 var(--v2-serif);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;quotes:"“" "”"}
.v2-row small{margin-top:4px;font:400 var(--v2-t-sm)/1.45 var(--v2-sans);color:var(--v2-muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;white-space:normal}
.v2-row .dot{display:inline-block;width:10px;height:10px;border-radius:5px;margin-right:6px;vertical-align:middle}
.v2-toc .go{font:400 var(--v2-t-base)/1.35 var(--v2-sans)}
.v2-toc .go.d1{padding-left:20px}.v2-toc .go.d2{padding-left:36px}.v2-toc .go.d3{padding-left:52px}
.v2-toc .go[aria-current="true"]{color:var(--v2-accent-text);font-weight:600}
.v2-bm-tools{display:flex;flex-wrap:wrap;gap:var(--v2-s2);align-items:center;margin:0 0 var(--v2-s3)}
.v2-bm-tools .v2-input{flex:1 1 160px;min-width:0}
.v2-quote{margin:0 0 var(--v2-s3);padding:6px 0 6px 12px;border-left:3px solid var(--v2-accent);font:400 15px/1.45 var(--v2-serif)}
.v2-area{display:block;width:100%;box-sizing:border-box;min-height:120px;padding:10px 12px;border-radius:var(--v2-r-md);border:1px solid var(--v2-line);
  background:var(--v2-surface);color:var(--v2-fg);font:400 16px/1.45 var(--v2-sans);resize:vertical}
.v2-contents-foot{margin-top:var(--v2-s4)}
`;
const R = () => reader();
const bmKey = (id) => 'marginalia.bookmarks.' + id;
const ntKey = (id) => 'marginalia.notes.' + id;
const bmList = (id) => readJSON(bmKey(id), []) || [];
const ntList = (id) => readJSON(ntKey(id), []) || [];
const newKey = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const byPlace = (a, b) => a.ch - b.ch || (a.off ?? a.start ?? 0) - (b.off ?? b.start ?? 0);
function chapterName(ch) { const b = R().App.book; return b && b.chapters[ch] && b.chapters[ch].title ? String(b.chapters[ch].title) : 'Section ' + (ch + 1); }
function pctOf(ch) { const n = (R().App.book?.chapters || []).length; return n ? Math.min(100, Math.round(ch / n * 100)) : 0; }
function dateLabel(t) {
    if (!t)
        return '';
    const d = new Date(t);
    return d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
function here() {
    const r = R(), b = r.App.book;
    if (!b || !r.App.r || !r.App.r.getLoc)
        return null;
    try {
        const loc = r.App.r.getLoc();
        return { id: b.id, ch: loc.ch, off: loc.off == null ? -1 : loc.off };
    }
    catch {
        return null;
    }
}
function jump(sheet, ch, off) {
    if (sheet)
        sheet.close();
    void R().App.goTo({ ch, off, frac: 0 });
}
let tab = 'toc';
let bmSort = 'book';
let bmQuery = '';
export function openContents(start) {
    addStyle('v2-contents', CSS);
    const r = R(), book = r.App.book;
    if (!book)
        return;
    tab = start === 'hl' ? 'hl' : start === 'bm' ? 'bm' : start === 'nt' ? 'nt' : start === 'toc' ? 'toc' : tab;
    const isPdf = book.type === 'pdf';
    if (isPdf && tab !== 'toc' && tab !== 'bm')
        tab = 'toc';
    const view = h('div');
    const opts = [{ value: 'toc', label: 'Contents' }, { value: 'bm', label: 'Bookmarks' }];
    if (!isPdf)
        opts.push({ value: 'nt', label: 'Notes' }, { value: 'hl', label: 'Highlights' });
    const tabs = Segmented({ label: 'Show', options: opts, value: tab, onChange: v => { tab = v; draw(); } });
    const onChange = () => draw();
    document.addEventListener('reader:annotations', onChange);
    const sheet = Sheet({ title: book.meta.title || 'Contents', className: 'v2-contents', content: [tabs, view],
        onClose: () => document.removeEventListener('reader:annotations', onChange) });
    function draw() {
        const id = book.id;
        if (tab === 'toc') {
            let cur = 0;
            const p = here();
            if (p)
                cur = p.ch;
            const toc = book.toc || [];
            let currentIdx = -1;
            toc.forEach((t, i) => { if (t.ch >= 0 && t.ch <= cur)
                currentIdx = i; });
            const rows = toc.map((t, i) => {
                const b = h('button', { type: 'button', class: 'go d' + Math.min(3, t.depth || 0), text: t.title, 'aria-current': i === currentIdx ? 'true' : null });
                b.addEventListener('click', () => {
                    let ch = t.ch, frag = t.frag;
                    if (ch < 0) {
                        const nx = toc.slice(i + 1).find(x => x.ch >= 0);
                        if (!nx)
                            return;
                        ch = nx.ch;
                        frag = nx.frag;
                    }
                    sheet.close();
                    void R().App.goTo({ ch, frag, off: -1, frac: 0 });
                });
                return h('div', { class: 'v2-row' }, b);
            });
            view.replaceChildren(rows.length ? h('div', { class: 'v2-rows v2-toc' }, ...rows) : EmptyState({ title: 'No contents', text: 'This book has no table of contents.', art: 'contents' }));
            const curEl = view.querySelector('[aria-current="true"]');
            if (curEl)
                requestAnimationFrame(() => curEl.scrollIntoView({ block: 'center' }));
            return;
        }
        if (tab === 'bm') {
            const all = bmList(id);
            const search = Field({ label: 'Search bookmarks', value: bmQuery, placeholder: 'Search bookmarks' });
            search.input.type = 'search';
            search.input.setAttribute('aria-label', 'Search bookmarks');
            const list = h('div', { class: 'v2-rows' });
            const paint = () => {
                const q = bmQuery.trim().toLowerCase();
                let items = all.slice().sort(bmSort === 'new' ? (a, b) => (b.t || 0) - (a.t || 0) : byPlace);
                if (q)
                    items = items.filter(b => [b.title, b.label, b.note, chapterName(b.ch)].some(v => String(v || '').toLowerCase().includes(q)));
                if (!items.length) {
                    list.replaceChildren(h('p', { class: 'v2-hint', text: q ? 'No bookmarks match “' + bmQuery.trim() + '”.' : 'No bookmarks yet. Tap “Bookmark this place” while reading.' }));
                    return;
                }
                list.replaceChildren(...items.map(b => {
                    const chap = chapterName(b.ch);
                    const go = h('button', { type: 'button', class: 'go' }, h('b', { text: b.title || chap }), h('span', { class: 'meta', text: [b.title ? chap : null, pctOf(b.ch) + '%', dateLabel(b.t)].filter(Boolean).join(' · ') }), b.label ? h('small', { text: b.label }) : null, b.note ? h('small', { text: b.note }) : null);
                    go.addEventListener('click', () => jump(sheet, b.ch, b.off));
                    const more = IconButton({ label: 'Options for bookmark ' + (b.title || chap), icon: 'more', attrs: { 'aria-haspopup': 'menu' } });
                    more.addEventListener('click', () => Menu(more, [
                        { label: 'Edit', icon: 'edit', onSelect: () => editBookmark(b.k, draw) },
                        { label: 'Delete', icon: 'trash', danger: true, onSelect: () => void deleteBookmark(b.k).then(draw) }
                    ], 'Bookmark options'));
                    return h('div', { class: 'v2-row' }, go, more);
                }));
            };
            search.input.addEventListener('input', () => { bmQuery = search.input.value; paint(); });
            const tools = [Button({ label: 'Bookmark this place', icon: 'bookmark', variant: 'primary', onClick: () => void addBookmark().then(draw) })];
            if (all.length)
                tools.push(search.input, Segmented({ label: 'Sort bookmarks', options: [{ value: 'book', label: 'In order' }, { value: 'new', label: 'Newest' }], value: bmSort, onChange: v => { bmSort = v; paint(); } }));
            view.replaceChildren(h('div', { class: 'v2-bm-tools' }, ...tools), list, exportButton());
            paint();
            return;
        }
        if (tab === 'nt') {
            const notes = ntList(id).sort(byPlace);
            view.replaceChildren(notes.length ? h('div', { class: 'v2-rows' }, ...notes.map(n => {
                const go = h('button', { type: 'button', class: 'go' }, h('q', { text: n.text }), n.note ? h('small', { text: n.note }) : h('small', { text: 'No note text yet' }), h('span', { class: 'meta', text: chapterName(n.ch) }));
                go.addEventListener('click', () => jump(sheet, n.ch, n.start));
                return h('div', { class: 'v2-row' }, go, IconButton({ label: 'Edit note', icon: 'edit', onClick: () => openNoteEditor(n.k, false, draw) }));
            })) : h('p', { class: 'v2-hint', text: 'Select text or a single word in the book, then tap Note.' }), exportButton());
            return;
        }
        const hls = (R().HL.list || []).slice().sort(byPlace);
        view.replaceChildren(hls.length ? h('div', { class: 'v2-rows' }, ...hls.map(hl => {
            const dot = h('i', { class: 'dot', 'aria-hidden': 'true' });
            dot.style.background = HL_HEX[hl.color] || '#ffcc00';
            const go = h('button', { type: 'button', class: 'go' }, h('b', {}, dot, chapterName(hl.ch)), h('small', { text: hl.text }));
            go.addEventListener('click', () => jump(sheet, hl.ch, hl.start));
            return h('div', { class: 'v2-row' }, go, IconButton({ label: 'Remove highlight', icon: 'trash', onClick: () => { R().HL.remove(hl.id); showToast('Highlight removed'); draw(); } }));
        })) : h('p', { class: 'v2-hint', text: 'No highlights yet. Select text and pick a colour.' }), exportButton());
    }
    draw();
}
function exportButton() {
    return h('div', { class: 'v2-contents-foot' }, Button({ label: 'Export as Markdown', icon: 'download', block: true, onClick: exportAll }));
}
async function snippetAt(ch, off) {
    const book = R().App.book;
    if (!book)
        return '';
    if (book.type === 'pdf')
        return 'Page ' + (ch + 1);
    try {
        const d = await book.getChapter(ch);
        const t = (d.textContent || '').slice(Math.max(0, off), Math.max(0, off) + 70).replace(/\s+/g, ' ').trim();
        return t ? t + '…' : chapterName(ch);
    }
    catch {
        return chapterName(ch);
    }
}
async function addBookmark() {
    const p = here();
    if (!p)
        return;
    const list = bmList(p.id);
    if (list.find(b => b.ch === p.ch && (p.off < 0 || b.off < 0 || Math.abs(b.off - p.off) < 300))) {
        showToast('This place is already bookmarked.');
        return;
    }
    list.push({ k: newKey(), ch: p.ch, off: p.off, title: '', note: '', label: await snippetAt(p.ch, p.off), t: Date.now() });
    writeJSON(bmKey(p.id), list);
    showToast('Bookmarked');
}
async function deleteBookmark(k) {
    const id = R().App.book?.id;
    if (!id)
        return;
    if (!(await confirmSheet({ title: 'Remove this bookmark?', text: 'The bookmark is removed from this book.', confirm: 'Remove', danger: true })))
        return;
    writeJSON(bmKey(id), bmList(id).filter(b => b.k !== k));
    showToast('Bookmark removed');
}
function editBookmark(k, after) {
    const id = R().App.book?.id;
    if (!id)
        return;
    const b = bmList(id).find(x => x.k === k);
    if (!b)
        return;
    const title = Field({ label: 'Title', value: b.title || '', placeholder: chapterName(b.ch), maxlength: 120 });
    const note = h('textarea', { class: 'v2-area', maxlength: 2000, placeholder: 'Write a note…', 'aria-label': 'Note' });
    note.value = b.note || '';
    const s = Sheet({
        title: 'Edit bookmark',
        content: [h('p', { class: 'v2-hint', text: chapterName(b.ch) + ' · ' + pctOf(b.ch) + '%' }), b.label ? h('blockquote', { class: 'v2-quote', text: b.label }) : null,
            title.el, h('label', { class: 'v2-field' }, h('span', { text: 'Note' }), note)],
        footer: [Button({ label: 'Cancel', onClick: () => s.close() }), Button({ label: 'Save', variant: 'primary', onClick: () => {
                    const list = bmList(id), x = list.find(y => y.k === k);
                    if (x) {
                        x.title = title.input.value.trim();
                        x.note = note.value.trim();
                        writeJSON(bmKey(id), list);
                    }
                    s.close();
                    showToast('Saved');
                    after();
                } })]
    });
}
/* Note editor: also opened when a note is tapped in the text (fixes/reader-tools.js calls window.__marginaliaOpenNote). */
export function openNoteEditor(k, creating, after) {
    const id = R().App.book?.id;
    if (!id)
        return;
    const n = ntList(id).find(x => x.k === k);
    if (!n)
        return;
    const area = h('textarea', { class: 'v2-area', maxlength: 4000, placeholder: 'Write your thoughts…', 'aria-label': 'Your note' });
    area.value = n.note || '';
    let saved = false;
    const discardEmpty = () => {
        if (creating && !saved && !n.note) {
            writeJSON(ntKey(id), ntList(id).filter(x => x.k !== k));
            window.__marginaliaReaderTools?.unwrapNote(k);
        }
    };
    const s = Sheet({
        title: 'Note',
        content: [h('blockquote', { class: 'v2-quote', text: n.text }), h('label', { class: 'v2-field' }, h('span', { text: 'Your note' }), area),
            h('div', { class: 'v2-contents-foot' }, Button({ label: 'Delete note', icon: 'trash', variant: 'danger', onClick: async () => {
                    if (!(await confirmSheet({ title: 'Delete this note?', text: 'The note and its underline are removed.', confirm: 'Delete', danger: true })))
                        return;
                    saved = true;
                    writeJSON(ntKey(id), ntList(id).filter(x => x.k !== k));
                    window.__marginaliaReaderTools?.unwrapNote(k);
                    s.close();
                    showToast('Note deleted');
                    if (after)
                        after();
                } }))],
        footer: [Button({ label: creating ? 'Discard' : 'Cancel', onClick: () => s.close() }), Button({ label: 'Save note', variant: 'primary', onClick: () => {
                    const list = ntList(id), x = list.find(y => y.k === k);
                    if (x) {
                        x.note = area.value.trim();
                        writeJSON(ntKey(id), list);
                    }
                    saved = true;
                    s.close();
                    showToast('Note saved');
                    if (after)
                        after();
                } })],
        onClose: discardEmpty
    });
    if (creating)
        requestAnimationFrame(() => area.focus());
}
/* "Note" in the selection menu: same data as fixes/reader-tools.js onNote(). */
export function noteFromSelection() {
    const r = R(), S = r.Sel, id = r.App.book?.id;
    if (!id)
        return;
    let ch, start, end, text;
    if (S.hlId) {
        const hl = r.HL.get(S.hlId);
        if (!hl)
            return;
        ch = hl.ch;
        start = hl.start;
        end = hl.end;
        text = hl.text;
    }
    else {
        if (!S.active || !S.root)
            return;
        ch = S.ch;
        start = S.start;
        end = S.end;
        text = (S.root.textContent || '').slice(start, end).replace(/\s+/g, ' ').trim();
    }
    if (!text)
        return;
    const k = newKey();
    const list = ntList(id);
    list.push({ k, ch, start, end, text, note: '', t: Date.now() });
    writeJSON(ntKey(id), list);
    r.clearSelection();
    window.__marginaliaReaderTools?.repaint();
    openNoteEditor(k, true);
}
/* Same Markdown as fixes/reader-tools.js exportAll(). */
function exportAll() {
    const r = R(), book = r.App.book;
    if (!book)
        return;
    const hls = (r.HL.list || []).slice().sort(byPlace), nts = ntList(book.id).sort(byPlace), bms = bmList(book.id).sort(byPlace);
    if (!hls.length && !nts.length && !bms.length) {
        showToast('Nothing to export yet.');
        return;
    }
    const L = ['# ' + (book.meta.title || ''), ''];
    if (book.meta.author)
        L.push('*' + book.meta.author + '*', '');
    L.push('Exported from Marginalia on ' + new Date().toLocaleDateString(), '');
    if (nts.length) {
        L.push('## Notes', '');
        nts.forEach(n => { L.push('### ' + chapterName(n.ch), '', '> ' + n.text.replace(/\s*\n\s*/g, ' '), ''); if (n.note)
            L.push(n.note, ''); });
    }
    if (hls.length) {
        L.push('## Highlights', '');
        hls.forEach(x => L.push('- ' + x.text.replace(/\s*\n\s*/g, ' ') + ' (' + chapterName(x.ch) + ')'));
        L.push('');
    }
    if (bms.length) {
        L.push('## Bookmarks', '');
        bms.forEach(b => L.push('- **' + (b.title || chapterName(b.ch)) + '**' + (b.note ? ' — ' + b.note.replace(/\s*\n\s*/g, ' ') : '')));
        L.push('');
    }
    const url = URL.createObjectURL(new Blob([L.join('\n')], { type: 'text/markdown;charset=utf-8' }));
    const a = h('a', { href: url, download: (book.meta.title || 'book').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 60) + ' - notes.md' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast('Exported');
}
