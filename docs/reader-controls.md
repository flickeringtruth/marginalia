# Reader controls

Every control the reader offers, in `index.html` and the `fixes/` layers, and what replaces it in v2 (`localStorage marginalia.ui = "v2"`).

Columns: **v2 control** is what the user taps in v2; **handler** is the engine function it calls (through `window.__reader`); **verified** is whether it was clicked in the browser at 390 px and 1280 px.

**Re-verified in the bugfix pass (2026-11-07, Playwright, Chromium 393 px and 1280 px, real Worker):**
- `dev/reader-controls-check.js`: every control clicked again, 76 of 76 yes at 393 px (Pixel/iPhone size) and 78 of 78 at 1280 px.
- Settings (both tabs): every segmented option, toggle, slider and chip clicked one by one, 64 of 64 changed state at 393 px and at 1280 px (the "New interface" switch is excluded because it reloads the page).
- The new voice picker was clicked end to end on a clean profile with no saved address: search by name and gender, pick an Edge voice, Preview (POST to the built-in Worker answered 200 `audio/mpeg`), play a chapter with Edge, switch to a device voice while playing, "Show voices in other languages", Advanced > Save with a bad address (status shows the failure and Retry), Retry, Use built-in, choice remembered after a reload.
- The test tab needed a padded history: some `closeAll()` step of the old check calls `history.back()` past the first entry and leaves the app (it does the same on the unmodified `main`; not investigated).

**How it was first verified (session 3, desktop Chrome):**
- `dev/reader-controls-check.js` clicks each control and checks that its handler changed something (page, setting, storage, player state, or a sheet/menu opening): 78 checks at 390 px, 80 at 1280 px (Bookmarks and Dictionary only show in the top bar from 480 px).
- Appearance and Audio settings were checked separately, one control at a time (56 checks).
- Auto scroll switches the book to Scroll mode, which needs animation frames. It was confirmed by hand at both widths with the browser in the foreground.
- Edge preview and Edge downloads were tested against a stand-in Worker.
- `dev/reader-check.js` ran the overlap check at 320, 390, 430, 768 and 1280 px plus 844×390 (landscape): bars, bars + mini player, every Contents tab, both Settings tabs (top and bottom), More, the player, the sleep menu and the selection menu. Zero intersections.

## 1. Bars

| Old control (where) | v2 control | Handler | Verified |
|---|---|---|---|
| Tap page to show/hide bars, auto-hide (index.html `handleTap`, `setChrome`) | Same behaviour, v2 bars follow `body.chrome-on` | engine `handleTap` / `setChrome` (unchanged) | yes |
| Back to library `#backBtn` | Top bar: Library (icon `chevron-left`) | `closeBook()` | yes |
| Contents `#tocBtn` | Top bar: Contents | v2 Contents sheet (`App.book.toc`, `App.goTo`) | yes |
| Bookmarks and notes `#mlBookmarkBtn` (reader-tools.js) | Top bar: Bookmarks | v2 Contents sheet, Bookmarks tab | yes |
| Read aloud `#audioBtn` | Top bar: Read aloud | `TTS.toggle()` | yes |
| Dictionary `#dictBtn` | Top bar: Dictionary | `dictionaryButton()` | yes |
| More `#moreBtn` | Top bar: More | v2 More sheet → `moreAction(id)` | yes |
| Appearance `#settingsBtn` ("Aa" text) | Top bar: Appearance (icon `type`) | v2 Settings sheet | yes |
| Book and chapter title | Top bar title (not a control) | `progressInfo()` | yes |
| Previous / next page `#prevBtn` `#nextBtn` | Bottom bar: Previous / Next | `App.r.prev()` / `App.r.next()` | yes |
| Scrubber `#scrubber` + label | Bottom bar: position slider + label | `goToPercent(p)` | yes |
| Floating dictionary `#dictFloat` (when bars hidden) | Kept (engine), on the v2 scale | `dictionaryButton()` | yes |

## 2. Contents, bookmarks, notes, highlights (drawer + reader-tools.js panel)

| Old control | v2 control | Handler | Verified |
|---|---|---|---|
| Contents list (drawer) | Contents tab: chapter rows, current one marked | `App.goTo({ch, frag})` | yes |
| Highlights tab (drawer) / Highlights tab (panel) | Highlights tab: go to, remove | `App.goTo`, `HL.remove` | yes |
| Bookmark this place | Bookmarks tab: "Bookmark this place" | localStorage `marginalia.bookmarks.<id>` | yes |
| Bookmark search, sort (in order / newest), edit, delete | Bookmarks tab: search field, Segmented sort, row menu (Edit / Delete) | same storage | yes |
| Notes list, edit, delete; tap a note in the text | Notes tab + v2 note editor; text taps open it | `marginalia.notes.<id>`, reader-tools repaint | yes |
| Export as Markdown | Export button | same Markdown as reader-tools.js | yes |

## 3. Settings › Appearance (index.html `buildSettings`)

| Old control | v2 control | Handler | Verified |
|---|---|---|---|
| Text size A / A | Smaller / Larger buttons + value | `setSetting('fontSize')` | yes |
| Brightness | Slider | `setSetting('brightness')` | yes |
| **App theme: Dark / Light** (bugfix pass; the app chrome, not the page) | Segmented, first group "App" | `setAppTheme()` (src/ui/theme.ts): `data-app-theme` + localStorage `marginalia.appTheme` | yes |
| **Animated background** (flux) on/off (bugfix pass) | Toggle in the "App" group | `setFluxEnabled()` (src/ui/flux.ts): localStorage `marginalia.flux` | yes |
| Reading page themes (incl. Custom, Gradient), group "Reading page theme" | Theme swatches | `setSetting('theme')` | yes |
| Custom background / text colour | Two colour inputs | `setSetting('customBg'/'customFg')` | yes |
| Gradient: colours, add, remove, angle, intensity, contrast note | Gradient editor | `setGrad()` | yes |
| Fonts | Font buttons | `setSetting('font')` | yes |
| Line spacing, margins | Sliders | `setSetting` | yes |
| Alignment, mode, pages, page turn (Slide/Fade/**3D curl**/None), momentum, progress | Segmented controls | `setSetting` | yes |
| Edge-tap navigation, highlight mode, immersive bars, keep dictionary button, paper texture | Toggles | `setSetting` | yes |
| Swipe sensitivity, scroll speed, animation speed | Sliders | `setSetting` | yes |
| Keyboard shortcuts list | List (not a control) | — | yes |
| Reset appearance | Button | `resetAppearance()` | yes |
| New interface (preview) | Toggle (Interface group) | localStorage `marginalia.ui` + reload | yes |

## 4. Settings › Audio (index.html `buildAudioSettings`, session 1)

| Old control | v2 control | Handler | Verified |
|---|---|---|---|
| **One voice picker** (bugfix pass; replaces the Engine segmented control, the two voice selects, previous/next and the two Preview buttons): search, groups "Online (Edge)" and "On this device", row = pick, play button = preview | Search field, radio rows, per-row preview, "Show N voices in other languages", "Check again" | `selectVoice(kind, id)` (sets engine + voice together, restarts playback once), `previewVoiceFor(kind, id)` | yes |
| Online voice service status + Retry (bugfix pass) | Status line, Retry button | `edgeCheck()` | yes |
| **Advanced** (collapsed): voice service address override, Save, Use built-in (bugfix pass; was always visible and empty) | Details, Field, Save, Use built-in | `setEdgeProxy(url)` (empty = built-in `DEFAULT_TTS_ENDPOINT`) | yes |
| Download chapter / book, cancel, delete (session 1) | Same box, rendered by tts-downloads | `__marginaliaTTSDownloads` | yes |
| Voice presets | Chips | `applyAudioPreset(v)` | yes |
| Lock voice, storytelling cadence | Toggles | `setAudio` | yes |
| Speed, pitch, volume | Sliders | `setAudio` | yes |
| Highlight follow / keep / colour | Segmented | `setAudio` | yes |
| Auto-scroll, turn pages automatically | Toggles | `setAudio` | yes |
| Start from | Segmented | `setAudio('startFrom')` | yes |
| Ambient sound + volume | Chips + slider | `Ambient.start`, `Ambient.setVol` | yes |
| Sleep timer (Off…60 min, end of chapter, custom) | Chips + custom field | `setAudio('sleep')` | yes |
| Run speech test, copy report | Buttons + result | `runSpeechTest()`, `speechReport()` | yes |
| Reset audio settings | Button | `resetAudio()` | yes |

## 5. Read-aloud player (`#audioBar`)

| Old control | v2 control | Handler | Verified |
|---|---|---|---|
| Play/pause (full, mini) | Play/pause (player sheet, mini player) | `TTS.toggle()` | yes |
| Back / forward 5 s | Buttons | `TTS.skip(∓5)` | yes |
| Previous / next paragraph | Buttons | `TTS.paragraph(∓1)` | yes |
| Seek slider + times | Slider + times | `TTS.seekFraction(p)` | yes |
| Slower / faster / reset 1× | Buttons + rate | `TTS.setRate()` | yes |
| Speed quick button | Merged into the rate controls | `TTS.setRate()` | yes |
| Voice quick button / audio settings | Voice button → Settings › Audio | v2 Settings sheet | yes |
| Sleep timer quick button | Sleep button → menu | `setAudio('sleep')` | yes |
| Read along (full, mini "≡") | Read along button (full, mini) | `AudioUI.openLyrics()` (engine view, kept) | yes |
| Read-along text A− / A+ | Buttons | read-along-size.js | yes |
| Stop | Stop button | `TTS.stop(true)` | yes |
| Close player | Sheet close | overlay manager | yes |
| Download chapter / book | Buttons | `__marginaliaTTSDownloads` | yes |
| "Voice is on another page": Read from here / Go to voice `#abChip` | Shown in the mini player | `TTS.readHere()` / `TTS.goToAudio()` | yes |
| Read-along view: close, fullscreen, play, tap a line, back | Kept (engine view), placed above the v2 bars | engine `AudioUI` | yes |

## 6. Selection menu (`#selMenu`)

| Old control | v2 control | Handler | Verified |
|---|---|---|---|
| Highlight colours (5) | Colour buttons | `selectionAction('color', c)` | yes |
| Look Up | Button | `selectionAction('define')` | yes |
| Ask AI | Button | `selectionAction('ask-ai')` | yes |
| Read | Button | `selectionAction('speak')` | yes |
| Copy | Button | `selectionAction('copy')` | yes |
| Share (when supported) | Button | `selectionAction('share')` | yes |
| Remove (on a highlight) | Button | `selectionAction('remove')` | yes |
| Note (reader-tools.js) | Button | v2 note editor | yes |

## 7. More sheet (index.html `openMore`)

| Old control | v2 control | Handler | Verified |
|---|---|---|---|
| Highlights, Auto scroll, Focus-word speed read, AI Assistant, Convert PDF (current / pick), Ambient sound, Appearance | v2 More sheet rows | `moreAction(id)` | yes |

## Not rebuilt in session 3 (engine tool screens, opened from v2)

These keep their engine UI and still contain some text-symbol buttons (×, ⌃, ▶). They open from v2 and sit on the v2 layer scale:
- dictionary sheet and vocabulary notebook
- AI assistant chat
- focus-word speed reader and its start chooser
- auto-scroll controls
- PDF conversion dialog
- message/confirm sheets

## 8. Session 5 features (v2 only)

New controls; nothing here replaces an old control. Verified at 320, 390, 430, 768 and 1280 px with zero overlaps (sheet open, and the match bar on its own).

| v2 control | Where | Handler | Verified |
|---|---|---|---|
| Search in book (top bar) | From 600 px wide; below that, in More | `openSearch()` (`src/ui/reader/search.ts`) | yes |
| Search in book row | More (EPUB, TXT and HTML books) | `openSearch()` | yes |
| Search field (Enter, or 300 ms after typing; 2+ characters) | Search sheet | whole-book search, ignores case and accents | yes |
| Result (snippet, grouped by chapter) | Search sheet | `App.goTo({ch, off})` + highlight | yes |
| Previous match / Next match | Match bar above the bottom bar | same | yes |
| Back to search results | Match bar | reopens the sheet with the last query | yes |
| Close search | Match bar | clears the highlight | yes |
| Go to page row | More | `openGoTo()` (`goto.ts`) | yes |
| Page or percentage field, Go, Cancel | Go to page sheet | `goToPercent()` after the page turn finishes | yes |
| Page · % · time left label | Bottom bar | `barLabel()` | yes |
| Reading stats row | More (reader and library) | `openStats()` (`stats.ts`) | yes |
| Reset stats → confirm / Cancel | Reading stats sheet | removes `marginalia.stats.v1` | yes |
