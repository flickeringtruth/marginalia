/* Marginalia voice list helper.
   Loaded from index.html as a module. Remove the script tag to turn it off.
   On iPhone/iPad, Safari can report extra voices only after a speech request was made
   from a user tap. The first tap inside audio settings primes the engine, then the
   app's voice list is asked to refresh a few times. */
(() => {
  if (window.__marginaliaVoices || !('speechSynthesis' in window)) return;
  window.__marginaliaVoices = true;

  let primed = false;
  const refresh = () => {
    try {
      if (speechSynthesis.getVoices().length) speechSynthesis.dispatchEvent(new Event('voiceschanged'));
    } catch (e) { /* ignore */ }
  };

  document.addEventListener('click', e => {
    if (!e.target || !e.target.closest || !e.target.closest('#audioBody')) return;
    if (!primed) {
      primed = true;
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
      } catch (err) { /* ignore */ }
    }
    setTimeout(refresh, 300);
    setTimeout(refresh, 1500);
    setTimeout(refresh, 4000);
  }, true);
})();
