# 03 Audio and Juice

Feel is a first-class deliverable. Source: GMTK feel and juice material (see `docs/design/05-source-notes.md`). Juice means maximum output for minimum input: cascading response to every action.

## Juice helpers the scaffold must provide
Each is a small named function with sensible defaults and a per-layer on/off switch.
| Helper | What it does |
|---|---|
| `ease` | Library of easing curves: linear, out-quad, out-cubic, in-out, out-back (overshoot), out-elastic, out-bounce |
| `tween(obj, props, ms, ease, delay?)` | Tween position, rotation, scale, alpha, tint. Supports random delay jitter |
| `chase(current, target, k)` | The cheap version: move k percent of the remaining distance each step. Good for cameras and UI |
| `squashStretch` | Scale by velocity, pop on impact then ease back, wobble after a hit |
| `flash` | Tint a sprite white (or a color) on contact, then fade back |
| `shake` | Screen shake with trauma model (trauma decays; shake = trauma squared times noise). Capped amplitude |
| `hitStop` | Freeze sim steps for N frames on a big impact (see core doc) |
| `trail` | Ball/projectile trail from remembered positions |
| `particles` | Wrapper over an existing particle library. Presets: puff, debris, confetti, sparks, dust |
| `eyes` | Add eyes to any entity: blink on timer, look toward a target, smile on success, frown on near-miss. Tiny effort, big personality |
| `punch` | Quick scale/position impulse that springs back |
| `numberPop` | Floating score/damage text with ease and fade |

## Effect stacking rule
Individually small effects combine into feel. Every main-verb action should have at least: a motion response, a flash or squash, a sound, and a particle or shake scaled to impact. Scale intensity with event magnitude; do not use the same effect strength for every event.

## Juice dial
A runtime toggle panel in the pause menu: layers on/off (shake, particles, hit-stop, squash/stretch, flash, trails, eyes, audio) plus a global intensity slider. This lets Slone A/B the feel on the Deck in seconds and gives the agent a structured way to log which layers a build uses.

## Performance budget
Everything on at once can wreck frame rate. Log frame time with effects on and off. Cap particle counts per effect and total. Target 60fps on the Deck; self-review fails below 55fps average in bot runs with all layers on.

## Audio architecture
- `play(name, { pitch, volume, pan, variation })` is the unified API. Call sites never touch WebAudio directly.
- Sounds are named events: `jump`, `land`, `hit`, `pickup`, `pressureUp`, `fail`, `recover`, etc. A prototype maps sim events to sound names in `onEvent`.
- **Bus structure:** master, sfx, music, ui. Master volume and mute are controlled by the launcher and persist per device via `localStorage` (try/catch).
- **Browsers need a user gesture before audio starts.** The launcher's "press A" satisfies this; prototypes launched directly must show a "press A to start" screen.

## Synthesis (default source)
- Build a small WebAudio synth supporting oscillators (square, saw, triangle, sine, noise), ADSR envelopes, pitch sweeps, filters, and simple bit-crush/distortion.
- Provide an sfxr-style parameter set so sounds are tiny and tunable: base frequency, sweep, attack, sustain, decay, vibrato, duty. An existing library (jsfxr/ZzFX-style) is fine to wrap instead of writing from scratch.
- **Tie parameters to gameplay** (pitch rises with combo, filter opens with pressure, volume scales with impact).
- **Avoid repetition:** random pitch variation of a few percent per play; round-robin variants for frequent sounds.
- **Layered transients:** a short click/noise transient plus a body tone for impacts.
- **Short attack** (a few ms) on feedback sounds. Latency from input to sound should be under about 50ms; log it.
- Sound is not polish. Every build has audio on the main verb, on feedback events, and on the pressure state.

## Sample sourcing (when synthesis falls short)
Agent discretion, encouraged for impacts, engines, ambience. Only allowed licenses (see `08-open-source-and-assets.md`): CC0 preferred, CC-BY acceptable with an attribution row. Never ripped or unlicensed audio. Every borrowed file gets an `ATTRIBUTION.md` row and an asset manifest entry: source URL, author, license, date pulled, where used. The sandbox may block these sites; if so, use synthesis. Do not work around the allowlist.

## Music
None by default. Procedural music (simple sequencer with bass, pad, and percussion layers reacting to game state) or open-licensed tracks only when the night's question concerns mood or tension.

## What the agent can and cannot verify
- Can verify: events fire, loudness and clipping, silence where sound is expected, input-to-sound latency, particle counts, frame time with effects on.
- Cannot verify: whether it sounds or feels good. Always put sound and feel questions in the feedback sheet.
