# 06 Nightly Run Protocol

How a scheduled nightly agent runs, start to finish. The scheduled task prompt is short and points here.

## Run prompts
Two kinds of run, told apart by the prompt, never guessed. **A run is unattended unless its prompt says it is attended**, so a scheduled run can never wait on a human who is not there.
- **Scheduled (unattended), the default:** "Run tonight's prototype. Read CLAUDE.md, then follow docs/tech/06-nightly-run-protocol.md. Ask no questions."
- **Attended (Slone fired it by hand and is watching):** "Attended run: run tonight's prototype. Read CLAUDE.md, then follow docs/tech/06-nightly-run-protocol.md, and check in with me once after the theme, genre and look are chosen." Only this prompt makes the run attended: start with `node scripts/night-state.mjs start --attended`.

## Phases and time (1:30 hard stop)
Games are made by looping, not by passing through stages once: build, play, note what works and what does not, change it, repeat. The phases below are the arc of the night; the middle of it is a loop.
| # | Phase | Time | Checkpoint written |
|---|---|---|---|
| 0 | Start: `PAUSE` check, preflight, stamp start, read docs, check pending feedback | 5 min | `phase: start` |
| 1 | Ideation: roll theme, genre and look, check in (attended runs), choose the music, draw atoms | about 5 min | |
| 1b | **Pitch:** write the one-page pitch, scrutinise it as a buyer would, revise it (at least two logged rounds), then write the plan | up to 20 min | `phase: brief` |
| 2 | Core verb: a bare, ugly, playable build, as fast as you can. First playable by about 0:40. It must pass the toy check (the verb alone is satisfying) before any pressure or system is added. `checkpoint core` is refused until the pitch has two logged rounds | up to 20 min | `phase: core` |
| 3 | **Iterate:** rounds of play, note, change (see "Iterate"). Feel, audio, music, pressure, bots and the checklist all happen inside the rounds | until 1:15 | `phase: feel`, then `phase: test` |
| 4 | Wrap: freeze scope, final bots and checklist, manifest, feedback sheet, post mortem, publish, themes, ledger line | 15 min | `phase: done` |
These times are not targets to finish under. **The night is about 90 minutes of work (the target will be tuned from what the first nights show). Finishing in twenty minutes is not efficiency, it is a failure signal:** it means the loop never ran. `checkpoint done` is refused before 1:00 elapsed, or without 3 logged rounds and 1 step-back, unless you pass `--early --reason "why"` (the reason goes in the post mortem). Check elapsed time at every phase boundary and before any long command; `node scripts/night-state.mjs check` also shows your round count and how long until wrap-up.

## Step 0: start
1. If `PAUSE` exists on main: write a one-line log and exit.
2. `node scripts/preflight.mjs`. It reports: headless Chromium works, Node version, network probe results (npm ok, others?), skills visible (design skills, `frontend-design`), artifact types visible. Log the output in the run log. If Chromium does not work, continue with sim-only bots and note it.
3. `node scripts/night-state.mjs start` stamps the start time in `NIGHT_STATE.md`. Add `--attended` only if your prompt says this is an attended run (see "Run prompts"); otherwise leave it off. Then `node scripts/sync-main.mjs pull` takes the theme pool from the latest main, so you roll from the real pool and never get a theme an earlier run used.
4. Check for unprocessed feedback: if a `feedback/` folder on main has files marked `processed: false`, process them first (see "Feedback processing").
5. Read: `CONSTITUTION.md`, `docs/tech/SCAFFOLD_API.md`, Bible, feel checklist, taste cards, concept library, ledger, `pending-lessons.md`.

## Step 1: ideation (greenfield)
1. `node scripts/themes.mjs roll` returns three options. Pick the one that suggests the best toy (something fun to do), not the one that suggests the most elaborate system. The theme is seasoning, not a spec: read it loosely (Bible, section 1, tenet 5).
2. `node scripts/themes.mjs resolve ...` with a reason for each rejection (see doc 07). Then at once `node scripts/sync-main.mjs push`: your pick is used up on main now, even if this run dies later. Do the same after adding themes at wrap-up.
3. Roll the genre: list 3 to 5 genres that would fit the chosen theme (be honest and varied: not all variations of one idea), then run `node scripts/night-state.mjs genre "<g1>" "<g2>" "<g3>" ...`. It picks one at random (skipping genres used in the last three nights) and records it in `NIGHT_STATE.md`. You do not choose. Build a game that is recognizably that genre, reinterpreted freely for the theme and the atoms; the brief names the genre and the options you listed. Do not re-run it to fish for a better pick: a second call just prints the first result. The only exception is a drastic change (see "When it is not working").
4. Roll the look: `node scripts/night-state.mjs look` returns a seeded visual identity (palette, shapes, rendering, framing, UI) that avoids the last three nights' looks and the demo's. Follow it; you may override one dimension if the core verb needs it, and the brief says which and why. Do not open any earlier prototype for reference (other nights' branches, including the original demo `proto/2026-10-29-demo-ball`): copying an earlier game's look or structure is the failure mode this roll exists to prevent. `docs/tech/SCAFFOLD_API.md` is the whole contract.
5. **Check in (attended runs only).** **Unattended run (the default, and every scheduled run): skip the question entirely. Run `node scripts/night-state.mjs resume "unattended"`, which starts the night's clock, write "Human input: none (unattended)" in the brief, and go on. Never ask and never wait.** If you started with `--attended`, before you build, ask once whether the human has input, showing the rolled theme, genre and look: run `node scripts/night-state.mjs checkin` (it only marks that you asked), then ask with `AskUserQuestion` ("Theme X, genre Y, look Z. Any input before I start?" with options like "Go ahead" and "I have input", the human can type anything). Then `node scripts/night-state.mjs resume "<what they said, or no input>"`: **the night's clock starts here**, so every time in this doc (first playable, wrap-up at 1:15, pencils-down at 1:30) is measured from the answer, and the time the human took to reply is free. Ideation before the check-in is short; do it quickly. Their input steers the build: if they name a different theme, genre or look direction, follow it (a genre change is `genre --reroll --reason "human request"`); if they add a constraint or an idea, work it into the brief. If, on an attended run, the question tool is missing, errors, or returns without an answer, do not wait and do not ask again: `resume "no input"` and go on. Ask exactly once per run, and only here: after this the run is fully automated, with no more questions to the human.
6. Choose the music on purpose, not at random: `node scripts/night-state.mjs sound` prints the whole menu (ways music can shape pacing, tempo bands, meters, modes, textures, layouts) with the generator settings for each. Reason from the game's target feeling, pressure and pacing: weigh at least three options from different parts of the spectrum, say what each would do to the game, choose, and write it in the brief's Music plan (`docs/design/06-music-craft.md`, "Music is a design tool"). Do not default to a mid-tempo 4/4 groove: that is what every earlier game did.
7. Draw two atoms at random from the concept library (use `scripts/night-state.mjs atoms` for a seeded pick that avoids recent pairings in the ledger) and at most one wildcard constraint.
8. Do not write code yet. Write the **pitch** and scrutinise it first (see "Pitch" below); then write the rest of the brief (the plan) to `briefs/<slug>.md` using the template in `docs/design/04-feedback-and-postmortem.md`. The plan holds the one question, one target feeling, mode, atoms, wildcard, the loop, pressure source, failure and recovery loop, what is different from the last five nights (from the ledger only), the Music plan, the human's input from the check-in (or "none"), and the 3 to 5 feedback questions.
9. Do not open earlier prototypes. Do not read rejection reasons.

## Pitch (before any code)
Most weak games are weak at the idea, and no amount of building rescues that. Spend the first part of the clock on paper: a one-page pitch, scrutinised and revised, before any game code. **Think like you intend to sell this game to humans you have to win over.** A good game is marketable: if it takes much explaining to sell it, it is not good; if you do not know who it is for, it is not good.
1. **Write the pitch** (the top half of `briefs/<slug>.md`, template in doc 04): the one-sentence pitch, who it is for, why this and not another game, the hook and the anchor, the first ten seconds, the verbs and the toy, the peak, the target feeling, the theme and genre and how the theme is expressed, and what it is not.
2. **Scrutinise it.** Judge each test pass, weak or fail, with a one-line fix:
   - **Explain:** can a stranger want to try it from one sentence plus a ten-second clip? If it needs a paragraph, a rules list or lore, it fails.
   - **Audience:** is there a named kind of player, with what they already play and when and where they would play this? "Everyone", "people who like fun games" or a list of fandoms fails.
   - **Why this:** name two or three games that player could play instead and say why they would pick this one. If you cannot, there is no hook.
   - **Hook and anchor:** one interesting thing to say about it, and one familiar thing that makes it easy to approach.
   - **First ten seconds:** what does a stranger see and do with no text, and is it already fun?
   - **Tell a friend:** what is the moment they would describe to someone else? If there is none, find the peak.
   - **Complexity:** how many rules before the first fun moment? More than one verb and one pressure fails; layers come later, one at a time.
   - **Theme:** swap the theme for another. Is it still fun? It should be.
3. **Get a hostile reader.** Give a fresh critic only the pitch (no plan, no code): a subagent told to be the target player and a skeptical publisher, to say what they would not buy, what confused them, and what they would play instead. This is the one place a subagent is worth its cost. If you cannot spawn one, write the critique yourself first, in first person as that reader, before rereading your pitch.
4. **Revise, log, repeat.** After each round run `node scripts/night-state.mjs pitch "<tests that failed> | <what I changed>"`. Do at least two rounds (write, critique, revise, critique) and stop after three. If two or more tests still fail after the second round, flush the idea instead of defending it: read the theme differently, `genre --reroll --reason "..."`, or choose another verb, and pitch again. Budget about 20 minutes; tune that from what the first nights show.
5. Write the plan half of the brief, `node scripts/night-state.mjs checkpoint brief`, and start the core. `checkpoint core` is refused until two pitch rounds are logged (`--skip-pitch --reason` is for a real exception).
During the build, the pitch is the contract: if the game drifts from it, either bring the game back or rewrite the pitch honestly, and say which in the post mortem.

## Step 2 to 4: build, then iterate
- Runs are not limited to one a day: the theme roll, atoms, look and genre are all keyed to the run's own start stamp (`night-state.mjs start`), so start it first and never fake a date. Two runs on one day just need different names. Code in `src/protos/<slug>/`.
- Branch `proto/YYYY-MM-DD-name`. Code in `src/protos/<slug>/`.
- Bare core first, quickly. Confirm with the idle, random, and greedy bots that the core does something. Then start the rounds. Do not hold the core until it is "done"; an okay game you can play beats a perfect plan, because an okay game is what gives you ideas (see Iterate).
- Follow the Follow-the-Fun rule: log surprises (accidents, emergent behavior, the most interesting part) in `runs/<slug>/surprises.md` before fixing them. If a discovery is better than the brief, pivot toward it and log the pivot.
- Drastic changes are welcome when the build is not working: see "When it is not working" below.
- General-use code does not go to main during the build. When the prototype is complete (after the post mortem), put it in a pull request from a separate branch off main that contains only that code, a unit test and a `SCAFFOLD_API.md` entry, and open it only if `npm run check` passes. List what you proposed in the post mortem's "Reusable tech" line. Never put game code in main. Prefer extending an existing scaffold helper with an option over copying it into the prototype.

## Iterate (the loop that fills the night)
Blank pages are hard and okay games are easy to improve: once something is playable, ideas for it come fast. So get to playable quickly, then loop until wrap-up. One round is about 10 to 15 minutes, so expect three or four of them:
1. **Play.** You cannot feel it, so look and measure like a player would: run the bots (idle, random, greedy) and read the telemetry timeline; save screenshots at the start, mid, a high-pressure moment and an end screen and **open the images**; for a moving game, take a short sequence (the `capture-media` harness steps frames deterministically) and read several frames in order. Watch for: where nothing is happening, where the screen is unreadable, where the bots all behave the same, where the player has no decision to make.
2. **Note.** Write down what is working, what is not, and the single weakest thing, in plain words. Ask: what is the dullest ten seconds? what would I want to do here that I cannot? what would make a player try one more run? what is the one thing to cut?
3. **Change.** Fix the weakest thing, plus one idea that adds something (a new decision, a juicier consequence, a surprise, a layer of pressure). Small, testable changes; one commit each.
4. **Log it.** `node scripts/night-state.mjs round "<what I played> | <what I noticed> | <what I changed>"`. Rounds are how the next agent (and Slone) can read how the game evolved.
5. **Repeat.** Early rounds are about the core (is the verb fun, is there pressure), middle rounds about feel (juice, sound, music, readability), late rounds about the whole (arc, pacing, onboarding, balance knobs, polish).

**Step back.** After every two or three rounds, and again before wrap-up, stop tinkering and look at the whole from a distance. Reread the brief's question and target feeling, and run the four checks from the Bible (section 2): the toy check (the verb alone is satisfying), the pace check (layers arrive one at a time on a steady beat, each readable from the visuals), the peak check (is there a signature moment worth earning?) and the theme check (would it still be fun with a different theme?). Make the call out loud: **keep, cut, or flush** the core. Flushing is allowed and often right (Bible tenet 2); do not polish what is flat. Play (or watch) a full run start to finish. Ask: does the arc build and pay off? Is it recognizably the rolled genre and look? Does it deliver the target feeling, and where does it lose it? What are the top three weaknesses, big ones first? Is something drastic called for (see below)? Log it with `node scripts/night-state.mjs round --stepback "<arc> | <top weaknesses> | <what I will do>"`, then act on the biggest weakness before looping again.

**When the obvious problems are fixed**, you are not done; the rough edges that remain are smaller and there are more of them. Go look for the next layer: a second kind of moment, a better ending, something to discover, a stinger on the big event, a knob that changes the feel. Time left over means another loop, not an early finish. If you are really out of ideas with an hour or more left, do a step-back and consider a bolder change.

## When it is not working
A flat game that shipped on plan is worse than a different game that works. When things are not panning out, **drastic changes are reasonable and encouraged**, not a failure of the plan.
- **Signs:** the idle, random and greedy bots all do roughly the same thing after the core phase; you cannot name what is fun in the first minute; the suite keeps flagging the same problem after a fix pass; you are polishing to hide a flat verb; you have been surprised by nothing.
- **What you may change:** the core verb, the pressure source, the genre (`node scripts/night-state.mjs genre ... --reroll --reason "why"` for a fresh random pick from a new list), the structure of the game, even the question and target feeling if the build points somewhere better. Throw away the core and start the core over if that is faster than rescuing it. Keep the theme unless the theme itself is the problem, and keep the look.
- **How:** decide quickly (an hour of doubt is worse than a restart). Write what is not working in `runs/<slug>/surprises.md`, then add a `PIVOT:` line to the brief (what changed and why; the old text stays below it). Checkpoint with a note (`node scripts/night-state.mjs checkpoint core "pivot: ..."`).
- **Limits:** the night is still time-boxed. A pivot must start before 0:50 elapsed so there is time for the feel pass and bots; after that, cut scope instead. Two pivots is plenty. A broken build at pencils-down is still published as broken, and the post mortem says what you tried.
- Say in the post mortem what you changed, what was not working, and whether the pivot helped.
- A pivot is a round like any other: log it and keep looping.

## Wrap-up (1:15) and pencils-down (1:30)
- Once the ledger line and the pending-lessons entry are written: `node scripts/sync-main.mjs notes` (and `push` again if you added themes). It appends only what your run added to main's copies and pushes, so the next run sees them; do it before pencils-down, not as an afterthought.
- At 1:15: freeze scope (the last step-back should already be behind you). Remaining work: final bots and checklist, a fix pass, manifest, feedback sheet, post mortem. Do not stop before wrap-up because things look finished.
- Self-review before publishing: run the bot harness and the feel checklist. Reject or fix a build that is dead on arrival, has a flat main verb, has no pressure curve, runs below 55 fps on a mid-tier laptop with effects on, or has no audio on the main verb. Separate measured facts (telemetry) from beliefs about feel, and say the agent cannot play or hear the build.
- At wrap-up, add 1 to 3 new themes from the night's own surprises, not from generic priors, as short open sparks (7 words at most).
- At 1:30: stop editing. If the build passes the smoke test and self-review, publish. If not, set `buildStatus: broken`, leave the previous prototype as latest, and log why.

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
- Use subagents only for bulky work (bot runs, log parsing, asset hunting) and for the hostile pitch reader, each returning a short summary.
- Give builds, bot runs and downloads their own timeouts; never spend quota on retry loops.
- Print summaries; write full logs to files.
- Lighter model for chores (ledger, logs); stronger model for ideation and the core build, if the harness allows model choice.
