/* One voice picker for Settings › Audio: a single searchable list in two groups,
   "Online (Edge)" and "On this device". Picking a row sets the engine and the voice together
   (engine.selectVoice), so the player switches at once and the choice is remembered.
   Preview plays a sample of that row without leaving the list.

   Edge voices work with no setup: the engine's built-in service address is used unless the user
   enters their own under Advanced. The list itself is bundled, so it is never empty; the status line
   only reports whether the service answered, with a Retry button when it did not. */
import { h, addStyle, reader } from '../dom.js';
import { Button, Field } from '../components.js';
import { icon } from '../icons.js';
const CSS = `
.v2-vp{margin-top:var(--v2-s3)}
.v2-vp-status{display:flex;align-items:center;gap:var(--v2-s2);flex-wrap:wrap;margin:var(--v2-s3) 0 0;font:400 var(--v2-t-sm)/1.4 var(--v2-sans);color:var(--v2-muted)}
.v2-vp-status .dot{width:8px;height:8px;border-radius:50%;background:var(--v2-muted);flex:none}
.v2-vp-status.ok .dot{background:var(--v2-ok)}
.v2-vp-status.bad .dot{background:var(--v2-danger)}
.v2-vp-status.busy .dot{background:var(--v2-accent);animation:v2-vp-pulse 1s ease-in-out infinite alternate}
@keyframes v2-vp-pulse{from{opacity:.35}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.v2-vp-status.busy .dot{animation:none}}
.v2-vp-status .v2-btn{min-height:36px;padding:0 var(--v2-s3)}
.v2-vp h4{margin:var(--v2-s4) 0 var(--v2-s1);font:600 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted);letter-spacing:.01em}
.v2-vp-list{margin:0;padding:0;list-style:none}
.v2-vp-row{display:flex;align-items:center;gap:var(--v2-s1);border-radius:var(--v2-r-md)}
.v2-vp-row.sel{background:var(--v2-surface)}
.v2-vp-pick{display:flex;align-items:center;gap:var(--v2-s3);flex:1;min-width:0;min-height:56px;padding:var(--v2-s2) var(--v2-s2);border:0;border-radius:var(--v2-r-md);background:none;color:var(--v2-fg);text-align:left;font:inherit;cursor:pointer}
.v2-vp-pick .tick{display:flex;align-items:center;justify-content:center;width:24px;height:24px;flex:none;color:var(--v2-accent)}
.v2-vp-pick .tick .v2-icon{width:20px;height:20px;opacity:0}
.v2-vp-row.sel .tick .v2-icon{opacity:1}
.v2-vp-pick .txt{flex:1;min-width:0}
.v2-vp-pick b{display:block;font:600 var(--v2-t-base)/1.3 var(--v2-sans);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.v2-vp-pick small{display:block;margin-top:2px;font:400 var(--v2-t-sm)/1.35 var(--v2-sans);color:var(--v2-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (hover:hover){.v2-vp-pick:hover{background:var(--v2-surface)}}
.v2-vp-prev{flex:none}
.v2-vp-more{margin-top:var(--v2-s2)}
.v2-vp-empty{margin:var(--v2-s3) 0 0;font:400 var(--v2-t-sm)/1.5 var(--v2-sans);color:var(--v2-muted)}
.v2-adv{margin-top:var(--v2-s4);border-top:1px solid var(--v2-line);padding-top:var(--v2-s2)}
.v2-adv summary{display:flex;align-items:center;gap:var(--v2-s2);min-height:var(--v2-tap);cursor:pointer;font:600 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted);list-style:none}
.v2-adv summary::-webkit-details-marker{display:none}
.v2-adv summary .v2-icon{width:16px;height:16px;transition:transform var(--v2-d-base) var(--v2-ease)}
.v2-adv[open] summary .v2-icon{transform:rotate(180deg)}
`;
/* Gender is shown only where it is known. Edge names come from Microsoft's published voice list.
   Device names are well-known system voices; every other voice shows no gender rather than a guess. */
const F = 'Female', M = 'Male';
const EDGE_GENDER = {
    Ana: F, Andrew: M, AndrewMultilingual: M, Aria: F, Ava: F, AvaMultilingual: F, Brian: M, BrianMultilingual: M, Christopher: M, Emma: F, EmmaMultilingual: F,
    Eric: M, Guy: M, Jenny: F, Michelle: F, Roger: M, Steffan: M, Libby: F, Maisie: F, Ryan: M, Sonia: F, Thomas: M, Natasha: F, William: M, Clara: F, Liam: M,
    Neerja: F, Prabhat: M, Connor: M, Emily: F, Mitchell: M, Molly: F, Colette: F, Fenna: F, Maarten: M, Amala: F, Conrad: M, Katja: F, Killian: M, Denise: F,
    Eloise: F, Henri: M, RemyMultilingual: M, Alvaro: M, Elvira: F, Ximena: F, Diego: M, Elsa: F, GiuseppeMultilingual: M, Isabella: F, Antonio: M, Francisca: F,
    Keita: M, Nanami: F, HyunsuMultilingual: M, InJoon: M, SunHi: F, Xiaoxiao: F, Yunxi: M, Yunjian: M, Xiaoyi: F, Hamed: M, Zariyah: F, Madhur: M, Swara: F,
    Mattias: M, Sofie: F, Christel: F, Jeppe: M, Marek: M, Zofia: F, Dmitry: M, Svetlana: F
};
const DEVICE_GENDER = {
    samantha: F, karen: F, moira: F, tessa: F, fiona: F, nicky: F, ava: F, zoe: F, allison: F, susan: F, serena: F, kate: F, martha: F, catherine: F, matilda: F,
    veena: F, victoria: F, kathy: F, vicki: F, joelle: F, zira: F, hazel: F, samira: F, daniel: M, alex: M, rishi: M, aaron: M, evan: M, tom: M, oliver: M, arthur: M,
    gordon: M, lee: M, fred: M, ralph: M, david: M, mark: M, george: M, james: M, reed: M, eddy: M
};
let regionNames = null, langNames = null;
try {
    regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    langNames = new Intl.DisplayNames(['en'], { type: 'language' });
}
catch { /* old browser: show raw codes */ }
/** "en-US" → "English (US)". */
export function langLabel(code) {
    const [lang, region] = String(code || '').replace('_', '-').split('-');
    const l = (langNames && lang && safe(() => langNames.of(lang))) || lang || 'Unknown';
    const r = region && region.length === 2 ? region.toUpperCase() : '';
    return r ? l + ' (' + (r === 'US' || r === 'GB' ? r : safe(() => regionNames.of(r)) || r) + ')' : l;
}
function safe(f) { try {
    return f();
}
catch {
    return '';
} }
export function edgeRows(names) {
    return names.map(n => {
        const [a, b, ...rest] = n.split('-');
        const short = rest.join('-').replace(/Neural$/, '');
        return { kind: 'edge', id: n, name: short.replace(/Multilingual$/, ' Multilingual'), lang: a + '-' + b, gender: EDGE_GENDER[short] || '', note: '' };
    });
}
export function deviceRows(list) {
    return list.map(v => {
        const quality = /premium/i.test(v.name) ? 'Premium' : /enhanced/i.test(v.name) ? 'Enhanced' : /compact/i.test(v.uri) ? 'Compact' : '';
        const first = v.name.replace(/\(.*?\)/g, '').trim().split(/\s+/)[0].toLowerCase();
        return { kind: 'device', id: v.uri, name: v.name, lang: v.lang, gender: DEVICE_GENDER[first] || '', note: [quality, v.local ? '' : 'needs internet'].filter(Boolean).join(' · ') };
    });
}
const rowMeta = (r) => [langLabel(r.lang), r.gender, r.note].filter(Boolean).join(' · ');
let lastCheck = null;
/** Builds the picker. `redraw` redraws the whole Audio tab (used after engine changes). */
export function VoicePicker(redraw) {
    addStyle('v2-voice-picker', CSS);
    const r = reader(), A = r.A;
    const root = h('div', { class: 'v2-vp' });
    const search = Field({ label: 'Search voices', placeholder: 'Name, language or gender' });
    search.input.type = 'search';
    search.input.setAttribute('enterkeyhint', 'search');
    search.input.autocapitalize = 'off';
    search.el.style.marginTop = '0';
    const status = h('p', { class: 'v2-vp-status busy', role: 'status', 'aria-live': 'polite' });
    const list = h('div');
    let showAll = false, previewing = '', checking = 0;
    let service = { state: 'busy', reason: '' };
    const paintStatus = () => {
        status.className = 'v2-vp-status ' + service.state;
        status.replaceChildren(h('span', { class: 'dot', 'aria-hidden': 'true' }));
        if (service.state === 'busy')
            status.append('Checking the online voice service…');
        else if (service.state === 'ok')
            status.append('Online voices are ready.');
        else {
            status.append(service.reason + ' Online voices may not play right now.');
            status.append(Button({ label: 'Retry', icon: 'refresh', onClick: () => { void check(true); } }));
        }
    };
    async function check(force = true) {
        const n = ++checking;
        // The Audio tab redraws after most changes; reuse a result from the last 30 s instead of asking again.
        if (!force && lastCheck && Date.now() - lastCheck.at < 30000 && lastCheck.url === r.edgeProxyOverride()) {
            service = lastCheck.state;
            paintStatus();
            return;
        }
        service = { state: 'busy', reason: '' };
        paintStatus();
        const res = await r.edgeCheck();
        if (n !== checking)
            return;
        service = res.ok ? { state: 'ok', reason: '' } : { state: 'bad', reason: res.reason };
        lastCheck = { at: Date.now(), url: r.edgeProxyOverride(), state: service };
        paintStatus();
    }
    const match = (row, q) => !q || (row.name + ' ' + row.id + ' ' + langLabel(row.lang) + ' ' + row.gender + ' ' + row.note).toLowerCase().includes(q);
    const selectedId = () => (A.engine === 'edge' ? 'edge:' + A.edgeVoice : 'device:' + A.voiceURI);
    function rowEl(row) {
        const sel = selectedId() === row.kind + ':' + row.id;
        const pick = h('button', { type: 'button', class: 'v2-vp-pick', role: 'radio', 'aria-checked': String(sel) }, h('span', { class: 'tick', 'aria-hidden': 'true' }, icon('check')), h('span', { class: 'txt' }, h('b', { text: row.name }), h('small', { text: rowMeta(row) })));
        pick.addEventListener('click', () => { r.stopPreview(); previewing = ''; r.selectVoice(row.kind, row.id); redraw(); });
        const key = row.kind + ':' + row.id, busy = previewing === key;
        const prev = h('button', { type: 'button', class: 'v2-ibtn v2-vp-prev', 'aria-label': (busy ? 'Stop preview of ' : 'Preview ') + row.name, title: busy ? 'Stop' : 'Preview' }, icon(busy ? 'stop' : 'play'));
        prev.addEventListener('click', () => {
            if (previewing === key) {
                r.stopPreview();
                previewing = '';
                paint();
                return;
            }
            previewing = key;
            paint();
            r.previewVoiceFor(row.kind, row.id).then(() => undefined, (e) => { notice(row.name + ': ' + (e instanceof Error ? e.message : 'preview failed')); }).then(() => { if (previewing === key) {
                previewing = '';
                paint();
            } });
        });
        return h('li', { class: 'v2-vp-row' + (sel ? ' sel' : '') }, pick, prev);
    }
    const msg = h('p', { class: 'v2-vp-empty', role: 'status', 'aria-live': 'polite', hidden: true });
    function notice(text) { msg.textContent = text; msg.hidden = false; }
    function group(title, rows, q, bookLang) {
        if (!rows.length)
            return [];
        const base = bookLang.split('-')[0].toLowerCase();
        const mine = q ? rows : rows.filter(x => x.lang.toLowerCase().startsWith(base) || x.id === (A.engine === 'edge' ? A.edgeVoice : A.voiceURI));
        const other = q ? [] : rows.filter(x => !mine.includes(x));
        const out = [h('h4', { text: title + ' · ' + (q ? rows.length : mine.length) })];
        out.push(h('ul', { class: 'v2-vp-list', role: 'radiogroup', 'aria-label': title }, ...mine.map(rowEl)));
        if (other.length && showAll)
            out.push(h('ul', { class: 'v2-vp-list', role: 'radiogroup', 'aria-label': title + ', other languages' }, ...other.map(rowEl)));
        return out;
    }
    function paint() {
        const q = search.input.value.trim().toLowerCase();
        const vi = r.voicesInfo();
        const edge = edgeRows(vi.edge).filter(x => match(x, q));
        const dev = deviceRows(vi.device).filter(x => match(x, q));
        const autoRow = { kind: 'device', id: '', name: 'Automatic', lang: vi.lang, gender: '', note: vi.device.length ? 'best voice on this device: ' + vi.automatic : 'uses the system default' };
        const parts = [];
        if (!q)
            parts.push(h('ul', { class: 'v2-vp-list', role: 'radiogroup', 'aria-label': 'Automatic' }, rowEl(autoRow)));
        const nodes = [...group('Online (Edge)', edge, q, vi.lang), ...group('On this device', dev, q, vi.lang)];
        parts.push(...nodes);
        if (!q) {
            const hidden = edge.concat(dev).filter(x => !x.lang.toLowerCase().startsWith(vi.lang.split('-')[0].toLowerCase()) && selectedId() !== x.kind + ':' + x.id).length;
            if (hidden)
                parts.push(Button({ label: showAll ? 'Show fewer languages' : 'Show ' + hidden + ' voices in other languages', variant: 'ghost', block: true, onClick: () => { showAll = !showAll; paint(); } }));
        }
        if (!edge.length && !dev.length)
            parts.push(h('p', { class: 'v2-vp-empty', text: q ? 'No voices match “' + search.input.value.trim() + '”.' : 'No voices found yet.' }));
        if (!vi.device.length && !q) {
            parts.push(h('p', { class: 'v2-vp-empty', text: vi.loading ? 'Loading voices from this device…' : 'This device has not reported any voices yet.' }));
            if (!vi.loading)
                parts.push(Button({ label: 'Check again', icon: 'refresh', onClick: () => { r.voicesRetry(); void r.loadVoices().then(paint); } }));
        }
        if (vi.ios && vi.device.length < 15 && !q) {
            parts.push(h('p', { class: 'v2-vp-empty', text: 'iOS shows ' + vi.device.length + ' device voices to websites. You can download more Apple voices in iOS Settings › Accessibility › Spoken Content › Voices. Siri voices are not available to websites.' }));
        }
        parts.push(msg);
        list.replaceChildren(...parts);
    }
    search.input.addEventListener('input', () => { msg.hidden = true; paint(); });
    root.append(search.el, status, list);
    paint();
    void check(false);
    // Device voices arrive late on iOS; repaint when they do.
    if (!r.voicesInfo().device.length)
        void r.loadVoices().then(paint);
    // Advanced: optional service address override.
    const proxy = Field({ label: 'Voice service address', value: r.edgeProxyOverride(), placeholder: r.defaultEdgeProxy });
    proxy.input.type = 'url';
    proxy.input.autocapitalize = 'off';
    proxy.input.setAttribute('aria-label', 'Voice service address (optional)');
    const adv = h('details', { class: 'v2-adv' }, h('summary', {}, 'Advanced', icon('chevron-down')), h('p', { class: 'v2-hint', text: 'Online voices work without any setup. Only enter an address here to use your own Cloudflare Worker instead of the built-in service. Leave it empty to use the built-in one.' }), proxy.el, h('div', { class: 'v2-inline', style: 'margin-top:8px' }, Button({ label: 'Save', variant: 'primary', onClick: () => { if (r.setEdgeProxy(proxy.input.value))
            void check(); } }), Button({ label: 'Use built-in', onClick: () => { proxy.input.value = ''; if (r.setEdgeProxy(''))
            void check(); } })));
    return { el: root, advanced: adv };
}
