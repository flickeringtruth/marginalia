/* Time left and "Go to page" (v2 only).
   Pages: the engine has no fixed page numbers for reflowable books. globalPages() measures how many
   characters fit on a page at the current font, size, margins and screen, and divides the book by
   that. So pages are labelled "at current settings" and change when settings change. A percentage
   is also accepted. PDFs have real pages. Jumps wait until a page-turn animation (3D curl) has
   finished, because the renderer ignores goTo() while it is busy. */
import { h, reader } from '../dom.js';
import { Button, Field, Sheet } from '../components.js';
import { where, fmtDuration } from './position.js';
import { speedCpm, CHARS_PER_WORD } from './stats.js';
/* Minutes left in the chapter and the book, from read-aloud speed while it plays, else reading speed. */
export function timeLeft() {
    const w = where();
    if (!w)
        return null;
    const R = reader(), listening = R.audioInfo().state === 'playing';
    let cpm, basis;
    if (listening) {
        cpm = Math.max(1, R.ttsCharsPerSec() * 60);
        basis = 'listening';
    }
    else {
        const s = speedCpm();
        cpm = s.cpm;
        basis = s.measured ? 'reading' : 'default';
    }
    return { chapter: (w.chLen - w.off) / cpm, book: (w.total - w.pos) / cpm, basis, wpm: Math.round(cpm / CHARS_PER_WORD) };
}
/* The engine re-estimates characters per page from whichever chapter is on screen, so its page
   count drifts as you move through the book (and is far off on title pages). v2 keeps page numbers
   stable: it starts from a settings-based estimate, calibrates once on the first real chapter
   (3+ pages, 8,000+ characters), and keeps that until text size, font, spacing, margins, layout,
   screen size or the book changes. */
const frozen = new Map();
function settingsKey() {
    const R = reader(), S = R.S;
    return [R.App.book?.id, S.fontSize, S.font, S.lineHeight, S.margin, S.align, S.layout, S.spread, innerWidth, innerHeight].join('|');
}
/* Same estimate the engine falls back to (globalPages in index.html): characters per line × lines per page. */
function formulaCpp() {
    const S = reader().S, fs = Number(S.fontSize) || 19, margin = Number(S.margin) || 24, lh = Number(S.lineHeight) || 1.5;
    const w = Math.min(innerWidth - 2 * margin, fs * 36), h = innerHeight - 140;
    return Math.max(200, (w / (fs * 0.5)) * (h / (fs * lh)) * 0.92);
}
export function pageInfo() {
    const R = reader(), r = R.App.r, b = R.App.book;
    if (!r || !b || !r.getLoc)
        return null;
    let loc, info;
    try {
        loc = r.getLoc();
        info = r.info ? r.info() : null;
    }
    catch {
        return null;
    }
    if (info && info.pdf)
        return { page: info.page, total: info.pages, pdf: true, cpp: 0 };
    const w = where();
    if (!w || !b.total) {
        const gp = R.globalPages(loc, info);
        return gp ? { page: gp.page, total: gp.total, pdf: false, cpp: 0 } : null;
    }
    const key = settingsKey();
    let cpp = frozen.get(key);
    if (!cpp) {
        const len = b.lengths?.[w.ch] || 0;
        if (info && info.pages >= 3 && len >= 8000) {
            // Calibrate once from a real chapter at these settings (its last page is on average half full).
            cpp = len / (info.pages - 0.5);
            frozen.set(key, cpp);
        }
        else
            cpp = formulaCpp(); // stable estimate until a real chapter has been measured
    }
    const total = Math.max(1, Math.round(b.total / cpp));
    // The rendered page starts at w.pos; counting from half a page in absorbs small differences
    // between the engine's page breaks and the even page grid.
    const page = Math.min(total, Math.max(1, Math.floor((w.pos + cpp * 0.5) / cpp) + 1));
    return { page, total, pdf: false, cpp };
}
/* Short bottom-bar label: "Page 12 of 340 · 4% · 9 min left in chapter". */
export function barLabel() {
    const R = reader(), p = R.App.progress, pi = pageInfo();
    if (!p)
        return null;
    const narrow = window.innerWidth < 440; // phones: "Page 10/25 · 35% · 1 min left" fits on one line, the long form wraps to two
    const parts = [pi ? (narrow ? 'Page ' + pi.page.toLocaleString() + '/' + pi.total.toLocaleString() : 'Page ' + pi.page.toLocaleString() + ' of ' + pi.total.toLocaleString()) : '', Math.round(p.pct * 100) + '%'];
    const t = timeLeft();
    if (t)
        parts.push(fmtDuration(t.chapter) + (narrow ? ' left' : ' left in chapter'));
    return parts.filter(Boolean).join(' · ');
}
async function waitIdle() {
    const r = reader().App.r;
    for (let i = 0; i < 60 && r && r.busy; i++)
        await new Promise(res => setTimeout(res, 50));
}
export function openGoTo() {
    const R = reader(), pi = pageInfo(), t = timeLeft();
    if (!pi) {
        R.toast('Page numbers aren’t ready yet. Try again in a moment.');
        return;
    }
    const field = Field({ label: pi.pdf ? 'Page (1–' + pi.total + ') or percentage' : 'Page (1–' + pi.total.toLocaleString() + ') or percentage, like 40%', placeholder: pi.pdf ? 'Page' : 'e.g. 120 or 40%' });
    field.input.inputMode = 'text';
    field.input.setAttribute('enterkeyhint', 'go');
    const err = h('p', { class: 'v2-hint', role: 'alert', style: 'color:var(--v2-danger)' });
    const go = async () => {
        const raw = field.input.value.trim().replace(/\s+/g, '');
        let pct = null, page = null;
        const m = raw.match(/^(\d+(?:[.,]\d+)?)%$/);
        if (m) {
            const v = parseFloat(m[1].replace(',', '.'));
            if (v >= 0 && v <= 100)
                pct = v / 100;
        }
        else if (/^\d+$/.test(raw)) {
            const v = parseInt(raw, 10);
            if (v >= 1 && v <= pi.total)
                page = v;
        }
        if (pct == null && page == null) {
            err.textContent = 'Enter a page from 1 to ' + pi.total.toLocaleString() + ', or a percentage from 0% to 100%.';
            field.input.setAttribute('aria-invalid', 'true');
            field.input.focus();
            return;
        }
        s.close();
        await waitIdle();
        if (pi.pdf && page != null) {
            await R.App.goTo({ ch: page - 1, off: -1, frac: 0 });
            return;
        }
        if (page == null) {
            await R.goToPercent(pct);
            return;
        }
        // Page N covers characters (N-1)·cpp … N·cpp; aim a little inside it so the page shown is N.
        const total = R.App.book?.total || 1, calibrated = frozen.has(settingsKey());
        const jump = (cpp) => R.goToPercent(Math.min(1, ((page - 1) * cpp + cpp * 0.6) / total));
        await jump(pi.cpp);
        if (!calibrated) {
            // The first real chapter calibrates the page size; if that just happened, jump once more with it.
            await waitIdle();
            const now = pageInfo();
            if (now && frozen.has(settingsKey()) && Math.abs(now.page - page) > 1)
                await jump(now.cpp);
        }
    };
    field.input.addEventListener('keydown', e => { if (e.key === 'Enter') {
        e.preventDefault();
        void go();
    } });
    field.input.addEventListener('input', () => { err.textContent = ''; field.input.removeAttribute('aria-invalid'); });
    const basis = !t ? '' : t.basis === 'listening' ? 'Based on the read-aloud speed.' : t.basis === 'reading' ? 'Based on your reading speed (≈ ' + t.wpm + ' words per minute).' : 'Based on an average speed of 250 words per minute until you have read a little longer.';
    const s = Sheet({
        title: 'Go to page',
        content: [
            h('p', { class: 'v2-sum', style: 'margin:0;font:600 var(--v2-t-md)/1.3 var(--v2-sans)', text: 'Page ' + pi.page.toLocaleString() + ' of ' + pi.total.toLocaleString() + (pi.pdf ? '' : ' at current settings') }),
            pi.pdf ? null : h('p', { class: 'v2-hint', text: 'Page numbers depend on text size, margins and screen size, so they change when those change.' }),
            t ? h('p', { class: 'v2-hint', style: 'color:var(--v2-fg)', text: fmtDuration(t.chapter) + ' left in this chapter · ' + fmtDuration(t.book) + ' left in the book' }) : null,
            t ? h('p', { class: 'v2-hint', text: basis }) : null,
            field.el, err
        ].filter((x) => !!x),
        footer: [Button({ label: 'Cancel', onClick: () => s.close() }), Button({ label: 'Go', variant: 'primary', onClick: () => void go() })]
    });
}
