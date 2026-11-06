/* Marginalia library typography.
   Instrument Serif for titles, book names and the greeting. Inter for the interface and small text.
   Loaded from Google Fonts only when the page is opened (no effect offline: the system fonts take over).
   Mobile gets bigger titles, larger covers, and more air between rows.
   Loaded from read-along-size.js. Remove the import to turn it off. */
(() => {
  if (window.__libType) return;
  window.__libType = true;

  if (!document.getElementById('ml-fonts')) {
    const pre1 = document.createElement('link');
    pre1.rel = 'preconnect'; pre1.href = 'https://fonts.googleapis.com';
    const pre2 = document.createElement('link');
    pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = '';
    const sheet = document.createElement('link');
    sheet.id = 'ml-fonts';
    sheet.rel = 'stylesheet';
    sheet.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap';
    document.head.append(pre1, pre2, sheet);
  }

  const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
  const SANS = 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';

  const css = `
    #library{font-family:${SANS};font-feature-settings:"cv11","ss01";-webkit-font-smoothing:antialiased}

    /* header */
    #library .lib-head h1{font-family:${SERIF};font-weight:400;font-size:clamp(40px,9vw,56px);line-height:.95;letter-spacing:-.02em}
    #library #libTitle{font-style:italic}
    #library .lib-head .sub{font-family:${SANS};font-size:13px;letter-spacing:.01em}
    #library .pill{font-weight:600;letter-spacing:-.005em}

    /* continue reading */
    #library .lc-kicker{font-family:${SANS};font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
    #library .lc-title{font-family:${SERIF};font-weight:400;font-size:clamp(26px,5vw,34px);line-height:1.02;letter-spacing:-.015em}
    #library .lc-author{font-family:${SERIF};font-style:italic;font-size:16px;color:var(--muted)}
    #library .lc-pct{font-weight:600;color:var(--fg);font-size:12.5px}

    /* stats + filters */
    #library .lib-stats{font-size:12.5px;letter-spacing:.005em}
    #library .lib-stats .mt{font-family:${SERIF};font-size:1.25em;line-height:1;color:var(--fg);font-weight:400;margin:0 1px}
    #library .lib-filter button{font-weight:600;letter-spacing:-.005em}

    /* cards */
    #libGrid .card-title{font-family:${SERIF};font-weight:400;font-size:18px;line-height:1.08;letter-spacing:-.01em;min-height:calc(2 * 1.08em)}
    #libGrid .card-author{font-family:${SERIF};font-style:italic;font-size:14px;color:var(--muted);margin-top:4px}
    #libGrid .card-prog span{font-family:${SANS};font-weight:600;font-size:11px}
    #libGrid .gen-cover b{font-family:${SERIF};font-weight:400;font-size:19px;line-height:1.05;letter-spacing:-.01em}
    #libGrid .gen-cover span{font-family:${SERIF};font-style:italic;font-size:12px;opacity:.85}

    /* empty state */
    #library .empty h2{font-family:${SERIF};font-weight:400;font-size:clamp(30px,7vw,38px);line-height:1.02;letter-spacing:-.015em}
    #library .empty p{font-size:15px;line-height:1.55;color:var(--muted)}

    /* sheets */
    #catalogSheet .sheet-head h2,#moreSheet .sheet-head h2,#msgSheet .sheet-head h2{font-family:${SERIF};font-weight:400;font-size:28px;letter-spacing:-.015em}
    #moreList .menu-item>span:last-child{font-weight:600}
    #catalogResults .catalog-book-copy b{font-family:${SERIF};font-weight:400;font-size:19px;line-height:1.1}
    #catalogResults .catalog-book-copy span{font-family:${SERIF};font-style:italic;font-size:14px}
    #msgText p{font-size:15px;color:var(--fg)}

    /* mobile: bigger titles, larger covers, more air */
    @media (max-width:560px){
      #library .lib-head{padding-top:calc(var(--sat,0px) + 18px);padding-bottom:16px;align-items:flex-end}
      #library .lib-head h1{font-size:clamp(46px,14vw,60px)}
      #library .lib-continue{grid-template-columns:auto minmax(0,1fr);gap:16px;padding:16px;border-radius:24px}
      #library .lc-cover{width:104px}
      #library .lc-title{font-size:26px}
      #library .lib-filter button{height:36px;padding:0 10px;font-size:13px}
      #libGrid{gap:26px 14px!important}
      #libGrid .card-title{font-size:17px}
      #library .lib-toolbar{margin-bottom:20px}
    }
    @media (min-width:561px){
      #library .lib-head h1{font-size:clamp(48px,6vw,64px)}
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
