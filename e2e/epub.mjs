/* Builds a small multi-chapter EPUB in memory (a "stored" zip, no compression, no dependencies). */
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zipStore(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  for (const [name, content] of files) {
    const n = enc.encode(name), data = typeof content === 'string' ? enc.encode(content) : content, crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
    parts.push(local, Buffer.from(n), Buffer.from(data));
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, Buffer.from(n));
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

export function makeEpub({ title = 'Test Book', chapters = 6, paragraphs = 13 } = {}) {
  const lorem = 'The quick brown fox jumps over the lazy dog while the autumn light falls across the quiet field. ';
  const chs = Array.from({ length: chapters }, (_, i) => ({
    file: `ch${i + 1}.xhtml`, name: `Chapter ${i + 1}`,
    body: `<h1>Chapter ${i + 1}</h1>` + Array.from({ length: paragraphs }, (_, j) => `<p>${lorem.repeat(6)}Paragraph ${j + 1} of chapter ${i + 1}.</p>`).join('')
  }));
  const xhtml = (t, b) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${t}</title></head><body>${b}</body></html>`;
  const manifest = chs.map((c, i) => `<item id="c${i + 1}" href="${c.file}" media-type="application/xhtml+xml"/>`).join('');
  const spine = chs.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('');
  const toc = chs.map(c => `<li><a href="${c.file}">${c.name}</a></li>`).join('');
  return zipStore([
    ['mimetype', 'application/epub+zip'],
    ['META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'],
    ['OEBPS/content.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">e2e-${title}</dc:identifier><dc:title>${title}</dc:title><dc:creator>Test Author</dc:creator><dc:language>en</dc:language></metadata><manifest>${manifest}<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine>${spine}</spine></package>`],
    ['OEBPS/nav.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>nav</title></head><body><nav epub:type="toc"><ol>${toc}</ol></nav></body></html>`],
    ...chs.map(c => [`OEBPS/${c.file}`, xhtml(c.name, c.body)])
  ]);
}
