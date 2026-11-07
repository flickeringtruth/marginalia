/* Shared Playwright fixtures: a clean profile per test, the voice Worker mocked (no network to Microsoft),
   history padded so Back never leaves the app, and helpers to import/open a book. */
import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEpub } from './epub.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_MP3 = fs.readFileSync(path.join(here, 'fixtures', 'sample.mp3'));
export const WORKER = 'https://marginalia.flickeringtruth.workers.dev';
export { expect };

const IGNORED_CONSOLE = /ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_FAILED|ERR_CONNECTION|fonts\.g|CORS policy|dictionaryapi|Failed to load resource/;

export const test = base.extend({
  worker: [async ({ page }, use) => {
    const log = { posts: [], gets: 0, failing: false };
    await page.route(WORKER + '/**', route => {
      const req = route.request();
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'X-TTS-Word-Boundaries' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' } });
      if (log.failing) return route.abort('failed');
      if (req.method() === 'GET') { log.gets++; return route.fulfill({ status: 200, headers: cors, contentType: 'text/plain', body: 'Marginalia voice proxy is running.' }); }
      try { log.posts.push(JSON.parse(req.postData() || '{}')); } catch { log.posts.push({}); }
      return route.fulfill({ status: 200, headers: cors, contentType: 'audio/mpeg', body: SAMPLE_MP3 });
    });
    await use(log);
  }, { auto: true }],

  app: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !IGNORED_CONSOLE.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(() => {
      try { if (!sessionStorage.getItem('__e2e')) { localStorage.setItem('marginalia.asked', 'true'); sessionStorage.setItem('__e2e', '1'); } } catch { /* ignore */ }
    });
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__reader && document.documentElement.classList.contains('ui-v2'));
    await page.evaluate(() => { for (let i = 0; i < 12; i++) history.pushState({ pad: i }, ''); });
    await page.addScriptTag({ path: path.join(here, '..', 'dev', 'overlap-check.js') });
    const epub = makeEpub().toString('base64');
    const api = {
      errors,
      /** Imports the test book. open=true also opens it (reader screen). */
      async importBook(open = true) {
        await page.evaluate(async ([b64, openIt]) => {
          const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          await window.__reader.importFile('test.epub', new File([bin], 'test.epub', { type: 'application/epub+zip' }), openIt);
        }, [epub, open]);
        await page.waitForTimeout(open ? 1200 : 600);
      },
      async settle() { await page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch { /* ignore */ } })); },
      async overlaps() { await api.settle(); return page.evaluate(() => window.marginaliaOverlapCheck().overlaps.length); },
      async openSettings(tab) {
        await page.evaluate(t => window.__reader.openSettings(t), tab);
        await page.waitForSelector('.v2-sheet-body');
        await page.waitForTimeout(tab === 'audio' ? 800 : 300);
      },
      async closeSheet() { await page.evaluate(() => document.querySelector('.v2-sheet .v2-ibtn')?.click()); await page.waitForTimeout(450); },
      async toLibrary() {
        await page.evaluate(() => { window.__reader.App.chrome = true; document.body.classList.add('chrome-on'); });
        await page.waitForTimeout(250);
        await page.locator('#v2-reader [aria-label="Back to library"]').click({ force: true });
        await page.waitForFunction(() => window.__reader.App.screen === 'library');
      }
    };
    await use(api);
    expect(errors, 'no unexpected console or page errors').toEqual([]);
  }
});
