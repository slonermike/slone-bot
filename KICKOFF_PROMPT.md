# Kickoff Prompt: build the scaffold repo

Paste this into the code agent as the first message, with the whole `proto-factory/` folder placed in the empty repo root (or attached).

---

You are building the **scaffold repo** for an unattended prototype factory. Each night a separate scheduled agent will design and build one small playable 2D game prototype, test it headlessly, and publish it. The human (Mike Slone; refer to him as "Slone") plays it in the morning on a Steam Deck, then gives feedback in chat. Your job is to build the foundation those nightly agents stand on. You are not building a game tonight except the smoke-test demo described below.

## Read first, in this order
1. `CLAUDE.md` (short, always-loaded rules and file map)
2. `CONSTITUTION.md` (non-negotiables, decision authority, knowledge policy)
3. `docs/tech/01-stack.md` through `docs/tech/08-open-source-and-assets.md`
4. `docs/design/00-bible.md` and `docs/design/01-feel-checklist.md` (read-only for you and for every nightly run)
5. `ROADMAP.md` (what is deliberately deferred; do not build these)

Skim the other design docs; they are for nightly agents.

## What to build (in order)
1. **Repo skeleton:** Vite + TypeScript, `src/core`, `src/launcher`, `src/protos` (empty), `scripts`, `tests`, `themes`, `docs`. Copy the provided docs in unchanged.
2. **Scaffold core** (`docs/tech/02`): fixed-timestep loop, strict sim/render separation, seeded RNG, input layer over the Gamepad API (standard mapping, optional gyro hook), pause and return-to-launcher combo, debug overlay (FPS, input latency, frame time).
3. **Juice helpers and audio** (`docs/tech/03`): ease functions, tween, squash/stretch, flash, shake, hit-stop, trail, particle wrapper (use an existing library, do not write an engine), eyes helper, a WebAudio synth with a unified `play(name, opts)` API, and a juice dial that toggles layers at runtime.
4. **Bot harness and telemetry** (`docs/tech/04`): Playwright headless runner, sim-only fast-forward with timescale (fixed-step multiples, never larger steps), scripted-bot interface, telemetry JSON output, screenshot capture, smoke test.
5. **Launcher and manifest** (`docs/tech/05`): controller-first card grid reading `index.json`, `prototype.json` schema, press A to launch, reserved combo to return, build step that assembles `/p/<slug>/` folders and regenerates `index.json`.
6. **Themes script** (`docs/tech/07`): `scripts/themes.mjs` with `roll`, `resolve`, `add`, `report`, plus tests. Seed data is already in `themes/`.
7. **Run protocol helpers** (`docs/tech/06`): `scripts/night-state.mjs` (checkpoint read/write, start time stamp, elapsed check), `scripts/preflight.mjs` (verify tools: headless Chromium, node, network allowlist probe, available skills).
8. **Smoke-test demo:** one trivial throwaway prototype (a ball you push with the stick, with the juice layers on) that exercises input, sim, render, audio, telemetry, bot run, manifest, and launcher end to end. Put it in `src/protos/_demo/`. It must pass the smoke test and appear as a card.
9. **CI and hosting** (`docs/tech/05`): GitHub Actions that builds on push to `proto/*` and `main`, and publishes the combined site. Ask me for the host choice only if the docs do not settle it.
10. **Open source setup** (`docs/tech/08`): `LICENSE` (MIT), `README.md` (titled `minigame-bot`, the repo name; the experiment, how it works, how to run it, links to post mortems), `ATTRIBUTION.md` (table with header and a Dependencies section listing notable dependencies and licenses), `.gitignore`, and a pre-commit or CI check that fails on obvious secret patterns. Add an "About and credits" screen to the launcher that renders attribution. Audit your dependencies' licenses for MIT-compatible, commercially reusable terms; avoid GPL and non-commercial clauses.
11. **Contribution policy:** `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, and the auto-close workflow for external PRs, exactly as specified in `docs/tech/08` (no PR code is ever checked out or run; minimum permissions). Mention in `README.md` that outside PRs are not accepted for now.
12. **Analytics stub:** add a no-op `track(event, props)` in `src/core` that sim events and session lifecycle call. No network code, no analytics service. This only prepares for the roadmap item.
13. **Write `docs/tech/SCAFFOLD_API.md`:** how a nightly agent calls everything you built, with short examples. This is the file nightly agents will rely on most.

## Done criteria (all must be true)
- `npm run smoke` passes locally: headless boot, input check (synthetic gamepad), frame-rate check, audio event fired, telemetry file written, screenshot saved, manifest valid.
- The demo prototype is playable in the launcher with a gamepad, and the return combo works.
- `node scripts/themes.mjs roll` and `resolve` work and enforce the rules in `docs/tech/07`.
- `docs/tech/SCAFFOLD_API.md` exists and every exported helper is documented.
- `LICENSE`, `README.md`, `ATTRIBUTION.md`, `CONTRIBUTING.md` exist and the auto-close workflow is in place; the secret-pattern check runs in CI; the repo contains no secrets or personal data.
- A short `BUILD_REPORT.md` lists what was built, what was not, anything you could not verify, and any decision you made that the docs did not cover.

## Rules while building
- Follow `CONSTITUTION.md`. If a doc conflicts with another doc, the constitution wins; note the conflict in `BUILD_REPORT.md`.
- Do not edit `docs/design/` Bible files. Do not build items listed in `ROADMAP.md` (analytics, external feedback API, adjacent assets repo, 3D, and so on).
- The repo is public and open source. No ripped or unlicensed assets, no secrets, no personal data.
- Prefer boring, well-known libraries. Check current versions at install time; do not trust remembered versions.
- Keep core code small and readable. Nightly agents will read your API doc, not your internals.
- If something is ambiguous, pick the documented default, log it in `BUILD_REPORT.md`, and keep going. Ask me only if you are blocked.
