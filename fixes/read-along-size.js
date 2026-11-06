/* Marginalia read-along text size.
   The A− / A+ buttons in the read-aloud player now size the read-along lines only.
   They used to change the book's text size. The book size is still set in Settings.
   Loaded from reader-tools.js as a module. */
import './ui-polish.js';
import './ui-motion.js';

(() => {
  if (window.__marginaliaReadAlongSize) return;
  window.__marginaliaReadAlongSize = true;

  const KEY = 'marginalia.readAlongSize';
  const MIN = 14, MAX = 44, STEP = 2;
  const $ = s => document.querySelector(s);

  let size = 0;
  try { size = +localStorage.getItem(KEY) || 0; } catch (e) { /* ignore */ }

  const style = document.createElement('style');
  document.head.appendChild(style);

  function apply() {
    style.textContent = size ? '.ab-lyric-line{font-size:' + size + 'px !important}' : '';
  }

  function current() {
    if (size) return size;
    const line = $('.ab-lyric-line');
    return line ? parseFloat(getComputedStyle(line).fontSize) || 26 : 26;
  }

  function set(v) {
    size = Math.round(Math.min(MAX, Math.max(MIN, v)));
    try { localStorage.setItem(KEY, String(size)); } catch (e) { /* ignore */ }
    apply();
  }

  // Swap the buttons for copies so the old listeners (which change the book text) are dropped.
  const smaller = $('#abTextSmaller'), larger = $('#abTextLarger');
  if (!smaller || !larger) return;
  const a = smaller.cloneNode(true), b = larger.cloneNode(true);
  a.setAttribute('aria-label', 'Decrease read along text size');
  b.setAttribute('aria-label', 'Increase read along text size');
  smaller.replaceWith(a);
  larger.replaceWith(b);
  a.addEventListener('click', e => { e.stopPropagation(); set(current() - STEP); });
  b.addEventListener('click', e => { e.stopPropagation(); set(current() + STEP); });

  apply();
})();
