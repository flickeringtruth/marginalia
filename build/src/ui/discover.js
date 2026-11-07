/* v2 Discover: search Project Gutenberg's public-domain books and add them to the library.
   Replaces the engine's #catalogSheet (build/book-catalog.js) and fixes/catalog-paging.js.

   Data source: Gutendex (https://gutendex.com), a free, keyless JSON API over the Project Gutenberg
   catalogue (CORS: *). One request per page of 32 books gives title, authors, languages, download
   count, cover image, summary and subjects. The old OPDS search needed one extra request per book.
   Filters kept from the old Discover, applied server-side:
     copyright=false                 → only books marked public domain in the USA (same rule as before)
     mime_type=application/epub+zip  → only books with an EPUB to import
   Sorting (documented at gutendex.com: sort = popular | ascending | descending, by downloads or ID):
     Popular → SERVER-SIDE (sort=popular, the default), so "Load more" continues the same order.
     Title / Author → CLIENT-SIDE over the books loaded so far; Gutendex has no title or author sort.
   Politeness: responses are cached in memory for the session, an in-flight request for the same URL
   is shared instead of repeated, typing is debounced, and a new search aborts the previous one.
   Import uses the library's existing path (window.__marginaliaSaveBook); "Read on site" uses
   fixes/read-on-site.js (window.__marginaliaReadOnSite). */
import { h, addStyle, reader, reduceMotion } from './dom.js';
import { icon } from './icons.js';
import { Button, IconButton, Segmented, Sheet, EmptyState, showToast } from './components.js';
import { openLayer } from './overlay.js';
import { attachFlux } from './flux.js';
const API = 'https://gutendex.com/books/';
const FILTERS = 'copyright=false&mime_type=' + encodeURIComponent('application/epub+zip');
const GUTENBERG_ORIGIN = 'https://www.gutenberg.org';
const OPDS_SEARCH = GUTENBERG_ORIGIN + '/ebooks/search.opds/';
const ATOM = 'http://www.w3.org/2005/Atom', DCTERMS = 'http://purl.org/dc/terms/';
const DEBOUNCE_MS = 400;
const GUTENDEX_TIMEOUT_MS = 8000; // Gutendex is volunteer-run and sometimes slow or down
const OPDS_TIMEOUT_MS = 20000;
/* ---------- data ---------- */
const cache = new Map(); // per session; also de-duplicates in-flight requests
function safeHttps(value, host) {
    if (!value)
        return null;
    try {
        const u = new URL(value, GUTENBERG_ORIGIN);
        return u.protocol === 'https:' && host.test(u.hostname) && !u.username ? u.href : null;
    }
    catch {
        return null;
    }
}
const GUTENBERG = /^(www\.)?gutenberg\.org$/;
function searchUrl(source, query) {
    if (source === 'gutendex')
        return API + '?' + FILTERS + (query ? '&search=' + encodeURIComponent(query) : '') + '&sort=popular';
    // Fallback: Project Gutenberg's own OPDS search (what Discover used before). sort_order=downloads
    // is the SERVER-SIDE popularity order of gutenberg.org's search (same parameter as its web search).
    return OPDS_SEARCH + '?' + (query ? 'query=' + encodeURIComponent(query) + '&' : '') + 'sort_order=downloads';
}
/* One fetch per URL per session. Aborting a caller does not cancel a shared request that another
   caller is still waiting for; it only stops that caller from using the result. */
function fetchText(url, signal, timeoutMs, accept) {
    let p = cache.get(url);
    if (!p) {
        const ctrl = new AbortController();
        const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
        p = fetch(url, { signal: ctrl.signal, headers: { Accept: accept } })
            .then(res => { if (!res.ok)
            throw new Error('The catalogue answered with HTTP ' + res.status + '.'); return res.text(); })
            .catch(e => { throw e.name === 'AbortError' ? new Error('The catalogue took too long to answer.') : e; })
            .finally(() => clearTimeout(timer));
        p.catch(() => cache.delete(url)); // failed requests may be retried
        cache.set(url, p);
    }
    return new Promise((resolve, reject) => {
        const onAbort = () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); };
        if (signal.aborted)
            return onAbort();
        signal.addEventListener('abort', onAbort, { once: true });
        p.then(v => { signal.removeEventListener('abort', onAbort); resolve(v); }, e => { signal.removeEventListener('abort', onAbort); reject(e); });
    });
}
function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror'))
        throw new Error('Project Gutenberg returned an invalid catalogue response.');
    return doc;
}
const atom = (el, name) => (el.getElementsByTagNameNS(ATOM, name)[0]?.textContent || '').trim();
async function fetchPage(source, url, signal) {
    if (source === 'gutendex') {
        const page = JSON.parse(await fetchText(url, signal, GUTENDEX_TIMEOUT_MS, 'application/json'));
        return { books: page.results.map(toBook).filter((b) => !!b), next: safeHttps(page.next || undefined, /^gutendex\.com$/) };
    }
    // OPDS search entries only carry id, title and author. Language, downloads, rights and the EPUB link
    // come from each book's own feed, which is fetched only when its details are opened (see verify()).
    const doc = parseXml(await fetchText(url, signal, OPDS_TIMEOUT_MS, 'application/atom+xml'));
    const books = [];
    for (const entry of Array.from(doc.getElementsByTagNameNS(ATOM, 'entry'))) {
        const sub = Array.from(entry.getElementsByTagNameNS(ATOM, 'link')).find(l => l.getAttribute('rel') === 'subsection');
        const m = (sub?.getAttribute('href') || '').match(/^\/ebooks\/(\d+)\.opds$/);
        const title = atom(entry, 'title');
        if (!m || !title)
            continue;
        const id = Number(m[1]);
        books.push({ id, title, authors: atom(entry, 'content') ? [atom(entry, 'content')] : [], languages: [], downloads: 0,
            cover: `${GUTENBERG_ORIGIN}/cache/epub/${id}/pg${id}.cover.medium.jpg`, epub: '', summary: '', subjects: [], verified: false });
    }
    const next = Array.from(doc.getElementsByTagNameNS(ATOM, 'link')).find(l => l.getAttribute('rel') === 'next');
    const nextUrl = safeHttps(next?.getAttribute('href') || undefined, GUTENBERG);
    return { books, next: nextUrl && new URL(nextUrl).pathname.startsWith('/ebooks/search.opds') ? nextUrl : null };
}
/* Checks a fallback result against its own feed: public domain in the USA, EPUB link, details. */
async function verify(b, signal) {
    const doc = parseXml(await fetchText(`${GUTENBERG_ORIGIN}/ebooks/${b.id}.opds`, signal, OPDS_TIMEOUT_MS, 'application/atom+xml'));
    const entry = doc.getElementsByTagNameNS(ATOM, 'entry')[0];
    if (!entry || !/^public domain in the usa\.?$/i.test(atom(entry, 'rights')))
        return null;
    const links = Array.from(entry.getElementsByTagNameNS(ATOM, 'link'));
    const epub = safeHttps(links.find(l => l.getAttribute('type') === 'application/epub+zip' && l.getAttribute('rel') === 'http://opds-spec.org/acquisition')?.getAttribute('href') || undefined, GUTENBERG);
    if (!epub)
        return null;
    const image = safeHttps(links.find(l => l.getAttribute('rel') === 'http://opds-spec.org/image')?.getAttribute('href') || undefined, GUTENBERG);
    const content = Array.from(entry.getElementsByTagNameNS(ATOM, 'content')).map(c => c.textContent || '').join(' ').replace(/\s+/g, ' ');
    const dl = content.match(/Downloads:\s*([\d,]+)/i);
    const summary = (content.match(/Summary:\s*(.+?)(?:\s+[A-Z][a-z]+:\s|$)/) || [])[1] || '';
    const authors = Array.from(entry.getElementsByTagNameNS(ATOM, 'author')).map(a => displayName(atom(a, 'name'))).filter(Boolean);
    return { ...b, epub, verified: true, cover: image || b.cover, authors: authors.length ? authors : b.authors,
        languages: Array.from(entry.getElementsByTagNameNS(DCTERMS, 'language')).map(l => (l.textContent || '').trim()).filter(Boolean),
        downloads: dl ? Number(dl[1].replace(/,/g, '')) : 0, summary: summary.trim(),
        subjects: Array.from(entry.getElementsByTagNameNS(ATOM, 'category')).filter(c => /LCSH/.test(c.getAttribute('scheme') || '')).map(c => c.getAttribute('term') || '').filter(Boolean).slice(0, 8) };
}
/* "Austen, Jane" → "Jane Austen" */
function displayName(n) { const m = n.match(/^([^,]+),\s*(.+)$/); return m ? m[2] + ' ' + m[1] : n; }
function toBook(b) {
    const epub = safeHttps(b.formats['application/epub+zip'], GUTENBERG);
    if (!epub || b.copyright !== false || !b.title)
        return null;
    return {
        id: b.id, title: b.title.trim(), authors: (b.authors || []).map(a => displayName(a.name)), languages: b.languages || [],
        downloads: b.download_count || 0, cover: safeHttps(b.formats['image/jpeg'], GUTENBERG), epub,
        summary: (b.summaries && b.summaries[0]) || '', subjects: (b.subjects || []).slice(0, 8), verified: true
    };
}
const LANG = (() => { try {
    return new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' });
}
catch {
    return null;
} })();
function langName(code) { try {
    return (LANG && LANG.of(code)) || code;
}
catch {
    return code;
} }
/* When Gutendex failed recently, start with Gutenberg's own catalogue instead of waiting for the timeout again. */
const DOWN_KEY = 'marginalia.discover.gutendexDown', DOWN_FOR_MS = 6 * 60 * 60 * 1000;
function gutendexRecentlyDown() {
    try {
        return Date.now() - Number(localStorage.getItem(DOWN_KEY) || 0) < DOWN_FOR_MS;
    }
    catch {
        return false;
    }
}
/* ---------- state (kept for the session, so Back returns to the same query and scroll) ---------- */
const st = {
    source: (gutendexRecentlyDown() ? 'gutenberg' : 'gutendex'), query: '', sort: 'popular', books: [], seen: new Set(), next: null,
    status: 'idle', error: '', scroll: 0, ctrl: null, gen: 0
};
/* ---------- styles ---------- */
const CSS = `
.v2-discover{position:fixed;inset:0;display:grid;grid-template-rows:auto minmax(0,1fr);background:var(--v2-bg);color:var(--v2-fg);font-family:var(--v2-sans)}
.v2-discover .dtop{padding:calc(var(--sat) + 8px) calc(var(--sar) + var(--v2-gutter)) 10px calc(var(--sal) + var(--v2-gutter));border-bottom:1px solid var(--v2-line);
  background:color-mix(in srgb,var(--v2-bg) 88%,transparent);-webkit-backdrop-filter:saturate(180%) blur(18px);backdrop-filter:saturate(180%) blur(18px)}
.v2-discover .drow{display:flex;align-items:center;gap:var(--v2-s2);max-width:var(--v2-max);margin:0 auto}
.v2-discover h2{flex:1;margin:0;font:italic 400 var(--v2-t-xl)/1.1 var(--v2-serif)}
.v2-discover .dsearch{position:relative;flex:1;min-width:0}
.v2-discover .dsearch .v2-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--v2-muted);pointer-events:none}
.v2-discover .dsearch input{width:100%;box-sizing:border-box;min-height:var(--v2-tap);padding:0 12px 0 38px;border:1px solid var(--v2-line);border-radius:var(--v2-r-pill);
  background:var(--v2-surface);color:var(--v2-fg);font:400 16px/1 var(--v2-sans)}
.v2-discover .dtools{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-s3);flex-wrap:wrap;max-width:var(--v2-max);margin:10px auto 0}
.v2-discover .dstat{font:500 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted);font-variant-numeric:tabular-nums}
.v2-discover .dmain{overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:var(--v2-s4) calc(var(--sar) + var(--v2-gutter)) calc(var(--sab) + var(--v2-s10)) calc(var(--sal) + var(--v2-gutter))}
.v2-discover .dinner{max-width:var(--v2-max);margin:0 auto}
.v2-discover .dlist{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}
.v2-discover .dlist>li,.v2-discover .ditem,.v2-discover .dtext{min-width:0}   /* long one-line authors must not widen a grid column */
.v2-discover .ditem{display:grid;grid-template-columns:64px minmax(0,1fr);gap:var(--v2-s3);align-items:center;width:100%;min-height:var(--v2-tap);padding:8px;border:0;border-radius:var(--v2-r-md);
  background:none;color:var(--v2-fg);text-align:left;cursor:pointer;font:inherit}
.v2-discover .ditem:hover{background:var(--v2-surface)}
.v2-discover .dcover{position:relative;display:block;width:100%;aspect-ratio:2/3;border-radius:3px 6px 6px 3px;overflow:hidden;background:var(--v2-surface);box-shadow:var(--v2-shadow-1)}
.v2-discover .dcover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity var(--v2-d-base)}
.v2-discover .dcover img.loaded{opacity:1}
.v2-ph{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:10% 10% 10% 14%;box-sizing:border-box;overflow:hidden;
  background:color-mix(in srgb,var(--v2-accent) var(--ph,30%),var(--v2-surface));color:var(--v2-fg)}
.v2-ph b{font:400 clamp(9px,1.1em,15px)/1.15 var(--v2-serif);display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
.v2-ph span{font:500 clamp(7px,.75em,11px)/1.2 var(--v2-sans);opacity:.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.v2-discover .dtext b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:400 17px/1.25 var(--v2-serif)}
.v2-discover .dtext span{display:block;margin-top:3px;font:500 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.v2-discover .dtext small{display:block;margin-top:3px;font:400 var(--v2-t-xs)/1.3 var(--v2-sans);color:var(--v2-muted);font-variant-numeric:tabular-nums}
.v2-discover .dtext .in{color:var(--v2-accent-text);font-weight:600}
@media (min-width:640px){
  .v2-discover .dlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:24px 18px}
  .v2-discover .ditem{grid-template-columns:1fr;align-items:start;padding:0;gap:10px;border-radius:var(--v2-r-sm)}
  .v2-discover .ditem:hover{background:none}
  .v2-discover .ditem:hover .dcover{transform:translateY(-3px)}
  .v2-discover .dcover{transition:transform var(--v2-d-slow) var(--v2-ease)}
  .v2-ph b{font-size:15px}.v2-ph span{font-size:11px}
}
.v2-discover .dmore{display:flex;justify-content:center;margin:var(--v2-s6) 0}
.v2-discover .skel .dcover,.v2-discover .skel .line{background:var(--v2-surface);animation:v2Pulse 1.2s ease-in-out infinite}
.v2-discover .skel .line{display:block;height:12px;border-radius:6px;margin-top:8px}
.v2-discover .skel .line.short{width:60%}
@keyframes v2Pulse{50%{opacity:.5}}
.v2-detail .dhead{display:flex;gap:var(--v2-s4);align-items:flex-start}
.v2-detail .dhead .dcover{position:relative;flex:none;width:96px;aspect-ratio:2/3;border-radius:3px 6px 6px 3px;overflow:hidden;background:var(--v2-surface);box-shadow:var(--v2-shadow-1)}
.v2-detail .dhead .dcover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.v2-detail h3{margin:0;font:400 24px/1.15 var(--v2-serif)}
.v2-detail .by{margin:6px 0 0;font:500 var(--v2-t-base)/1.3 var(--v2-sans);color:var(--v2-muted)}
.v2-detail .meta{margin:6px 0 0;font:400 var(--v2-t-sm)/1.4 var(--v2-sans);color:var(--v2-muted);font-variant-numeric:tabular-nums}
.v2-detail .sum{margin:var(--v2-s4) 0 0;font:400 15px/1.55 var(--v2-sans)}
.v2-detail .subs{display:flex;flex-wrap:wrap;gap:6px;margin:var(--v2-s3) 0 0;padding:0;list-style:none}
.v2-detail .subs li{padding:4px 10px;border-radius:var(--v2-r-pill);background:var(--v2-surface);font:500 var(--v2-t-xs)/1.4 var(--v2-sans);color:var(--v2-muted)}
.v2-detail .acts{display:flex;flex-direction:column;gap:var(--v2-s2);margin-top:var(--v2-s5)}
.v2-detail .have{display:flex;align-items:center;gap:6px;font:600 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-accent-text)}
.v2-detail .have .v2-icon{width:18px;height:18px}
@media (prefers-reduced-motion:reduce){.v2-discover .skel .dcover,.v2-discover .skel .line{animation:none}.v2-discover .dcover,.v2-discover .dcover img{transition:none}}
`;
/* ---------- covers ---------- */
function hue(s) { let x = 0; for (let i = 0; i < s.length; i++)
    x = (x * 31 + s.charCodeAt(i)) % 997; return x; }
/* A generated cover: title and author on a card tinted with the theme's accent token. */
function placeholder(b) {
    const ph = h('span', { class: 'v2-ph', 'aria-hidden': 'true' }, h('b', { text: b.title }), h('span', { text: b.authors[0] || '' }));
    ph.style.setProperty('--ph', (18 + hue(b.title) % 30) + '%');
    return ph;
}
/* Fixed 2:3 box (so the layout never shifts), lazy image, placeholder underneath and on error. */
function cover(b) {
    const box = h('span', { class: 'dcover' }, placeholder(b));
    if (b.cover) {
        const img = h('img', { src: b.cover, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
        img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
        img.addEventListener('error', () => img.remove(), { once: true });
        box.appendChild(img);
    }
    return box;
}
/* ---------- screen ---------- */
let panel = null;
let closeDiscover = null;
let refs = null;
let libraryGids = new Set();
let debounce = 0;
async function refreshLibrary() {
    try {
        libraryGids = new Set((await reader().listBooks()).filter(m => !m.temp && m.gid).map(m => Number(m.gid)));
    }
    catch { /* keep the last known set */ }
}
let fluxed = false;
export function openDiscover() {
    addStyle('v2-discover', CSS);
    if (closeDiscover)
        return;
    if (!panel)
        build();
    const p = panel, r = refs;
    if (!fluxed) {
        fluxed = true;
        attachFlux(p);
    }
    closeDiscover = openLayer(p, {
        kind: 'sheet', modal: true, initialFocus: r.input,
        onClose: () => { st.scroll = r.main.scrollTop; closeDiscover = null; },
        animateIn: el => el.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }),
        animateOut: el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' })
    });
    r.input.value = st.query;
    void refreshLibrary().then(() => {
        render();
        requestAnimationFrame(() => { r.main.scrollTop = st.scroll; });
    });
    if (st.status === 'idle' || st.status === 'error')
        void search(st.query);
}
function build() {
    const input = h('input', { type: 'search', placeholder: 'Search title or author', 'aria-label': 'Search public-domain books', enterkeyhint: 'search', autocomplete: 'off', maxlength: 120 });
    const stat = h('p', { class: 'dstat', 'aria-live': 'polite' });
    const sort = Segmented({ label: 'Sort by', options: [{ value: 'popular', label: 'Popular' }, { value: 'title', label: 'Title' }, { value: 'author', label: 'Author' }], value: st.sort,
        onChange: v => { st.sort = v; render(); } });
    const inner = h('div', { class: 'dinner' });
    const main = h('div', { class: 'dmain' }, inner);
    panel = h('div', { class: 'v2-discover v2', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Discover public-domain books' }, h('header', { class: 'dtop' }, h('div', { class: 'drow' }, IconButton({ label: 'Back', icon: 'chevron-left', onClick: () => closeDiscover && closeDiscover() }), h('h2', { text: 'Discover' })), h('div', { class: 'drow', style: 'margin-top:8px' }, h('label', { class: 'dsearch' }, icon('search'), input)), h('div', { class: 'dtools' }, stat, sort)), main);
    refs = { input, inner, main, stat };
    input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = window.setTimeout(() => void search(input.value), DEBOUNCE_MS);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(debounce);
        void search(input.value);
    } });
}
async function search(raw, force = false) {
    const query = raw.trim().slice(0, 120);
    if (query.length === 1)
        return; // wait for a second character
    if (!force && query === st.query && (st.status === 'done' || st.status === 'loading'))
        return;
    if (st.ctrl)
        st.ctrl.abort(); // stale request: stop using it
    const ctrl = new AbortController(), gen = ++st.gen;
    Object.assign(st, { query, books: [], seen: new Set(), next: null, status: 'loading', error: '', ctrl, scroll: 0 });
    if (refs)
        refs.main.scrollTop = 0;
    render();
    await loadPage(searchUrl(st.source, query), ctrl, gen);
}
async function loadPage(url, ctrl, gen) {
    try {
        const page = await fetchPage(st.source, url, ctrl.signal);
        if (gen !== st.gen)
            return;
        for (const b of page.books)
            if (!st.seen.has(b.id)) {
                st.seen.add(b.id);
                st.books.push(b);
            }
        st.next = page.next;
        st.status = 'done';
    }
    catch (e) {
        if (gen !== st.gen || e.name === 'AbortError')
            return;
        // Gutendex not answering: switch to Project Gutenberg's own catalogue for the rest of the session.
        if (st.source === 'gutendex' && !st.books.length) {
            st.source = 'gutenberg';
            try {
                localStorage.setItem(DOWN_KEY, String(Date.now()));
            }
            catch { /* storage blocked */ }
            return loadPage(searchUrl('gutenberg', st.query), ctrl, gen);
        }
        st.status = 'error';
        st.error = navigator.onLine === false ? 'You’re offline. Connect to the internet and try again.'
            : e instanceof TypeError ? 'The catalogue couldn’t be reached. Check your connection and try again.'
                : (e.message || 'The catalogue couldn’t be reached.');
    }
    render();
}
async function loadMore(btn) {
    if (!st.next || st.status === 'more')
        return;
    const ctrl = st.ctrl || new AbortController();
    st.ctrl = ctrl;
    st.status = 'more';
    btn.disabled = true;
    const label = btn.querySelector('span');
    if (label)
        label.textContent = 'Loading…';
    await loadPage(st.next, ctrl, st.gen);
}
function sorted() {
    // Popular: server order (sort=popular). Title / Author: client-side, over the books loaded so far.
    if (st.sort === 'popular')
        return st.books;
    const key = (b) => st.sort === 'title' ? b.title.replace(/^(the|a|an)\s+/i, '') : (b.authors[0] || '').split(' ').slice(-1)[0] + ' ' + (b.authors[0] || '');
    return st.books.slice().sort((a, b) => key(a).localeCompare(key(b), undefined, { sensitivity: 'base' }));
}
function render() {
    if (!refs)
        return;
    const { inner, stat } = refs;
    const out = [];
    if (st.status === 'loading') {
        stat.textContent = st.query ? 'Searching…' : 'Loading popular books…';
        out.push(h('ul', { class: 'dlist', 'aria-hidden': 'true' }, ...Array.from({ length: 8 }, () => h('li', { class: 'skel' }, h('div', { class: 'ditem' }, h('span', { class: 'dcover' }), h('span', { class: 'dtext' }, h('span', { class: 'line' }), h('span', { class: 'line short' })))))));
    }
    else if (st.status === 'error') {
        stat.textContent = '';
        out.push(EmptyState({ error: true, title: 'Couldn’t load the catalogue', text: st.error,
            actions: [Button({ label: 'Try again', icon: 'refresh', variant: 'primary', onClick: () => void search(refs.input.value, true) })] }));
    }
    else if (!st.books.length && st.status !== 'idle') {
        stat.textContent = '';
        out.push(EmptyState({ title: 'No public-domain books found', text: st.query ? 'Try another title or author, or check the spelling.' : 'The catalogue returned no books.', art: 'search' }));
    }
    else {
        const n = st.books.length;
        stat.textContent = (st.query ? n + (n === 1 ? ' book' : ' books') + ' for “' + st.query + '”' : 'Popular public-domain books') +
            (st.sort !== 'popular' && st.next ? ' · sorted among those loaded' : '');
        out.push(h('ul', { class: 'dlist', 'aria-label': 'Results' }, ...sorted().map(b => h('li', {}, item(b)))));
        if (st.next) {
            const more = Button({ label: 'Load more', icon: 'chevron-down' });
            more.addEventListener('click', () => void loadMore(more));
            out.push(h('div', { class: 'dmore' }, more));
        }
        out.push(h('p', { class: 'v2-hint', text: (st.source === 'gutendex' ? 'Books come from Project Gutenberg through Gutendex' : 'Books come from Project Gutenberg’s own catalogue (Gutendex isn’t responding)') + ' and are limited to works marked public domain in the United States. Copyright rules differ by country; check your local rules.' }));
    }
    inner.replaceChildren(...out);
    if (!reduceMotion() && st.status === 'done')
        inner.querySelectorAll('.ditem').forEach((el, i) => { if (i < 12)
            el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: i * 15, fill: 'backwards' }); });
}
function item(b) {
    const have = libraryGids.has(b.id);
    const meta = [b.languages.map(langName).join(', '), b.downloads ? b.downloads.toLocaleString() + ' downloads' : ''].filter(Boolean).join(' · ');
    const btn = h('button', { type: 'button', class: 'ditem', 'aria-label': b.title + (b.authors[0] ? ', ' + b.authors[0] : '') + (have ? ', in your library' : '') }, cover(b), h('span', { class: 'dtext' }, h('b', { text: b.title }), h('span', { text: b.authors.join(', ') || 'Unknown author' }), h('small', {}, meta, have ? h('span', { class: 'in', text: ' · In library' }) : null)));
    btn.addEventListener('click', () => openDetail(b));
    return btn;
}
/* ---------- detail ---------- */
function openDetail(start) {
    const R = reader();
    let b = start;
    const body = h('div');
    const acts = h('div', { class: 'acts' });
    const readOnSite = () => {
        const fn = window.__marginaliaReadOnSite;
        if (fn) {
            if (closeDiscover)
                closeDiscover();
            fn({ id: b.id, title: b.title, authors: b.authors, epub: b.epub || GUTENBERG_ORIGIN + '/ebooks/' + b.id + '.epub.noimages' });
        }
        else
            window.open(GUTENBERG_ORIGIN + '/ebooks/' + b.id + '.html.images', '_blank', 'noopener');
    };
    const siteBtn = () => Button({ label: 'Read on site', icon: 'globe', block: true, onClick: () => { s.close(); readOnSite(); } });
    const openSaved = async () => {
        const m = (await R.listBooks()).find(x => Number(x.gid) === b.id && !x.temp);
        if (!m)
            return;
        s.close();
        if (closeDiscover)
            closeDiscover();
        void R.openBook(m.id);
    };
    const addBtn = Button({ label: 'Add to library', icon: 'plus', variant: 'primary', block: true, onClick: async () => {
            const save = window.__marginaliaSaveBook;
            if (!save) {
                showToast('Saving isn’t available right now.');
                return;
            }
            addBtn.disabled = true;
            const l = addBtn.querySelector('span');
            if (l)
                l.textContent = 'Adding…';
            try {
                await save({ id: b.id, title: b.title, authors: b.authors, epub: b.epub });
                await refreshLibrary();
                if (libraryGids.has(b.id)) {
                    paintActs();
                    render();
                }
                else {
                    addBtn.disabled = false;
                    if (l)
                        l.textContent = 'Add to library';
                }
            }
            catch (e) {
                addBtn.disabled = false;
                if (l)
                    l.textContent = 'Add to library';
                showToast(e.message || 'Could not add this book.');
            }
        } });
    const paintActs = () => {
        acts.replaceChildren(...(libraryGids.has(b.id)
            ? [h('p', { class: 'have' }, icon('check'), 'Already in your library'), Button({ label: 'Open book', icon: 'book', variant: 'primary', block: true, onClick: () => void openSaved() })]
            : b.verified ? [addBtn] : []), siteBtn());
    };
    const paint = (note) => {
        const coverBox = h('span', { class: 'dcover' }, placeholder(b));
        if (b.cover) {
            const img = h('img', { src: b.cover, alt: '', decoding: 'async', referrerpolicy: 'no-referrer' });
            img.addEventListener('error', () => img.remove(), { once: true });
            coverBox.appendChild(img);
        }
        const meta = [b.languages.map(langName).join(', '), b.downloads ? b.downloads.toLocaleString() + ' downloads' : '', b.verified ? 'Public domain in the USA' : ''].filter(Boolean).join(' · ');
        const summary = b.summary.length > 600 ? b.summary.slice(0, 600).replace(/s+S*$/, '') + '…' : b.summary;
        paintActs();
        const parts = [
            h('div', { class: 'dhead' }, coverBox, h('div', {}, h('h3', { text: b.title }), h('p', { class: 'by', text: b.authors.join(', ') || 'Unknown author' }), meta ? h('p', { class: 'meta', text: meta }) : null)),
            note ? h('p', { class: 'v2-hint', 'aria-live': 'polite', text: note }) : summary ? h('p', { class: 'sum', text: summary }) : h('p', { class: 'v2-hint', text: 'No description is available for this book.' }),
            b.subjects.length ? h('ul', { class: 'subs', 'aria-label': 'Subjects' }, ...b.subjects.map(x => h('li', { text: x.replace(/s+--s+/g, ' · ') }))) : null,
            acts
        ];
        body.replaceChildren(...parts.filter((x) => !!x));
    };
    const s = Sheet({ title: 'Book details', className: 'v2-detail', content: body });
    if (b.verified) {
        paint();
        return;
    }
    // Fallback results: check the book's own feed before offering to add it (same rule as before).
    paint('Checking this book in Project Gutenberg’s catalogue…');
    const ctrl = new AbortController();
    verify(b, ctrl.signal).then(v => {
        if (!document.body.contains(s.panel))
            return;
        if (!v) {
            paint('This book isn’t marked public domain in the USA or has no EPUB, so it can’t be added here.');
            return;
        }
        b = v;
        const i = st.books.findIndex(x => x.id === v.id);
        if (i >= 0)
            st.books[i] = v;
        paint();
        render();
    }, () => paint('Couldn’t check this book right now. Try again later, or use Read on site.'));
}
/* Every Discover button in the app ([data-catalog-open]) opens v2 Discover. */
export function mountDiscover() {
    document.addEventListener('click', e => {
        const t = e.target;
        if (t && t.closest && t.closest('[data-catalog-open]')) {
            e.preventDefault();
            openDiscover();
        }
    });
    document.addEventListener('reader:library', () => { if (closeDiscover)
        void refreshLibrary().then(render); });
}
