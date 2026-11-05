/* Moves the ⋯ edit button from the top-left corner (where it covered the EPUB badge)
   to the bottom-right of the cover. Loaded from index.html as a module.
   Remove the script tag to put the button back where it was. */
/* Also loads the Read on site, cover designs and User settings modules.
   (index.html is too large to edit remotely, so they are pulled in from here.
   Modules only run once even if index.html later gets its own script tags.) */
import './read-on-site.js';
import './covers.js';
import './user-data.js';

(() => {
  if (window.__marginaliaTagFix) return;
  window.__marginaliaTagFix = true;

  const style = document.createElement('style');
  style.textContent = `
    .ml-tag{top:auto!important;left:auto!important;bottom:8px!important;right:8px!important;width:36px!important;height:36px!important;border-radius:18px;background:rgba(0,0,0,.45)!important;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font-size:16px!important;text-shadow:none!important}
    .ml-tag:active{background:rgba(0,0,0,.7)!important}`;
  document.head.appendChild(style);

  const place = () => {
    document.querySelectorAll('#libGrid .card').forEach(card => {
      const tag = card.querySelector('.ml-tag'), cover = card.querySelector('.cover-btn');
      if (tag && cover && tag.parentNode !== cover) cover.appendChild(tag);
    });
  };

  const grid = document.getElementById('libGrid');
  if (grid) new MutationObserver(place).observe(grid, { childList: true, subtree: true });
  place();
})();
