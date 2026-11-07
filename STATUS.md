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

## Session 3: Reader on v2 (2026-11-07, branch `ui-v2/03-reader`)

**What changed**
- `docs/reader-controls.md`: every reader control, its v2 replacement, the handler it calls, and whether it was verified.
- `src/ui/reader/`: v2 top and bottom bars (they follow the engine's tap and auto-hide, and set the engine's reserved space so text never sits under them), a Contents sheet (contents, bookmarks, notes, highlights, Markdown export), a Settings sheet (every Appearance and Audio setting, including the 3D curl page turn, session 1 voices and downloads, and the v2 switch), a player sheet and a mini player docked above the bottom bar, the More sheet, and a selection menu positioned with Floating UI.
- `vendor/floating-ui/` (MIT, 1.8.0), logged in THIRD_PARTY_NOTICES.md.
- Engine (`index.html`): small shared functions and events only (`docs/reader-api.md`). The engine's Settings, Contents and More functions hand off to v2 when it is on, so keyboard shortcuts open the v2 sheets.
- With v2 on, `read-along-size.js` also skips ui-polish, ui-motion, ui-feedback and selection-touch. `reader-tools.js` keeps painting notes into the text but gives its panel and editors to v2. No files deleted.
- `dev/reader-check.js` and `dev/reader-controls-check.js` are test helpers.

**Controls table:** all rows verified (yes) at 390 px and 1280 px. Overlap check: zero at 320/390/430/768/1280 px and 844×390, with every sheet, the player and the selection menu open. tsc: zero errors. Console clean with v2 on and off. With v2 off: library, open book, page turns, read-aloud, Discover and the old sheets all work as before.

**Known issues**
- The engine's tool screens (dictionary, AI chat, speed reader, auto-scroll controls, vocabulary, PDF convert, message sheets) keep their old look and some text-symbol buttons. They open from v2 at the right layer.
- In landscape on a phone with read-aloud on, bars plus mini player leave about 210 px for text. Immersive bars gives more room.
- Immersive bars intentionally float over text (user option).

**Check on a real iPhone:** the selection menu opens below the selection with no iOS callout; the bars and mini player clear the notch and home indicator; audio keeps playing in the background and on the lock screen; the 3D curl page turn stays smooth.

**Worker redeploy required: NO**

## Session 4: Discover on v2 (2026-11-07, branch `ui-v2/04-discover`)

**What changed**
- `src/ui/discover.ts`: a full-screen v2 Discover with:
  - debounced search, with stale requests dropped
  - sorting (Popular, Title, Author)
  - a list on phones and a grid from 640 px
  - lazy covers in fixed 2:3 boxes, with a generated title/author card when there's no cover or it fails
  - "Load more"
  - loading skeletons, empty state, offline/error state with Try again
  - a detail sheet with summary, subjects, Add to library, "Already in your library" + Open book, and Read on site
  - Back (button or gesture) closes Discover; reopening keeps the query, results and scroll position
- Filter kept from the old Discover: only books marked public domain in the USA that have an EPUB.
- Add to library uses the existing import path (`__marginaliaSaveBook`). It now tries the Worker's `/book` route first, then the direct link, the same order as Read on site, because Gutenberg's download redirect has no CORS header and browsers block it.
- Old layers: `build/book-catalog.js` and `fixes/catalog-paging.js` step aside when v2 is on. No files deleted.
- Overlay manager fix: a reused panel kept its fade-out and reopened invisible. The leftover animation is now cleared on close and reopen.

**API endpoints** (keyless, called from the browser)
- `https://gutendex.com/books/?copyright=false&mime_type=application/epub+zip&search=…&sort=popular`
  - Sort is server-side for Popular only (documented values: popular, ascending, descending). Title and Author are sorted in the browser over the books loaded so far, and the page says so.
- Fallback when Gutendex fails or takes more than 8 s (remembered for 6 hours):
  - `https://www.gutenberg.org/ebooks/search.opds/?query=…&sort_order=downloads` (the old Discover's source), plus `https://www.gutenberg.org/ebooks/<id>.opds` only when a book's details are opened (public-domain check, EPUB link, summary, subjects).
  - Covers: `https://www.gutenberg.org/cache/epub/<id>/pg<id>.cover.medium.jpg`
- Responses are cached in memory per session, and the same request is never sent twice in parallel.

**Tested** (desktop Chrome):
- `tsc`: zero errors; unit tests 9/9.
- Overlap check: zero at 320/390/430/768/1280 px (list or grid, top and bottom, detail open).
- At 390 px (fallback, Gutendex was down) and 1280 px (Gutendex): search, sort, open details, add to library, then open the imported book in the reader.
- With v2 off: library, open book, page turns, read-aloud and the old Discover work as before.

**Known issues**
- Gutendex search was unreliable during testing (503s and timeouts of over 20 s), so the first search after it fails waits up to 8 s before the fallback. While it's down the browser console shows its failed request.
- In fallback mode the list shows no language or download count until a book's details are opened.
- Title/Author sort covers only the books loaded so far.

**Check on a real iPhone:** covers loading on cellular (lazy, so only visible ones load); adding a book (needs the Worker URL saved in Settings › Audio) and then opening it.

**Worker redeploy required: NO**

## Session 5: Reader features (2026-11-07, branch `ui-v2/05-features`)

**What changed** (v2 only; with `marginalia.ui` unset the app is unchanged)
- Search in book: the whole book, ignoring case and accents, results grouped by chapter with snippets. Tapping a result jumps there and highlights it; a match bar steps previous/next. Runs in short slices so the page stays responsive (War and Peace: about 0.5 s the first time, about 40 ms after that).
- Time left in chapter and book, from your measured reading speed (idle gaps over 2 min and jumps are ignored; 250 wpm until there are 3 measured minutes), or from the read-aloud speed while it plays. Shown in the bottom bar and in Go to page.
- Go to page: "Page X of Y at current settings", accepts a page or a percentage like 40%, validates input, and waits for the page-turn animation to finish before jumping.
- Reading stats (More, in the reader or the library): today, this week, streak, books finished, average speed, a 30-day chart, and Reset stats with confirmation. Stored in `localStorage` (`marginalia.stats.v1`); no IndexedDB change.
- Engine: one small method, `ttsCharsPerSec()`. Docs: `docs/reader-controls.md` §8, `docs/reader-api.md`.

**Tested** (desktop Chrome): `tsc` zero errors; overlap zero at 320/390/430/768/1280 px with each new sheet open and with the match bar; search, Go to page at two font sizes and during a page turn, stats with simulated time; v2 off: library, open book, page turns, read-aloud, old Discover. Console clean both ways.

**Known issues**
- Page numbers are an estimate: they can shift once per settings change, after the first full chapter is measured.
- The match bar covers about one line of text while it is open.
- Words per minute assumes about 6 characters per word. Stats are per device and only count time with the book open and in use.
- Search is not available for PDFs.

**Check on a real iPhone:** search speed on a long book; time-left accuracy after reading 10+ minutes; stats still there after closing and reopening the app (and after iOS clears idle site data).

**Worker redeploy required: NO**

**Ready for owner review** (before v2 becomes the default and the old `fixes/` layers are removed)
- [ ] Library: import, open, edit, delete, sort and filter books
- [ ] Reader: page turns (curl and fade), bars, Contents, bookmarks, notes, highlights, Appearance settings
- [ ] Read-aloud: Apple voices and Edge voices, mini player, sleep timer, read-along, downloads
- [ ] Discover: search, details, add to library, open the added book
- [ ] Search, Go to page, time left and Reading stats on your iPhone
- [ ] Everything at phone and desktop sizes, light and dark, and with Reduce Motion on
- [ ] Once happy: make v2 the default, then remove the old `fixes/` layers in a separate change

## Bugfix pass (2026-11-07, branch `fix/bugfix-pass`, from `main` after PR #5)

**Bugs: cause → fix → file**
- 0 Dictionary: a hard cap of 8 tabs refused new lookups. The cap is now 24 and the oldest unlocked tab is recycled → `index.html` (`DICT_MAX_TABS`). I found no "10" anywhere, so I took "10 page number limit" to mean this cap.
- 1 Edge TTS: the URL field was empty and nothing worked without it. Direct browser → Microsoft is not possible (the Worker's own header says Microsoft refuses web pages; my probe from a github.io origin was refused at the handshake and I stopped there). The deployed Worker is `marginalia.flickeringtruth.workers.dev` (GET 200 with the site's CORS headers). It is now the built-in `DEFAULT_TTS_ENDPOINT`; the address field moved to a collapsed **Advanced** section → `index.html`, `src/ui/reader/voices.ts`.
- 2 Voices: one searchable list, "Online (Edge)" + "On this device", language, gender where known, per-row Preview, status line with Retry, iOS note (Apple voices can be downloaded; Siri voices are not available to websites). Picking a row sets engine + voice together and restarts the player once → `src/ui/reader/voices.ts`, `settings.ts`, engine `selectVoice`/`previewVoiceFor`/`edgeCheck`.
- 3 Settings would not scroll on iPhone. Two causes: (a) a document-level `touchmove` guard cancelled every touch outside a hard-coded selector list that never included v2's scroll containers (proved on unmodified `main`: `defaultPrevented` true, scrollTop stays 0); (b) the engine sets `touch-action:none` on every range input, so a swipe starting on one of the many sliders never scrolled. Fixes → `index.html` (`inScrollable`), `src/ui/components.ts` (sliders `pan-y`; Sheet: vh→svh→dvh height, drag-to-dismiss only from handle/header or from the body at scrollTop 0, bottom padding = safe area + 32 px, lifts above the keyboard).
- 4 Layout: audited library, Discover, reader and every sheet at 320 px: one scroller per screen, no fixed element inside a transformed ancestor, no inputs under 16 px, no horizontal scroll. Fixed: library scroll position lost after reading (`src/ui/library.ts`), a `100vw` (`index.html`). `#stage{touch-action:none}` is by design: the engine scrolls and turns pages in JS.
- Visual: app theme (`src/ui/theme.ts`, palette in `index.html` `<head>` so nothing flashes; reading themes untouched), flux background (`src/ui/flux.ts`, simplex-noise 4.0.3, 18.7 KB, MIT, in `vendor/` and THIRD_PARTY_NOTICES). Measured: 30 fps, 0 fps when hidden, still frame under reduced motion, 32×54 canvas. All text tokens pass AA in both themes (computed).

**Decisions I made**
- Light-theme accent text is a darker orange (`#a94c2a`); the accent fill is unchanged. Text on the fill is dark (5.9:1), because white on `#d97757` is only 3.1:1.
- Light "raised" level is `#f2f0e9` (not in your list). Reader bars and mini player keep following the reading theme; sheets, menus, library and Discover follow the app theme. App theme and flux only apply in v2 (still opt-in).
- The Edge voice list stays bundled (names, gender); "loading" is the service check, so the list is never empty. No Worker change.
- tsconfig `newLine: lf` so Windows builds stop rewriting every file in `build/`.

**Verified** (Playwright, Chromium + WebKit at 320, 390, 430, iPad both ways, Pixel 7, 1280, 1440, 16 of 16 combinations green; **Firefox could not be launched on this machine (`spawn UNKNOWN`), so it is untested**): Settings scrolled to its last item (real touch in Chromium; WebKit has no touch API, so there the guard is tested with a synthetic `touchmove` plus scrollTop), overlap check zero, no horizontal scroll, dark/light with no flash, flux on/off, library scroll kept. Reader controls 76/76 (393 px) and 78/78 (1280 px); Settings controls 64/64 at both. Edge on a clean profile: Preview returned 200 `audio/mpeg`, a chapter played. `tsc` zero errors, unit tests 9/9.

**Known / not done**
- Engine tool screens (dictionary, AI chat, speed reader) still follow the reading theme. `api.dictionaryapi.dev` logs a CORS error and the lookup falls back to Wiktionary. Light accent fill on white is 2.96:1 (non-text).
- The old controls check leaves the app via `history.back()` in a fresh tab (same on `main`); tests pad the history.

**Check on a real iPhone:** Settings scroll, including a swipe that starts on a slider · Edge voices with no setup · Apple voice list and the iOS note · Safari's floating toolbar over the last Settings row · flux battery and smoothness on a long scroll.

**Worker redeploy required: NO.** The Worker is unchanged and already live.
