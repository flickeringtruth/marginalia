/* Design tokens for v2, as CSS custom properties.
   Colours alias the engine's theme variables (--bg, --fg, --accent… rewritten by applyTheme() in
   index.html), so every existing theme (light, dark, sepia, custom, gradient) applies unchanged.
   Safe areas use the engine's --sat/--sab/--sal/--sar (env(safe-area-inset-*), viewport-fit=cover).

   One z-index scale, used everywhere in v2 and mapped onto the engine's own layers while v2 is on:
     base 0 < bars 100 < sheet 200 < overlay 300 < menu 400 < toast 500 */
import { addStyle } from './dom.js';
const TOKENS = `
:root{
  /* colour */
  --v2-bg:var(--bg); --v2-fg:var(--fg); --v2-muted:var(--muted); --v2-line:var(--line);
  --v2-surface:var(--card); --v2-sheet:var(--sheet); --v2-chrome:var(--chrome);
  --v2-accent:var(--accent); --v2-on-accent:#fff; --v2-danger:var(--danger,#ff3b30);
  --v2-scrim:rgba(0,0,0,.32);
  --v2-shadow-1:0 1px 2px rgba(0,0,0,.08),0 4px 12px -6px rgba(0,0,0,.22);
  --v2-shadow-2:0 2px 6px rgba(0,0,0,.08),0 18px 48px -12px rgba(0,0,0,.35);
  --v2-focus:0 0 0 3px color-mix(in srgb,var(--accent) 45%,transparent);

  /* spacing */
  --v2-s1:4px; --v2-s2:8px; --v2-s3:12px; --v2-s4:16px; --v2-s5:20px; --v2-s6:24px; --v2-s8:32px; --v2-s10:40px;
  --v2-gutter:clamp(16px,3.2vw,32px);
  --v2-max:1240px;

  /* radius */
  --v2-r-sm:8px; --v2-r-md:12px; --v2-r-lg:18px; --v2-r-xl:24px; --v2-r-pill:999px;

  /* type (same families as the current library) */
  --v2-serif:"Instrument Serif","Iowan Old Style","Palatino Linotype",Georgia,serif;
  --v2-sans:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,system-ui,sans-serif;
  --v2-t-xs:12px; --v2-t-sm:13px; --v2-t-base:15px; --v2-t-md:17px; --v2-t-lg:20px;
  --v2-t-xl:clamp(22px,3.2vw,28px); --v2-t-display:clamp(30px,5.4vw,46px);

  /* motion */
  --v2-ease:cubic-bezier(.2,.8,.2,1); --v2-ease-in:cubic-bezier(.4,0,1,1);
  --v2-d-fast:140ms; --v2-d-base:240ms; --v2-d-slow:380ms;

  /* layers */
  --z-base:0; --z-bars:100; --z-sheet:200; --z-overlay:300; --z-menu:400; --z-toast:500;

  /* touch */
  --v2-tap:44px;
}
html.dark{--v2-scrim:rgba(0,0,0,.55);--v2-shadow-1:0 1px 2px rgba(0,0,0,.4),0 4px 12px -6px rgba(0,0,0,.6);--v2-shadow-2:0 2px 6px rgba(0,0,0,.4),0 18px 48px -12px rgba(0,0,0,.7)}
@media (prefers-reduced-motion:reduce){:root{--v2-d-fast:0ms;--v2-d-base:0ms;--v2-d-slow:0ms}}
`;
/* While v2 is on, the engine's own layers are placed on the same scale, so nothing fights:
   old library hidden; sheets and module dialogs share the sheet layer; full-screen overlays above
   them; click particles at menu level; the toast always on top (it used to sit under dialogs). */
const ENGINE_MAP = `
html.ui-v2 #library{display:none!important}
html.ui-v2 #scrim{z-index:calc(var(--z-sheet) - 1)}
html.ui-v2 .sheet,html.ui-v2 .drawer,html.ui-v2 .ml-overlay,html.ui-v2 .ml-over2,html.ui-v2 .mlu-overlay{z-index:var(--z-sheet)}
html.ui-v2 #loading,html.ui-v2 #nameGate,html.ui-v2 .mlb-overlay{z-index:var(--z-overlay)}
html.ui-v2 .ml-part{z-index:var(--z-menu)}
html.ui-v2 #toast{z-index:var(--z-toast)}
`;
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap';
export function installTokens() {
    addStyle('v2-tokens', TOKENS + ENGINE_MAP);
    // Same font stylesheet the current library already loads (fixes/library-type.js), so the look carries over.
    if (!document.querySelector('link[data-v2-fonts]') && !document.querySelector(`link[href="${FONTS_URL}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = FONTS_URL;
        link.dataset.v2Fonts = '';
        document.head.appendChild(link);
    }
}
