/*
 * Marginalia speech and selection fixes.
 * Loaded from index.html as a module. Safe to remove: deleting the script tag restores the old behaviour.
 *
 * 1. Starting one audio clip (e.g. voice preview) stops any other audio element that is still playing.
 * 2. The voice list keeps retrying on phones and tablets where voices load late. The app's own
 *    voiceschanged listener is re-triggered once the browser reports voices.
 * 3. The text-selection menu sits above the bottom bar instead of behind it.
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
})();
