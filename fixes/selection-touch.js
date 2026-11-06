/* Marginalia selection on touch screens (iPhone, iPad).
   Only applies when the main pointer is a finger (pointer: coarse), so PCs and mouse users are unchanged.
   - The action menu is pinned to the full width of the screen (no centring transform, so it can't drift off-screen).
   - Colours sit in one row; actions scroll sideways in one row instead of spilling past the edge.
   - Selection handles get a bigger finger target.
   Loaded from read-along-size.js. Remove the import to turn it off. */
(() => {
  if (window.__marginaliaSelectionTouch) return;
  window.__marginaliaSelectionTouch = true;

  const css = `
    @media (pointer: coarse){
      #selMenu{left:0 !important;right:0 !important;top:auto !important;bottom:0 !important;
        width:100% !important;max-width:100vw !important;transform:none !important;box-sizing:border-box;
        display:none;flex-direction:column;flex-wrap:nowrap;align-items:stretch;justify-content:flex-start;gap:10px;
        padding:12px 12px calc(var(--sab) + 14px);border-radius:22px 22px 0 0;
        background:rgba(28,28,30,.98);-webkit-backdrop-filter:none;backdrop-filter:none;
        box-shadow:0 -10px 40px rgba(0,0,0,.35);touch-action:pan-x;overflow:hidden}
      #selMenu.show{display:flex;animation:selUp .34s cubic-bezier(.2,.8,.2,1) both}
      @keyframes selUp{from{transform:translate3d(0,100%,0)}to{transform:translate3d(0,0,0)}}
      #selMenu .colors{display:flex;justify-content:space-between;align-items:center;width:100%;
        margin:0;padding:0 4px 10px;border-bottom:.5px solid rgba(255,255,255,.14)}
      #selMenu .dot{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex:none}
      #selMenu .acts{display:flex;flex-wrap:nowrap;justify-content:flex-start;gap:8px;width:100%;margin:0;padding:0 2px 2px;
        overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none}
      #selMenu .acts::-webkit-scrollbar{display:none}
      #selMenu .act{flex:none;height:46px;padding:0 16px;border-radius:14px;font-size:15px;font-weight:600;
        background:rgba(255,255,255,.11);color:#fff;white-space:nowrap}
      #selMenu .act.danger{background:rgba(255,69,58,.2);color:#ff8a80}
      #selMenu .act:active{background:rgba(255,255,255,.22)}
      .handle{width:44px}
      .handle::after{content:"";position:absolute;left:-14px;right:-14px;top:-10px;bottom:-10px;border-radius:24px}
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();
