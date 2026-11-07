# Status

## Session 1: Voices + TTS (2026-11-07, branch `ui-v2/01-tts`)

**What changed**
- `index.html` (voice/TTS code only): the novelty-voice filter now checks voice *names* only, so Apple's normal voices (IDs like `com.apple.voice.compact.*`) and Enhanced/Premium voices show again. Voice loading retries with backoff for ~10 s, then again after the first tap/key press and when the page comes back into view. Only after that does the list say no voices were found.
- `index.html`: EdgeTTS honours `Retry-After` on 429 with backoff. After 3 429s in a row, reading continues with the selected (or best) device voice for this session, with a short notice. Downloaded audio is played before any network request. New honesty text in the EdgeTTS box and the voice-lock hint.
- `edge-proxy-worker.js`: successful audio is cached at the edge (`caches.default`, key = SHA-256 of voice, rate, pitch, format and text) with `Cache-Control: public, max-age=31536000, immutable`. Header `X-TTS-Cache: HIT/MISS`. Errors and 429s are never cached. 429 responses always carry `Retry-After` (5 s default). The 1200-character limit is unchanged.
- `src/tts-downloads.ts` → `build/src/tts-downloads.js` (loaded from `fixes/read-along-size.js`): "Download chapter" / "Download book" in the EdgeTTS box. Requests go one at a time with a short gap, pause on 429 and resume. Progress bar, Cancel, Delete, storage used, and `navigator.storage.persist()`. Audio lives in Cache Storage `marginalia-tts-downloads-v1`; the list of downloaded chapters is in localStorage `marginalia.ttsDownloads.v1`. No IndexedDB changes.
- `tsconfig.json`: includes `src/**/*.ts`.

**How it was tested** (desktop Chrome in a test browser, 390 px and 1280 px, with a stand-in Worker that returns test tones)
- `npm run build`: zero errors. No console errors from the app.
- Voice list with a simulated Apple voice set: Samantha/Karen (compact), Daniel (enhanced), Ava (premium), Eddy, Reed, Morgan are shown; Albert, Bad News, Zarvox, Whisper, Pipe Organ are hidden.
- Download book → played it with the Worker unreachable: every sentence came from downloads, no network requests, ran into the next chapter.
- One 429 → "Voice service is busy. Retrying…", carried on with Edge. Three 429s → switched to the device voice with a notice.
- Download with 429s → paused, resumed, finished. Cancel and Delete work.
- Old path with Edge off: library, open book, page turns, device read-aloud, Discover search all work.

**Known issues / not tested**
- Not tested against the real Microsoft service or the real Worker. Its CORS only allows the GitHub Pages site, and running it locally needs `wrangler`, which was not installed.
- The Worker cache does nothing on a `*.workers.dev` address (Cloudflare limitation). It only works on a custom domain/route.
- Biggest remaining cause of rate limits: Edge sends one request per *sentence*. Grouping sentences (up to ~1100 chars) would cut requests several times over. That was out of scope here; it is the suggested next step.
- Downloads are tied to voice + pitch + cadence. Changing any of them needs a new download.

**Check on a real iPhone**
- Safari voice list shows Samantha and other compact voices, plus any Enhanced/Premium voices installed.
- How long the voice list takes to fill on a cold start, and that tapping the list refreshes it.
- Download a chapter, turn on Airplane mode, play it.
- Whether downloads survive a few days (Safari can clear site storage it considers unused).

**Worker redeploy required: YES**
1. Cloudflare dashboard → Workers & Pages → open the Marginalia Worker → Edit code.
2. Replace `edge-proxy-worker.js` with the version from this branch (`worker.js` is unchanged). Deploy.
3. Or from a terminal in the repo: `npx wrangler deploy`.
4. Optional, for the cache to work: Settings → Domains & Routes → add a custom domain, then put that address in the app's EdgeTTS Worker URL.
5. Check: play a sentence twice; the second response should show `X-TTS-Cache: HIT` (custom domain only).
