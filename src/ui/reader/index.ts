/* v2 reader entry (session 3): mounts the bars, mini player and selection menu, and registers
   the v2 sheets with the engine (window.__reader.ui), so every way of opening them — buttons,
   keyboard shortcuts, the engine's own calls — reaches the v2 versions. */

import { reader } from '../dom.js';
import { mountChrome } from './chrome.js';
import { openContents, openNoteEditor } from './contents.js';
import { openSettings } from './settings.js';
import { mountPlayer } from './player.js';
import { mountSelection } from './selection.js';
import { openMore } from './more.js';

export function mountReader(): void {
  const R = reader();
  const settings = (tab: 'look' | 'audio' = 'look', group?: string) => openSettings(tab, group);
  const contents = (tab?: string) => openContents(tab);

  R.ui.openSettings = tab => settings(tab);
  R.ui.openContents = tab => contents(tab);
  R.ui.openMore = where => openMore(where, { contents, settings });
  window.__marginaliaOpenNote = k => openNoteEditor(k, false);

  const chrome = mountChrome({
    contents: () => contents('toc'),
    bookmarks: () => contents('bm'),
    settings: () => settings('look'),
    more: () => openMore('reader', { contents, settings })
  });
  mountPlayer(chrome, () => settings('audio'));
  mountSelection();
}
