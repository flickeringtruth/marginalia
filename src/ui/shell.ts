/* App shell: one layout for every v2 screen.
   A three-row grid: top bar, scrolling content, bottom bar. The bars are grid rows, not
   overlays, so they reserve their own space and content can never sit under them.
   Safe areas are applied once here (bars and content), never again inside screens.
   Height uses the dynamic viewport (100dvh, with 100% fallback through the fixed <body>). */

import { h, addStyle } from './dom.js';

const CSS = `
.v2-shell{position:absolute;inset:0;z-index:var(--z-base);display:grid;grid-template-rows:auto minmax(0,1fr) auto;
  height:100%;height:100dvh;overflow:hidden;background-color:var(--v2-bg);background-image:var(--bg-image);background-size:100% 100%;
  color:var(--v2-fg);font-family:var(--v2-sans);-webkit-font-smoothing:antialiased}
.v2-shell[hidden]{display:none}
.v2-bar{position:relative;z-index:var(--z-bars);box-sizing:border-box;padding-left:calc(var(--sal) + var(--v2-gutter));padding-right:calc(var(--sar) + var(--v2-gutter))}
.v2-bar:empty{display:none}
.v2-bar-top{padding-top:calc(var(--sat) + var(--v2-s3));padding-bottom:var(--v2-s3);
  background:color-mix(in srgb,var(--v2-bg) 86%,transparent);-webkit-backdrop-filter:saturate(180%) blur(18px);backdrop-filter:saturate(180%) blur(18px);
  border-bottom:1px solid transparent;transition:border-color var(--v2-d-base)}
.v2-shell.scrolled .v2-bar-top{border-bottom-color:var(--v2-line)}
.v2-bar-bottom{padding-top:var(--v2-s2);padding-bottom:calc(var(--sab) + var(--v2-s2));background:var(--v2-chrome);border-top:1px solid var(--v2-line)}
.v2-main{position:relative;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;
  padding:var(--v2-s2) calc(var(--sar) + var(--v2-gutter)) calc(var(--sab) + var(--v2-s10)) calc(var(--sal) + var(--v2-gutter))}
.v2-shell.has-bottom .v2-main{padding-bottom:var(--v2-s6)}
.v2-inner{max-width:var(--v2-max);margin:0 auto}
.v2-drop{position:fixed;inset:calc(var(--sat) + 12px) calc(var(--sar) + 12px) calc(var(--sab) + 12px) calc(var(--sal) + 12px);z-index:var(--z-overlay);
  display:none;align-items:center;justify-content:center;border:2px dashed var(--v2-accent);border-radius:var(--v2-r-xl);pointer-events:none;
  background:color-mix(in srgb,var(--v2-bg) 82%,transparent);color:var(--v2-accent);font:600 var(--v2-t-md)/1 var(--v2-sans)}
body.dragging .v2-drop{display:flex}
`;

export interface Shell { root: HTMLElement; top: HTMLElement; main: HTMLElement; inner: HTMLElement; bottom: HTMLElement }

export function AppShell(id: string, label: string): Shell {
  addStyle('v2-shell', CSS);
  const top = h('header', { class: 'v2-bar v2-bar-top' });
  const inner = h('div', { class: 'v2-inner' });
  const main = h('main', { class: 'v2-main', 'aria-label': label }, inner);
  const bottom = h('footer', { class: 'v2-bar v2-bar-bottom' });
  const root = h('div', { id, class: 'v2 v2-shell' }, top, main, bottom);
  main.addEventListener('scroll', () => root.classList.toggle('scrolled', main.scrollTop > 4), { passive: true });
  new MutationObserver(() => root.classList.toggle('has-bottom', bottom.childElementCount > 0)).observe(bottom, { childList: true });
  return { root, top, main, inner, bottom };
}
