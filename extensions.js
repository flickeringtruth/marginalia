/* Marginalia extensions: Kokoro on-device voice (English), v2.
   Loaded by index.html with: <script type="module" src="extensions.js"></script>
   Adds "Kokoro" as a third engine next to Device voices and VoiceRSS.
   v2: the model runs in a Web Worker so the reader never freezes, and a stalled or crashed
   worker falls back to the device voice instead of taking the page down.
   The model (~86 MB) is downloaded from Hugging Face on first use and cached by the browser. */

const KOKORO_VERSION = '1.2.0';
const KOKORO_URLS = [
  `https://cdn.jsdelivr.net/npm/kokoro-js@${KOKORO_VERSION}/+esm`,
  `https://cdn.jsdelivr.net/npm/kokoro-js@${KOKORO_VERSION}/dist/kokoro.web.js`
];
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const VOICES = [
  ['af_heart', 'Heart (US, female)'], ['af_bella', 'Bella (US, female)'], ['af_nicole', 'Nicole (US, female)'],
  ['af_sarah', 'Sarah (US, female)'], ['am_michael', 'Michael (US, male)'], ['am_fenrir', 'Fenrir (US, male)'],
  ['am_puck', 'Puck (US, male)'], ['bf_emma', 'Emma (UK, female)'], ['bf_isabella', 'Isabella (UK, female)'],
  ['bm_george', 'George (UK, male)'], ['bm_fable', 'Fable (UK, male)'], ['bm_daniel', 'Daniel (UK, male)']
];
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
const AHEAD = 2;            // chunks generated in advance
const LOAD_STALL_MS = 120000; // no progress for this long while loading = give up
const GEN_TIMEOUT_MS = 60000; // one sentence taking longer than this = give up

/* Code that runs inside the worker (classic worker, dynamic import from the CDN). */
const WORKER_SRC = `
let tts = null;
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      let mod = null, last = null;
      for (const url of m.urls) {
        try { mod = await import(url); if (mod && mod.KokoroTTS) break; mod = null; } catch (err) { last = err; }
      }
      if (!mod) throw last || new Error('Could not load the Kokoro library');
      tts = await mod.KokoroTTS.from_pretrained(m.modelId, {
        dtype: m.dtype, device: 'wasm',
        progress_callback: (p) => { if (p && p.status === 'progress') self.postMessage({ type: 'progress', file: p.file, loaded: p.loaded || 0, total: p.total || 0 }); }
      });
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'gen') {
      const out = await tts.generate(m.text, { voice: m.voice, speed: m.speed });
      const s = out.audio || out.data;
      const copy = new Float32Array(s);
      self.postMessage({ type: 'audio', id: m.id, samples: copy, sr: out.sampling_rate || 24000 }, [copy.buffer]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String((err && err.message) || err) });
  }
};`;

function whenReady(cb, tries = 200) {
  const R = window.__reader;
  if (R && R.TTS && R.A && R.setAudio) { cb(R); return; }
  if (tries > 0) setTimeout(() => whenReady(cb, tries - 1), 50);
  else console.warn('[extensions] Marginalia core not found; Kokoro disabled');
}

whenReady(R => {
  const T = R.TTS, A = R.A;
  const st = { down: false, busy: false, queue: [], wanted: new Set(), cache: new Map(), notedLang: false };

  /* ---------- helpers ---------- */
  const bookLang = () => ((R.App && R.App.book && R.App.book.lang) || navigator.language || 'en').toLowerCase();
  const isEnglish = () => bookLang().startsWith('en');
  const voice = () => (VOICES.some(v => v[0] === A.kokoroVoice) ? A.kokoroVoice : 'af_heart');
  const speed = () => Math.round(Math.min(2, Math.max(0.5, Number(A.rate) || 1)) * 20) / 20;
  const usable = () => A.engine === 'kokoro' && !st.down && isEnglish();
  const keyOf = t => voice() + '|' + speed() + '|' + t;
  const log = (t, d) => { try { T.logEv('kokoro-' + t, d); } catch (e) { /* ignore */ } };

  /* ---------- little banner for progress and messages ---------- */
  let bannerEl = null, bannerTimer = 0;
  function banner(text, ms) {
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.setAttribute('role', 'status');
      bannerEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(88px + env(safe-area-inset-bottom,0px));' +
        'max-width:min(92vw,420px);padding:10px 14px;border-radius:14px;background:var(--card,#222);color:var(--fg,#fff);' +
        'border:.5px solid var(--line,#444);font-size:14px;line-height:1.35;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,.25);display:none';
      document.body.appendChild(bannerEl);
    }
    clearTimeout(bannerTimer);
    if (!text) { bannerEl.style.display = 'none'; return; }
    bannerEl.textContent = text; bannerEl.style.display = 'block';
    if (ms) bannerTimer = setTimeout(() => { bannerEl.style.display = 'none'; }, ms);
  }
  function setStatus(text) { const s = document.getElementById('kokoroStatus'); if (s) s.textContent = text || ''; }

  /* ---------- WAV encoding (runs on the main thread, cheap) ---------- */
  function wavBlob(f32, sr) {
    const n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, f32[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return new Blob([buf], { type: 'audio/wav' });
  }

  /* ---------- worker control ---------- */
  let worker = null, readyP = null, nextId = 1, loadTimer = 0;
  const pending = new Map(); // id -> { resolve, reject, timer }
  const files = {};

  function killWorker(reason) {
    clearTimeout(loadTimer);
    if (worker) { try { worker.terminate(); } catch (e) { /* ignore */ } }
    worker = null; readyP = null;
    for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error(reason || 'Kokoro stopped')); }
    pending.clear();
    for (const k in files) delete files[k];
  }

  function startWorker() {
    if (readyP) return readyP;
    if (typeof Worker === 'undefined') return Promise.reject(new Error('This browser has no background workers'));
    setStatus('Loading…'); banner('Loading the Kokoro voice… (first time downloads ~90 MB)');
    readyP = new Promise((resolve, reject) => {
      let url;
      try { url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })); worker = new Worker(url); }
      catch (e) { reject(e); return; }
      const stall = () => { killWorker('Kokoro took too long to load'); reject(new Error('Kokoro took too long to load')); };
      const bump = () => { clearTimeout(loadTimer); loadTimer = setTimeout(stall, LOAD_STALL_MS); };
      bump();
      worker.onmessage = ev => {
        const m = ev.data || {};
        if (m.type === 'progress') {
          bump();
          files[m.file] = { loaded: m.loaded, total: m.total };
          let l = 0, t = 0; for (const k in files) { l += files[k].loaded; t += files[k].total; }
          if (t) { const msg = 'Downloading voice… ' + Math.round(l / t * 100) + '% (' + Math.round(t / 1048576) + ' MB, first time only)'; banner(msg); setStatus(msg); }
        } else if (m.type === 'ready') {
          clearTimeout(loadTimer); banner('Kokoro voice ready', 1800); setStatus('Ready ✓ (stored on this device)'); resolve();
        } else if (m.type === 'audio') {
          const p = pending.get(m.id); if (!p) return; pending.delete(m.id); clearTimeout(p.timer);
          p.resolve(URL.createObjectURL(wavBlob(m.samples, m.sr)));
        } else if (m.type === 'error') {
          const p = m.id != null ? pending.get(m.id) : null;
          if (p) { pending.delete(m.id); clearTimeout(p.timer); p.reject(new Error(m.message)); }
          else { killWorker(m.message); reject(new Error(m.message)); }
        }
      };
      worker.onerror = ev => { const msg = (ev && ev.message) || 'Kokoro worker crashed'; killWorker(msg); reject(new Error(msg)); };
      worker.postMessage({ type: 'load', urls: KOKORO_URLS, modelId: MODEL_ID, dtype: 'q8' });
    });
    readyP.catch(e => { setStatus('Could not load: ' + (e && e.message ? e.message : e)); readyP = null; });
    return readyP;
  }

  async function synth(text) {
    await startWorker();
    if (!worker) throw new Error('Kokoro is not running');
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => { killWorker('Kokoro took too long on one sentence'); }, GEN_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ type: 'gen', id, text, voice: voice(), speed: speed() });
    });
  }

  /* ---------- generation queue (one at a time; only sentences still wanted) ---------- */
  function trimCache() {
    while (st.cache.size > 14) {
      const k = st.cache.keys().next().value, e = st.cache.get(k);
      st.cache.delete(k); if (e && e.url) URL.revokeObjectURL(e.url);
    }
  }
  async function pump() {
    if (st.busy) return; st.busy = true;
    try {
      while (st.queue.length) {
        const e = st.queue.shift();
        if (!st.wanted.has(e.key)) { st.cache.delete(e.key); e.resolve(null); continue; }
        try { e.url = await synth(e.text); e.resolve(e.url); }
        catch (err) { console.warn('[extensions] synth failed', err); st.cache.delete(e.key); e.reject(err); }
      }
    } finally { st.busy = false; }
  }
  function request(text) {
    const key = keyOf(text); st.wanted.add(key);
    const hit = st.cache.get(key); if (hit) return hit.promise;
    const e = { key, text };
    e.promise = new Promise((res, rej) => { e.resolve = res; e.reject = rej; });
    e.promise.catch(() => { /* handled by the caller */ });
    st.cache.set(key, e); st.queue.push(e); trimCache(); pump();
    return e.promise;
  }
  const lookup = text => { const e = st.cache.get(keyOf(text)); return e && e.url ? e.url : SILENT_WAV; };
  const chunkText = (m, from, to) => m.text.slice(from, to).replace(/\s+/g, ' ');

  /* ---------- hook into the existing read-aloud engine ---------- */
  const origOnline = T.online, origMode = T.mode, origSpeakOnline = T.speakChunkOnline, origStop = T.stopOnline, origErr = T.onlineError;

  T.online = function () { return usable() ? true : origOnline.call(this); };
  T.mode = function () { return usable() ? 'plain' : origMode.call(this); }; // short chunks: first sound arrives sooner
  T.stopOnline = function () { st.wanted.clear(); return origStop.call(this); };

  T.speakChunkOnline = function (i, from, tk) {
    if (!usable()) return origSpeakOnline.call(this, i, from, tk);
    const m = this.model, c = m.chunks[i], text = chunkText(m, from, c.e);
    this.idx = i; this.base = from;
    st.wanted.clear();
    const first = request(text);
    for (let k = 1; k <= AHEAD; k++) { const n = m.chunks[i + k]; if (n) request(chunkText(m, n.s, n.e)); }
    const wait = setTimeout(() => { if (tk === this.token) banner('Preparing voice…'); }, 700);
    first.then(url => {
      clearTimeout(wait); banner('');
      if (tk !== this.token) return;
      if (!url) { fail.call(this, 'Voice generation was interrupted'); return; }
      const orig = this.vrssUrl;
      this.vrssUrl = t => lookup(t);
      try { origSpeakOnline.call(this, i, from, tk); } finally { this.vrssUrl = orig; }
    }).catch(err => { clearTimeout(wait); if (tk === this.token) fail.call(this, 'Kokoro couldn’t start' + (err && err.message ? ' (' + err.message + ')' : '')); });
  };

  T.onlineError = function (i, from, tk) {
    if (!usable()) return origErr.call(this, i, from, tk);
    fail.call(this, 'Kokoro audio failed to play');
  };

  function fail(msg) {
    log('fail', msg); st.down = true; killWorker('stopped'); this.stopOnline();
    banner(msg + ' — using device voices', 6000); setStatus(msg);
    R.setAudio('engine', 'device'); // updates the settings and restarts reading with the device voice
  }

  /* ---------- settings UI (injected into the audio sheet) ---------- */
  function ensureUI() {
    const body = document.getElementById('audioBody'); if (!body) return;
    const seg = body.querySelector('[data-aseg="engine"]'); if (!seg) return;
    if (!seg.querySelector('[data-v="kokoro"]')) {
      const b = document.createElement('button'); b.dataset.v = 'kokoro'; b.textContent = 'Kokoro (AI)'; seg.appendChild(b);
      b.classList.toggle('on', A.engine === 'kokoro');
    }
    let box = document.getElementById('kokoroBox');
    if (!box) {
      box = document.createElement('div'); box.id = 'kokoroBox'; box.style.marginTop = '10px';
      box.innerHTML =
        '<div class="row"><span>Voice</span><select id="kokoroVoice" aria-label="Kokoro voice" style="flex:1;min-width:0;height:44px;border-radius:10px;border:.5px solid var(--line);background:var(--card);color:var(--fg);font:inherit;font-size:14px;padding:0 10px">' +
        VOICES.map(v => '<option value="' + v[0] + '">' + v[1] + '</option>').join('') + '</select></div>' +
        '<div class="key-row"><button class="small-btn" id="kokoroLoad">Download voice now</button></div>' +
        '<p class="hint" id="kokoroStatus"></p>' +
        '<p class="hint">Natural AI voice that runs on your device in the background. English books only; other languages use your device voice. The first use downloads about 90 MB and stores it for next time. It can be slower than device voices on older phones.</p>';
      const anchor = document.getElementById('vrssBox');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling); else seg.parentNode.appendChild(box);
    }
    const sel = document.getElementById('kokoroVoice'); if (sel && document.activeElement !== sel) sel.value = voice();
    const show = A.engine === 'kokoro';
    if (box.classList.contains('hidden') === show) box.classList.toggle('hidden', !show);
    if (show && !isEnglish() && !st.notedLang) { st.notedLang = true; setStatus('This book isn’t in English, so your device voice will be used.'); }
  }

  function prime() { // lets the audio element play later without another tap (iOS/Chrome autoplay rules)
    try {
      const a = T.audioEl || (T.audioEl = new window.Audio());
      if (a._kPrimed || a.onended) return; a._kPrimed = true;
      a.src = SILENT_WAV; const p = a.play(); if (p && p.catch) p.catch(() => { /* ignore */ });
    } catch (e) { /* ignore */ }
  }

  function wireUI() {
    const body = document.getElementById('audioBody');
    if (!body) { setTimeout(wireUI, 200); return; }
    body.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.v === 'kokoro' && b.closest('[data-aseg="engine"]')) { st.down = false; prime(); startWorker().catch(() => { /* status shows the error */ }); return; }
      if (b.id === 'kokoroLoad') { st.down = false; prime(); startWorker().catch(() => { /* status shows the error */ }); }
    }, true);
    body.addEventListener('change', e => {
      if (e.target.id !== 'kokoroVoice') return;
      R.setAudio('kokoroVoice', e.target.value); // saves with the other audio settings
      st.wanted.clear(); T.restartSoon();
    });
    new MutationObserver(ensureUI).observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    ensureUI();
  }
  wireUI();
  log('ready', 'extensions v2 loaded');
});
