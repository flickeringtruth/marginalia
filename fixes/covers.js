/* Marginalia cover designs: pick a ready-made cover in the book editor. The title and author are
   placed on the design. Loaded from index.html as a module. Remove the script tag to turn it off. */
(() => {
  if (window.__marginaliaCovers) return;
  window.__marginaliaCovers = true;

  const PRESETS = [
    { id: 'midnight', name: 'Midnight', bg: ['#1b2735', '#090a0f'], fg: '#f2e6c9', accent: '#d4af37' },
    { id: 'parchment', name: 'Parchment', bg: ['#f4ead5', '#e3cfa5'], fg: '#3b2a1a', accent: '#8b5e3c', frame: true },
    { id: 'forest', name: 'Forest', bg: ['#2f4b3a', '#16251c'], fg: '#f3ead0', accent: '#e8d9a8' },
    { id: 'ocean', name: 'Ocean', bg: ['#0f4c75', '#3282b8'], fg: '#ffffff', accent: '#bde0fe' },
    { id: 'rose', name: 'Rose', bg: ['#fbe3e8', '#f0a9b8'], fg: '#4a1d2a', accent: '#9b3b56' },
    { id: 'sunset', name: 'Sunset', bg: ['#ff9a62', '#ff5e7e'], fg: '#fff8f0', accent: '#ffe3c2' },
    { id: 'ink', name: 'Ink', bg: ['#fafafa', '#e6e6e6'], fg: '#111111', accent: '#111111', frame: true }
  ];

  const toast = msg => {
    const t = document.querySelector('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._mlT); t._mlT = setTimeout(() => t.classList.remove('on'), 1600);
  };

  function wrapLines(g, text, maxW) {
    const words = String(text).split(/\s+/), lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (line && g.measureText(t).width > maxW) { lines.push(line); line = w; }
      else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  function draw(p, title, author) {
    const W = 600, H = 900, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, W * 0.3, H);
    grd.addColorStop(0, p.bg[0]); grd.addColorStop(1, p.bg[1]);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    if (p.frame) {
      g.strokeStyle = p.accent;
      g.lineWidth = 3; g.strokeRect(36, 36, W - 72, H - 72);
      g.lineWidth = 1; g.strokeRect(50, 50, W - 100, H - 100);
    }
    const maxW = W - 150, fam = 'Georgia,"Times New Roman",serif';
    let size = 76, lines = [];
    for (; size >= 34; size -= 4) {
      g.font = '600 ' + size + 'px ' + fam;
      lines = wrapLines(g, title || 'Untitled', maxW);
      if (lines.length <= 5) break;
    }
    const lh = size * 1.18, block = lines.length * lh, mid = H * 0.42;
    const top = mid - block / 2;
    g.fillStyle = p.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, W / 2, top + lh * i + lh / 2));
    g.fillStyle = p.accent;
    g.fillRect(W / 2 - 60, top - 44, 120, 2);
    g.fillRect(W / 2 - 60, top + block + 42, 120, 2);
    if (author) {
      let s = 34;
      g.font = 'italic ' + s + 'px ' + fam;
      while (g.measureText(author).width > maxW && s > 16) { s -= 2; g.font = 'italic ' + s + 'px ' + fam; }
      g.fillText(author, W / 2, top + block + 96);
    }
    return new Promise(res => c.toBlob(res, 'image/jpeg', 0.9));
  }

  function inject(root) {
    if (root.dataset.mlp) return;
    root.dataset.mlp = '1';
    const row = root.querySelector('.ml-cover-row'); if (!row) return;
    const box = document.createElement('div');
    box.className = 'mlp';
    box.innerHTML = '<p class="mlp-title">Or pick a design <span>type the title and author first</span></p>' +
      '<div class="mlp-grid">' + PRESETS.map(p =>
        `<button type="button" class="mlp-btn" data-preset="${p.id}" style="background:linear-gradient(160deg,${p.bg[0]},${p.bg[1]});color:${p.fg}" aria-label="${p.name} cover"><span>${p.name}</span></button>`
      ).join('') + '</div>';
    row.insertAdjacentElement('afterend', box);
    box.addEventListener('click', async e => {
      const b = e.target.closest('[data-preset]'); if (!b) return;
      const p = PRESETS.find(x => x.id === b.dataset.preset);
      const title = root.querySelector('#mlTitle').value.trim() || 'Untitled';
      const author = root.querySelector('#mlAuthor').value.trim();
      try {
        const blob = await draw(p, title, author);
        const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
        const input = root.querySelector('#mlFile');
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change'));
        toast('Cover applied');
      } catch (err) { toast('That design could not be made.'); }
    });
  }

  const css = `
  .mlp{margin-top:14px}
  .mlp-title{color:var(--muted);font-size:13px;margin:0 0 8px}
  .mlp-title span{opacity:.8}
  .mlp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .ml-sheet .mlp-btn{height:84px;min-height:84px;padding:6px 4px;border-radius:8px;display:flex;align-items:flex-end;justify-content:center;font-size:11px;font-weight:700;letter-spacing:.02em;border:0;box-shadow:0 1px 3px rgba(0,0,0,.15)}
  .ml-sheet .mlp-btn span{text-shadow:0 1px 2px rgba(0,0,0,.2)}
  .ml-sheet .mlp-btn:active{transform:scale(.97)}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // The book editor is created on demand, so watch for it.
  new MutationObserver(() => {
    document.querySelectorAll('.ml-sheet[aria-label="Edit book"]').forEach(inject);
  }).observe(document.body, { childList: true, subtree: true });
})();
