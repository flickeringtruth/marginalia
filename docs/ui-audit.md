# UI audit: why things overlap and float

Session 2, 2026-11-07. Read-only review of `index.html` and every file in `fixes/`. Line numbers are from branch `ui-v2/02-foundation` before any v2 code.

## 1. Competing z-index values (no scale)

There are 23 different z-index values, from -1 to 9999, set in 13 files. Nothing defines which layer is above which.

| Element | z-index | Where |
|---|---|---|
| `#paper` texture | 14 | index.html:538 |
| `#selLayer` (selection handles) | 15 | index.html:287 |
| `#selMenu` (selection actions) | 16, then forced to 21 `!important` | index.html:291, fixes/speech.js:47 |
| `.chrome` (top and bottom bars) | 20 | index.html:258 |
| `#dictFloat` | 21 | index.html:542 |
| `#audioBar` (read-aloud player) | 22 | index.html:436 |
| `#autoScrollControls` / `#speedReader` | 30 / 39 | index.html:178, 135 |
| `#scrim` / `.sheet` / `.drawer` | 40 / 50 / 50 | index.html:310, 312, 364 |
| `#loading` / `#nameGate` / `.drop-hint` | 80 / 90 / 90 | index.html:407, 662, 126 |
| `#toast` | 95 | index.html:411 |
| `.ml-overlay` (book editor, categories) | 96 | fixes/library.js:363, fixes/reader-tools.js:420 |
| `.ml-over2` | 97 | fixes/reader-tools.js:421 |
| `.mlu-overlay` (user settings) | 98 | fixes/user-data.js:362 |
| `.ml-part` (click particles) | 200 | fixes/ui-feedback.js:19 |
| `.mlb-overlay` (book opening) | 300 | fixes/book-open.js:34 |
| `.ab-lyrics` fullscreen fallback / `#dim` | 1000 / 9999 | index.html:451, 414 |

Effects you can see:
- **Toasts hide behind dialogs.** The toast is 95 but module dialogs are 96–98, so messages like "A book needs a title" (fixes/library.js:262) appear under the dimmed backdrop.
- **The selection menu sits under the read-aloud player.** It was raised to 21 to clear the bars (speech.js:47) but `#audioBar` is 22.
- **`#selMenu` and `#dictFloat` are both 21**, so DOM order decides which one wins.
- **Engine sheets (50) open under module dialogs (96–98).** A confirmation opened from a module dialog can end up behind it.

## 2. Fixed elements and transformed or filtered ancestors

A `transform`, `filter`, `perspective` or `will-change: transform` on an ancestor makes `position: fixed` relative to that ancestor and starts a new stacking context.
- **Every library cover is wrapped in a 3D context.** `fixes/library-depth.js:21-23, 98-101` wraps each cover in `.ml-tilt` with `perspective()`, `preserve-3d` and `will-change: transform`. The delete button (z 4), edit tag (z 3), done badge (z 3) and gloss (z 2) now stack inside different contexts, so their z-indexes no longer compare the way the CSS suggests.
- **Cards are briefly filtered.** `fixes/magic-motion.js:65-66` animates `filter: blur()` on every card during the entrance, so each card is a containing block while it animates.
- **The selection menu's transform has three owners.** index.html:292 centres `#selMenu` with `translate(-50%)`, its animation also uses `translate(-50%, …)` (index.html:295), and `fixes/selection-touch.js:14` forces `transform: none !important`.
- **The bars sit in their own stacking context.** `.chrome` bars use `transform: translateY(±10px)` when hidden (index.html:270, 276) plus `backdrop-filter` (index.html:259). Anything placed inside them is trapped in that context.
- **The library header is a stacking context too.** The sticky header has `backdrop-filter` and `isolation: isolate` (fixes/library-polish.js:21-34) at z 6.

## 3. Duplicate bars, sheets and toasts

- **Two filter bars.** `fixes/library.js` adds chips (All, ★ Pinned, categories, ⚙ Categories). `fixes/library-ui.js` adds a second bar (All, Reading, New, Finished). They hide cards in different ways (`style.display` at library.js:142 versus the `hidden` attribute at library-ui.js:188). When a category hides every book, the "No books in this filter" message stays hidden because it only counts its own filter (library-ui.js:189-190).
- **Four dialog systems, no shared stack:**
  - engine `.sheet` with `#scrim` (index.html:310-321)
  - `.ml-overlay` (library.js:213, 306)
  - `.mlu-overlay` (user-data.js:119)
  - `.ml-overlay` / `.ml-over2` (reader-tools.js:420)

  Opening one doesn't close, block or move focus away from the others. Only engine sheets respond to Escape or Back.
- **Three toast writers share `#toast` with separate timers:** the engine, library.js:12-16 and covers.js:17-21. Their timers cut each other's messages short.

## 4. Load-order overrides

Later files override earlier ones with `!important` instead of a single source of truth:
- `fixes/library-polish.js` overrides `#libGrid`, `#library` padding and `.lib-actions` with `!important` (lines 16, 45-46, 59-66).
- `fixes/library-type.js:65` re-pads the header after library-polish.
- `fixes/tag-position.js:17` repositions `.ml-tag` with `!important` after library.js:343 placed it.
- **The "finished" badge clashes with the cover gloss and the delete button.** `fixes/library-ui.js:80-84` draws the badge as `.cover-btn::after`, the same pseudo-element library-polish.js:81-84 uses for the gloss. On finished books the gloss disappears, and the badge lands at top 8 px / right 8 px. That's the same corner as the 36 px delete button (library-polish.js:92), so they overlap.

## 5. Safe-area padding

- **Two mechanisms are mixed.** Some rules use `var(--sat/--sab/--sal/--sar)` tokens (index.html:21-22). Others call `env()` directly (library.js:364, book-open.js:50, user-data.js:363), so a later change to the tokens won't reach them.
- **Missing insets:**
  - `.drop-hint` uses `inset: 12px` with no safe areas (index.html:126), so it sits under the notch and home indicator in landscape.
  - `.ml-sheet` and `.mlu-sheet` have no left/right insets (library.js:364, user-data.js:363).
- **Header padding is set three times:** index.html:66 puts `--sat` in `#library` padding, library-polish.js:16,25 moves it into the sticky header, and library-type.js:65 sets it again.

## 6. 100vh versus dynamic viewport units

On iOS Safari, `100vh` is the *largest* viewport, so anything sized in `vh` is taller than the visible area while the toolbars are showing. `body` and `.sheet` correctly fall back to `dvh` (index.html:36, 312). These do not:
- `--imgmax: 80vh` (index.html:27)
- `.empty` margin `12vh` (index.html:104, library-polish.js:102)
- speed reader `28vh` / `7vh` (index.html:142-149)
- lyrics padding `38vh` (index.html:462)
- `.vocab-card` `8vh` (index.html:610)
- `max-width: 100vw` (selection-touch.js:14), which also includes the desktop scrollbar width

## 7. Handlers and observers attached more than once

- **Six observers on the library grid:** library.js:149, library-ui.js:147, library-depth.js:151, magic-motion.js:165 and tag-position.js:29 (that one on the whole subtree). Two more watch the entire page: ui-polish.js:124 and covers.js:114. Each re-decorates after the others, so one redraw triggers a chain of re-renders.
- **A button inside a button, confirmed in the browser.** `fixes/tag-position.js:24` moves the ⋯ edit button *inside* the cover button. book-open.js:299-302 listens on `document` in the capture phase, so it sees the tap before library.js's grid listener (library.js:95-99) can stop it. **Tapping ⋯ opens the editor and also opens the book behind it.**
- **Books are matched by visible text.** library.js:118-121 matches cards by title + author text, and book-open.js:306 finds the book by title alone. Two books with the same title get each other's pins, categories and opening animation.
- **"Resume" clicks a hidden grid card** (library-ui.js:141-145) instead of opening the book directly.

## Old layer → what replaces it in v2

| Old layer | In v2 (`marginalia.ui = "v2"`) |
|---|---|
| `fixes/library.js` (pins, categories, Start here, editor, save to device) | `src/ui/library.ts`, same storage (`marginalia.library`, IndexedDB `meta`). Also provides `window.__marginaliaSaveBook` so Discover keeps working. Skipped in v2. |
| `fixes/library-ui.js` (continue card, stats, status filters) | `src/ui/library.ts`: one filter bar for status, pins and categories. Skipped. |
| `fixes/library-polish.js` | Library parts → `src/ui/library.ts` + tokens. Its Discover/More/message sheet styling is still loaded, because those sheets are rebuilt in sessions 3–4 (its `#library` rules do nothing while the old library is hidden). |
| `fixes/library-depth.js` (tilt, glare, spotlight, aura) | Spine, gloss and colour aura in CSS. Tilt, glare and spotlight are not carried over. Skipped. |
| `fixes/magic-motion.js` | One entrance animation (Web Animations API) and a CSS shine on the continue card. Skipped. |
| `fixes/library-type.js` | Type scale in `src/ui/tokens.ts`; same fonts (Instrument Serif, Inter). Skipped. |
| `fixes/tag-position.js` (moving ⋯ into the cover) | Edit button sits outside the cover, so no nested buttons. Tag part skipped; its module imports still load. |
| `fixes/book-open.js` | Kept. v2 calls a new hook with the real book id instead of a title lookup. |
| `fixes/covers.js` | Kept. Attaches to the v2 editor through the same field ids. |
| Engine `.sheet`, `#scrim`, `#toast`, `.ml/.mlu` overlays | Kept for now, mapped onto the v2 z-index scale while v2 is on. Rebuilt in sessions 3–4. |
| `ui-polish`, `ui-motion`, `ui-feedback`, `selection-touch`, `speech`, `reader-tools` | Kept. Reader UI is session 3. |
