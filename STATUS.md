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

**Worker redeploy required: YES (automatic on merge)**
1. The Worker is connected to this repo through Cloudflare Workers Builds, so merging to `main` redeploys it. Check the "Workers Builds: marginalia" status on the merge commit is green.
2. If that build fails, the old Worker keeps running. Open the build log in the Cloudflare dashboard (Workers & Pages → marginalia → Deployments/Builds) to see why.
3. Optional, for the cache to work: Settings → Domains & Routes → add a custom domain, then put that address in the app's EdgeTTS Worker URL.
4. Check: play a sentence twice; the second response should show `X-TTS-Cache: HIT` (custom domain only).
5. Note: the preview build for this branch failed on Cloudflare (log not visible from GitHub). Look at it before merging.

## Session 2: UI foundation + library (2026-11-07, branch `ui-v2/02-foundation`, built on `ui-v2/01-tts` because PR #1 was not merged yet)

**What changed**
- `docs/ui-audit.md`: why things overlap (23 competing z-index values, transformed ancestors, duplicate bars/sheets/toasts, `!important` overrides, mixed safe-area code, `vh` on iOS, 6 observers on one grid), with file:line refs. It also confirms a bug in the current UI: tapping ⋯ on a cover opens the editor *and* the book.
- `src/ui/`: tokens (colour aliases of the current themes, spacing, radius, type, motion), one z-index scale (base 0 < bars 100 < sheet 200 < overlay 300 < menu 400 < toast 500), app shell with bar slots that reserve their own space, one overlay stack in a single portal (focus trap, Escape, backdrop, Back gesture), one SVG icon set, and components: Button, IconButton, Chip, Field, Sheet, Menu, Toggle, Slider, Segmented, ListItem, Toast, Empty/Error state.
- `src/ui/library.ts`: the library rebuilt on it. It keeps the greeting, Discover, More, Import, continue reading, stats, status filters, pins, categories (add/rename/delete), Start here (Save to device / Read on site), the editor (title, author, cover, ready-made designs, pin, category), delete, the empty state, drag-and-drop import, the book-opening animation, progress and finished badges. Same storage as before. Books are matched by id, not title.
- Engine: small `window.__reader` hooks and three events (`docs/reader-api.md`, `src/reader-api.d.ts`), plus a two-line `<head>` check so the old library never flashes when v2 is on.
- Old layers: `fixes/read-along-size.js` loads the same layers in the same order, but skips `library-ui`, `magic-motion`, `library-depth` and `library-type` when v2 is on. `library.js` and the tag part of `tag-position.js` also step aside in v2. `book-open.js` gained an open-by-id hook, and `read-on-site.js` opens directly in v2. No files deleted.
- `dev/overlap-check.js`: reports any two visible interactive elements whose boxes intersect.

**Switch v2 on/off:** Settings › Appearance › Interface › "New interface (preview)". It sets or clears localStorage `marginalia.ui` = `v2` and reloads.

**Tested** (desktop Chrome, 390 px and 1280 px): `tsc` zero errors. No app console errors with v2 on or off. Overlap check reports none with v2 on: library at top, middle and bottom, menu open, editor open, sheet over sheet. The same check flags the old UI's delete button on the cover. With v2 off: library, open book, page turns, device read-aloud and Discover all work as before.

**Still old UI:** reader screen, Settings, More, Discover, message/confirm sheets, name screen, user settings (sessions 3–4). Their layers are mapped onto the v2 scale while v2 is on, so toasts now show above dialogs. Tilt, glare and spotlight on covers were not carried over. Fonts still load from Google Fonts at runtime, as before. Vendoring them is a follow-up.

**Check on a real iPhone:** the header clears the notch and the content clears the home indicator, in portrait and landscape; sheets sit above the home indicator; scrolling the library while Safari's toolbar collapses and expands (dynamic viewport) leaves no gap or jump; the Back swipe closes an open sheet first; covers tap through to the opening animation.

**Worker redeploy required: NO** (session 2 did not change the Worker).
