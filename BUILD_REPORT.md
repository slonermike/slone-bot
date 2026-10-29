# BUILD_REPORT

Scaffold build, 2026-10-29. Everything in the kickoff list was built. Nothing is committed or pushed yet.

## Verified (run in this sandbox)
- `npm run check` passes: typecheck, secret scan, 44 unit tests, smoke test 16/16 (headless boot with no console errors, synthetic gamepad moves the ball, audio event fired, telemetry written and schema-valid, screenshot non-blank, manifest valid and `index.json` rebuilds identically, Start pauses, Select+Start returns to the launcher, launcher card launches with A).
- `npm run licenses`: 14 production packages, all MIT, ISC, BSD-3, Apache-2.0, or OFL-1.1. No GPL, LGPL, or non-commercial terms.
- `node scripts/themes.mjs roll` / `resolve` / `add` / `report` enforce the doc 07 rules (tested against a temp copy; the real `themes/` files are untouched).
- Sim-only bots (idle, random, greedy, degenerate corner) run on `_demo`, are reproducible by seed and input-log replay, and fast-forward 120 sim seconds in about 30 ms.
- Screenshots of the launcher, feedback sheet, credits screen, title screen, pause menu, debug overlay, and gameplay were looked at.
- Rapier initializes (WASM) in Node via `loadPhysics()`; not exercised by any prototype.

## NOT verified
- **60 fps on real hardware.** This sandbox's software-GL Chromium runs a blank page at about 38 fps and the demo at about 16 fps, so the smoke fps check prints a WARN here. Set `SMOKE_STRICT_FPS=1` to enforce it on real hardware or a GPU runner. CI will show the same WARN on GitHub's runners.
- **Steam Deck specifics:** real controller via Steam Input, readability at arm's length, audio autoplay after a launcher navigation (that is why prototypes show "PRESS A TO START"), the keyboard-free flow end to end. Nobody has played or heard any of it.
- **Latency numbers** are measured from the scaffold's gamepad poll to the sim/render/audio call; they exclude display and controller hardware latency.
- **CI workflows** have not run on GitHub (YAML parses; logic mirrored locally, including a frozen-folder publish test against a fake site folder). `close-external-prs.yml` is untested until an outside PR arrives.
- Gyro: exposed as zeros; no gyro source is wired.
- A prototype actually using Rapier or an external asset (none exist yet).

## One-time GitHub setup for Slone
1. Pages: Settings, Pages, Source = branch `site`, folder `/` (the first push to main creates the branch). Or point Vercel/Cloudflare Pages at `site` with no build command.
2. Branch protection on `main`: block force-pushes and require the `check` job.
3. Optional: restrict who can open PRs if GitHub offers it; the auto-close workflow is the baseline.
4. Actions need "Read and write permissions" for the publish job (it declares `contents: write` itself).

## Decisions the docs did not settle
- **Hosting:** doc 05 defaults to Vercel but allows Pages. CI publishes plain static files to a `site` branch, which any host can serve, so the host choice is a settings change, not a code change. Recommended: GitHub Pages (free for public repos).
- **Branches vs main (per Slone's note):** nights never need to merge main, and main never rebuilds old prototypes. Each `proto/*` push builds only itself into a frozen `p/<slug>/` folder. CI moves a `scaffold-stable` tag to the last green main so nights start from known-good code even if main's tip is broken. A frozen contract (site layout, `index.json`, localStorage keys) is documented in the new `docs/tech/09-branches-and-deploys.md`. The launcher tolerates additions; breaking changes need a new `schemaVersion`.
- **Broken cards:** a failed `proto/*` check publishes a `broken` manifest only (no build), hidden by the launcher. A failed main publishes nothing.
- **Node runs TypeScript directly:** `.mjs` scripts import `.ts` files via Node's type stripping (Node >= 22.18), so schemas and bots are shared without a build step. Source uses erasable TypeScript only (no enums or constructor parameter properties).
- **Bot input type:** `act()` returns `BotInput` (a compact `{left, right, hold[], lt, rt}`), not `Partial<InputState>`. The runner derives press/release edges. Same information, easier for bots.
- **Prototype contract additions:** optional `mount(view)` (build Pixi objects; `init` must not draw) and `dispose()`. Sim files stay Pixi-free so bots and unit tests import them in Node.
- **Reserved buttons:** `start` and `select` (and A while Select is held) are masked from prototype input.
- **Seeds:** default is random per launch; restart picks the next; `?seed=N` pins it. Bots pass explicit seeds.
- **Run outcomes:** a sim event `complete` or `gameover` ends a bot run; systemic runs end at the time cap as `timeout`.
- **Audio:** our own small sfxr-style generator (pure, deterministic, unit-tested for silence and clipping), no audio library. Particles wrap Pixi's `ParticleContainer`.
- **Launcher font:** Space Grotesk via `@fontsource` (OFL), bundled, no network. `frontend-design` was not available as a skill here, so the launcher styling is my own.
- **Themes script:** `used` themes are recorded in `state.json`; reasons are stored as `{date, text}`; "cites the theme itself" is a keyword heuristic (reasons that only compare to alternatives do not count); duplicate check is token overlap >= 0.7 against pool, graveyard, and used themes; when the pool has fewer than n themes the fallback pool replaces it, and below 15 a warning prints.
- **night-state:** `start` resumes (does not overwrite) an unfinished state younger than 6 hours; `--force` starts over. `check` exits 2 after 3:30. The state file is written inside a fenced block in the doc's format.
- **preflight:** skill detection is best effort (scans for design/frontend names on disk); artifact types cannot be detected from a script. Falls back to a Chromium binary under `/opt/pw-browsers` when Playwright's pinned build is missing.
- **Demo thumbnail and sample post mortem** are committed (`src/protos/_demo/thumb.png`, `runs/_demo/`).

## Doc conflicts
None that needed the constitution to win. Notes: doc 05's Vercel default vs the allowance for Pages (above); doc 07's "minimum pool 15" and "fewer than n" fallback are implemented as two separate checks.

## UX pass after first play (Slone's feedback)
Menus and launcher scale to small screens (tested at 1366x768 and 1024x600); labels follow the last-used device (keyboard or gamepad); Esc is Start/Back; keys tapped inside one frame are never lost; a button pressed on the frame the pause menu opens no longer triggers it. Demo: the heat ramp restarts after a failure, the pickup pitch rises in whole-tone steps with a cap and a chime layer past it, and the failure has a full effect stack (boom, crunch, long freeze, zoom punch, flash, shockwave ring, debris, "CRUNCH!"). Lessons recorded in `docs/design/pending-lessons.md` as one data point each.

## Run plan
Start by running the site in a desktop browser with a gamepad; build the Steam wrapper once that is stable (added to `ROADMAP.md`). Deck-in-browser notes: launch the browser in kiosk mode and set the Steam Input template to Gamepad, otherwise the page sees no controller.

## Not built (ROADMAP)
Analytics beyond the no-op `track()`, feedback endpoint or form, external feedback API, 3D, Deck sync app, iframe embedding, encrypted theme tool, music engine, adjacent assets repo.

## Housekeeping
- `KICKOFF_PROMPT.md` is kept in the repo root with the other provided docs; delete it if you do not want it public.
- No secrets, tokens, or personal data (the secret scan also flags personal email addresses). Only your name appears, as copyright holder.
- Playwright's own browser download was not run; `npm run smoke` needs Chromium (`npx playwright install chromium`) outside this sandbox.
