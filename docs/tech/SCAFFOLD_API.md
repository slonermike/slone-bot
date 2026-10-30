# SCAFFOLD_API

How a nightly agent uses everything the scaffold provides. Read this instead of the internals. This document is the whole contract: there is deliberately no example game to copy. (`src/protos/_fixture/` is a bare smoke-test fixture (the file in section 1a); earlier games live on their own branches and are not to be opened or imitated. Every night has a different look; see Step 1 of `docs/tech/06` and the brief template.)

Imports from a prototype at `src/protos/<slug>/index.ts`:
```ts
import { Rng, InputBuffer, Coyote, shapeStick, track } from '../../core/index.ts';
import { play, defineSound } from '../../audio/index.ts';
import { tween, ease, shake, hitStop, flash, punch, SquashStretch, Trail, Particles, Eyes, numberPop, dial, bakeTexture, SpritePool } from '../../juice/index.ts';
import { idleBot, randomBot, steerToward } from '../../bots/index.ts';
```

## 1. Making a prototype

Folder `src/protos/<slug>/` (slug = `YYYY-MM-DD-name`, lowercase, digits, `-`, `_`):
```
prototype.json   manifest (section 8)
sim.ts           PURE sim: no Pixi, no DOM, no audio, no Math.random (so bots and unit tests import it)
index.ts         render + juice + audio; exports createPrototype and bots
bots.ts          greedy bot + a degenerate-strategy probe
assets/          only licensed or original assets, each in ATTRIBUTION.md
```
`index.ts` must export:
```ts
export function createPrototype(): Prototype          // required
export const bots: Bot[]                              // required in practice: at least 'greedy' and one 'degenerate-*'
```
The `Prototype` contract (names are fixed; the shell calls them):
```ts
interface Prototype {
  meta: { slug, title, question, targetFeeling, mode: 'content' | 'systemic' };
  init(ctx: Ctx): void;                       // create sim state. No drawing.
  step(dt: number, input: InputState): void;  // ONE fixed step (dt = 1/60). Pure logic.
  events(): SimEvent[];                       // drain and return events emitted since the last call
  mount?(view: View): void;                   // OPTIONAL but where you build Pixi objects (not called in bot runs)
  render(alpha: number): void;                // draw from sim state; interpolate previous->current with alpha
  onEvent(e: SimEvent): void;                 // juice + audio fire HERE, driven by sim events
  telemetry(): Record<string, number>;        // numeric metrics for bots (finite numbers only)
  getState?(): unknown;                       // small numeric observation for bots
  balance?: BalanceSpec[];                    // the 3 to 8 tweakable values shown in the pause menu's Balance screen (section 1b)
  dispose?(): void;
}
```
Two additions to the doc 02 contract: `mount(view)` (the place to create display objects, since `init` must not draw) and `dispose()`.

**Run it:** `npm run dev:proto -- <slug>` (hot reload on :5173), or `npm run build:site && npm run serve` (the real launcher on :4173).

**Ending a run:** a sim that emits an event of type `complete` ends a bot run as `completed`; `gameover` ends it as `failed`. Systemic builds just run until the time cap (`timeout`).

### 1a. The smallest valid prototype
Every required piece and nothing else: no style, so there is nothing to imitate but the shape. This file is real code (a test builds it, runs the bots on it and checks that this section contains it verbatim). Put your sim in `sim.ts` and your render in `index.ts` as described above; it is one file here only to keep it short.
```ts
// The smallest valid prototype: every required piece, no style. A grey square, a ring to touch, nothing else.
// Copy the SHAPE of this (contract, event flow, bots, balance), never a look: pick your own palette, shapes and feel.
import { Graphics } from 'pixi.js';
import { play } from '../../audio/index.ts';
import { steerToward } from '../../bots/index.ts';
import type { Bot, Ctx, InputState, Prototype, SimEvent, View } from '../../core/types.ts';

const R = 24; // the square's half-size
const GOAL_R = 34;

export function createPrototype(): Prototype {
  let ctx!: Ctx;
  let x = 640, y = 400, px = 640, py = 400; // position now and one step ago (for render interpolation)
  let gx = 900, gy = 300; // the ring
  let reached = 0;
  let out: SimEvent[] = [];
  let body: Graphics;
  let goal: Graphics;

  return {
    meta: { slug: 'minimal', title: 'Minimal', question: 'Does the contract work?', targetFeeling: 'neutral', mode: 'systemic' },
    balance: [{ id: 'speed', label: 'Move speed', min: 200, max: 700, step: 20, default: 420 }],

    // sim: pure, no Pixi, no audio, no Math.random (use ctx.rng); the bots run exactly this
    init(c: Ctx) { ctx = c; },
    step(dt: number, input: InputState) {
      px = x; py = y;
      if (input.buttons.a.pressed) out.push({ type: 'ping', magnitude: 0.5, x, y }); // buttons become events too
      const speed = ctx.balance.speed ?? 420;
      x = Math.max(R, Math.min(1280 - R, x + input.left.x * speed * dt));
      y = Math.max(R, Math.min(800 - R, y + input.left.y * speed * dt));
      if (Math.hypot(gx - x, gy - y) < R + GOAL_R) {
        reached++;
        out.push({ type: 'reach', magnitude: 0.6, x: gx, y: gy }); // juice and audio react to events, not to sim state
        gx = ctx.rng.range(100, 1180);
        gy = ctx.rng.range(100, 700);
      }
    },
    events() { const e = out; out = []; return e; },

    // render: build display objects in mount, draw from sim state in render, react to events in onEvent
    mount(view: View) {
      body = new Graphics().rect(-R, -R, 2 * R, 2 * R).fill(0x888888);
      goal = new Graphics().circle(0, 0, GOAL_R).stroke({ width: 4, color: 0xaaaaaa });
      (view.world as import('pixi.js').Container).addChild(goal, body);
    },
    render(alpha: number) {
      body.position.set(px + (x - px) * alpha, py + (y - py) * alpha);
      goal.position.set(gx, gy);
    },
    onEvent(e: SimEvent) {
      if (e.type === 'reach') play('pickup');
      if (e.type === 'ping') play('dash');
    },

    // what the bots and telemetry can see: small, numeric
    telemetry: () => ({ reached, scoreOrProgress: reached }), // scoreOrProgress lets the suite compare bots
    getState: () => ({ x, y, gx, gy }),
  };
}

// at least a greedy bot and a degenerate-strategy probe (idle and random are built in)
const num = (o: Record<string, unknown>, k: string) => Number(o[k] ?? 0);
export const bots: Bot[] = [
  { name: 'greedy', reset() {}, act: (o) => ({ left: steerToward(num(o, 'x'), num(o, 'y'), num(o, 'gx'), num(o, 'gy')) }) },
  { name: 'degenerate-corner', reset() {}, act: () => ({ left: { x: -1, y: -1 } }) },
];
```

### Ctx (what `init` and sim code may use)
| Field | Use |
|---|---|
| `ctx.rng` | THE sim RNG (`next()`, `range(a,b)`, `int(a,b)`, `chance(p)`, `pick(arr)`, `gauss()`, `shuffle(arr)`, `fork()`). Seeded from `?seed=N`. |
| `ctx.vfxRng` | Visual-only randomness. Never use in sim code. |
| `ctx.time.steps`, `.seconds` | Sim time. Sim code uses this, never wall time. |
| `ctx.dt` | `1/60` |
| `ctx.params` | URL query params, e.g. `ctx.params.hard === '1'` |
| `ctx.seed` | The seed in use. |
| `ctx.balance` | Live balance values by id (section 1b). Read them every step; they change when Slone moves a slider. Fall back to the spec default if a key is missing. |

Default seed: random per launch (restart picks the next one); `?seed=N` pins it (restart repeats it). Bots always pass explicit seeds.

### 1b. Balance knobs (required: 3 to 8 per build)
AI is weak at balance, so every build exposes a handful of values for Slone to tune in the pause menu (**Balance** screen). Declare them on the prototype and read them in the sim:
```ts
export const BALANCE: BalanceSpec[] = [
  { id: 'heatRamp', label: 'Heat ramp (faster each second)', min: 0, max: 0.6, step: 0.02, default: 0.2 },
  { id: 'lives', label: 'Lives (next run)', min: 1, max: 6, step: 1, default: 3 },
];
// in createPrototype(): return { ..., balance: BALANCE, ... }
// in the sim: const ramp = ctx.balance.heatRamp ?? 0.2;   // read live each step
```
Choose knobs for what is most likely mis-tuned: pressure rate and ramp, how fast the player's power grows, forgiveness (lives, relief per success), pacing of new layers. Write plain labels, sensible defaults, and ranges that stay playable at both ends. Values are saved per device (`localStorage`, key `mgb.balance.v1.<slug>`), the menu can reset them and **copy** them as text for chat, and `?balance=id:value,id:value` overrides them (tests, bots). Telemetry records the values used (`balance`). Bots take overrides: `runSim(create, bot, { balance: { lives: 1 } })`. Later (roadmap): Slone's chosen values will be saved to a global API so all players get them, so keep knob ids stable. Helpers: `defaultsOf`, `mergeBalance`, `clampValue`, `formatValue`, `parseBalanceParam`, `loadBalance`, `saveBalance`, `clearBalance`, `balanceToText` in `core/balance.ts`. Say in the post mortem which knob to try first.

### InputState (what `step` receives)
```ts
input.left, input.right            // {x, y} -1..1 after dead zone, y positive = DOWN
input.buttons.a.down|pressed|released|value   // names: a b x y lb rb lt rt ls rs up down left right
input.gyro                         // {x,y,z}, zeros if unavailable (optional input; never require it)
```
`pressed`/`released` are true for exactly one step. `start` and `select` are reserved by the shell and always read false. Select+A is also swallowed. D-pad doubles as the left stick when the stick is idle.

Helpers (all in sim steps, so deterministic):
```ts
const jumpBuf = new InputBuffer(6);   // if (input.buttons.a.pressed) jumpBuf.press(); jumpBuf.step(); if (canJump && jumpBuf.consume()) jump();
const coyote = new Coyote(6);         // if (onGround) coyote.ground(); coyote.step(); if (coyote.active) allowJump
shapeStick(x, y, { deadzone: 0.15, curve: 2 })
```

### View (given to `mount`)
`view.world` (Pixi Container that shakes; put game objects here), `view.ui` (never shakes; HUD), `view.app` (Pixi Application; cast `view.app as Application`), `view.width/height` (1280x800), `view.frame.dt` (real seconds), `view.onFrame(fn)` (per-frame callbacks for particles/eyes/squash updates).

## 2. Shell behavior you get for free
Fixed 60 Hz timestep, accumulator clamp, interpolation alpha, hit-stop. "PRESS A TO START" title screen (satisfies the audio-gesture rule). **Start** pauses with the menu (Resume / Restart / Back to launcher / Juice dial / Feedback sheet). **Select+Start held 0.5 s** returns to the launcher. **Select+A** toggles the debug overlay (FPS, frame ms, steps/frame, input-to-visual/audio ms, events, juice). Auto-pause when the tab is hidden. Play time is recorded for the launcher. Keyboard fallback (also fine for playing on a desktop): arrows/WASD = left stick, Space/Enter/Z = A, X/Backspace = B, C = X, V = Y, Q/E = LB/RB, **Esc = Start** (pause, and Back inside menus), Shift = Select. Pause menu and launcher menus work from the keyboard too (arrows, Space/Enter, Esc).

**Button labels follow the device the player used last** (`glyph('a')` is "A" on a gamepad and "Space" on a keyboard; remembered across page loads). Never hard-code "Press A" in text:
```ts
import { glyph, stickGlyph, onDeviceChange } from '../../core/index.ts';
hint.text = `${stickGlyph('left')}: push    ${glyph('a')}: dash`;   // "Left stick: push  A: dash" or "WASD / arrows: push  Space: dash"
```
Text is re-evaluated by you: update labels in a `view.onFrame` callback (compare before assigning) or subscribe with `onDeviceChange(fn)`. `getDevice()` returns `'keyboard' | 'gamepad'`. Distinguishing between kinds of gamepad (Xbox vs PlayStation glyphs) is not done yet.

URL flags: `?seed=N`, `?autostart=1` (skip the title screen), `?debug=1`, `?juice=off` or `?juice=shake,audio` (layers), `?intensity=0.5`.

## 3. Juice (`src/juice`)
All respect the juice dial: if a layer is off, the helper does nothing.

| Helper | Signature / example |
|---|---|
| `ease` | `ease.linear, inQuad, outQuad, outCubic, inOut, outBack, outElastic, outBounce` (each `(t) => number`) |
| `chase` | `x = chase(x, target, 0.15)`; `chaseDt(x, target, 0.15, dtSeconds)` is frame-rate independent |
| `lerp`, `clamp`, `lerpColor` | plain math helpers |
| `tween` | `tween(sprite, { alpha: 0, 'scale.x': 2 }, 300, ease.outBack, { delay: 50, jitter: 40, onComplete })`. `scale: 2` sets both axes. `tint` interpolates as a color. A new tween on the same property replaces the old one. Real-time (not sim) clock. |
| `SquashStretch` | `const ss = new SquashStretch(container)`; each render `ss.update(dt, vx, vy)`; on impact `ss.pop(0.4, 'y')`. Put it on a container, not the eyes. |
| `punch` / `punchPosition` | `punch(obj, 0.3)` scale impulse that springs back; `punchPosition(obj, 8, 0)` |
| `flash` | `flash(container, 0xffffff, 110)` blends toward a color and fades. Uses one color filter per object; use on the few things that matter. |
| `shake` | `shake(0.4)`: add trauma 0..1 (felt shake is trauma squared, amplitude capped). The shell applies it to `view.world`. |
| `hitStop` | `hitStop(4)`: freeze the sim for N steps (3 to 8 reads well). |
| `Trail` | `const t = new Trail(view.world, { color, width, length })`; `t.push(x, y)` then `t.draw()` each render; `t.clear()` |
| `Particles` | `const p = new Particles(view.world)`; `view.onFrame((dt) => p.update(dt))`; `p.emit('sparks', x, y, { count, color, speed, size, angle, spread })`. Presets: `puff`, `debris`, `confetti`, `sparks`, `dust`. Capped per emit (64) and in total (600). Wraps Pixi's `ParticleContainer`. **Options:** `new Particles(view.world, { texture, confettiColors: [...] })`: the soft disc is the default; pass your own texture (see `bakeTexture`) for any other particle look, and `confettiColors` to use the game's palette. |
| `Eyes` | `const e = new Eyes({ size: 8 })`; add `e.container` to an entity; `view.onFrame((dt) => e.update(dt))`; `e.lookAt(dx, dy)`, `e.setMood('happy' | 'worried' | 'frown' | 'neutral', seconds)`, `e.blink()` |
| `numberPop` | `numberPop(view.world, '+1', x, y, { color, size, rise, ms, font, stroke, strokeWidth })`. The outline scales with size by default; set `stroke` to a color that contrasts with BOTH the text and whatever it floats over (light text on a bright background needs a dark outline). |
| `bakeTexture`, `SpritePool` | For crowds: bake a shape once (`const tex = bakeTexture(view.app as Application, (g) => g.poly(...).fill(c))`), then each frame `pool.begin(); const sp = pool.next(tex); sp.position.set(x, y); ... pool.end();` (hides unused sprites). Far cheaper than redrawing hundreds of vector shapes every frame. |
| `dial` | the juice dial: `dial.enabled('shake')`, `dial.scale('shake', amount)`, `dial.toggle(layer)`, `dial.setIntensity(0.5)`, `dial.activeLayers()`. Layers: `shake, particles, hitStop, squashStretch, flash, trails, eyes, audio`. |
| `vfx()`, `vfxRange(a, b)` | visual-only randomness (seeded from `ctx.vfxRng`) |

**Effect stacking rule:** every main-verb action gets at least a motion response, a flash or squash, a sound, and a particle or shake. Scale with `e.magnitude`; do not use one strength for everything.

## 4. Audio (`src/audio`)
```ts
play('hit', { pitch: 1 + combo * 0.08, volume: 0.4 + 0.6 * m, pan: -0.3, variation: 0.04 });
defineSound('boom', { wave: 'noise', freq: 120, slide: -1.2, attack: 0.002, sustain: 0.05, decay: 0.3, lowpass: 900, transient: 0.4, volume: 0.5 });
defineSound('step', [variantA, variantB, variantC]);   // round-robin variants for frequent sounds
```
Built-in names: `jump land hit pickup pressureUp fail recover dash click ui-move ui-select ui-back`. Call `play` only from `onEvent` (never from `step`).

`SfxParams`: `wave` (`square|saw|triangle|sine|noise`), `freq` Hz, `slide` (octaves/s), `deltaSlide`, `duty`, `attack/sustain/decay` (s), `punch`, `vibratoDepth/vibratoSpeed`, `lowpass/highpass` (Hz), `crush` (bits), `transient` (layered click), `volume`. Tie params to gameplay: pitch with combo, volume with impact. Sounds are generated as sample buffers in code (original, no attribution needed) and are deterministic.

Other: `audio.setVolume('master'|'sfx'|'music'|'ui', 0..1)`, `audio.setMuted(bool)`, `audio.samples(name)` (raw Float32Array, for loudness/clipping checks), `renderSfx`, `peakOf`, `rmsOf`. Every `play` call is recorded in `audio.log`/`audio.counts`, which is how bots and the smoke test verify audio events fired even with no sound hardware. Latency: the debug overlay and telemetry report input-to-audio and input-to-visual ms measured from the scaffold's poll (they exclude display and controller hardware latency).

## 5. Bots and telemetry (`src/bots`)
```ts
interface Bot { name: string; reset(seed: number): void; act(obs: Observation, tick: number): BotInput }
interface BotInput { left?: {x?, y?}; right?: {x?, y?}; hold?: ButtonName[]; lt?: number; rt?: number }
```
`BotInput` is a compact form of `Partial<InputState>`: list the buttons held this step in `hold`; the runner derives press/release edges (release a button for one tick to press it again). `obs` is whatever your `getState()` returns (or `telemetry()` if absent); keep it small and numeric.

Helpers: `idleBot()`, `randomBot()`, `steerToward(fx, fy, tx, ty)` (unit vector), `num(obs, 'key')`.

**Required per prototype:** idle (built in), random (built in), `greedy` (yours), and one `degenerate-*` probe (yours). Run them all:
```
npm run bots -- <slug>                  # sim-only, 3 seeds x all bots, writes runs/<slug>/telemetry/*.json, prints a few lines + flags
npm run bots -- <slug> --shots          # also builds, plays in real time in headless Chromium, saves runs/<slug>/screens/*.png
npm run bots -- <slug> --shots --thumb  # also writes src/protos/<slug>/thumb.png for the launcher card
npm run media -- <slug>                 # smooth fixed-frame-rate preview.gif + thumb.png (see Capture mode)
```
Programmatic: `runSim(createPrototype, bot, { seed, maxSimSeconds, maxWallMs, stepsPerTick })` returns `{ telemetry, inputLog, samples }`; `runSuite(createPrototype, bots, { seeds })` returns `{ runs, flags, summary }`; `replay(createPrototype, seed, inputLog, steps)` reproduces a run at 1x. Fast-forward runs more fixed steps per tick; it never enlarges dt. Flags: idle bot saw nothing happen, greedy no better than idle, a degenerate bot near greedy's score, crashes, NaN/Infinity telemetry.

Telemetry JSON (schema in `src/bots/telemetry.ts`, `validateTelemetry()`): `{ night, seed, bot, mode, simSeconds, wallMs, timescale, outcome, metrics, perf, feel, errors }`. Standard `metrics` keys: `runLength deaths firstPressureSimSec restartDelaySimSec mainVerbCount decisionsPerMinute idleSurvivalSec scoreOrProgress variance`; whatever your `telemetry()` returns is added (declare custom ones in `prototype.json`). Sim-only runs leave `perf`/`feel` at zero (real-time checks happen at 1x only). In the browser, `window.__scaffold.snapshot()` returns a real-time telemetry object with frame stats, latency, event counts, shake peak, hit-stop frames.

Browser hooks (smoke test and `--shots` use these): `window.__scaffold` exposes `proto`, `balance` (live values), `input` (`input.inject({ left, right, hold })`), `state()`, `snapshot()`, `start()`, `restart()`, `setPaused()`, `attachBot(bot)`, `stats()`, `audioLog`.

## 6. Physics (optional)
```ts
import { loadPhysics } from '../../core/physics.ts';
const RAPIER = await loadPhysics();            // lazy; adds ~2 MB (WASM) only to builds that import it
const world = new RAPIER.World({ x: 0, y: 980 });  // step once per sim step with a fixed timestep to stay deterministic
```
Rapier needs async init and so cannot be called inside the synchronous `init`; load it before returning the prototype (top-level `await` in `index.ts`) or skip physics for a night this small.

## 7. Analytics stub
`track(event, props?)` from `core` is a **no-op**. The shell calls it for `session_start`, `session_end`, `restart`, and every sim event; the launcher for `launcher_open` and `card_launch`. No network, no storage. Keep props numeric or enumerated; never pass personal or device identifiers. (Roadmap item; do not build more.)

## 8. Manifest: `prototype.json`
Fields: `slug, title, date, question, targetFeeling, mode ('content'|'systemic'), tags[], theme, wildcard (string|null), juiceLayers[], metrics[], assets[], buildStatus, feedbackStatus, sizeKB, thumbnail`. Validate with `validateManifest()` (build fails on errors). `assets[]` entries: `{ file, source, author?, license, date }`; allowed licenses are the allowlist in `docs/tech/08`. `buildStatus`, `sizeKB`, and `thumbnail` are overwritten by the build. Optional files the build picks up: `src/protos/<slug>/thumb.png`, `src/protos/<slug>/preview.gif` (the launcher plays it on the focused card; the build sets the manifest's `preview`; make both with `npm run media -- <slug>`), `runs/<slug>/postmortem.md`, `runs/<slug>/feedback-sheet.md` (the launcher shows them with the X button).

## 9. Build, test, publish
| Command | What it does |
|---|---|
| `npm run smoke` | Builds the site, then runs the headless end-to-end gate (boot, input, fps, audio, telemetry, screenshot, manifest, return combo). Gates every merge to main and every publish. |
| `npm run build:site` | Launcher plus every prototype into `dist-site/`. Options: `--out DIR --protos a,b\|all\|none --no-launcher --broken SLUG` |
| `npm run bots -- <slug>` | Section 5 |
| `npm run dev:proto -- <slug>` / `npm run serve` | Dev server / serve `dist-site` on :4173 |
| `npm test`, `npm run typecheck`, `npm run secrets`, `npm run licenses`, `npm run check` | Unit tests, types, secret scan, license audit, all of them |
| `node scripts/night-state.mjs start \| checkpoint <phase> [note] \| set k=v \| check \| atoms` | Run protocol (docs/tech/06). `check` exits 2 after 3:30. |
| `node scripts/preflight.mjs` | Tool and network report |
| `node scripts/themes.mjs roll \| resolve \| add` | Theme pool (docs/tech/07). Never read `themes/*.json` directly. |

Smoke fps: headless software rendering is slow, so a low fps prints a WARN; set `SMOKE_STRICT_FPS=1` to make it fail on real hardware. Pushing `proto/<slug>` publishes that one prototype as a frozen folder (see `docs/tech/09-branches-and-deploys.md`).

## 10. Dependencies (and why)
`pixi.js` (rendering, filters, particle container; MIT), `@dimforge/rapier2d-compat` (optional physics; Apache-2.0), `@fontsource/space-grotesk` (launcher font; OFL). Dev: `vite`, `typescript`, `vitest`, `playwright`. No other runtime dependencies; sounds are synthesized in our own small generator (no audio library).

## 11. Adding reusable tech (merge to main)
Reusable helpers go in `src/core` or `src/juice` with a unit test and a short entry here, only when `npm run check` passes. Keep every export documented in this file. Prototype-specific code stays on the night's branch.

## 12. Everything else that is exported (internals; rarely needed in a prototype)
| Export | What it is |
|---|---|
| `core`: `DT`, `FixedStepper` | The 1/60 constant and the pure accumulator the shell uses (`advance`, `hitStop`, `timescale`). Used by tests and bots. |
| `core`: `InputManager` | Gamepad/keyboard poller (`poll`, `takeStepInput`, `inject`, `frame`). The shell owns the instance; read via `window.__scaffold.input`. |
| `core`: `glyph`, `stickGlyph`, `getDevice`, `setDevice`, `onDeviceChange`, `KEY_BUTTONS`, `Device` | Device-aware button labels and the keyboard mapping (one source for both the input layer and the labels). |
| `core`: `blankInput`, `expandBotInput` | Build an all-zero `InputState`; expand a `BotInput` into one with press/release edges. |
| `core`: `hashSeed(text)` | Stable 32-bit seed from a string. |
| `core`: `startPrototype`, `launcherUrl`, `WIDTH`, `HEIGHT` | Shell entry (called by `src/core/shell/main.ts`), the launcher URL used by the return combo, and the 1280x800 logical size. |
| `core`: `validateManifest`, `PrototypeManifest`, `AssetEntry` | Manifest schema and validator. |
| `core/balance.ts` | Balance helpers (section 1b). |
| `core/attribution.ts`, `core/history.ts`, `core/nav.ts`, `core/menu.ts`, `core/debug.ts` | Launcher/shell plumbing (credits parser, local play history, menu navigation, pause menu, debug overlay). Not for prototypes. |
| `core/physics.ts`: `loadPhysics` | Section 6. |
| `juice`: `Tweens`, `tweens` | The tween manager behind `tween()`; the shell updates `tweens` each frame and clears it on restart. |
| `juice`: `Trauma`, `trauma`, `fxStats` | The shake model, the shared instance the shell applies, and the stats it reads into telemetry. |
| `juice`: `JuiceDial`, `LAYERS`, `Layer` | Dial class, layer names. Use the shared `dial`. |
| `juice`: `setVfxRandom` | Point visual randomness at a seeded source (the shell does this). |
| `juice`: `TweenOptions`, `TrailOptions`, `EmitOptions`, `ParticlePreset`, `EyesOptions`, `Mood`, `EaseFn` | Types. |
| `audio`: `audio` | The engine singleton behind `play`: `define`, `has`, `names`, `samples`, `unlock`, `setVolume`, `getVolume`, `setMuted`, `resetStats`, `log`, `counts`. |
| `audio`: `renderSfx`, `sfxDuration`, `peakOf`, `rmsOf`, `SAMPLE_RATE`, `SfxParams`, `Wave`, `PlayOptions`, `BusName`, `PlayLogEntry` | Sample generator, loudness helpers, and types. |
| `bots`: `makeCtx`, `emptyTelemetry`, `STANDARD_METRICS`, `RunOptions`, `RunResult`, `SuiteResult`, `Telemetry` | Harness internals and types. |

## Capture mode (smooth media)
`window.__scaffold.captureMode(true)` parks the real-time loop; time then moves only when `stepFrames(n)` is called, n exact frames of 1/60 s (`draw`: `'last'` renders only the final frame, the default; `'none'` renders nothing, for fast-forwarding; `'all'` renders every frame). The sim, juice and tweens all see the same fixed steps they would at 60 fps, so footage is smooth and identical on every machine, however slow its renderer. `npm run media -- <slug> [--fps 20] [--seconds 4]` uses it: pass 1 plays the greedy bot without drawing at all to find the busiest window, pass 2 replays to it (still without drawing) and renders only the frames it screenshots. Rendering every frame in a software-GL browser builds a GPU backlog that makes screenshots time out, so only draw what you capture. Prototypes need nothing special, but must be deterministic for a given `?seed=` (anything visual that uses `Math.random` or wall-clock time will differ between passes).

## Music (v4)
Each prototype writes its own music to match its game. A song is plain data (`src/music/`); compose it at start-up with the generator and drive it from render-side code with `music` (`src/audio/music.ts`). Never call it from sim code (the sim emits events; `onEvent` reacts).

```ts
import { composeSong, composeStinger } from '../../music/compose.ts';
import { music } from '../../audio/music.ts';

// in src/protos/<slug>/music.ts: one tonic for everything in the game. Do not copy values from here: choose them
// for your game. Write the Music plan in your brief first (docs/design/06-music-craft.md, "Music is a design tool");
// `node scripts/night-state.mjs sound` prints the menu of options and the generator settings behind each.
const ROOT = 50; // the tonic; pick one, keep it for every song in the game
calm    = composeSong({ root: ROOT, seed: 11, name, description, style, mood, form: 'loop', layout, mode, meter, bpm, character, feel });
tense   = composeSong({ root: ROOT, seed: 12, /* a contrasting second loop: other tempo, meter or brightness */ ... });
powerup = composeStinger({ root: ROOT, seed: 13, name, description, style, mood, form: 'oneshot', event: 'powerup', mode, bpm });
// reviewGameMusic([calm, tense, powerup, ...]) from src/music/review.ts: flags the default zone, flat loops, no layers
```
- `music.play(song, parts?)` starts a loop (waits for audio unlock); `music.setParts(parts, fadeSeconds?)` brings parts in and out on the beat (`pad`, `bass`, `drums`, `arp`, `lead`, `harmony`, `riff`); `music.stinger(song, { duck? })` plays over the loop, ducking it; `music.release(seconds)` fades the loop out; `music.stop()`. `music.setPaused` is called by the shell. Every call is logged in `music.log` and `scaffold.music.state` for bots and the smoke test.
- Loops, because ongoing action has no length: a loop has no ending and leads back into itself. Stingers, because events do: two to four bars. `form: 'loop'` with `layout: 'groove-8'` is hook all the time (for games that gate the hook behind an earned moment); the other layouts are in `docs/tech/10-music-and-jukebox.md`.
- Keep `root` (the tonic) the same across the game's loops and stingers so they sit together. The mode may change on purpose between a calm and a tense loop (a parallel mode on the same root is a strong way to signal relief or dread); a stinger takes the mode of the state it punctuates. `seed` makes it deterministic; change it for a different tune.
- Wiring pattern: the sim emits events (`run-start`, `layer`, `power-start`, `power-ready`, `gameover`, ...) and `onEvent` calls `music`: start the loop on the run-start event, `setParts` when pressure layers arrive, bring the hook (`lead`, `harmony`) in only for an earned moment, a stinger for the big events, thin the parts out when pressure resets, `music.stop()` in `dispose`. Put the choice of parts in a pure function (`partsFor(pressure, powerMoment)`) with a unit test.
