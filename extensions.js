/* Marginalia extensions (currently empty).
   The Kokoro experiment was removed; the last version is in commit 2806262.
   This only resets the engine setting if it was left on "kokoro". */
(function cleanup(tries) {
  const R = window.__reader;
  if (R && R.A && R.setAudio) { if (R.A.engine === 'kokoro') R.setAudio('engine', 'device'); return; }
  if (tries > 0) setTimeout(function () { cleanup(tries - 1); }, 50);
})(200);
