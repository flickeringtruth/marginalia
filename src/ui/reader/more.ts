/* v2 More sheet (library and reader). Replaces the engine's #moreSheet; the rows come from the
   engine's moreItems() and run through moreAction(), so the list stays in one place.
   In the reader it also offers Bookmarks and Dictionary, which narrow phones hide from the top bar. */

import { reader } from '../dom.js';
import { IconName } from '../icons.js';
import { ListItem, Sheet } from '../components.js';

const ICONS: Record<string, IconName> = { hl: 'edit', autoscroll: 'scroll', speed: 'zap', ai: 'sparkle', convcur: 'file', convpick: 'file', amb: 'wave', look: 'type', bm: 'bookmark', dict: 'dictionary' };

export function openMore(where: 'library' | 'reader', open: { contents: (tab?: string) => void; settings: (tab: 'look' | 'audio', group?: string) => void }): void {
  const R = reader();
  const items = R.moreItems(where).slice();
  if (where === 'reader' && R.App.book) {
    items.unshift({ id: 'bm', title: 'Bookmarks and notes', sub: 'Your places and thoughts in this book' });
    if (R.App.book.type !== 'pdf') items.splice(1, 0, { id: 'dict', title: 'Dictionary', sub: 'Look up a word' });
  }
  const s = Sheet({
    title: 'More',
    content: items.map(it => ListItem({ title: it.title, subtitle: it.sub, icon: ICONS[it.id] || 'more', onClick: () => {
      s.close();
      // Let the sheet finish closing before the next one opens (same delay as the engine).
      setTimeout(() => {
        if (it.id === 'bm') open.contents('bm');
        else if (it.id === 'dict') R.dictionaryButton();
        else if (it.id === 'hl') open.contents('hl');
        else if (it.id === 'amb') open.settings('audio', 'Ambient sound');
        else if (it.id === 'look') open.settings('look');
        else void R.moreAction(it.id);
      }, 60);
    } }))
  });
}
