/* "Flux": a slow, subtle, flowing background for the library, Discover and Settings.
   Never used behind book text.
   - Simplex noise (vendor/simplex-noise, MIT) drawn to a tiny canvas (about 72 px wide) and stretched
     by CSS, so the cost is a few thousand noise samples per frame.
   - One shared loop for every instance: at most 30 fps, paused while the tab is hidden, while an
     instance is off screen (IntersectionObserver), and for a moment while the user scrolls.
   - prefers-reduced-motion: one still frame, no animation.
   - If canvas or the noise module is unavailable, the host gets a static CSS gradient instead.
   - Low contrast by construction: the tint never moves the background more than ~12% towards the accent.
   - On/off: localStorage "marginalia.flux" ("0" = off). On by default. */
import { addStyle, reduceMotion } from './dom.js';
const KEY = 'marginalia.flux';
const NOISE_URL = new URL('../../../vendor/simplex-noise/simplex-noise.js', import.meta.url).href;
const CSS = `
.v2-flux{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block;border-radius:inherit}
html[data-flux="off"] .v2-flux{display:none}
.v2-flux-static{background-image:radial-gradient(60% 50% at 18% 12%,color-mix(in srgb,var(--app-accent) 9%,transparent),transparent 70%),radial-gradient(55% 45% at 85% 88%,color-mix(in srgb,var(--app-accent) 6%,transparent),transparent 70%)}
html[data-flux="off"] .v2-flux-static{background-image:none}
`;
const instances = new Set();
let noise = null, noiseState = 'idle';
let raf = 0, last = 0, lastScroll = 0, colors = { bg: [31, 30, 29], tint: [217, 119, 87], k: 0.12 };
export function fluxEnabled() { try {
    return localStorage.getItem(KEY) !== '0';
}
catch {
    return true;
} }
export function setFluxEnabled(on) {
    try {
        localStorage.setItem(KEY, on ? '1' : '0');
    }
    catch { /* lasts for this visit */ }
    document.documentElement.setAttribute('data-flux', on ? 'on' : 'off');
    update();
}
const parse = (v, fallback) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
    return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : fallback;
};
function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const light = document.documentElement.getAttribute('data-app-theme') === 'light';
    colors = { bg: parse(cs.getPropertyValue('--app-bg'), [31, 30, 29]), tint: parse(cs.getPropertyValue('--app-accent'), [217, 119, 87]), k: light ? 0.1 : 0.12 };
}
function size(inst) {
    const r = inst.host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2)
        return;
    const w = Math.max(32, Math.min(72, Math.round(r.width / 14))), h = Math.max(24, Math.round(w * r.height / r.width));
    if (inst.canvas.width === w && inst.canvas.height === h)
        return;
    inst.canvas.width = w;
    inst.canvas.height = h;
    inst.img = inst.ctx.createImageData(w, h);
    draw(inst, performance.now());
}
function draw(inst, now) {
    if (!noise)
        return;
    const { width: w, height: h } = inst.img, d = inst.img.data, t = reduceMotion() ? 0 : now * 0.00005;
    const { bg, tint, k } = colors;
    let i = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++, i += 4) {
            const nx = x * 0.05, ny = y * 0.05;
            const v = 0.62 * noise(nx, ny, t) + 0.38 * noise(nx * 2.1 + 7.3, ny * 2.1 + 3.1, t * 1.7); // −1 … 1
            const m = Math.pow(v * 0.5 + 0.5, 1.7) * k;
            d[i] = bg[0] + (tint[0] - bg[0]) * m;
            d[i + 1] = bg[1] + (tint[1] - bg[1]) * m;
            d[i + 2] = bg[2] + (tint[2] - bg[2]) * m;
            d[i + 3] = 255;
        }
    }
    inst.ctx.putImageData(inst.img, 0, 0);
}
function frame(now) {
    raf = 0;
    if (!shouldAnimate())
        return;
    raf = requestAnimationFrame(frame);
    if (now - last < 33 || now - lastScroll < 180)
        return; // 30 fps cap; sit still while scrolling
    last = now;
    for (const inst of instances)
        if (inst.visible)
            draw(inst, now);
}
const anyVisible = () => { for (const i of instances)
    if (i.visible)
        return true; return false; };
const shouldAnimate = () => fluxEnabled() && noiseState === 'ready' && !document.hidden && !reduceMotion() && anyVisible();
/** Starts or stops the loop and paints still frames where animation is off. */
function update() {
    if (shouldAnimate()) {
        if (!raf)
            raf = requestAnimationFrame(frame);
        return;
    }
    if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
    }
    if (fluxEnabled() && noiseState === 'ready' && !document.hidden)
        for (const inst of instances)
            if (inst.visible)
                draw(inst, 0);
}
function loadNoise() {
    if (noiseState !== 'idle')
        return;
    noiseState = 'loading';
    import(/* @vite-ignore */ NOISE_URL).then((m) => {
        let s = 20240611;
        const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; // fixed seed: same look every visit
        noise = m.createNoise3D(rnd);
        noiseState = 'ready';
        readColors();
        instances.forEach(i => size(i));
        update();
    }).catch(() => { noiseState = 'failed'; instances.forEach(i => fallback(i)); });
}
function fallback(inst) { inst.canvas.remove(); inst.host.classList.add('v2-flux-static'); }
let globals = false;
function installGlobals() {
    if (globals)
        return;
    globals = true;
    document.documentElement.setAttribute('data-flux', fluxEnabled() ? 'on' : 'off');
    document.addEventListener('visibilitychange', update);
    document.addEventListener('scroll', () => { lastScroll = performance.now(); }, { capture: true, passive: true });
    document.addEventListener('v2:theme', () => { readColors(); update(); });
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', update);
}
/** Puts a flux canvas behind everything in `host` (a positioned element). Returns a function that removes it. */
export function attachFlux(host) {
    addStyle('v2-flux', CSS);
    installGlobals();
    const canvas = document.createElement('canvas');
    canvas.className = 'v2-flux';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
        host.classList.add('v2-flux-static');
        return () => host.classList.remove('v2-flux-static');
    }
    canvas.width = 48;
    canvas.height = 27;
    host.prepend(canvas);
    const inst = { host, canvas, ctx, img: ctx.createImageData(48, 27), visible: false, ro: null, io: null };
    instances.add(inst);
    if (noiseState === 'failed')
        fallback(inst);
    inst.io = new IntersectionObserver(es => { inst.visible = es[es.length - 1].isIntersecting; if (inst.visible) {
        size(inst);
    } update(); });
    inst.io.observe(canvas);
    // Resize work runs in the next frame, outside the observer callback (WebKit reports "ResizeObserver loop completed with undelivered notifications" otherwise).
    let sizing = 0;
    inst.ro = new ResizeObserver(() => { if (!sizing)
        sizing = requestAnimationFrame(() => { sizing = 0; size(inst); }); });
    inst.ro.observe(host);
    loadNoise();
    return () => { inst.io?.disconnect(); inst.ro?.disconnect(); instances.delete(inst); canvas.remove(); update(); };
}
