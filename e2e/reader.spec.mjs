/* Reader details: the speed reader (two lines of context above and below, pivot in the middle, adjustable colour),
   text that must fit on a phone (title, bottom label, player buttons) and toasts that stay clear of the bars. */
import { test, expect } from './fixtures.mjs';

async function startSpeedReader(page, app) {
  await app.importBook(true);
  await page.evaluate(() => window.__reader.moreAction('speed'));
  await page.locator('[data-speed-start="chapter"]').click();
  await expect(page.locator('#speedPivot')).not.toBeEmpty();
}

test('speed reader: two lines of context above and below, the pivot letter sits in the exact middle', async ({ page, app }) => {
  await startSpeedReader(page, app);
  expect(await page.locator('.speed-step').count(), 'the stray "1" is gone').toBe(0);
  await page.evaluate(() => window.__reader.SpeedReader.seek(40));   // mid-chapter, so there is text on both sides
  await page.waitForTimeout(200);
  expect((await page.locator('#speedCtxBefore').textContent()).length).toBeGreaterThan(10);
  expect((await page.locator('#speedCtxAfter').textContent()).length).toBeGreaterThan(10);
  const geo = await page.evaluate(() => {
    const px = el => el.getBoundingClientRect(), lh = el => parseFloat(getComputedStyle(el).lineHeight);
    const b = document.querySelector('#speedCtxBefore'), a = document.querySelector('#speedCtxAfter'), w = document.querySelector('.speed-word'), p = document.querySelector('#speedPivot');
    return {
      beforeLines: Math.round(px(b).height / lh(b)), afterLines: Math.round(px(a).height / lh(a)),
      order: px(b).bottom <= px(w).top + 1 && px(w).bottom <= px(a).top + 1,
      pivotOff: Math.abs(px(p).left + px(p).width / 2 - px(w).left - px(w).width / 2)
    };
  });
  expect(geo.beforeLines).toBe(2);
  expect(geo.afterLines).toBe(2);
  expect(geo.order, 'context above, word in the middle, context below').toBe(true);
  expect(geo.pivotOff, 'pivot letter is centred').toBeLessThanOrEqual(2);
  expect(await app.overlaps(), 'overlaps').toBe(0);
});

test('speed reader: focus colour is adjustable and remembered, context lines can be switched off', async ({ page, app }) => {
  await startSpeedReader(page, app);
  await page.locator('#speedStyleBtn').click();
  await page.locator('.speed-sw[aria-label="Green"]').click();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#speedPivot')).color)).toBe('rgb(48, 209, 88)');
  await page.locator('#speedColorInput').fill('#ff00aa');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#speedPivot')).color)).toBe('rgb(255, 0, 170)');
  await page.locator('#speedCtxToggle').click();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#speedCtxBefore')).visibility)).toBe('hidden');
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('reader.speed.style')))).toEqual({ color: '#ff00aa', ctx: false });
  // remembered after a reload
  await page.reload();
  await page.waitForFunction(() => window.__reader);
  await app.importBook(true);
  await page.evaluate(() => window.__reader.moreAction('speed'));
  await page.locator('[data-speed-start="chapter"]').click();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#speedPivot')).color)).toBe('rgb(255, 0, 170)');
});

test('speed reader: long words shrink instead of running off the screen', async ({ page, app }) => {
  await startSpeedReader(page, app);
  await page.evaluate(() => {
    const S = window.__reader.SpeedReader;
    S.words[S.index] = { word: 'incomprehensibilities', punctuation: ',', start: 0, textStart: 0 };
    S.render();
  });
  const fit = await page.evaluate(() => { const w = document.querySelector('.speed-word').getBoundingClientRect(); const kids = [...document.querySelectorAll('.speed-word span')].map(s => s.getBoundingClientRect()); return Math.min(...kids.map(k => k.left)) >= w.left - 1 && Math.max(...kids.map(k => k.right)) <= w.right + 1; });
  expect(fit).toBe(true);
});

test('reader text fits: titles wrap to two lines, the bottom label does not cut words, player buttons wrap', async ({ page, app, browserName }) => {
  await app.importBook(true);
  await page.evaluate(() => { window.__reader.App.chrome = true; document.body.classList.add('chrome-on'); });
  await page.waitForTimeout(400);
  const t = await page.evaluate(() => {
    const b = document.querySelector('#v2-reader .rtitle b'), l = document.querySelector('#v2-reader .scrub .lbl');
    return { clamp: getComputedStyle(b).webkitLineClamp, ws: getComputedStyle(b).whiteSpace, label: l.textContent, labelFits: l.scrollHeight <= l.clientHeight + 1 };
  });
  expect(t.clamp).toBe('2');
  expect(t.ws).not.toBe('nowrap');
  expect(t.labelFits, `label "${t.label}"`).toBe(true);
  if ((await page.viewportSize()).width < 440) expect(t.label).toMatch(/^Page \d+\/\d+/);
  test.skip(browserName !== 'chromium', 'read-aloud needs speechSynthesis, which headless WebKit does not have');
  await page.evaluate(() => { window.__reader.TTS.playFrom(0, 0); });
  await page.waitForTimeout(800);
  await page.locator('#v2-reader .mini .mid').click();
  await page.waitForSelector('.v2-player');
  const over = await page.evaluate(() => [...document.querySelectorAll('.v2-player .v2-btn')].filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent.trim()));
  expect(over, 'player buttons whose text overflows').toEqual([]);
  expect(await app.overlaps()).toBe(0);
});

test('toasts appear above the bars and the mini player, never over them', async ({ page, app }) => {
  await app.importBook(true);
  await page.evaluate(() => { window.__reader.App.chrome = true; document.body.classList.add('chrome-on'); window.__reader.TTS.playFrom(0, 0); });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const t = document.getElementById('toast'); t.textContent = 'EdgeTTS failed (something went wrong while reading). Playback paused to keep your locked voice.'; t.classList.add('on'); });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const t = document.getElementById('toast').getBoundingClientRect(), bar = document.querySelector('#v2-reader .rbottom').getBoundingClientRect(), mini = document.querySelector('#v2-reader .mini');
    const top = Math.min(bar.top, mini && !mini.hidden ? mini.getBoundingClientRect().top : Infinity);
    return { toastBottom: Math.round(t.bottom), barsTop: Math.round(top), width: Math.round(t.width), vw: innerWidth };
  });
  expect(r.toastBottom, JSON.stringify(r)).toBeLessThanOrEqual(r.barsTop);
  expect(r.width).toBeLessThanOrEqual(r.vw - 16);
});
