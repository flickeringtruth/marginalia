/* Marginalia catalog paging: "Load more" for public-domain search results.
   Loaded from index.html as a module. Remove the script tag to restore the old search.
   It follows the "next" link in Project Gutenberg's own search feed, so it can only page
   as far as Gutenberg provides one. Before the first search, check that this link appears. */
(() => {
  if (window.__marginaliaCatalogPaging) return;
  window.__marginaliaCatalogPaging = true;

  const ORIGIN = 'https://www.gutenberg.org';
  const SEARCH_URL = ORIGIN + '/ebooks/search.opds/';
  const ATOM = 'http://www.w3.org/2005/Atom', DCTERMS = 'http://purl.org/dc/terms/';

  const $ = s => document.querySelector(s);
  const form = $('#catalogForm'), input = $('#catalogSearch'), results = $('#catalogResults'), status = $('#catalogStatus');
  if (!form || !input || !results || !status) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let gen = 0, state = null;

  // Only https links to www.gutenberg.org with an expected path are followed.
  function safeUrl(href, pathOk) {
    try {
      const u = new URL(href, ORIGIN);
      if (u.protocol !== 'https:' || u.hostname !== 'www.gutenberg.org' || u.username || u.password) return null;
      return pathOk(u.pathname) ? u.href : null;
    } catch (e) { return null; }
  }
  const feedUrl = href => safeUrl(href, p => /^\/ebooks\/\d+\.opds$/.test(p));
  const nextUrl = href => safeUrl(href, p => /^\/ebooks\/search\.opds\/?$/.test(p));

  async function fetchXml(url, signal) {
    const res = await fetch(url, { headers: { Accept: 'application/atom+xml' }, signal });
    if (!res.ok) throw new Error('Project Gutenberg request failed (HTTP ' + res.status + ').');
    const doc = new DOMParser().parseFromString(await res.text(), 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Project Gutenberg returned an invalid catalog response.');
    return doc;
  }
  const txt = (node, name) => { const e = node.getElementsByTagNameNS(ATOM, name)[0]; return e && e.textContent ? e.textContent.trim() : ''; };

  // Same rule as the built-in catalog: the book must be marked public domain in the USA.
  async function verifyFeed(url, signal) {
    const doc = await fetchXml(url, signal);
    const entry = doc.getElementsByTagNameNS(ATOM, 'entry')[0];
    if (!entry || !/^public domain in the usa\.?$/i.test(txt(entry, 'rights'))) return null;
    const id = Number((new URL(url).pathname.match(/\/ebooks\/(\d+)\.opds$/) || [])[1]);
    const title = txt(entry, 'title');
    const epubLink = Array.from(entry.getElementsByTagNameNS(ATOM, 'link')).find(l =>
      l.getAttribute('type') === 'application/epub+zip' && l.getAttribute('rel') === 'http://opds-spec.org/acquisition');
    const epub = epubLink ? safeUrl(epubLink.getAttribute('href'), () => true) : null;
    if (!Number.isInteger(id) || !title || !epub) return null;
    const authors = Array.from(entry.getElementsByTagNameNS(ATOM, 'author')).map(a => txt(a, 'name')).filter(Boolean);
    const lang = ((entry.getElementsByTagNameNS(DCTERMS, 'language')[0] || {}).textContent || '').trim();
    const dl = (txt(entry, 'content').match(/Downloads:\s*([\d,]+)/i) || [])[1];
    return { id, title, authors, language: lang, downloads: dl ? Number(dl.replace(/,/g, '')) : 0, epub };
  }

  function card(b) {
    return `<article class="catalog-book"><div class="catalog-book-copy"><b>${esc(b.title)}</b>` +
      `<span>${esc(b.authors.join(', ') || 'Unknown author')}</span>` +
      `<small>${b.language ? esc(b.language) + ' · ' : ''}${b.downloads.toLocaleString()} downloads · Public domain in the USA</small></div>` +
      `<a class="small-btn" data-catalog-download="${b.id}" href="${esc(b.epub)}" target="_blank" rel="noopener noreferrer" aria-label="Download ${esc(b.title)} EPUB">Download EPUB</a></article>`;
  }

  function ensureLayout() {
    let list = results.querySelector('#mlList');
    if (!list) {
      results.innerHTML = '<div id="mlList"></div><div id="mlFoot"></div>';
      list = results.querySelector('#mlList');
    }
    return list;
  }

  function renderFoot(loading) {
    const foot = results.querySelector('#mlFoot');
    if (foot) {
      foot.innerHTML = state.next && !loading
        ? '<button type="button" class="pill ghost" id="mlMore" style="margin:14px auto;display:flex">Load more</button>'
        : (loading ? '<p class="hint catalog-empty">Loading more…</p>' : '');
    }
    const n = state.seen.size;
    if (loading) return;
    const failed = state.failed ? ' ' + state.failed + (state.failed === 1 ? ' result' : ' results') + ' could not be verified.' : '';
    status.textContent = n
      ? n + (n === 1 ? ' verified EPUB' : ' verified EPUBs') + (state.next ? ' so far.' : '.') + failed
      : 'No matching public-domain EPUBs found.' + failed;
  }

  async function loadPage(url, g) {
    const doc = await fetchXml(url, state.ctrl.signal);
    if (g !== gen) return;
    const feeds = Array.from(doc.getElementsByTagNameNS(ATOM, 'entry')).map(e => {
      const l = Array.from(e.getElementsByTagNameNS(ATOM, 'link')).find(x => x.getAttribute('rel') === 'subsection');
      return l ? feedUrl(l.getAttribute('href')) : null;
    }).filter(Boolean);
    const next = Array.from(doc.getElementsByTagNameNS(ATOM, 'link')).find(l => l.getAttribute('rel') === 'next');
    state.next = next ? nextUrl(next.getAttribute('href')) : null;

    const outcomes = await Promise.allSettled(feeds.map(f => verifyFeed(f, state.ctrl.signal)));
    if (g !== gen) return;
    const fresh = [];
    outcomes.forEach(o => {
      if (o.status === 'rejected') { if (o.reason && o.reason.name !== 'AbortError') state.failed++; return; }
      if (o.value && !state.seen.has(o.value.id)) { state.seen.add(o.value.id); fresh.push(o.value); }
    });
    ensureLayout().insertAdjacentHTML('beforeend', fresh.map(card).join(''));
    renderFoot(false);
  }

  async function search(query) {
    const g = ++gen;
    if (state) state.ctrl.abort();
    state = { seen: new Set(), failed: 0, next: null, ctrl: new AbortController() };
    results.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
    status.classList.remove('error');
    status.textContent = 'Searching and verifying public-domain EPUBs…';
    try {
      await loadPage(SEARCH_URL + '?query=' + encodeURIComponent(query), g);
    } catch (e) {
      if (g !== gen || e.name === 'AbortError') return;
      status.textContent = e.message || 'The catalog search failed.';
      status.classList.add('error');
      results.innerHTML = '';
      return;
    }
    if (g === gen) renderFoot(false);
  }

  async function loadMore() {
    if (!state || !state.next) return;
    const g = gen;
    const url = state.next; state.next = null;
    renderFoot(true);
    try { await loadPage(url, g); }
    catch (e) {
      if (g !== gen || e.name === 'AbortError') return;
      state.next = url; renderFoot(false);
      status.textContent = e.message || 'Could not load more results.';
      status.classList.add('error');
    }
  }

  // Capture phase on the document runs before the built-in form handler, which is then skipped.
  document.addEventListener('submit', e => {
    if (!e.target || e.target.id !== 'catalogForm') return;
    e.preventDefault(); e.stopImmediatePropagation();
    const q = input.value.trim().slice(0, 120);
    if (q.length < 2) {
      results.innerHTML = '<p class="hint catalog-empty">Enter at least two characters to search.</p>';
      status.textContent = '';
      return;
    }
    search(q);
  }, true);

  results.addEventListener('click', e => { if (e.target.closest('#mlMore')) loadMore(); });
})();
