/* v2 read-aloud player: a mini player docked above the bottom bar, and a full player sheet.
   Replaces the engine's .ab-full / #abMini / #abChip. All actions call the engine's TTS, so
   playback logic (Edge, device voices, downloads, sleep timer) is exactly the session-1 code.
   The engine's read-along view (#abLyrics) is kept and opened from here. */
import { h, addStyle, reader } from '../dom.js';
import { icon } from '../icons.js';
import { Button, IconButton, Sheet, Menu, rangeFill } from '../components.js';
const CSS = `
#v2-reader .mini-slot{position:absolute;left:0;right:0;bottom:calc(var(--sab) + var(--v2-bot-h));height:var(--v2-mini-h);display:flex;align-items:center;justify-content:center;
  padding:0 calc(var(--sar) + 8px) 0 calc(var(--sal) + 8px);box-sizing:border-box;pointer-events:none}
body.immersive #v2-reader .mini-slot{bottom:calc(var(--sab) + 40px)}
#v2-reader .mini{display:flex;align-items:center;gap:4px;width:100%;max-width:560px;height:52px;box-sizing:border-box;padding:0 4px;border-radius:26px;pointer-events:auto;
  background:var(--v2-sheet);box-shadow:var(--v2-shadow-1),inset 0 0 0 1px var(--v2-line)}
#v2-reader .mini[hidden]{display:none}
#v2-reader .mini .mid{flex:1;min-width:0;height:44px;display:flex;flex-direction:column;justify-content:center;gap:5px;padding:0 6px;border:0;background:none;color:var(--v2-fg);text-align:left;cursor:pointer;border-radius:22px}
#v2-reader .mini .mid b{font:600 var(--v2-t-sm)/1.2 var(--v2-sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#v2-reader .mini .pbar{display:block;height:3px;border-radius:2px;background:var(--v2-line);overflow:hidden}
#v2-reader .mini .pbar i{display:block;height:100%;background:var(--v2-accent)}
#v2-reader .mini .time{flex:none;font:500 var(--v2-t-xs)/1 var(--v2-sans);color:var(--v2-muted);font-variant-numeric:tabular-nums;padding-right:4px}
#v2-reader .mini .away{flex:1;min-width:0;display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:none}
#v2-reader .mini .away .v2-btn{min-height:40px;padding:0 12px;font-size:var(--v2-t-sm)}
.v2-player .who{display:flex;gap:var(--v2-s3);align-items:center;margin-bottom:var(--v2-s3)}
.v2-player .who b{display:block;font:400 22px/1.15 var(--v2-serif)}
.v2-player .who span{display:block;margin-top:2px;font:400 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted)}
.v2-player .snippet{margin:0 0 var(--v2-s3);font:400 15px/1.45 var(--v2-serif);color:var(--v2-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.9em}
.v2-player .seek{display:grid;grid-template-columns:auto 1fr auto;gap:var(--v2-s2);align-items:center;font:500 var(--v2-t-xs)/1 var(--v2-sans);color:var(--v2-muted);font-variant-numeric:tabular-nums}
.v2-player .seek input{width:100%;min-height:var(--v2-tap);accent-color:var(--v2-accent)}
.v2-player .transport{display:flex;align-items:center;justify-content:center;gap:var(--v2-s2);margin:var(--v2-s2) 0 var(--v2-s4)}
.v2-player .transport .play{width:64px;height:64px;border-radius:32px;background:var(--v2-accent);color:#fff}
.v2-player .transport .play .v2-icon{width:28px;height:28px}
.v2-player .rate{display:flex;align-items:center;justify-content:center;gap:var(--v2-s2);margin-bottom:var(--v2-s4)}
.v2-player .rate output{min-width:56px;text-align:center;font:600 var(--v2-t-md)/1 var(--v2-sans);font-variant-numeric:tabular-nums}
.v2-player .quick{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:var(--v2-s2)}
.v2-player .quick .v2-btn{justify-content:flex-start}
.v2-player .quick .v2-btn small{margin-left:auto;font-weight:500;color:var(--v2-muted);overflow:hidden;text-overflow:ellipsis;max-width:90px}
.v2-player .sep{height:1px;background:var(--v2-line);margin:var(--v2-s4) 0}
`;
const R = () => reader();
let sheet = null;
let raf = 0;
export function mountPlayer(chrome, openAudioSettings) {
    addStyle('v2-player', CSS);
    const r = R();
    const play = IconButton({ label: 'Play', icon: 'play', onClick: () => r.TTS.toggle() });
    const title = h('b');
    const fill = h('i');
    const mid = h('button', { type: 'button', class: 'mid', 'aria-label': 'Open player' }, title, h('span', { class: 'pbar', 'aria-hidden': 'true' }, fill));
    mid.addEventListener('click', () => openPlayer(openAudioSettings));
    const time = h('span', { class: 'time', 'aria-hidden': 'true' });
    const lyrics = IconButton({ label: 'Read along', icon: 'lines', onClick: () => r.AudioUI.openLyrics() });
    const away = h('div', { class: 'away', hidden: true }, Button({ label: 'Read from here', icon: 'location', onClick: () => r.TTS.readHere() }), Button({ label: 'Go to voice', icon: 'headphones', onClick: () => r.TTS.goToAudio() }));
    const mini = h('div', { class: 'mini', role: 'group', 'aria-label': 'Read aloud', hidden: true }, play, mid, away, time, lyrics);
    chrome.miniSlot.appendChild(mini);
    const sync = () => {
        raf = 0;
        const a = r.audioInfo();
        mini.hidden = !a.active;
        chrome.setAudioOn(a.active);
        setPlay(play, a.state);
        title.textContent = a.chapter || a.title;
        fill.style.width = (a.pct * 100).toFixed(1) + '%';
        time.textContent = a.active ? '−' + a.remaining : '';
        away.hidden = !a.suspended;
        mid.hidden = a.suspended;
        time.hidden = a.suspended;
        if (sheet)
            syncSheet(a);
        if (!a.active && sheet) {
            sheet.close();
        }
    };
    // Coalesce the engine's frequent audio events (every word) into one update per ~50 ms.
    // A timer, not requestAnimationFrame: rAF pauses in background tabs and the player must stay current.
    const schedule = () => { if (!raf)
        raf = window.setTimeout(sync, 50); };
    document.addEventListener('reader:audio', schedule);
    document.addEventListener('reader:screen', schedule);
    sync();
}
function setPlay(btn, state) {
    const playing = state === 'playing' || state === 'loading';
    const want = playing ? 'pause' : 'play';
    if (btn.dataset.icon !== want) {
        btn.dataset.icon = want;
        btn.replaceChildren(icon(want));
    }
    const label = playing ? 'Pause' : 'Play';
    btn.setAttribute('aria-label', label);
    btn.title = label;
}
/* ---------- full player ---------- */
let refs = null;
let seeking = false;
export function openPlayer(openAudioSettings) {
    if (sheet)
        return;
    const r = R(), T = r.TTS;
    const play = IconButton({ label: 'Play', icon: 'play', onClick: () => T.toggle() });
    play.classList.add('play');
    const seek = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Listening position in chapter' });
    seek.addEventListener('input', () => { seeking = true; rangeFill(seek); });
    seek.addEventListener('change', () => { seeking = false; T.seekFraction(Number(seek.value) / 1000); });
    const el = h('span'), rem = h('span');
    const rate = h('output', { 'aria-live': 'polite' });
    const voice = h('small'), sleep = h('small');
    const voiceBtn = Button({ label: 'Voice', icon: 'speaker', onClick: () => { sheet?.close(); openAudioSettings(); } });
    voiceBtn.appendChild(voice);
    const sleepBtn = Button({ label: 'Sleep', icon: 'moon', attrs: { 'aria-haspopup': 'menu' } });
    sleepBtn.appendChild(sleep);
    sleepBtn.addEventListener('click', () => Menu(sleepBtn, [[0, 'Off'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '60 minutes'], [-1, 'End of chapter']]
        .map(([v, l]) => ({ label: l, icon: v === 0 ? 'close' : 'moon', onSelect: () => { r.setAudio('sleep', v); r.toast(v ? 'Sleep timer: ' + l.toLowerCase() : 'Sleep timer off'); } })), 'Sleep timer'));
    const who = h('b'), chap = h('span'), snippet = h('p', { class: 'snippet', 'aria-live': 'off' });
    const dl = window.__marginaliaTTSDownloads;
    const content = [
        h('div', { class: 'who' }, h('div', {}, who, chap)),
        snippet,
        h('div', { class: 'seek' }, el, seek, rem),
        h('div', { class: 'transport' }, IconButton({ label: 'Previous paragraph', icon: 'para-prev', onClick: () => T.paragraph(-1) }), IconButton({ label: 'Back 5 seconds', icon: 'back-5', onClick: () => T.skip(-5) }), play, IconButton({ label: 'Forward 5 seconds', icon: 'forward-5', onClick: () => T.skip(5) }), IconButton({ label: 'Next paragraph', icon: 'para-next', onClick: () => T.paragraph(1) })),
        h('div', { class: 'rate', role: 'group', 'aria-label': 'Reading speed' }, IconButton({ label: 'Slower', icon: 'minus', filled: true, onClick: () => T.setRate(Number(r.A.rate) - 0.1) }), rate, IconButton({ label: 'Faster', icon: 'plus', filled: true, onClick: () => T.setRate(Number(r.A.rate) + 0.1) }), Button({ label: 'Reset speed', variant: 'ghost', onClick: () => T.setRate(1) })),
        h('div', { class: 'quick' }, voiceBtn, sleepBtn, Button({ label: 'Read along', icon: 'lines', onClick: () => { sheet?.close(); r.AudioUI.openLyrics(); } }), Button({ label: 'Audio settings', icon: 'sliders', onClick: () => { sheet?.close(); openAudioSettings(); } })),
        h('div', { class: 'quick', style: 'margin-top:8px', role: 'group', 'aria-label': 'Read-along text size' }, Button({ label: 'Read-along text smaller', icon: 'text-smaller', onClick: () => window.__marginaliaReadAlong?.smaller() }), Button({ label: 'Read-along text larger', icon: 'text-larger', onClick: () => window.__marginaliaReadAlong?.larger() })),
        r.A.engine === 'edge' && dl ? h('div', {}, h('div', { class: 'sep' }), h('div', { class: 'quick' }, Button({ label: 'Download chapter', icon: 'download', onClick: () => { void dl.downloadChapter(); r.toast('Downloading this chapter…'); } }), Button({ label: 'Download book', icon: 'download', onClick: () => { void dl.downloadBook(); r.toast('Downloading this book…'); } }))) : null,
        h('div', { class: 'sep' }),
        Button({ label: 'Stop reading aloud', icon: 'stop', variant: 'danger', block: true, onClick: () => { sheet?.close(); void T.stop(true); } })
    ];
    sheet = Sheet({ title: 'Read aloud', className: 'v2-player', content: content.filter((x) => !!x), onClose: () => { sheet = null; refs = null; } });
    refs = { play, who, chap, snippet, seek, el, rem, rate, voice, sleep };
    syncSheet(r.audioInfo());
}
function syncSheet(a) {
    if (!refs)
        return;
    setPlay(refs.play, a.state);
    refs.who.textContent = a.title;
    refs.chap.textContent = a.chapter;
    if (!seeking) {
        refs.seek.value = String(Math.round(a.pct * 1000));
        rangeFill(refs.seek);
    }
    refs.el.textContent = a.elapsed;
    refs.rem.textContent = '−' + a.remaining;
    refs.rate.textContent = (+a.rate).toFixed(2).replace(/\.?0+$/, '') + '×';
    refs.voice.textContent = a.voice;
    refs.sleep.textContent = a.sleep;
    refs.snippet.textContent = a.snippet;
}
