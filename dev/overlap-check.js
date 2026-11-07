/* Overlap check: reports any two visible interactive elements whose boxes intersect.
   Run in the browser console on any screen (or load with <script src="dev/overlap-check.js">),
   then call: marginaliaOverlapCheck()  → returns [] when nothing overlaps.

   "Visible" means: rendered, not inside an inert/aria-hidden subtree, clipped by every scrolling
   or overflow-hidden ancestor and by the viewport, and actually on top at its centre
   (elementFromPoint hits it or its child). A control and its own child are not counted. */
(function () {
  const SELECTOR = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=switch],[role=menuitem],[role=radio],[role=tab],[tabindex]:not([tabindex="-1"])';

  function clippedRect(el) {
    let r = el.getBoundingClientRect();
    let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    const cut = (o) => { box = { l: Math.max(box.l, o.left), t: Math.max(box.t, o.top), r: Math.min(box.r, o.right), b: Math.min(box.b, o.bottom) }; };
    cut({ left: 0, top: 0, right: innerWidth, bottom: innerHeight });
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) cut(p.getBoundingClientRect());
    }
    return box.r - box.l > 1 && box.b - box.t > 1 ? box : null;
  }

  function visible(el) {
    if (el.closest('[inert],[aria-hidden="true"],[hidden]')) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0 || cs.pointerEvents === 'none') return null;
    if (!el.getClientRects().length) return null;
    const box = clippedRect(el);
    if (!box) return null;
    const hit = document.elementFromPoint((box.l + box.r) / 2, (box.t + box.b) / 2);
    if (!hit || !(hit === el || el.contains(hit))) return null;
    return box;
  }

  function label(el) {
    const name = el.getAttribute('aria-label') || el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) || el.getAttribute('title') || '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + name + '"';
  }

  window.marginaliaOverlapCheck = function () {
    const els = [...document.querySelectorAll(SELECTOR)].map(el => ({ el, box: visible(el) })).filter(x => x.box);
    const overlaps = [];
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i], b = els[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const w = Math.min(a.box.r, b.box.r) - Math.max(a.box.l, b.box.l);
        const h = Math.min(a.box.b, b.box.b) - Math.max(a.box.t, b.box.t);
        if (w > 1 && h > 1) overlaps.push({ a: label(a.el), b: label(b.el), overlap: Math.round(w) + '×' + Math.round(h) + 'px' });
      }
    }
    return { checked: els.length, overlaps };
  };
})();
