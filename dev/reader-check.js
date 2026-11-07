/* Reader check for the v2 UI: opens every bar, sheet, tab and menu and runs the overlap check
   (dev/overlap-check.js) in each state. For development only; not loaded by the app.
   Use: open a book with localStorage "marginalia.ui" = "v2", load this file and
   dev/overlap-check.js in the console, then:  await marginaliaReaderCheck()
   Read-aloud is started at volume 0 for the mini player and player states. */
(function () {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const settle = () => document.getAnimations().forEach(a => { try { a.finish(); } catch (e) { /* ignore */ } });
  const R = () => window.__reader;
  function bars(on) { const r = R(); r.App.chrome = on; document.body.classList.toggle('chrome-on', on); clearTimeout(r.App.chromeTimer); }
  function check() { settle(); const c = window.marginaliaOverlapCheck(); return c.overlaps.length ? c.overlaps : 'ok (' + c.checked + ' controls)'; }
  async function closeAll() {
    for (let i = 0; i < 6 && document.querySelector('#v2-portal .v2-sheet, #v2-portal .v2-menu'); i++) {
      const c = document.querySelector('#v2-portal .v2-catcher');
      if (c) c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      else { const s = document.querySelectorAll('#v2-portal .v2-sheet'); s[s.length - 1].querySelector('.v2-sheet-head .v2-ibtn').click(); }
      await sleep(60); settle(); await sleep(60);
    }
  }
  const tabs = () => [...document.querySelectorAll('#v2-portal .v2-sheet .v2-seg [role=radio]')];
  const body = () => document.querySelector('#v2-portal .v2-sheet-body');

  window.marginaliaReaderCheck = async function () {
    const r = R(), out = { size: innerWidth + '×' + innerHeight };
    r.setAudio('volume', 0);
    if (r.TTS.state !== 'idle') await r.TTS.stop(false);
    bars(true); await sleep(150); out.bars = check();
    r.TTS.playFrom(0, 0); await sleep(1200);
    bars(true); await sleep(150); out['bars + mini player'] = check();
    r.ui.openContents('toc'); await sleep(100);
    for (const t of tabs()) { t.click(); await sleep(120); out['contents › ' + t.textContent] = check(); }
    await closeAll();
    r.ui.openSettings('look'); await sleep(120); out['settings › appearance'] = check();
    body().scrollTop = 99999; await sleep(100); out['settings › appearance (end)'] = check();
    tabs()[1].click(); await sleep(200); body().scrollTop = 0; out['settings › audio'] = check();
    body().scrollTop = 99999; await sleep(100); out['settings › audio (end)'] = check();
    await closeAll();
    r.ui.openMore('reader'); await sleep(120); out.more = check(); await closeAll();
    document.querySelector('#v2-reader .mini .mid').click(); await sleep(150); out.player = check();
    const sb = [...document.querySelectorAll('#v2-portal .v2-player .v2-btn')].find(b => /Sleep/.test(b.textContent));
    sb.click(); await sleep(150); out['player › sleep menu'] = check();
    await closeAll();
    out.sheetsLeftOpen = document.querySelectorAll('#v2-portal .v2-sheet').length;
    await r.TTS.stop(false); r.setAudio('volume', 100);
    return out;
  };
  window.marginaliaBars = bars;
  window.marginaliaSettle = settle;
})();
