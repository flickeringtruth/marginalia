/* Marginalia library polish (v1).
   Restyles the library screen only: header, grid, covers, card text, empty state.
   Same look on phones, tablets and desktops: fixed column counts per width, one spacing scale,
   covers with a spine and gloss, consistent card text height, touch and mouse states.
   Also gives the book-opening cover a matching spine.
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
      #library .lib-actions>.lib-discover{display:none}   /* Discover lives in the empty state and the More menu on very small phones */
      #library .pill{padding:0 14px}
    }

    /* ---- grid: fixed columns per width, no auto-fill surprises ---- */
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
    #libGrid .cover-btn::before{ /* spine */
      content:"";position:absolute;left:0;top:0;bottom:0;width:7px;z-index:2;pointer-events:none;
      background:linear-gradient(90deg,rgba(0,0,0,.34),rgba(255,255,255,.16) 55%,rgba(0,0,0,0));
    }
    #libGrid .cover-btn::after{ /* gloss */
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
    #library .empty .art{width:104px;height:104px;margin:0 auto 22px;stroke:var(--muted);opacity:.85}
    #library .empty h2{font-size:22px;font-weight:700;letter-spacing:-.015em;margin:0 0 8px}
    #library .empty p{font-size:15px;line-height:1.5;margin:0 0 22px}
    #library .empty .actions{display:flex;flex-direction:column;gap:10px;align-items:stretch;width:100%;max-width:300px;margin:0 auto}
    #library .empty .actions .pill{justify-content:center;height:46px;border-radius:23px;font-size:15px}

    #library .lib-foot{max-width:1240px;margin:44px auto 0;font-size:12.5px;line-height:1.6;color:var(--muted);padding-bottom:12px}

    /* ---- book-opening cover gets the same spine ---- */
    .mlb-front::before{content:"";position:absolute;left:0;top:0;bottom:0;width:7px;z-index:3;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.34),rgba(255,255,255,.16) 55%,rgba(0,0,0,0))}

    @media (prefers-reduced-motion:reduce){
      #library .cover-btn,#library .lib-head{transition:none!important}
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
