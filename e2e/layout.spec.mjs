/* Layout rules on every screen: one scroll container, no fixed element inside a transformed ancestor,
   inputs of 16 px or more (iOS zooms below that), no horizontal scroll, no overlapping controls,
   and the library keeps its scroll position after reading a book. */
import { test, expect } from './fixtures.mjs';

const AUDIT = () => {
  const visible = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden],[inert]'); };
  const scrollers = [...document.querySelectorAll('*')].filter(el => {
    if (!visible(el)) return false;
    const cs = getComputedStyle(el);
    return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
  }).map(el => (el.id ? '#' + el.id : '') + '.' + String(el.className).split(' ').slice(0, 2).join('.'));
  const transformed = [];
  for (const el of document.querySelectorAll('*')) {
    if (getComputedStyle(el).position !== 'fixed' || !visible(el)) continue;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none' || (cs.backdropFilter && cs.backdropFilter !== 'none')) { transformed.push((el.id || el.className) + ' in ' + (p.id || p.className)); break; }
    }
  }
  const small = [...document.querySelectorAll('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]):not([type=hidden]),textarea,select')]
    .filter(visible).filter(el => parseFloat(getComputedStyle(el).fontSize) < 16).map(el => (el.id || el.className || el.tagName) + ' ' + getComputedStyle(el).fontSize);
  return { scrollers, transformed, small, hscroll: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1 };
};

async function expectClean(page, app, where, scrollers = 1) {
  await page.waitForTimeout(400);
  const a = await page.evaluate(AUDIT);
  expect(a.scrollers.length, `${where}: scroll containers ${a.scrollers.join(', ')}`).toBeLessThanOrEqual(scrollers);
  expect(a.transformed, `${where}: fixed elements inside transformed ancestors`).toEqual([]);
  expect(a.small, `${where}: inputs under 16px`).toEqual([]);
  expect(a.hscroll, `${where}: horizontal scroll`).toBe(false);
  expect(await app.overlaps(), `${where}: overlapping controls`).toBe(0);
}

test('library, reader and every sheet follow the layout rules', async ({ page, app }) => {
  await app.importBook(false);
  await expectClean(page, app, 'library');
  await app.importBook(true);
  await expectClean(page, app, 'reader', 0);
  for (const [name, open] of [
    ['settings look', () => window.__reader.openSettings('look')],
    ['settings audio', () => window.__reader.openSettings('audio')],
    ['contents', () => window.__reader.ui.openContents('toc')],
    ['more', () => window.__reader.ui.openMore('reader')]
  ]) {
    await page.evaluate(open);
    await expectClean(page, app, name);
    await app.closeSheet();
  }
});

test('Discover follows the layout rules', async ({ page, app }) => {
  await page.route('https://gutendex.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ count: 0, next: null, results: [] }) }));
  await app.importBook(false);
  await page.getByRole('button', { name: /discover/i }).first().click();
  await page.waitForSelector('.v2-discover');
  await expectClean(page, app, 'discover');
});

test('the library keeps its scroll position after reading a book', async ({ page, app }) => {
  await app.importBook(false);
  const over = await page.evaluate(() => { const m = document.querySelector('#v2-library .v2-main'); return m.scrollHeight - m.clientHeight; });
  test.skip(over < 30, 'the library does not overflow at this size');
  const target = Math.min(120, over);
  await page.evaluate(t => { document.querySelector('#v2-library .v2-main').scrollTop = t; }, target);
  await app.importBook(true);
  await app.toLibrary();
  await page.waitForTimeout(700);
  const top = await page.evaluate(() => document.querySelector('#v2-library .v2-main').scrollTop);
  expect(Math.abs(top - target)).toBeLessThanOrEqual(4);
});
