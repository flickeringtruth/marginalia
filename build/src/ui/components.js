/* Shared v2 components. Every control: a real <button>/<input>, an accessible name, a 44 px touch
   target, a visible focus ring, and motion that switches off with prefers-reduced-motion. */
import { h, addStyle, nextId, reduceMotion } from './dom.js';
import { icon } from './icons.js';
import { openLayer, portalRoot } from './overlay.js';
const CSS = `
.v2-icon{width:22px;height:22px;flex:none;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.v2 :focus{outline:none}
.v2 :focus-visible,#v2-portal :focus-visible{outline:none;box-shadow:var(--v2-focus)}
/* the hidden attribute always wins over component display rules */
.v2 [hidden],#v2-portal [hidden]{display:none!important}
.v2-sr{position:absolute!important;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* Button */
.v2-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--v2-s2);min-height:var(--v2-tap);min-width:var(--v2-tap);
  padding:0 var(--v2-s4);border-radius:var(--v2-r-pill);border:0;background:var(--v2-surface);color:var(--v2-fg);
  font:600 var(--v2-t-base)/1 var(--v2-sans);letter-spacing:-.005em;text-decoration:none;white-space:nowrap;cursor:pointer;
  transition:transform var(--v2-d-fast) var(--v2-ease),background-color var(--v2-d-base),filter var(--v2-d-base);-webkit-tap-highlight-color:transparent}
.v2-btn .v2-icon{width:18px;height:18px}
.v2-btn:active:not(:disabled){transform:scale(.97)}
.v2-btn:disabled{opacity:.45;cursor:default}
.v2-btn.primary{background:var(--v2-accent);color:var(--v2-on-accent)}
.v2-btn.ghost{background:transparent}
.v2-btn.danger{color:var(--v2-danger)}
.v2-btn.danger.primary{background:var(--v2-danger);color:var(--v2-on-accent)}
.v2-btn.block{width:100%}
@media (hover:hover){.v2-btn:hover:not(:disabled){filter:brightness(1.06)}.v2-btn.ghost:hover:not(:disabled){background:var(--v2-surface);filter:none}}
/* Icon-only on narrow screens; the button keeps its aria-label */
@media (max-width:419px){.v2-btn [data-hide-below="420"]{display:none}.v2-btn.icon-420{padding:0}}
@media (max-width:519px){.v2-btn [data-hide-below="520"]{display:none}.v2-btn.icon-520{padding:0}}
@media (max-width:639px){.v2-btn [data-hide-below="640"]{display:none}.v2-btn.icon-640{padding:0}}

/* IconButton */
.v2-ibtn{display:inline-flex;align-items:center;justify-content:center;width:var(--v2-tap);height:var(--v2-tap);flex:none;
  border-radius:var(--v2-r-pill);border:0;background:transparent;color:var(--v2-fg);padding:0;cursor:pointer;
  transition:background-color var(--v2-d-base),transform var(--v2-d-fast) var(--v2-ease);-webkit-tap-highlight-color:transparent}
.v2-ibtn.filled{background:var(--v2-surface)}
.v2-ibtn:active{transform:scale(.94);background:var(--v2-surface)}
@media (hover:hover){.v2-ibtn:hover{background:var(--v2-surface)}}

/* Chip (filter) */
.v2-chip{display:inline-flex;align-items:center;gap:6px;min-height:var(--v2-tap);padding:0 var(--v2-s4);flex:none;border:0;border-radius:var(--v2-r-pill);
  background:var(--v2-surface);color:var(--v2-fg);font:500 var(--v2-t-sm)/1 var(--v2-sans);cursor:pointer;white-space:nowrap;
  transition:background-color var(--v2-d-base),color var(--v2-d-base)}
.v2-chip .v2-icon{width:16px;height:16px}
.v2-chip .n{font-weight:500;opacity:.65;font-variant-numeric:tabular-nums}
.v2-chip[aria-pressed="true"]{background:var(--v2-fg);color:var(--v2-bg)}
.v2-chip[aria-pressed="true"] .n{opacity:.75}

/* Field */
.v2-field{display:block;margin-top:var(--v2-s4)}
.v2-field>span{display:block;font:500 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted);margin-bottom:6px}
.v2-input{display:block;width:100%;box-sizing:border-box;min-height:var(--v2-tap);padding:0 var(--v2-s3);border-radius:var(--v2-r-md);
  border:1px solid var(--v2-line);background:var(--v2-surface);color:var(--v2-fg);font:400 16px/1.3 var(--v2-sans)}
.v2-input:focus-visible{border-color:var(--v2-accent)}

/* Toggle */
.v2-toggle{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-s3);width:100%;min-height:var(--v2-tap);margin-top:var(--v2-s3);
  padding:0;border:0;background:none;color:var(--v2-fg);font:500 var(--v2-t-base)/1.3 var(--v2-sans);text-align:left;cursor:pointer}
.v2-toggle .track{position:relative;flex:none;width:51px;height:31px;border-radius:16px;background:var(--v2-line);transition:background-color var(--v2-d-base)}
.v2-toggle .thumb{position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:var(--v2-thumb);box-shadow:0 2px 4px var(--app-shadow);transition:transform var(--v2-d-base) var(--v2-ease)}
.v2-toggle[aria-checked="true"] .track{background:var(--v2-accent)}
.v2-toggle[aria-checked="true"] .thumb{transform:translateX(20px)}

/* Slider */
.v2-slider{display:grid;grid-template-columns:1fr auto;align-items:center;gap:2px var(--v2-s3);margin-top:var(--v2-s3);font:500 var(--v2-t-base)/1.3 var(--v2-sans);color:var(--v2-fg)}
.v2-slider input{grid-column:1 / -1;width:100%;min-height:var(--v2-tap);accent-color:var(--v2-accent)}
/* The engine sets touch-action:none on every range input. In a scrolling sheet that stops a swipe that starts on a slider
   from scrolling at all, so sliders here only claim horizontal drags. */
.v2-slider input,#v2-portal input[type=range]{touch-action:pan-y}
.v2-slider output{color:var(--v2-muted);font-variant-numeric:tabular-nums;font-size:var(--v2-t-sm)}

/* Segmented */
.v2-seg{display:flex;gap:2px;padding:3px;border-radius:var(--v2-r-md);background:var(--v2-surface);max-width:100%;overflow-x:auto;scrollbar-width:none}
.v2-seg::-webkit-scrollbar{display:none}
.v2-seg button{flex:1 0 auto;min-height:38px;padding:0 var(--v2-s3);border:0;border-radius:9px;background:transparent;color:var(--v2-muted);font:600 var(--v2-t-sm)/1 var(--v2-sans);cursor:pointer;
  transition:background-color var(--v2-d-base),color var(--v2-d-base)}
.v2-seg button[aria-checked="true"]{background:var(--v2-bg);color:var(--v2-fg);box-shadow:var(--v2-shadow-1)}
.v2-seg{min-height:var(--v2-tap);box-sizing:border-box}

/* ListItem */
.v2-li{display:flex;align-items:center;gap:var(--v2-s3);width:100%;min-height:56px;padding:var(--v2-s2) var(--v2-s2);border:0;border-radius:var(--v2-r-md);
  background:none;color:var(--v2-fg);text-align:left;font:inherit;cursor:pointer}
.v2-li+.v2-li{margin-top:2px}
.v2-li .lead{display:flex;align-items:center;justify-content:center;width:40px;height:40px;flex:none;border-radius:11px;background:var(--v2-surface);color:var(--v2-accent-text)}
.v2-li .txt{flex:1;min-width:0}
.v2-li .txt b{display:block;font:600 var(--v2-t-base)/1.3 var(--v2-sans);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.v2-li .txt small{display:block;margin-top:2px;font:400 var(--v2-t-sm)/1.35 var(--v2-sans);color:var(--v2-muted)}
.v2-li .trail{display:flex;align-items:center;gap:2px;flex:none;color:var(--v2-muted)}
button.v2-li:active,button.v2-li:hover{background:var(--v2-surface)}

/* Backdrop / catcher (overlay manager) */
.v2-backdrop{position:fixed;inset:0;background:var(--v2-scrim)}
.v2-catcher{position:fixed;inset:0;background:transparent}

/* Sheet: bottom sheet on phones, centred dialog on wide screens */
.v2-sheet{position:fixed;left:0;right:0;bottom:var(--v2-kb,0px);margin:0 auto;box-sizing:border-box;width:100%;max-width:560px;
  max-height:calc(100vh - var(--sat) - 24px - var(--v2-kb,0px));max-height:calc(100svh - var(--sat) - 24px - var(--v2-kb,0px));max-height:calc(100dvh - var(--sat) - 24px - var(--v2-kb,0px));
  display:flex;flex-direction:column;
  background:var(--v2-sheet);color:var(--v2-fg);border-radius:var(--v2-r-xl) var(--v2-r-xl) 0 0;box-shadow:var(--v2-shadow-2);
  padding:0 var(--sar) 0 var(--sal);font-family:var(--v2-sans)}
/* The handle and header are the drag-to-dismiss zones, so they take over touches (touch-action:none).
   The body keeps native vertical scrolling and only hands over when it is scrolled to the top. */
.v2-sheet-grab{width:36px;height:5px;border-radius:3px;background:var(--v2-line);margin:8px auto 0;flex:none;position:relative}
.v2-sheet-grab::before{content:"";position:absolute;inset:-12px -32px}
.v2-sheet-head{display:flex;align-items:center;gap:var(--v2-s2);padding:var(--v2-s2) var(--v2-s2) var(--v2-s2) var(--v2-s5);flex:none}
.v2-sheet-grab,.v2-sheet-head{touch-action:none;-webkit-user-select:none;user-select:none}
.v2-sheet-head h2{flex:1;min-width:0;margin:0;font:700 var(--v2-t-lg)/1.25 var(--v2-sans);letter-spacing:-.015em}
.v2-sheet-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:0 var(--v2-s5) var(--v2-s5)}
.v2-sheet-foot{display:flex;gap:var(--v2-s3);flex:none;padding:var(--v2-s3) var(--v2-s5) calc(var(--sab) + var(--v2-s4));border-top:1px solid var(--v2-line)}
.v2-sheet-foot>*{flex:1}
/* Last item clears the home indicator and Safari's floating toolbar (iOS 26): safe area plus a fixed buffer. */
.v2-sheet:not(:has(.v2-sheet-foot)) .v2-sheet-body{padding-bottom:calc(var(--sab) + var(--v2-s8));scroll-padding-bottom:calc(var(--sab) + var(--v2-s8))}
.v2-sheet .v2-hint{font:400 var(--v2-t-sm)/1.5 var(--v2-sans);color:var(--v2-muted);margin:var(--v2-s3) 0 0}
@media (min-width:700px) and (min-height:520px){
  .v2-sheet{top:50%;bottom:auto;left:50%;right:auto;transform:translate(-50%,-50%);max-width:520px;max-height:min(720px,calc(100vh - 64px));max-height:min(720px,calc(100dvh - 64px));
    border-radius:var(--v2-r-xl);padding:0}
  .v2-sheet-grab{display:none}
  .v2-sheet-head{padding-top:var(--v2-s3)}
  .v2-sheet-foot{padding-bottom:var(--v2-s4)}
}

/* Menu */
.v2-menu{position:fixed;min-width:220px;max-width:min(320px,calc(100vw - 24px));box-sizing:border-box;padding:6px;border-radius:var(--v2-r-lg);
  background:var(--v2-sheet);color:var(--v2-fg);box-shadow:var(--v2-shadow-2);border:1px solid var(--v2-line);font-family:var(--v2-sans)}
.v2-menu button{display:flex;align-items:center;gap:var(--v2-s3);width:100%;min-height:var(--v2-tap);padding:0 var(--v2-s3);border:0;border-radius:10px;
  background:none;color:inherit;font:500 var(--v2-t-base)/1.2 var(--v2-sans);text-align:left;cursor:pointer}
.v2-menu button .v2-icon{width:19px;height:19px;color:var(--v2-muted)}
.v2-menu button:hover,.v2-menu button:focus-visible{background:var(--v2-surface);box-shadow:none}
.v2-menu button.danger,.v2-menu button.danger .v2-icon{color:var(--v2-danger)}
.v2-menu hr{border:0;border-top:1px solid var(--v2-line);margin:4px 6px}

/* Toast */
.v2-toast{position:fixed;left:50%;bottom:calc(var(--bottom-chrome-height,var(--sab)) + 16px);z-index:var(--z-toast);transform:translateX(-50%);max-width:min(440px,calc(100vw - 32px));
  box-sizing:border-box;padding:12px 18px;border-radius:var(--v2-r-lg);background:var(--v2-toast-bg);color:var(--v2-toast-fg);font:500 var(--v2-t-sm)/1.4 var(--v2-sans);
  box-shadow:var(--v2-shadow-2);pointer-events:none;opacity:0;transition:opacity var(--v2-d-base),transform var(--v2-d-base) var(--v2-ease)}
.v2-toast.on{opacity:1;transform:translate(-50%,-4px)}

/* Empty / error state */
.v2-empty{max-width:420px;margin:clamp(32px,9dvh,96px) auto 0;padding:0 var(--v2-s4);text-align:center;font-family:var(--v2-sans)}
.v2-empty .v2-art{width:96px;height:96px;margin:0 auto var(--v2-s5);color:var(--v2-muted);stroke-width:2.4;opacity:.85}
.v2-empty.error .v2-art{color:var(--v2-danger);width:56px;height:56px}
.v2-empty h2{margin:0 0 var(--v2-s2);font:700 var(--v2-t-lg)/1.25 var(--v2-sans);letter-spacing:-.015em}
.v2-empty p{margin:0 0 var(--v2-s5);font:400 var(--v2-t-base)/1.5 var(--v2-sans);color:var(--v2-muted)}
.v2-empty .v2-acts{display:flex;flex-direction:column;gap:var(--v2-s2);max-width:300px;margin:0 auto}
`;
export function installComponents() { addStyle('v2-components', CSS); }
export function Button(o) {
    const variant = o.variant === 'danger-primary' ? 'danger primary' : o.variant && o.variant !== 'secondary' ? o.variant : '';
    const b = h('button', { type: 'button', class: ['v2-btn', variant, o.block ? 'block' : ''].filter(Boolean).join(' ') });
    if (o.icon)
        b.appendChild(icon(o.icon));
    const text = h('span', { text: o.label });
    if (o.hideLabelBelow) {
        text.dataset.hideBelow = String(o.hideLabelBelow);
        b.classList.add('icon-' + o.hideLabelBelow);
        b.setAttribute('aria-label', o.label);
    }
    b.appendChild(text);
    if (o.attrs)
        for (const [k, v] of Object.entries(o.attrs))
            b.setAttribute(k, v);
    if (o.onClick)
        b.addEventListener('click', o.onClick);
    return b;
}
export function IconButton(o) {
    const b = h('button', { type: 'button', class: 'v2-ibtn' + (o.filled ? ' filled' : ''), 'aria-label': o.label, title: o.label });
    b.appendChild(icon(o.icon));
    if (o.attrs)
        for (const [k, v] of Object.entries(o.attrs))
            b.setAttribute(k, v);
    if (o.onClick)
        b.addEventListener('click', o.onClick);
    return b;
}
/** A filter chip: a toggle button with aria-pressed. */
export function Chip(o) {
    const b = h('button', { type: 'button', class: 'v2-chip', 'aria-pressed': String(!!o.pressed) });
    if (o.icon)
        b.appendChild(icon(o.icon));
    b.appendChild(h('span', { text: o.label }));
    if (o.count != null)
        b.appendChild(h('span', { class: 'n', text: String(o.count) }));
    if (o.onClick)
        b.addEventListener('click', o.onClick);
    return b;
}
export function Field(o) {
    const input = h('input', { class: 'v2-input', id: o.id, placeholder: o.placeholder, maxlength: o.maxlength, autocomplete: 'off' });
    input.value = o.value || '';
    const el = h('label', { class: 'v2-field' }, h('span', { text: o.label }), input);
    return { el, input };
}
/* ---------- Toggle / Slider / Segmented ---------- */
export function Toggle(o) {
    const b = h('button', { type: 'button', role: 'switch', class: 'v2-toggle', 'aria-checked': String(o.checked) }, h('span', { text: o.label }), h('span', { class: 'track', 'aria-hidden': 'true' }, h('span', { class: 'thumb' })));
    Object.defineProperty(b, 'checked', {
        get: () => b.getAttribute('aria-checked') === 'true',
        set: (v) => b.setAttribute('aria-checked', String(!!v))
    });
    b.addEventListener('click', () => { b.checked = !b.checked; if (o.onChange)
        o.onChange(b.checked); });
    return b;
}
/* The engine's global range style fills the track up to --p; keep it in step with the value. */
export function rangeFill(input) {
    const min = Number(input.min) || 0, max = Number(input.max) || 100;
    input.style.setProperty('--p', ((Number(input.value) - min) / (max - min || 1) * 100) + '%');
}
export function Slider(o) {
    const id = nextId('v2-sl');
    const input = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step ?? 1 });
    input.value = String(o.value);
    rangeFill(input);
    const out = h('output', { for: id, text: (o.format || String)(o.value) });
    input.addEventListener('input', () => { const v = Number(input.value); rangeFill(input); out.textContent = (o.format || String)(v); if (o.onInput)
        o.onInput(v); });
    return h('label', { class: 'v2-slider' }, h('span', { text: o.label }), out, input);
}
export function Segmented(o) {
    const group = h('div', { class: 'v2-seg', role: 'radiogroup', 'aria-label': o.label });
    const buttons = o.options.map(opt => {
        const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(opt.value === o.value), tabindex: opt.value === o.value ? '0' : '-1', text: opt.label });
        b.addEventListener('click', () => select(opt.value, true));
        group.appendChild(b);
        return b;
    });
    function select(v, notify) {
        buttons.forEach((b, i) => { const on = o.options[i].value === v; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
        if (notify && o.onChange)
            o.onChange(v);
    }
    group.addEventListener('keydown', e => {
        const i = buttons.indexOf(document.activeElement);
        if (i < 0)
            return;
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d)
            return;
        e.preventDefault();
        const n = (i + d + buttons.length) % buttons.length;
        buttons[n].focus();
        select(o.options[n].value, true);
    });
    return group;
}
/* ---------- ListItem ---------- */
export function ListItem(o) {
    const parts = [
        o.icon ? h('span', { class: 'lead', 'aria-hidden': 'true' }, icon(o.icon)) : null,
        h('span', { class: 'txt' }, h('b', { text: o.title }), o.subtitle ? h('small', { text: o.subtitle }) : null)
    ];
    if (o.onClick) {
        const b = h('button', { type: 'button', class: 'v2-li' }, ...parts, h('span', { class: 'trail', 'aria-hidden': 'true' }, icon('chevron-right')));
        b.addEventListener('click', o.onClick);
        return b;
    }
    return h('div', { class: 'v2-li' }, ...parts, o.trailing ? h('span', { class: 'trail' }, ...o.trailing) : null);
}
export function Sheet(o) {
    const titleId = nextId('v2-sheet-title');
    const body = h('div', { class: 'v2-sheet-body' });
    const panel = h('div', {
        class: 'v2-sheet' + (o.className ? ' ' + o.className : ''), role: 'dialog', 'aria-modal': 'true',
        'aria-label': o.label || null, 'aria-labelledby': o.label ? null : titleId
    });
    let close = () => { };
    panel.append(h('div', { class: 'v2-sheet-grab', 'aria-hidden': 'true' }), h('header', { class: 'v2-sheet-head' }, h('h2', { id: titleId, text: o.title }), IconButton({ label: 'Close', icon: 'close', onClick: () => close() })), body);
    for (const c of [].concat(o.content))
        if (c)
            body.append(c);
    if (o.footer && o.footer.length)
        panel.appendChild(h('footer', { class: 'v2-sheet-foot' }, ...o.footer));
    const wide = () => matchMedia('(min-width:700px) and (min-height:520px)').matches;
    let dragY = 0; // where a drag-to-dismiss let go, so the exit animation continues from there
    const drag = installSheetDrag(panel, body, wide, y => { dragY = y; close(); });
    close = openLayer(panel, {
        kind: 'sheet', modal: true, onClose: o.onClose,
        initialFocus: panel.querySelector('.v2-sheet-body input, .v2-sheet-body button') || undefined,
        animateIn: p => wide()
            ? p.animate([{ opacity: 0, transform: 'translate(-50%,-48%) scale(.98)' }, { opacity: 1, transform: 'translate(-50%,-50%)' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' })
            : p.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' }),
        animateOut: p => wide()
            ? p.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' })
            : p.animate([{ transform: 'translateY(' + dragY + 'px)' }, { transform: 'translateY(100%)' }], { duration: 220, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })
    });
    void drag;
    return { panel, body, close: () => close() };
}
/* Drag-to-dismiss for the phone bottom sheet.
   - From the handle or header: pointer events (those zones have touch-action:none).
   - From the body: only when it is scrolled to the very top and the finger moves down; any other
     touch is left alone so native scrolling is never swallowed. Not used in the centred dialog layout. */
function installSheetDrag(panel, body, wide, dismiss) {
    const grab = panel.querySelector('.v2-sheet-grab'), head = panel.querySelector('.v2-sheet-head');
    const THRESHOLD = 96, FLICK = 0.6; // px, px/ms
    let startY = 0, lastY = 0, lastT = 0, vel = 0, dy = 0, active = false;
    const begin = (y) => { startY = lastY = y; lastT = performance.now(); vel = 0; dy = 0; active = true; };
    const move = (y) => {
        const now = performance.now();
        vel = (y - lastY) / Math.max(1, now - lastT);
        lastY = y;
        lastT = now;
        dy = Math.max(0, y - startY);
        panel.style.transform = dy ? 'translateY(' + dy + 'px)' : '';
    };
    const end = () => {
        if (!active)
            return;
        active = false;
        if (dy > THRESHOLD || (dy > 24 && vel > FLICK)) {
            const y = dy;
            dy = 0;
            dismiss(y);
            return;
        }
        if (dy > 0) {
            const from = dy;
            dy = 0;
            if (reduceMotion())
                panel.style.transform = '';
            else
                panel.animate([{ transform: 'translateY(' + from + 'px)' }, { transform: 'translateY(0)' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.then(() => { panel.style.transform = ''; }, () => { panel.style.transform = ''; });
            panel.style.transform = '';
        }
    };
    for (const zone of [grab, head]) {
        if (!zone)
            continue;
        zone.addEventListener('pointerdown', e => {
            if (wide() || e.button !== 0 || e.target.closest('button,a,input'))
                return;
            begin(e.clientY);
            try {
                zone.setPointerCapture(e.pointerId);
            }
            catch { /* ignore */ }
        });
        zone.addEventListener('pointermove', e => { if (active)
            move(e.clientY); });
        zone.addEventListener('pointerup', end);
        zone.addEventListener('pointercancel', end);
    }
    // Body: a touch that starts at scrollTop 0 and pulls down becomes a drag; once the body has scrolled, it never does.
    let bodyTracking = false, bodyDragging = false;
    body.addEventListener('touchstart', e => {
        bodyTracking = !wide() && e.touches.length === 1 && body.scrollTop <= 0;
        bodyDragging = false;
        if (bodyTracking) {
            startY = e.touches[0].clientY;
            lastY = startY;
            lastT = performance.now();
            vel = 0;
            dy = 0;
        }
    }, { passive: true });
    body.addEventListener('touchmove', e => {
        if (!bodyTracking)
            return;
        const y = e.touches[0].clientY;
        if (body.scrollTop > 0 || y < startY - 2) {
            if (!bodyDragging)
                bodyTracking = false;
            if (!bodyDragging)
                return;
        }
        if (!bodyDragging) {
            if (y - startY < 8)
                return;
            bodyDragging = true;
            active = true;
            startY = y - 8;
        }
        if (e.cancelable)
            e.preventDefault();
        move(y);
    }, { passive: false });
    const bodyEnd = () => { if (bodyDragging)
        end(); bodyTracking = false; bodyDragging = false; };
    body.addEventListener('touchend', bodyEnd);
    body.addEventListener('touchcancel', bodyEnd);
    return () => undefined;
}
/** A yes/no question in a sheet. Resolves true when confirmed. */
export function confirmSheet(o) {
    return new Promise(resolve => {
        let answered = false;
        const done = (v) => { if (answered)
            return; answered = true; resolve(v); s.close(); };
        const s = Sheet({
            title: o.title, content: h('p', { class: 'v2-hint', text: o.text }),
            footer: [Button({ label: 'Cancel', onClick: () => done(false) }), Button({ label: o.confirm, variant: o.danger ? 'danger-primary' : 'primary', onClick: () => done(true) })],
            onClose: () => { if (!answered) {
                answered = true;
                resolve(false);
            } }
        });
    });
}
export function Menu(anchor, items, label) {
    const panel = h('div', { class: 'v2-menu', role: 'menu', 'aria-label': label });
    let close = () => { };
    const buttons = [];
    for (const it of items) {
        if (it === 'separator') {
            panel.appendChild(h('hr', { role: 'separator' }));
            continue;
        }
        const b = h('button', { type: 'button', role: 'menuitem', class: it.danger ? 'danger' : '', tabindex: '-1' });
        if (it.icon)
            b.appendChild(icon(it.icon));
        b.appendChild(h('span', { text: it.label }));
        b.addEventListener('click', () => { close(); it.onSelect(); });
        buttons.push(b);
        panel.appendChild(b);
    }
    panel.addEventListener('keydown', e => {
        const i = buttons.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const n = (i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[n].focus();
        }
        else if (e.key === 'Home') {
            e.preventDefault();
            buttons[0].focus();
        }
        else if (e.key === 'End') {
            e.preventDefault();
            buttons[buttons.length - 1].focus();
        }
    });
    portalRoot().appendChild(panel); // measure before placing
    place(panel, anchor);
    panel.remove();
    anchor.setAttribute('aria-expanded', 'true');
    close = openLayer(panel, {
        kind: 'menu', modal: false, initialFocus: buttons[0], returnFocus: anchor,
        onClose: () => anchor.setAttribute('aria-expanded', 'false'),
        animateIn: p => p.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 150, easing: 'ease-out' }),
        animateOut: p => p.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: 'ease-in', fill: 'forwards' })
    });
    return close;
}
/* Places a menu next to its anchor, flipping above when there is no room below, inside the safe areas. */
function place(panel, anchor) {
    const css = getComputedStyle(document.documentElement);
    const inset = (v) => parseFloat(css.getPropertyValue(v)) || 0;
    const pad = 8;
    const minX = inset('--sal') + pad, maxX = window.innerWidth - inset('--sar') - pad;
    const minY = inset('--sat') + pad, maxY = window.innerHeight - inset('--sab') - pad;
    const a = anchor.getBoundingClientRect();
    const w = panel.offsetWidth, ht = panel.offsetHeight;
    let left = a.right - w;
    if (left < minX)
        left = Math.min(a.left, maxX - w);
    left = Math.max(minX, Math.min(left, maxX - w));
    let top = a.bottom + 6;
    if (top + ht > maxY && a.top - 6 - ht >= minY)
        top = a.top - 6 - ht;
    top = Math.max(minY, Math.min(top, maxY - ht));
    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
    panel.style.transformOrigin = (a.right - left) + 'px ' + (top > a.top ? '0' : '100%');
}
/* ---------- Toast ---------- */
let toastEl = null, toastTimer = 0;
export function showToast(message, ms = 2400) {
    if (!toastEl) {
        toastEl = h('div', { class: 'v2-toast', role: 'status', 'aria-live': 'polite' });
        portalRoot().appendChild(toastEl);
    }
    // Only one toast at a time: hide the engine's if it is showing.
    const old = document.getElementById('toast');
    if (old)
        old.classList.remove('on');
    toastEl.textContent = message;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl && toastEl.classList.remove('on'), reduceMotion() ? ms + 400 : ms);
}
/* ---------- Empty / Error state ---------- */
export function EmptyState(o) {
    const art = icon(o.art || (o.error ? 'alert' : 'books'), 'v2-icon v2-art');
    return h('section', { class: 'v2-empty' + (o.error ? ' error' : ''), role: o.error ? 'alert' : null }, art, h('h2', { text: o.title }), h('p', { text: o.text }), o.actions && o.actions.length ? h('div', { class: 'v2-acts' }, ...o.actions) : null);
}
