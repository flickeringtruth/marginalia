/* Marginalia selection on touch screens (iPhone, iPad).
   Only applies when the main pointer is a finger (pointer: coarse), so PCs and mouse users are unchanged.
   - The action menu becomes a full-width sheet: colours on top, actions in one row you can swipe.
   - Selection handles get a bigger finger target.
   - The sheet ignores the iPhone blur effect, which made it flicker while the page scrolled.
   Loaded from ui-feedback.js. Remove the import to turn it off. */
(() => {
  if (window.__marginaliaSelectionTouch) return;
  window.__marginaliaSelectionTouch = true;

  const css = `
    @media (pointer: coarse){
      #selMenu{left:0;right:0;width:auto;max-width:none;transform:none;bottom:0;
        flex-direction:column;flex-wrap:nowrap;align-items:stretch;justify-content:flex-start;gap:8px;
        padding:12px 10px calc(var(--sab) + 12px);border-radius:22px 22px 0 0;
        background:rgba(28,28,30,.98);-webkit-backdrop-filter:none;backdrop-filter:none;
        box-shadow:0 -10px 40px rgba(0,0,0,.35);touch-action:pan-x}
      #selMenu.show{display:flex;animation:selMenuUp .34s cubic-bezier(.2,.8,.2,1) both}
      @keyframes selMenuUp{from{transform:translate3d(0,100%,0)}to{transform:none}}
      #selMenu .colors{display:flex;justify-content:space-between;align-items:center;width:100%;
        padding:0 4px 8px;border-bottom:.5px solid rgba(255,255,255,.14);margin:0}
      #selMenu .dot{width:44px;height:44px;border-radius:14px}
      #selMenu .acts{display:flex;flex-wrap:nowrap;justify-content:flex-start;gap:8px;width:100%;
        overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;
        padding:0 2px 2px;margin:0 -10px;padding-left:10px;padding-right:10px}
      #selMenu .acts::-webkit-scrollbar{display:none}
      #selMenu .act{flex:none;height:46px;padding:0 16px;border-radius:14px;font-size:15px;font-weight:600;
        background:rgba(255,255,255,.11);color:#fff}
      #selMenu .act.danger{background:rgba(255,69,58,.2);color:#ff8a80}
      #selMenu .act:active{background:rgba(255,255,255,.22)}
      .handle::after{content:"";position:absolute;left:-14px;right:-14px;top:-10px;bottom:-10px;border-radius:24px}
      .handle{width:44px}
      .handle .knob{box-shadow:0 0 0 4px rgba(10,132,255,.22)}
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
