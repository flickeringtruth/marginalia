/* App theme (chrome): dark by default, light on request. Separate from the reading-page themes
   (paper, sepia, …), which only colour the book page and the reader's own bars.
   The first paint is handled by a tiny script and a static <style> in index.html's <head>
   (it sets data-app-theme from localStorage before any CSS paints, so nothing flashes);
   this module only changes the theme afterwards and keeps <meta name="theme-color"> in step. */

export type AppTheme = 'dark' | 'light' | 'page';   // 'page' = match the reading page theme
const KEY = 'marginalia.appTheme';
const BAR: Record<'dark' | 'light', string> = { dark: '#1f1e1d', light: '#faf9f5' };   // the --app-bg values
let readerColor: string | null = null, lastPut = '';

export function appTheme(): AppTheme {
  const t = document.documentElement.getAttribute('data-app-theme');
  return t === 'light' || t === 'page' ? t : 'dark';
}

const meta = (): HTMLMetaElement | null => document.querySelector<HTMLMetaElement>('meta[name=theme-color]');
const screen = (): string => (window.__reader ? window.__reader.App.screen : 'library');
function put(color: string): void { const m = meta(); if (m) { lastPut = color; m.setAttribute('content', color); } }

/** Browser UI colour: the app background on app screens, the engine's (reading theme) colour in the book. */
export function syncThemeColor(where: string): void {
  const t = appTheme();
  if (where === 'reader' || t === 'page') { if (readerColor) put(readerColor); return; }
  put(BAR[t]);
}

/* ---- "Match page": concrete colours, computed here ----
   The engine writes the reading theme as --bg, --fg and --sheet on <html>. Instead of deriving the app palette with
   var() + color-mix() in CSS (which Safari can leave stale when the source variables change), the palette is computed
   here as plain rgb() values and written inline, and text colours are nudged until they pass WCAG AA (4.5:1). */
type RGB = [number, number, number];
const PAGE_PROPS = ['--app-bg', '--app-surface', '--app-raised', '--app-border', '--app-text', '--app-muted', '--app-accent-text', '--app-danger', '--app-ok'];
let pageKey = '';
function parseColor(v: string, fallback: RGB): RGB {
  const s = v.trim(), hex = /^#([0-9a-f]{6})$/i.exec(s);
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)) as RGB;
  const m = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : fallback;
}
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const lum = (c: RGB): number => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a: RGB, b: RGB): number => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const css = (c: RGB): string => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
/** Moves `from` towards `to` until it reads at 4.5:1 or better on every background. */
function readable(from: RGB, to: RGB, backs: RGB[]): RGB {
  for (let t = 0; t <= 1.001; t += 0.04) { const c = mix(from, to, t); if (backs.every(b => ratio(c, b) >= 4.6)) return c; }
  return to;
}

export function applyPageTokens(): void {
  const root = document.documentElement;
  if (appTheme() !== 'page') { if (pageKey) { PAGE_PROPS.forEach(p => root.style.removeProperty(p)); pageKey = ''; } return; }
  const cs = getComputedStyle(root);
  const bg = parseColor(cs.getPropertyValue('--bg'), [255, 255, 255]), fg = parseColor(cs.getPropertyValue('--fg'), [29, 29, 31]);
  const sheet = parseColor(cs.getPropertyValue('--sheet'), bg);
  const key = [bg, fg, sheet].join('|');
  if (key === pageKey) return;
  pageKey = key;
  const raised = mix(sheet, fg, 0.05), backs = [bg, sheet, raised];
  const set = (k: string, c: RGB) => root.style.setProperty(k, css(c));
  set('--app-bg', bg); set('--app-surface', sheet); set('--app-raised', raised); set('--app-border', mix(bg, fg, 0.18)); set('--app-text', fg);
  set('--app-muted', readable(mix(bg, fg, 0.55), fg, backs));
  set('--app-accent-text', fg);
  set('--app-danger', readable([229, 55, 43], fg, backs));
  set('--app-ok', fg);
}

export function setAppTheme(t: AppTheme): void {
  document.documentElement.setAttribute('data-app-theme', t);
  applyPageTokens();
  try { localStorage.setItem(KEY, t); } catch { /* private mode: lasts for this visit */ }
  syncThemeColor(screen());
  document.dispatchEvent(new CustomEvent('v2:theme', { detail: t }));
}

export function mountTheme(): void {
  const m = meta();
  readerColor = m ? m.getAttribute('content') : null;
  // The engine writes the reading theme's colour here; remember it, and keep the app colour on app screens.
  if (m) new MutationObserver(() => {
    const c = m.getAttribute('content');
    if (!c || c === lastPut) return;
    readerColor = c;
    const t = appTheme();
    if (screen() !== 'reader' && t !== 'page') put(BAR[t]);
  }).observe(m, { attributes: true, attributeFilter: ['content'] });
  // "Match page": the engine rewrites --bg, --fg… on <html> when the reading theme changes. Tell the flux canvas (it caches colours).
  let pending = 0;
  new MutationObserver(() => {
    if (appTheme() !== 'page' || pending) return;
    pending = requestAnimationFrame(() => { pending = 0; applyPageTokens(); document.dispatchEvent(new CustomEvent('v2:theme', { detail: 'page' })); });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  applyPageTokens();
  syncThemeColor(screen());
  document.addEventListener('reader:screen', e => syncThemeColor(e.detail.screen));
}
