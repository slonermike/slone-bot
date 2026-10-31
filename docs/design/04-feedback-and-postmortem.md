# 04 Brief, Feedback Sheet, and Post Mortem Templates

Three templates a night fills in. Keep each short. Files go in `briefs/<slug>.md`, `runs/<slug>/feedback-sheet.md`, `runs/<slug>/postmortem.md`.

## 1. Brief: the pitch first, then the plan (written before any game code)
The brief has two halves. The **pitch** is one page, written first, scrutinised and revised until it survives (see "Pitch" in `docs/tech/06-nightly-run-protocol.md`). The **plan** is written only after the pitch passes. Think like you intend to sell the game to humans you have to win over.
```
# Brief: <title>   (<slug>)

## Pitch (one page)
Pitch sentence: "A <genre> where you <verb> to <goal>, and <hook>." A stranger should want to try it from this sentence and a ten-second clip.
Who it is for: a specific kind of player, what they already play, and when and where they would play this
Why this and not that: two or three games they could play instead, and in a clause each why they would pick this one
Hook and anchor: the one interesting thing to say about it, and the one familiar thing that makes it easy to approach
First ten seconds: what the player sees and does with no text, and why it is already fun
Verbs (one to three, plain words) and the toy: what the player does, which verb is fun alone, and why it is a toy before it is a game
Peak: the moment a player would tell a friend about (spectacle, absurdity, power), and how it is earned
Target feeling: a specific emotion or fantasy (not "fun").   Question: the one thing this build tests
Theme and genre: <theme text> and <rolled genre>. Theme expression: how it shows up (look, names, mood, at most one twist) and what you deliberately ignored. Genre options you listed: <3 to 5>
What it is not: what is explicitly out
Scrutiny log (one line per round, from `night-state.mjs pitch`): the tests that failed (explain, audience, why-this, hook, first ten seconds, tell-a-friend, complexity, theme) and what you changed

## Plan
Mode: content-driven (5-10 min) | systemic (endless, polish 1-2 mechanics)
Human input: <what Slone said at the check-in, and how it shapes the build> or none
Atoms: <id>, <id>      Wildcard: <text or none>
Look (from `node scripts/night-state.mjs look`; override at most one dimension, say which and why): palette, shapes, rendering, framing, ui. Then the 3 to 5 hex colors you will actually use and one sentence on what the game looks like at rest.
Loop (4 lines): win/reward | obstacle/pressure | fail state and recovery | player actions
Layer schedule: what arrives when, one line each, one at a time, each readable from the visuals alone
Pressure source: what pushes back, and how it ramps
Recovery loop: what a soft failure looks like and how it generates a story
Different from the last five nights (from the ledger only): one line
Feel plan: sound and juice on main verb, feedback events, pressure state
Music plan (chosen to fit this game, not rolled; `night-state.mjs sound` prints the menu): three options weighed from across the spectrum and why one won (role, tempo, meter, mode, texture). Then: the arc (start, peak, end), the gauge (what the music says about state, and how), the quiet (where it thins or stops), the stingers (3 to 5 moments), the contrast (the second loop or phase), and how it differs from the last games' music
Screens and UI plan: how the prompts are anchored, where each meter and currency sits, how the win and the loss are shown and named, what each unit type's one job is and how its look and animation say it
Balance knobs (3 to 8): id, default, range, what it changes (exposed in the pause menu's Balance screen)
Telemetry plan: metrics and bots
Feedback questions (3-5): see below
```

## 2. Feedback sheet (shipped with the build, shown in the launcher, pasted into chat by Slone)

Slone answers on his Deck in chat. Keep answers fast: yes / kind of / no, or a few words. Text is optional. Dictation works via the Steam on-screen keyboard.

```
PROTOTYPE: <title> (<slug>)

THE QUESTION THIS BUILD TESTS (written before you played):
<question>
TARGET FEELING: <feeling>

TARGETED QUESTIONS (3-5, phrased as feelings and behaviors):
1. e.g. When did you first feel pressure? (seconds, or "never")
2. e.g. After failing, did you want to restart right away? yes / kind of / no
3. e.g. Did you find anything I did not tell you about? what?
4. ...

CONSTANTS (every night, so we can compare over time):
A. First minute: did it feel good to just move/act before anything else? yes / kind of / no
B. The moment you almost quit (when, or "never"):
C. What pulled you back in (a moment, a verb, a sound):
D. About how long did you play?
E. Replay tomorrow? yes / maybe / no
F. Sound: did any sound feel wrong or missing? which?
G. Feel: too little juice / about right / too much (and which layer)

FREEFORM (anything: surprises, feelings, "this reminded me of..."):
<box>
```
Questions are tied to the night's target feeling and risk. Phrase them as feelings and behaviors, never design jargon.

## 3. Post mortem (about 10 lines, written at pencils-down)
```
# Post mortem: <title>
Question and target feeling: (copied from the brief)
What shipped: one sentence (main verb, pressure source)
Rounds: how many rounds and step-backs, and the biggest thing each changed (one line each)
Core before polish: was the bare core interesting with juice off? how I judged it
Did it work (honest read): checklist counts (pass / fail / untested); the shaky items
Measured (telemetry): runLength, deaths, firstPressureSimSec, idleSurvivalSec, variance, fps, inputToAudioMs (a few numbers)
Believed (labeled): my guesses about feel, which I cannot verify (I cannot play or hear the build)
Degenerate strategies found: or "none found"
What I cut or ran out of time for:
Pitch: the one-sentence pitch, who it was for, how many pitch rounds it took and what the scrutiny changed, and an honest read on whether the built game delivers the pitch (would that player want it, could you sell it in a sentence?)
Tenets (Bible section 1): which did the build serve, which did it break; the four checks (toy, pace, peak, theme) with a one-line verdict each; was anything flushed, and did it help
Surprises (follow the fun): accidents, emergent behavior, pivots (what was not working, what you changed, and whether it helped)
Biggest risk for Slone to check: the one thing most likely to feel wrong
Reusable tech proposed to main (as a PR opened after the prototype is complete, not merged during the build): or "none"
Assets sourced: (source, license) or "all synthesized"
Theme picked and why: one line
Themes added: the 1-3 new theme texts
Next time (proposed lesson, marked "one data point"):
Run health: tools missing or blocked, timeouts, files opened outside the allowed set, wall-clock used, anything infrastructure-related (kept separate from design findings)
```
Rules: facts first, beliefs labeled, no self-congratulation. A build that passed the smoke test but felt flat should say so. Process problems go in run health, not in design findings.

## 4. Ledger line (append to `docs/design/ledger.md`)
`YYYY-MM-DD | slug | mode | atoms: a, b | theme: <short> | wildcard: <short or none> | verdict: pending`
After assessment, Slone updates the verdict.

## 5. Pending lessons entry (append to `docs/design/pending-lessons.md`)
```
## <date> <slug>
- Lesson: <one line>   Status: one data point | repeated (<n> nights)
- Evidence: <telemetry or Slone's words>
- Proposed Bible change: <section and wording, genre-neutral: no prototype names, no genre vocabulary> (Slone decides)
- Proposed atoms: <id: description> (optional)
```
