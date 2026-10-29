# minigame-bot

An experiment in unattended game making. Every night a scheduled Claude agent designs, builds, tests, and publishes **one small, playable 2D game prototype**. The next morning the human, Slone, plays it on a Steam Deck and replies with feedback. The feedback and the documents in this repo are the only steering the agent gets, so the system is meant to get better at making games he enjoys over time.

The product is the agent-plus-documents system, not any single game. The games are made by an unattended Claude agent following documents written by Slone. They are small, rough, and honest about it: the agent cannot play or hear its own builds, so every post mortem separates what it measured from what it believes.

## How it works

1. **Documents.** [`CONSTITUTION.md`](CONSTITUTION.md) holds the rules, [`docs/design/`](docs/design) the taste and the feel checklist, [`docs/tech/`](docs/tech) the stack and run protocol.
2. **A nightly run** (see [`docs/tech/06-nightly-run-protocol.md`](docs/tech/06-nightly-run-protocol.md)) rolls a theme and two random design atoms, writes a one-question brief, builds a bare core, adds feel (juice and sound), tests with bots, writes a post mortem, and pushes a `proto/YYYY-MM-DD-name` branch.
3. **CI publishes** each branch as a frozen snapshot under `/p/<slug>/` of one static site. The launcher on the same site lists every prototype as a controller-first card grid. Older prototypes are never rebuilt (see [`docs/tech/09-branches-and-deploys.md`](docs/tech/09-branches-and-deploys.md)).
4. **Feedback** happens in chat and is distilled into proposed lessons ("one data point" until repeated).

Stack: Vite, TypeScript, PixiJS, an optional Rapier 2D, our own thin scaffold (fixed-timestep loop, sim/render split, input, synthesized audio, juice helpers, bot harness), Playwright for headless tests.

## Post mortems

Each night writes `runs/<slug>/postmortem.md`; the launcher shows it next to the feedback sheet (press X on a card). Browse them in [`runs/`](runs). Nothing has been assessed yet.

## Run it

Requires Node 22.18+.

```bash
npm install
npm run build:site     # launcher + every prototype -> dist-site/
npm run serve          # http://127.0.0.1:4173  (use a gamepad, or the keyboard fallback)
npm run dev:proto -- _fixture   # hot-reload one prototype on :5173 (_fixture is the bare smoke-test fixture)
npm run smoke          # headless end-to-end gate (needs Chromium via Playwright)
npm run check          # typecheck + secret scan + unit tests + smoke
```

**Playing on a desktop with a gamepad (the current plan):** open the site in a normal browser and use any standard controller. Browsers only expose a gamepad after the first button press while the page has focus, so click the page once and press A if the launcher looks unresponsive. Press F11 for fullscreen. A keyboard works too: WASD or arrows, Space or Enter to confirm, X to go back, Esc to pause or go back; on-screen labels switch between key names and gamepad buttons depending on what you last used. The game canvas scales to the window at 1280x800. The Steam Deck and a Steam wrapper come later (see [`ROADMAP.md`](ROADMAP.md)).

`src/protos/_fixture/` is a bare smoke-test fixture (a square and a ring) that exercises the whole pipeline; it is hidden from the published launcher. Games live on their own `proto/` branches; the original demo (a springy ball with layered pressure, a surge and its own music) is `proto/2026-10-29-demo-ball`. The API for building a prototype is in [`docs/tech/SCAFFOLD_API.md`](docs/tech/SCAFFOLD_API.md).

## Privacy and network

Prototypes are offline and single player: no analytics, no accounts, no outbound calls. Analytics is a roadmap item and would be opt-in and documented here first. The repo is public; nothing in it is secret, and CI fails on obvious secret patterns.

## Contributions

**Outside pull requests are not accepted for now.** They are closed automatically and labeled so we can see what people try. Forking and reusing the code under the MIT license is welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License and credits

Code is MIT licensed (see [`LICENSE`](LICENSE)). Third-party credits are in [`ATTRIBUTION.md`](ATTRIBUTION.md) and in the launcher's About and credits screen (Start, then About).
