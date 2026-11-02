# Marginalia

*Read something.*

An ebook reader that runs entirely in your browser. Import an EPUB, PDF, TXT or HTML file and read. Your books stay on your device.

## Development

The vocabulary notebook is written in TypeScript. Install the development dependency and rebuild its browser module after editing:

```sh
npm install
npm run build:vocabulary
npm test
```

Commit the generated `build/vocabulary.js` with TypeScript changes so the static app can load it without a build step at runtime.
