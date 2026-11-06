/* Marginalia UI polish.
   Adds icons to buttons that only had text or a symbol, and tightens button feel:
   clear focus rings, press feedback, consistent sizes. Nothing here changes what a button does.
   Loaded from read-along-size.js as a module (which reader-tools.js loads). Remove the import to turn it off. */
(() => {
  if (window.__marginaliaUiPolish) return;
  window.__marginaliaUiPolish = true;

  const $ = s => document.querySelector(s);

  const P = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v4h14v-4"/>',
    gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-4"/>',
    voice: '<path d="M4 12h2M8 8v8M12 5v14M16 9v6M20 12h0"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    rewind: '<path d="M11 6l-6 6 6 6zM20 6l-6 6 6 6z"/>',
    forward: '<path d="M13 6l6 6-6 6zM4 6l6 6-6 6z"/>',
    prev: '<path d="M15 6l-6 6 6 6"/>',
    next: '<path d="M9 6l6 6-6 6"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    list: '<path d="M5 6h14M5 12h14M5 18h14"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6h14v-6"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0 1 4"/><path d="M20 4v7h-7"/>'
  };
  const svg = (name, cls) => `<svg class="ui-ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`;

  // selector -> icon. `replace: true` swaps a symbol-only label for the icon.
  const RULES = [
    { s: '[data-catalog-open]', i: 'search' },
    { s: '#emptyImport', i: 'upload' },
    { s: '#sampleBtn', i: 'book' },
    { s: '#catalogForm button[type="submit"]', i: 'search' },
    { s: '#abPopupSpeed', i: 'gauge' },
    { s: '#abPopupVoice', i: 'voice' },
    { s: '#abPopupSleep', i: 'moon' },
    { s: '#abGo', i: 'arrowRight' },
    { s: '#abLyricsBack', i: 'arrowLeft' },
    { s: '#abMiniLyrics', i: 'list', replace: true },
    { s: '#speedSkipBack', i: 'rewind', replace: true },
    { s: '#speedSkipForward', i: 'forward', replace: true },
    { s: '#speedPrevious', i: 'prev', replace: true },
    { s: '#speedNext', i: 'next', replace: true },
    { s: '#speedSlower', i: 'minus', replace: true },
    { s: '#speedFaster', i: 'plus', replace: true },
    { s: '#speedPlay', i: 'play', replace: true },
    { s: '#autoScrollToggle', i: 'pause', replace: true },
    { s: '#chatSend', i: 'up', replace: true },
    { s: '#aiSave', i: 'key' },
    { s: '#aiForget', i: 'trash' },
    { s: '#dictSaveVocab', i: 'plus' },
    { s: '#dictAskAI', i: 'sparkle' },
    { s: '#dictRetry', i: 'refresh' },
    { s: '#mlAddBm', i: 'bookmark' },
    { s: '#mlExport', i: 'download' },
    { s: '[data-aact="reset"]', i: 'refresh' },
    { s: '#selMenu .act[data-a="define"]', i: 'book' },
    { s: '#selMenu .act[data-a="ask-ai"]', i: 'sparkle' },
    { s: '#selMenu .act[data-a="speak"]', i: 'speaker' },
    { s: '#selMenu .act[data-a="copy"]', i: 'copy' },
    { s: '#selMenu .act[data-a="share"]', i: 'share' },
    { s: '#selMenu .act[data-a="remove"]', i: 'trash' }
  ];

  function decorate() {
    for (const r of RULES) {
      document.querySelectorAll(r.s).forEach(el => {
        if (el.dataset.uiIc) return;
        el.dataset.uiIc = r.i;
        if (r.replace) {
          el.innerHTML = svg(r.i);
          el.classList.add('ui-ic-only');
        } else if (!el.querySelector(':scope > svg')) {
          el.insertAdjacentHTML('afterbegin', svg(r.i, 'lead'));
        }
      });
    }
  }

  const css = `
    .ui-ic{width:18px;height:18px;flex:none;display:inline-block;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .ui-ic.lead{margin-right:8px;margin-top:-2px}
    .ui-ic-only{display:inline-flex;align-items:center;justify-content:center}
    .ui-ic-only .ui-ic{width:20px;height:20px}
    button{-webkit-tap-highlight-color:transparent}
    button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    button:active:not(:disabled){transform:scale(.97)}
    button{transition:transform .12s ease,background-color .2s ease,color .2s ease,opacity .2s ease}
    button:disabled{opacity:.4}
    .pill{gap:8px;min-height:46px;letter-spacing:-.005em;box-shadow:0 1px 2px rgba(0,0,0,.08)}
    .pill.ghost{background:var(--card);color:var(--fg);box-shadow:none}
    .wide-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 16px;border-radius:14px;font-weight:600;font-size:15px}
    .wide-btn.primary{background:var(--accent);color:#fff}
    .small-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 14px;border-radius:10px;font-weight:600}
    .seg button{min-height:40px}
    .switch-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px}
    #selMenu .act{display:inline-flex;align-items:center;gap:6px;min-height:42px;padding:0 13px;border-radius:12px;font-weight:600}
    #selMenu .act.danger{background:#ff3b30}
    .ab-readalong{gap:8px}
    .ab-lyric-line{transition:opacity .2s,color .2s,transform .2s}
    @media (prefers-reduced-motion: reduce){button{transition:none!important}button:active:not(:disabled){transform:none}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  let queued = false;
  const run = () => { queued = false; decorate(); };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  run();
})();
