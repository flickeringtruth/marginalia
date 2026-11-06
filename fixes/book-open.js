/* Marginalia book-open animation (v2).
   Tap a cover in the library:
     1. the book lifts off its shelf spot along a curved path, tilts and pops toward you,
     2. it turns a full circle in 3D, with sparkles trailing,
     3. the front cover swings open on its spine, page flakes drift off the hinge,
     4. the book flies into the camera and fades, and you land inside the reader.
   The reader is built in the background but stays hidden until the animation ends.
   Skip jumps to the open-book pose and then straight to the reader.
   Settings › Book opening turns it off (the book then opens straight away).
   Reduced motion also opens the book straight away.
   Loaded from read-along-size.js. Remove the import to turn it off. */
(() => {
  if (window.__marginaliaBookOpen) return;
  window.__marginaliaBookOpen = true;

  const KEY = 'marginalia.bookOpenAnim';
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const enabled = () => { try { const v = localStorage.getItem(KEY); return v === null ? true : JSON.parse(v) !== false; } catch (e) { return true; } };
  const setEnabled = v => { try { localStorage.setItem(KEY, JSON.stringify(!!v)); } catch (e) { /* ignore */ } };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const tw = (t, a, b) => clamp01((t - a) / (b - a));
  const outCubic = x => 1 - Math.pow(1 - x, 3);
  const inCubic = x => x * x * x;
  const inOutCubic = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;

  /* Timeline in milliseconds */
  const LIFT_END = 640, TURN_END = 1500, OPEN_END = 2260, END = 2980;

  let busy = false, bypass = false;

  const css = `
    .mlb-overlay{position:fixed;inset:0;z-index:300;overflow:hidden;touch-action:none;-webkit-tap-highlight-color:transparent}
    .mlb-dim{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,#1d1d27 0%,#06060a 72%);opacity:0}
    .mlb-stage{position:absolute;inset:0;perspective:1400px;perspective-origin:50% 42%}
    .mlb-shadow{position:absolute;left:0;top:0;height:22px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.75),rgba(0,0,0,0));opacity:0;transform-origin:50% 50%}
    .mlb-book{position:absolute;left:0;top:0;transform-style:preserve-3d;transform-origin:50% 50%;will-change:transform,opacity}
    .mlb-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden}
    .mlb-front{transform-origin:0 50%;border-radius:3px 9px 9px 3px;background:#2b2b30;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)}
    .mlb-front img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
    .mlb-front .gen-cover{position:absolute;inset:0}
    .mlb-sheen{position:absolute;inset:0;pointer-events:none;background:linear-gradient(112deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.5) 50%,rgba(255,255,255,0) 70%);mix-blend-mode:soft-light;opacity:.5}
    .mlb-back{transform-origin:50% 50%;border-radius:9px 3px 3px 9px;background:#2b2b30}
    .mlb-spine{position:absolute;left:0;top:0;width:12px;height:100%;transform-origin:0 50%;background:linear-gradient(90deg,#17171c,#2f2f37 50%,#17171c)}
    .mlb-edge{position:absolute;right:0;top:1.5%;bottom:1.5%;width:12px;transform-origin:100% 50%;background:repeating-linear-gradient(0deg,#ece2c8 0 1px,#c9bb97 1px 2px)}
    .mlb-pages{position:absolute;left:4%;top:2.5%;right:1.5%;bottom:2.5%;border-radius:0 3px 3px 0;background:repeating-linear-gradient(180deg,rgba(90,70,40,.07) 0 1px,transparent 1px 15px),#fbf6e8;box-shadow:inset 0 0 22px rgba(120,90,40,.2)}
    .mlb-inside{position:absolute;left:3%;top:3%;right:3%;bottom:3%;border-radius:2px;background:linear-gradient(90deg,#c9bb97,#f1e7cd 35%,#fbf6e6)}
    .mlb-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    .mlb-skipwrap{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 28px);display:flex;justify-content:center;z-index:5}
    .mlb-skip{height:40px;padding:0 22px;border:0;border-radius:20px;background:rgba(255,255,255,.16);color:#fff;font:600 14px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);opacity:0;animation:mlbSkipIn .35s ease .45s forwards}
    @keyframes mlbSkipIn{to{opacity:1}}
    body.mlb-opening #loading{display:none!important}
    body.mlb-opening #reader{visibility:hidden!important}
    body.mlb-opening #library{display:block!important}
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

  /* Canvas particles: sparkles, page flakes and radial bursts. Stepped by the main loop. */
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
    let alive = true;

    const add = p => parts.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 900, g: 0.0009, drag: 0.985,
      rot: rnd(0, 6.28), vr: rnd(-0.2, 0.2), size: rnd(2, 4.5),
      shape: Math.random() < 0.5 ? 'dot' : 'rect', color: COLORS[(Math.random() * COLORS.length) | 0]
    }, p));

    return {
      sparkle(x, y, n) {
        for (let i = 0; i < n; i++) add({ x, y, vx: rnd(-0.7, 0.7), vy: rnd(-1.3, -0.2), g: 0.0004, max: rnd(380, 640), size: rnd(1.5, 2.6) });
      },
      flakes(x, y0, y1, n) {
        for (let i = 0; i < n; i++) add({ x: x + rnd(-3, 3), y: rnd(y0, y1), vx: rnd(0.5, 2.4), vy: rnd(-0.6, 0.3), g: 0.0013, max: rnd(1000, 1600), size: rnd(2, 4.2) });
      },
      radial(x, y, n) {
        for (let i = 0; i < n; i++) {
          const a = rnd(0, Math.PI * 2), s = rnd(2.5, 7);
          add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.955, g: 0.00005, max: rnd(520, 840), size: rnd(2, 3.8) });
        }
      },
      ring(x, y, n, r) {
        for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2); add({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2 - 0.4, max: rnd(600, 900) }); }
      },
      update(dt) {
        if (!alive) return;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        const f = dt / 16.67;
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.life += dt;
          if (p.life > p.max) { parts.splice(i, 1); continue; }
          const d = Math.pow(p.drag, f);
          p.vx *= d;
          p.vy = p.vy * d + p.g * dt;
          p.x += p.vx * f; p.y += p.vy * f; p.rot += p.vr * f;
          ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          if (p.shape === 'dot') { ctx.beginPath(); ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2); ctx.fill(); }
          else ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      },
      stop() { alive = false; parts.length = 0; cv.remove(); }
    };
  }

  /* One frame loop drives the whole sequence, so skipping and holding are simple. */
  function fly(btn, id) {
    const rect = btn.getBoundingClientRect();
    const W = Math.round(Math.min(innerWidth * 0.56, 250)), H = Math.round(W * 1.5);
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const L = cx - W / 2, T = cy - H / 2;                              // final top-left of the book
    const x0 = rect.left + rect.width / 2 - W / 2, y0 = rect.top + rect.height / 2 - H / 2; // start: centred on the card
    const s0 = Math.max(0.05, rect.width / W);
    const ctrlX = (x0 + L) / 2, ctrlY = Math.min(y0, T) - H * 0.38;   // curve control point: the lift arcs over

    const overlay = div('mlb-overlay');
    const dim = div('mlb-dim');
    const stage = div('mlb-stage');
    const shadow = div('mlb-shadow');
    const book = div('mlb-book');
    book.style.width = W + 'px'; book.style.height = H + 'px';
    shadow.style.width = Math.round(W * 1.1) + 'px';

    const back = div('mlb-face mlb-back');
    const pages = div('mlb-pages');
    const inside = div('mlb-inside');
    const edge = div('mlb-edge');
    const spine = div('mlb-spine');
    const front = div('mlb-face mlb-front');
    const g = btn.querySelector('.gen-cover');
    if (g && g.style.background) back.style.background = g.style.background;
    front.innerHTML = btn.innerHTML;
    const sheen = div('mlb-sheen');
    front.appendChild(sheen);

    book.append(back, pages, inside, edge, spine, front);
    stage.append(shadow, book);
    overlay.append(dim, stage);

    // board thickness: spine and page edge sit in the middle of the book's depth
    spine.style.transform = 'translateZ(-6px) rotateY(-90deg)';
    edge.style.transform = 'translateZ(-6px) rotateY(90deg)';
    pages.style.transform = 'translateZ(-5px)';
    inside.style.transform = 'translateZ(-2px)';
    back.style.transform = 'translateZ(-6px) rotateY(180deg)';

    const skipWrap = div('mlb-skipwrap');
    const skipBtn = document.createElement('button');
    skipBtn.type = 'button'; skipBtn.className = 'mlb-skip'; skipBtn.textContent = 'Skip';
    skipBtn.setAttribute('aria-label', 'Skip opening animation');
    skipWrap.appendChild(skipBtn);
    overlay.appendChild(skipWrap);

    document.body.appendChild(overlay);
    document.body.classList.add('mlb-opening');
    const fx = makeFx(overlay);

    return new Promise(resolve => {
      let t = 0, last = 0, raf = 0, ready = false, skip = false, lastSpark = 0;
      const fired = {};

      const openP = Promise.resolve().then(() => window.__reader.openBook(id)).catch(() => {});
      openP.then(() => { ready = true; });

      skipBtn.addEventListener('click', () => { skip = true; skipBtn.remove(); }, { once: true });

      const render = t => {
        const pl = outCubic(tw(t, 0, LIFT_END));
        const pt = inOutCubic(tw(t, LIFT_END, TURN_END));
        const po = inOutCubic(tw(t, TURN_END, OPEN_END));
        const pf = inCubic(tw(t, OPEN_END, END));

        // curved lift (quadratic bezier from the card to the centre of the screen)
        const k = pl, mk = 1 - k;
        const x = mk * mk * x0 + 2 * mk * k * ctrlX + k * k * L;
        const y = mk * mk * y0 + 2 * mk * k * ctrlY + k * k * T;
        const bob = 12 * Math.sin(pt * Math.PI);
        const z = 90 * Math.sin(pl * Math.PI) + 46 * Math.sin(pt * Math.PI) + 1500 * pf;
        const s = lerp(s0, 1, pl) + 0.05 * Math.sin(pl * Math.PI) + 0.03 * Math.sin(pt * Math.PI);
        const ry = -22 * pl - 360 * pt;                               // one full turn, ends facing you
        const rx = -7 * Math.sin(pl * Math.PI) + 5 * Math.sin(pt * Math.PI) - 3 * Math.sin(po * Math.PI);
        const cover = -158 * po;                                       // front cover swings open
        const op = 1 - tw(t, END - 460, END);

        book.style.transform = `translate3d(${x}px,${y + bob}px,${z}px) scale(${s}) rotateX(${rx}deg) rotateY(${ry}deg)`;
        book.style.opacity = op.toFixed(3);
        front.style.transform = `translateZ(6px) rotateY(${cover}deg)`;
        sheen.style.opacity = (0.3 + 0.5 * Math.abs(Math.sin(ry * Math.PI / 180))).toFixed(3);

        // ground shadow shrinks and fades as the book rises
        const shS = Math.max(0.2, 1 - Math.min(0.5, z / 380));
        shadow.style.opacity = (0.7 * tw(t, 0, 300) * (1 - pf) * (1 - Math.min(1, z / 300))).toFixed(3);
        shadow.style.transform = `translate3d(${cx - (W * 1.1) / 2}px,${T + H + 16}px,0) scale(${shS})`;

        dim.style.opacity = (0.85 * tw(t, 0, 420) * (1 - tw(t, END - 500, END))).toFixed(3);
      };

      const finish = () => {
        cancelAnimationFrame(raf);
        fx.stop();
        overlay.remove();
        document.body.classList.remove('mlb-opening');
        resolve();
      };

      const frame = now => {
        if (!last) last = now;
        const dt = Math.min(48, now - last);
        last = now;

        if (skip && t < OPEN_END) t = OPEN_END;
        if (skip && ready) t = END;
        const holding = t >= OPEN_END && !ready;   // wait at the open-book pose until the reader is ready
        if (!holding) t = Math.min(END, t + dt);

        // events on the timeline
        if (!fired.ring) { fired.ring = 1; fx.ring(rect.left + rect.width / 2, rect.top + rect.height / 2, 18, 16); }
        if (t >= LIFT_END && t < TURN_END && now - lastSpark > 55) {
          lastSpark = now;
          fx.sparkle(L + rnd(0, W), T + rnd(0, H), 2);
        }
        if (t >= TURN_END - 60 && !fired.flakes) { fired.flakes = 1; fx.flakes(L + 6, T + 8, T + H - 8, 44); fx.sparkle(L + 4, T + H / 2, 12); }
        if (t >= TURN_END && t < OPEN_END && now - lastSpark > 90) { lastSpark = now; fx.flakes(L + 6, T + 8, T + H - 8, 2); }
        if (t >= OPEN_END && !fired.radial) { fired.radial = 1; fx.radial(cx, cy, 52); }

        render(t);
        fx.update(dt);

        if (t >= END && ready) {
          if (!(window.__reader && window.__reader.App && window.__reader.App.screen === 'reader')) { finish(); return; }
          finish();
          return;
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
  }

  /* Settings › Book opening switch */
  function injectSetting() {
    const body = document.getElementById('settingsBody');
    if (!body || body.querySelector('[data-ml-bookopen]')) return;
    const group = document.createElement('div');
    group.className = 'grp';
    group.innerHTML = '<h3>Book opening</h3>' +
      '<button class="switch-row" type="button" data-ml-bookopen>Animate opening a book<span class="switch"></span></button>' +
      '<p class="hint">Off: a book opens straight away. During the animation, tap Skip to go straight to the page.</p>';
    body.appendChild(group);
    const btn = group.querySelector('[data-ml-bookopen]');
    const sw = btn.querySelector('.switch');
    const sync = () => sw.classList.toggle('on', enabled());
    sync();
    btn.addEventListener('click', () => { setEnabled(!enabled()); sync(); });
  }
  injectSetting();

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
      if (reduce || !enabled()) {
        Promise.resolve().then(() => window.__reader.openBook(id)).finally(() => { busy = false; });
        return;
      }
      return fly(btn, id).catch(err => {
        console.error(err);
        document.body.classList.remove('mlb-opening');
        busy = false;
      }).then(() => { busy = false; });
    });
  }, true);
})();
