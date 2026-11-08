/* Voices and Edge TTS: zero setup, one picker, retry on failure, optional override, and grouped requests.
   The Worker is mocked (see fixtures.mjs), so nothing here talks to Microsoft. */
import { test, expect } from './fixtures.mjs';

const audio = async (page) => page.evaluate(() => JSON.parse(localStorage.getItem('reader.audio') || '{}'));

test('Edge voices need no setup: ready on open, two groups, address field is in a collapsed Advanced section', async ({ page, app, worker }) => {
  expect(await page.evaluate(() => [localStorage.getItem('marginalia.voiceProxy'), JSON.parse(localStorage.getItem('reader.audio') || '{}').edgeProxy])).toEqual([null, undefined]);
  await app.importBook(false);
  await app.openSettings('audio');
  await expect(page.locator('.v2-vp-status')).toContainText('ready');
  expect(worker.gets).toBeGreaterThan(0);
  const groups = await page.locator('.v2-vp h4').allInnerTexts();
  expect(groups[0]).toMatch(/^Online \(Edge\)/);   // the device group only appears when the browser reports voices (headless WebKit reports none)
  expect(await page.evaluate(() => document.querySelector('.v2-adv').open)).toBe(false);
  expect(await page.evaluate(() => { const i = document.querySelector('.v2-adv input'); return i.value === '' && i.placeholder.includes('workers.dev'); })).toBe(true);
});

test('search by name and gender, pick a voice (engine and voice change together), choice survives a reload', async ({ page, app }) => {
  await app.importBook(false);
  await app.openSettings('audio');
  const search = page.locator('.v2-vp input[type=search]');
  await search.fill('female');
  expect(await page.locator('.v2-vp-row').count()).toBeGreaterThan(3);
  await search.fill('Ava');
  await page.locator('.v2-vp-pick', { hasText: 'Ava' }).first().click();
  await expect.poll(async () => (await audio(page)).edgeVoice).toBe('en-US-AvaNeural');
  expect((await audio(page)).engine).toBe('edge');
  await page.reload();
  await page.waitForFunction(() => window.__reader);
  const a = await audio(page);
  expect([a.engine, a.edgeVoice]).toEqual(['edge', 'en-US-AvaNeural']);
});

test('Preview sends one request to the built-in service and the list stays open', async ({ page, app, worker }) => {
  await app.importBook(false);
  await app.openSettings('audio');
  await page.locator('.v2-vp-row', { hasText: 'Ava' }).first().locator('.v2-vp-prev').click();
  await expect.poll(() => worker.posts.length).toBeGreaterThan(0);
  expect(worker.posts[0].voice).toBe('en-US-AvaNeural');
  expect(await page.locator('.v2-vp-row').count()).toBeGreaterThan(3);
});

test('a failing service shows a message with Retry; Advanced override and Use built-in work', async ({ page, app, worker }) => {
  await app.importBook(false);
  await app.openSettings('audio');
  await expect(page.locator('.v2-vp-status')).toContainText('ready');
  worker.failing = true;
  await page.locator('.v2-adv summary').click();
  await page.locator('.v2-adv input').fill('https://invalid.invalid');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.locator('.v2-vp-status')).toContainText('may not play');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  worker.failing = false;
  await page.getByRole('button', { name: 'Use built-in' }).click();
  await expect(page.locator('.v2-vp-status')).toContainText('ready');
  expect((await audio(page)).edgeProxy || '').toBe('');
});

test('switching to another voice kind while playing changes the player at once', async ({ page, app }, info) => {
  test.skip(info.project.name.startsWith('webkit'), 'audio playback is checked in Chromium');
  await app.importBook(true);
  await page.evaluate(() => { window.__reader.setAudio('volume', 0); window.__reader.selectVoice('edge', 'en-US-AvaNeural'); window.__reader.TTS.playFrom(0, 0); });
  await expect.poll(() => page.evaluate(() => window.__reader.audioInfo().engine)).toBe('edge');
  await page.evaluate(() => window.__reader.selectVoice('device', ''));
  await expect.poll(() => page.evaluate(() => window.__reader.audioInfo().engine)).toBe('device');
  await expect.poll(async () => (await audio(page)).engine).toBe('device');   // saved after a short debounce
});

test('Edge requests carry several sentences each and stay under the 1,200-character limit', async ({ page, app, worker }, info) => {
  test.skip(info.project.name.startsWith('webkit'), 'audio playback is checked in Chromium');
  await app.importBook(true);
  await page.evaluate(() => { window.__reader.setAudio('volume', 0); window.__reader.selectVoice('edge', 'en-US-AvaNeural'); window.__reader.TTS.playFrom(0, 0); });
  await expect.poll(() => worker.posts.length, { timeout: 20000 }).toBeGreaterThanOrEqual(3);
  const lengths = worker.posts.map(p => String(p.text || '').length);
  expect(Math.max(...lengths)).toBeLessThanOrEqual(1200);
  expect(lengths.some(n => n > 300), `request sizes ${lengths}`).toBe(true);
  await page.evaluate(() => { window.__reader.TTS.stop(false); });
});

test('an unreadable downloaded or cached audio file falls back to the network instead of pausing the book', async ({ page, app, worker }, info) => {
  test.skip(info.project.name.startsWith('webkit'), 'audio playback is checked in Chromium');
  await app.importBook(true);
  await page.evaluate(() => {
    // what Safari does when a Blob stored by the page has lost its file: reading it throws NotFoundError
    const broken = new Blob([new Uint8Array(2000)], { type: 'audio/mpeg' });
    broken.arrayBuffer = () => Promise.reject(new DOMException('The object can not be found here.', 'NotFoundError'));
    window.__marginaliaTTSDownloads.lookup = async () => ({ blob: broken, boundaries: [] });
    const R = window.__reader; R.setAudio('volume', 0); R.selectVoice('edge', 'en-US-AvaNeural'); R.TTS.playFrom(0, 0);
  });
  await expect.poll(() => worker.posts.length, { timeout: 15000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__reader.TTS.state)).toBe('playing');
  expect(await page.evaluate(() => document.getElementById('toast').textContent)).not.toMatch(/EdgeTTS failed/);
});
