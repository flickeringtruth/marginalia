/* App theme (chrome): dark by default, light on request. Separate from the reading-page themes
   (paper, sepia, …), which only colour the book page and the reader's own bars.
   The first paint is handled by a tiny script and a static <style> in index.html's <head>
   (it sets data-app-theme from localStorage before any CSS paints, so nothing flashes);
   this module only changes the theme afterwards and keeps <meta name="theme-color"> in step. */
const KEY = 'marginalia.appTheme';
const BAR = { dark: '#1f1e1d', light: '#faf9f5' }; // the --app-bg values
let readerColor = null, lastPut = '';
export function appTheme() {
    return document.documentElement.getAttribute('data-app-theme') === 'light' ? 'light' : 'dark';
}
const meta = () => document.querySelector('meta[name=theme-color]');
const screen = () => (window.__reader ? window.__reader.App.screen : 'library');
function put(color) { const m = meta(); if (m) {
    lastPut = color;
    m.setAttribute('content', color);
} }
/** Browser UI colour: the app background on app screens, the engine's (reading theme) colour in the book. */
export function syncThemeColor(where) {
    if (where === 'reader') {
        if (readerColor)
            put(readerColor);
        return;
    }
    put(BAR[appTheme()]);
}
export function setAppTheme(t) {
    document.documentElement.setAttribute('data-app-theme', t);
    try {
        localStorage.setItem(KEY, t);
    }
    catch { /* private mode: lasts for this visit */ }
    syncThemeColor(screen());
    document.dispatchEvent(new CustomEvent('v2:theme', { detail: t }));
}
export function mountTheme() {
    const m = meta();
    readerColor = m ? m.getAttribute('content') : null;
    // The engine writes the reading theme's colour here; remember it, and keep the app colour on app screens.
    if (m)
        new MutationObserver(() => {
            const c = m.getAttribute('content');
            if (!c || c === lastPut)
                return;
            readerColor = c;
            if (screen() !== 'reader')
                put(BAR[appTheme()]);
        }).observe(m, { attributes: true, attributeFilter: ['content'] });
    syncThemeColor(screen());
    document.addEventListener('reader:screen', e => syncThemeColor(e.detail.screen));
}
