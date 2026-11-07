/* v2 UI entry. Loaded last by fixes/read-along-size.js. v2 is the only interface: installs the tokens
   and components, maps the engine's layers onto the v2 z-index scale and mounts the theme, library,
   reader and Discover. */

import { installTokens } from './tokens.js';
import { installComponents } from './components.js';
import { portalRoot } from './overlay.js';
import { mountLibrary } from './library.js';
import { mountReader } from './reader/index.js';
import { mountDiscover } from './discover.js';
import { mountTheme } from './theme.js';

function start(): void {
  if (!window.__reader) return;
  document.documentElement.classList.add('ui-v2');
  installTokens();
  installComponents();
  portalRoot();
  mountTheme();
  mountLibrary();
  mountReader();
  mountDiscover();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

export {};
