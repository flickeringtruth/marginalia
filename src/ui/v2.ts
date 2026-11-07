/* v2 UI entry. Loaded last by fixes/read-along-size.js.
   - Always: adds "New interface (preview)" to Settings › Appearance. It sets or clears
     localStorage "marginalia.ui" and reloads.
   - Only when localStorage "marginalia.ui" === "v2": installs the tokens and components,
     maps the engine's layers onto the v2 z-index scale and mounts the v2 library.
   With the key unset nothing else happens, so the app behaves exactly as before. */

import { installTokens } from './tokens.js';
import { installComponents } from './components.js';
import { portalRoot } from './overlay.js';
import { mountLibrary } from './library.js';
import { mountReader } from './reader/index.js';
import { mountDiscover } from './discover.js';

const KEY = 'marginalia.ui';
const isOn = (): boolean => { try { return localStorage.getItem(KEY) === 'v2'; } catch { return false; } };

/* Uses the engine's own settings markup (.grp, .switch-row, .switch), because the Settings
   sheet itself is still the old UI until session 3. */
function addSettingsSwitch(): void {
  const body = document.getElementById('settingsBody');
  if (!body || body.querySelector('[data-v2-switch]')) return;
  const group = document.createElement('div');
  group.className = 'grp';
  group.innerHTML = '<h3>Interface</h3>' +
    '<button class="switch-row" type="button" role="switch" data-v2-switch>New interface (preview)<span class="switch"></span></button>' +
    '<p class="hint">Turns on the redesigned library. The page reloads. Turn it off to go back to the current interface. Your books and settings are not changed.</p>';
  body.appendChild(group);
  const btn = group.querySelector<HTMLButtonElement>('[data-v2-switch]');
  if (!btn) return;
  const on = isOn();
  btn.setAttribute('aria-checked', String(on));
  btn.querySelector('.switch')?.classList.toggle('on', on);
  btn.addEventListener('click', () => {
    try { if (isOn()) localStorage.removeItem(KEY); else localStorage.setItem(KEY, 'v2'); } catch { return; }
    location.reload();
  });
}

function start(): void {
  addSettingsSwitch();
  if (!isOn() || !window.__reader) return;
  document.documentElement.classList.add('ui-v2');
  installTokens();
  installComponents();
  portalRoot();
  mountLibrary();
  mountReader();
  mountDiscover();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

export {};
