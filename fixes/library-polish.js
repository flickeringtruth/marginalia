/* Marginalia library polish (v2).
   Restyles everything the library screen has:
   header, grid, covers, card text, empty state, Discover sheet, More sheet,
   name screen, loading, drop hint and message sheets.
   Same look on phones, tablets and desktops: fixed column counts per width, one spacing scale,
   covers with a spine and gloss, consistent card text height, touch and mouse states.
   Loaded from read-along-size.js. Remove the import to turn it off. */
(() => {
  if (window.__marginaliaLibraryPolish) return;
  window.__marginaliaLibraryPolish = true;

  const css = `
    /* ---- screen and gutters ---- */
    #library{
      --lp:clamp(14px,3.2vw,32px);
      padding:0 calc(var(--sar,0px) + var(--lp)) calc(var(--sab,0px) + 48px) calc(var(--sal,0px) + var(--lp))!important;
      overflow-x:hidden;scroll-padding-top:90px;
    }

    /* ---- sticky header with a full-width frosted band ---- */
    #library .lib-head{
      position:sticky;top:0;z-index:6;
      display:flex;align-items:center;justify-content:space-between;gap:12px;
      max-width:1240px;width:100%;margin:0 auto;
      padding:calc(var(--sat,0px) + 16px) 0 14px;
      background:none;isolation:isolate;
    }
    #library .lib-head::before{
      content:"";position:absolute;z-index:-1;top:0;bottom:0;
      left:calc(-1 * (var(--sal,0px) + var(--lp)));right:calc(-1 * (var(--sar,0px) + var(--lp)));
      background:color-mix(in srgb,var(--bg) 84%,transparent);
      -webkit-backdrop-filter:saturate(180%) blur(18px);backdrop-filter:saturate(180%) blur(18px);
      border-bottom:.5px solid var(--line);
    }
    #library .lib-head>div:first-child{min-width:0;flex:1}
    #library .lib-head h1{
      font-size:clamp(26px,4.2vw,38px);font-weight:700;letter-spacing:-.025em;line-height:1.05;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    #library #libTitle{cursor:pointer;transition:opacity .2s}
    #library #libTitle:hover{opacity:.75}
    #library .lib-head .sub{font-size:13px;color:var(--muted);margin-top:4px;font-variant-numeric:tabular-nums;letter-spacing:.005em}

    /* ---- header actions: one row, one size, every width ---- */
    #library .lib-actions{display:flex!important;grid-template-columns:none!important;align-items:center;gap:8px;flex:none;width:auto!important}
    #library .lib-actions>*{min-width:0!important;padding:0 14px!important}
    #library .pill{height:40px;padding:0 16px;border-radius:20px;font-size:14px;font-weight:600;gap:6px;box-shadow:0 1px 2px rgba(0,0,0,.06)}
    #library .pill svg{width:16px;height:16px}
    #library .pill.lib-discover{background:var(--card);color:var(--fg);box-shadow:none}
    #library #libMore{width:40px;height:40px;min-width:40px;border-radius:20px;background:var(--card);padding:0}
    #library #libMore svg{width:20px;height:20px}
    @media (max-width:420px){
      #library .lib-actions>.lib-discover{display:none}   /* Discover is still in the empty state and the More menu */
      #library .pill{padding:0 14px}
    }

    /* ---- grid: fixed columns per width ---- */
    #libGrid{
      display:grid!important;
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:28px 16px!important;
      max-width:1240px;margin:8px auto 0;padding:0;
    }
    @media (min-width:560px){#libGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:30px 22px!important}}
    @media (min-width:840px){#libGrid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:34px 26px!important}}
    @media (min-width:1120px){#libGrid{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:38px 30px!important}}

    /* ---- cards ---- */
    #libGrid .card{position:relative;min-width:0;display:flex;flex-direction:column}
    #libGrid .cover-btn{
      position:relative;display:block;width:100%;aspect-ratio:2/3;overflow:hidden;
      border-radius:4px 9px 9px 4px;background:var(--card);
      box-shadow:0 1px 1px rgba(0,0,0,.10),0 6px 14px -6px rgba(0,0,0,.35),0 16px 26px -18px rgba(0,0,0,.5);
      transition:transform .42s cubic-bezier(.2,.8,.2,1),box-shadow .42s cubic-bezier(.2,.8,.2,1);
      -webkit-tap-highlight-color:transparent;
    }
    #libGrid .cover-btn::before{
      content:"";position:absolute;left:0;top:0;bottom:0;width:7px;z-index:2;pointer-events:none;
      background:linear-gradient(90deg,rgba(0,0,0,.34),rgba(255,255,255,.16) 55%,rgba(0,0,0,0));
    }
    #libGrid .cover-btn::after{
      content:"";position:absolute;inset:0;z-index:2;pointer-events:none;
      background:linear-gradient(118deg,rgba(255,255,255,.2),rgba(255,255,255,0) 42%);
    }
    #libGrid .cover-btn img{width:100%;height:100%;object-fit:cover;display:block}
    #libGrid .gen-cover{padding:16px 14px 14px 18px}
    #libGrid .gen-cover b{font-size:16px;line-height:1.18}
    #libGrid .cover-btn:active{transform:scale(.965)}
    @media (hover:hover){
      #libGrid .cover-btn:hover{transform:translateY(-5px);box-shadow:0 2px 2px rgba(0,0,0,.10),0 14px 22px -10px rgba(0,0,0,.4),0 26px 40px -22px rgba(0,0,0,.55)}
    }
    #libGrid .del-btn{top:6px;right:6px;width:36px;height:36px;z-index:4}
    #libGrid .del-btn i{width:28px;height:28px;background:rgba(0,0,0,.42)}
    #libGrid .card-prog{margin-top:10px;display:flex;align-items:center;gap:8px;min-height:14px}
    #libGrid .card-prog .bar{flex:1;height:3px;border-radius:3px;background:var(--line)}
    #libGrid .card-prog .bar i{border-radius:3px;background:var(--accent)}
    #libGrid .card-prog span{font-size:11px;font-weight:600;color:var(--muted);min-width:0;text-align:right;letter-spacing:.01em}
    #libGrid .card-title{font-size:14px;font-weight:600;line-height:1.3;margin-top:8px;min-height:calc(2 * 1.3em);-webkit-line-clamp:2}
    #libGrid .card-author{font-size:12.5px;color:var(--muted);margin-top:3px;min-height:1.4em}

    /* ---- empty state ---- */
    #library .empty{max-width:440px;margin:clamp(40px,12vh,120px) auto 0;padding:0 16px;text-align:center}
    #library .empty .art{width:104px;height:104px;margin:0 auto 22px;stroke:var(--muted);opacity:.85;animation:mlbFloat 4.2s ease-in-out infinite}
    @keyframes mlbFloat{50%{transform:translateY(-6px)}}
    #library .empty h2{font-size:22px;font-weight:700;letter-spacing:-.015em;margin:0 0 8px}
    #library .empty p{font-size:15px;line-height:1.5;margin:0 0 22px}
    #library .empty .actions{display:flex;flex-direction:column;gap:10px;align-items:stretch;width:100%;max-width:300px;margin:0 auto}
    #library .empty .actions .pill{justify-content:center;height:46px;border-radius:23px;font-size:15px}
    #library .lib-foot{max-width:1240px;margin:44px auto 0;font-size:12.5px;line-height:1.6;color:var(--muted);padding-bottom:12px}

    /* ---- Discover sheet ---- */
    #catalogSheet{border-radius:24px 24px 0 0}
    #catalogSheet .sheet-head{padding:6px 12px 6px 20px}
    #catalogSheet .sheet-head h2{font-size:20px;font-weight:700;letter-spacing:-.015em}
    #catalogSheet .sheet-body{padding:8px 20px calc(var(--sab,0px) + 28px)}
    #catalogForm{display:flex;gap:8px;align-items:center;margin:6px 0 8px}
    #catalogSearch{flex:1;min-width:0;height:44px;border-radius:22px;border:0;background:var(--card);padding:0 18px;font-size:16px;color:var(--fg)}
    #catalogSearch:focus{outline:2px solid var(--accent);outline-offset:0}
    #catalogForm .pill{height:44px;border-radius:22px;padding:0 18px;flex:none}
    #catalogStatus{font-size:12.5px;color:var(--muted);min-height:18px;margin:2px 0 6px;padding-left:4px}
    #catalogStatus.error{color:var(--danger)}
    #catalogResults .catalog-book{display:flex;align-items:center;gap:12px;padding:14px 0;border-top:.5px solid var(--line)}
    #catalogResults .catalog-book:first-child{border-top:0}
    #catalogResults .catalog-book-copy{min-width:0;flex:1}
    #catalogResults .catalog-book-copy b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:15px;font-weight:600;line-height:1.3}
    #catalogResults .catalog-book-copy span{display:block;margin-top:3px;font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #catalogResults .catalog-book-copy small{display:block;margin-top:3px;font-size:11.5px;color:var(--muted);opacity:.85}
    #catalogResults .catalog-book .small-btn{height:36px;min-height:36px;padding:0 14px;border-radius:18px;background:var(--accent);color:#fff;flex:none;font-size:13px}
    #catalogResults .catalog-book .small-btn:disabled{background:var(--card);color:var(--muted)}
    #catalogResults .catalog-empty,#catalogResults .catalog-limit{margin:18px 0;font-size:14px;line-height:1.5}
    .catalog-note{margin-top:14px;padding-top:12px;border-top:.5px solid var(--line);font-size:12px;line-height:1.55}

    /* ---- More sheet ---- */
    #moreSheet{border-radius:24px 24px 0 0}
    #moreSheet .sheet-head{padding:6px 12px 6px 20px}
    #moreSheet .sheet-head h2{font-size:20px;font-weight:700;letter-spacing:-.015em}
    #moreList .menu-item{min-height:64px;margin:0 -10px;padding:10px;width:calc(100% + 20px);border-bottom:0;border-radius:16px;gap:14px}
    #moreList .menu-item:active{background:var(--card)}
    #moreList .mi-ico{width:42px;height:42px;border-radius:13px;background:color-mix(in srgb,var(--accent) 14%,transparent)}
    #moreList .mi-ico svg{width:21px;height:21px;stroke:var(--accent)}
    #moreList .menu-item>span:last-child{font-size:16px;font-weight:600;line-height:1.25}
    #moreList .menu-item small{font-size:13px;font-weight:400;margin-top:3px;line-height:1.35;color:var(--muted)}

    /* ---- message sheets (imports, errors, confirmations) ---- */
    #msgSheet{border-radius:24px 24px 0 0}
    #msgSheet .sheet-head h2{font-size:20px;font-weight:700;letter-spacing:-.015em}
    #msgText p{font-size:15px;line-height:1.55;margin:0 0 12px}
    #msgText a{color:var(--accent);text-decoration:none}
    #msgActions{display:flex;flex-direction:column;gap:8px;margin-top:16px}
    #msgActions .wide-btn{margin:0;min-height:50px;border-radius:25px;font-size:16px}

    /* ---- name screen ---- */
    #nameGate{background:radial-gradient(120% 80% at 50% 0%,color-mix(in srgb,var(--accent) 20%,var(--bg)) 0%,var(--bg) 62%)}
    #nameGate h2{font-size:clamp(30px,8vw,40px);font-weight:700;letter-spacing:-.025em}
    #nameGate p{font-size:16px;line-height:1.5}
    #nameGate input{height:54px;border-radius:27px;font-size:18px;background:var(--card);border:1px solid transparent}
    #nameGate input:focus{border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 22%,transparent)}
    #nameGate .pill{height:54px;border-radius:27px;font-size:17px}

    /* ---- loading and drop hint ---- */
    #loading{background:color-mix(in srgb,var(--bg) 88%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font-size:14px;letter-spacing:.01em}
    #loading .spinner{width:30px;height:30px;border-width:2.5px;border-color:var(--line);border-top-color:var(--accent)}
    .drop-hint{inset:14px;border-radius:24px;border-width:2px;font-size:17px;background:color-mix(in srgb,var(--bg) 80%,transparent);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}

    /* ---- book-opening cover gets the same spine ---- */
    .mlb-front::before{content:"";position:absolute;left:0;top:0;bottom:0;width:7px;z-index:3;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.34),rgba(255,255,255,.16) 55%,rgba(0,0,0,0))}

    @media (prefers-reduced-motion:reduce){
      #library .cover-btn,#library .lib-head,#library .empty .art{transition:none!important;animation:none!important}
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
