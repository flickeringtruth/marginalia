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
