# Marginalia

*Read something.*

An ebook reader that runs entirely in your browser. Import an EPUB, PDF, TXT or HTML file and read. Your books stay on your device.

## Development

The vocabulary notebook and public-domain book catalog are written in TypeScript. Install the development dependency and rebuild their browser modules after editing:

```sh
npm install
npm run build
npm test
```

Commit the generated JavaScript under `build/` with TypeScript changes so the static app can load it without a build step at runtime. The catalog uses Project Gutenberg's OPDS feed and verifies that each book is marked public domain in the United States before showing its EPUB download link; copyright status can differ in other countries.

## Edge read-aloud

Edge read-aloud uses the configured Cloudflare Worker to request Microsoft Edge TTS audio. Audio is cached per book in IndexedDB, decoded into Web Audio buffers, trimmed at silent edges, time-stretched with pitch preservation, and scheduled with a bounded lookahead queue. Word-boundary metadata is used for highlighting when available. The optional storytelling cadence adds subtle sentence-aware SSML pacing and pitch. Tapping the compact player opens expanded listening controls. Transient network and Worker failures are retried; if Microsoft rate-limits Edge requests, Marginalia falls back to device speech to avoid stalling. Microsoft can still rate-limit this unofficial service.
