/*
 * Marginalia speech and selection fixes.
 * Loaded from index.html as a module. Safe to remove: deleting the script tag restores the old behaviour.
 *
 * 1. Starting one audio clip (e.g. voice preview) stops any other audio element that is still playing.
 * 2. The voice list keeps retrying on phones and tablets where voices load late.
 * 3. The text-selection menu sits above the bottom bar instead of behind it.
 * 4. The top and bottom bars hide while selecting and come back when the selection ends,
 *    unless the reader hid them with a tap.
 */
(() => {
  if (window.__marginaliaSpeechFix) return;
  window.__marginaliaSpeechFix = true;

  /* 1. One audio clip at a time */
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    document.querySelectorAll("audio, video").forEach(other => {
      if (other !== this && !other.paused) other.pause();
    });
    return originalPlay.apply(this, args);
  };

  /* 2. Voice list retry */
  if ("speechSynthesis" in window) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      const select = document.getElementById("voiceSelect");
      if (!select) return;
      const showingLoading = /Loading voices/.test(select.textContent || "");
      if (!showingLoading) {
        if (select.options.length > 1) clearInterval(timer);
        return;
      }
      try {
        if (speechSynthesis.getVoices().length) {
          speechSynthesis.dispatchEvent(new Event("voiceschanged"));
        }
      } catch (e) { /* ignore */ }
      if (attempts > 120) clearInterval(timer); // give up after about a minute
    }, 500);
  }

  /* 3. Selection menu above the bottom bar */
  const style = document.createElement("style");
  style.textContent = "#selMenu{z-index:21 !important}";
  document.head.appendChild(style);

  /* 4. Bars return after selection, unless the reader hid them with a tap */
  const app = window.__reader && window.__reader.App;
  const sel = window.__reader && window.__reader.Sel;
  if (app && sel) {
    let down = null;
    let userHid = false;     // the reader tapped the bars away
    let selectionHid = false; // the bars went away because of a selection
    let lastOn = !!app.chrome;

    const showBars = on => {
      app.chrome = on;
      document.body.classList.toggle("chrome-on", on);
    };

    document.addEventListener("pointerdown", e => {
      down = { t: performance.now(), x: e.clientX, y: e.clientY, on: !!app.chrome };
    }, true);

    document.addEventListener("pointerup", e => {
      const d = down; down = null;
      if (!d) return;
      const quick = performance.now() - d.t < 400 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 12;
      // The reader handles the tap after this listener, so check on the next tick.
      setTimeout(() => {
        if (quick && d.on && !app.chrome) userHid = true;
      }, 0);
    }, true);

    setInterval(() => {
      const selecting = !!(sel.active || sel.hlId);
      const on = !!app.chrome;

      if (on !== lastOn) {
        if (on) { userHid = false; selectionHid = false; }
        lastOn = on;
      }
      if (selecting && !on) selectionHid = true;

      if (!selecting && !on && selectionHid && !userHid) {
        showBars(true);
        lastOn = true;
        selectionHid = false;
      }
      if (!selecting && !on && userHid) selectionHid = false;
    }, 150);
  }
})();
