# 04 Bot Harness and Telemetry

The agent cannot judge fun, but it can catch dead, broken, or exploitable builds before Slone sees them, and it can produce numbers that make his feedback more useful.

## Principles
- **Sim-only fast-forward.** Bots drive `step()` directly, no rendering, at high timescale (N fixed steps per tick, never bigger steps). Playwright is used for boot checks, real-time runs, and screenshots.
- **Seeded and reproducible.** Every run records `{seed, botName, inputLog}`. A failing run replays at 1x for debugging.
- **Real-time checks happen at 1x only.** Latency, juice timing, audio sync, and frame time are never measured under timescale.
- **Bounded.** Cap bot runs by sim-minutes and wall-clock. They must fit the night's time budget.
- **Output small.** Print a few summary lines; write full logs to files (`runs/<night>/…`). Large dumps fill context.

## Bot interface
```ts
interface Bot {
  name: string;
  reset(seed: number): void;
  act(obs: Observation, tick: number): Partial<InputState>; // returns inputs for this step
}
```
`Observation` is whatever the prototype exposes via `getState()` or `telemetry()`; keep it small and numeric.

## Required bot types per prototype
1. **Idle bot:** no input. Verifies pressure actually pushes (tide rises, heat builds, timer runs). A build where nothing happens when idle fails.
2. **Random bot:** random valid inputs. Finds crashes, softlocks, NaNs, out-of-bounds, and trivial exploits.
3. **Greedy/heuristic bot:** a simple competent policy for the main verb. Proves the loop is completable or scorable and gives a difficulty curve.
4. **Degenerate-strategy probe:** one bot that tries the obvious exploit (stand still in the corner, spam the main verb, run to the safe spot). If it beats the greedy bot easily, flag it. (Alien: Isolation's checkpoint-suicide strategy is the canonical example.)

## Telemetry schema (JSON per run)
```json
{
  "night": "2026-10-30-name", "seed": 1, "bot": "greedy", "mode": "content|systemic",
  "simSeconds": 312, "wallMs": 4100, "timescale": 20,
  "outcome": "completed|failed|timeout|crash",
  "metrics": {
    "runLength": 0, "deaths": 0, "firstPressureSimSec": 0, "restartDelaySimSec": 0,
    "mainVerbCount": 0, "decisionsPerMinute": 0, "idleSurvivalSec": 0,
    "scoreOrProgress": 0, "variance": 0
  },
  "perf": { "avgFrameMs": 0, "p95FrameMs": 0, "fps": 0, "particleMax": 0, "effectsOn": true },
  "feel": { "inputToVisualMs": 0, "inputToAudioMs": 0, "eventsFired": {}, "shakePeak": 0, "hitStopFrames": 0 },
  "errors": []
}
```
Prototypes add their own metrics under `metrics` and declare them in `prototype.json`.

## Content-driven vs systemic tests
- **Content-driven:** completability by the greedy bot, total content duration (target 5 to 10 min of sim time), difficulty curve across segments, no softlocks.
- **Systemic:** run-to-run variance across seeds, time to the first interesting decision, whether pressure scales, whether any single strategy dominates.

## Screenshots
Take screenshots at key moments (start, mid, a high-pressure moment, an end screen) at 1280x800. The agent reviews them for obvious problems: unreadable text, overlapping UI, blank canvas, off-screen entities. It cannot judge beauty; it can judge broken.

## Smoke test (`npm run smoke`) must verify
1. Headless boot with no console errors.
2. Synthetic gamepad input moves something.
3. 5 seconds at real time hits at least 55fps average (headless WebGL is slow; use software-rendering allowances, and mark the threshold as a warning in headless if needed, but never skip the check on real hardware).
4. An audio event fires (spy on `play`).
5. Telemetry file is written and validates against the schema.
6. A screenshot is saved and non-blank.
7. `prototype.json` validates; manifest rebuilds.
8. Return-to-launcher combo works.
The smoke test gates every merge to main and every publish.

## Honest limits
Headless WebGL may be slow or unavailable; the sim-only path avoids this. Bots can verify the build works and find exploits. They cannot say whether it is fun. The post mortem must state this plainly.
