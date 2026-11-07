# Third-party notices

This project uses or was inspired by the following open-source work.

## Ported code (copyright notice kept)

**Magic UI** (MIT). Copyright (c) Magic UI.
Licence text: https://github.com/magicuidesign/magicui/blob/main/LICENSE.md

These effects were ported from Magic UI's React components into plain JavaScript and CSS. No React or motion library is used.

| Magic UI component | Used for | Source file | Ported in |
|---|---|---|---|
| BlurFade | library cards fading up out of blur | `apps/www/registry/magicui/blur-fade.tsx` | `fixes/magic-motion.js` |
| NumberTicker | spring count-up for the library stats | `apps/www/registry/magicui/number-ticker.tsx` | `fixes/magic-motion.js` |
| Ripple | pulsing rings behind the empty state | `apps/www/registry/magicui/ripple.tsx` | `fixes/magic-motion.js` |
| ShineBorder | moving highlight on the continue-reading card | `apps/www/registry/magicui/shine-border.tsx` | `fixes/magic-motion.js` |
| GlareHover | light sweep across a cover on hover | `apps/www/registry/magicui/glare-hover.tsx` | `fixes/library-depth.js` |
| MagicCard | spotlight that follows the pointer | `apps/www/registry/magicui/magic-card.tsx` | `fixes/library-depth.js` |

## Loaded at runtime

| Component | Use | Licence | Source |
|---|---|---|---|
| JSZip 3.10.1 | Opens EPUB files | MIT (per the package) | https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js |
| PDF.js 3.11.174 | Renders PDF pages | Apache-2.0 (per the package) | https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js |

## Vendored (copied into this repository)

| Component | Use | Licence | Source | Files |
|---|---|---|---|---|
| @floating-ui/dom 1.8.0 | Positions the v2 text-selection menu next to the selection | MIT, Copyright (c) 2021-present Floating UI contributors (`vendor/floating-ui/LICENSE`) | https://www.npmjs.com/package/@floating-ui/dom/v/1.8.0 (`dist/floating-ui.dom.browser.mjs`) | `vendor/floating-ui/floating-ui.dom.js` |
| @floating-ui/core 1.8.0 | Dependency of the above | MIT, same copyright | https://www.npmjs.com/package/@floating-ui/core/v/1.8.0 (`dist/floating-ui.core.browser.mjs`) | `vendor/floating-ui/floating-ui.core.js` |

Only change: the import of `@floating-ui/core` in `floating-ui.dom.js` points to `./floating-ui.core.js`, and both files use `.js` instead of `.mjs` so GitHub Pages serves them as JavaScript.

| Component | Use | Licence | Source | Files |
|---|---|---|---|---|
| simplex-noise 4.0.3 | Noise for the slow "flux" background on the library, Discover and Settings (drawn to a tiny canvas) | MIT, Copyright (c) 2018 Jonas Wagner (`vendor/simplex-noise/LICENSE`) | https://www.npmjs.com/package/simplex-noise/v/4.0.3 (`dist/esm/simplex-noise.js`, 18.7 KB, no dependencies) | `vendor/simplex-noise/simplex-noise.js` |

Unchanged copy of the package's ES module.

## Researched for ideas (not copied)

| Project | Why it was reviewed | Licence status |
|---|---|---|
| Anime.js | Animation library option | Open source; confirm the licence in its repository |
| Motion One | Web Animations API option | Open source; confirm the licence in its repository |
| GSAP | Timeline animation option | Free core; check its licence terms for commercial use |
| Lenis | Smooth scrolling option | Open source; confirm the licence in its repository |
| canvas-confetti | Celebration particles option | Open source; confirm the licence in its repository |
| fdesjardins/webgl | WebGL examples | MIT (per a listing in our research) |
| tomhsiao1260/gl-playground | WebGL examples | MIT (per a listing in our research) |
| tdiprima/threejs-playground | WebGL examples | Listed as "other"; not used |

## AnimatedWebs

Nothing from AnimatedWebs is included. Their source is only available to paying accounts, and the generated hero was removed.

## Your own licence

This file does not set a licence for the project's own code. Add a `LICENSE` file if you want one.
