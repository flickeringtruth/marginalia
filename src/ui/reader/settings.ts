/* v2 Settings sheet: Appearance and Audio tabs. Replaces the engine's #settingsSheet
   (buildSettings / buildAudioSettings). Every control writes through the engine's own setters
   (setSetting, setGrad, setAudio and the session-1 audio helpers), so behaviour is unchanged. */

import { h, addStyle, reader } from '../dom.js';
import { Button, IconButton, Chip, Toggle, Slider, Segmented, Sheet, showToast } from '../components.js';
import { VoicePicker } from './voices.js';
import { appTheme, setAppTheme, AppTheme } from '../theme.js';
import { attachFlux, fluxEnabled, setFluxEnabled } from '../flux.js';

type Tab = 'look' | 'audio';

const CSS = `
.v2-settings .v2-sheet-body>.v2-seg{margin-bottom:var(--v2-s4)}
.v2-settings .grp{padding:var(--v2-s4) 0;border-top:1px solid var(--v2-line)}
.v2-settings .grp:first-of-type{border-top:0;padding-top:0}
.v2-settings h3{margin:0 0 var(--v2-s2);font:600 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted);letter-spacing:.01em}
.v2-settings .lab{display:block;margin:var(--v2-s3) 0 6px;font:500 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-fg)}
.v2-settings .v2-hint{margin:var(--v2-s2) 0 0}
.v2-settings .chips{display:flex;flex-wrap:wrap;gap:var(--v2-s2)}
.v2-settings .size{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-s3)}
.v2-settings .size output{font:600 var(--v2-t-md)/1 var(--v2-sans);font-variant-numeric:tabular-nums}
.v2-themes{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:var(--v2-s3)}
.v2-theme{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;padding:0;border:0;background:none;color:var(--v2-fg);cursor:pointer;font:500 var(--v2-t-xs)/1.2 var(--v2-sans)}
.v2-theme .sw{display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15);font:600 17px/1 Georgia,serif}
.v2-theme[aria-checked="true"] .sw{box-shadow:0 0 0 2px var(--v2-bg),0 0 0 4px var(--v2-accent)}
.v2-fonts{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:var(--v2-s2)}
.v2-font{min-height:var(--v2-tap);padding:0 var(--v2-s3);border:0;border-radius:var(--v2-r-md);background:var(--v2-surface);color:var(--v2-fg);font-size:16px;cursor:pointer;text-align:left}
.v2-font[aria-checked="true"]{box-shadow:inset 0 0 0 2px var(--v2-accent)}
.v2-colors{display:flex;gap:var(--v2-s4);flex-wrap:wrap}
.v2-colors label{display:flex;align-items:center;gap:var(--v2-s2);font:500 var(--v2-t-sm)/1 var(--v2-sans)}
.v2-colors input,.v2-stop input{width:44px;height:44px;padding:0;border:0;border-radius:var(--v2-r-sm);background:none;cursor:pointer}
.v2-grad-preview{display:flex;align-items:center;justify-content:center;height:64px;border-radius:var(--v2-r-md);font:600 22px/1 Georgia,serif;margin-bottom:var(--v2-s3)}
.v2-stops{display:flex;flex-wrap:wrap;gap:var(--v2-s2);align-items:center}
.v2-stop{display:flex;align-items:center;gap:2px;padding:2px;border-radius:var(--v2-r-md);background:var(--v2-surface)}
.v2-kbd{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font:400 var(--v2-t-sm)/1.4 var(--v2-sans)}
.v2-kbd kbd{font:600 12px/1.6 var(--v2-sans);padding:0 6px;border-radius:5px;background:var(--v2-surface);border:1px solid var(--v2-line);text-align:center}
.v2-settings select.v2-input{appearance:auto;-webkit-appearance:menulist}
.v2-inline{display:flex;gap:var(--v2-s2);align-items:center;flex-wrap:wrap}
.v2-inline>.v2-input{flex:1 1 160px;min-width:0}
.v2-report{white-space:pre-wrap;font:11px/1.4 ui-monospace,Menlo,monospace;max-height:220px;overflow:auto;background:var(--v2-surface);padding:10px;border-radius:var(--v2-r-md);-webkit-user-select:text;user-select:text}
.v2-dl{margin-top:var(--v2-s3)}
`;

const R = () => reader();
const grp = (title: string, ...kids: (Node | null | false)[]) => h('section', { class: 'grp', 'aria-label': title }, h('h3', { text: title }), ...kids.filter((k): k is Node => !!k));
const lab = (text: string) => h('span', { class: 'lab', text });
const hint = (text: string) => h('p', { class: 'v2-hint', text });

let current: { body: HTMLElement; draw: () => void } | null = null;

export function openSettings(tab: Tab = 'look', focusGroup?: string): void {
  addStyle('v2-settings', CSS);
  let active: Tab = tab;
  const view = h('div');
  const tabs = Segmented<Tab>({ label: 'Settings', options: [{ value: 'look', label: 'Appearance' }, { value: 'audio', label: 'Audio' }], value: active, onChange: v => { active = v; draw(); } });
  const onAudio = () => { if (active === 'audio') syncAudioLive(); };
  const onTest = (e: DocumentEventMap['reader:speechtest']) => { const out = view.querySelector('[data-test-out]'), rep = view.querySelector('[data-test-rep]'); if (out) out.textContent = e.detail.message; if (rep) { rep.textContent = e.detail.report; (rep as HTMLElement).hidden = false; } };
  document.addEventListener('reader:audio', onAudio);
  document.addEventListener('reader:speechtest', onTest);
  let detachFlux: () => void = () => undefined;
  const sheet = Sheet({ title: 'Settings', className: 'v2-settings', content: [tabs, view], onClose: () => {
    document.removeEventListener('reader:audio', onAudio); document.removeEventListener('reader:speechtest', onTest); current = null; detachFlux();
  } });
  detachFlux = attachFlux(sheet.panel);
  function draw(): void {
    const top = sheet.body.scrollTop;
    view.replaceChildren(...(active === 'look' ? appearance(draw) : audio(draw)));
    sheet.body.scrollTop = top;
    if (active === 'audio') { window.__marginaliaTTSDownloads?.render(); }
  }
  current = { body: sheet.body, draw };
  draw();
  if (focusGroup) requestAnimationFrame(() => view.querySelector(`[aria-label="${focusGroup}"]`)?.scrollIntoView({ block: 'start' }));
}

/* Live parts of the Audio tab (sleep status) without redrawing sliders under the finger. */
function syncAudioLive(): void {
  if (!current) return;
  const st = current.body.querySelector('[data-sleep-status]');
  if (st) st.textContent = 'Sleep timer: ' + R().audioInfo().sleep + '.';
}

/* ---------- Appearance ---------- */

function appearance(redraw: () => void): Node[] {
  const r = R(), S = r.S, isPdf = r.App.book?.type === 'pdf';
  const set = (k: string, v: unknown, again = true) => { void r.setSetting(k, v).then(() => { if (again) redraw(); }); };
  const seg = <T extends string>(label: string, key: string, opts: [T, string][]) =>
    h('div', {}, lab(label), Segmented<T>({ label, options: opts.map(([value, l]) => ({ value, label: l })), value: String(S[key]) as T, onChange: v => set(key, v) }));
  const slider = (label: string, key: string, min: number, max: number, step: number, fmt: (v: number) => string) =>
    Slider({ label, min, max, step, value: Number(S[key]), format: fmt, onInput: v => set(key, v, false) });
  const toggle = (label: string, key: string) => Toggle({ label, checked: !!S[key], onChange: v => set(key, v, key === 'layout') });

  const out: Node[] = [];
  // App look: the chrome (library, Discover, sheets). Separate from the reading page theme below.
  out.push(grp('App',
    h('div', {}, lab('App theme'), Segmented<AppTheme>({ label: 'App theme', options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'page', label: 'Match page' }], value: appTheme(), onChange: v => setAppTheme(v) })),
    Toggle({ label: 'Animated background', checked: fluxEnabled(), onChange: v => setFluxEnabled(v) }),
    hint('Dark and Light colour the library, Discover and menus. Match page uses the reading theme below everywhere; picking a reading theme turns it on.')));
  const size = h('output', { text: S.fontSize + ' px' });
  out.push(grp('Text',
    isPdf ? null : h('div', { class: 'size' },
      IconButton({ label: 'Smaller text', icon: 'text-smaller', filled: true, onClick: () => set('fontSize', Math.max(12, S.fontSize - 1)) }), size,
      IconButton({ label: 'Larger text', icon: 'text-larger', filled: true, onClick: () => set('fontSize', Math.min(36, S.fontSize + 1)) })),
    slider('Brightness', 'brightness', 0.3, 1, 0.01, v => Math.round(v * 100) + '%')));

  // themes
  const themeList = [...r.themes(), { key: 'custom', label: 'Custom', bg: String(S.customBg || '#ffffff'), fg: String(S.customFg || '#000000') }, { key: 'gradient', label: 'Gradient', bg: '', fg: '' }];
  const g = S.grad, gi = r.gradientTheme(g), hex = (c: number[]) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  const themes = h('div', { class: 'v2-themes', role: 'radiogroup', 'aria-label': 'Theme' }, ...themeList.map(t => {
    const sw = h('span', { class: 'sw', 'aria-hidden': 'true', text: 'Aa' });
    if (t.key === 'gradient') { sw.style.backgroundImage = gi.image; sw.style.color = hex(gi.fg); } else { sw.style.background = t.bg; sw.style.color = t.fg; }
    const b = h('button', { type: 'button', role: 'radio', class: 'v2-theme', 'aria-checked': String(S.theme === t.key), 'aria-label': t.label + ' theme' }, sw, h('span', { 'aria-hidden': 'true', text: t.label }));
    // choosing a reading theme means "use this look": the whole app follows it until Dark or Light is picked again
    b.addEventListener('click', () => { setAppTheme('page'); set('theme', t.key); });
    return b;
  }));
  const extra: Node[] = [];
  if (S.theme === 'custom') {
    const color = (label: string, key: string) => { const i = h('input', { type: 'color', 'aria-label': label }); i.value = String(S[key]); i.addEventListener('input', () => set(key, i.value, false)); return h('label', {}, i, label); };
    extra.push(h('div', { class: 'v2-colors', style: 'margin-top:12px' }, color('Background', 'customBg'), color('Text', 'customFg')));
  }
  if (S.theme === 'gradient') {
    const pv = h('div', { class: 'v2-grad-preview', 'aria-hidden': 'true', text: 'Aa' }); pv.style.backgroundImage = gi.image; pv.style.color = hex(gi.fg);
    const stops = h('div', { class: 'v2-stops' }, ...g.colors.map((c, i) => {
      const inp = h('input', { type: 'color', 'aria-label': 'Gradient colour ' + (i + 1) }); inp.value = c;
      inp.addEventListener('change', () => { const cs = g.colors.slice(); cs[i] = inp.value; r.setGrad({ colors: cs }); redraw(); });
      return h('span', { class: 'v2-stop' }, inp, g.colors.length > 2 ? IconButton({ label: 'Remove colour ' + (i + 1), icon: 'close', onClick: () => { const cs = g.colors.slice(); cs.splice(i, 1); r.setGrad({ colors: cs }); redraw(); } }) : null);
    }), g.colors.length < 5 ? IconButton({ label: 'Add colour', icon: 'plus', filled: true, onClick: () => { const cs = g.colors.slice(); cs.push(['#57f287', '#5865f2', '#ed4245', '#fee75c', '#eb459e'][cs.length % 5]); r.setGrad({ colors: cs }); redraw(); } }) : null);
    extra.push(h('div', { style: 'margin-top:12px' }, pv, stops,
      Slider({ label: 'Angle', min: 0, max: 360, step: 1, value: g.angle, format: v => Math.round(v) + '°', onInput: v => r.setGrad({ angle: v }) }),
      Slider({ label: 'Intensity', min: 0.05, max: 1, step: 0.01, value: g.intensity, format: v => Math.round(v * 100) + '%', onInput: v => r.setGrad({ intensity: v }) }),
      hint('Text contrast ' + gi.minC.toFixed(1) + ':1' + (gi.limited ? ' — intensity is capped at ' + Math.round(gi.k * 100) + '% to keep the text readable (WCAG 4.5:1).' : ' (meets WCAG AA).'))));
  }
  out.push(grp('Reading page theme', themes, ...extra));

  if (!isPdf) {
    const fonts = h('div', { class: 'v2-fonts', role: 'radiogroup', 'aria-label': 'Font' }, ...r.fonts().map(f => {
      const b = h('button', { type: 'button', role: 'radio', class: 'v2-font', 'aria-checked': String(S.font === f.key), text: f.label });
      b.style.fontFamily = f.css;
      b.addEventListener('click', () => set('font', f.key));
      return b;
    }));
    out.push(grp('Font', fonts));
    out.push(grp('Text layout',
      slider('Line spacing', 'lineHeight', 1.2, 2.2, 0.05, v => v.toFixed(2)),
      slider('Margins', 'margin', 12, 72, 2, v => v + ' px'),
      seg('Alignment', 'align', [['left', 'Left'], ['justify', 'Justified']])));
  }
  const paged = S.layout === 'paged';
  out.push(grp('Reading',
    seg('Mode', 'layout', [['paged', 'Pages'], ['scroll', 'Scroll']]),
    paged ? seg('Pages', 'spread', [['auto', 'Auto'], ['single', 'Single'], ['double', 'Two-up']]) : null,
    paged ? seg('Page turn', 'turn', [['slide', 'Slide'], ['fade', 'Fade'], ['curl', '3D curl'], ['none', 'None']]) : null,
    paged ? toggle('Edge-tap navigation', 'tapZones') : null,
    paged ? slider('Swipe sensitivity', 'swipeSens', 1, 10, 1, v => String(v)) : null,
    !paged ? slider('Scroll speed', 'scrollSpeed', 0.4, 2, 0.05, v => v.toFixed(2) + '×') : null,
    !paged ? seg('Momentum', 'momentum', [['off', 'Off'], ['low', 'Low'], ['normal', 'Normal']]) : null,
    seg('Progress', 'progress', [['scrubber', 'Scrubber'], ['bar', 'Bar'], ['both', 'Both']]),
    hint('Tapping the page shows or hides the bars. Turn pages with the arrows, a swipe or the keyboard, or turn on edge-tap navigation to use the left and right 30% of the page. “Two-up” shows a two-page spread in landscape.')));
  out.push(grp('Interface',
    isPdf ? null : toggle('Highlight mode (press and hold to select text)', 'highlightMode'),
    toggle('Immersive bars (bars float over the text)', 'immersive'),
    isPdf ? null : toggle('Keep dictionary button visible when bars are hidden', 'dictFloat'),
    toggle('Paper texture', 'paper'),
    slider('Animation speed', 'uiSpeed', 150, 700, 10, v => v + ' ms'),
    ));
  const keys: [string, string][] = [['← →', 'Previous / next page'], ['Space', 'Next page (Shift: previous)'], ['↑ ↓', 'Scroll a little (scroll mode)'], ['Shift+A', 'Toggle auto scroll'],
    ['+ −', 'Text size'], ['T', 'Contents'], ['H', 'Highlights'], ['S', 'Appearance'], ['D', 'Dictionary / look up selection'], ['I', 'AI assistant'],
    ['P', 'Read aloud: play / pause'], ['[ ]', 'Read aloud: back / forward 5 s'], ['A', 'Audio settings'], ['M', 'Show / hide controls'], ['L', 'Library'], ['Esc', 'Close / clear selection']];
  out.push(grp('Keyboard', h('div', { class: 'v2-kbd' }, ...keys.flatMap(([k, t]) => [h('kbd', { text: k }), h('span', { text: t })]))));
  out.push(Button({ label: 'Reset appearance to defaults', icon: 'refresh', block: true, onClick: () => { r.resetAppearance(); redraw(); } }));
  return out;
}

/* ---------- Audio ---------- */

function audio(redraw: () => void): Node[] {
  const r = R(), A = r.A;
  const set = (k: string, v: unknown, again = true) => { r.setAudio(k, v); if (again) redraw(); };
  const seg = <T extends string>(label: string, key: string, opts: [T, string][]) =>
    h('div', {}, lab(label), Segmented<T>({ label, options: opts.map(([value, l]) => ({ value, label: l })), value: String(A[key]) as T, onChange: v => set(key, v) }));
  const out: Node[] = [];
  const edge = A.engine === 'edge';

  // One voice list (Online + On this device). Picking a row sets engine and voice together.
  const picker = VoicePicker(redraw);
  const presets: [string, string][] = [['auto', 'Best available'], ['deep', 'Deep'], ['natural', 'Natural'], ['narrator', 'Narrator'], ['story', 'Storytelling']];
  out.push(grp('Voice',
    picker.el,
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Voice style', style: 'margin-top:16px' }, ...presets.map(([v, l]) => Chip({ label: l, pressed: A.preset === v, onClick: () => { r.applyAudioPreset(v); redraw(); } }))),
    hint('Voice style sets speed and pitch, and, for device voices, the best matching voice.'),
    Toggle({ label: 'Lock selected voice', checked: !!A.voiceLocked, onChange: v => set('voiceLocked', v, false) }),
    hint('When locked, the selected voice won’t change automatically. If it can’t play, reading pauses instead of switching. Exception: if online voices are rate-limited 3 times in a row, reading continues with your device voice for this session.'),
    Toggle({ label: 'Storytelling cadence', checked: !!A.cadence, onChange: v => set('cadence', v, false) }),
    hint('Online voices use Microsoft’s unofficial Edge read-aloud service, not a public API. Microsoft can still throttle or block it at any time. Caching and downloads cut down how often it is asked, but they can’t prevent that. Each request is limited to 1,200 characters, so long passages are sent in pieces. Device voices are free and work offline.'),
    edge ? h('div', { class: 'v2-dl', 'data-tts-downloads': '' }) : null,
    picker.advanced));

  const vol = Slider({ label: 'Volume', min: 0, max: 200, step: 5, value: A.volume, format: v => v + '%', onInput: v => { set('volume', v, false); volHint.hidden = v <= 100; } });
  const volHint = hint('Browsers can’t play speech louder than 100%. Above that, raise your device volume.'); volHint.hidden = A.volume <= 100;
  out.push(grp('Sound',
    Slider({ label: 'Speed', min: 0.5, max: 2.5, step: 0.05, value: A.rate, format: v => v.toFixed(2) + '×', onInput: v => set('rate', v, false) }),
    Slider({ label: 'Pitch', min: 0.5, max: 1.6, step: 0.05, value: A.pitch, format: v => v.toFixed(2), onInput: v => set('pitch', v, false) }),
    vol, volHint));
  out.push(grp('Highlighting',
    seg('Follow', 'hlMode', [['sentence', 'Sentence'], ['word', 'Word'], ['syllable', 'Syllable']]),
    seg('Keep', 'trail', [['none', 'Current'], ['two', 'Last 2'], ['eight', 'Last 8'], ['sentence', 'Sentence']]),
    seg('Colour', 'hlColor', [['orange', 'Orange'], ['teal', 'Teal'], ['graphite', 'Graphite']]),
    hint('Syllables are estimated from spelling and speaking speed.')));
  out.push(grp('While reading aloud',
    Toggle({ label: 'Auto-scroll (scroll mode)', checked: !!A.autoScroll, onChange: v => set('autoScroll', v, false) }),
    Toggle({ label: 'Turn pages automatically (page mode)', checked: !!A.autoNext, onChange: v => set('autoNext', v, false) }),
    seg('Start from', 'startFrom', [['chapter', 'Chapter start'], ['page', 'Current page']])));

  const amb = r.Ambient;
  const presetChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Ambient presets' }, ...Object.entries(amb.PRESETS).map(([k, p]) => Chip({ label: p.label, pressed: A.ambPreset === k, attrs: { 'data-amb-preset': k }, onClick: () => { amb.applyPreset(k); redraw(); } }))); 
  const kindChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Ambient sound' }, ...Object.entries(amb.KINDS).map(([k, l]) => Chip({ label: l, pressed: amb.kind === k, attrs: { 'data-amb-kind': k }, onClick: () => { amb.start(k); redraw(); } })));
  const ambParts: HTMLElement[] = [presetChips, kindChips, Slider({ label: 'Ambient volume', min: 0, max: 1, step: 0.01, value: Number(A.ambVol), format: v => Math.round(v * 100) + '%', onInput: v => amb.setVol(v) })];
  // Per-sound sliders exist only while their sound is active. A drag feeds the live graph;
  // on release the sheet re-renders so preset chips re-snap (exact match) at rest.
  for (const d of (amb.PARAM_DEFS[amb.kind] || [])) {
    const sl = Slider({ label: d.label, min: 0, max: 1, step: 0.01, value: amb.param(amb.kind, d.key), format: v => Math.round(v * 100) + '%', onInput: v => amb.setParam(amb.kind, d.key, v) });
    sl.setAttribute('data-amb-param', amb.kind + '.' + d.key);
    sl.querySelector('input')?.addEventListener('change', () => redraw());
    ambParts.push(sl);
  }
  ambParts.push(hint('Generated live on your device. Works offline. Presets pin a mood; moving a slider makes it yours. On iPhone, Silent mode also mutes it.'));
  out.push(grp('Ambient sound', ...ambParts));

  const sleeps: [number, string][] = [[0, 'Off'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min'], [60, '60 min'], [-1, 'End of chapter']];
  const custom = h('input', { class: 'v2-input', type: 'number', min: 1, max: 600, inputmode: 'numeric', placeholder: 'Minutes', 'aria-label': 'Custom sleep minutes' });
  out.push(grp('Sleep timer',
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Sleep timer' }, ...sleeps.map(([v, l]) => Chip({ label: l, pressed: Number(A.sleep) === v, onClick: () => set('sleep', v) }))),
    h('div', { class: 'v2-inline', style: 'margin-top:12px' }, custom, Button({ label: 'Set', onClick: () => {
      const v = parseInt(custom.value, 10); if (v > 0) { const m = Math.min(600, v); set('sleep', m); showToast('Sleep timer: ' + m + ' min'); }
    } })),
    h('p', { class: 'v2-hint', 'data-sleep-status': '', text: 'Sleep timer: ' + r.audioInfo().sleep + '.' })));

  const rep = h('pre', { class: 'v2-report', 'data-test-rep': '', hidden: true });
  out.push(grp('Troubleshooting',
    hint('Hear nothing? Run the test with your volume up. It plays one sentence and checks what your browser’s speech engine does.'),
    h('div', { class: 'v2-inline', style: 'margin-top:8px' },
      Button({ label: 'Run speech test', icon: 'speaker', onClick: () => r.runSpeechTest() }),
      Button({ label: 'Copy report', icon: 'copy', onClick: () => void r.copyText(r.speechReport()) })),
    h('p', { class: 'v2-hint', 'data-test-out': '', 'aria-live': 'polite' }), rep));
  out.push(Button({ label: 'Reset audio settings', icon: 'refresh', block: true, onClick: () => { r.resetAudio(); redraw(); } }));
  return out;
}
