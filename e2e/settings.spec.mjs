/* Settings sheet: scrolls to its last item with touch, nothing overlaps, no horizontal scroll,
   app theme and flux background work and do not flash. Guards the iPhone "Settings cannot be scrolled" bug. */
import { test, expect } from './fixtures.mjs';

const isTouchProject = info => /iphone/.test(info.project.name);

/** Scrolls the sheet body to its end the way a finger would where possible. */
async function scrollSheetToEnd(page, context, info) {
  const atEnd = () => page.evaluate(() => { const b = document.querySelector('.v2-sheet-body'); return b.scrollTop + b.clientHeight >= b.scrollHeight - 1; });
  const box = await page.locator('.v2-sheet-body').boundingBox();
  const x = box.x + box.width / 2;
  if (isTouchProject(info) && info.project.name.startsWith('chromium')) {
    const cdp = await context.newCDPSession(page);
    for (let k = 0; k < 80 && !(await atEnd()); k++) {
      let y = box.y + box.height - 40;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 0; i < 10; i++) { y -= 30; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await page.waitForTimeout(12); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(100);
    }
  } else if (isTouchProject(info)) {
    // WebKit has no touch-gesture API: the document guard must not cancel a touchmove inside the sheet, then scroll directly.
    const cancelled = await page.evaluate(() => {
      const target = document.querySelector('.v2-sheet-body .grp') || document.querySelector('.v2-sheet-body');
      const ev = new Event('touchmove', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'touches', { value: [{ clientX: 50, clientY: 300 }] });
      target.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(cancelled, 'touchmove inside the sheet must not be cancelled').toBe(false);
    await page.evaluate(() => { const b = document.querySelector('.v2-sheet-body'); b.scrollTop = b.scrollHeight; });
  } else {
    await page.mouse.move(x, box.y + 100);
    for (let k = 0; k < 80 && !(await atEnd()); k++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(50); }
  }
  await page.waitForTimeout(250);
  expect(await atEnd(), 'reached the end of the sheet').toBe(true);
}

for (const tab of ['look', 'audio']) {
  test(`settings › ${tab}: scrolls to the last item, clear of the bottom, no overlaps`, async ({ page, context, app }, info) => {
    await app.importBook();
    await app.openSettings(tab);
    expect(await app.overlaps(), 'overlaps at top').toBe(0);
    await scrollSheetToEnd(page, context, info);
    const gap = await page.evaluate(() => {
      const body = document.querySelector('.v2-sheet-body'), sheet = document.querySelector('.v2-sheet').getBoundingClientRect();
      const last = [...body.querySelectorAll('button,input,p,h3,label,summary')].filter(e => e.getBoundingClientRect().height > 0).pop().getBoundingClientRect();
      return Math.round(sheet.bottom - last.bottom);
    });
    expect(gap, 'last item stays above the sheet bottom (safe-area padding)').toBeGreaterThanOrEqual(8);
    expect(await app.overlaps(), 'overlaps at end').toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), 'horizontal scroll').toBe(false);
  });
}

test('a swipe that starts on a slider still scrolls the sheet', async ({ page, app }) => {
  await app.importBook();
  await app.openSettings('look');
  const touchAction = await page.evaluate(() => getComputedStyle(document.querySelector('.v2-sheet-body input[type=range]')).touchAction);
  expect(touchAction).toBe('pan-y');
});

test('app theme: dark by default, light on request, remembered, no flash on reload', async ({ page, app }) => {
  expect(await page.evaluate(() => document.documentElement.dataset.appTheme)).toBe('dark');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(31, 30, 29)');
  await app.importBook(false);
  await app.openSettings('look');
  await page.getByRole('radio', { name: 'Light', exact: true }).click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(250, 249, 245)');
  expect(await page.evaluate(() => localStorage.getItem('marginalia.appTheme'))).toBe('light');
  // reload: record the page background on every frame while it loads
  await page.addInitScript(() => {
    window.__bg = new Set();
    const rec = () => { try { window.__bg.add(getComputedStyle(document.documentElement).backgroundColor + '|' + (document.body ? getComputedStyle(document.body).backgroundColor : '-')); } catch { /* ignore */ } };
    document.addEventListener('readystatechange', rec);
    let n = 0; const f = () => { rec(); if (n++ < 40) requestAnimationFrame(f); }; requestAnimationFrame(f);
  });
  await page.reload();
  await page.waitForFunction(() => window.__reader);
  await page.waitForTimeout(800);
  const seen = await page.evaluate(() => [...window.__bg]);
  expect(seen, 'only the light background was ever painted').toEqual(['rgb(250, 249, 245)|rgb(250, 249, 245)']);
});

test('flux background: on by default, can be switched off and on, never behind the reader', async ({ page, app }) => {
  await expect(page.locator('#v2-library canvas.v2-flux')).toHaveCount(1);
  await app.importBook(false);
  await app.openSettings('look');
  const toggle = page.getByRole('switch', { name: 'Animated background' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.flux)).toBe('off');
  expect(await page.evaluate(() => localStorage.getItem('marginalia.flux'))).toBe('0');
  await toggle.click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.flux)).toBe('on');
  await app.closeSheet();
  expect(await page.locator('#reader canvas.v2-flux, #stage canvas.v2-flux, #v2-reader canvas.v2-flux').count(), 'no flux in the reader').toBe(0);
});

test('flux animates at no more than 30 fps, stops when hidden, and is still under reduced motion', async ({ page, app, browserName }) => {
  test.skip(browserName !== 'chromium', 'timing is measured in Chromium');
  const draws = ms => page.evaluate(t => new Promise(res => {
    let n = 0; const orig = CanvasRenderingContext2D.prototype.putImageData;
    CanvasRenderingContext2D.prototype.putImageData = function (...a) { n++; return orig.apply(this, a); };
    setTimeout(() => { CanvasRenderingContext2D.prototype.putImageData = orig; res(n / (t / 1000)); }, t);
  }), ms);
  await page.waitForTimeout(1200);
  const fps = await draws(2000);
  expect(fps).toBeGreaterThan(10);
  expect(fps).toBeLessThanOrEqual(31);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  expect(await draws(1200), 'paused while hidden').toBe(0);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(400);
  expect(await draws(1200), 'still under reduced motion').toBe(0);
});
