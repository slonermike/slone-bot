# 02 Scaffold Core

The core is small, boring, and stable. Prototypes build on it; they do not fork it.

## Layout
```
src/
  core/        loop, rng, input, time, debug, telemetry hooks, save-less state
  juice/       ease, tween, squashStretch, flash, shake, hitStop, trail, eyes, particles wrapper
  audio/       synth, sampleLoader, bus, play()
  launcher/    card grid, input focus, feedback-sheet display
  bots/        bot interface, bot runners (see 04)
  protos/      one folder per prototype slug (empty on main except the bare smoke-test fixture _fixture)
scripts/       themes.mjs, night-state.mjs, preflight.mjs, build-site.mjs
tests/         smoke tests
```

## Core contract for every prototype
A prototype exports a factory that returns an object with these parts. Names are the contract; the scaffold calls them.
```ts
interface Prototype {
  meta: PrototypeMeta;                 // matches prototype.json
  init(ctx: Ctx): void;                // create sim state, load assets, no drawing here
  step(dt: number, input: InputState): void; // ONE fixed sim step. Pure logic. No Pixi, no DOM, no audio calls
  events(): SimEvent[];                // drained each frame; sim emits events like 'hit', 'pickup', 'pressure'
  render(alpha: number): void;         // draw using sim state; interpolate with alpha
  onEvent(e: SimEvent): void;          // juice and audio hooks fire HERE, driven by sim events
  telemetry(): Record<string, number>; // current metrics for the bot harness
  getState?(): unknown;                // optional, for debugging/replays
}
```

## Fixed timestep and sim/render split
- Fixed step `DT = 1/60`. The loop accumulates real time, runs N steps, then renders once with an interpolation alpha. Clamp the accumulator so a hitch cannot spiral.
- **The sim must not touch rendering, DOM, audio, or `Math.random`.** It emits events; the render layer turns events into juice and sound. This is what lets bots run the sim without drawing, and what makes telemetry trustworthy.
- **Timescale** (for bots) runs N fixed steps per frame, never larger steps. Larger steps change physics and invalidate tests.
- **Hit-stop** is implemented by skipping sim steps for a few frames (a time-freeze counter in the loop), not by changing DT.

## Seeded RNG
- All randomness goes through `ctx.rng` (a seeded PRNG such as sfc32 or mulberry32). Seed comes from the URL (`?seed=123`) or a default.
- Visual-only randomness (particle jitter) uses a separate `ctx.vfxRng` so it cannot desync the sim.
- Runs are reproducible: a failure found at 20x timescale can be replayed at 1x with the same seed and the same bot inputs.

## Input layer
- One module wraps the Gamepad API (standard mapping) into `InputState`: left stick, right stick, d-pad, face buttons (A/B/X/Y), shoulders and triggers (analog value plus pressed), start/select, optional `gyro: {x,y,z}` (zeros if unavailable).
- Dead zones and stick shaping live here, tunable per prototype.
- **Input buffering and coyote time** helpers live here too (see feel checklist).
- **Reserved combo:** Select + Start (held 0.5s) returns to the launcher from any prototype. Prototypes must not consume this combo.
- **Pause:** Start toggles pause. The launcher injects a pause overlay with "Resume / Restart / Back to launcher / Juice dial / Feedback sheet".
- **Keyboard fallback** for debugging only; bots inject synthetic input into the same `InputState`.
- **Gyro:** delivered through Steam Input mapped to stick or mouse; the layer exposes it as optional. Prototypes work without it.

## Debug overlay
Toggle with Select + A. Shows FPS, frame time, sim steps per frame, input-to-response latency (button press to first visible/audio response), event counts, and juice layer toggles. Everything also goes to telemetry.

## Time budget helpers
`ctx.time` exposes sim time (steps) and wall time. Sim code must use sim time only.

## Analytics hook (stub only)
`track(event: string, props?: Record<string, number | string | boolean>)` exists from day one as a **no-op**. The loop and the launcher call it for session start/end, restarts, deaths, and key sim events. It does nothing and makes no network calls until the analytics roadmap item is built. Keep props numeric or enumerated; never pass personal or device identifiers.

## Save state
Prototypes are session-only. No persistence required. (A prototype may use `localStorage` for settings only, wrapped in try/catch.)

## Reuse rule
Anything a night builds that a later night could reuse (e.g. a camera follow, a spatial hash, a pressure-curve generator) moves into `src/core` or `src/juice` on main with a short entry in `SCAFFOLD_API.md`, only if the smoke test still passes.
