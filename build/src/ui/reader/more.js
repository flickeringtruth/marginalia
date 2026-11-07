/* v2 More sheet (library and reader). Replaces the engine's #moreSheet; the engine rows come from
   moreItems() and run through moreAction(), so that list stays in one place.
   v2 adds: Bookmarks and Dictionary (hidden from the top bar on narrow phones), Search in book,
   Go to page and Reading stats (session 5). */
import { reader } from '../dom.js';
import { ListItem, Sheet } from '../components.js';
const ICONS = { hl: 'edit', autoscroll: 'scroll', speed: 'zap', ai: 'sparkle', convcur: 'file', convpick: 'file', amb: 'wave', look: 'type',
    bm: 'bookmark', dict: 'dictionary', search: 'search', goto: 'location', stats: 'chart' };
export function openMore(where, open) {
    const R = reader();
    const items = R.moreItems(where).slice();
    const text = !!R.App.book && R.App.book.type !== 'pdf';
    if (where === 'reader' && R.App.book) {
        const extra = [
            text ? { id: 'search', title: 'Search in book', sub: 'Find words anywhere in this book' } : null,
            { id: 'goto', title: 'Go to page', sub: 'Jump to a page or percentage, see time left' },
            { id: 'bm', title: 'Bookmarks and notes', sub: 'Your places and thoughts in this book' },
            text ? { id: 'dict', title: 'Dictionary', sub: 'Look up a word' } : null
        ].filter((x) => !!x);
        items.unshift(...extra);
    }
    items.push({ id: 'stats', title: 'Reading stats', sub: 'Time read, streak, books finished, speed' });
    const s = Sheet({
        title: 'More',
        content: items.map(it => ListItem({ title: it.title, subtitle: it.sub, icon: ICONS[it.id] || 'more', onClick: () => {
                s.close();
                // Let the sheet finish closing before the next one opens (same delay as the engine).
                setTimeout(() => {
                    if (it.id === 'bm')
                        open.contents('bm');
                    else if (it.id === 'dict')
                        R.dictionaryButton();
                    else if (it.id === 'hl')
                        open.contents('hl');
                    else if (it.id === 'amb')
                        open.settings('audio', 'Ambient sound');
                    else if (it.id === 'look')
                        open.settings('look');
                    else if (it.id === 'search')
                        open.search();
                    else if (it.id === 'goto')
                        open.goTo();
                    else if (it.id === 'stats')
                        open.stats();
                    else
                        void R.moreAction(it.id);
                }, 60);
            } }))
    });
}
