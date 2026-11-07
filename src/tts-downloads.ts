/* Marginalia: download EdgeTTS audio ahead for offline listening.
   Adds "Download chapter" / "Download book" to the EdgeTTS box in audio settings.
   Chunks are fetched one at a time (max 1200 characters each) from the owner's Worker and kept
   in Cache Storage. Playback (TTS.edgeAudio in index.html) checks these downloads first.

   Honesty note: EdgeTTS is Microsoft's unofficial Edge read-aloud service. Microsoft can still
   throttle or block it. Downloading ahead means each sentence is asked for once, but it cannot
   prevent throttling. On a 429 the download pauses, waits (Retry-After, then backoff) and resumes.

   Source: src/tts-downloads.ts, compiled by `npm run build` to build/src/tts-downloads.js. */

interface Boundary { offset: number; text: string; duration?: number }
interface AudioHit { blob: Blob; boundaries: Boundary[] }
interface Chunk { s: number; e: number; p: number }
interface SpeechModel { ch: number; text: string; chunks: Chunk[] }
interface ChunkRequest { text: string; voice: string; rate: number; pitch: number }
interface Book { id: string; type?: string; title?: string; meta?: { title?: string }; chapters: unknown[] }
interface Reader {
  App: { book: Book | null; r?: { getLoc?: () => { ch: number } } };
  A: { engine: string; edgeVoice: string; cadence: boolean; pitch: number };
  TTS: { ch: number; edgeChunkRequest: (m: SpeechModel, i: number) => ChunkRequest };
  buildSpeechModel: (ch: number, mode: string) => Promise<SpeechModel>;
  edgeProxyUrl: () => string;
  retryAfterMs: (value: string | null) => number;
}
interface ChapterRecord { sig: string; chunks: number; bytes: number; at: number }
type Manifest = Record<string, { title: string; chapters: Record<string, ChapterRecord> }>;

declare global {
  interface Window {
    __reader?: Reader;
    __marginaliaTTSDownloads?: {
      lookup: (bookId: string, voice: string, rate: number, pitch: number, text: string) => Promise<AudioHit | null>;
    };
  }
}

const CACHE_NAME = 'marginalia-tts-downloads-v1';
const KEY_PATH = '/__tts-download/v1/';
const MANIFEST_KEY = 'marginalia.ttsDownloads.v1';
const FORMAT = 'audio-24khz-48kbitrate-mono-mp3'; // same output format as the Worker
const MAX_CHARS = 1200;
const GAP_MS = 350;          // pause between requests, so a download never bursts
const MAX_BACKOFF_MS = 120000;

const hasCaches = typeof caches !== 'undefined' && !!(window.crypto && crypto.subtle);

/* ---------- storage ---------- */

async function hashKey(voice: string, rate: number, pitch: number, text: string): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(['v1', voice, rate, pitch, FORMAT, text]));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
}
function bookPrefix(bookId: string): string {
  return location.origin + KEY_PATH + encodeURIComponent(bookId) + '/';
}
async function keyUrl(bookId: string, req: ChunkRequest): Promise<string> {
  return bookPrefix(bookId) + await hashKey(req.voice, req.rate, req.pitch, req.text);
}
function readManifest(): Manifest {
  try { return JSON.parse(localStorage.getItem(MANIFEST_KEY) || '{}') as Manifest || {}; } catch { return {}; }
}
function writeManifest(m: Manifest): void {
  try { localStorage.setItem(MANIFEST_KEY, JSON.stringify(m)); } catch { /* storage full or blocked */ }
}
function parseBoundaries(header: string | null): Boundary[] {
  if (!header) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(header));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((b): b is Boundary =>
      !!b && Number.isFinite((b as Boundary).offset) && typeof (b as Boundary).text === 'string' && (b as Boundary).text.length > 0);
  } catch { return []; }
}

async function lookup(bookId: string, voice: string, rate: number, pitch: number, text: string): Promise<AudioHit | null> {
  if (!hasCaches || !readManifest()[bookId]) return null; // nothing downloaded for this book: skip the hashing
  const cache = await caches.open(CACHE_NAME);
  const res = await cache.match(await keyUrl(bookId, { text, voice, rate, pitch }));
  if (!res) return null;
  return { blob: await res.blob(), boundaries: parseBoundaries(res.headers.get('X-TTS-Word-Boundaries')) };
}

async function deleteBook(bookId: string): Promise<void> {
  if (hasCaches) {
    const cache = await caches.open(CACHE_NAME), prefix = bookPrefix(bookId);
    for (const req of await cache.keys()) if (req.url.startsWith(prefix)) await cache.delete(req);
  }
  const m = readManifest(); delete m[bookId]; writeManifest(m);
}

/* ---------- downloading ---------- */

interface Job { bookId: string; cancelled: boolean; controller: AbortController | null; wake: (() => void) | null }
let job: Job | null = null;
let statusText = '';
let progress = 0; // 0..1 within the current job

function reader(): Reader | null { return window.__reader || null; }
function signature(r: Reader): string { return [r.A.edgeVoice, r.A.cadence ? 'cadence' : 'plain', r.A.pitch].join('|'); }
function sleep(ms: number, j: Job): Promise<void> {
  return new Promise(resolve => {
    const t = setTimeout(() => { j.wake = null; resolve(); }, ms);
    j.wake = () => { clearTimeout(t); j.wake = null; resolve(); };
  });
}
function setStatus(text: string, p?: number): void {
  statusText = text;
  if (p != null) progress = p;
  render();
}

class DownloadError extends Error {}

/* Fetches one chunk. On 429 it waits (Retry-After, then backoff) and tries again until cancelled. */
async function fetchChunk(j: Job, r: Reader, req: ChunkRequest, label: string): Promise<Blob | null> {
  const endpoint = r.edgeProxyUrl();
  if (!endpoint) throw new DownloadError('Add your EdgeTTS Worker URL above first.');
  let busy = 0, failures = 0;
  for (;;) {
    if (j.cancelled) return null;
    j.controller = new AbortController();
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: j.controller.signal,
        body: JSON.stringify({ text: req.text, voice: req.voice, rate: req.rate, pitch: req.pitch })
      });
    } catch (e) {
      if (j.cancelled) return null;
      if (++failures > 3) throw new DownloadError('Could not reach the voice Worker. Check your connection and try again.');
      await sleep(2000 * 2 ** failures, j);
      continue;
    } finally { j.controller = null; }
    if (res.ok) return res.blob().then(async blob => {
      const headers: Record<string, string> = { 'Content-Type': 'audio/mpeg', 'Content-Length': String(blob.size) };
      const b = res.headers.get('X-TTS-Word-Boundaries'); if (b) headers['X-TTS-Word-Boundaries'] = b;
      const cache = await caches.open(CACHE_NAME);
      await cache.put(await keyUrl(j.bookId, req), new Response(blob, { headers }));
      return blob;
    });
    if (res.status === 429) {
      busy++;
      const wait = Math.min(MAX_BACKOFF_MS, Math.max(r.retryAfterMs(res.headers.get('Retry-After')), 5000 * 2 ** (busy - 1)));
      setStatus(`Paused: Microsoft’s voice service is busy. Resuming in ${Math.ceil(wait / 1000)} s… (${label})`);
      await sleep(wait + Math.floor(Math.random() * 1000), j);
      continue;
    }
    let message = 'HTTP ' + res.status;
    try { const data = await res.json() as { error?: string }; if (data && data.error) message = data.error; } catch { /* not JSON */ }
    if (res.status >= 500 && ++failures <= 3) { await sleep(2000 * 2 ** failures, j); continue; }
    throw new DownloadError('The voice Worker refused the request (' + message + ').');
  }
}

async function download(chapters: number[]): Promise<void> {
  const r = reader(), book = r && r.App.book;
  if (!r || !book || job || !hasCaches) return;
  const j: Job = { bookId: book.id, cancelled: false, controller: null, wake: null };
  job = j;
  try {
    // Ask the browser not to clear downloads when space runs low (Safari may still decide to).
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist().catch(() => false);
    const sig = signature(r);
    const manifest = readManifest();
    manifest[book.id] = manifest[book.id] || { title: bookTitle(book), chapters: {} };
    writeManifest(manifest); // lookups skip books with no entry, so record it before the first chunk
    const todo = chapters.filter(ch => (manifest[book.id].chapters[ch] || { sig: '' }).sig !== sig);
    if (!todo.length) { setStatus('Already downloaded.', 1); return; }
    for (let n = 0; n < todo.length; n++) {
      const ch = todo[n];
      if (j.cancelled || !r.App.book || r.App.book.id !== j.bookId) break;
      const model = await r.buildSpeechModel(ch, 'edge');
      let bytes = 0, done = 0;
      const total = model.chunks.length;
      const cache = await caches.open(CACHE_NAME);
      for (let i = 0; i < total; i++) {
        if (j.cancelled) break;
        const req = r.TTS.edgeChunkRequest(model, i);
        const label = `chapter ${n + 1} of ${todo.length}, part ${i + 1} of ${total}`;
        setStatus(`Downloading ${label}…`, (n + i / Math.max(1, total)) / todo.length);
        if (!req.text.trim() || req.text.length > MAX_CHARS) { done++; continue; }
        const existing = await cache.match(await keyUrl(j.bookId, req));
        if (existing) { bytes += Number(existing.headers.get('Content-Length')) || 0; done++; continue; }
        const blob = await fetchChunk(j, r, req, label);
        if (!blob) break;
        bytes += blob.size; done++;
        await sleep(GAP_MS, j);
      }
      if (done === total) {
        const m = readManifest();
        m[j.bookId] = m[j.bookId] || { title: bookTitle(book), chapters: {} };
        m[j.bookId].chapters[ch] = { sig, chunks: total, bytes, at: Date.now() };
        writeManifest(m);
      }
    }
    setStatus(j.cancelled ? 'Download cancelled. Finished chapters are kept.' : 'Download finished. These chapters now play offline.', j.cancelled ? progress : 1);
  } catch (e) {
    setStatus(e instanceof DownloadError ? e.message : 'Download stopped: ' + ((e as Error).message || String(e)));
  } finally {
    job = null;
    render();
  }
}

function cancel(): void {
  if (!job) return;
  job.cancelled = true;
  if (job.controller) job.controller.abort();
  if (job.wake) job.wake();
}

/* ---------- UI (minimal, current style; the v2 redesign replaces it later) ---------- */

function bookTitle(book: Book): string { return (book.meta && book.meta.title) || book.title || 'this book'; }
function currentChapter(r: Reader): number {
  try { const loc = r.App.r && r.App.r.getLoc && r.App.r.getLoc(); if (loc && loc.ch >= 0) return loc.ch; } catch { /* reader not ready */ }
  return r.TTS.ch >= 0 ? r.TTS.ch : 0;
}
function mb(bytes: number): string { return (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0) + ' MB'; }
function esc(s: string): string { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)); }

let storageLine = '';
async function refreshStorage(): Promise<void> {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    storageLine = `Storage used by this site: ${mb(usage)}${quota ? ' of ' + mb(quota) : ''}.` +
      (persisted ? ' Protected from automatic cleanup.' : ' The browser may clear it if space runs low.');
    render();
  } catch { /* estimate unsupported */ }
}

function render(): void {
  const box = document.getElementById('ttsDownloads');
  const r = reader();
  if (!box || !r) return;
  const book = r.App.book;
  let html = '<h3 style="margin:14px 0 6px">Offline listening</h3>';
  if (!hasCaches) {
    html += '<p class="hint">This browser can’t store audio for offline listening.</p>';
  } else if (!book) {
    html += '<p class="hint">Open a book to download its audio.</p>';
  } else if (book.type === 'pdf') {
    html += '<p class="hint">Downloads work with EPUB, TXT and HTML books.</p>';
  } else {
    const entry = readManifest()[book.id], sig = signature(r);
    const chapters = entry ? Object.values(entry.chapters) : [];
    const ready = chapters.filter(c => c.sig === sig).length;
    const bytes = chapters.reduce((t, c) => t + c.bytes, 0);
    const running = !!job;
    html += `<div class="row" style="flex-wrap:wrap;gap:8px">
        <button class="small-btn" data-dl="chapter" ${running ? 'disabled' : ''}>Download chapter</button>
        <button class="small-btn" data-dl="book" ${running ? 'disabled' : ''}>Download book</button>
        ${running ? '<button class="small-btn" data-dl="cancel">Cancel</button>' : ''}
      </div>`;
    if (running || statusText) {
      html += `<div role="progressbar" aria-label="Download progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}"
        style="height:4px;border-radius:2px;background:var(--line);margin:8px 0 0;overflow:hidden"><div style="height:100%;width:${(progress * 100).toFixed(1)}%;background:var(--accent)"></div></div>
        <p class="hint" aria-live="polite">${esc(statusText)}</p>`;
    }
    html += `<p class="hint">${ready} of ${book.chapters.length} chapters downloaded for ${esc(r.A.edgeVoice)}${bytes ? ' (' + mb(bytes) + ' stored for this book in total)' : ''}. Downloaded chapters play first, even offline. Changing the voice, pitch or cadence needs a new download.</p>`;
    if (storageLine) html += `<p class="hint">${esc(storageLine)}</p>`;
    if (chapters.length && !running) html += '<button class="small-btn" data-dl="delete" style="margin-top:8px">Delete downloads for this book</button>';
  }
  box.innerHTML = html;
}

function onClick(e: Event): void {
  const t = e.target as HTMLElement | null;
  const btn = t && t.closest ? t.closest<HTMLButtonElement>('#ttsDownloads [data-dl]') : null;
  const r = reader();
  if (!btn || !r || !r.App.book) return;
  const action = btn.dataset.dl, book = r.App.book;
  if (action === 'chapter') void download([currentChapter(r)]).then(refreshStorage);
  else if (action === 'book') void download(book.chapters.map((_, i) => i)).then(refreshStorage);
  else if (action === 'cancel') cancel();
  else if (action === 'delete') {
    if (!confirm('Delete downloaded audio for “' + bookTitle(book) + '”? You can download it again later.')) return;
    statusText = ''; progress = 0;
    void deleteBook(book.id).then(() => { render(); return refreshStorage(); });
  }
}

/* Re-render when the audio tab is shown (its "hidden" class goes away) or its content is rebuilt,
   so the box always reflects the book that is open now. */
function watch(): void {
  const body = document.getElementById('audioBody');
  if (!body) return;
  new MutationObserver(() => {
    if (body.classList.contains('hidden') || job) return;
    render(); void refreshStorage();
  }).observe(body, { childList: true, attributes: true, attributeFilter: ['class'] });
  render();
}

if (!window.__marginaliaTTSDownloads) {
  window.__marginaliaTTSDownloads = { lookup };
  document.addEventListener('click', onClick);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
}

export {};
