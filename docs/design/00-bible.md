# 00 The Bible (READ-ONLY during nightly runs)

Design principles for making prototypes Slone will like. Nightly runs read and follow this file but never edit it. It changes when Slone gives feedback in chat (the chat agent updates it directly as the first step, see `CONSTITUTION.md` section 15) or runs an assessment of `pending-lessons.md`. **Every lesson here is written to apply to any kind of game**: principles in genre-neutral terms, no prototype names, no vocabulary that implies a genre (see `CONSTITUTION.md` section 15). Keep it that way in every edit.

Version: 7 (seeded from six GMTK sources and Slone's taste; feedback incorporated from the `_demo` prototype and from a first nightly prototype, 2026-10-29. One data point per lesson so far; see the revision log at the end).

## 1. What a prototype is for
A prototype answers one question quickly. The big three questions: Is it fun? Is it viable? Will people like it? Our nightly prototypes mostly ask "is it fun and what does it feel like?" Slone is the only playtester, so every build must make his feedback easy and specific.

## 2. Before building: write these down
1. **The one question** this build tests.
2. **The target feeling** (a specific emotion or fantasy, e.g. "thrilling escape, then curious"). "Fun" is not a feeling. Use words like powerful, tense, crafty, sneaky, flustered, cozy, relieved.
3. **The mode:** content-driven (5 to 10 minutes with a beginning, ramp, and end) or systemic (endless loop; polish the 1 to 2 most valuable mechanics).
4. **The loop in four lines:** what the player is working toward, what creates stakes or stands in the way (time, scarcity, an opponent, rising complexity, a decision with a cost), what happens when they fall short and how they recover (or that nothing can be lost), and what the player does. (Crazy Taxi style.) Any line may be quiet or absent if the target feeling calls for it; say so in the brief.
5. **One fixed anchor:** the target feeling is the one thing that cannot change while exploring (Journey's theme of love is the model).

## 3. Core before polish, then feel
- Foundations first: if the core loop is flawed, art and polish cannot save it. Build a bare, ugly, playable core and check it is interesting.
- **Then the feel pass.** Juice and sound are part of the fun, especially for visceral games, but they amplify a working core and cannot create one. If you are adding effects to rescue a boring core, stop and fix the core.
- Do not spend time on story, names, icons, or menus before the core works.

## 4. Follow the fun, with edges
- Build, play (via bots and telemetry), and notice which part is most interesting. Ask: what happens if I cut everything else?
- Log accidents, bugs, and surprises before fixing them; some become the game (Rocket League's mid-air boost, Into the Breach's telegraphed intentions, a puzzle game's unintended shortcut).
- The signal that a discovery is a keeper: it pulls the design toward it repeatedly, and it makes other design decisions easier.
- Edges: the target feeling is the anchor, the night is time-boxed, and the MVP is small. Exploring in every direction at once is analysis paralysis, not following the fun.
- Prefer subtraction. Ape Out and Into the Breach got better by removing what was not the point.
- **Games are made by looping, so use the whole night.** An okay game is easier to improve than a blank page: get something playable fast, then play it, note what works and what does not, change it, repeat. Every few rounds step back and look at the whole (does it build and pay off, does it deliver the target feeling). If the obvious problems are fixed, look for the next layer; leftover time means another loop. Finishing a one-pass build early is a failure signal. (v6, one data point: Slone.)
- **When it is not working, change something big.** A flat prototype is not rescued by polish. Drastic changes (a new core verb, a new genre, throwing the core away, even a new target feeling) are reasonable and encouraged; a different game that works beats a planned one that does not. Decide early, log the pivot, and keep the time box. (v7, one data point: Slone.)

## 5. MDA: mechanics, dynamics, aesthetics
- Mechanics are rules and numbers. Dynamics are what players do and what the systems do in response. Aesthetics are the feelings that result.
- You can only edit mechanics. Predict the dynamics and the feelings, then check them against the target feeling.
- Name the feeling in specific words. Compare to the vision: keep what reinforces it, cut what clashes.
- **Borrowed mechanics import their dynamics and feelings.** Default mechanics (checkpoints, health bars, level-ups) quietly set tone. Before borrowing, ask why it works in its original game.
- Everything should pull the same direction: mechanics, visuals, sound, camera, UI. If one layer pulls against the target feeling, change it.
- Watch for mechanics that undermine each other (a scarce resource plus an ability that spends a lot of it), for degenerate strategies, and for subjective responses (a score can motivate one player and feel judgmental to another).

## 6. Taste constraints (Slone)
- **Stakes and back pressure:** open-ended play needs something pushing back, or it goes slack: time, scarcity, decay, an opponent, a rising tide, a commitment that costs something. Which kind fits depends on the target feeling; a calm, puzzle or discovery game can get its stakes from decisions and their consequences rather than a timer. **Where there is pressure, it should gain complexity over time, not only speed.** A single timer that runs faster is not enough: layer in new pressure sources or change the character of the pressure as the session goes on (a new source of pressure, a changing rule, a second system that interacts with the first). The timer can stay as the base layer. (v1, one data point: `_demo`.)
- **Soft failure:** setbacks are recoverable and story-generating. No mastery walls, no punishment loops. **Let the target feeling choose the failure type.** Soft failure is the default, but a game built around rising threat can feel hollow if nothing can ever end the run. In that case pair soft failures with a real end state (an ending, a result, a quick retry), still without humiliation or a mastery wall, and say which in the brief. (v1, one data point: `_demo`.) **Failure is a reprieve:** after a soft failure the pressure eases or its ramp restarts; it never resumes at the rate the player just failed at. (v1, one data point: `_demo`.)
- **Forward pressure:** back pressure alone is half the loop. As the pressure grows, the player's side should grow too: rising power, new options, a way to push forward and take the initiative. Escalation should come from both directions. (v2, one data point: `_demo`.)
- **Every reward cue must mean something.** A rising "you're doing well" sound, a streak counter, or a flashy number needs a consequence: it fills a meter, unlocks a state, or changes the next moment of play. A cue that only decorates reads as empty. (v2, one data point: `_demo`.)
- **Earned power moments.** Skilled play fills a meter or earns a charge; when it is ready the game announces it clearly and the player chooses when to spend it. The spent state is a short, spectacular spell in which the usual rules flip in the player's favor: what normally pressures them becomes something they can use or overcome, their controls may simplify to one or two decisions, and what they do has outsized effect. The reward is a power fantasy the player triggers themselves, not an automatic buff. (v2, one data point: `_demo`.)
- **Discovery of new play patterns:** surprises arrive as new ways to play (new actions, tools, options, or rules), not just new content. **Collecting should open things up:** gathering resources or items should unlock new functionality or content (a verb, a tool, a place, a rule change), not only raise a score. (v1, one data point: `_demo`.)
- **Core interaction first, theme second:** the interaction the player repeats most (a verb: moving, placing, choosing, matching, combining) should feel good before there is anything built on it (Mario's movement, Tony Hawk's tricks, placing a Tetris piece, tuning a coaster).
- **Readable systems that accumulate consequences:** the player can see the system and watch it grow or collapse (RollerCoaster Tycoon, Timberborn, The Sims).
- **Single player, self-paced, offline, controller-first.**
- Avoid gritty or violent theming. Remove the skin and judge the loop.

- **Show the rule, do not describe it.** A novel core rule must be legible through nonverbal cause and effect. Whatever a cause releases should visibly travel to the thing it feeds (numbers fly from a dying enemy to the meter they refill, and the meter only fills when they arrive), states should look different (a placed-but-not-yet-real object is ghosted and pops solid when it becomes real), and the first action should be pointed at (markers on what to press). A player who needs several turns of play to understand the rule has been told too little by the screen. (v4, one data point: `2026-10-30-stillwinter`.)
- **If a resource drives play, running out of its source can be the fail state.** When a theme makes one thing the engine of the game (time that only moves when something breaks), having nothing left to feed it is a real, readable loss. Start the player with some, and guard the loop with a queued state so the source cannot be conjured and spent in the same breath. (v4, one data point: `2026-10-30-stillwinter`.)
- **A familiar genre with its central tension flipped can win over a genre-sceptic.** Slone is usually ambivalent about tower defense and was intrigued once the central rule changed. Hook plus anchor (section 9) applies to genres too. (v4, one data point: `2026-10-30-stillwinter`.)

## 7a. Interface, screens and readability (v7)
- **UI is designed, not typed on.** Prompts, hints and menus are anchored components (a plate with key-cap chips and short labels, choice cards), never loose text floating over the game. A cyclable list shows its bumper glyphs at its ends and lies horizontally. (v7, one data point: `2026-10-30-stillwinter`.)
- **Put each number where it is used, and keep unlike meters apart.** A currency sits beside the thing you spend it on. Two meters that fill from different causes are separated in space and in shape, so a flying number never looks like it feeds the wrong one; a state that matters (time frozen or flowing) is also carried by shape, not only by digits. (v7, one data point.)
- **Win and lose are designed events.** A win is unmistakable: say plainly that it is a win, and show it (the hero object powers up and the remaining threats are cleared one after another before any tally). Win and loss screens get their own sequence, a tally that counts up, a plain reason for a loss, and choice cards. A mode or reward is named plainly and explained in one line ("Endless Night: no dawn, the waves never stop"); a name that needs the player to guess its meaning is a bug. (v7, one data point.)
- **Projectiles and hits are the loudest thing on screen.** Shots are large, high contrast against both light and dark ground, with a trail and particles and enough flight time to see; every shooter has a visible emitter that animates when it fires; a hit has a big tell (flash, jolt, burst, damage number). Damage-state marks must line up with the art they sit on. (v7, one data point.)
- **Unit types differ in job, and look, animate and behave to say so.** Each type has one obvious thing (turret, bomb, clock, healer, heavy gun); its shape language, idle animation and behaviour all state that job, so it is obvious after a little play. A helping effect (healing) visibly travels from source to target and lands when it arrives. (v7, one data point.)

## 7. Game feel essentials
See `01-feel-checklist.md`. The headline rules: respond to every input right away (in real-time play, within one frame), give the main interaction personality, make sound a first-class part of the loop, and where the game has feedback events, stack small effects and scale them with the size of the event. Items that assume an avatar, a camera, real-time input or collisions apply only to games that have them.

- **Setbacks get the full effect stack.** A failure, loss or setback moment is as expressive and reactive as the main interaction: layered sound, a hold beat, and a visible reaction (shake, flash, particles, text, or the world or characters reacting). It is a moment the player wants to see, not a pause. (v1, one data point: `_demo`.)
- **Progress sounds climb in equal musical steps, then change.** A pitch that rises by a fixed ratio per step stops being audible after a few steps. Climb in equal semitone steps (whole tones read well), cap the climb near an octave, and signal "maxed" with a different layer or sound. Per-play pitch variation itself works well. (v1, one data point: `_demo`.)
- **Juice in the first pass works.** Slone liked a full juice stack added in one pass and found the pacing about right, so build the stack early rather than polishing late. (v1, one data point: `_demo`.)

## 8. Scope and time
- A small prototype is a feature, not a bad version of the whole game. Keep it to one core verb, one pressure source, one recovery loop.
- Prototype build effort predicts production effort. If the bare core takes most of the night, the idea is expensive.
- Introduce abilities gradually (Portal style); too many abilities at once makes constraints impossible and learning hard.
- Unforeseen interactions between systems force micro-decisions. Decide them deliberately and log them.
- Know when to stop. Prototyping is addictive. A night ends at pencils-down with an honest post mortem.

## 9. Appeal check (cheap marketing test)
Could a one-sentence headline and a 10-second clip make someone want to try it? Name the appeal type: fantasy ("I want to be this"), exploration ("I want to explore this"), toy ("I want to touch this"), challenge, comedy, nostalgia. A hook (something interesting to say about the game) plus an anchor (something familiar) helps a game land. Because Slone is the player, weigh toy appeal and discovery appeal heavily.

## 10. The agent is honest about what it cannot know
Bots can show the build works and find exploits. They cannot say whether it is fun or whether it sounds good. State this in every post mortem and ask Slone specific questions about feel.

## 11. Balance is a human job: every game exposes balance knobs
AI is weak at balance work, and balance is where a game's feel is finally decided. Each game therefore exposes a handful (3 to 8) of tweakable values in a balance menu in the pause menu: the pressure rate and ramp, how fast the player's power grows (forward pressure), forgiveness (lives, relief per success), and the pace of new layers. Each has a sensible default, a range, and a plain label. Slone tunes by feel while playing; the values persist on the device and can be copied out. The plan is to save his tuned values globally through an API so every player gets the values he settled on (roadmap). The agent's job is to pick good knobs and defaults, not to be the final balancer. (v3, one data point: `_demo`.)

## 12. Agency, clarity, and causality
A game can have plenty of activity (motion, numbers, events, effects, systems) and still not be fun, if the player cannot tell what they are doing or why it matters. These rules apply to every kind of game, and come first when a build "has a lot going on" but does not land. (v4, one data point.)
- **Direct agency.** The player's input should produce the effect they intend, predictably and with precision. When too much stands between input and result (the game does most of the work, outcomes are approximate, results are mediated by systems the player cannot steer), control feels coarse, like doing fine work with mittens on. Give the player precise, specific influence over the things that matter to their goal. Where influence is necessarily indirect, make the player's choice specific and the link from choice to result legible.
- **Activity needs meaning.** A busy screen is not a readable one. Everything that changes or moves should say what it is and whether it matters to the player's goal. Quiet the activity that carries no information until the meaningful activity stands out, and keep the number of things the player must track at once small.
- **The right action announces itself.** Doing the right thing gets clear, positive feedback that is obvious without a written explanation: it is tied to the thing the player acted on, unmistakable, and different from the feedback for a neutral or wrong action. Wrong or wasted actions read as such too. If the player has to be told in words that they did well, the feedback has failed.
- **Visible progression and purpose.** The goal and the player's progress toward it are first-class things on the screen (a bar, a count, something that fills or changes the world), not buried under effects. A player should be able to answer "what am I trying to do, and am I getting closer?" at a glance, and see that good play improves the answer. Progress the player cannot tell apart from things merely happening is invisible progress.
- **Causality over spectacle.** The player should be able to trace an outcome back to their own action: I did X, therefore Y. Where many things happen at once (chain reactions, crowds, simulation ticks), connect the outcome to its cause (mark what the action affected, show the consequence arriving) and do not let the aggregate drown the cause. Juice amplifies a visible cause and effect; it must not stand in for it.
- **Test:** show a new player ten seconds of play with no text. Could they say what the goal is, what they control, and whether the last action was good? If not, fix clarity before polishing feel.

## Revision log
- v7, 2026-10-30: from Slone's later rounds on `2026-10-30-stillwinter`: designed UI instead of loose text, currency near its use and unlike meters apart (shape as well as numbers), win and lose as designed events with plainly named modes, loud projectiles and hits, unit types with distinct jobs (7a). All one data point.
- v4, 2026-10-30: from Slone's first play of `2026-10-30-stillwinter`: show the rule through nonverbal cause and effect, running out of the engine resource as a fail state with a queued guard, flipped genres (6). Selection lists must show their bumper glyphs (feel checklist). All one data point.
- v6, 2026-10-30: iteration is the method (4). Prompted by nightly agents declaring themselves done after about 20 minutes instead of looping play, note, change, and stepping back.
- v5, 2026-10-30: drastic changes are reasonable and encouraged when a prototype is not working (4). Prompted by Slone's guidance for the nightly agent, together with the new genre roll (a random pick from 3 to 5 genres that fit the theme).
- v4, 2026-10-29: agency, clarity and causality (12). From Slone's first play of a nightly prototype: "the game isn't fun"; indirect control, lots of activity without meaning, good play not obviously rewarded, progression hidden. One data point. Also reworded earlier rules (loop template, back pressure, power moments, verb first, discovery, failure effects) and the feel checklist so they state the principle for any kind of game, with avatar-, camera- and real-time-specific items made conditional; intent unchanged.
- v3, 2026-10-29: balance menu rule (11). Prompted by Slone expecting AI to be weak at balance.
- v2, 2026-10-29: from Slone's second round on `_demo`. Confirmed working: layered back pressure that grows, hard failure, failure juice (still one data point each). Added: forward pressure, every reward cue must mean something, earned power moments (6).
- v1, 2026-10-29: from Slone's first play of `_demo` (two rounds of feedback). Added: pressure gains complexity over time and the target feeling chooses soft vs hard failure (6); failure as reprieve (6), collecting opens content (6), failure gets the full effect stack, equal-step pitch ladders with a cap, juice-in-first-pass (7). All one data point until repeated on another night.
