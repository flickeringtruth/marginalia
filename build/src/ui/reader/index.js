/* v2 reader entry (sessions 3 and 5): mounts the bars, mini player, selection menu and the reading
   tracker, and registers the v2 sheets with the engine (window.__reader.ui), so every way of opening
   them — buttons, keyboard shortcuts, the engine's own calls — reaches the v2 versions. */
import { reader } from '../dom.js';
import { mountChrome } from './chrome.js';
import { openContents, openNoteEditor } from './contents.js';
import { openSettings } from './settings.js';
import { mountPlayer } from './player.js';
import { mountSelection } from './selection.js';
import { openMore } from './more.js';
import { openSearch } from './search.js';
import { openGoTo, barLabel } from './goto.js';
import { mountStats, openStats } from './stats.js';
export function mountReader() {
    const R = reader();
    const settings = (tab = 'look', group) => openSettings(tab, group);
    const contents = (tab) => openContents(tab);
    const actions = { contents, settings, search: openSearch, goTo: openGoTo, stats: openStats };
    R.ui.openSettings = tab => settings(tab);
    R.ui.openContents = tab => contents(tab);
    R.ui.openMore = where => openMore(where, actions);
    window.__marginaliaOpenNote = k => openNoteEditor(k, false);
    const chrome = mountChrome({
        contents: () => contents('toc'),
        bookmarks: () => contents('bm'),
        settings: () => settings('look'),
        more: () => openMore('reader', actions),
        search: openSearch,
        label: barLabel
    });
    mountPlayer(chrome, () => settings('audio'));
    mountSelection();
    mountStats();
}
