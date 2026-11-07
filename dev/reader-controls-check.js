/* Clicks every v2 reader control from docs/reader-controls.md and checks that its handler did
   something. For development only; not loaded by the app.
   Use: open a TXT/EPUB book with localStorage "marginalia.ui" = "v2", load dev/overlap-check.js,
   dev/reader-check.js and this file in the console, then:  await marginaliaControlsCheck()
   Optional: pass a fake Edge Worker URL (http://localhost:…) to test Edge preview and downloads.
   Read-aloud runs at volume 0; ambient sound at 2 %. Returns { control: 'yes' | 'NO …' }. */
(function () {
  const S = ms => new Promise(r => setTimeout(r, ms));
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
  const settle = () => document.getAnimations().forEach(a => { try { a.finish(); } catch (e) { /* ignore */ } });
  const step = async (ms = 150) => { await S(ms); settle(); await S(40); };
  const R = () => window.__reader;
  const sh = () => { const s = qa('#v2-portal .v2-sheet'); return s[s.length - 1]; };
  const B = (re, root) => [...(root || sh()).querySelectorAll('button')].find(b => re.test(b.getAttribute('aria-label') || b.textContent.trim()));
  const waitFor = async fn => { for (let i = 0; i < 30 && !fn(); i++) await step(150); return fn(); };
  const closeAll = async () => {
    for (let i = 0; i < 8 && q('#v2-portal .v2-sheet, #v2-portal .v2-menu'); i++) {
      const c = q('#v2-portal .v2-catcher');
      if (c) c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); else sh().querySelector('.v2-sheet-head .v2-ibtn').click();
      await step(80);
    }
    qa('.sheet.open, .drawer.open').length && q('#scrim').click(); await step(300);
  };
  const bars = on => window.marginaliaBars(on);
  const bar = l => q(`#v2-reader [aria-label="${l}"]`);
  const title = () => sh() && sh().querySelector('h2').textContent;
  const tab = () => sh() && (sh().querySelector('[role=radio][aria-checked=true]') || {}).textContent;
  const press = async (pi, dx, dy, type = 'touch', hold = 600) => {
    const p = [...q('.chap[data-ch="0"]').querySelectorAll('p')][pi], r = p.getBoundingClientRect(), st = q('#stage');
    const o = { bubbles: true, clientX: r.left + dx, clientY: r.top + dy, pointerId: 9, pointerType: type, isPrimary: true, button: 0 };
    st.dispatchEvent(new PointerEvent('pointerdown', o)); await S(hold); st.dispatchEvent(new PointerEvent('pointerup', o)); await step(200);
  };
  const tapAt = async (x, y) => { const st = q('#stage'), o = { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'mouse', button: 0 }; st.dispatchEvent(new PointerEvent('pointerdown', o)); await S(40); st.dispatchEvent(new PointerEvent('pointerup', o)); await step(150); };
  const key = async k => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); await step(250); };
  const act = l => q(`.v2-selmenu [aria-label="${l}"]`);

  window.marginaliaControlsCheck = async function (fakeWorker) {
    const r = R(), T = r.TTS, res = { size: innerWidth + '×' + innerHeight };
    window.marginaliaControlsProgress = res;   // partial results while it runs
    const ok = (k, v, why) => { res[k] = v ? 'yes' : 'NO' + (why != null ? ' (' + why + ')' : ''); };
    r.setAudio('volume', 0); r.setAudio('engine', 'device');
    await closeAll(); await r.goToPercent(0); await step(400);

    /* 1. bars */
    bars(false); await step();
    await tapAt(innerWidth / 2, innerHeight / 2); ok('tap shows bars', document.body.classList.contains('chrome-on'));
    await tapAt(innerWidth / 2, innerHeight / 2); ok('tap hides bars', !document.body.classList.contains('chrome-on'));
    bars(true);
    const p0 = r.App.r.page; bar('Next page').click(); await step(600); ok('next page', r.App.r.page === p0 + 1);
    bar('Previous page').click(); await step(600); ok('previous page', r.App.r.page === p0);
    const sc = q('#v2-reader .scrub input'); sc.value = '500'; sc.dispatchEvent(new Event('input')); sc.dispatchEvent(new Event('change')); await step(900);
    ok('scrubber', Math.abs(r.App.progress.pct - 0.5) < 0.1); await r.goToPercent(0); await step(400);
    bars(true); bar('Contents').click(); await step(); ok('contents button', tab() === 'Contents'); await closeAll();
    const wide = getComputedStyle(bar('Bookmarks and notes')).display !== 'none';
    if (wide) { bars(true); bar('Bookmarks and notes').click(); await step(); ok('bookmarks button', tab() === 'Bookmarks'); await closeAll(); }
    bars(true); bar('Read aloud').click(); await step(900); ok('read aloud button', T.state === 'playing' || T.state === 'loading');
    bar('Read aloud').click(); await step(300); ok('read aloud toggles off', T.state === 'paused'); await T.stop(false); await step();
    if (wide) { bars(true); bar('Dictionary').click(); await step(500); ok('dictionary button', q('#dictSheet').classList.contains('open')); await closeAll(); }
    bars(true); bar('More').click(); await step(); ok('more button', title() === 'More'); await closeAll();
    bars(true); bar('Appearance settings').click(); await step(); ok('appearance button', title() === 'Settings' && tab() === 'Appearance'); await closeAll();

    /* keyboard shortcuts reach the v2 sheets */
    await key('t'); ok('key T → contents', tab() === 'Contents'); await closeAll();
    await key('s'); ok('key S → appearance', tab() === 'Appearance'); await closeAll();
    await key('a'); ok('key A → audio settings', tab() === 'Audio'); await closeAll();
    await key('h'); ok('key H → highlights', tab() === 'Highlights'); await closeAll();

    /* 7. more rows */
    for (const [row, check] of [
      ['Bookmarks and notes', () => tab() === 'Bookmarks'], ['Dictionary', () => q('#dictSheet').classList.contains('open')],
      ['Highlights', () => tab() === 'Highlights'], ['AI Assistant', () => q('#chatSheet').classList.contains('open')],
      ['Ambient sound', () => tab() === 'Audio'], ['Focus-word speed read', () => !q('#speedReader').classList.contains('hidden')],
      ['Auto scroll', () => r.AutoScroll && (r.AutoScroll.active || !q('#autoScrollControls').classList.contains('hidden'))]
    ]) {
      r.ui.openMore('reader'); await step(); const li = [...sh().querySelectorAll('.v2-li')].find(b => b.querySelector('b').textContent === row);
      if (!li) { ok('more › ' + row, false, 'row missing'); continue; }
      li.click(); await step(700); ok('more › ' + row, check());
      if (!q('#speedReader').classList.contains('hidden')) { q('#speedClose').click(); await step(400); }
      if (r.AutoScroll && r.AutoScroll.active) { q('#autoScrollStop') && q('#autoScrollStop').click(); await step(400); }
      await closeAll();
      if (r.S.layout !== 'paged') { await r.setSetting('layout', 'paged'); await step(800); }
    }

    /* 2. contents sheet */
    const id = r.App.book.id; localStorage.removeItem('marginalia.bookmarks.' + id); localStorage.removeItem('marginalia.notes.' + id);
    r.ui.openContents('toc'); await step(); qa('#v2-portal .v2-toc .go')[1].click(); await step(700); ok('contents › chapter row', r.App.r.getLoc().ch === 1 && !sh());
    await r.goToPercent(0); await step(400);
    r.ui.openContents('bm'); await step(); B(/^Bookmark this place$/).click(); await step(400);
    ok('bookmark this place', JSON.parse(localStorage.getItem('marginalia.bookmarks.' + id) || '[]').length === 1);
    const srch = sh().querySelector('input[type=search]'); srch.value = 'zzz'; srch.dispatchEvent(new Event('input')); await step(); ok('bookmark search', /No bookmarks match/.test(sh().textContent));
    srch.value = ''; srch.dispatchEvent(new Event('input')); await step();
    B(/^Newest$/).click(); await step(); ok('bookmark sort', B(/^Newest$/).getAttribute('aria-checked') === 'true');
    B(/^Options for bookmark/).click(); await step(250); qa('#v2-portal .v2-menu [role=menuitem]').find(b => /Edit/.test(b.textContent)).click(); await step(300);
    sh().querySelector('.v2-field input').value = 'Start'; B(/^Save$/).click(); await step(300);
    ok('bookmark edit', JSON.parse(localStorage.getItem('marginalia.bookmarks.' + id))[0].title === 'Start');
    sh().querySelector('.v2-row .go').click(); await step(500); ok('bookmark go', !sh());
    r.ui.openContents('bm'); await step(); B(/^Options for bookmark/).click(); await step(250); qa('#v2-portal .v2-menu [role=menuitem]').find(b => /Delete/.test(b.textContent)).click(); await step(300);
    B(/^Remove$/).click(); await step(300); ok('bookmark delete', JSON.parse(localStorage.getItem('marginalia.bookmarks.' + id)).length === 0);
    let dl = null; const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { dl = this.download; };
    r.HL.add(0, 300, 340, 'pink', q('.chap[data-ch="0"]')); await step();
    B(/^Export as Markdown$/).click(); HTMLAnchorElement.prototype.click = orig; ok('export', /notes\.md$/.test(dl || ''));
    await closeAll();
    r.ui.openContents('hl'); await step(); ok('highlights list', sh().querySelectorAll('.v2-row').length >= 1);
    sh().querySelector('.v2-row .go').click(); await step(500); ok('highlight go', !sh());
    r.ui.openContents('hl'); await step(); const n0 = r.HL.list.length; B(/^Remove highlight$/).click(); await step(); ok('highlight remove', r.HL.list.length === n0 - 1); await closeAll();

    /* 6. selection menu + notes */
    await r.goToPercent(0); await step(400); bars(false);
    await press(0, 120, 40);
    const m = q('.v2-selmenu'), mr = m.getBoundingClientRect();
    ok('selection menu opens', !m.hidden); ok('selection menu on screen', mr.left >= 0 && mr.top >= 0 && mr.right <= innerWidth && mr.bottom <= innerHeight);
    ok('selection menu overlap check', window.marginaliaOverlapCheck().overlaps.length === 0);
    act('Note').click(); await step(300); ok('selection › note opens editor', title() === 'Note');
    sh().querySelector('textarea').value = 'A thought'; B(/^Save note$/).click(); await step(400);
    ok('note saved', JSON.parse(localStorage.getItem('marginalia.notes.' + id) || '[]')[0].note === 'A thought');
    await S(300); const nm = q('mark.ml-note'); ok('note painted in text', !!nm);
    if (nm) { const nr = nm.getBoundingClientRect(), o = { bubbles: true, clientX: nr.left + 3, clientY: nr.top + nr.height / 2, pointerId: 11, pointerType: 'mouse', button: 0 }; const el = document.elementFromPoint(o.clientX, o.clientY); el.dispatchEvent(new PointerEvent('pointerdown', o)); await S(40); el.dispatchEvent(new PointerEvent('pointerup', o)); await step(300); }
    ok('tap note in text opens editor', title() === 'Note'); await closeAll();
    r.ui.openContents('nt'); await step(); B(/^Edit note$/).click(); await step(300); sh().querySelector('textarea').value = 'Edited'; B(/^Save note$/).click(); await step(300);
    ok('notes tab › edit', JSON.parse(localStorage.getItem('marginalia.notes.' + id))[0].note === 'Edited');
    B(/^Edit note$/).click(); await step(300); B(/^Delete note$/).click(); await step(300); B(/^Delete$/).click(); await step(400);
    ok('notes tab › delete', JSON.parse(localStorage.getItem('marginalia.notes.' + id)).length === 0); await closeAll();
    const h0 = r.HL.list.length; await press(0, 60, 70); act('Blue highlight').click(); await step(300); ok('selection › colour', r.HL.list.length === h0 + 1);
    await press(0, 200, 100); act('Copy').click(); await step(300); ok('selection › copy', /Copied/.test(q('#toast').textContent));
    await press(0, 200, 130); act('Look up').click(); await step(500); ok('selection › look up', q('#dictSheet').classList.contains('open')); await closeAll();
    await press(0, 200, 160); act('Ask AI').click(); await step(500); ok('selection › ask AI', q('#chatSheet').classList.contains('open')); await closeAll();
    await press(0, 150, 190); act('Read').click(); await step(900); ok('selection › read', T.state === 'playing' || T.state === 'loading'); await T.stop(false); await step();
    const mk = q('mark.hl'), kr = mk.getBoundingClientRect(); await tapAt(kr.left + kr.width / 2, kr.top + kr.height / 2);
    ok('tap highlight › menu with remove', !m.hidden && !!act('Remove'));
    const h1 = r.HL.list.length; act('Remove').click(); await step(300); ok('selection › remove', r.HL.list.length === h1 - 1);
    ok('share shown only when supported', !!act('Share') === !!navigator.share);

    /* 5. player */
    T.playFrom(0, 0); await step(1200); const mini = q('#v2-reader .mini'); bars(true);
    ok('mini player', !mini.hidden); ok('mini overlap check', window.marginaliaOverlapCheck().overlaps.length === 0);
    mini.querySelector('[aria-label="Pause"]').click(); await step(300); ok('mini pause', T.state === 'paused');
    mini.querySelector('[aria-label="Play"]').click(); await step(800); ok('mini play', T.state !== 'paused' && T.state !== 'idle');
    mini.querySelector('.mid').click(); await step(250); ok('mini › player', title() === 'Read aloud');
    let x = T.pos; B(/^Forward 5 seconds$/).click(); await step(600); ok('forward 5 s', T.pos > x);
    x = T.pos; B(/^Back 5 seconds$/).click(); await step(600); ok('back 5 s', T.pos < x);
    x = T.pos; B(/^Next paragraph$/).click(); await step(600); ok('next paragraph', T.pos > x);
    x = T.pos; B(/^Previous paragraph$/).click(); await step(600); ok('previous paragraph', T.pos < x);
    const sk = sh().querySelector('input[aria-label="Listening position in chapter"]'); sk.value = '500'; sk.dispatchEvent(new Event('input')); sk.dispatchEvent(new Event('change')); await step(800); ok('seek', r.audioInfo().pct > 0.3);
    B(/^Faster$/).click(); await step(); ok('faster', Math.abs(r.A.rate - 1.1) < 0.01); B(/^Slower$/).click(); B(/^Slower$/).click(); await step(); ok('slower', Math.abs(r.A.rate - 0.9) < 0.01);
    B(/^Reset speed$/).click(); await step(); ok('reset speed', r.A.rate === 1);
    const ra = +localStorage.getItem('marginalia.readAlongSize'); B(/^Read-along text larger$/).click(); await step(); ok('read-along larger', +localStorage.getItem('marginalia.readAlongSize') > ra || ra === 44);
    B(/^Read-along text smaller$/).click(); await step(); ok('read-along smaller', +localStorage.getItem('marginalia.readAlongSize') <= ra || ra === 0);
    B(/^Sleep/).click(); await step(250); qa('#v2-portal .v2-menu [role=menuitem]').find(b => /15 minutes/.test(b.textContent)).click(); await step(); ok('sleep menu', r.A.sleep === 15); r.setAudio('sleep', 0);
    B(/^Voice/).click(); await step(300); ok('player › voice', tab() === 'Audio'); await closeAll();
    mini.querySelector('.mid').click(); await step(250); B(/^Audio settings$/).click(); await step(300); ok('player › audio settings', tab() === 'Audio'); await closeAll();
    mini.querySelector('.mid').click(); await step(250); B(/^Read along$/).click(); await step(400); ok('player › read along', document.body.classList.contains('audio-lyrics-open'));
    q('#abLyricsClose').click(); await step(300);
    mini.querySelector('[aria-label="Read along"]').click(); await step(300); ok('mini › read along', document.body.classList.contains('audio-lyrics-open')); q('#abLyricsClose').click(); await step(300);
    T.suspended = true; r.AudioUI.chip(true); await step(200); ok('mini › voice elsewhere', !mini.querySelector('.away').hidden);
    [...mini.querySelectorAll('.away .v2-btn')].find(b => /Read from here/.test(b.textContent)).click(); await step(600); ok('read from here', !T.suspended);
    T.suspended = true; r.AudioUI.chip(true); await step(200); [...mini.querySelectorAll('.away .v2-btn')].find(b => /Go to voice/.test(b.textContent)).click(); await step(600); ok('go to voice', !T.suspended);
    if (fakeWorker) {
      r.A.edgeProxy = fakeWorker; r.setAudio('engine', 'edge'); await step(300);
      mini.querySelector('.mid').click(); await step(250);
      B(/^Download chapter$/).click(); await step(300); ok('player › download chapter', window.__marginaliaTTSDownloads.status().running || /Download/.test(window.__marginaliaTTSDownloads.status().text));
      for (let i = 0; i < 40 && window.__marginaliaTTSDownloads.status().running; i++) await S(250);
      B(/^Download book$/).click(); await step(300); ok('player › download book', window.__marginaliaTTSDownloads.status().running || /Download/.test(window.__marginaliaTTSDownloads.status().text));
      window.__marginaliaTTSDownloads.cancel(); await step(300); await closeAll();
      r.ui.openSettings('audio'); await step(300); B(/^Preview$/).click(); await step(800); ok('edge preview (no error)', !/failed/i.test(q('#toast').textContent));
      await closeAll(); r.setAudio('engine', 'device');
    }
    mini.querySelector('.mid').click(); await step(250); B(/^Stop reading aloud$/).click(); await step(600);
    const msg = q('#msgSheet'); if (msg.classList.contains('open')) { [...msg.querySelectorAll('button')].find(b => /Stop/.test(b.textContent)).click(); await step(400); }
    ok('stop', T.state === 'idle'); ok('mini hidden after stop', mini.hidden);

    /* back to library */
    bars(true); bar('Back to library').click(); await step(800); ok('back to library', r.App.screen === 'library');
    await r.openBook(id); await step(1200);
    r.setAudio('volume', 100);
    return res;
  };
})();
