/*
 * Marginalia speech fixes.
 * Loaded from index.html as a module. Safe to remove: deleting the script tag restores the old behaviour.
 *
 * Fix: starting one audio clip (e.g. voice preview) now stops any other audio element
 * that is still playing, so two clips never overlap.
 */
(() => {
  if (window.__marginaliaSpeechFix) return;
  window.__marginaliaSpeechFix = true;

  const originalPlay = HTMLMediaElement.prototype.play;

  HTMLMediaElement.prototype.play = function (...args) {
    document.querySelectorAll("audio, video").forEach(other => {
      if (other !== this && !other.paused) {
        other.pause();
      }
    });
    return originalPlay.apply(this, args);
  };
})();
