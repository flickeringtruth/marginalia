/* Marginalia voice proxy (Cloudflare Worker).
   Receives { text, voice, rate } from the Marginalia site and returns an MP3 made by Microsoft Edge's
   neural voices. Needed because Microsoft's server refuses direct connections from web pages.
   The connection approach and token routine follow the Readest project (AGPL-3.0),
   https://github.com/readest/readest — so this file, and Marginalia, should be AGPL-3.0 too. */
import { connect } from 'cloudflare:sockets';

const ALLOWED_ORIGINS = ['https://flickeringtruth.github.io'];
const HOST = 'api.msedgeservices.com';
const PATH = '/tts/cognitiveservices/websocket/v1';
const API_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const MAX_CHARS = 1200;
const TIMEOUT_MS = 20000;

const enc = new TextEncoder();
const dec = new TextDecoder();

// ==WS-START==
const concat = (a, b) => { const m = new Uint8Array(a.byteLength + b.byteLength); m.set(a, 0); m.set(b, a.byteLength); return m; };

// Client frames must be masked.
function encodeFrame(opcode, payload) {
  const len = payload.byteLength;
  const ext = len < 126 ? 0 : len < 65536 ? 2 : 8;
  const f = new Uint8Array(2 + ext + 4 + len);
  const v = new DataView(f.buffer);
  f[0] = 0x80 | opcode;
  if (ext === 0) f[1] = 0x80 | len;
  else if (ext === 2) { f[1] = 0x80 | 126; v.setUint16(2, len); }
  else { f[1] = 0x80 | 127; v.setBigUint64(2, BigInt(len)); }
  const mask = crypto.getRandomValues(new Uint8Array(4));
  f.set(mask, 2 + ext);
  for (let i = 0; i < len; i++) f[2 + ext + 4 + i] = payload[i] ^ mask[i % 4];
  return f;
}

// Server frames are never masked. Returns null until a whole frame is available.
function parseFrame(buf) {
  if (buf.byteLength < 2) return null;
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const fin = (buf[0] & 0x80) !== 0, opcode = buf[0] & 0x0f;
  let len = buf[1] & 0x7f, off = 2;
  if (len === 126) { if (buf.byteLength < 4) return null; len = v.getUint16(2); off = 4; }
  else if (len === 127) { if (buf.byteLength < 10) return null; len = Number(v.getBigUint64(2)); off = 10; }
  if (buf.byteLength < off + len) return null;
  return { fin, opcode, payload: buf.slice(off, off + len), rest: buf.slice(off + len) };
}

function findHeaderEnd(buf) {
  for (let i = 0; i + 3 < buf.byteLength; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i;
  }
  return -1;
}
// ==WS-END==

// ==TOKEN-START==
const WIN_EPOCH_OFFSET = 11644473600;
const S_TO_NS = 1000000000;
const GEC_PREFIX_WORDS = [
  0x79706f43, 0x68676972, 0x43282074, 0x694d2029, 0x736f7263, 0x2074666f, 0x70726f43, 0x7461726f,
  0x2e6e6f69, 0x6c6c4120, 0x67697220, 0x20737468, 0x65736572, 0x64657672, 0x0000002e
];
const GEC_PREFIX_LENGTH = 57;
const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
const rol16 = x => ((x << 16) | (x >>> 16)) >>> 0;
const toWords = bytes => {
  const padded = new Uint8Array(Math.ceil(bytes.length / 8) * 8);
  padded.set(bytes);
  const view = new DataView(padded.buffer);
  return Array.from({ length: padded.length / 4 }, (_, i) => view.getUint32(i * 4, true));
};
const cs64WordSwap = (words, a, b) => {
  let acc = 0, last = 0;
  for (let i = 0; i < words.length; i += 2) {
    const x = words[i], y = words[i + 1];
    let t = rol16((Math.imul(rol16(x), 0xef0569fb) + Math.imul(x, a)) >>> 0);
    let q = Math.imul(t, 0x76f50f34) >>> 0;
    acc = (acc + Math.imul(rol16(q), 0xc3efea97) + q) >>> 0;
    t = rol16((Math.imul(rol16(y), 0xc31713db) + Math.imul(y, b)) >>> 0);
    q = Math.imul(t, 0x1881ce3c) >>> 0;
    last = (Math.imul(rol16(q), 0x35bd1ec9) + q) >>> 0;
    acc = (acc + last) >>> 0;
  }
  return [last, acc];
};
const cs64Reversible = (words, a, b) => {
  let state = 0, acc = 0;
  for (let i = 0; i < words.length; i += 2) {
    state = Math.imul(state + words[i], a) >>> 0;
    for (const c of [0xcf98b111, 0x87085b9f, 0x12ceb96d, 0x257e1d83]) state = Math.imul(rol16(state), c) >>> 0;
    let t = Math.imul(words[i + 1] + state, b) >>> 0;
    t = Math.imul(rol16(t), 0xa27416f5) >>> 0;
    t = rol16(Math.imul(rol16(t), 0xd38396ff) >>> 0);
    acc = (acc + state) >>> 0;
    state = Math.imul(rol16(Math.imul(t, 0x7c932b89) >>> 0), 0xbfa49f69) >>> 0;
    acc = (acc + state) >>> 0;
  }
  return [state, acc];
};
async function generateSecMsGec(now = Date.now()) {
  let ticks = Math.floor(now / 1000);
  ticks += WIN_EPOCH_OFFSET;
  ticks -= ticks % 300;
  ticks *= S_TO_NS / 100;
  const suffix = enc.encode(ticks.toFixed(0) + API_TOKEN);
  const data = new Uint8Array(GEC_PREFIX_LENGTH + suffix.length);
  const view = new DataView(data.buffer);
  GEC_PREFIX_WORDS.forEach((word, i) => view.setUint32(i * 4, word, true));
  data.set(suffix, GEC_PREFIX_LENGTH);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const words = toWords(data);
  const [key0, key1] = toWords(digest);
  const a = (key0 | 1) >>> 0, b = (key1 | 1) >>> 0;
  const [s0, s1] = cs64WordSwap(words, a, b);
  const [r0, r1] = cs64Reversible(words, a, b);
  const cs64 = new DataView(new ArrayBuffer(8));
  cs64.setUint32(0, s0 ^ r0, true);
  cs64.setUint32(4, s1 ^ r1, true);
  return toHex(new Uint8Array(cs64.buffer)) + '-' + toHex(digest);
}
// ==TOKEN-END==

const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return toHex(a); };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const lines = o => Object.keys(o).map(k => k + ': ' + o[k] + '\r\n').join('');

/* Opens a WebSocket over a raw TLS socket and returns { send, next, close }. */
async function openSocket(url, headers) {
  const socket = connect({ hostname: HOST, port: 443 }, { secureTransport: 'on' });
  const reader = socket.readable.getReader(), writer = socket.writable.getWriter();
  const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const req = ['GET ' + url + ' HTTP/1.1', 'Host: ' + HOST, 'Upgrade: websocket', 'Connection: Upgrade',
    'Sec-WebSocket-Key: ' + key, ...Object.entries(headers).map(([k, v]) => k + ': ' + v)];
  await writer.write(enc.encode(req.join('\r\n') + '\r\n\r\n'));

  let buf = new Uint8Array(0), end = -1;
  while ((end = findHeaderEnd(buf)) < 0) {
    const { value, done } = await reader.read();
    if (done) throw new Error('the voice service closed the connection during the handshake');
    buf = concat(buf, value);
  }
  const status = Number(dec.decode(buf.slice(0, end)).split('\r\n')[0].split(' ')[1]);
  if (status !== 101) { socket.close().catch(() => {}); throw new Error('the voice service refused the connection (HTTP ' + status + ')'); }
  buf = buf.slice(end + 4);

  let frags = null, fragOp = 0, closed = false;
  return {
    send: text => writer.write(encodeFrame(0x1, enc.encode(text))),
    close: () => { closed = true; socket.close().catch(() => {}); },
    async next() { // resolves with { text: boolean, data: Uint8Array } or null when the socket ends
      for (;;) {
        const f = parseFrame(buf);
        if (!f) {
          if (closed) return null;
          const { value, done } = await reader.read();
          if (done) return null;
          buf = concat(buf, value); continue;
        }
        buf = f.rest;
        if (f.opcode === 0x8) return null;
        if (f.opcode === 0x9) { await writer.write(encodeFrame(0xa, f.payload)); continue; }
        if (f.opcode === 0xa) continue;
        if (f.opcode !== 0) fragOp = f.opcode;
        frags = frags ? concat(frags, f.payload) : f.payload;
        if (!f.fin) continue;
        const m = { text: fragOp === 0x1, data: frags }; frags = null; return m;
      }
    }
  };
}

async function synthesize(text, voice, rate) {
  const id = rand(16);
  const gec = await generateSecMsGec();
  const major = CHROMIUM_FULL_VERSION.split('.')[0];
  const url = PATH + '?' + new URLSearchParams({
    ConnectionId: id, 'Ocp-Apim-Subscription-Key': API_TOKEN, 'Sec-MS-GEC': gec, 'Sec-MS-GEC-Version': '2-' + CHROMIUM_FULL_VERSION
  });
  const ws = await openSocket(url, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + major + '.0.0.0 Safari/537.36 Edg/' + major + '.0.0.0',
    'Accept-Language': 'en-US,en;q=0.9', Pragma: 'no-cache', 'Cache-Control': 'no-cache',
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold', 'Sec-WebSocket-Version': '13', Cookie: 'muid=' + rand(16) + ';'
  });
  try {
    const date = new Date().toString();
    await ws.send(lines({ 'Content-Type': 'application/json; charset=utf-8', Path: 'speech.config', 'X-Timestamp': date }) + '\r\n' +
      JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false }, outputFormat: 'audio-24khz-48kbitrate-mono-mp3' } } } }));
    const lang = voice.split('-').slice(0, 2).join('-');
    const pct = Math.round((rate - 1) * 100);
    const ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='" + lang + "'><voice name='" + voice +
      "'><prosody pitch='+0Hz' rate='" + (pct >= 0 ? '+' : '') + pct + "%' volume='+0%'>" + esc(text) + '</prosody></voice></speak>';
    await ws.send(lines({ 'Content-Type': 'application/ssml+xml', Path: 'ssml', 'X-RequestId': id, 'X-Timestamp': date }) + '\r\n' + ssml);

    let audio = new Uint8Array(0);
    for (;;) {
      const m = await ws.next();
      if (!m) break;
      if (m.text) {
        const p = /Path:\s*([\w.]+)/.exec(dec.decode(m.data));
        if (p && p[1] === 'turn.end') break;
      } else {
        const hl = new DataView(m.data.buffer, m.data.byteOffset, m.data.byteLength).getInt16(0);
        if (m.data.byteLength > hl + 2) audio = concat(audio, m.data.slice(2 + hl));
      }
    }
    if (!audio.byteLength) throw new Error('the voice service sent no audio');
    return audio;
  } finally { ws.close(); }
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' };
    const json = (obj, status) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (request.method === 'GET') return new Response('Marginalia voice proxy is running.', { headers: { 'Content-Type': 'text/plain' } });
    if (request.method !== 'POST') return json({ error: 'use POST' }, 405);
    if (!allowed) return json({ error: 'this site is not allowed to use the proxy' }, 403);

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'send JSON like {"text":"…","voice":"en-US-AriaNeural","rate":1}' }, 400); }
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const voice = typeof body.voice === 'string' ? body.voice : '';
    const rate = Math.min(2, Math.max(0.5, Number(body.rate) || 1));
    if (!text || text.length > MAX_CHARS) return json({ error: 'text must be 1 to ' + MAX_CHARS + ' characters' }, 400);
    if (!/^[A-Za-z0-9-]{5,64}Neural$/.test(voice)) return json({ error: 'unknown voice name' }, 400);

    try {
      const audio = await Promise.race([
        synthesize(text, voice, rate),
        new Promise((_, rej) => setTimeout(() => rej(new Error('the voice service took too long')), TIMEOUT_MS))
      ]);
      return new Response(audio, { headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
    } catch (e) { return json({ error: String((e && e.message) || e) }, 502); }
  }
};
