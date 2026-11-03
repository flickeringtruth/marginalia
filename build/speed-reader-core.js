const BLOCK_ELEMENTS = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "DL", "DT", "DD",
    "FIGCAPTION", "FIGURE", "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6",
    "HEADER", "LI", "MAIN", "OL", "P", "PRE", "SECTION", "TABLE", "TR", "UL"
]);
export function collectReadableText(root) {
    const chunks = [];
    const spans = [];
    let textLength = 0;
    let sourceOffset = 0;
    let lastChar = "";
    const append = (value, sourceStart) => {
        if (!value)
            return;
        chunks.push(value);
        spans.push({ textStart: textLength, sourceStart, length: value.length });
        textLength += value.length;
        lastChar = value[value.length - 1];
    };
    const walk = (node) => {
        if (node.nodeType === 3) {
            const value = node.nodeValue || "";
            append(value, sourceOffset);
            sourceOffset += value.length;
            return;
        }
        if (node.nodeType !== 1 && node.nodeType !== 11)
            return;
        if (node.nodeType === 1 && BLOCK_ELEMENTS.has(node.tagName) &&
            textLength > 0 && !/\s/.test(lastChar)) {
            append("\n", sourceOffset);
        }
        for (const child of node.childNodes)
            walk(child);
    };
    walk(root);
    return { text: chunks.join(""), spans };
}
function sourceOffsetAt(textOffset, spans) {
    if (!spans)
        return textOffset;
    let low = 0;
    let high = spans.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (spans[middle].textStart + spans[middle].length <= textOffset)
            low = middle + 1;
        else
            high = middle;
    }
    const span = spans[low];
    return span && textOffset >= span.textStart
        ? span.sourceStart + textOffset - span.textStart
        : textOffset;
}
export function tokenizeSpeedText(text, spans = null) {
    const pattern = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*(?:[-‐‑–][\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*)*/gu;
    const words = [];
    let previous = null;
    let match;
    const append = (current, nextStart) => {
        const textStart = current.index;
        const end = textStart + current[0].length;
        const between = text.slice(end, nextStart);
        const punctuation = (between.match(/^\s*([,;:!?…。—–]+["'”’)\]]*)/) || [])[1] || "";
        words.push({
            word: current[0],
            punctuation,
            start: sourceOffsetAt(textStart, spans),
            textStart
        });
    };
    while ((match = pattern.exec(text))) {
        if (previous)
            append(previous, match.index);
        previous = match;
    }
    if (previous)
        append(previous, text.length);
    return words;
}
