# Attribution

Third-party credits for minigame-bot. One row per asset or notable dependency, grouped by prototype and by "scaffold/shared". Code is MIT licensed (see `LICENSE`, copyright Mike Slone). Everything the agent synthesizes or draws in code (sound effects, shapes, the demo prototype) is original and needs no attribution.

| Item | Author | Source URL | License | Date pulled | Used in | Modified? |
|---|---|---|---|---|---|---|
| Space Grotesk (font, via @fontsource) | Florian Karsten | https://github.com/floriankarsten/space-grotesk | SIL OFL 1.1 | 2026-10-29 | Launcher | No |

## Dependencies

Production dependencies that ship in the built site. All are permissive and commercially reusable. Verified by `npm run licenses`.

| Item | Author | Source URL | License | Date pulled | Used in | Modified? |
|---|---|---|---|---|---|---|
| PixiJS (pixi.js 8.x) | Pixi.js contributors | https://github.com/pixijs/pixijs | MIT | 2026-10-29 | Rendering, all prototypes | No |
| Rapier 2D (@dimforge/rapier2d-compat 0.21) | Dimforge | https://github.com/dimforge/rapier.js | Apache-2.0 | 2026-10-29 | Optional physics (bundled only when a prototype imports it) | No |
| @fontsource/space-grotesk | Fontsource contributors | https://github.com/fontsource/font-files | OFL-1.1 | 2026-10-29 | Launcher font files | No |
| PixiJS transitive dependencies (@pixi/colord, earcut, eventemitter3, gifuct-js, ismobilejs, parse-svg-path, tiny-lru, @xmldom/xmldom) | Various | https://www.npmjs.com/ | MIT, ISC, BSD-3-Clause | 2026-10-29 | Rendering | No |

Development tools (not shipped): Vite, TypeScript, Vitest, Playwright (MIT or Apache-2.0).

## Prototypes

None yet. Each night adds its own rows here, in the same commit as the asset.

## Removed

None.
