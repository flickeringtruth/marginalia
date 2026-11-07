/* v2 text-selection menu. Replaces the engine's #selMenu, fixes/selection-touch.js and the
   reader-tools.js Note button.
   - Positioned with Floating UI (vendor/floating-ui, MIT): flip + shift inside the safe areas,
     so it is never off-screen.
   - The engine draws its own selection (marks + handles) and turns off the native one
     (user-select / -webkit-touch-callout: none), so iOS shows no callout to fight with.
     On touch screens the menu still prefers to sit *below* the selection, where an iOS
     callout would never appear, and it never takes focus away from the page.
   - Actions go through the engine's selectionAction(), the same code as the old menu. */

import { h, addStyle, reader } from '../dom.js';
import { icon, IconName } from '../icons.js';
import { portalRoot } from '../overlay.js';
import { noteFromSelection } from './contents.js';

interface Rect { left: number; top: number; right: number; bottom: number; width: number; height: number; x?: number; y?: number }
interface FloatingUI {
  computePosition: (ref: { getBoundingClientRect: () => Rect; getClientRects: () => Rect[] }, el: HTMLElement,
    o: { placement: string; strategy: string; middleware: unknown[] }) => Promise<{ x: number; y: number; placement: string }>;
  offset: (n: number) => unknown;
  flip: (o: Record<string, unknown>) => unknown;
  shift: (o: Record<string, unknown>) => unknown;
}

const CSS = `
.v2-selmenu{position:fixed;left:0;top:0;z-index:var(--z-menu);box-sizing:border-box;width:max-content;max-width:min(380px,calc(100vw - 16px));
  padding:6px;border-radius:var(--v2-r-lg);background:var(--v2-pop-bg);color:var(--v2-pop-fg);box-shadow:var(--v2-shadow-2);font-family:var(--v2-sans);
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation}
.v2-selmenu[hidden]{display:none}
.v2-selmenu .colors{display:flex;justify-content:center;gap:2px;padding-bottom:4px;margin-bottom:4px;border-bottom:1px solid var(--v2-pop-line)}
.v2-selmenu .dot{display:flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:0;border-radius:12px;background:none;cursor:pointer}
.v2-selmenu .dot i{width:26px;height:26px;border-radius:13px;border:2.5px solid transparent;box-sizing:border-box}
.v2-selmenu .dot[aria-pressed="true"] i{border-color:var(--v2-pop-fg)}
.v2-selmenu .acts{display:flex;flex-wrap:wrap;justify-content:center;gap:2px}
.v2-selmenu .act{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:52px;min-height:52px;padding:4px 6px;border:0;border-radius:12px;
  background:none;color:var(--v2-pop-fg);font:500 11px/1 var(--v2-sans);cursor:pointer}
.v2-selmenu .act .v2-icon{width:20px;height:20px}
.v2-selmenu .act.danger{color:var(--v2-pop-danger)}
.v2-selmenu button:hover,.v2-selmenu button:focus-visible{background:var(--v2-pop-hover);box-shadow:none}
`;

const FUI_URL = new URL('../../../../vendor/floating-ui/floating-ui.dom.js', import.meta.url).href;
let fui: Promise<FloatingUI> | null = null;
const loadFUI = () => (fui = fui || (import(FUI_URL) as Promise<FloatingUI>));

const NAMES: Record<string, string> = { yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink', purple: 'Purple' };

export function mountSelection(): void {
  addStyle('v2-selmenu', CSS);
  void loadFUI();
  const R = reader();
  const menu = h('div', { class: 'v2-selmenu v2', role: 'toolbar', 'aria-label': 'Selection actions', hidden: true });
  // The engine clears the selection on pointerdown outside its own menu; keep taps here inside.
  menu.addEventListener('pointerdown', e => e.stopPropagation());
  portalRoot().appendChild(menu);
  let open = false;

  const act = (label: string, ic: IconName, run: () => void, danger = false) => {
    const b = h('button', { type: 'button', class: 'act' + (danger ? ' danger' : ''), 'aria-label': label, title: label }, icon(ic), h('span', { 'aria-hidden': 'true', text: label }));
    b.addEventListener('click', () => { hide(); run(); });
    return b;
  };

  function build(): void {
    const s = R.selectionInfo();
    const colors = h('div', { class: 'colors', role: 'group', 'aria-label': 'Highlight colour' }, ...Object.entries(s.colors).map(([c, hex]) => {
      const dot = h('i'); dot.style.background = hex;
      const b = h('button', { type: 'button', class: 'dot', 'aria-label': (NAMES[c] || c) + ' highlight', 'aria-pressed': String(s.color === c) }, dot);
      b.addEventListener('click', () => { hide(); void R.selectionAction('color', c); });
      return b;
    }));
    const acts = h('div', { class: 'acts' },
      act('Note', 'note', noteFromSelection),
      act('Look up', 'dictionary', () => void R.selectionAction('define')),
      act('Ask AI', 'sparkle', () => void R.selectionAction('ask-ai')),
      s.canSpeak ? act('Read', 'headphones', () => void R.selectionAction('speak')) : null,
      act('Copy', 'copy', () => void R.selectionAction('copy')),
      s.canShare ? act('Share', 'share', () => void R.selectionAction('share')) : null,
      s.isHighlight ? act('Remove', 'trash', () => void R.selectionAction('remove'), true) : null);
    menu.replaceChildren(colors, acts);
  }

  async function place(): Promise<void> {
    const s = R.selectionInfo();
    if (!s.rects.length) { menu.style.visibility = 'hidden'; return; }
    const rects = s.rects;
    const box = rects.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }),
      { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    const ref = {
      getBoundingClientRect: (): Rect => ({ ...box, width: box.right - box.left, height: box.bottom - box.top, x: box.left, y: box.top }),
      getClientRects: (): Rect[] => rects
    };
    const css = getComputedStyle(document.documentElement), px = (v: string) => (parseFloat(css.getPropertyValue(v)) || 0) + 8;
    const padding = { top: px('--sat'), bottom: px('--sab'), left: px('--sal'), right: px('--sar') };
    const coarse = matchMedia('(pointer: coarse)').matches;
    const F = await loadFUI();
    const pos = await F.computePosition(ref, menu, {
      placement: coarse ? 'bottom' : 'top', strategy: 'fixed',
      middleware: [F.offset(coarse ? 28 : 10), F.flip({ padding, fallbackPlacements: [coarse ? 'top' : 'bottom'] }), F.shift({ padding })]
    });
    menu.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`;
    menu.style.visibility = '';
  }

  function show(): void {
    if (!R.selectionInfo().active) { hide(); return; }
    build();
    menu.hidden = false; open = true;
    menu.style.visibility = 'hidden';
    void place();
  }
  function hide(): void { menu.hidden = true; open = false; }

  document.addEventListener('reader:selection', e => { if (e.detail.open) show(); else hide(); });
  const again = () => { if (open) void place(); };
  window.addEventListener('resize', again);
  document.addEventListener('scroll', again, true);
  document.addEventListener('reader:screen', hide);
}
