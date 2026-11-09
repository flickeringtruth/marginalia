/* Rapid transport interaction: bursts of skip/rewind taps must not fire a request per tap (the
   old starvation), the debounced restart must keep audio flowing from prepared/cached audio, and
   nothing may stay silently "playing". */
import { test, expect } from './fixtures.mjs';

async function startEdgePlayback(page, app, worker) {
  await app.importBook(true);
  await page.evaluate(() => { window.__reader.setAudio('volume', 0); window.__reader.selectVoice('edge', 'en-US-AvaNeural'); window.__reader.TTS.playFrom(0, 0); });
  await expect.poll(() => page.evaluate(() => window.__reader.audioInfo().engine)).toBe('edge');
  await expect.poll(() => worker.posts.length, { timeout: 20000 }).toBeGreaterThanOrEqual(1);
  // Let the initial prefetch chain settle so burst measurements are not confounded.
  await expect.poll(() => page.evaluate(() => window.__reader.TTS.edgeRequests.size), { timeout: 20000 }).toBe(0);
  await page.waitForTimeout(200);
}

const pipeline = page => page.evaluate(() => {
  const T = window.__reader.TTS;
  return {
    state: T.state,
    posts: 0,
    scheduled: T.edgeScheduled.size,
    ready: T.edgeReady.size,
    inFlight: T.edgeRequests.size,
    stalls: T.evlog.filter(e => e.type === 'edge-stall-watchdog').length,
  };
});

test('a burst of forward skips fires no request per tap and audio keeps flowing', async ({ page, app, worker }, info) => {
  test.skip(info.project.name.startsWith('webkit'), 'audio playback is checked in Chromium');
  await startEdgePlayback(page, app, worker);
  const before = worker.posts.length;
  await page.evaluate(() => { const T = window.__reader.TTS; for (let n = 0; n < 8; n++) T.skip(5); });
  expect(worker.posts.length - before, 'taps themselves fire nothing (coalesced)').toBe(0);
  await page.waitForTimeout(800);   // the burst settles into the single debounced restart
  const delta = worker.posts.length - before;
  expect(delta, `one restart may fetch the target and prefetch ahead, got ${delta}`).toBeLessThanOrEqual(3);
  await expect.poll(() => pipeline(page), { timeout: 10000 }).toMatchObject({ state: 'playing' });
  const p = await pipeline(page);
  expect(p.scheduled + p.ready + p.inFlight, 'audio pipeline is alive after the burst').toBeGreaterThan(0);
  expect(p.stalls, 'no wedge, or at most one self-healed stall').toBeLessThanOrEqual(1);
  await page.evaluate(() => { window.__reader.TTS.stop(false); });
});

test('a burst of rewinds replays locally and never explodes the request queue', async ({ page, app, worker }, info) => {
  test.skip(info.project.name.startsWith('webkit'), 'audio playback is checked in Chromium');
  await startEdgePlayback(page, app, worker);
  const before = worker.posts.length;
  await page.evaluate(() => { const T = window.__reader.TTS; for (let n = 0; n < 6; n++) T.skip(-5); });
  expect(worker.posts.length - before, 'rewind taps themselves fire nothing').toBe(0);
  await page.waitForTimeout(800);
  const delta = worker.posts.length - before;
  expect(delta, `rewind replays prepared/cached audio, got ${delta} new posts`).toBeLessThanOrEqual(1);
  await expect.poll(() => pipeline(page), { timeout: 10000 }).toMatchObject({ state: 'playing' });
  const p = await pipeline(page);
  expect(p.scheduled + p.ready + p.inFlight, 'audio pipeline is alive after rewinds').toBeGreaterThan(0);
  expect(p.stalls).toBeLessThanOrEqual(1);
  await page.evaluate(() => { window.__reader.TTS.stop(false); });
});

test('rapid pause taps right after skips never leave a wedged transport', async ({ page, app, worker }, info) => {
  test.skip(info.project.name.startsWith('webkit'), 'audio playback is checked in Chromium');
  await startEdgePlayback(page, app, worker);
  await page.evaluate(() => {
    const T = window.__reader.TTS;
    for (let n = 0; n < 5; n++) T.skip(3);
    T.pause(); T.play(); T.pause(); T.play();   // spam around the debounced restart
  });
  await expect.poll(() => page.evaluate(() => window.__reader.TTS.state), { timeout: 10000 }).not.toBe('loading');
  const state = await page.evaluate(() => window.__reader.TTS.state);
  if (state === 'playing') {
    await page.waitForTimeout(1700);   // longer than the stall watchdog window
    const p = await pipeline(page);
    expect(p.scheduled + p.ready + p.inFlight, 'playing means audio is flowing').toBeGreaterThan(0);
  }
  await page.evaluate(() => { window.__reader.TTS.stop(false); });
});
