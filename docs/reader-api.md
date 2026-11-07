# `window.__reader`: the engine API

Code in `src/` talks to the engine in `index.html` only through `window.__reader`. Types are in `src/reader-api.d.ts`.

## Original handle

`App`, `S`, `HL`, `lookupWord`, `importFile`, `openBook(id)`, `setSetting`, `Sel`, `CONFIG`, `TTS`, `A`, `setAudio`, `AudioUI`, `Dict`, `AI`, `SpeedReader`, `AutoScroll`, `PdfConvert`, `Ambient`, `gradientTheme`, `setGrad`, `globalPages`.

Session 1 added `buildSpeechModel`, `edgeProxyUrl`, `retryAfterMs` and `toast`.

## Added in session 2 (v2 UI)

| Method | What it does |
|---|---|
| `listBooks()` | All book records from IndexedDB `books-reader` / `meta`. |
| `getBook(id)` | One book record. |
| `updateBook(id, patch)` | Changes `title`, `author`, or the cover (`coverBuf` + `coverType`, or `removeCover: true`), then redraws the library. Never changes the database version. |
| `storeBook(meta, buf)` | Saves a new book file and record (used for "Save to device"). |
| `deleteBook(id)` | Asks for confirmation, then deletes the book, its position and highlights (same as the old delete button). |
| `pickFiles()` | Opens the file picker used by Import. |
| `importFiles(files)` | Imports files, as if picked. |
| `openSample()` | Creates and opens the sample book. |
| `openMore(where)` | Opens the More sheet (`'library'` or `'reader'`). |
| `openSettings(tab)` | Opens Settings on `'look'` or `'audio'`. |
| `renderLibrary()` | Redraws the old library list (also fires `reader:library`). |
| `coverHtml(meta)` | The generated cover artwork used when a book has no cover image. |
| `editName()` | Opens the "What should we call you?" screen. |
| `libraryTitle()` | The current greeting, e.g. "Welcome, Jay!" or "Library". |

## Events dispatched on `document`

| Event | When |
|---|---|
| `reader:screen` (`detail.screen`) | The app switches between `'library'` and `'reader'`. |
| `reader:library` | The library data changed (import, delete, edit, close book). |
| `reader:name` (`detail.title`) | The greeting changed. |

## Hooks provided by other modules

| Global | Provided by | Used for |
|---|---|---|
| `__marginaliaBookOpenFly(cover, id)` | `fixes/book-open.js` | Book-opening animation from a v2 cover, by book id. |
| `__marginaliaSaveBook(b)` | `src/ui/library.ts` in v2, `fixes/library.js` otherwise | Discover's "Save to device". |
| `__marginaliaTTSDownloads` | `src/tts-downloads.ts` | Offline read-aloud audio. |

## Added in session 3 (v2 reader)

`ui` (overrides: `openSettings`, `openContents`, `openMore`, which the engine's own functions use when set), `closeBook`, `dictionaryButton`, `clearSelection`, `selectionInfo()`, `selectionAction(a, color)`, `moreItems(where)`, `moreAction(id)`, `chapterTitle(ch)`, `keepChrome()`, `percentLabel(p)`, `goToPercent(p)`, `themes()`, `fonts()`, `resetAppearance()`, `audioInfo()`, `voicesInfo()`, `loadVoices()`, `voicesRetry()`, `setEdgeProxy`, `setEdgeVoice`, `setDeviceVoice`, `applyAudioPreset`, `resetAudio`, `previewVoice`, `runSpeechTest`, `speechReport`, `copyText`.

Events: `reader:progress`, `reader:selection` (`detail.open`), `reader:audio`, `reader:annotations`, `reader:speechtest` (`detail.message`, `detail.report`). Globals: `__marginaliaReaderTools`, `__marginaliaOpenNote`, `__marginaliaReadAlong`; `__marginaliaTTSDownloads` gained `render`, `downloadChapter`, `downloadBook`, `cancel`, `status`.
