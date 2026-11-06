/* Marginalia book-open animation.
   Tap a cover in the library and the book:
     1. lifts off its spot on the shelf, with a ring of sparkles,
     2. spins a full turn in 3D,
     3. the front cover swings open, with page flakes drifting off the hinge,
     4. the book flies toward you and fades, and you are inside the reader.
   The reader opens in parallel, so the animation waits for it before zooming through.
   Reduced motion: opens the book straight away. Loaded from read-along-size.js. Remove the import to turn it off. */
(() => {
  if (window.__marginaliaBookOpen) return;
  window.__marginaliaBookOpen = true;

  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  let busy = false, bypass = false;

  const css = `
    .mlb-overlay{position:fixed;inset:0;z-index:300;overflow:hidden;touch-action:none}
    .mlb-dim{position:absolute;inset:0;background:#07070a;opacity:0}
    .mlb-stage{position:absolute;inset:0;perspective:1600px;perspective-origin:50% 50%}
    .mlb-book{position:absolute;left:0;top:0;transform-style:preserve-3d;transform-origin:50% 50%;will-change:transform,opacity}
    .mlb-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:3px 8px 8px 3px;overflow:hidden}
    .mlb-front{transform-origin:0 50%;background:#2b2b30;box-shadow:inset 7px 0 12px -7px rgba(0,0,0,.6),0 22px 30px rgba(0,0,0,.4)}
    .mlb-front img{width:100%;height:100%;object-fit:cover;display:block}
    .mlb-front .gen-cover{position:absolute;inset:0}
    .mlb-back{transform:rotateY(180deg);background:#2b2b30}
    .mlb-inside{position:absolute;left:2%;top:3%;right:3%;bottom:3%;transform:translateZ(-2px);border-radius:2px;background:linear-gradient(90deg,#cfc3a2,#f4ecd6 40%,#fbf6e6)}
    .mlb-pages{position:absolute;left:3%;top:3%;right:2%;bottom:3%;transform:translateZ(-4px);border-radius:0 5px 5px 0;
      background:repeating-linear-gradient(180deg,rgba(90,70,40,.06) 0 1px,transparent 1px 16px),#fbf6e8;box-shadow:inset 0 0 22px rgba(120,90,40,.22)}
    .mlb-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    body.mlb-opening #loading{display:none!important}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const div = cls => { const d = document.createElement('div'); d.className = cls; return d; };

  /* The title is the only link between a library card and its stored book id. */
  function dbFindId(title) {
    return new Promise(resolve => {
      let req;
      try { req = indexedDB.open('books-reader', 1); } catch (e) { return resolve(null); }
      // never create an empty database here: the app's own open must still run its upgrade
      req.onupgradeneeded = () => { try { req.transaction.abort(); } catch (e) { /* ignore */ } };
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const q = db.transaction('meta', 'readonly').objectStore('meta').getAll();
          q.onsuccess = () => {
            db.close();
            const m = (q.result || []).filter(x => x.title === title).sort((a, b) => (b.opened || b.added) - (a.opened || a.added))[0];
            resolve(m ? m.id : null);
          };
          q.onerror = () => { db.close(); resolve(null); };
        } catch (e) { db.close(); resolve(null); }
      };
    });
  }

  /* Canvas particle system: sparkles, page flakes and a radial burst. */
  function makeFx(overlay) {
    const cv = document.createElement('canvas');
    cv.className = 'mlb-fx';
    overlay.appendChild(cv);
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const COLORS = ['#f7d983', '#fff3cf', '#e7b962', '#ffffff', '#d9c2ff'];
    const parts = [];
    let raf = 0, alive = true;

    const add = p => parts.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 900, g: 0.0009, drag: 0.985,
      rot: rnd(0, 6.28), vr: rnd(-0.2, 0.2), size: rnd(2, 4.5),
      shape: Math.random() < 0.5 ? 'dot' : 'rect', color: COLORS[(Math.random() * COLORS.length) | 0]
    }, p));

    function tick() {
      raf = 0;
      if (!alive) return;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += 16;
        if (p.life > p.max) { parts.splice(i, 1); continue; }
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.g * 16;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        const k = Math.max(0, 1 - p.life / p.max);
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.shape === 'dot') { ctx.beginPath(); ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (parts.length) raf = requestAnimationFrame(tick);
    }
    const kick = () => { if (!raf && alive) raf = requestAnimationFrame(tick); };

    return {
      sparkle(x, y, n) {
        for (let i = 0; i < n; i++) add({ x, y, vx: rnd(-0.7, 0.7), vy: rnd(-1.2, -0.2), g: 0.0004, max: rnd(380, 620), size: rnd(1.5, 2.6) });
        kick();
      },
      flakes(x, y0, y1, n) {
        for (let i = 0; i < n; i++) add({ x: x + rnd(-3, 3), y: rnd(y0, y1), vx: rnd(0.5, 2.2), vy: rnd(-0.6, 0.2), g: 0.0013, max: rnd(1000, 1500), size: rnd(2, 4) });
        kick();
      },
      radial(x, y, n) {
        for (let i = 0; i < n; i++) {
          const a = rnd(0, Math.PI * 2), s = rnd(2.5, 6.5);
          add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.955, g: 0.00005, max: rnd(520, 820), size: rnd(2, 3.6) });
        }
        kick();
      },
      stop() { alive = false; if (raf) cancelAnimationFrame(raf); raf = 0; cv.remove(); }
    };
  }

  async function fly(btn, id) {
    const rect = btn.getBoundingClientRect();
    const W = Math.round(Math.min(innerWidth * 0.56, 250)), H = Math.round(W * 1.5);
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const L = cx - W / 2, T = cy - H / 2;
    const s0 = Math.max(0.05, rect.width / W);
    const pose = (x, y, s, ry, z) => `translate3d(${x}px,${y}px,${z || 0}px) scale(${s}) rotateY(${ry}deg)`;

    const overlay = div('mlb-overlay');
    const dim = div('mlb-dim');
    const stage = div('mlb-stage');
    const book = div('mlb-book');
    book.style.width = W + 'px'; book.style.height = H + 'px';
    const pages = div('mlb-pages'), inside = div('mlb-inside');
    const back = div('mlb-face mlb-back');
    const g = btn.querySelector('.gen-cover');
    if (g && g.style.background) back.style.background = g.style.background;
    const front = div('mlb-face mlb-front');
    front.innerHTML = btn.innerHTML;
    book.append(pages, inside, back, front);
    stage.appendChild(book);
    overlay.append(dim, stage);
    document.body.appendChild(overlay);
    document.body.classList.add('mlb-opening');
    const fx = makeFx(overlay);
    book.style.transform = pose(rect.left, rect.top, s0, 0);

    try {
      // open the book in the background; the animation waits for it before flying in
      const openP = Promise.resolve().then(() => window.__reader.openBook(id)).catch(() => {});

      dim.animate([{ opacity: 0 }, { opacity: 0.62 }], { duration: 420, fill: 'forwards' });
      fx.radial(rect.left + rect.width / 2, rect.top + rect.height / 2, 22);

      // 1. lift out of the shelf
      await book.animate([
        { transform: pose(rect.left, rect.top, s0, 0) },
        { transform: pose(L, T - 30, 1.1, -16, 120), offset: 0.6 },
        { transform: pose(L, T, 1, -28) }
      ], { duration: 640, easing: EASE, fill: 'forwards' }).finished;

      // 2. turn all the way round, sparkles along the edges
      const em = setInterval(() => fx.sparkle(L + rnd(0, W), T + rnd(0, H), 2), 60);
      await book.animate([
        { transform: pose(L, T, 1, -28) },
        { transform: pose(L, T, 1, -208, 60) },
        { transform: pose(L, T, 1, -388) }
      ], { duration: 860, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }).finished;
      clearInterval(em);

      // 3. the front cover swings open on its spine, page flakes drift off the hinge
      fx.flakes(L + 4, T + 6, T + H - 6, 36);
      fx.sparkle(L + 2, T + H / 2, 10);
      await front.animate([
        { transform: 'rotateY(0deg)' },
        { transform: 'rotateY(-158deg)' }
      ], { duration: 980, easing: 'cubic-bezier(.3,.05,.2,1)', fill: 'forwards' }).finished;

      // 4. wait for the reader, then fly into the page
      await openP;
      if (!window.__reader || !window.__reader.App || window.__reader.App.screen !== 'reader') return;

      fx.radial(cx, cy, 46);
      const z = book.animate([
        { transform: pose(L, T, 1, -28), opacity: 1 },
        { transform: pose(L, T, 1.04, -6, 360), opacity: 1, offset: 0.35 },
        { transform: pose(L, T, 1, 0, 1450), opacity: 0 }
      ], { duration: 860, easing: 'cubic-bezier(.55,0,.35,1)', fill: 'forwards' });
      dim.animate([{ opacity: 0.62 }, { opacity: 0 }], { duration: 860, fill: 'forwards' });
      await z.finished;
    } finally {
      fx.stop();
      overlay.remove();
      document.body.classList.remove('mlb-opening');
      busy = false;
    }
  }

  document.addEventListener('click', e => {
    if (bypass) return;
    const btn = e.target && e.target.closest ? e.target.closest('#libGrid .cover-btn') : null;
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (busy) return;
    busy = true;
    const title = (btn.getAttribute('aria-label') || '').replace(/^Open /, '');
    dbFindId(title).then(id => {
      if (!id) {
        // could not resolve the book: let the normal click handler open it
        bypass = true;
        try { btn.click(); } finally { bypass = false; busy = false; }
        return;
      }
      if (reduce) {
        Promise.resolve().then(() => window.__reader.openBook(id)).finally(() => { busy = false; });
        return;
      }
      return fly(btn, id).catch(err => {
        console.error(err);
        document.body.classList.remove('mlb-opening');
        busy = false;
      });
    });
  }, true);
})();
