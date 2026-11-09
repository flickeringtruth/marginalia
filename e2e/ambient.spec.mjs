/* Ambient sound: a preset chip applies its mood (params + kind) and starts that sound, moving a param
   slider customizes the mood and breaks the preset link (exact-match snap), and switching to Off stops
   the sound and removes the per-sound sliders. Persisted values (kind, params, preset) survive a reload;
   the audio itself never auto-resumes after a reload (autoplay policy). Audio is validated in Chromium
   only: headless WebKit has no audio engine. */
import { test, expect } from './fixtures.mjs';

const PRESETS = ['library', 'fireside', 'storm'];
const crackle = page => page.evaluate(() => window.__reader.A.ambParams.fire.crackle);
const activePreset = page => page.evaluate(() => window.__reader.A.ambPreset);
const ambientKind = page => page.evaluate(() => window.__reader.Ambient.kind);

/** Imports the test book, opens the audio settings tab and activates the Fireside preset. */
async function startFireside(page, app) {
  await app.importBook();
  await app.openSettings('audio');
  await page.locator('[data-amb-preset="fireside"]').click();
  await expect.poll(() => ambientKind(page)).toBe('fire');
}

test('a preset chip applies its mood and starts that sound', async ({ page, app }, info) => {
  test.skip(info.project.name.startsWith('webkit'), 'audio playback is checked in Chromium');
  await startFireside(page, app);
  expect(await crackle(page), 'the preset applied its params to the kind').toBe(0.65);
  expect(await activePreset(page), 'the active preset is recorded').toBe('fireside');
  const chip = page.locator('[data-amb-preset="fireside"]');
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-amb-param="fire.crackle"]'), 'the fire slider exists only while fire is active').toBeVisible();
});

test('moving a slider customizes the mood and the value survives a reload', async ({ page, app }, info) => {
  test.skip(info.project.name.startsWith('webkit'), 'audio playback is checked in Chromium');
  await startFireside(page, app);
  await page.locator('[data-amb-param="fire.crackle"] input[type=range]').fill('0.2');
  await expect.poll(() => crackle(page)).toBe(0.2);
  await expect.poll(() => activePreset(page), 'custom params break the preset link').toBe('');
  for (const p of PRESETS) {
    await expect(page.locator(`[data-amb-preset="${p}"]`), `no preset matches ${p} any more`).toHaveAttribute('aria-pressed', 'false');
  }
  // Values persist across a reload even though the audio never auto-resumes (autoplay policy).
  await page.reload();
  await page.waitForFunction(() => window.__reader);
  await page.waitForTimeout(800); // the v2 shell finishes wiring shortly after __reader exists; openSettings races otherwise
  await app.openSettings('audio');
  await expect.poll(() => ambientKind(page)).toBe('fire');
  await expect.poll(() => page.evaluate(() => document.querySelector('[data-amb-param="fire.crackle"] input[type=range]').valueAsNumber)).toBe(0.2);
});

test('switching to off stops the sound and hides the per-sound sliders', async ({ page, app }, info) => {
  test.skip(info.project.name.startsWith('webkit'), 'audio playback is checked in Chromium');
  await startFireside(page, app);
  await page.locator('[data-amb-kind="off"]').click();
  await expect.poll(() => ambientKind(page)).toBe('off');
  await expect(page.locator('[data-amb-param="fire.crackle"]'), 'per-sound sliders only exist while their kind is active').toHaveCount(0);
  expect(await activePreset(page), 'no preset survives an explicit Off').toBe('');
});
