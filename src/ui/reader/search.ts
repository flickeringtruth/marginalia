/* Search in book (v2 only).
   - Searches every chapter, not just the open one, ignoring case and accents ("Etude" finds
     "Étude"). Text comes from the engine's book.getChapter(); each chapter is normalised once per
     book and kept in memory with a map back to the original offsets.
   - Stays responsive on long books: one chapter at a time, yielding to the main thread between
     chapters, and a new query cancels the running search.
   - Tapping a result jumps there (App.goTo with the character offset) and highlights the match with
     the CSS Custom Highlight API (no change to the book's DOM); browsers without it get a temporary
     <mark>. A small bar steps to the previous/next match. */

import { h, addStyle, reader } from '../dom.js';
import { IconButton, Sheet, SheetHandle } from '../components.js';
import { portalRoot } from '../overlay.js';

interface Norm { text: string; norm: string; map: Uint32Array | null }   // map: normalised index → original index (null = same)
interface Hit { ch: number; start: number; end: number }

const MAX_HITS = 1000;
const CSS = `
.v2-search .v2-input{margin-bottom:var(--v2-s2)}
.v2-search .sstat{margin:0 0 var(--v2-s3);font:500 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted)}
.v2-search h4{margin:var(--v2-s4) 0 4px;font:600 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted)}
.v2-search .hit{display:block;width:100%;min-height:var(--v2-tap);padding:8px;border:0;border-radius:var(--v2-r-sm);background:none;color:var(--v2-fg);text-align:left;cursor:pointer;
  font:400 15px/1.45 var(--v2-serif)}
.v2-search .hit:hover{background:var(--v2-surface)}
.v2-search .hit mark{background:color-mix(in srgb,var(--v2-accent) 30%,transparent);color:inherit;border-radius:2px;padding:0 1px}
::highlight(v2-find){background-color:rgba(255,190,0,.55);color:inherit}
mark.v2-find{background:rgba(255,190,0,.55);color:inherit}
.v2-findbar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--sab) + var(--v2-bot-h,64px) + 8px);z-index:var(--z-bars);display:flex;align-items:center;gap:2px;
  padding:4px;border-radius:26px;background:var(--v2-sheet);box-shadow:var(--v2-shadow-2);font-family:var(--v2-sans);max-width:calc(100vw - 16px);box-sizing:border-box}
body.audio-on .v2-findbar{bottom:calc(var(--sab) + var(--v2-bot-h,64px) + var(--v2-mini-h,60px) + 8px)}
.v2-findbar[hidden]{display:none}
.v2-findbar .count{min-width:72px;text-align:center;font:600 var(--v2-t-sm)/1 var(--v2-sans);font-variant-numeric:tabular-nums;white-space:nowrap}
`;

/* ---------- normalisation ---------- */

const MARKS = /\p{M}/gu;
function normalize(text: string): Norm {
  let norm = '', map: number[] | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], code = c.charCodeAt(0);
    let n: string;
    if (code < 128) n = code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : c;   // fast path
    else n = c.normalize('NFD').replace(MARKS, '').toLowerCase();
    if (n.length !== 1 && !map) { map = []; for (let k = 0; k < norm.length; k++) map.push(k); }   // positions shift from here
    if (map) for (let k = 0; k < n.length; k++) map.push(i);
    norm += n;
  }
  return { text, norm, map: map ? Uint32Array.from(map) : null };
}
const normQuery = (q: string) => q.normalize('NFD').replace(MARKS, '').toLowerCase().replace(/\s+/g, ' ').trim();
const orig = (n: Norm, i: number) => (n.map ? (i < n.map.length ? n.map[i] : n.text.length) : i);

let cacheBook = '';
const cache = new Map<number, Norm>();
async function chapterText(ch: number): Promise<Norm> {
  const R = reader(), b = R.App.book!;
  if (cacheBook !== b.id) { cache.clear(); cacheBook = b.id; }
  let n = cache.get(ch);
  if (!n) { n = normalize((await b.getChapter(ch)).textContent || ''); cache.set(ch, n); }
  return n;
}
/* Give the main thread a turn once ~12 ms of work have passed (yielding after every chapter would
   add a 4 ms timer clamp per chapter: 1.5 s on a 367-chapter book). */
let sliceStart = 0;
const yieldToMain = async (): Promise<void> => {
  if (performance.now() - sliceStart < 12) return;
  await new Promise<void>(res => setTimeout(res, 0));
  sliceStart = performance.now();
};

/* ---------- highlight + match bar ---------- */

let hits: Hit[] = [], current = -1;
let bar: HTMLElement | null = null, barCount: HTMLElement | null = null;
let fallbackMarks: HTMLElement[] = [];

function clearHighlight(): void {
  const hl = (CSS_ as unknown as { highlights?: Map<string, unknown> }).highlights;
  if (hl) hl.delete('v2-find');
  fallbackMarks.forEach(m => { const p = m.parentNode; if (!p) return; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); });
  fallbackMarks = [];
}
const CSS_ = (window as unknown as { CSS?: unknown }).CSS;

function rangeFor(root: Element, start: number, end: number): Range | null {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let pos = 0, n: Node | null, range: Range | null = null;
  while ((n = w.nextNode())) {
    const len = (n.nodeValue || '').length;
    if (!range && start < pos + len) { range = document.createRange(); range.setStart(n, Math.max(0, start - pos)); }
    if (range && end <= pos + len) { range.setEnd(n, Math.max(0, end - pos)); return range; }
    pos += len;
  }
  return null;
}

function highlight(hit: Hit): void {
  clearHighlight();
  const roots = Array.from(document.querySelectorAll(`#viewport .chap[data-ch="${hit.ch}"], #scroller .chap[data-ch="${hit.ch}"]`));
  for (const root of roots) {
    const range = rangeFor(root, hit.start, hit.end);
    if (!range) continue;
    const Hl = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    const reg = (CSS_ as { highlights?: Map<string, unknown> } | undefined)?.highlights;
    if (Hl && reg) { reg.set('v2-find', new Hl(range)); return; }
    try { const m = document.createElement('mark'); m.className = 'v2-find'; range.surroundContents(m); fallbackMarks.push(m); } catch { /* match crosses elements: skip the mark */ }
    return;
  }
}

async function show(i: number): Promise<void> {
  if (!hits.length) return;
  current = (i + hits.length) % hits.length;
  const hit = hits[current], R = reader();
  if (barCount) barCount.textContent = (current + 1) + ' of ' + hits.length + (hits.length >= MAX_HITS ? '+' : '');
  const r = R.App.r; for (let k = 0; k < 60 && r && r.busy; k++) await new Promise(res => setTimeout(res, 50));
  await R.App.goTo({ ch: hit.ch, off: hit.start, frac: 0 });
  requestAnimationFrame(() => highlight(hit));
  setTimeout(() => highlight(hit), 250);   // after the page has settled
}

function closeBar(): void { if (bar) bar.hidden = true; clearHighlight(); }

function ensureBar(open: () => void): void {
  if (bar) return;
  barCount = h('span', { class: 'count', 'aria-live': 'polite' });
  bar = h('div', { class: 'v2-findbar v2', role: 'toolbar', 'aria-label': 'Search matches', hidden: true },
    IconButton({ label: 'Previous match', icon: 'chevron-left', onClick: () => void show(current - 1) }),
    barCount,
    IconButton({ label: 'Next match', icon: 'chevron-right', onClick: () => void show(current + 1) }),
    IconButton({ label: 'Back to search results', icon: 'search', onClick: open }),
    IconButton({ label: 'Close search', icon: 'close', onClick: closeBar }));
  portalRoot().appendChild(bar);
  document.addEventListener('reader:screen', e => { if (e.detail.screen !== 'reader') closeBar(); });
}

/* ---------- sheet ---------- */

let lastQuery = '';
let run = 0;

export function openSearch(): void {
  addStyle('v2-search', CSS);
  const R = reader(), book = R.App.book;
  if (!book) return;
  if (book.type === 'pdf') { R.toast('Search works in EPUB, TXT and HTML books.'); return; }
  ensureBar(openSearch);
  const input = h('input', { class: 'v2-input', type: 'search', placeholder: 'Search this book', 'aria-label': 'Search this book', enterkeyhint: 'search', autocomplete: 'off', maxlength: 100 });
  input.value = lastQuery;
  const stat = h('p', { class: 'sstat', 'aria-live': 'polite' });
  const list = h('div');
  let sheet: SheetHandle;
  let timer = 0;

  const searchNow = async () => {
    const my = ++run, raw = input.value; lastQuery = raw;
    const q = normQuery(raw);
    list.replaceChildren(); hits = [];
    if (q.length < 2) { stat.textContent = q ? 'Type at least 2 characters.' : ''; return; }
    const n = book.chapters.length, found: Hit[] = [];
    let groupEl: HTMLElement | null = null, groupCh = -1;
    for (let ch = 0; ch < n; ch++) {
      if (my !== run) return;                               // a newer search started
      stat.textContent = 'Searching… chapter ' + (ch + 1) + ' of ' + n + (found.length ? ' · ' + found.length + ' found' : '');
      let t: Norm;
      try { t = await chapterText(ch); } catch { continue; }
      if (my !== run) return;
      let from = 0, idx: number;
      while ((idx = t.norm.indexOf(q, from)) >= 0 && found.length < MAX_HITS) {
        const start = orig(t, idx), end = orig(t, idx + q.length - 1) + 1;
        const hit: Hit = { ch, start, end }, i = found.length;
        found.push(hit);
        if (groupCh !== ch) {
          groupCh = ch;
          groupEl = h('section', { 'aria-label': reader().chapterTitle(ch) || 'Section ' + (ch + 1) }, h('h4', { text: reader().chapterTitle(ch) || 'Section ' + (ch + 1) }));
          list.appendChild(groupEl);
        }
        const a = Math.max(0, start - 50), z = Math.min(t.text.length, end + 70);
        const before = (a > 0 ? '…' : '') + t.text.slice(a, start).replace(/\s+/g, ' ').trimStart();
        const after = t.text.slice(end, z).replace(/\s+/g, ' ').trimEnd() + (z < t.text.length ? '…' : '');
        const btn = h('button', { type: 'button', class: 'hit' }, before, h('mark', { text: t.text.slice(start, end) }), after);
        btn.addEventListener('click', () => { hits = found; sheet.close(); if (bar) bar.hidden = false; void show(i); });
        groupEl!.appendChild(btn);
        from = idx + Math.max(1, q.length);
      }
      if (found.length >= MAX_HITS) break;
      await yieldToMain();                                  // keep the page responsive on long books
    }
    if (my !== run) return;
    hits = found;
    stat.textContent = found.length
      ? found.length + (found.length >= MAX_HITS ? '+ matches (showing the first ' + MAX_HITS + ')' : found.length === 1 ? ' match' : ' matches') + ' in ' + new Set(found.map(f => f.ch)).size + ' chapters'
      : 'No matches for “' + raw.trim() + '”.';
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(() => void searchNow(), 300); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); void searchNow(); } });
  sheet = Sheet({ title: 'Search in book', className: 'v2-search', content: [input, stat, list],
    onClose: () => { run++; } });
  if (input.value) void searchNow();
  input.select();
}
