import test from "node:test";
import assert from "node:assert/strict";
import { safeEpubUrl, safeFeedUrl } from "./build/book-catalog.js";

test("EPUB links must use HTTPS on Project Gutenberg's download host", () => {
  assert.equal(safeEpubUrl("/ebooks/11.epub.images"), "https://www.gutenberg.org/ebooks/11.epub.images");
  assert.equal(safeEpubUrl("http://www.gutenberg.org/book.epub"), null);
  assert.equal(safeEpubUrl("https://example.org/book.epub"), null);
  assert.equal(safeEpubUrl("https://www.gutenberg.org.evil.example/book.epub"), null);
});

test("book detail feeds are restricted to numeric Project Gutenberg ebook IDs", () => {
  assert.equal(safeFeedUrl("/ebooks/1342.opds"), "https://www.gutenberg.org/ebooks/1342.opds");
  assert.equal(safeFeedUrl("https://www.gutenberg.org/ebooks/1342.opds"), "https://www.gutenberg.org/ebooks/1342.opds");
  assert.equal(safeFeedUrl("https://www.gutenberg.org/ebooks/search.opds/?query=test"), null);
  assert.equal(safeFeedUrl("https://example.org/ebooks/1342.opds"), null);
});
