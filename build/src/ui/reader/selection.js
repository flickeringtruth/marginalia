/* v2 text-selection menu. Replaces the engine's #selMenu, fixes/selection-touch.js and the
   reader-tools.js Note button.
   - Positioned with Floating UI (vendor/floating-ui, MIT): flip + shift inside the safe areas,
     so it is never off-screen.
   - The engine draws its own selection (marks + handles) and turns off the native one
     (user-select / -webkit-touch-callout: none), so iOS shows no callout to fight with.
     On touch screens the menu still prefers to sit *below* the selection, where an iOS
     callout would never appear, and it never takes focus away from the page.
   - Actions go through the engine's selectionAction(), the same code as the old menu.
   - Custom highlight colours: the last swatch opens the system colour picker. The chosen colour is
     stored on the highlight as "#rrggbb" (the engine accepts any string), and a CSS rule for it is
     added here because the engine only styles its five named colours. */
import { h, addStyle, reader } from '../dom.js';
import { icon } from '../icons.js';
import { portalRoot } from '../overlay.js';
import { noteFromSelection } from './contents.js';
const CSS = `
.v2-selmenu{position:fixed;left:0;top:0;z-index:var(--z-menu);box-sizing:border-box;width:max-content;max-width:min(380px,calc(100vw - 16px));
  padding:6px;border-radius:var(--v2-r-lg);background:var(--v2-pop-bg);color:var(--v2-pop-fg);box-shadow:var(--v2-shadow-2);font-family:var(--v2-sans);
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation}
.v2-selmenu[hidden]{display:none}
.v2-selmenu .colors{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;padding-bottom:4px;margin-bottom:4px;border-bottom:1px solid var(--v2-pop-line)}
.v2-selmenu .dot{position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:0;border-radius:12px;background:none;cursor:pointer}
.v2-selmenu .dot i{width:26px;height:26px;border-radius:13px;border:2.5px solid transparent;box-sizing:border-box}
.v2-selmenu .dot[aria-pressed="true"] i{border-color:var(--v2-pop-fg)}
.v2-selmenu .dot.pick i{background:conic-gradient(#ff375f,#ffcc00,#34c759,#0a84ff,#af52de,#ff375f)}
.v2-selmenu .dot.pick input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;padding:0}
.v2-selmenu .acts{display:flex;flex-wrap:wrap;justify-content:center;gap:2px}
.v2-selmenu .act{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:52px;min-height:52px;padding:4px 6px;border:0;border-radius:12px;
  background:none;color:var(--v2-pop-fg);font:500 11px/1 var(--v2-sans);cursor:pointer}
.v2-selmenu .act .v2-icon{width:20px;height:20px}
.v2-selmenu .act.danger{color:var(--v2-pop-danger)}
.v2-selmenu button:hover,.v2-selmenu button:focus-visible{background:var(--v2-pop-hover);box-shadow:none}
`;
const FUI_URL = new URL('../../../../vendor/floating-ui/floating-ui.dom.js', import.meta.url).href;
let fui = null;
const loadFUI = () => (fui = fui || import(FUI_URL));
const NAMES = { yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink', purple: 'Purple' };
const HEX = /^#[0-9a-f]{6}$/i;
const CUSTOM_KEY = 'marginalia.hlCustomColor';
function lastCustom() {
    try {
        const v = localStorage.getItem(CUSTOM_KEY);
        return v && HEX.test(v) ? v.toLowerCase() : null;
    }
    catch {
        return null;
    }
}
function rememberCustom(hex) {
    try {
        localStorage.setItem(CUSTOM_KEY, hex);
    }
    catch { /* storage blocked */ }
}
export function mountSelection() {
    addStyle('v2-selmenu', CSS);
    void loadFUI();
    const R = reader();
    const menu = h('div', { class: 'v2-selmenu v2', role: 'toolbar', 'aria-label': 'Selection actions', hidden: true });
    // The engine clears the selection on pointerdown outside its own menu; keep taps here inside.
    menu.addEventListener('pointerdown', e => e.stopPropagation());
    portalRoot().appendChild(menu);
    let open = false;
    /* One CSS rule per custom colour in use (existing highlights included), so marks and the Highlights list agree. */
    const rules = document.createElement('style');
    rules.id = 'v2-hl-custom';
    document.head.appendChild(rules);
    const painted = new Set();
    const paintColor = (hex) => {
        const c = hex.toLowerCase();
        if (!HEX.test(c) || painted.has(c))
            return;
        painted.add(c);
        const n = parseInt(c.slice(1), 16);
        rules.appendChild(document.createTextNode(`mark.hl[data-color="${c}"]{background:rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},.4)}`));
    };
    const paintAll = () => { for (const hl of R.HL?.list || [])
        paintColor(String(hl.color || '')); };
    let queued = false;
    new MutationObserver(() => {
        if (queued)
            return;
        queued = true;
        requestAnimationFrame(() => { queued = false; paintAll(); });
    }).observe(document.body, { childList: true, subtree: true });
    paintAll();
    const act = (label, ic, run, danger = false) => {
        const b = h('button', { type: 'button', class: 'act' + (danger ? ' danger' : ''), 'aria-label': label, title: label }, icon(ic), h('span', { 'aria-hidden': 'true', text: label }));
        b.addEventListener('click', () => { hide(); run(); });
        return b;
    };
    function build() {
        const s = R.selectionInfo();
        const apply = (c) => { paintColor(c); hide(); void R.selectionAction('color', c); };
        const dot = (c, hex, label) => {
            const sw = h('i');
            sw.style.background = hex;
            const b = h('button', { type: 'button', class: 'dot', 'aria-label': label + ' highlight', 'aria-pressed': String(s.color === c) }, sw);
            b.addEventListener('click', () => apply(c));
            return b;
        };
        const swatches = Object.entries(s.colors).map(([c, hex]) => dot(c, hex, NAMES[c] || c));
        const own = s.color && HEX.test(s.color) && !(s.color in s.colors) ? s.color : lastCustom();
        if (own)
            swatches.push(dot(own, own, 'Custom'));
        const pick = h('input', { type: 'color', 'aria-label': 'Choose a custom highlight colour' });
        pick.value = own || '#ff8800';
        pick.addEventListener('change', () => { const c = pick.value.toLowerCase(); rememberCustom(c); apply(c); });
        swatches.push(h('span', { class: 'dot pick', title: 'Custom colour' }, h('i'), pick));
        const colors = h('div', { class: 'colors', role: 'group', 'aria-label': 'Highlight colour' }, ...swatches);
        const acts = h('div', { class: 'acts' }, act('Note', 'note', noteFromSelection), act('Look up', 'dictionary', () => void R.selectionAction('define')), act('Ask AI', 'sparkle', () => void R.selectionAction('ask-ai')), s.canSpeak ? act('Read', 'headphones', () => void R.selectionAction('speak')) : null, act('Copy', 'copy', () => void R.selectionAction('copy')), s.canShare ? act('Share', 'share', () => void R.selectionAction('share')) : null, s.isHighlight ? act('Remove', 'trash', () => void R.selectionAction('remove'), true) : null);
        menu.replaceChildren(colors, acts);
    }
    async function place() {
        const s = R.selectionInfo();
        if (!s.rects.length) {
            menu.style.visibility = 'hidden';
            return;
        }
        const rects = s.rects;
        const box = rects.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
        const ref = {
            getBoundingClientRect: () => ({ ...box, width: box.right - box.left, height: box.bottom - box.top, x: box.left, y: box.top }),
            getClientRects: () => rects
        };
        const css = getComputedStyle(document.documentElement), px = (v) => (parseFloat(css.getPropertyValue(v)) || 0) + 8;
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
    function show() {
        if (!R.selectionInfo().active) {
            hide();
            return;
        }
        build();
        menu.hidden = false;
        open = true;
        menu.style.visibility = 'hidden';
        void place();
    }
    function hide() { menu.hidden = true; open = false; }
    document.addEventListener('reader:selection', e => { if (e.detail.open)
        show();
    else
        hide(); });
    const again = () => { if (open)
        void place(); };
    window.addEventListener('resize', again);
    document.addEventListener('scroll', again, true);
    document.addEventListener('reader:screen', hide);
}
