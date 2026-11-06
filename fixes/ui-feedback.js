/* Marginalia click feedback.
   - Ripple from the finger or cursor on every button.
   - Particle burst when you bookmark, save a note, copy, export or highlight.
   - Toggles pop when switched.
   - Light vibration on Android where the browser allows it (iPhone does not support it).
   Respects reduced motion. Loaded from read-along-size.js. Remove the import to turn it off. */
(() => {
  if (window.__marginaliaFeedback) return;
  window.__marginaliaFeedback = true;

  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PALETTE = ['#0a84ff', '#ffd60a', '#34c759', '#ff375f', '#af52de', '#ff9f0a'];
  const TARGET = 'button, .pill, .act, .dot, .switch-row, .cover-btn, .ml-bm-main, .ml-go, .ab-play, .ab-stop, .icon-btn';

  const css = `
    .ml-rip{position:relative;overflow:hidden;isolation:isolate}
    .ml-rip-dot{position:absolute;border-radius:50%;pointer-events:none;background:currentColor;opacity:.22;transform:translate(-50%,-50%) scale(0);z-index:0;animation:mlRip .6s cubic-bezier(.2,.7,.2,1) forwards}
    @keyframes mlRip{to{transform:translate(-50%,-50%) scale(1);opacity:0}}
    .ml-part{position:fixed;left:0;top:0;width:7px;height:7px;border-radius:2px;pointer-events:none;z-index:200;will-change:transform,opacity}
    .switch-row .switch{transition:transform .35s cubic-bezier(.34,1.56,.64,1)}
    .switch-row:active .switch{transform:scale(.9)}
    @media (prefers-reduced-motion: reduce){.ml-rip-dot{display:none}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const rnd = (a, b) => a + Math.random() * (b - a);

  // Ripple: a soft circle that grows from the touch point.
  document.addEventListener('pointerdown', e => {
    if (reduce || e.button > 0) return;
    const el = e.target.closest && e.target.closest(TARGET);
    if (!el || el.disabled) return;
    const box = el.getBoundingClientRect();
    if (!box.width) return;
    el.classList.add('ml-rip');
    const dot = document.createElement('span');
    dot.className = 'ml-rip-dot';
    const size = Math.max(box.width, box.height) * 2.2;
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = (e.clientX - box.left) + 'px';
    dot.style.top = (e.clientY - box.top) + 'px';
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
    if (navigator.vibrate) navigator.vibrate(6);
  }, true);

  // Particle burst from a point on screen.
  function burst(x, y, count = 22) {
    if (reduce) return;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      p.className = 'ml-part';
      const shape = Math.random() < 0.35 ? '50%' : '2px';
      p.style.background = PALETTE[i % PALETTE.length];
      p.style.borderRadius = shape;
      document.body.appendChild(p);
      const angle = rnd(0, Math.PI * 2), dist = rnd(50, 120);
      const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist - rnd(20, 60);
      const rot = rnd(-260, 260);
      const anim = p.animate([
        { transform: `translate(${x}px,${y}px) rotate(0deg) scale(1)`, opacity: 1 },
        { transform: `translate(${x + dx}px,${y + dy}px) rotate(${rot / 2}deg) scale(.9)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${x + dx * 1.15}px,${y + dy + rnd(40, 90)}px) rotate(${rot}deg) scale(.3)`, opacity: 0 }
      ], { duration: rnd(650, 950), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
      anim.onfinish = () => p.remove();
    }
  }
  const centreOf = el => {
    if (!el) return { x: innerWidth / 2, y: innerHeight * 0.4 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  // Success moments: watch the toast text, then burst from the matching control.
  const toast = document.getElementById('toast');
  const rules = [
    { re: /Bookmarked/, at: () => centreOf(document.getElementById('mlBookmarkBtn')) },
    { re: /Note saved/, at: () => centreOf(document.getElementById('mlPanel')) },
    { re: /Copied/, at: () => centreOf(document.querySelector('#selMenu .act[data-a="copy"]')) },
    { re: /Exported/, at: () => centreOf(document.getElementById('mlExport')) },
    { re: /Saved/, at: () => centreOf(null) }
  ];
  if (toast) {
    let last = '';
    new MutationObserver(() => {
      const t = toast.textContent.trim();
      if (!t || t === last) { last = t; return; }
      last = t;
      const rule = rules.find(r => r.re.test(t));
      if (rule) { const c = rule.at(); burst(c.x, c.y); }
    }).observe(toast, { childList: true, characterData: true, subtree: true });
  }

  // Highlight colour picked from the selection menu: burst from the chosen dot.
  document.addEventListener('click', e => {
    const dot = e.target.closest && e.target.closest('#selMenu .dot');
    if (!dot) return;
    const c = centreOf(dot);
    burst(c.x, c.y, 16);
  }, true);

  // Bookmark added from the reader's top bar: a smaller burst from the icon.
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#mlAddBm');
    if (b) { const c = centreOf(b); setTimeout(() => burst(c.x, c.y, 18), 60); }
  }, true);
})();
