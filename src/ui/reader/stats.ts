/* Reading statistics (v2 only), stored in this browser only (localStorage marginalia.stats.v1).
   - Time read per day: counted in 15-second ticks while a book is open, the page is visible and
     you turned a page or touched the screen in the last 2 minutes (idle gaps are ignored), or
     read-aloud is playing.
   - Reading speed: characters per minute between page turns that are 3 s – 2 min apart and move
     forward by less than 6,000 characters (jumps, skims and idle gaps are ignored). Read-aloud
     time is not counted as reading speed. Until 3 minutes have been measured a default of
     1,500 characters per minute (≈ 250 words per minute) is used.
   - Books finished: a book counts once you reach 99 % of it. */

import { h, addStyle, reader, readJSON, writeJSON } from '../dom.js';
import { Button, Sheet, confirmSheet, showToast } from '../components.js';
import { where, fmtDuration } from './position.js';

const KEY = 'marginalia.stats.v1';
export const DEFAULT_CPM = 1500;            // characters per minute ≈ 250 wpm
export const CHARS_PER_WORD = 6;            // average English word + space, for the wpm label
const MIN_MEASURED_MIN = 3;
const IDLE_MS = 120000, TICK_MS = 15000;

interface Stats { v: 1; days: Record<string, number>; cpm: number | null; measuredMin: number; finished: Record<string, number> }

function load(): Stats {
  const s = readJSON<Partial<Stats>>(KEY, {});
  return { v: 1, days: s.days || {}, cpm: typeof s.cpm === 'number' ? s.cpm : null, measuredMin: s.measuredMin || 0, finished: s.finished || {} };
}
function save(s: Stats): void { writeJSON(KEY, s); }

export function dayKey(d = new Date()): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* Reading speed in characters per minute: measured once there is enough data, else the default. */
export function speedCpm(): { cpm: number; measured: boolean } {
  const s = load();
  return s.cpm && s.measuredMin >= MIN_MEASURED_MIN ? { cpm: s.cpm, measured: true } : { cpm: DEFAULT_CPM, measured: false };
}

/* Exposed for the test helper as well: one page-turn sample. */
export function recordSample(ms: number, chars: number): boolean {
  if (ms < 3000 || ms > IDLE_MS || chars <= 0 || chars > 6000) return false;
  const s = load(), min = ms / 60000, cpm = chars / min;
  if (cpm < 150 || cpm > 6000) return false;            // not plausible reading
  // Time-weighted running average; older data fades after ~30 measured minutes.
  const w = Math.min(min / Math.min(30, s.measuredMin + min), 1);
  s.cpm = s.cpm == null ? cpm : s.cpm + (cpm - s.cpm) * w;
  s.measuredMin += min;
  save(s);
  return true;
}
export function addTime(seconds: number, day = dayKey()): void {
  const s = load(); s.days[day] = (s.days[day] || 0) + seconds; save(s);
}
function markFinished(bookId: string): void {
  const s = load(); if (s.finished[bookId]) return; s.finished[bookId] = Date.now(); save(s);
  showToast('Book finished. Well read!');
}

/* ---------- tracker ---------- */

let last: { bookId: string; pos: number; t: number } | null = null;
let lastActivity = 0;

export function mountStats(): void {
  const R = reader();
  document.addEventListener('reader:progress', () => {
    const w = where(), now = Date.now();
    lastActivity = now;
    if (!w) { last = null; return; }
    const listening = R.audioInfo().state === 'playing';
    if (last && last.bookId === w.bookId && !listening) recordSample(now - last.t, w.pos - last.pos);
    last = { bookId: w.bookId, pos: w.pos, t: now };
    if (w.total && w.pos / w.total >= 0.99) markFinished(w.bookId);
  });
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) last = null; });
  window.setInterval(() => {
    if (document.hidden || R.App.screen !== 'reader' || !R.App.book) return;
    const listening = R.audioInfo().state === 'playing';
    if (listening || Date.now() - lastActivity < IDLE_MS) addTime(TICK_MS / 1000);
  }, TICK_MS);
  // Dev/test helper (dev/features-check.js): simulate reading without waiting.
  (window as unknown as { __marginaliaStats: unknown }).__marginaliaStats = { recordSample, addTime, load, dayKey, speedCpm };
}

/* ---------- summary ---------- */

export function summary(): { today: number; week: number; streak: number; finished: number; wpm: number; measured: boolean; last30: { day: string; min: number }[] } {
  const s = load(), today = new Date();
  const last30: { day: string; min: number }[] = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const k = dayKey(d); last30.push({ day: k, min: (s.days[k] || 0) / 60 }); }
  // Streak: consecutive days with at least a minute of reading, ending today (or yesterday if nothing yet today).
  let streak = 0;
  const start = (s.days[dayKey(today)] || 0) >= 60 ? 0 : 1;
  for (let i = start; i < 3650; i++) { const d = new Date(today); d.setDate(d.getDate() - i); if ((s.days[dayKey(d)] || 0) >= 60) streak++; else break; }
  const sp = speedCpm();
  return { today: last30[29].min, week: last30.slice(-7).reduce((t, x) => t + x.min, 0), streak, finished: Object.keys(s.finished).length,
    wpm: Math.round(sp.cpm / CHARS_PER_WORD), measured: sp.measured, last30 };
}

const CSS = `
.v2-stats .tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-s2)}
@media (min-width:520px){.v2-stats .tiles{grid-template-columns:repeat(3,minmax(0,1fr))}}
.v2-stats .tile{padding:12px;border-radius:var(--v2-r-md);background:var(--v2-surface)}
.v2-stats .tile b{display:block;font:600 var(--v2-t-lg)/1.15 var(--v2-sans);font-variant-numeric:tabular-nums}
.v2-stats .tile span{display:block;margin-top:2px;font:500 var(--v2-t-xs)/1.3 var(--v2-sans);color:var(--v2-muted)}
.v2-stats h3{margin:var(--v2-s5) 0 var(--v2-s2);font:600 var(--v2-t-sm)/1.3 var(--v2-sans);color:var(--v2-muted)}
.v2-stats svg.chart{display:block;width:100%;height:auto;overflow:visible}
.v2-stats .chart .bar{fill:var(--v2-accent)}
.v2-stats .chart .bar.zero{fill:var(--v2-line)}
.v2-stats .chart text{fill:var(--v2-muted);font:500 10px var(--v2-sans)}
.v2-stats .chart line{stroke:var(--v2-line)}
`;

/* Last 30 days as a plain SVG bar chart. */
function chart(days: { day: string; min: number }[]): SVGSVGElement {
  const W = 300, H = 120, pad = 18, max = Math.max(10, ...days.map(d => d.min)), bw = (W - 4) / days.length;
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + pad}`); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img');
  const total = Math.round(days.reduce((t, d) => t + d.min, 0));
  svg.setAttribute('aria-label', 'Minutes read per day, last 30 days. Total ' + total + ' minutes.');
  const line = document.createElementNS(ns, 'line');
  line.setAttribute('x1', '0'); line.setAttribute('x2', String(W)); line.setAttribute('y1', String(H)); line.setAttribute('y2', String(H)); svg.appendChild(line);
  days.forEach((d, i) => {
    const hgt = d.min > 0 ? Math.max(2, d.min / max * (H - 14)) : 2;
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', String(2 + i * bw + 1)); r.setAttribute('width', String(Math.max(1, bw - 2)));
    r.setAttribute('y', String(H - hgt)); r.setAttribute('height', String(hgt)); r.setAttribute('rx', '1.5');
    r.setAttribute('class', 'bar' + (d.min > 0 ? '' : ' zero'));
    const t = document.createElementNS(ns, 'title'); t.textContent = d.day + ': ' + Math.round(d.min) + ' min'; r.appendChild(t);
    svg.appendChild(r);
  });
  const lbl = (x: number, text: string, anchor: string) => { const t = document.createElementNS(ns, 'text'); t.setAttribute('x', String(x)); t.setAttribute('y', String(H + 13)); t.setAttribute('text-anchor', anchor); t.textContent = text; svg.appendChild(t); };
  lbl(0, '30 days ago', 'start'); lbl(W, 'Today', 'end');
  const top = document.createElementNS(ns, 'text'); top.setAttribute('x', '0'); top.setAttribute('y', '9'); top.textContent = Math.round(max) + ' min'; svg.appendChild(top);
  return svg;
}

export function openStats(): void {
  addStyle('v2-stats', CSS);
  const body = h('div');
  const draw = () => {
    const s = summary();
    const tile = (value: string, label: string) => h('div', { class: 'tile' }, h('b', { text: value }), h('span', { text: label }));
    body.replaceChildren(
      h('div', { class: 'tiles' },
        tile(fmtDuration(s.today) || '0 min', 'Read today'),
        tile(fmtDuration(s.week) || '0 min', 'This week'),
        tile(s.streak + (s.streak === 1 ? ' day' : ' days'), 'Current streak'),
        tile(String(s.finished), s.finished === 1 ? 'Book finished' : 'Books finished'),
        tile('≈ ' + s.wpm + ' wpm', s.measured ? 'Your reading speed' : 'Default speed (not enough reading yet)')),
      h('h3', { text: 'Last 30 days' }), chart(s.last30),
      h('p', { class: 'v2-hint', text: 'Only time with the book open and in use counts; gaps of more than 2 minutes are left out. Stats stay on this device.' }),
      h('div', { style: 'margin-top:16px' }, Button({ label: 'Reset stats', icon: 'trash', variant: 'danger', block: true, onClick: async () => {
        if (!(await confirmSheet({ title: 'Reset reading stats?', text: 'Time read, streak, finished books and your measured reading speed are deleted from this device. Your books and positions stay.', confirm: 'Reset stats', danger: true }))) return;
        try { localStorage.removeItem(KEY); } catch { /* ignore */ }
        showToast('Stats reset'); draw();
      } })));
  };
  draw();
  Sheet({ title: 'Reading stats', className: 'v2-stats', content: body });
}
