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

interface ReaderApi {
  App: {
    screen: 'library' | 'reader' | string;
    book: { id: string; type?: string; title?: string; meta?: { title?: string }; chapters: unknown[] } | null;
    r?: { getLoc?: () => { ch: number } };
  };
  A: { engine: string; edgeVoice: string; cadence: boolean; pitch: number };
  TTS: { ch: number; edgeChunkRequest: (m: ReaderSpeechModel, i: number) => ReaderChunkRequest };
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
}

interface Window {
  __reader?: ReaderApi;
  __marginaliaTTSDownloads?: {
    lookup: (bookId: string, voice: string, rate: number, pitch: number, text: string) => Promise<{ blob: Blob; boundaries: { offset: number; text: string }[] } | null>;
  };
  __marginaliaSaveBook?: (b: { id: number; title: string; authors?: string[]; epub: string }) => Promise<void>;
  __marginaliaReadOnSite?: (b: unknown) => void;
  __marginaliaBookOpenFly?: (cover: HTMLElement, id: string) => Promise<void>;
}

/* Events the engine dispatches on document */
interface DocumentEventMap {
  'reader:screen': CustomEvent<{ screen: string }>;
  'reader:library': CustomEvent<void>;
  'reader:name': CustomEvent<{ title: string }>;
}
