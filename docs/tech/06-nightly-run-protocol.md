# 06 Nightly Run Protocol

How a scheduled nightly agent runs, start to finish. The scheduled task prompt is short and points here.

## Scheduled task prompt (to be set after the scaffold exists)
"Run tonight's prototype. Read CLAUDE.md, then follow docs/tech/06-nightly-run-protocol.md. Do not ask questions."

## Phases and soft budgets (3:30 hard stop)
| # | Phase | Soft budget | Checkpoint written |
|---|---|---|---|
| 0 | Start: `PAUSE` check, preflight, stamp start, read docs, check pending feedback | 10 min | `phase: start` |
| 1 | Ideation: roll themes, resolve, pick atoms and wildcard, write the brief | 20 min | `phase: brief` |
| 2 | Core verb: bare, ugly, playable build proving the core is interesting | 60 min | `phase: core` |
| 3 | Feel pass: juice and audio on main verb, feedback events, pressure state, and the game's music (loop, stingers, parts tied to pressure) | 45 min | `phase: feel` |
| 4 | Testing: bots, telemetry, screenshots, checklist, one fix pass | 30 min | `phase: test` |
| 5 | Wrap: manifest, feedback sheet, post mortem, publish, add themes, ledger line | 25 min | `phase: done` |
Check elapsed time at every phase boundary and before any long command.

## Step 0: start
1. If `PAUSE` exists on main: write a one-line log and exit.
2. `node scripts/preflight.mjs`. It reports: headless Chromium works, Node version, network probe results (npm ok, others?), skills visible (design skills, `frontend-design`), artifact types visible. Log the output in the run log. If Chromium does not work, continue with sim-only bots and note it.
3. `node scripts/night-state.mjs start` stamps the start time in `NIGHT_STATE.md`.
4. Check for unprocessed feedback: if a `feedback/` folder on main has files marked `processed: false`, process them first (see "Feedback processing").
5. Read: `CONSTITUTION.md`, `docs/tech/SCAFFOLD_API.md`, Bible, feel checklist, taste cards, concept library, ledger, `pending-lessons.md`.

## Step 1: ideation (greenfield)
1. `node scripts/themes.mjs roll` returns three options. Pick one.
2. `node scripts/themes.mjs resolve ...` with a reason for each rejection (see doc 07).
3. Roll the look: `node scripts/night-state.mjs look` returns a seeded visual identity (palette, shapes, rendering, framing, UI) that avoids the last three nights' looks and the demo's. Follow it; you may override one dimension if the core verb needs it, and the brief says which and why. Do not open `src/protos/_demo/` or any earlier prototype for reference: the demo is a test fixture, and copying its look or structure is the failure mode this roll exists to prevent. `docs/tech/SCAFFOLD_API.md` is the whole contract.
4. Draw two atoms at random from the concept library (use `scripts/night-state.mjs atoms` for a seeded pick that avoids recent pairings in the ledger) and at most one wildcard constraint.
5. Write the **brief** to `briefs/<slug>.md` using the template in `docs/design/04-feedback-and-postmortem.md`: one question, one target feeling, mode, theme, atoms, wildcard, core verb, pressure source, failure and recovery loop, what is different from the last five nights (from the ledger only), and the 3 to 5 feedback questions.
6. Do not open earlier prototypes. Do not read rejection reasons.

## Step 2 to 4: build, feel, test
- Branch `proto/YYYY-MM-DD-name`. Code in `src/protos/<slug>/`.
- Bare core first. Confirm with the idle, random, and greedy bots that the core does something. Then the feel pass. Then the full bot suite and the feel checklist.
- Follow the Follow-the-Fun rule: log surprises (accidents, emergent behavior, the most interesting part) in `runs/<slug>/surprises.md` before fixing them. If a discovery is better than the brief, pivot only if it reinforces the target feeling; log the pivot.
- Reusable tech goes to main only when the smoke test passes, with a `SCAFFOLD_API.md` entry.

## Wrap-up (3:00) and pencils-down (3:30)
- At 3:00: freeze scope. Remaining work: bots, one fix pass, manifest, feedback sheet, post mortem.
- At 3:30: stop editing. If the build passes the smoke test and self-review, publish. If not, set `buildStatus: broken`, leave the previous prototype as latest, and log why.

## Post mortem (about 10 lines; template in doc 04)
Written to `runs/<slug>/postmortem.md`, copied to the manifest card and the top of the feedback sheet. Facts first (telemetry), beliefs labeled, no self-congratulation, run-health line separate.

## Publishing
Run `npm run media -- <slug>` first (records the greedy bot, writes `preview.gif` and `thumb.png`; skip with a logged note if ffmpeg is missing). Then push the branch; CI builds and publishes per doc 05. Confirm the card appears (check `index.json` on the published site if the network allows; otherwise rely on CI status).

## Feedback processing (in Slone's chat session, when he gives feedback)
Default order (see `CONSTITUTION.md` section 15):
1. Tag his answers: feelings, behaviors, quit moment, what pulled him back, constants compared to earlier nights. Cross-reference the night's telemetry.
2. Capture what it teaches about his design philosophy and preferences.
3. Update the Bible (and feel checklist or taste cards where they fit): bump the version, add to the revision log, and record the evidence in `pending-lessons.md`, each lesson marked **one data point** until repeated. Flag contradictions with earlier feedback for him to resolve.
4. Set the prototype's `feedbackStatus: assessed` and update its log.
5. Then ask whether to update the game or use the feedback only for future games. Do not change the game before he answers.
A nightly run that finds unprocessed feedback files at start only does steps 1 and 4 and writes proposed lessons to `pending-lessons.md`; it never edits the Bible.

## Failure and recovery
- A dead or compacted run resumes from `NIGHT_STATE.md` (phase, start time, brief path, branch name, last good build).
- After two failed attempts at the same fix, cut the feature and log it.
- Never force-push. Never leave main broken. If main breaks from a merge, revert it.
- If a tool is missing or blocked, use the documented fallback; do not look for workarounds around the network allowlist.

## `NIGHT_STATE.md` format
```
night: 2026-10-30-name
started: <ISO time>
phase: core
branch: proto/2026-10-30-name
brief: briefs/2026-10-30-name.md
lastGoodBuild: <commit sha or none>
notes: one line per checkpoint
```

## Cost rules
- Keep always-loaded docs short; read detailed docs only when a phase needs them.
- Use subagents only for bulky work (bot runs, log parsing, asset hunting), each returning a short summary.
- Print summaries; write full logs to files.
- Lighter model for chores (ledger, logs); stronger model for ideation and the core build, if the harness allows model choice.
