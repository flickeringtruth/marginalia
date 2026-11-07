/* Small DOM helpers shared by the v2 UI. */
/** Creates an element. Attributes: `class`, `text`, `html`, `on<event>` handlers, booleans, anything else as an attribute. */
export function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false)
            continue;
        if (k === 'class')
            el.className = String(v);
        else if (k === 'text')
            el.textContent = String(v);
        else if (k === 'html')
            el.innerHTML = String(v);
        else if (k.startsWith('on') && typeof v === 'function')
            el.addEventListener(k.slice(2), v);
        else if (v === true)
            el.setAttribute(k, '');
        else
            el.setAttribute(k, String(v));
    }
    append(el, children);
    return el;
}
export function append(parent, children) {
    for (const c of children.flat()) {
        if (c == null || c === false)
            continue;
        parent.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
}
export function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function addStyle(name, css) {
    const id = name + '-css'; // suffix keeps style ids apart from element ids such as #v2-library
    if (document.getElementById(id))
        return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
}
export function reduceMotion() {
    return typeof window.matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
/** The engine API. v2 code only talks to the engine through this. */
export function reader() {
    const r = window.__reader;
    if (!r)
        throw new Error('The reader engine is not ready');
    return r;
}
let uid = 0;
export function nextId(prefix) { return prefix + '-' + (++uid); }
export function readJSON(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
    }
    catch {
        return fallback;
    }
}
export function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch { /* storage full or blocked */ }
}
export const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
