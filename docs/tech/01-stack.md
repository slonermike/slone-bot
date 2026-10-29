# 01 Stack

## Decision
A rendering library plus our own thin scaffold. No full game engine: engines hide the loop, and game feel lives in the loop. We also need headless observation, which is far easier when we own the simulation.

## Chosen stack (2D first)
| Layer | Choice | Notes |
|---|---|---|
| Build | Vite + TypeScript | Relative `base` so builds work from any subfolder |
| Rendering | PixiJS | Filters and particles for juice. Check the current major version at install time |
| Physics | Rapier (2D) via WASM | One API to learn that also covers the future 3D track. Optional: a prototype may skip physics |
| Audio | WebAudio, our own synth | Plus an optional sample loader |
| Input | Gamepad API | Standard mapping, wrapped by our input layer |
| Headless | Playwright + Chromium | Scripted bots, screenshots, telemetry |
| Hosting | Static files on one site | See `05-launcher-manifest-hosting.md` |
| CI | GitHub Actions | Build `proto/*` branches into `/p/<slug>/` |

## Alternatives considered
Raw Canvas 2D (total control but slow to anything fancy), Phaser (opinionated, less timing control), Three.js + Rapier (3D, deferred), Babylon.js (heavy), Godot/Unity web export (large builds, threading headers, awkward headless; skip).

## Rules
- **Check versions at install time.** Do not trust remembered versions or APIs; read the current docs or changelogs for PixiJS, Rapier, and Playwright.
- **Prefer boring, mainstream libraries.** If adding a dependency, note why in the scaffold API doc.
- **No runtime network calls** from prototypes (offline, single player). All assets bundled.
- **Bundle size:** keep a prototype build under a few MB; log the size in the manifest.
- **Particles:** use an existing library or Pixi's built-in capabilities. Do not write a particle engine (a known time trap).
- **Target device assumptions:** Steam Deck browser (Chromium-based). Avoid cutting-edge web APIs without a fallback. Assume 1280x800, 60fps.
- **SteamOS context:** the Deck runs the launcher site in a Chromium-based browser added as a non-Steam shortcut. Steam Input provides the controller; the page sees a standard gamepad.

## Sandbox facts to verify at preflight
- Headless Chromium launches under Playwright.
- npm and pip registries reachable (pip needs `--break-system-packages`).
- Other websites are likely blocked by an allowlist. If a download fails, do not retry with workarounds; fall back to synthesis or log it.
