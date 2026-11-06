/* Marginalia library motion, ported from Magic UI (MIT).
   Copyright (c) Magic UI. Licence: MIT (https://github.com/magicuidesign/magicui/blob/main/LICENSE.md).
   Ported from these components, rewritten as plain JavaScript and CSS (no React or motion library):
     - blur-fade.tsx      -> library cards fade up out of blur as they appear
     - number-ticker.tsx  -> the stats count up with a spring (stiffness 100, damping 60)
     - ripple.tsx         -> pulsing rings behind the empty state
     - shine-border.tsx   -> a moving highlight around the continue-reading card
   Everything respects reduced-motion settings.
   Loaded from read-along-size.js. Remove the import to turn it off. */
(() => {
  if (window.__magicMotion) return;
  window.__magicMotion = true;

  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const lib = document.getElementById('library');
  const grid = document.getElementById('libGrid');

  const css = `
    /* cards: BlurFade handles their entrance, so the CSS entrance is turned off */
    #library #libGrid .card{animation:none!important}

    /* ShineBorder on the continue-reading card */
    #library .lib-continue{position:relative;isolation:isolate}
    #library .lib-continue::before{
      content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;z-index:0;
      background:radial-gradient(transparent,transparent,var(--accent),transparent,transparent) 0 0/300% 300%;
      -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
      -webkit-mask-composite:xor;mask-composite:exclude;
      animation:mlShine 14s linear infinite;
    }
    #library .lib-continue>*{position:relative;z-index:1}
    @keyframes mlShine{0%{background-position:0% 0%}100%{background-position:100% 100%}}

    /* NumberTicker: the numbers in the stats line */
    #library .lib-stats .mt{display:inline-block;font-variant-numeric:tabular-nums;color:var(--fg);font-weight:600}

    /* Ripple: rings behind the empty state */
    #library #libEmpty{position:relative}
    #library #libEmpty>*:not(.ml-ripple){position:relative;z-index:1}
    #library .ml-ripple{position:absolute;left:50%;top:38%;width:0;height:0;pointer-events:none;z-index:0}
    #library .ml-ripple i{
      position:absolute;left:50%;top:50%;border-radius:50%;
      border:1px solid var(--line);background:color-mix(in srgb,var(--accent) 5%,transparent);
      transform:translate(-50%,-50%) scale(1);
      animation:mlRipple 4s ease-in-out infinite;
    }
    @keyframes mlRipple{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(.9)}}

    @media (prefers-reduced-motion:reduce){
      #library .lib-continue::before,#library .ml-ripple i{animation:none!important}
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---- BlurFade ---- */
  const faded = new WeakSet();
  function blurFade(card, index) {
    if (faded.has(card)) return;
    faded.add(card);
    if (reduce || !card.animate) return;
    card.animate(
      [
        { opacity: 0, transform: 'translate3d(0,8px,0)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'translate3d(0,0,0)', filter: 'blur(0px)' }
      ],
      { duration: 400, delay: 40 + index * 55, easing: 'ease-out', fill: 'both' }
    );
  }

  /* ---- NumberTicker (spring) ---- */
  function tick(el, from, to) {
    if (reduce) { el.textContent = String(to); return; }
    const K = 100, C = 60;             // stiffness and damping, as in the Magic UI component
    let x = from, v = 0, last = 0, token = (el._tick || 0) + 1;
    el._tick = token;
    const step = t => {
      if (el._tick !== token) return;
      if (!last) last = t;
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      const a = -K * (x - to) - C * v;
      v += a * dt;
      x += v * dt;
      el.textContent = String(Math.round(x));
      if (Math.abs(x - to) > 0.4 || Math.abs(v) > 0.4) requestAnimationFrame(step);
      else el.textContent = String(to);
    };
    requestAnimationFrame(step);
  }

  const prevValues = [];
  function renderStats() {
    const el = lib && lib.querySelector('.lib-stats');
    if (!el || !grid) return;
    const cards = Array.from(grid.querySelectorAll('.card'));
    const c = { all: cards.length, reading: 0, done: 0 };
    cards.forEach(card => {
      if (card.dataset.status === 'reading') c.reading++;
      if (card.dataset.status === 'done') c.done++;
    });
    if (!c.all) { el.textContent = ''; return; }
    const text = `${c.all} ${c.all === 1 ? 'book' : 'books'} · ${c.reading} in progress · ${c.done} finished`;
    const parts = text.split(/(\d+)/);
    el.textContent = '';
    let n = 0;
    parts.forEach((p, i) => {
      if (i % 2 === 1) {
        const s = document.createElement('span');
        s.className = 'mt';
        const to = +p;
        const from = prevValues[n] != null ? prevValues[n] : 0;
        prevValues[n] = to;
        s.textContent = String(from);
        el.appendChild(s);
        tick(s, from, to);
        n++;
      } else if (p) {
        el.appendChild(document.createTextNode(p));
      }
    });
  }

  /* ---- ripple rings for the empty state ---- */
  function ensureRipple() {
    const empty = document.getElementById('libEmpty');
    if (!empty || empty.querySelector('.ml-ripple')) return;
    const wrap = document.createElement('div');
    wrap.className = 'ml-ripple';
    wrap.setAttribute('aria-hidden', 'true');
    const count = 6;
    for (let i = 0; i < count; i++) {
      const ring = document.createElement('i');
      const size = 200 + i * 62;
      ring.style.width = size + 'px';
      ring.style.height = size + 'px';
      ring.style.opacity = String(0.42 - i * 0.05);
      ring.style.animationDelay = (i * 0.12) + 's';
      wrap.appendChild(ring);
    }
    empty.insertBefore(wrap, empty.firstChild);
  }

  /* ---- wiring ---- */
  let scheduled = false;
  function refresh() {
    scheduled = false;
    if (!grid) return;
    let k = 0;
    grid.querySelectorAll('.card').forEach(card => {
      if (!faded.has(card)) blurFade(card, k++);
    });
    renderStats();
    ensureRipple();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }

  function mount() {
    if (!lib || !grid) return;
    new MutationObserver(schedule).observe(grid, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-status']
    });
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
