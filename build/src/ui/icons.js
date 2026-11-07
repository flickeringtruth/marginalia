/* One SVG icon set for v2: a single sprite of <symbol>s, used with <svg><use href="#v2i-name">.
   Original drawings on a 24-unit grid, stroked with currentColor (same style as the engine's icons).
   No text characters (×, ☰, ⚙, ⋯, ★) are used as controls. */
const PATHS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    more: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    'chevron-right': '<path d="M9 6l6 6-6 6"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    edit: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    star: '<path d="M12 3.5l2.6 5.5 5.9.6-4.5 4 1.3 5.9L12 16.5l-5.3 3 1.3-5.9-4.5-4 5.9-.6z"/>',
    'star-fill': '<path d="M12 3.5l2.6 5.5 5.9.6-4.5 4 1.3 5.9L12 16.5l-5.3 3 1.3-5.9-4.5-4 5.9-.6z" fill="currentColor"/>',
    tag: '<path d="M3.5 12.5v-8a1 1 0 0 1 1-1h8l8 8-9 9z"/><circle cx="8" cy="8" r="1.4"/>',
    book: '<path d="M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h9.5"/>',
    upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 15v4h14v-4"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.7 5.4 3.7 8.5s-1.2 5.9-3.7 8.5c-2.5-2.6-3.7-5.4-3.7-8.5s1.2-5.9 3.7-8.5z"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8.5"/>',
    alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.3v.2"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5"/>',
    shelf: '<path d="M4 4.5v15M9 4.5v15M4 19.5h16M13 6l4 13"/>',
    books: '<path d="M18 20h24a8 8 0 0 1 8 8v52a6 6 0 0 0-6-6H18z"/><path d="M78 20H54a8 8 0 0 0-8 8v52a6 6 0 0 1 6-6h26z"/>'
};
const VIEWBOX = { books: '0 0 96 96' };
function ensureSprite() {
    if (document.getElementById('v2-icons'))
        return;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.id = 'v2-icons';
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = Object.entries(PATHS)
        .map(([name, d]) => `<symbol id="v2i-${name}" viewBox="${VIEWBOX[name] || '0 0 24 24'}">${d}</symbol>`).join('');
    document.body.appendChild(svg);
}
/** Returns a decorative icon (aria-hidden). Put the accessible name on the control, not the icon. */
export function icon(name, cls = 'v2-icon') {
    ensureSprite();
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', cls);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('viewBox', VIEWBOX[name] || '0 0 24 24');
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#v2i-' + name);
    svg.appendChild(use);
    return svg;
}
