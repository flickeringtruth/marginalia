/* Marginalia Worker entry. Adds a /book route (Project Gutenberg EPUB proxy, used by "Read on site")
   in front of the existing voice proxy in edge-proxy-worker.js.
   Gutenberg does not allow web pages to download EPUBs directly, so the site asks this Worker to fetch them. */
import voice from './edge-proxy-worker.js';

const ALLOWED_ORIGINS = ['https://flickeringtruth.github.io'];
const MAX_BYTES = 25 * 1024 * 1024;

async function handleBook(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin);
  const cors = allowed
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
    : { Vary: 'Origin' };
  const fail = (status, error) => new Response(JSON.stringify({ error }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
  if (request.method !== 'GET') return fail(405, 'use GET');
  if (!allowed) return fail(403, 'this site is not allowed to use the book proxy');

  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^\d{1,8}$/.test(id)) return fail(400, 'id must be a Project Gutenberg book number');

  let upstream;
  try {
    upstream = await fetch('https://www.gutenberg.org/ebooks/' + id + '.epub.noimages', {
      redirect: 'follow',
      headers: { 'User-Agent': 'Marginalia/1.0 (personal ebook reader)', Accept: 'application/epub+zip,*/*' },
      cf: { cacheEverything: true, cacheTtl: 86400 }
    });
  } catch (e) {
    return fail(502, 'could not reach Project Gutenberg');
  }
  if (!upstream.ok) return fail(upstream.status === 404 ? 404 : 502, 'Project Gutenberg returned HTTP ' + upstream.status);
  const length = Number(upstream.headers.get('Content-Length') || 0);
  if (length > MAX_BYTES) return fail(413, 'that book is too large');

  return new Response(upstream.body, {
    headers: { ...cors, 'Content-Type': 'application/epub+zip', 'Cache-Control': 'public, max-age=86400' }
  });
}

export default {
  fetch(request, env, ctx) {
    if (new URL(request.url).pathname === '/book') return handleBook(request);
    return voice.fetch(request, env, ctx);
  }
};
