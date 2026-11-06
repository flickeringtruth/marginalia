/* Marginalia motion.
   Smooth entrance animations for sheets, lists, library cards, the selection menu and the bookmark button.
   Pure CSS keyframes, so nothing here changes behaviour. Everything is turned off when the phone
   or computer asks for reduced motion.
   Loaded from ui-polish.js (which read-along-size.js loads). Remove the import to turn it off.
   Note: the selection menu is deliberately NOT animated here. Its centring transform is owned by selection-touch.js. */
(() => {
  if (window.__marginaliaMotion) return;
  window.__marginaliaMotion = true;

  const css = `
    :root{--ease-out:cubic-bezier(.2,.8,.2,1);--ease-soft:cubic-bezier(.32,.72,0,1);--ease-spring:cubic-bezier(.34,1.46,.64,1)}

    @keyframes mlFade{from{opacity:0}to{opacity:1}}
    @keyframes mlUp{from{opacity:0;transform:translate3d(0,28px,0)}to{opacity:1;transform:none}}
    @keyframes mlIn{from{opacity:0;transform:translate3d(0,10px,0)}to{opacity:1;transform:none}}
    @keyframes mlCard{from{opacity:0;transform:translate3d(0,16px,0) scale(.98)}to{opacity:1;transform:none}}
    @keyframes mlSpin{from{transform:rotate(-40deg) scale(.6)}to{transform:none}}

    /* sheets and overlays slide up on open */
    .ml-overlay{animation:mlFade .24s var(--ease-out) both}
    .ml-sheet{animation:mlUp .46s var(--ease-soft) both}
    #mlPanel:not(.hidden) .ml-sheet{animation:mlUp .46s var(--ease-soft) both}

    /* tabs: the active tab glides its background */
    .ml-tab{transition:background-color .28s var(--ease-out),box-shadow .28s var(--ease-out),color .2s}
    .ml-seg button{transition:background-color .26s var(--ease-out),color .2s,box-shadow .26s}

    /* bookmark and note rows arrive in a gentle cascade */
    .ml-bm{animation:mlIn .42s var(--ease-out) both}
    .ml-bm:nth-child(2){animation-delay:40ms}
    .ml-bm:nth-child(3){animation-delay:80ms}
    .ml-bm:nth-child(4){animation-delay:120ms}
    .ml-bm:nth-child(5){animation-delay:160ms}
    .ml-bm:nth-child(n+6){animation-delay:200ms}
    .ml-row2{animation:mlIn .42s var(--ease-out) both}
    .ml-row2:nth-child(2){animation-delay:40ms}
    .ml-row2:nth-child(3){animation-delay:80ms}
    .ml-row2:nth-child(n+4){animation-delay:120ms}

    /* the bookmark icon lights up with a small spring */
    #mlBookmarkBtn.on svg{animation:mlSpin .5s var(--ease-spring) both}

    /* library: cover cards cascade in on load */
    #libGrid .card{animation:mlCard .56s var(--ease-out) both}
    #libGrid .card:nth-child(2){animation-delay:50ms}
    #libGrid .card:nth-child(3){animation-delay:100ms}
    #libGrid .card:nth-child(4){animation-delay:150ms}
    #libGrid .card:nth-child(5){animation-delay:200ms}
    #libGrid .card:nth-child(6){animation-delay:250ms}
    #libGrid .card:nth-child(7){animation-delay:300ms}
    #libGrid .card:nth-child(8){animation-delay:350ms}
    #libGrid .card:nth-child(n+9){animation-delay:400ms}
    #libGrid .cover-btn{transition:transform .35s var(--ease-out),box-shadow .35s var(--ease-out)}
    @media (hover:hover){
      #libGrid .cover-btn:hover{transform:translate3d(0,-3px,0);box-shadow:0 10px 24px rgba(0,0,0,.18)}
    }

    /* buttons: crisp press and hover colour shifts */
    .pill,.wide-btn,.small-btn,#selMenu .act{transition:transform .14s var(--ease-out),background-color .25s,color .25s,box-shadow .25s}
    @media (hover:hover){
      .pill:hover{filter:brightness(1.06)}
      .wide-btn:hover,.small-btn:hover{filter:brightness(1.04)}
    }

    /* read-along: the current line eases to focus */
    .ab-lyric-line{transition:opacity .34s var(--ease-out),transform .34s var(--ease-out),color .3s}

    /* toast slides up and fades */
    #toast{transition:opacity .3s var(--ease-out),transform .34s var(--ease-soft)}

    @media (prefers-reduced-motion: reduce){
      *,*::before,*::after{animation-duration:.01ms!important;animation-delay:0ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
