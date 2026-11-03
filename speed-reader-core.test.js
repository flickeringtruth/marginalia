import test from "node:test";
import assert from "node:assert/strict";
import { collectReadableText, tokenizeSpeedText } from "./build/speed-reader-core.js";

function text(value) {
  return { nodeType: 3, nodeValue: value, childNodes: [] };
}

function element(tagName, ...childNodes) {
  return { nodeType: 1, tagName, childNodes };
}

test("readable text preserves block breaks with compact source-offset spans", () => {
  const root = element("DIV",
    element("P", text("A long")),
    element("P", text(" text"))
  );
  const readable = collectReadableText(root);

  assert.equal(readable.text, "A long\n text");
  assert.deepEqual(tokenizeSpeedText(readable.text, readable.spans).map(word => [word.word, word.start]), [
    ["A", 0],
    ["long", 2],
    ["text", 7]
  ]);
  assert.equal(readable.spans.length, 3);
  assert.ok(readable.spans.length < readable.text.length);
});

test("text spanning inline elements retains source positions and punctuation", () => {
  const root = element("P", text("hel"), element("EM", text("lo")), text(" world?"));
  const readable = collectReadableText(root);

  assert.equal(readable.text, "hello world?");
  assert.deepEqual(tokenizeSpeedText(readable.text, readable.spans), [
    { word: "hello", punctuation: "", start: 0, textStart: 0 },
    { word: "world", punctuation: "?", start: 6, textStart: 6 }
  ]);
});

test("PDF-style text tokenization works without source spans", () => {
  assert.deepEqual(tokenizeSpeedText("One, deux!"), [
    { word: "One", punctuation: ",", start: 0, textStart: 0 },
    { word: "deux", punctuation: "!", start: 5, textStart: 5 }
  ]);
});

test("long text stores offsets per text node rather than per character", () => {
  const readable = collectReadableText(element("P", text("word ".repeat(20_000))));
  assert.equal(readable.text.length, 100_000);
  assert.equal(readable.spans.length, 1);
});
