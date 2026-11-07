/* Where the reader is, in characters. The engine measures position in characters too
   (book.lengths per chapter, book.total), so time left and "go to page" use the same units. */

import { reader } from '../dom.js';

export interface Where { bookId: string; ch: number; off: number; pos: number; total: number; chLen: number }

export function where(): Where | null {
  const R = reader(), b = R.App.book, r = R.App.r;
  if (!b || !r || !r.getLoc || b.type === 'pdf' || !b.lengths || !b.total) return null;
  let loc: { ch: number; off?: number; frac?: number; atEnd?: boolean };
  try { loc = r.getLoc(); } catch { return null; }
  if (loc.ch < 0) return null;
  const L = b.lengths, chLen = L[loc.ch] || 0;
  let off = loc.off != null && loc.off >= 0 ? loc.off : Math.round((loc.frac || 0) * chLen);
  if (loc.atEnd) off = chLen;
  let cum = 0; for (let i = 0; i < loc.ch; i++) cum += L[i] || 0;
  return { bookId: b.id, ch: loc.ch, off: Math.min(off, chLen), pos: cum + Math.min(off, chLen), total: b.total, chLen };
}

/* "1 h 5 min", "12 min", "under a minute" */
export function fmtDuration(minutes: number): string {
  if (!isFinite(minutes) || minutes < 0) return '';
  if (minutes < 1) return 'under a minute';
  const m = Math.round(minutes);
  if (m < 60) return m + ' min';
  const hh = Math.floor(m / 60), mm = m % 60;
  return hh + ' h' + (mm ? ' ' + mm + ' min' : '');
}
