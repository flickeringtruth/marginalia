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

test('engine dialogs (dictionary, AI) follow the app theme, not the reading theme', async ({ page, app }) => {
  await app.importBook(true);
  await page.evaluate(() => window.__reader.setSetting('theme', 'black'));   // dark page
  await app.openSettings('look');
  await page.getByRole('radio', { name: 'Light', exact: true }).click();
  await app.closeSheet();
  await page.evaluate(() => window.__reader.dictionaryButton());
  await expect(page.locator('#dictSheet.open')).toHaveCount(1);
  await page.waitForTimeout(400);
  const light = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('#dictSheet')); return [s.backgroundColor, s.color]; });
  expect(light[0], 'dictionary sheet is the light app surface even with a black page').toBe('rgb(255, 255, 255)');
  expect(light[1]).toBe('rgb(20, 20, 19)');
  // every close icon draws a full X (two different strokes)
  const broken = await page.evaluate(() => [...document.querySelectorAll('button[data-close] path')].map(p => p.getAttribute('d')).filter(d => /M18 18 6 6/.test(d)));
  expect(broken, 'close icons with a duplicated stroke').toEqual([]);
});

test('the flux canvas stays invisible until it has painted a frame (no black flash in the light theme)', async ({ page, app, browserName }) => {
  void app;
  test.skip(browserName === 'webkit', 'WebKit does not route the dynamic module import, so the delay cannot be forced');
  await page.evaluate(() => localStorage.setItem('marginalia.appTheme', 'light'));
  await page.route('**/simplex-noise.js', async route => { await new Promise(r => setTimeout(r, 1200)); await route.continue(); });
  await page.reload();
  await page.waitForSelector('#v2-library canvas.v2-flux', { state: 'attached' });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#v2-library canvas.v2-flux')).opacity)).toBe('0');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('#v2-library canvas.v2-flux')).opacity), { timeout: 8000 }).toBe('1');
});

test('picking a reading theme makes the whole app match it, and Dark/Light take over again', async ({ page, app }) => {
  await app.importBook(false);
  await app.openSettings('look');
  await page.locator('.v2-theme', { hasText: 'Sepia' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appTheme)).toBe('page');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(248, 241, 227)');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.v2-sheet')).backgroundColor), 'sheets wear the page theme too').not.toBe('rgb(43, 42, 40)');
  expect(await page.evaluate(() => localStorage.getItem('marginalia.appTheme'))).toBe('page');
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(31, 30, 29)');
  // remembered across a reload
  await page.getByRole('radio', { name: 'Match page', exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => window.__reader);
  expect(await page.evaluate(() => document.documentElement.dataset.appTheme)).toBe('page');
});

test('with Match page, text stays readable (WCAG AA) in every reading theme', async ({ page, app }) => {
  await app.importBook(false);
  await app.openSettings('look');
  const count = await page.locator('.v2-theme').count();
  expect(count).toBeGreaterThanOrEqual(5);
  for (let i = 0; i < count; i++) {
    await page.locator('.v2-theme').nth(i).click();
    await page.waitForTimeout(350);
    const low = await page.evaluate(() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 1;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      const rgb = name => { const d = document.createElement('i'); d.style.color = `var(${name})`; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data.slice(0, 3)]; };
      const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ratio = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const out = [];
      for (const fg of ['--app-text', '--app-muted', '--app-accent-text', '--app-danger']) for (const bg of ['--app-bg', '--app-surface', '--app-raised']) {
        if (fg === '--app-danger' && bg === '--app-bg') continue;
        const r = ratio(fg, bg); if (r < 4.5) out.push(`${fg} on ${bg} ${r.toFixed(2)}`);
      }
      return out;
    });
    expect(low, `theme #${i}`).toEqual([]);
  }
});
