# The experiment so far (October 29 to 31, 2026)

**For humans. Nightly agents: do not read this file.** It describes earlier prototypes in detail, and the knowledge policy (`CONSTITUTION.md` section 6) keeps those from nightly agents on purpose: copying an earlier game's look or structure makes every game the same game.

This is a chronicle of the first three days of minigame-bot: what was built, what Slone said about it, what changed because of it, and what the experiment is starting to teach. It is written from the repository itself (204 commits across main and the prototype branches, more than thirty pull requests, the post mortems, and the feedback recorded in `docs/design/pending-lessons.md`) plus Slone's own reflections. Times in git are UTC.

## 1. The premise

A scheduled agent builds one small 2D game prototype a night. Slone plays it on a Steam Deck in the morning and gives feedback in chat. The feedback is distilled into a set of documents (the Bible, the feel checklist, taste cards, a concept library, a run protocol) that the next night's agent reads. The constitution states it plainly: **the product is the agent-plus-documents system, not any single prototype**, and the documents are "the encoded Slone in the system".

The rules of the game Slone set for himself:
- **He is an architect, not a developer.** He gives high-level design feedback, the way a design lead would, and does not touch code. He has not cloned the repo: everything is built on agent machines and deployed through CI to a site branch, served by Vercel.
- **He teaches the way he would teach a person**, with taste, reasons and examples, and not by dictating exact instructions.
- **Learning lives in documents.** The model is fixed and someone else's, so nothing can be trained in. Every lesson has to be written down, in a form a fresh agent will read and follow. This is the experiment's central constraint, and it shows up everywhere below.

## 2. Timeline

**Oct 29, morning to afternoon: the scaffold and the demo.** A scaffold agent built the platform (Vite, PixiJS, Rapier, a gamepad-first shell, a launcher, a bot harness, a test gate) and a small demo game. Slone's design documents, distilled from GMTK video lessons and his own taste cards (Tony Hawk, Zelda, RollerCoaster Tycoon, Tetris, Mario, Metroid, Timberborn, The Sims, GTA), were in place. Over five rounds of his play and feedback the demo grew into the best game the project has produced (section 3). That feedback became Bible v1 to v3.

**Oct 29, afternoon: tooling.** A burst of infrastructure, most of it prompted by Slone's questions: a desktop host app for the Deck (Electron, self-updating on Windows, macOS and Linux), a preview GIF on the focused launcher card, a music generator with a jukebox page (a first batch of 20 songs for Slone to audition; "Cathedral Run" was a favourite), then loops versus stingers, then nightly agents composing their own game music. 

**Oct 29, evening: night one, Unjam.** The first nightly game finished in about 20 minutes of a 3.5 hour budget. Bots said it worked. It made no sense to Slone as a game, and he did not know what to say about it, so it gave the project little to refine and a great deal to change in the process (section 3). Around it: the worry that agents copy the demo (the demo moved off main into its own branch, the docs gained a tested minimal prototype in place of an example game, a look is rolled each night), a reskin, Bible v4, and the first media and capture fixes.

**Oct 30, early morning: night two, Stillwinter.** Built after a new "genre roll" (a script picks one of 3 to 5 genres the agent lists for its theme) landed on tower defense. It took under an hour to first publish, then several rounds of Slone's feedback reshaped it. Slone: "Fascinating result so far. Getting better variance than the last."

**Oct 30, morning: night three, Blot Beat.** Slone fired it early, the same date as the night before. The theme roll refused a second roll for the same calendar date, so the agent wrote its own theme. It built a rhythm game whose music and inputs were unrelated (section 3).

**Oct 30 to 31: the process learned from the first four games.** In order: agents quitting early led to an iteration loop with a done-gate and a 90 minute target; runs keyed to their own start stamp instead of the date, with theme state synced to main during the run; an attended check-in for runs Slone is watching; the discovery that every game's music was the same mid-tempo groove, which led to a "music is a design tool" section; ten more games from Slone's taste added as cards, atoms and themes; a pool of over-specific themes that bent games into confusing narratives, which was retired in favour of short open ones; and finally a rebuilt Bible (v11) around core tenets, written because none of the nightly games had matched the demo.

## 3. The four prototypes

| Game | What it was | What Slone said |
|---|---|---|
| **Demo Ball** (the scaffold agent's demo, five rounds of feedback) | Push a ball with the stick, dash, collect sparks. Pressure arrived in layers over a run (heat, then drifters, fading sparks, closing walls). Skilled play filled a meter; spending it started a berserk mode in which the rules flip and everything the ball touches dies spectacularly. | "Wow, did it do a great job of adding juice in a single pass." On the berserk: it should feel "chaotic and a little unwieldy". Later: "not complex... layered at a good pace, but was always sufficiently communicated by visuals, plus the berserk mode is hilarious and fun as heck." Still the best. |
| **Unjam** (night 1) | Fly a plunger-bot over a pipe; hold and release to free wedged blobs so a flood of them rushes through. | Very little, because it made no sense to him as a game. What he did say: "The game isn't fun. The user doesn't have enough agency. They affect things too indirectly... a lot of motion, but not a lot of clarity... like trying to do fine tuned things with mittens on." Doing the right thing should be obvious "without any written explanation". |
| **Stillwinter** (night 2) | An isometric tower defense in which time only moves when you shatter your own towers. | It took "several turns before I understood what was happening but once I did I found the idea really interesting." Then a long run of design feedback: unanchored text, a win that read as a loss, invisible projectiles, towers that did not look different. He said it made him intrigued by a genre he is usually ambivalent about. |
| **Blot Beat** (night 3) | A rhythm game where every miss becomes ink to spend. | "The music and the game seem completely detached from each other. And the music is super vanilla." Then, on the rebuild: the thumb limits of a controller, the difficulty leap in the second level, colour-coding the lanes, and "if it can't be communicated clearly without words, then it's not a good design and needs to be overhauled." |

**A game that makes no sense produces no feedback.** Unjam is the clearest case. There was nothing in it to refine, so the feedback is thin, and the effort went into the process instead. The pattern matters beyond Unjam: Slone's detailed feedback (Stillwinter's UI, Blot Beat's music) came from games close enough to good that he could see what was wrong. A game that is too far off gets a shrug. That is part of why he is now considering generating several games a night and throwing most away.

## 4. What the feedback taught

The feedback recorded in `pending-lessons.md` falls into six groups. Each became a Bible rule.

1. **Pressure, failure and reward (the demo).** Failure should give a reprieve, and it should be crunchy and reactive. Back pressure should gain complexity, not just speed. Forward pressure must grow with it. A "you are doing well" sound that leads nowhere is meaningless. Skilled play should earn a power moment the player triggers. AI is weak at balance, so every game exposes a balance menu and Slone tunes by feel.
2. **Agency, clarity and causality (Unjam).** A busy, juicy screen can still be "not fun" if control is indirect, activity has no meaning, good play is not obviously rewarded and progress is hidden. This became the most-cited rule, and it is the one bots can never test.
3. **Show the rule without words (Stillwinter).** Numbers should fly from a cause to the thing they feed; a state should look different when it matters; a selector must show the button that cycles it.
4. **Designed UI and designed events (Stillwinter).** Loose text over the game reads as an afterthought. A win and a loss are events with their own sequence, and a win must be unmistakable. Projectiles and hits are the loudest thing on screen. Unit types differ in job, and in look, animation and behaviour.
5. **Audio and action are one thing (Blot Beat).** If a game has a soundtrack, the challenge must come from the track's own events, the player's hit should be the track's sound, there is one clock, thumbs have limits, and a soundtrack needs variety.
6. **Resources must visibly flow (Blot Beat).** A resource economy is one connected picture: where it comes from, how it travels, where it is kept, what pressure does to it, what happens on overflow. Costs and lives are things in the world, not icons in a corner.

## 5. What the experiment is teaching about the process

**Agents build the game headless first, which a human almost never would.** All three nightly post mortems say the simulation was proven with bots "before any render code existed", and Slone noticed the same pattern: the agent builds the whole game with no renderer, then decides the art style and builds the renderer once the headless version feels good. It is a sensible reading of the architecture (sim and render are separate, bots run headless), and it has real strengths: the rules are testable from the first hour, and degenerate strategies get found early. It is interesting mostly because no human designer works this way. The cost shows up in the feedback: nearly all of Slone's notes on Stillwinter and Blot Beat are about legibility (unanchored text, invisible bullets, a resource story spread across the screen), because the visual layer was designed last. That makes it an observation to understand, not a mistake to fix.

**Bots measure "works", not "fun".** Unjam's telemetry looked healthy: an idle bot died, a competent bot did well. The human result was "not fun". The Bible's honesty rule had predicted exactly this gap. Bots are good at finding exploits (they did, repeatedly: place-and-shatter, stamp-only farming, hold-A-forever) and bad at clarity, humour and feel.

**Agents quit early.** Unjam took about 20 minutes of a 3.5 hour budget. Stillwinter took under an hour to first publish and Blot Beat about an hour. The protocol was a straight line of phases, and a fast agent walked it once. The fix was to turn the middle of the night into a loop (play, note, change, step back) with a done-gate that refuses an early finish.

**Left to themselves, agents converge.** The look converged until it was rolled by script; the genre converged until it was rolled by script; the music converged on a mid-tempo 4/4 groove in dorian or mixolydian (four games, near-identical), because the docs' own example used those values. Slone's call on music was that it should be considered and fit the game, not rolled, so the answer there was a menu of options and a plan the agent has to write.

**Themes can be over-obeyed.** The theme pool was written as mechanical sentences ("every mistake leaves a mark that later becomes a tool"), and the process told agents themes were "design prompts, not skins". Agents bent whole systems to prove the theme, and the Blot Beat ink economy came out confusing. The theme pool was rewritten into short open sparks, and the Bible now says a theme is seasoning, not a spec.

**Variance comes from injected randomness, not from asking for creativity.** Rolled genre and rolled look produced noticeably different games, to Slone's evident pleasure. The lesson is narrower than "randomise everything": it works for what the agent has no reason to reason about, and it fails for things that must be reasoned from the game (music).

**Process fragility showed up as soon as real nights ran.** The first nights exposed a roll guard keyed to the calendar date (a second run on one day was refused), tests that hard-coded the live theme pool, a media capture that timed out under software rendering, a theme still in the pool after its game was built, and, on the desktop host, a Steam overlay that crashed Electron's helper processes. Most were fixed within hours. They are mostly the cost of an unattended system meeting its first real use.

**The documents grow faster than they are understood.** The Bible went from v1 to v11 in two days. By v10 it held 45 bold rules in fourteen sections, ordered by when they were learned. A fresh agent reading it has no way to tell the central rules from the incidental ones. The v11 rebuild is a response: a ranked set of eleven core tenets on top, a description of what the best build had, and four checks.

## 6. Why the demo is still the best game

Slone's view is that the first demo remains the best thing the project has made, and the evidence agrees with him. Compare what it had with what the nightly games had:

- **A toy first.** Moving the ball felt good before it had a goal. The nightly games led with rules.
- **Layers at a steady pace, each readable from the visuals alone.** Not simple, but always legible. Several nightly games needed text or several turns to explain.
- **An earned, hilarious peak.** The berserk mode is what people remember. None of the nightly games has an equivalent.
- **Five rounds of play and feedback.** The demo was shaped by Slone's feel, one round at a time. A one-night unattended run cannot give itself that, and every nightly game so far has had at most a few rounds.

That last point is the uncomfortable one. A lot of what makes the demo good was iteration with a human who can feel what the agent cannot, and no document replaces that.

## 7. Slone's reflections

These are his own, shared with others and paraphrased here with a few short quotes.
- **The blank page.** The project overcomes the blank-page problem of game development. Before AI code, it took anywhere from a day to months to find out whether an idea had a nugget in it. Now it takes a night.
- **The pivot.** He is considering changing the model of the project: **generate several games, throw most away, and "fix" the ones that have something to them.** This is the same instinct as "flush the turds", applied to whole prototypes instead of single builds.
- **The architect role.** He is trying not to touch code, to give feedback like a design lead and to teach "the way I'd teach a person instead of telling it exactly what to do."
- **A fixed model.** Working with a model he cannot change, and trying to capture every lesson in context documents, "really stresses the limitations of using someone else's model."
- **Observations from watching it work.** It builds the entire game with no renderer and picks the art style afterward. It got excited about a rhythm game and then built one with no rhythm: the music and the inputs were detached. The best game it made so far is the scaffold agent's tech demo.

## 8. Where the system stands

Problems and the mechanisms that now exist for them:

| Problem seen | Mechanism |
|---|---|
| Agents quit at 20 minutes | Iterate loop, step-backs, a done-gate, a 90 minute target counted from the start of work |
| Same look, same genre | Seeded look roll and genre roll that avoid recent nights |
| Same music | Music plan in the brief, a menu of options, a review tool that flags the default zone |
| Over-specific themes | A pool of short open themes, a 7-word cap, "theme is a spark, not a spec" |
| Bots cannot see clarity | The no-words test, the toy, pace, peak and theme checks, Slone's feedback sheet |
| A second run in a day refused | Runs keyed to their start stamp, not the date |
| Theme and ledger state not reaching main | A sync script that pushes theme state and notes to main during the run |
| Agents could not ask the architect | An attended check-in after theme, genre and look; scheduled runs never ask |
| The Bible too long to absorb | Eleven ranked core tenets on top, restated at the head of `CLAUDE.md` |

## 9. Open questions

1. **Will the v11 tenets change what the next nightly game looks like?** That is the real test of a document-only learning system. It will take a few nights to know.
2. **Should the project generate several games a night and cull?** It fits the evidence: the best game came from iteration, and most single-pass games fell short. It changes the economics (more builds, more of Slone's time reviewing) and may reduce how much each build is polished.
3. **Should the toy be rendered early?** Headless-first works well for rules, and it may still be worth a rendered first pass of the main verb, with real visuals and feel, before the systems around it grow, because the toy cannot be judged without being seen.
4. **How can the agent get closer to feel?** It can screenshot, read telemetry and storyboard, and it cannot play. Some of what the demo had came from a human feeling the surge and saying "faster, more chaotic".
5. **Is the Bible reaching diminishing returns?** Each new rule was correct, and together they risk burying the ones that matter. The core tenets are a first answer. Whether it is enough is open.

## Appendix: where the evidence lives
- Slone's feedback, with his quotes: `docs/design/pending-lessons.md`.
- Rules derived from it, with versions: `docs/design/00-bible.md` (revision log at the end).
- What each night used: `docs/design/ledger.md`.
- Per-game post mortems, briefs and surprises: on each prototype branch under `runs/<slug>/` and `briefs/`.
- Process: `CONSTITUTION.md`, `docs/tech/06-nightly-run-protocol.md`.
