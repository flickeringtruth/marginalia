/* One SVG icon set for v2: a single sprite of <symbol>s, used with <svg><use href="#v2i-name">.
   Original drawings on a 24-unit grid, stroked with currentColor (same style as the engine's icons).
   No text characters (×, ☰, ⚙, ⋯, ★) are used as controls. */

const PATHS: Record<string, string> = {
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
  books: '<path d="M18 20h24a8 8 0 0 1 8 8v52a6 6 0 0 0-6-6H18z"/><path d="M78 20H54a8 8 0 0 0-8 8v52a6 6 0 0 1 6-6h26z"/>',
  /* reader (session 3) */
  'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
  contents: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
  bookmark: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16" y="14" width="4.5" height="6.5" rx="1.5"/>',
  dictionary: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h13v14h-13a2 2 0 0 0-2 2z"/><path d="M4.5 19.5a2 2 0 0 0 2 2h13v-4"/><path d="M9.5 13l2.5-6 2.5 6M10.4 11h3.2"/>',
  type: '<path d="M3.5 18l4.5-12 4.5 12M5.2 13.5h5.6"/><path d="M14.5 18v-6.5M14.5 14.2a2.8 2.8 0 1 1 5.6 0v.3a2.8 2.8 0 1 1-5.6 0"/><path d="M20.1 11.5V18"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  'back-5': '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/><path d="M13.6 9.2h-2.6l-.4 2.8c.4-.3.9-.4 1.4-.4a1.8 1.8 0 1 1-1.6 2.6"/>',
  'forward-5': '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/><path d="M13.6 9.2h-2.6l-.4 2.8c.4-.3.9-.4 1.4-.4a1.8 1.8 0 1 1-1.6 2.6"/>',
  'para-prev': '<path d="M6 5v14"/><path d="M18 6l-8 6 8 6z"/>',
  'para-next': '<path d="M18 5v14"/><path d="M6 6l8 6-8 6z"/>',
  minus: '<path d="M5 12h14"/>',
  moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
  lines: '<path d="M4 7h16M4 12h11M4 17h14"/>',
  'text-smaller': '<path d="M4 17l3.5-9 3.5 9M5.3 13.6h4.4"/><path d="M14 12h6"/>',
  'text-larger': '<path d="M4 17l3.5-9 3.5 9M5.3 13.6h4.4"/><path d="M14 12h6M17 9v6"/>',
  note: '<path d="M4.5 5.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H11l-4.5 4v-4h0a2 2 0 0 1-2-2z"/><path d="M8.5 8.5h7M8.5 12h4.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  share: '<path d="M12 15V4M8 7.5L12 4l4 3.5"/><path d="M8 11H6.5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H16"/>',
  sparkle: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>',
  speaker: '<path d="M4.5 9.5h3.5l4.5-4v13l-4.5-4H4.5z"/><path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.5 5.5l1.6 1.6M16.9 16.9l1.6 1.6M5.5 18.5l1.6-1.6M16.9 7.1l1.6-1.6"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  wave: '<path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M3 7c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
  scroll: '<path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"/>',
  zap: '<path d="M4 12h16M13 5l7 7-7 7"/><path d="M4 7h5M4 17h5"/>',
  file: '<path d="M7 3h7l4 4v4"/><path d="M7 3v18h5"/><path d="M15 15h6M18 12l3 3-3 3"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 2-.9 2-1.9 0-.6-.3-1-.6-1.4-.3-.4-.6-.8-.6-1.4 0-1 .9-1.8 2-1.8h2.1a3.6 3.6 0 0 0 3.6-3.6c0-3.8-3.8-6.9-8.5-6.9z"/><circle cx="7.5" cy="11.5" r="1.2"/><circle cx="10" cy="7.5" r="1.2"/><circle cx="14.5" cy="7.5" r="1.2"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6M20 16v-9" stroke-width="2.2"/>',
  location: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'
};
const VIEWBOX: Record<string, string> = { books: '0 0 96 96' };

export type IconName = keyof typeof PATHS;

function ensureSprite(): void {
  if (document.getElementById('v2-icons')) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.id = 'v2-icons';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = Object.entries(PATHS)
    .map(([name, d]) => `<symbol id="v2i-${name}" viewBox="${VIEWBOX[name] || '0 0 24 24'}">${d}</symbol>`).join('');
  document.body.appendChild(svg);
}

/** Returns a decorative icon (aria-hidden). Put the accessible name on the control, not the icon. */
export function icon(name: IconName, cls = 'v2-icon'): SVGSVGElement {
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
