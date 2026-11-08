/* v2 reader bars (session 3). Replaces the engine's #topBar / #botBar and fixes/ui-polish.js.
   - Show/hide and auto-hide stay with the engine: it toggles body.chrome-on on a tap and on its
     auto-hide timer, and the bars here simply follow that class.
   - The engine keeps text out of --top-chrome-height / --bottom-chrome-height (#viewport and
     #scroller use them). We set those to the exact heights of these bars, plus the mini player
     while read-aloud is on, so the bars and the player never cover text. Tap zones for page
     turns are inside #viewport, so they are never under a bar either.
   - Bars live in one fixed root at the "bars" layer; sheets and menus open above them. */

import { h, addStyle, reader } from '../dom.js';
import { IconButton, rangeFill } from '../components.js';

const CSS = `
html.ui-v2 #topBar,html.ui-v2 #botBar,html.ui-v2 #selMenu,html.ui-v2 #abChip,html.ui-v2 #mlBookmarkBtn{display:none!important}
html.ui-v2 #audioBar .ab-full,html.ui-v2 #audioBar #abMini,html.ui-v2 #audioBar .ab-popup-backdrop{display:none!important}
/* the engine's read-along view is kept; it opens above the bars */
html.ui-v2 body.audio-lyrics-open #audioBar{z-index:var(--z-overlay)}
html.ui-v2 #dictFloat{z-index:calc(var(--z-bars) - 1)}
html.ui-v2 #speedReader{z-index:var(--z-overlay)}
html.ui-v2 #autoScrollControls{z-index:calc(var(--z-bars) + 1)}

/* reserved space = bar heights (+ mini player while audio is on) */
html.ui-v2 body{--v2-top-h:56px;--v2-bot-h:64px;--v2-mini-h:60px;
  --top-chrome-height:calc(var(--sat) + var(--v2-top-h));--bottom-chrome-height:calc(var(--sab) + var(--v2-bot-h))}
html.ui-v2 body.audio-on{--bottom-chrome-height:calc(var(--sab) + var(--v2-bot-h) + var(--v2-mini-h))}
html.ui-v2 body.immersive{--top-chrome-height:calc(var(--sat) + 40px);--bottom-chrome-height:calc(var(--sab) + 40px)}
html.ui-v2 body.immersive.audio-on{--bottom-chrome-height:calc(var(--sab) + 40px + var(--v2-mini-h))}
html.ui-v2 body.immersive.audio-on #viewport{bottom:var(--bottom-chrome-height)}

#v2-reader{position:fixed;inset:0;z-index:var(--z-bars);pointer-events:none;font-family:var(--v2-sans);color:var(--v2-fg);
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#v2-reader[hidden]{display:none}
#v2-reader .rbar{position:absolute;left:0;right:0;display:flex;align-items:center;gap:2px;box-sizing:border-box;pointer-events:auto;
  background:var(--v2-chrome);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);
  transition:opacity var(--v2-d-base) var(--v2-ease),transform var(--v2-d-base) var(--v2-ease),visibility 0s linear var(--v2-d-base)}
#v2-reader .rtop{top:0;height:calc(var(--sat) + var(--v2-top-h));padding:var(--sat) calc(var(--sar) + 6px) 0 calc(var(--sal) + 6px);border-bottom:1px solid var(--v2-line)}
#v2-reader .rbottom{bottom:0;height:calc(var(--sab) + var(--v2-bot-h));padding:0 calc(var(--sar) + 6px) var(--sab) calc(var(--sal) + 6px);border-top:1px solid var(--v2-line)}
body:not(.chrome-on) #v2-reader .rbar{opacity:0;visibility:hidden;pointer-events:none}
body:not(.chrome-on) #v2-reader .rtop{transform:translateY(-8px)}
body:not(.chrome-on) #v2-reader .rbottom{transform:translateY(8px)}
body.chrome-on #v2-reader .rbar{transition:opacity var(--v2-d-base) var(--v2-ease),transform var(--v2-d-base) var(--v2-ease),visibility 0s}
#v2-reader .rtitle{flex:1;min-width:0;text-align:center;padding:0 4px;line-height:1.2}
/* titles wrap onto a second line instead of being cut at the first few words */
#v2-reader .rtitle b{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;font:600 var(--v2-t-sm)/1.2 var(--v2-sans);overflow:hidden;overflow-wrap:anywhere;text-wrap:balance}
#v2-reader .rtitle span{display:block;font:400 var(--v2-t-xs)/1.25 var(--v2-sans);color:var(--v2-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#v2-reader .v2-ibtn[aria-pressed="true"]{color:var(--v2-accent);background:color-mix(in srgb,var(--v2-accent) 14%,transparent)}
#v2-reader .scrub{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;padding:0 4px}
#v2-reader .scrub input{width:100%;height:28px;margin:0;accent-color:var(--v2-accent)}
#v2-reader .scrub .lbl{font:500 var(--v2-t-xs)/1.2 var(--v2-sans);color:var(--v2-muted);text-align:center;overflow:hidden;font-variant-numeric:tabular-nums;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;text-wrap:balance}
/* narrow phones: Bookmarks and Dictionary move into More, the title goes to the bottom label */
@media (max-width:479px){#v2-reader .wide-only{display:none}}
@media (max-width:599px){#v2-reader .wider-only{display:none}}
@media (max-width:359px){#v2-reader .rtitle{visibility:hidden}}
@media (prefers-reduced-motion:reduce){#v2-reader .rbar{transition:none!important;transform:none!important}}
`;

export interface ReaderChrome {
  root: HTMLElement;
  miniSlot: HTMLElement;
  setAudioOn: (on: boolean) => void;
}

export function mountChrome(actions: { contents: () => void; bookmarks: () => void; settings: () => void; more: () => void;
  search?: () => void; label?: () => string | null }): ReaderChrome {
  addStyle('v2-reader-chrome', CSS);
  const R = reader();
  const keep = (fn: () => void) => () => { R.keepChrome(); fn(); };

  const title = h('div', { class: 'rtitle' }, h('b'), h('span'));
  const audioBtn = IconButton({ label: 'Read aloud', icon: 'headphones', onClick: keep(() => R.TTS.toggle()), attrs: { 'aria-pressed': 'false' } });
  const top = h('header', { class: 'rbar rtop', role: 'toolbar', 'aria-label': 'Reader' },
    IconButton({ label: 'Back to library', icon: 'chevron-left', onClick: () => R.closeBook() }),
    IconButton({ label: 'Contents', icon: 'contents', onClick: keep(actions.contents) }),
    title,
    actions.search ? IconButton({ label: 'Search in book', icon: 'search', onClick: keep(actions.search), attrs: { class: 'v2-ibtn wider-only' } }) : null,
    IconButton({ label: 'Bookmarks and notes', icon: 'bookmark', onClick: keep(actions.bookmarks), attrs: { class: 'v2-ibtn wide-only' } }),
    audioBtn,
    IconButton({ label: 'Dictionary', icon: 'dictionary', onClick: keep(() => R.dictionaryButton()), attrs: { class: 'v2-ibtn wide-only' } }),
    IconButton({ label: 'More', icon: 'more', onClick: keep(actions.more) }),
    IconButton({ label: 'Appearance settings', icon: 'type', onClick: keep(actions.settings) }));

  const scrub = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Position in book' });
  const label = h('div', { class: 'lbl', 'aria-live': 'off' });
  let dragging = false;
  scrub.addEventListener('input', () => { dragging = true; rangeFill(scrub); R.keepChrome(); label.textContent = R.percentLabel(Number(scrub.value) / 1000); });
  scrub.addEventListener('change', () => { dragging = false; void R.goToPercent(Number(scrub.value) / 1000); });
  const bottom = h('footer', { class: 'rbar rbottom', role: 'toolbar', 'aria-label': 'Page navigation' },
    IconButton({ label: 'Previous page', icon: 'chevron-left', onClick: keep(() => R.App.r && R.App.r.prev()) }),
    h('div', { class: 'scrub' }, scrub, label),
    IconButton({ label: 'Next page', icon: 'chevron-right', onClick: keep(() => R.App.r && R.App.r.next()) }));

  const miniSlot = h('div', { class: 'mini-slot' });
  const root = h('div', { id: 'v2-reader', class: 'v2' }, top, miniSlot, bottom);
  document.body.appendChild(root);

  const syncProgress = () => {
    const p = R.App.progress, book = R.App.book;
    title.firstElementChild!.textContent = book ? book.meta.title || '' : '';
    (title.lastElementChild as HTMLElement).textContent = p ? p.chapter : '';
    if (p && !dragging) { scrub.value = String(Math.round(p.pct * 1000)); rangeFill(scrub); label.textContent = (actions.label && actions.label()) || p.label; }
  };
  const syncScreen = (screen: string) => { root.hidden = screen !== 'reader'; if (!root.hidden) syncProgress(); };
  document.addEventListener('reader:progress', syncProgress);
  document.addEventListener('reader:screen', e => syncScreen(e.detail.screen));
  syncScreen(R.App.screen);

  return {
    root, miniSlot,
    setAudioOn: on => audioBtn.setAttribute('aria-pressed', String(on))
  };
}
