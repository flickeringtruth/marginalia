/* Marginalia library UI (v3).
   A new library layout, written from scratch with plain CSS and native Web Animations (no copied code):
   - "Continue reading" card for the book you're in the middle of, with a Resume button
     (Resume uses the same cover tap, so the book-opening animation still plays).
   - A stats line: books, in progress, finished.
   - Filters: All, Reading, New, Finished (counts shown on each).
   - Cards get a status badge and a calm progress line; rows keep the same height.
   - Smooth entrance motion that respects reduced-motion settings.
   Works on phones, tablets and desktops with the same spacing scale.
   Colours come from the theme variables, so it follows the site colours.
   Loaded from read-along-size.js. Remove the import to turn it off. */
(() => {
  if (window.__libUI) return;
  window.__libUI = true;

  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const FILTERS = [['all', 'All'], ['reading', 'Reading'], ['new', 'New'], ['done', 'Finished']];
  const LABEL = { all: 'Books', reading: 'Reading', new: 'New', done: 'Finished' };

  const css = `
    /* ---- continue reading ---- */
    #library .lib-ui{max-width:1240px;margin:0 auto}
    #library .lib-ui [hidden]{display:none!important}
    #library .lib-continue{
      display:grid;grid-template-columns:auto minmax(0,1fr);gap:clamp(16px,2.6vw,26px);align-items:center;
      margin:4px 0 26px;padding:clamp(14px,2.4vw,22px);
      border-radius:22px;background:var(--card);
      box-shadow:inset 0 0 0 .5px var(--line);
      animation:libRise .6s cubic-bezier(.2,.8,.2,1) both;
    }
    #library .lc-cover{
      position:relative;width:clamp(78px,12vw,118px);aspect-ratio:2/3;overflow:hidden;
      border-radius:4px 9px 9px 4px;background:var(--line);
      box-shadow:0 1px 1px rgba(0,0,0,.12),0 12px 22px -10px rgba(0,0,0,.5);
    }
    #library .lc-cover::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;z-index:2;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.34),rgba(255,255,255,.16) 55%,rgba(0,0,0,0))}
    #library .lc-cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
    #library .lc-cover .gen-cover{position:absolute;inset:0;padding:12px 10px 10px 14px}
    #library .lc-cover .gen-cover b{font-size:13px}
    #library .lc-info{min-width:0;display:flex;flex-direction:column;gap:4px}
    #library .lc-kicker{font-size:12px;font-weight:600;color:var(--accent);letter-spacing:.01em}
    #library .lc-title{font-size:clamp(17px,2.4vw,22px);font-weight:700;letter-spacing:-.015em;line-height:1.2;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    #library .lc-author{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #library .lc-bar{height:4px;border-radius:4px;background:var(--line);margin-top:10px;overflow:hidden}
    #library .lc-bar i{display:block;height:100%;width:0;border-radius:4px;background:var(--accent);transition:width .8s cubic-bezier(.2,.8,.2,1)}
    #library .lc-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px}
    #library .lc-pct{font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}
    #library .lc-go{
      height:40px;padding:0 18px;border-radius:20px;background:var(--accent);color:#fff;
      font:600 14px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;
      box-shadow:0 6px 16px -8px var(--accent);transition:transform .15s,filter .2s;
    }
    #library .lc-go:active{transform:scale(.96)}
    @media (hover:hover){#library .lc-go:hover{filter:brightness(1.08)}}

    /* ---- stats and filters ---- */
    #library .lib-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px 16px;margin:0 0 18px}
    #library .lib-stats{margin:0;font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}
    #library .lib-filter{display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--card);overflow-x:auto;scrollbar-width:none;max-width:100%}
    #library .lib-filter::-webkit-scrollbar{display:none}
    #library .lib-filter button{
      flex:none;height:34px;padding:0 13px;border-radius:10px;color:var(--muted);
      font:600 13px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;
      transition:background-color .25s,color .25s,box-shadow .25s;
    }
    #library .lib-filter button em{font-style:normal;font-weight:500;opacity:.7;margin-left:4px;font-variant-numeric:tabular-nums}
    #library .lib-filter button.on{background:var(--bg);color:var(--fg);box-shadow:0 1px 3px rgba(0,0,0,.14)}
    #library .lib-none{margin:28px 0;text-align:center;font-size:14px;color:var(--muted)}

    /* ---- grid rows: one height, badges, calm progress ---- */
    #libGrid{margin-top:0!important}
    #libGrid .card{animation:libRise .55s cubic-bezier(.2,.8,.2,1) both}
    #libGrid .card[hidden]{display:none!important}
    #libGrid .card:nth-child(2){animation-delay:40ms}
    #libGrid .card:nth-child(3){animation-delay:80ms}
    #libGrid .card:nth-child(4){animation-delay:120ms}
    #libGrid .card:nth-child(5){animation-delay:160ms}
    #libGrid .card:nth-child(n+6){animation-delay:200ms}
    #libGrid .card[data-status="done"] .cover-btn::after{
      content:"";position:absolute;inset:auto 0 auto 0;top:8px;right:8px;width:22px;height:22px;border-radius:11px;z-index:3;
      background:var(--accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12l5 5 9-10'/%3E%3C/svg%3E") center/13px no-repeat;
      box-shadow:0 2px 6px rgba(0,0,0,.3);
    }
    #libGrid .card[data-status="new"] .card-prog span{color:var(--accent)}
    #libGrid .card-prog .bar i{transition:width .8s cubic-bezier(.2,.8,.2,1)}

    @keyframes libRise{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){
      #library .lib-continue,#libGrid .card{animation:none!important}
      #library .lc-bar i,#libGrid .card-prog .bar i{transition:none!important}
    }
    @media (max-width:520px){
      #library .lib-continue{grid-template-columns:auto minmax(0,1fr)}
      #library .lib-toolbar{align-items:stretch}
      #library .lib-filter{width:100%}
      #library .lib-filter button{flex:1;padding:0 8px}
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const lib = document.getElementById('library');
  const grid = document.getElementById('libGrid');
  let filter = 'all', lastCardForContinue = null, scheduled = false;

  function build() {
    if (!lib || !grid || lib.querySelector('.lib-ui')) return;
    const wrap = document.createElement('section');
    wrap.className = 'lib-ui';
    wrap.innerHTML = `
      <section class="lib-continue" aria-label="Continue reading" hidden>
        <div class="lc-cover" aria-hidden="true"></div>
        <div class="lc-info">
          <span class="lc-kicker">Continue reading</span>
          <b class="lc-title"></b>
          <span class="lc-author"></span>
          <div class="lc-bar"><i></i></div>
          <div class="lc-meta"><span class="lc-pct"></span><button type="button" class="lc-go">Resume</button></div>
        </div>
      </section>
      <div class="lib-toolbar">
        <p class="lib-stats" aria-live="polite"></p>
        <div class="lib-filter" role="tablist" aria-label="Filter books">
          ${FILTERS.map(([k, l]) => `<button type="button" role="tab" data-f="${k}" aria-selected="${k === filter}" class="${k === filter ? 'on' : ''}">${l}<em></em></button>`).join('')}
        </div>
      </div>
      <p class="lib-none" hidden>No books in this filter yet.</p>`;
    grid.before(wrap);

    wrap.querySelector('.lib-filter').addEventListener('click', e => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      filter = b.dataset.f;
      wrap.querySelectorAll('[data-f]').forEach(x => {
        const on = x === b;
        x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on));
      });
      sync();
    });
    wrap.querySelector('.lc-go').addEventListener('click', () => {
      const cont = lastCardForContinue;
      const cover = cont && cont.querySelector('.cover-btn');
      if (cover) cover.click();      // same tap as a cover: the book-opening animation still plays
    });

    new MutationObserver(schedule).observe(grid, { childList: true });
    sync();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; sync(); });
  }

  function statusOf(card) {
    const bar = card.querySelector('.card-prog .bar i');
    const pct = bar ? parseFloat(bar.style.width) || 0 : 0;
    return { pct, status: pct >= 99 ? 'done' : pct > 0 ? 'reading' : 'new' };
  }

  function sync() {
    const wrap = lib && lib.querySelector('.lib-ui');
    if (!wrap) return;
    const cards = Array.from(grid.querySelectorAll('.card'));
    const counts = { all: 0, reading: 0, new: 0, done: 0 };
    let cont = null, contPct = 0;

    cards.forEach(card => {
      const { pct, status } = statusOf(card);
      card.dataset.status = status;
      counts.all++; counts[status]++;
      if (!cont && status === 'reading') { cont = card; contPct = pct; }   // first in-progress book (grid is most-recent first)
    });

    // stats and filter counts
    const stats = wrap.querySelector('.lib-stats');
    stats.textContent = cards.length
      ? `${counts.all} ${counts.all === 1 ? 'book' : 'books'} · ${counts.reading} in progress · ${counts.done} finished`
      : '';
    wrap.querySelectorAll('[data-f]').forEach(b => {
      const k = b.dataset.f;
      b.querySelector('em').textContent = k === 'all' ? counts.all : counts[k];
    });

    // filter cards
    cards.forEach(card => { card.hidden = filter !== 'all' && card.dataset.status !== filter; });
    const visible = cards.filter(c => !c.hidden).length;
    wrap.querySelector('.lib-none').hidden = !cards.length || visible > 0;
    wrap.querySelector('.lib-toolbar').hidden = !cards.length;

    // continue reading
    const section = wrap.querySelector('.lib-continue');
    if (!cont) { section.hidden = true; lastCardForContinue = null; return; }
    section.hidden = false;
    if (cont !== lastCardForContinue) {
      lastCardForContinue = cont;
      const coverHost = section.querySelector('.lc-cover');
      const src = cont.querySelector('.cover-btn');
      coverHost.innerHTML = src ? src.innerHTML : '';
      section.querySelector('.lc-title').textContent = cont.querySelector('.card-title')?.textContent || '';
      section.querySelector('.lc-author').textContent = cont.querySelector('.card-author')?.textContent || '';
    }
    const pctTxt = Math.round(contPct) + '% read';
    section.querySelector('.lc-pct').textContent = pctTxt;
    const bar = section.querySelector('.lc-bar i');
    requestAnimationFrame(() => { bar.style.width = Math.max(2, Math.min(100, contPct)) + '%'; });
  }

  function mount() {
    if (!lib || !grid) return;
    build();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
