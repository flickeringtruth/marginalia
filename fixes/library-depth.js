/* Marginalia library depth: 3D tilt, glare sweep, spotlight, colour auras.
   Ported in part from Magic UI (MIT, copyright (c) Magic UI):
     - glare-hover.tsx -> the light sweep across a cover on hover (CSS background-position, same gradient idea)
     - magic-card.tsx  -> the spotlight that follows the pointer (radial gradient at the pointer, same idea)
   The 3D tilt and the colour auras are original code written for this file.
   Pointer-fine devices only (mouse, trackpad) for tilt and glare; touch gets the spotlight and auras.
   Reduced motion turns off the tilt and the sweep.
   Loaded from read-along-size.js. Remove the import to turn it off. */
(() => {
  if (window.__libDepth) return;
  window.__libDepth = true;

  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const finePointer = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
  const lib = document.getElementById('library');
  const grid = document.getElementById('libGrid');

  const css = `
    /* tilt wrapper around each cover */
    #library .ml-tilt{
      position:relative;transform-style:preserve-3d;
      transform:perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) scale(var(--s,1));
      will-change:transform;
    }
    /* colour aura: each cover glows in its own hue */
    #library .ml-tilt .cover-btn{
      box-shadow:0 1px 1px rgba(0,0,0,.12),
                 0 22px 36px -18px hsl(var(--h,220) 65% 50% / .6),
                 0 8px 16px -10px rgba(0,0,0,.45);
    }
    /* glare sweep (ported idea from glare-hover) */
    #library .ml-glare{
      position:absolute;inset:0;z-index:3;pointer-events:none;border-radius:inherit;
      background:linear-gradient(-45deg,transparent 60%,rgba(255,255,255,.32) 70%,transparent 80%) -100% -100% / 250% 250% no-repeat;
      transition:background-position .65s ease-in-out;
    }
    @media (hover:hover){#library .cover-btn:hover .ml-glare{background-position:100% 100%,0 0}}

    /* spotlight that follows the pointer (ported idea from magic-card) */
    #library #libGrid .card::after,
    #library .lib-continue::after{
      content:"";position:absolute;inset:-6px;z-index:4;pointer-events:none;border-radius:16px;
      background:radial-gradient(150px circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.14),transparent 70%);
      opacity:0;transition:opacity .35s ease;
    }
    #library .lib-continue::after{inset:0;z-index:2;border-radius:inherit}
    @media (hover:hover){
      #library #libGrid .card:hover::after,
      #library .lib-continue:hover::after{opacity:1}
    }
    @media (prefers-reduced-motion:reduce){
      #library .ml-glare{transition:none}
      #library .ml-tilt{transform:none!important}
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const enhanced = new WeakSet();
  const tilts = new WeakMap();

  // stable hue from the title, so each book keeps its own colour
  function hueOf(text) {
    let h = 0;
    for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % 360;
  }

  function setTarget(wrap, x, y, scale) {
    let st = tilts.get(wrap);
    if (!st) { st = { x: 0, y: 0, s: 1, tx: 0, ty: 0, ts: 1, raf: 0 }; tilts.set(wrap, st); }
    st.tx = x; st.ty = y; st.ts = scale;
    if (!st.raf) st.raf = requestAnimationFrame(() => frame(wrap, st));
  }

  function frame(wrap, st) {
    st.raf = 0;
    st.x += (st.tx - st.x) * 0.14;
    st.y += (st.ty - st.y) * 0.14;
    st.s += (st.ts - st.s) * 0.14;
    wrap.style.setProperty('--ry', (st.x * 9).toFixed(2) + 'deg');
    wrap.style.setProperty('--rx', (-st.y * 9).toFixed(2) + 'deg');
    wrap.style.setProperty('--s', st.s.toFixed(4));
    const settled = Math.abs(st.tx - st.x) < 0.002 && Math.abs(st.ty - st.y) < 0.002 && Math.abs(st.ts - st.s) < 0.001;
    if (!settled) st.raf = requestAnimationFrame(() => frame(wrap, st));
  }

  function enhanceCard(card) {
    if (enhanced.has(card)) return;
    enhanced.add(card);
    const cover = card.querySelector('.cover-btn');
    if (!cover) return;

    card.style.setProperty('--h', hueOf(card.querySelector('.card-title')?.textContent || ''));

    // wrap the cover so the tilt does not fight the existing hover lift
    const wrap = document.createElement('div');
    wrap.className = 'ml-tilt';
    cover.parentNode.insertBefore(wrap, cover);
    wrap.appendChild(cover);

    const glare = document.createElement('i');
    glare.className = 'ml-glare';
    glare.setAttribute('aria-hidden', 'true');
    cover.appendChild(glare);

    if (finePointer && !reduce) {
      wrap.addEventListener('pointermove', e => {
        const r = wrap.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * 2 - 1;
        const py = ((e.clientY - r.top) / r.height) * 2 - 1;
        setTarget(wrap, px, py, 1.03);
      });
      wrap.addEventListener('pointerleave', () => setTarget(wrap, 0, 0, 1));
    }

    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  function attachContinue() {
    const section = lib && lib.querySelector('.lib-continue');
    if (!section || section.dataset.depth) return;
    section.dataset.depth = '1';
    section.addEventListener('pointermove', e => {
      const r = section.getBoundingClientRect();
      section.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      section.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  let scheduled = false;
  function refresh() {
    scheduled = false;
    if (!grid) return;
    grid.querySelectorAll('.card').forEach(enhanceCard);
    attachContinue();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }

  function mount() {
    if (!lib || !grid) return;
    new MutationObserver(schedule).observe(grid, { childList: true });
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
