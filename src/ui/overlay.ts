/* One overlay manager for v2: every sheet and menu goes through this stack.
   - Rendered into one portal root, a direct child of <body>. Nothing above it has a transform or
     filter, so position:fixed panels are relative to the viewport (see docs/ui-audit.md §2).
   - The portal root itself is unpositioned, so it is not a stacking context: panels take their
     z-index straight from the scale (sheet / menu) plus their place in the stack.
   - Focus is trapped in the top layer and returned on close. Escape and the backdrop close it.
   - Modal layers add a history entry, so the browser/phone Back gesture closes them first. */

import { h, FOCUSABLE, reduceMotion } from './dom.js';

export type LayerKind = 'sheet' | 'menu';
export interface LayerOptions {
  kind: LayerKind;
  modal?: boolean;                      // dims and blocks the page (sheets). Menus are not modal.
  onClose?: () => void;
  initialFocus?: HTMLElement | null;
  returnFocus?: HTMLElement | null;     // where focus goes on close (default: whatever had focus at open)
  animateIn?: (panel: HTMLElement) => Animation | null;
  animateOut?: (panel: HTMLElement) => Animation | null;
}
interface Layer extends Omit<LayerOptions, 'returnFocus'> {
  panel: HTMLElement;
  backdrop: HTMLElement | null;
  returnFocus: Element | null;
  pushed: boolean;
  closing: boolean;
}

const stack: Layer[] = [];
let portal: HTMLElement | null = null;
let ignorePop = 0;
let appRoots: () => HTMLElement[] = () => [];

export function portalRoot(): HTMLElement {
  if (!portal) {
    portal = h('div', { id: 'v2-portal' });
    document.body.appendChild(portal);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('popstate', onPop);
  }
  return portal;
}

/** Elements made inert while a modal layer is open (the app screens behind it). */
export function setAppRoots(fn: () => HTMLElement[]): void { appRoots = fn; }

/* Each layer takes two steps on the scale: its backdrop (even) and its panel (odd). */
function zFor(kind: LayerKind, depth: number, under = false): string {
  return `calc(var(${kind === 'menu' ? '--z-menu' : '--z-sheet'}) + ${depth * 2 + (under ? 0 : 1)})`;
}
function updateInert(): void {
  const modal = stack.some(l => l.modal && !l.closing);
  for (const el of appRoots()) {
    if (modal) el.setAttribute('inert', ''); else el.removeAttribute('inert');
  }
}

export function openLayer(panel: HTMLElement, opts: LayerOptions): () => void {
  const root = portalRoot();
  const layer: Layer = { ...opts, panel, backdrop: null, returnFocus: opts.returnFocus || document.activeElement, pushed: false, closing: false };
  const depth = stack.length;
  if (opts.modal) {
    const backdrop = h('div', { class: 'v2-backdrop', 'aria-hidden': 'true' });
    backdrop.style.zIndex = zFor(opts.kind, depth, true);
    backdrop.addEventListener('click', () => closeLayer(layer));
    root.appendChild(backdrop);
    layer.backdrop = backdrop;
    if (!reduceMotion()) backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
  } else {
    // Non-modal (menus): an outside tap closes it without reaching what is underneath.
    const catcher = h('div', { class: 'v2-catcher', 'aria-hidden': 'true' });
    catcher.style.zIndex = zFor(opts.kind, depth, true);
    catcher.addEventListener('pointerdown', e => { e.preventDefault(); closeLayer(layer); });
    root.appendChild(catcher);
    layer.backdrop = catcher;
  }
  panel.style.zIndex = zFor(opts.kind, depth);
  root.appendChild(panel);
  // A reused panel (e.g. Discover) may still carry the fill of its last fade-out. getAnimations()
  // only sees it while the panel is in the document, so this runs after appending.
  panel.getAnimations().forEach(a => a.cancel());
  stack.push(layer);
  updateInert();
  if (opts.modal) {
    try { history.pushState({ v2Layer: stack.length }, ''); layer.pushed = true; } catch { /* sandboxed */ }
  }
  if (!reduceMotion() && opts.animateIn) opts.animateIn(panel);
  const target = opts.initialFocus || panel.querySelector<HTMLElement>('[autofocus]') || panel.querySelector<HTMLElement>(FOCUSABLE) || panel;
  if (target === panel && !panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
  requestAnimationFrame(() => { try { target.focus({ preventScroll: true }); } catch { /* ignore */ } });
  return () => closeLayer(layer);
}

function closeLayer(layer: Layer, fromHistory = false): void {
  if (layer.closing) return;
  // Close anything opened on top of it first.
  const idx = stack.indexOf(layer);
  if (idx < 0) return;
  for (let i = stack.length - 1; i > idx; i--) closeLayer(stack[i], fromHistory);
  layer.closing = true;
  stack.splice(stack.indexOf(layer), 1);
  updateInert();
  const finish = () => {
    if (layer.backdrop) layer.backdrop.remove();
    if (stack.some(l => l.panel === layer.panel)) return;   // the same panel was opened again meanwhile
    layer.panel.getAnimations().forEach(a => a.cancel());
    layer.panel.remove();
  };
  const anim = !reduceMotion() && layer.animateOut ? layer.animateOut(layer.panel) : null;
  if (layer.backdrop && layer.modal && !reduceMotion()) layer.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
  if (anim) anim.finished.then(finish, finish); else finish();
  if (layer.pushed && !fromHistory) { ignorePop++; history.back(); }
  const back = layer.returnFocus as HTMLElement | null;
  if (back && typeof back.focus === 'function' && document.contains(back)) { try { back.focus({ preventScroll: true }); } catch { /* ignore */ } }
  if (layer.onClose) layer.onClose();
}

export function closeTop(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  closeLayer(top);
  return true;
}
export function layerCount(): number { return stack.length; }

function onPop(): void {
  if (ignorePop > 0) { ignorePop--; return; }
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].pushed) { closeLayer(stack[i], true); return; }
  }
}

function onKey(e: KeyboardEvent): void {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') {
    e.preventDefault(); e.stopPropagation();
    closeLayer(top);
    return;
  }
  if (e.key === 'Tab') {
    const items = Array.from(top.panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) { e.preventDefault(); top.panel.focus(); return; }
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (!top.panel.contains(active)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }
}
