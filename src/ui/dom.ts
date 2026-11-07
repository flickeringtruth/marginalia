/* Small DOM helpers shared by the v2 UI. */

export type Child = Node | string | number | null | undefined | false;
type AttrValue = string | number | boolean | null | undefined | ((e: Event) => void);

/** Creates an element. Attributes: `class`, `text`, `html`, `on<event>` handlers, booleans, anything else as an attribute. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, AttrValue> = {}, ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

export function append(parent: Node, children: (Child | Child[])[]): void {
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    parent.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function addStyle(name: string, css: string): void {
  const id = name + '-css';   // suffix keeps style ids apart from element ids such as #v2-library
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id; s.textContent = css;
  document.head.appendChild(s);
}

export function reduceMotion(): boolean {
  return typeof window.matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The engine API. v2 code only talks to the engine through this. */
export function reader(): ReaderApi {
  const r = window.__reader;
  if (!r) throw new Error('The reader engine is not ready');
  return r;
}

let uid = 0;
export function nextId(prefix: string): string { return prefix + '-' + (++uid); }

export function readJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v == null ? fallback : (JSON.parse(v) as T); } catch { return fallback; }
}
export function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
