/* Types for window.__reader, the only way src/ code talks to the engine in index.html.
   Documented in docs/reader-api.md. Keep this file a global script (no import/export). */

interface ReaderBookMeta {
  id: string;
  type: string;            // 'epub' | 'pdf' | 'txt' | 'html'
  title: string;
  author?: string;
  name?: string;
  size?: number;
  added?: number;          // ms timestamp
  opened?: number;         // ms timestamp, 0 if never opened
  coverBuf?: ArrayBuffer;
  coverType?: string;
  gid?: number;            // Project Gutenberg id, for books saved from Discover
  temp?: boolean;          // temporary "Read on site" copy, never listed
  split?: boolean;
}

interface ReaderBookPatch {
  title?: string;
  author?: string;
  coverBuf?: ArrayBuffer;
  coverType?: string;
  removeCover?: boolean;
}

interface ReaderSpeechChunk { s: number; e: number; p: number }
interface ReaderSpeechModel { ch: number; text: string; chunks: ReaderSpeechChunk[] }
interface ReaderChunkRequest { text: string; voice: string; rate: number; pitch: number }

interface ReaderTocItem { title: string; ch: number; frag?: string; depth?: number }
interface ReaderHighlight { id: string; ch: number; start: number; end: number; text: string; color: string; t?: number; note?: string }
interface ReaderProgress { pct: number; label: string; chapter: string; book: string }
interface ReaderAudioInfo {
  state: 'idle' | 'loading' | 'playing' | 'paused'; active: boolean; title: string; chapter: string;
  pct: number; elapsed: string; remaining: string; total: string; rate: number; voice: string; engine: string;
  sleep: string; suspended: boolean; lyricsOpen: boolean; snippet: string;
}
interface ReaderVoicesInfo { lang: string; loading: boolean; automatic: string; edge: string[]; device: { uri: string; name: string; lang: string; local: boolean }[] }
interface ReaderSelectionInfo {
  active: boolean; isHighlight: boolean; color: string | null; colors: Record<string, string>; canShare: boolean; canSpeak: boolean;
  rects: { left: number; top: number; right: number; bottom: number; width: number; height: number }[];
}
interface ReaderUiOverrides {
  openSettings?: (tab: 'look' | 'audio') => void;
  openContents?: (tab?: string) => void;
  openMore?: (where: 'library' | 'reader') => void;
}

interface ReaderApi {
  App: {
    screen: 'library' | 'reader' | string;
    book: { id: string; type?: string; title?: string; meta: { title?: string; author?: string; id?: string }; chapters: { title?: string }[]; toc: ReaderTocItem[]; getChapter: (ch: number) => Promise<HTMLElement>;
      lengths?: number[]; total?: number; n?: number } | null;
    r?: { getLoc?: () => { ch: number; off?: number; frac?: number; atEnd?: boolean }; prev: () => void; next: () => void; busy?: boolean;
      info?: () => { page: number; pages: number; pageTo?: number; pdf?: boolean } | null };
    chrome: boolean;
    chromeTimer: number;
    progress?: ReaderProgress;
    goTo: (loc: { ch: number; off?: number; frac?: number; frag?: string }) => Promise<void>;
  };
  S: Record<string, unknown> & { theme: string; font: string; fontSize: number; layout: string; grad: { colors: string[]; angle: number; intensity: number } };
  setSetting: (key: string, value: unknown) => Promise<void>;
  setGrad: (patch: Partial<{ colors: string[]; angle: number; intensity: number }>) => void;
  gradientTheme: (g: { colors: string[]; angle: number; intensity: number }) => { image: string; fg: number[]; minC: number; limited: boolean; k: number };
  HL: { list: ReaderHighlight[]; get: (id: string) => ReaderHighlight | undefined; remove: (id: string) => void };
  Sel: { active: boolean; hlId: string | null; root: HTMLElement | null; ch: number; start: number; end: number };
  A: Record<string, unknown> & { engine: string; edgeVoice: string; edgeProxy: string; cadence: boolean; pitch: number; rate: number; volume: number;
    voiceURI: string; preset: string; voiceLocked: boolean; hlMode: string; trail: string; hlColor: string; autoScroll: boolean; autoNext: boolean;
    startFrom: string; sleep: number; ambVol: number };
  setAudio: (key: string, value: unknown) => void;
  AudioUI: { openLyrics: () => void };
  Ambient: { kind: string; KINDS: Record<string, string>; start: (kind: string) => void; setVol: (v: number) => void };
  TTS: {
    ch: number; state: string; edgeChunkRequest: (m: ReaderSpeechModel, i: number) => ReaderChunkRequest;
    toggle: () => void; stop: (ask?: boolean) => Promise<void>; skip: (sec: number) => void; paragraph: (dir: number) => void;
    setRate: (r: number) => void; seekFraction: (p: number) => void; readHere: () => void; goToAudio: () => void;
  };
  buildSpeechModel: (ch: number, mode: string) => Promise<ReaderSpeechModel>;
  edgeProxyUrl: () => string;
  retryAfterMs: (value: string | null) => number;
  toast: (msg: string, ms?: number) => void;
  openBook: (id: string) => Promise<void>;

  /* Added for the v2 UI (session 2) */
  listBooks: () => Promise<ReaderBookMeta[]>;
  getBook: (id: string) => Promise<ReaderBookMeta | undefined>;
  updateBook: (id: string, patch: ReaderBookPatch) => Promise<ReaderBookMeta>;
  storeBook: (meta: ReaderBookMeta, buf: ArrayBuffer) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;   // asks for confirmation first
  pickFiles: () => void;
  importFiles: (files: FileList | File[]) => Promise<string | null>;
  openSample: () => Promise<void>;
  openMore: (where: 'library' | 'reader') => void;
  openSettings: (tab?: 'look' | 'audio') => void;
  renderLibrary: () => Promise<void>;
  coverHtml: (meta: ReaderBookMeta) => string;
  editName: () => void;
  libraryTitle: () => string;

  /* Added for the v2 reader (session 3) */
  ui: ReaderUiOverrides;
  closeBook: () => void;
  dictionaryButton: () => void;
  clearSelection: () => void;
  selectionInfo: () => ReaderSelectionInfo;
  selectionAction: (action: 'color' | 'copy' | 'define' | 'ask-ai' | 'speak' | 'share' | 'remove', color?: string) => Promise<void>;
  moreItems: (where: 'library' | 'reader') => { id: string; title: string; sub: string }[];
  moreAction: (id: string) => Promise<void>;
  chapterTitle: (ch: number) => string;
  keepChrome: () => void;
  percentLabel: (p: number) => string;
  goToPercent: (p: number) => Promise<void>;
  themes: () => { key: string; label: string; bg: string; fg: string }[];
  fonts: () => { key: string; label: string; css: string }[];
  resetAppearance: () => void;
  audioInfo: () => ReaderAudioInfo;
  voicesInfo: () => ReaderVoicesInfo;
  loadVoices: () => Promise<unknown>;
  voicesRetry: () => void;
  setEdgeProxy: (url: string) => boolean;
  setEdgeVoice: (voice: string) => void;
  setDeviceVoice: (uri: string) => void;
  applyAudioPreset: (preset: string) => void;
  resetAudio: () => void;
  previewVoice: () => void;
  runSpeechTest: () => void;
  speechReport: () => string;
  copyText: (text: string) => Promise<void>;

  /* Added for v2 reader features (session 5) */
  ttsCharsPerSec: () => number;
  globalPages: (loc: { ch: number; off?: number; frac?: number }, info: unknown) => { page: number; total: number } | null;
}

interface Window {
  __reader?: ReaderApi;
  __marginaliaTTSDownloads?: {
    lookup: (bookId: string, voice: string, rate: number, pitch: number, text: string) => Promise<{ blob: Blob; boundaries: { offset: number; text: string }[] } | null>;
    render: () => void;
    downloadChapter: () => Promise<void>;
    downloadBook: () => Promise<void>;
    cancel: () => void;
    status: () => { running: boolean; text: string; progress: number };
  };
  __marginaliaReaderTools?: { repaint: () => void; unwrapNote: (k: string) => void };
  __marginaliaOpenNote?: (k: string) => void;
  __marginaliaReadAlong?: { smaller: () => void; larger: () => void };
  __marginaliaSaveBook?: (b: { id: number; title: string; authors?: string[]; epub: string }) => Promise<void>;
  __marginaliaReadOnSite?: (b: unknown) => void;
  __marginaliaBookOpenFly?: (cover: HTMLElement, id: string) => Promise<void>;
}

/* Events the engine dispatches on document */
interface DocumentEventMap {
  'reader:screen': CustomEvent<{ screen: string }>;
  'reader:library': CustomEvent<void>;
  'reader:name': CustomEvent<{ title: string }>;
  'reader:progress': CustomEvent<void>;
  'reader:selection': CustomEvent<{ open: boolean }>;
  'reader:audio': CustomEvent<void>;
  'reader:annotations': CustomEvent<void>;
  'reader:speechtest': CustomEvent<{ message: string; report: string }>;
  'tts-downloads:change': CustomEvent<void>;
}
