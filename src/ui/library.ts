/* v2 library screen. Replaces fixes/library.js, library-ui.js, library-depth.js, magic-motion.js,
   library-type.js and the library part of library-polish.js (see docs/ui-audit.md).
   Same data as before: books from IndexedDB through window.__reader, reading progress from
   localStorage reader.pos.<id>, pins and categories from localStorage marginalia.library,
   Start here books from featured.json. Books are always matched by id, never by title. */

import { h, addStyle, reader, readJSON, writeJSON, reduceMotion } from './dom.js';
import { icon } from './icons.js';
import { Button, IconButton, Chip, Field, Toggle, Sheet, confirmSheet, Menu, ListItem, showToast, EmptyState } from './components.js';
import { AppShell, Shell } from './shell.js';
import { setAppRoots } from './overlay.js';

/* ---------- data ---------- */

const LIB_KEY = 'marginalia.library';
interface LibData { pins: Record<string, boolean>; cats: Record<string, string>; custom: string[] }
type Status = 'new' | 'reading' | 'done';
type Filter = 'all' | Status | 'pinned' | `cat:${string}`;
interface Item { meta: ReaderBookMeta; pct: number; started: boolean; status: Status; pinned: boolean; cat: string }
interface Featured { id: number; title: string; authors?: string[]; note?: string }

let data: LibData = loadData();
let items: Item[] = [];
let featured: Featured[] = [];
let filter: Filter = 'all';
let loadError: string | null = null;
let coverUrls: string[] = [];
let shell: Shell;
let firstPaint = true;
let loaded = false;          // nothing is drawn until the first read of the library finishes

function loadData(): LibData {
  const d = readJSON<Partial<LibData>>(LIB_KEY, {});
  return { pins: d.pins || {}, cats: d.cats || {}, custom: Array.isArray(d.custom) ? d.custom : [] };
}
function saveData(): void { writeJSON(LIB_KEY, data); }
function allCats(): string[] {
  const s = new Set(data.custom);
  Object.values(data.cats).forEach(c => { if (c) s.add(c); });
  return [...s].sort((a, b) => a.localeCompare(b));
}
function progress(id: string): { pct: number; started: boolean } {
  const pos = readJSON<{ pct?: number } | null>('reader.pos.' + id, null);
  return { pct: pos && pos.pct ? Math.round(pos.pct * 100) : 0, started: !!pos };
}
function statusOf(pct: number): Status { return pct >= 99 ? 'done' : pct > 0 ? 'reading' : 'new'; }

/* The old layer keyed pins/categories by "title|author" before it used ids; move any left over. */
function migrateLegacy(metas: ReaderBookMeta[]): void {
  let changed = false;
  for (const m of metas) {
    const legacy = (m.title || '') + '|' + (m.author || (m.type || '').toUpperCase());
    if (data.pins[legacy]) { data.pins[m.id] = true; delete data.pins[legacy]; changed = true; }
    if (data.cats[legacy]) { if (!data.cats[m.id]) data.cats[m.id] = data.cats[legacy]; delete data.cats[legacy]; changed = true; }
  }
  if (changed) saveData();
}

async function refresh(): Promise<void> {
  const R = reader();
  try {
    const metas = (await R.listBooks()).filter(m => !m.temp);
    loadError = null;
    data = loadData();
    migrateLegacy(metas);
    metas.sort((a, b) => (b.opened || b.added || 0) - (a.opened || a.added || 0));
    items = metas.map(meta => {
      const p = progress(meta.id);
      return { meta, pct: p.pct, started: p.started, status: statusOf(p.pct), pinned: !!data.pins[meta.id], cat: data.cats[meta.id] || '' };
    });
  } catch (e) {
    loadError = (e as Error).message || 'This browser blocked storage.';
    items = [];
  }
  loaded = true;
  render();
}

/* ---------- styles ---------- */

const CSS = `
#v2-library .lv-top{display:flex;align-items:center;gap:var(--v2-s3);max-width:var(--v2-max);margin:0 auto}
#v2-library .lv-name{flex:1;min-width:0}
#v2-library .lv-title{display:block;max-width:100%;min-height:var(--v2-tap);padding:0;border:0;background:none;color:var(--v2-fg);cursor:pointer;text-align:left;
  font:italic 400 var(--v2-t-display)/1.05 var(--v2-serif);letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#v2-library .lv-sub{margin:2px 0 0;font:500 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted);font-variant-numeric:tabular-nums;min-height:1.3em}
#v2-library .lv-actions{display:flex;align-items:center;gap:var(--v2-s2);flex:none}

#v2-library .continue{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);gap:clamp(16px,2.6vw,26px);align-items:center;
  margin:var(--v2-s4) 0 var(--v2-s6);padding:clamp(14px,2.4vw,22px);border-radius:var(--v2-r-xl);background:var(--v2-surface);overflow:hidden}
#v2-library .continue::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;padding:1px;
  background:linear-gradient(120deg,transparent 30%,color-mix(in srgb,var(--v2-accent) 55%,transparent) 50%,transparent 70%) 0 0/250% 100%;
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:v2Shine 7s linear infinite}
@keyframes v2Shine{to{background-position:-250% 0}}
#v2-library .continue .cover{width:clamp(78px,12vw,118px)}
#v2-library .continue .kicker{font:600 11.5px/1 var(--v2-sans);letter-spacing:.06em;text-transform:uppercase;color:var(--v2-accent)}
#v2-library .continue .ttl{margin:6px 0 0;font:400 clamp(22px,3vw,30px)/1.1 var(--v2-serif);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#v2-library .continue .by{margin:4px 0 0;font:400 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#v2-library .continue .lv-row{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-s3);margin-top:var(--v2-s3)}
#v2-library .continue .pct{font:500 var(--v2-t-sm)/1 var(--v2-sans);color:var(--v2-muted);font-variant-numeric:tabular-nums}

#v2-library .lv-bar{display:block;height:4px;border-radius:4px;background:var(--v2-line);overflow:hidden}
#v2-library .lv-bar i{display:block;height:100%;border-radius:inherit;background:var(--v2-accent)}

#v2-library .toolbar{margin:0 0 var(--v2-s5)}
#v2-library .stats{margin:0 0 var(--v2-s3);font:500 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted);font-variant-numeric:tabular-nums}
#v2-library .filters{display:flex;gap:var(--v2-s2);overflow-x:auto;scrollbar-width:none;margin:0 calc(-1 * var(--v2-gutter));padding:2px var(--v2-gutter);scroll-padding:0 var(--v2-gutter)}
#v2-library .filters::-webkit-scrollbar{display:none}
#v2-library .filters .sep{flex:none;width:1px;margin:10px 2px;background:var(--v2-line)}

#v2-library .shelf{margin:0 0 var(--v2-s8)}
#v2-library .shelf h2,#v2-library .grid-h{margin:0 0 var(--v2-s3);font:400 var(--v2-t-xl)/1.1 var(--v2-serif)}
#v2-library .shelf-row{display:flex;gap:var(--v2-s3);overflow-x:auto;scrollbar-width:none;margin:0 calc(-1 * var(--v2-gutter));padding:2px var(--v2-gutter) 6px}
#v2-library .shelf-row::-webkit-scrollbar{display:none}
#v2-library .fcard{flex:0 0 260px;display:flex;flex-direction:column;gap:4px;padding:var(--v2-s4);border-radius:var(--v2-r-lg);background:var(--v2-surface);box-sizing:border-box}
#v2-library .fcard>b{font:400 21px/1.15 var(--v2-serif)}
#v2-library .fcard>span{font:500 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted)}
#v2-library .fcard>small{font:400 var(--v2-t-xs)/1.4 var(--v2-sans);color:var(--v2-muted);flex:1}
#v2-library .fcard .lv-acts{display:flex;flex-wrap:wrap;gap:var(--v2-s2);margin-top:var(--v2-s3)}

#v2-library .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 16px;margin:0;padding:0;list-style:none}
@media (min-width:560px){#v2-library .grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:30px 22px}}
@media (min-width:840px){#v2-library .grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:34px 26px}}
@media (min-width:1120px){#v2-library .grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:38px 30px}}
#v2-library .lv-card{min-width:0;display:flex;flex-direction:column}

#v2-library .cover{position:relative;display:block;width:100%;aspect-ratio:2/3;padding:0;border:0;overflow:hidden;cursor:pointer;
  border-radius:4px 9px 9px 4px;background:var(--v2-surface);color:#fff;
  box-shadow:0 1px 1px rgba(0,0,0,.10),0 6px 14px -6px rgba(0,0,0,.35),0 16px 26px -18px rgba(0,0,0,.5),0 18px 40px -24px hsl(var(--h,220) 70% 50% / .55);
  transition:transform var(--v2-d-slow) var(--v2-ease),box-shadow var(--v2-d-slow) var(--v2-ease)}
#v2-library .cover>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
#v2-library .cover .gen-cover{position:absolute;inset:0;padding:16px 14px 14px 18px;text-align:left}
#v2-library .cover .gen-cover b{font-size:16px;line-height:1.18}
#v2-library .cover .spine,#v2-library .cover .gloss{position:absolute;pointer-events:none}
#v2-library .cover .spine{left:0;top:0;bottom:0;width:7px;background:linear-gradient(90deg,rgba(0,0,0,.34),rgba(255,255,255,.16) 55%,rgba(0,0,0,0))}
#v2-library .cover .gloss{inset:0;background:linear-gradient(118deg,rgba(255,255,255,.2),rgba(255,255,255,0) 42%)}
#v2-library .cover .badge{position:absolute;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:12px;pointer-events:none;
  box-shadow:0 2px 6px rgba(0,0,0,.3)}
#v2-library .cover .badge .v2-icon{width:14px;height:14px;stroke-width:2.6}
#v2-library .cover .badge.done{top:8px;right:8px;background:var(--v2-accent);color:#fff}
#v2-library .cover .badge.pin{top:8px;left:12px;background:#ffd60a;color:#5c4400}
#v2-library .lv-card.pinned .cover{box-shadow:0 0 0 2px #ffd60a,0 8px 22px rgba(0,0,0,.14)}
#v2-library .cover:active{transform:scale(.97)}
@media (hover:hover){#v2-library .cover:hover{transform:translateY(-4px)}}

#v2-library .prog{display:flex;align-items:center;gap:var(--v2-s2);margin-top:10px;min-height:14px}
#v2-library .prog .lv-bar{flex:1;height:3px}
#v2-library .prog span{font:600 11px/1 var(--v2-sans);color:var(--v2-muted);letter-spacing:.01em;font-variant-numeric:tabular-nums}
#v2-library .lv-card[data-status="new"] .prog span{color:var(--v2-accent)}
#v2-library .foot{display:flex;align-items:flex-start;gap:2px;margin-top:6px}
#v2-library .foot .txt{flex:1;min-width:0;padding-top:4px}
#v2-library .foot b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:calc(2 * 1.25em);font:400 18px/1.25 var(--v2-serif)}
#v2-library .foot small{display:block;margin-top:2px;font:400 12.5px/1.35 var(--v2-sans);color:var(--v2-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:1.35em}
#v2-library .foot .v2-ibtn{margin-right:-10px;color:var(--v2-muted)}

#v2-library .none{display:flex;flex-direction:column;align-items:center;gap:var(--v2-s3);margin:var(--v2-s8) 0;font:400 var(--v2-t-base)/1.4 var(--v2-sans);color:var(--v2-muted);text-align:center}
#v2-library .note{margin:var(--v2-s10) 0 0;font:400 12.5px/1.6 var(--v2-sans);color:var(--v2-muted)}

/* book editor. It carries .ml-sheet only so fixes/covers.js can find it; fixes/ui-motion.js also animates
   .ml-sheet, and that animation's end state would overwrite the dialog's centring transform. */
#v2-portal .ml-sheet{animation:none!important}
.v2-ed-cover{display:flex;gap:var(--v2-s4);align-items:center}
.v2-ed-preview{width:84px;height:126px;flex:none;border-radius:4px 8px 8px 4px;background:var(--v2-surface);overflow:hidden;display:flex;align-items:center;justify-content:center;
  font:400 36px/1 var(--v2-serif);color:var(--v2-muted)}
.v2-ed-preview img{width:100%;height:100%;object-fit:cover;display:block}
.v2-ed-cover .btns{display:flex;flex-direction:column;gap:var(--v2-s2);flex:1;min-width:0}
.v2-ed-cats{display:flex;flex-wrap:wrap;gap:var(--v2-s2);margin-top:var(--v2-s2)}
.v2-ed-newcat{display:flex;gap:var(--v2-s2);margin-top:var(--v2-s3)}
.v2-ed-newcat .v2-input{flex:1;min-width:0}
.v2-sub{margin:var(--v2-s5) 0 0;font:500 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted)}
.v2-cat-rename{display:flex;gap:var(--v2-s2);align-items:center;width:100%}
.v2-cat-rename .v2-input{flex:1;min-width:0}

@media (prefers-reduced-motion:reduce){#v2-library .continue::after{animation:none}#v2-library .cover{transition:none}}
`;

/* ---------- helpers ---------- */

function hueOf(s: string): number { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 360; return x; }

/** Cover artwork: the stored cover image, or the engine's generated cover. */
function coverInner(m: ReaderBookMeta): string {
  if (m.coverBuf) {
    const u = URL.createObjectURL(new Blob([m.coverBuf], { type: m.coverType || 'image/jpeg' }));
    coverUrls.push(u);
    return `<img src="${u}" alt="">`;
  }
  return reader().coverHtml(m);
}

function openFrom(el: HTMLElement, id: string): void {
  const fly = window.__marginaliaBookOpenFly;
  if (fly) void fly(el, id); else void reader().openBook(id);
}

/* ---------- render ---------- */

function counts(): Record<string, number> {
  const c: Record<string, number> = { all: items.length, reading: 0, new: 0, done: 0, pinned: 0 };
  for (const it of items) { c[it.status]++; if (it.pinned) c.pinned++; if (it.cat) c['cat:' + it.cat] = (c['cat:' + it.cat] || 0) + 1; }
  return c;
}
function matches(it: Item): boolean {
  if (filter === 'all') return true;
  if (filter === 'pinned') return it.pinned;
  if (filter.startsWith('cat:')) return it.cat === filter.slice(4);
  return it.status === filter;
}

function renderTop(): void {
  const R = reader();
  const title = h('button', { type: 'button', class: 'lv-title', title: 'Tap to change your name', 'aria-label': R.libraryTitle() + '. Change your name', text: R.libraryTitle() });
  title.addEventListener('click', () => R.editName());
  const sub = h('p', { class: 'lv-sub', text: items.length ? items.length + (items.length === 1 ? ' book' : ' books') : '' });
  shell.top.replaceChildren(h('div', { class: 'lv-top' },
    h('div', { class: 'lv-name' }, h('h1', { class: 'v2-sr', text: 'Library' }), title, sub),
    h('div', { class: 'lv-actions' },
      Button({ label: 'Discover', icon: 'search', hideLabelBelow: 640, attrs: { 'data-catalog-open': '' } }),
      IconButton({ label: 'More', icon: 'more', filled: true, onClick: () => R.openMore('library') }),
      Button({ label: 'Import', icon: 'plus', variant: 'primary', hideLabelBelow: 420, onClick: () => R.pickFiles() })
    )));
}

function renderContinue(): HTMLElement | null {
  const it = items.find(x => x.status === 'reading');
  if (!it) return null;
  const cover = h('div', { class: 'cover', 'aria-hidden': 'true', html: coverInner(it.meta) });
  cover.append(h('span', { class: 'spine' }), h('span', { class: 'gloss' }));
  cover.style.setProperty('--h', String(hueOf(it.meta.title || '')));
  return h('section', { class: 'continue', 'aria-label': 'Continue reading' }, cover,
    h('div', {},
      h('span', { class: 'kicker', text: 'Continue reading' }),
      h('h2', { class: 'ttl', text: it.meta.title }),
      h('p', { class: 'by', text: it.meta.author || '' }),
      h('span', { class: 'lv-bar', style: 'margin-top:12px', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.max(2, Math.min(100, it.pct))}%` })),
      h('div', { class: 'lv-row' },
        h('span', { class: 'pct', text: it.pct + '% read' }),
        Button({ label: 'Resume', icon: 'play', variant: 'primary', attrs: { 'aria-label': 'Resume ' + it.meta.title }, onClick: () => openFrom(cover, it.meta.id) }))));
}

function renderToolbar(): HTMLElement {
  const c = counts();
  const chip = (f: Filter, label: string, icn?: 'star' | 'tag') => Chip({ label, count: c[f] || 0, icon: icn, pressed: filter === f, onClick: () => { filter = f; render(); } });
  const chips: HTMLElement[] = [chip('all', 'All'), chip('reading', 'Reading'), chip('new', 'New'), chip('done', 'Finished')];
  const cats = allCats();
  if (c.pinned || cats.length) chips.push(h('span', { class: 'sep', 'aria-hidden': 'true' }));
  if (c.pinned) chips.push(chip('pinned', 'Pinned', 'star'));
  for (const cat of cats) chips.push(chip(`cat:${cat}`, cat));
  chips.push(Chip({ label: 'Categories', icon: 'tag', onClick: openCategories }));
  return h('div', { class: 'toolbar' },
    h('p', { class: 'stats', 'aria-live': 'polite', text: `${c.all} ${c.all === 1 ? 'book' : 'books'} · ${c.reading} in progress · ${c.done} finished` }),
    h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter books' }, ...chips));
}

function renderShelf(): HTMLElement | null {
  if (filter !== 'all') return null;
  const have = new Set(items.map(i => i.meta.gid).filter(Boolean));
  const titles = new Set(items.map(i => (i.meta.title || '').toLowerCase()));
  const list = featured.filter(f => !have.has(Number(f.id)) && !titles.has(String(f.title).toLowerCase()));
  if (!list.length) return null;
  return h('section', { class: 'shelf', 'aria-label': 'Start here' }, h('h2', { text: 'Start here' }),
    h('div', { class: 'shelf-row' }, ...list.map(f => {
      const save = Button({ label: 'Save to device', icon: 'download', variant: 'primary' });
      save.addEventListener('click', () => void saveFeatured(f, save));
      // .ml-fcard + <b>/<span> + gutenberg link: fixes/read-on-site.js picks this up and opens it in the reader.
      const read = h('a', { class: 'v2-btn', href: `https://www.gutenberg.org/ebooks/${Number(f.id)}.html.images`, target: '_blank', rel: 'noopener' }, icon('globe'), h('span', { text: 'Read on site' }));
      return h('article', { class: 'fcard ml-fcard' }, h('b', { text: f.title }), h('span', { text: (f.authors || []).join(', ') }),
        h('small', { text: f.note || '' }), h('div', { class: 'lv-acts' }, save, read));
    })));
}

function renderCard(it: Item): HTMLElement {
  const m = it.meta;
  const cover = h('button', { type: 'button', class: 'cover', 'aria-label': 'Open ' + m.title, html: coverInner(m) });
  cover.style.setProperty('--h', String(hueOf(m.title || '')));
  cover.append(h('span', { class: 'spine' }), h('span', { class: 'gloss' }));
  if (it.status === 'done') { const b = h('span', { class: 'badge done', title: 'Finished' }); b.appendChild(icon('check')); cover.appendChild(b); }
  if (it.pinned) { const b = h('span', { class: 'badge pin', title: 'Pinned' }); b.appendChild(icon('star-fill')); cover.appendChild(b); }
  const img = cover.querySelector('img');
  if (img) img.addEventListener('error', () => { img.outerHTML = reader().coverHtml(m); });
  cover.addEventListener('click', () => openFrom(cover, m.id));
  const more = IconButton({ label: 'Options for ' + m.title, icon: 'more', attrs: { 'aria-haspopup': 'menu', 'aria-expanded': 'false' } });
  more.addEventListener('click', () => Menu(more, [
    { label: 'Edit details', icon: 'edit', onSelect: () => openEditor(m.id) },
    { label: it.pinned ? 'Unpin' : 'Pin to top', icon: 'star', onSelect: () => { togglePin(m.id); } },
    'separator',
    { label: 'Delete book', icon: 'trash', danger: true, onSelect: () => void reader().deleteBook(m.id) }
  ], 'Options for ' + m.title));
  return h('li', { class: 'lv-card' + (it.pinned ? ' pinned' : ''), 'data-status': it.status, 'data-id': m.id },
    cover,
    h('div', { class: 'prog', 'aria-label': it.started ? it.pct + '% read' : 'New' },
      h('span', { class: 'lv-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${it.pct}%` })),
      h('span', { 'aria-hidden': 'true', text: it.started ? it.pct + '%' : 'New' })),
    h('div', { class: 'foot' },
      h('div', { class: 'txt' }, h('b', { text: m.title }), h('small', { text: m.author || (m.type || '').toUpperCase() })),
      more));
}

function render(): void {
  coverUrls.forEach(u => URL.revokeObjectURL(u)); coverUrls = [];
  renderTop();
  if (!loaded) { shell.inner.replaceChildren(); return; }
  const R = reader();
  const out: (HTMLElement | null)[] = [];
  if (loadError) {
    out.push(EmptyState({ error: true, title: 'Couldn’t read your library', text: loadError,
      actions: [Button({ label: 'Try again', icon: 'refresh', variant: 'primary', onClick: () => void refresh() })] }));
  } else if (!items.length) {
    out.push(EmptyState({ title: 'Your library is empty', text: 'Import an EPUB, PDF, TXT or HTML file from your device. Books stay on this device only.', actions: [
      Button({ label: 'Import a book', icon: 'upload', variant: 'primary', block: true, onClick: () => R.pickFiles() }),
      Button({ label: 'Discover public-domain books', icon: 'search', block: true, attrs: { 'data-catalog-open': '' } }),
      Button({ label: 'Open the sample book', icon: 'book', block: true, onClick: () => void R.openSample() })
    ] }));
    out.push(renderShelf());
  } else {
    if (filter.startsWith('cat:') && !allCats().includes(filter.slice(4))) filter = 'all';
    out.push(renderContinue(), renderToolbar(), renderShelf());
    const shown = items.filter(matches).sort((a, b) => Number(b.pinned) - Number(a.pinned));
    if (shown.length) {
      out.push(h('h2', { class: 'v2-sr', text: 'Books' }));
      out.push(h('ul', { class: 'grid', 'aria-label': 'Books' }, ...shown.map(renderCard)));
    } else {
      out.push(h('div', { class: 'none' }, h('span', { text: 'No books in this filter yet.' }),
        Button({ label: 'Show all books', onClick: () => { filter = 'all'; render(); } })));
    }
  }
  out.push(h('p', { class: 'note', text: 'EPUB, PDF, TXT and HTML open here directly. Kindle (AZW3, KPF, MOBI) and Word (DOCX) files need converting to EPUB first, for example with the free app Calibre.' }));
  shell.inner.replaceChildren(...out.filter((x): x is HTMLElement => !!x));
  if (firstPaint && !reduceMotion()) {
    shell.inner.querySelectorAll<HTMLElement>('.continue, .lv-card').forEach((el, i) =>
      el.animate([{ opacity: 0, transform: 'translate3d(0,12px,0)' }, { opacity: 1, transform: 'none' }],
        { duration: 420, delay: Math.min(i, 8) * 35, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  }
  if (items.length || loadError) firstPaint = false;
}

/* ---------- actions ---------- */

function togglePin(id: string): void {
  if (data.pins[id]) delete data.pins[id]; else data.pins[id] = true;
  saveData();
  void refresh();
}

/* Saves a Project Gutenberg EPUB into this device's library (same behaviour and storage as fixes/library.js). */
async function saveBook(b: { id: number; title: string; authors?: string[]; epub: string }): Promise<void> {
  const R = reader();
  const existing = await R.listBooks();
  if (existing.some(m => m.gid === b.id && !m.temp)) { showToast('Already on this device'); return; }
  // Same order as fixes/read-on-site.js: the Worker's /book route first (Gutenberg's own download
  // redirect has no CORS header, so browsers usually block it), then the direct link.
  const urls: string[] = [];
  const proxy = R.edgeProxyUrl();
  if (proxy) urls.push(proxy + '/book?id=' + Number(b.id));
  urls.push(b.epub);
  let buf: ArrayBuffer | null = null, status = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) { status = res.status; continue; }
      const data = await res.arrayBuffer();
      const head = new Uint8Array(data, 0, 2);
      if (head[0] === 0x50 && head[1] === 0x4B) { buf = data; break; }
    } catch { /* blocked by the browser: try the next address */ }
  }
  if (!buf) {
    throw new Error(proxy
      ? 'Could not download this book' + (status ? ' (HTTP ' + status + ')' : '') + '. Check your connection and try again.'
      : 'The browser blocked the download. Add your Cloudflare Worker address in Settings › Audio (it also downloads books), or use “Read on site”.');
  }
  await R.storeBook({ id: 'g' + b.id, type: 'epub', name: b.title + '.epub', size: buf.byteLength, split: true,
    title: b.title, author: (b.authors || []).join(', '), added: Date.now(), opened: 0, gid: b.id }, buf);
  showToast('Saved to this device');
}

async function saveFeatured(f: Featured, btn: HTMLButtonElement): Promise<void> {
  const label = btn.querySelector('span');
  btn.disabled = true; if (label) label.textContent = 'Saving…';
  try {
    await saveBook({ id: Number(f.id), title: f.title, authors: f.authors || [], epub: 'https://www.gutenberg.org/ebooks/' + Number(f.id) + '.epub.noimages' });
  } catch (e) {
    btn.disabled = false; if (label) label.textContent = 'Save to device';
    showToast((e as Error).message || 'Could not save this book.');
  }
}

/* Any picture becomes a small JPEG so the library stays light. */
async function toJpeg(file: Blob): Promise<{ buf: ArrayBuffer; type: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const k = Math.min(1, 600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    const g = c.getContext('2d'); if (!g) throw new Error('no canvas');
    g.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.85));
    if (!blob) throw new Error('no image');
    return { buf: await blob.arrayBuffer(), type: 'image/jpeg' };
  } finally { URL.revokeObjectURL(url); }
}

function addCategory(name: string): string {
  const n = name.trim().slice(0, 30);
  if (!n) return '';
  if (!data.custom.includes(n)) data.custom.push(n);
  saveData();
  return n;
}

/* Book editor. Field ids (#mlTitle, #mlAuthor, #mlFile), .ml-cover-row and aria-label "Edit book" on an
   .ml-sheet are kept on purpose: fixes/covers.js adds its ready-made cover designs to this editor. */
async function openEditor(id: string): Promise<void> {
  const R = reader();
  const m = await R.getBook(id).catch(() => undefined);
  if (!m) { showToast('This book can’t be edited right now.'); return; }
  let picked = data.cats[id] || '', newCover: { buf: ArrayBuffer; type: string } | null = null, removeCover = false;
  let previewUrl = '';

  const preview = h('div', { class: 'v2-ed-preview', id: 'mlCov', 'aria-hidden': 'true' });
  const paintCover = () => {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
    const src = newCover || (m.coverBuf && !removeCover ? { buf: m.coverBuf, type: m.coverType || 'image/jpeg' } : null);
    if (src) { previewUrl = URL.createObjectURL(new Blob([src.buf], { type: src.type })); preview.replaceChildren(h('img', { src: previewUrl, alt: '' })); }
    else preview.replaceChildren(h('span', { text: (m.title || '?').trim().charAt(0).toUpperCase() }));
  };
  const file = h('input', { type: 'file', id: 'mlFile', accept: 'image/*', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0]; if (!f) return;
    try { newCover = await toJpeg(f); removeCover = false; paintCover(); } catch { showToast('That picture could not be used.'); }
  });
  const coverRow = h('div', { class: 'v2-ed-cover ml-cover-row' }, preview,
    h('div', { class: 'btns' },
      Button({ label: 'Change cover', icon: 'image', onClick: () => file.click() }),
      Button({ label: 'Remove cover', variant: 'ghost', onClick: () => { newCover = null; removeCover = true; paintCover(); } })),
    file);
  const title = Field({ label: 'Title', value: m.title || '', id: 'mlTitle', maxlength: 200 });
  const author = Field({ label: 'Author', value: m.author || '', id: 'mlAuthor', placeholder: 'Unknown', maxlength: 200 });
  const pin = Toggle({ label: 'Pin to top', checked: !!data.pins[id] });
  const catsBox = h('div', { class: 'v2-ed-cats', role: 'group', 'aria-label': 'Category' });
  const paintCats = () => {
    catsBox.replaceChildren(
      Chip({ label: 'None', pressed: !picked, onClick: () => { picked = ''; paintCats(); } }),
      ...allCats().map(c => Chip({ label: c, pressed: picked === c, onClick: () => { picked = c; paintCats(); } })));
  };
  const newCat = Field({ label: 'New category', placeholder: 'For example: Philosophy', maxlength: 30 });
  const addCat = () => { const n = addCategory(newCat.input.value); if (n) { picked = n; newCat.input.value = ''; paintCats(); } };
  newCat.input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } });
  paintCover(); paintCats();

  const save = async () => {
    const t = title.input.value.trim().slice(0, 200);
    if (!t) { showToast('A book needs a title.'); title.input.focus(); return; }
    try {
      data.pins = loadData().pins; data.cats = loadData().cats;
      if (pin.checked) data.pins[id] = true; else delete data.pins[id];
      if (picked) data.cats[id] = picked; else delete data.cats[id];
      saveData();
      await R.updateBook(id, { title: t, author: author.input.value.trim().slice(0, 200),
        ...(newCover ? { coverBuf: newCover.buf, coverType: newCover.type } : removeCover ? { removeCover: true } : {}) });
      sheet.close();
      showToast('Changes saved');
    } catch { showToast('Could not save changes.'); }
  };
  const sheet = Sheet({
    title: 'Edit book', label: 'Edit book', className: 'ml-sheet',
    content: [coverRow, title.el, author.el, pin, h('p', { class: 'v2-sub', text: 'Category' }), catsBox,
      h('div', { class: 'v2-ed-newcat' }, newCat.input, Button({ label: 'Add', icon: 'plus', onClick: addCat }))],
    footer: [Button({ label: 'Cancel', onClick: () => sheet.close() }), Button({ label: 'Save', variant: 'primary', onClick: () => void save() })],
    onClose: () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }
  });
  newCat.input.setAttribute('aria-label', 'New category name');
}

function openCategories(): void {
  const list = h('div', { role: 'list' });
  const draw = () => {
    const cats = allCats();
    if (!cats.length) { list.replaceChildren(h('p', { class: 'v2-hint', text: 'No categories yet. Add one below, or pick one in a book’s Edit details.' })); return; }
    list.replaceChildren(...cats.map(c => {
      const n = items.filter(i => i.cat === c).length;
      const row = ListItem({ title: c, subtitle: n + (n === 1 ? ' book' : ' books'), icon: 'tag', trailing: [
        IconButton({ label: 'Rename ' + c, icon: 'edit', onClick: () => rename(row, c) }),
        IconButton({ label: 'Delete ' + c, icon: 'trash', onClick: () => void remove(c) })
      ] });
      row.setAttribute('role', 'listitem');
      return row;
    }));
  };
  const rename = (row: HTMLElement, old: string) => {
    const f = Field({ label: 'Rename ' + old, value: old, maxlength: 30 });
    const ok = () => {
      const next = f.input.value.trim().slice(0, 30);
      if (!next || next === old) { draw(); return; }
      if (allCats().includes(next)) { showToast('That category already exists.'); return; }
      data.custom = data.custom.map(c => c === old ? next : c);
      if (!data.custom.includes(next)) data.custom.push(next);
      Object.keys(data.cats).forEach(k => { if (data.cats[k] === old) data.cats[k] = next; });
      if (filter === `cat:${old}`) filter = `cat:${next}`;
      saveData(); void refresh().then(draw);
    };
    f.input.setAttribute('aria-label', 'New name for ' + old);
    f.input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } if (e.key === 'Escape') { e.stopPropagation(); draw(); } });
    row.replaceChildren(h('div', { class: 'v2-cat-rename' }, f.input, Button({ label: 'Save', variant: 'primary', onClick: ok })));
    f.input.focus(); f.input.select();
  };
  const remove = async (name: string) => {
    if (!(await confirmSheet({ title: 'Delete “' + name + '”?', text: 'Books stay in your library. Only the label is removed.', confirm: 'Delete category', danger: true }))) return;
    data.custom = data.custom.filter(c => c !== name);
    Object.keys(data.cats).forEach(k => { if (data.cats[k] === name) delete data.cats[k]; });
    if (filter === `cat:${name}`) filter = 'all';
    saveData(); void refresh().then(draw);
  };
  const add = Field({ label: 'New category', placeholder: 'For example: Read later', maxlength: 30 });
  const doAdd = () => { if (addCategory(add.input.value)) { add.input.value = ''; draw(); render(); } };
  add.input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
  draw();
  Sheet({
    title: 'Categories',
    content: [list, h('div', { class: 'v2-ed-newcat' }, add.input, Button({ label: 'Add', icon: 'plus', onClick: doAdd })),
      h('p', { class: 'v2-hint', text: 'Deleting a category only removes the label. Books stay in your library.' })],
    onClose: () => render()
  });
  add.input.setAttribute('aria-label', 'New category name');
}

/* ---------- mount ---------- */

export function mountLibrary(): void {
  addStyle('v2-library', CSS);
  shell = AppShell('v2-library', 'Library');
  shell.root.appendChild(h('div', { class: 'v2-drop', 'aria-hidden': 'true', text: 'Drop to import' }));
  const engineLib = document.getElementById('library');
  if (engineLib && engineLib.parentNode) engineLib.parentNode.insertBefore(shell.root, engineLib.nextSibling);
  else document.body.prepend(shell.root);
  setAppRoots(() => [shell.root]);

  // Discover keeps working: catalog-paging.js saves books through this.
  window.__marginaliaSaveBook = saveBook;

  const R = reader();
  const syncScreen = (screen: string) => { shell.root.hidden = screen !== 'library'; };
  syncScreen(R.App.screen);
  document.addEventListener('reader:screen', e => { syncScreen(e.detail.screen); if (e.detail.screen === 'library') void refresh(); });
  document.addEventListener('reader:library', () => void refresh());
  document.addEventListener('reader:name', () => renderTop());

  fetch('featured.json', { cache: 'no-cache' })
    .then(r => r.json() as Promise<{ featured?: Featured[] }>)
    .then(j => { featured = Array.isArray(j.featured) ? j.featured : []; render(); })
    .catch(() => { /* Start here is optional */ });
  void refresh();
}
