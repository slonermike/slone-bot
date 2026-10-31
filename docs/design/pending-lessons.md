# Pending Lessons

The ONLY design file nightly runs may append to (besides the ledger). Lessons wait here until Slone's assessment promotes them into the Bible. Every lesson starts as **one data point** and becomes "repeated (n nights)" only when a later night's evidence matches. Do not edit or delete other nights' entries.

Entry template is in `docs/design/04-feedback-and-postmortem.md` section 5.

## Proposed atoms
(none yet)

## Entries
(none yet)

## 2026-10-29 _demo
(Scaffold smoke-test prototype, not a nightly build; first real feedback from Slone, quoted for gameplay only.)
- Lesson: Failure should give a reprieve: pressure should ease or restart after a soft failure, not carry on at the pre-death rate.   Status: one data point (promoted to Bible v1)
- Evidence: Slone: "I don't like that when you die, the heat velocity remains the same as before you died. Failure should give you some reprieve." (Demo fixed: the heat ramp now restarts at each failure.)
- Bible change (applied in v1, section 6): back-pressure section, add "soft failure resets or eases the pressure curve" (Slone decides)
- Lesson: Failure/death needs its own juice pass: it should be crunchy and reactive, as much as the success moments.   Status: one data point (promoted to Bible v1)
- Evidence: Slone: "I also would have liked for the death/failure experience to be more juicy/crunchy/reactive." (Demo now layers sound, hit-stop, shake, zoom punch, flash, shockwave ring, debris.)
- Proposed Bible change: feel checklist, add "failure event has the same effect stack as the main verb" (Slone decides)
- Lesson: Rising pitch as a progress cue stops being audible after a few steps if it rises by a fixed ratio; use equal musical steps with a cap, then switch to a different cue.   Status: one data point (promoted to Bible v1)
- Evidence: Slone: pitch variation "is great", but the rise "quickly hit a point where the rise was indistinguishable to my ear." (Demo now steps by whole tones up to an octave and a bit, then adds a chime layer.)
- Proposed Bible change: audio section, "tie pitch to progress in equal semitone steps, cap it, add a new layer past the cap" (Slone decides)
- Lesson: Pacing and instant juice felt right in one pass.   Status: one data point (promoted to Bible v1)
- Evidence: Slone: "Wow, did it do a great job of adding juice in a single pass. The pacing feels generally right."
- Added to Bible v1 (section 6, discovery). Proposed atom for the concept library (Slone decides): d-collect-unlocks: collecting things should open new verbs, items, or content, not just add score (Slone: "I'd want to see the collection mechanic result in opening up new game functionality or content.")

## 2026-10-29 _demo (second round)
- Lesson: The failure type should fit the game's feel. A game with rising threat but no hard failure state felt wrong; soft failure is the default, not a rule against run endings.   Status: one data point (promoted to Bible v1)
- Evidence: Slone: "The game also seems to have no hard failure state, which didn't seem to fit the feel of the game."
- Bible change (applied in v1, section 6): the target feeling chooses soft failure only, or soft failures plus a real run end; the brief says which. Note the tension with "failure is a reprieve" (first round): both can hold, since a reprieve happens inside a run and the run can still end.
- Lesson: Back pressure should gain complexity over time, not only be a timer that speeds up; the timer can stay as one layer.   Status: one data point (promoted to Bible v1)
- Evidence: Slone: "I also would have liked to see a back pressure that was more dynamic than the timer. Not necessarily to replace the timer but to have the back pressure complexity ramp over time."
- Bible change (applied in v1, section 6): pressure gains complexity (new sources, changing character), timer as the base layer.
- Proposed atoms (Slone decides): p-layered-pressure: pressure sources are added or change character as the session goes on, on top of a base timer.

## 2026-10-29 _demo (third round)
- Lesson: Confirmation that layered back pressure that grows, plus a hard failure and the crunchier failure, improved the demo.   Status: one data point (reinforces the v1 entries; not yet a second night)
- Evidence: Slone: "Improvements to the demo game are great! What an improvement." and "The back pressure now feels dynamic and growing which is working well."
- Lesson: Growing back pressure needs matching forward pressure: the player's power should also rise.   Status: one data point (promoted to Bible v2)
- Evidence: Slone: "there's no increase in forward pressure."
- Bible change (applied in v2, section 6): forward pressure bullet.
- Lesson: A "doing well" sound that does not lead anywhere reads as meaningless; reward cues need a consequence.   Status: one data point (promoted to Bible v2)
- Evidence: Slone: "You get this rising sound indicating that you're doing well, but it doesn't mean anything."
- Bible change (applied in v2, section 6): every reward cue must mean something.
- Lesson: Slone wants an earned, player-triggered power moment: a combo meter fills, a prompt appears, he presses the button, and for a few seconds he is in a spectacle state (constant speed, steer only, hazards die spectacularly).   Status: one data point (promoted to Bible v2)
- Evidence: Slone: "Add a meter that fills as you increase your combo, and when it fills it gives a juicy animation and says 'press (button)'. When you do, for a few seconds lots of particles falling off you, colors animating... you start moving at a constant rate and you can only change the direction. Any enemy you hit dies in spectacular fashion."
- Bible change (applied in v2, section 6): earned power moments.
- Proposed atoms (Slone decides): v-power-surge: a meter fills from skilled play and the player triggers a short empowered state that flips the pressure (hazards become prey); p-forward-pressure: the player's power escalates alongside the pressure.

## 2026-10-29 _demo (fourth round)
- Lesson: AI is weak at balance work, so each game should expose a handful of tweakable balance values in a menu that Slone tunes; eventually those values are saved globally through an API so all players get his settings.   Status: one data point (promoted to Bible v3)
- Evidence: Slone: "I expect it to be challenging for ai to do balance work, so each game should expose a handful of tweak able values in a balance menu. Eventually we should make it so I can save those globally to an api so all users get the values I adjusted it to."
- Bible change (applied in v3, section 11); scaffold feature built (Balance screen in the pause menu); API recorded in ROADMAP.md.

## 2026-10-29 _demo (fifth round)
- Lesson: Slone wants the surge to feel chaotic and a little unwieldy, and faster (at least 2x the first version); a power moment can be hard to control rather than smooth.   Status: one data point
- Evidence: Slone: "It should feel chaotic and a little unwieldy." Applied to `_demo` by explicit request (PR #4).

## 2026-10-29 music (loops versus one-shots)
- Lesson: Loops cover nearly everything because ongoing player action cannot be mapped to a length of time. A one-shot is a stinger of a couple of measures that accents an event (level beaten, you died), not a short song.   Status: one data point
- Evidence: Slone: "We need loops for most scenarios because ongoing player action is not mappable to a length of time. One shots would typically just be a couple measures meant to accent a big thing having happened. You beat the level. You died. Etc."
- Applied to the music generator (loops for songs; `composeStinger` for events) in `docs/design/06-music-craft.md`. Earlier in the same session: not every song should be an earworm, and a vibe can be any tempo (frantic included). Both one data point.

## 2026-10-30 2026-10-30-stillwinter
- Lesson: When time is frozen between decisions, execution difficulty disappears (a bot with no hands wins), so all pressure has to come from scarcity and from threats that advance on a clock the player controls.   Status: one data point
- Evidence: greedy bot won with 0 hearts lost at first tuning; difficulty only appeared after ice scarcity and telegraphed warm fronts were added (runs/2026-10-30-stillwinter/surprises.md).
- Proposed Bible change: section 6, add "no clock means no skill wall: tune by scarcity and layered threats, not by speed" (Slone decides)
- Lesson: A spend-to-act economy snowballs into a win-or-collapse cliff unless failure refunds materials (a lost heart melts into ice).   Status: one data point
- Evidence: bimodal bot outcomes (win with 0 lost or lose with 5) vanished after a lost heart gave +4 ice.
- Lesson: One object with several reasons to break it (turret, mine, clock-winder) gave the most meaningful decisions in the build.   Status: one data point
- Proposed atoms: v-sacrifice-for-time: break your own defenses to release time; p-time-as-currency: simulation time itself is the spendable resource; l-failure-refunds: a failure melts into the materials to rebuild.
- Process note (night had an extra instruction from Slone): a seeded "genre roll" over five candidate genres chose tower defense for the theme; it took a few minutes and decided a question the agent would otherwise have defaulted. Worth considering as a standing step.   Status: one data point

## 2026-10-30 nightly process (genre roll, drastic changes)
- Lesson: Slone wants the nightly agent to list 3 to 5 genres that fit its theme and have a script pick one at random (his first try picked tower defense), and wants drastic changes to be reasonable and even encouraged when a prototype is not panning out.   Status: one data point (promoted to Bible v7, section 4)
- Evidence: Slone: "after you choose your theme, make a list of 3-5 genres that would fit it, and run a script to randomly pick one. It picked tower defense. Let's have that be part of the general guidance. And let's also clarify guidance that when things aren't panning out for a prototype, drastic changes are reasonable and even encouraged."
- Early result, same day: with the rolled look plus the random genre the next game (an isometric, dithered, ice-spire tower defense) looked and played nothing like the demo or Unjam. Slone: "Fascinating result so far. Getting better variance than the last [one]." One data point that random draws for look and genre give more variance than the agent's own choices.
- Applied: `night-state.mjs genre` (random pick, skips recent genres, one roll per night unless a logged `--reroll`), guidance in CLAUDE.md and the run protocol, a "When it is not working" section, and the brief and ledger templates.

## 2026-10-30 nightly process (iteration)
- Lesson: nightly agents quit early (done after about 20 minutes) because they treat the phases as a single pass. Slone: game development is iterative; you build, play, note what works and what does not, iterate, repeat, and when time runs out or the rough edges are sanded down you step back and look at it from a high level, and with time left you repeat the whole thing. Related, earlier: once an okay game exists he has a million ideas, while blank pages are paralyzing.   Status: one data point (promoted to Bible v6, section 4)
- Evidence: Slone: "It keeps quitting early. Like it's done after 20 minutes or so. But game development is iterative. You build, play, note what's working, what isn't, iterate, repeat."
- Applied: the run protocol's middle phases became an "Iterate" loop with a round template and step-backs; `night-state.mjs round` logs them; `checkpoint done` is refused before the minimum time (first set at 2:30, then 1:00 for a 90 minute night) or without 3 rounds and a step-back unless `--early --reason`; `check` shows the round count; post mortem gets a Rounds line.

## 2026-10-30 2026-10-30-stillwinter (Slone's first play)
- Lesson: Linking a cause to its effect in nonverbal ways is powerful.   Status: one data point (promoted to Bible v4, feel checklist F2)
- Evidence: Slone: "It took several turns before I understood what was happening but once I did I found the idea really interesting." and, on the fix he asked for: numbers should come off dying entities and fly to the timer.
- Lesson: A queued state for newly placed things (not real until the clock starts) closes the place-and-break exploit and makes running out of breakable things a fail state.   Status: one data point (promoted to Bible v4)
- Evidence: Slone: "you shouldn't be able to destroy things that were placed during the same pause time ... running out of things to destroy is a fail state. Great. It also means the game needs to start with some things on the board."
- Lesson: A selector the player can cycle must show the button that cycles it, laid out horizontally; a vertical list hid that LB and RB choose the tower.   Status: one data point (feel checklist F2)
- Evidence: Slone: "I didn't realize I could choose among the towers to place for a while. Having them vertical made it unclear that it was a bumpers thing ... LB and RB indication." (He asked for no explanation text.)
- Lesson: A genre he is usually ambivalent about (tower defense) hooked him once the central rule was flipped.   Status: one data point
- Evidence: Slone: "I typically am ambivalent toward tower defense but this has me intrigued."
- Proposed atoms: v-queue-then-commit: placed things are ghosted until a trigger makes them real; p-fuel-is-the-fail-state: running out of what powers the clock ends the run.

## 2026-10-30 2026-10-30-stillwinter (Slone's later rounds)
- Lesson: Loose text over the game reads as an afterthought; prompts and end-of-run screens must be designed, anchored UI (key-cap chips on a plate, choice cards, a sequenced tally).   Status: one data point (promoted to Bible v7, 7a)
- Evidence: Slone on the input prompts: "They're just text over the game. Make them look like a more intentional part of the UI." On the completion screen: "It looks like an afterthought." On the loss screen: "More unanchored boring ui stuff." On "Polar Night, again": "looks like unanchored text."
- Lesson: Put the currency near where it is spent; keep unlike meters apart and distinguish them by shape, not only numbers (a flying time number looked as if it fed the sunrise bar).   Status: one data point (promoted to Bible v7)
- Evidence: Slone: "Put the available currency nearer to where you spend it." and "Move the timer so it's not so close to the other meter. It looks like the damage is going to that other meter. And have the timer be communicated by shape as well as numbers."
- Lesson: Make the win unmistakable and show it: the hero object powers up and eviscerates what is left, one enemy after another; name modes plainly (Polar Night was unclear).   Status: one data point (promoted to Bible v7)
- Evidence: Slone: "Is dawn a win state or a fail state? It wasn't clear to me. If it's a win, it should have all the on screen enemies die first in sequence" then "have the sun come up, power up the main tower in spectacular fashion, the main tower just eviscerates the remaining enemies." and "what does polar night even mean? We may need to make that clearer".
- Lesson: Projectiles and hits must be the loudest things on screen: large, high contrast on light and dark ground, trail and particles, a visible emitter that animates on fire, a big hit tell; damage marks must align with the art.   Status: one data point (promoted to Bible v7)
- Evidence: Slone: "The bullets are also kind of invisible. A lot of white on white... when something gets hit, it should have a bigger tell. ... the damage states ... have misaligned markers", "I still can't see projectiles ... Maybe more of a contrast color? Trail? Particles?", "Give each tower type a clearer source of its projectiles and have that source animate on fire".
- Lesson: Unit types should be meaningfully different jobs that their shape, animation and behaviour make obvious after a little play; a healer visibly sends health to its targets.   Status: one data point (promoted to Bible v7)
- Evidence: Slone: "Replace one of the tower types with one that has a healing AOE. Make the shape language say that. A heart or plus ... have it 'send' health to friendly towers in range. In fact do an overhaul of the tower types. They should be meaningfully different and the way they look, animate, behave should make their 'thing' obvious after you've played with it a bit."
- Proposed atoms (Slone decides): v-heal-allies: a unit sends health to hurt friendly units in range; f-role-readable-units: each unit type's one job is stated by shape, idle animation and behaviour.
- Process note: Slone's feedback came as short chat messages while the game was open; each was applied to the game directly (his requests are the answer to the update-or-not question) and the lesson recorded here.   Status: one data point


## 2026-10-29 2026-10-29-unjam
- Lesson: A jam needs a cooldown after it is cleared. Without it the freed blobs re-wedge in the same step and the verb feels like whack-a-mole; with a short clear window the pile floods through and the release is the payoff.   Status: one data point
- Evidence: bots (sim): before the clear window greedy delivered about 85 blobs in 120 s with a jam every 3 s; after it, about 360 with 33 floods on two of three seeds.
- Proposed Bible change: section 6, "release needs room": when a game's verb is clearing an obstruction, make the moment right after the clear generous, so tension turns into visible relief. (Slone decides)
- Lesson: A curator choice (two generated options, risk for reward) is cheap to build as a short pause between waves, and gives the speed-ramp a human hand on the dial.   Status: one data point
- Evidence: built, not yet played; whether the choice mattered is feedback question 3.
- Proposed atoms: v-clear-obstruction: the main verb removes a blockage and the backed-up flow rushes through as the reward.

## 2026-10-30 2026-10-30-blotbeat
- Lesson: When failure produces the player's power resource, the economy needs a relief valve cost (a lock after spending, a halved gain while powered) or a bot that never plays can survive by cashing in on reflex; a second pressure that punishes hoarding (a leak while the store is over half full) is what makes "cash in now or carry more" a real decision.   Status: one data point
- Evidence: the stamp-only bot survived all four sets with the first economy; with a six-beat lock and half ink in fever it fails at about 79 s, and the "hold or cash in" choice appeared only once the leak existed (runs/2026-10-30-blotbeat/surprises.md).
- Proposed Bible change: section 6 (stakes), add "if failure feeds the player's power, make spending it cost something and give hoarding a price, or the loop collapses to cashing in" (Slone decides).
- Lesson: Anything that freezes simulation time (a hit pause) breaks timing against a fixed-time external clock such as music; use shake, flash and particles there instead.   Status: one data point
- Evidence: reasoning from the build (the stamp used no hit-stop on purpose); not yet confirmed by play.
- Lesson: Reward clean play with something that mirrors what mistakes buy, or the skilled player has no forward pressure of their own (here a clean set returns a page, and one sticker lets perfect streaks charge the power moment).   Status: one data point
- Evidence: greedy bot stamped 5 times a run while a 70% bot stamped 18 times, so the power moment belonged to the sloppy player until the Tidy Set reward and Ink Siphon sticker existed.
- Proposed atoms (Slone decides): v-spend-your-failures: misses become a resource you spend; p-leak-while-rich: a store leaks into the pressure meter while it is over half full; l-clean-run-restores: a clean stretch returns something lost.
- Process note: `themes.mjs roll` allows one roll per calendar date, so a second night on the same date (this one followed `2026-10-30-stillwinter`) got no rolled theme and the agent had to write its own, which defeats the injected randomness. Suggest keying the guard to the night id rather than the date.   Status: one data point
- Tech note: the juice tween manager replaces a tween on the same property, so `tween(x, {alpha: 1})` followed by a delayed `tween(x, {alpha: 0}, ..., {delay})` silently cancels the fade-in (every prompt plate was invisible until a screenshot showed it). A line in `SCAFFOLD_API.md` would save the next night the hour.

## 2026-10-30 2026-10-30-blotbeat (Slone's first play)
- Lesson: When a game has a soundtrack, the actions it demands must be the soundtrack's own events; a generated challenge placed near an independent loop reads as two unrelated systems, and a generic loop is the weakest soundtrack.   Status: one data point (promoted to Bible v8, section 7b)
- Evidence: Slone: "The music and the game seem completely detached from each other. And the music is super vanilla. A rhythm game you need to be able to feel the exact same beat and the key rhythmic hits between the song and the inputs needed to succeed. Redo the music, including some different songs with variation in tempo and tone, and figure out how to marry the music and the gameplay better." The original build made the chart from its own random phrases and played one generated groove at four tempos.
- Process note: this is a request to change the game ("redo the music"), so it was applied directly; the lesson is recorded here and in the Bible.
- Lesson: Simultaneous inputs must suit the hand: on a diamond of four face buttons one thumb can press neighbours together but not opposites, and cannot hold one while pressing its opposite; the amount asked per moment must also be bounded.   Status: one data point (promoted to Bible v8, section 7b)
- Evidence: Slone: "Make sure the number of notes from moment to moment aren't overwhelming." and "Consider the human thumb on a controller. You can hit a and c or a and b at the same time but not x and b, and not a and y." The first version paired opposite lanes on purpose.
- Tech note: locking a game's clock to music needs the audio playhead in seconds without wrap; `SongPlayer.elapsed` and `music.elapsed` were added on this branch (two small getters), a candidate for a main PR with a test.

## 2026-10-30 taste round 2 (ten more games)
- Lesson: transformation as payoff, one verb asked new questions, costly choices, short and sharp, cryptic but not obfuscated, kooky tone, edge of catastrophe.   Status: one data point each (promoted to Bible v9, section 6; ten new taste cards, 21 new atoms, 16 new themes)
- Evidence: Slone's list. Cloud Gardens ("seeing something dead come to life, seeing beauty take form, plus the solar punk aesthetic"), Chicory ("a world take on shape and color that you put there"), Fez ("perspective changes the experience"; cryptic puzzles "a little too obfuscated sometimes"), DuckTales ("a unique and satisfying traversal mechanic in the pogo cane"), Katamari Damacy ("unabashedly kooky and silly"), Lego Party and WarioWare ("bite sized things... the mechanics don't overstay their welcome"), VVVVVV ("the input doesn't change, but the hazards do... learn one at a time, then... increasingly layered"), The Last of Us ("spending a resource could either be used for offense or defense... painfully sacrificial"), Townscaper ("the surprise and delight of discovering a new layout"), Hot Wheels Unleashed ("always on the verge of either catastrophe or triumph... hitting the boost feels unwieldy and chaotic and dangerous").
- Contradiction, resolved by Slone ("I may have just not given Minecraft much of a chance. A game that is rich with discovery, oddity, curiosity, can function with or without pressure, since the driving force is curiosity and/or creativity."): the Minecraft negative card was withdrawn and its note about preferring back pressure removed; the Bible now says curiosity and creativity can drive a game with or without pressure. Original flag: the Bible says open-ended play needs back pressure (and the Minecraft card says he prefers sandboxes with back pressure), but Cloud Gardens, Chicory and Townscaper are pressure-free toys he loves. Proposed reading, now in Bible v8: something must drive the player, either a push (pressure) or a pull (a world waiting to be revealed). Slack sandboxes with neither are what he dislikes.

## 2026-10-30 music variety
- Lesson: agents compose the same music every night (mid-tempo background groove) unless the process forces a different starting point and asks what the music is for. Music should be chosen as a design tool for pacing, tension and release, state, and identity.   Status: one data point (promoted to Bible v10, section 7)
- Evidence: Slone: "I'm also finding that the agents all use effectively the same music. Mid tempo background nothingsauce music." The first four games' music files agree: 92 to 120 bpm, 4/4, D or F dorian or mixolydian, a rock or funk groove, a sync sub bass, a bell or pluck arpeggio, mood "playful", loop layout `groove-8` or `loop-12`; the docs' own example used the same values.
- Follow-up from Slone: "Rather than rolling for music, I think the music just needs to fit the game, carefully considered. Randomness won't be the tool here." (Look, genre and theme rolls stay; music is reasoned from the game.)
- Applied: a Music plan in the brief that requires weighing at least three options from across the spectrum and choosing for the game (Slone: music should fit the game, carefully considered; randomness is not the tool, so a first attempt at a seeded sound roll was dropped), a menu of options with generator settings (`night-state.mjs sound`, `scripts/sounds.mjs`), `reviewGameMusic` (`src/music/review.ts`), a "Music is a design tool" section in `docs/design/06-music-craft.md` with research and a technique table, and an example in `SCAFFOLD_API.md` that no longer carries copyable values.

## 2026-10-30 2026-10-30-blotbeat (keyboard)
- Lesson: When controls are spatial (a diamond of four lanes), the keyboard mapping must be spatial too (arrow keys), with arrow glyphs in the prompts; reading each arrow as its own lane also allows neighbouring doubles.   Status: one data point (in `07-rhythm-game-lessons.md`)
- Evidence: Slone: "The game doesn't work on keyboard because the directions don't map to the keys we assign. We could use up/down/left/right instead, when on a keyboard. Arrow glyphs on the ui prompts would work well." The face-button fallback keys (Space, X, C, V) are not spatial.
- Proposed scaffold change (Slone decides): the keyboard fallback could also set the D-pad buttons from the arrow keys, so prototypes can read four independent directions on a keyboard without touching the stick.

## 2026-10-30 2026-10-30-blotbeat (difficulty ramp and links)
- Lesson: A level that changes several difficulty dimensions at once (a lane, a new note kind and double the density) reads as a cliff; change one dimension per step and test the ramp.   Status: one data point (in `07-rhythm-game-lessons.md`)
- Evidence: Slone: "the second level is a huge leap in difficulty. Make it have less difficult note patterns." Set 2 had gone from 1.5 to 2.8 notes per second, 3 to 4 lanes and introduced holds.
- Lesson: Things that must be done together should be visibly tied on screen.   Status: one data point
- Evidence: Slone: "When two notes are simultaneous, link them together visually somehow."

## 2026-10-30 2026-10-30-blotbeat (lane colours)
- Lesson: Direction or lane identity should be carried by colour as well as position, everywhere the lane appears, so upcoming inputs stay readable when the pace rises; the standard pad colours are a good basis, adapted to the game's palette.   Status: one data point (in `07-rhythm-game-lessons.md`)
- Evidence: Slone: "It's still difficult to grok what's next when things speed up. Having different colors for each direction would help a lot." and "You could use the standard abxy controller button colors. Or your own flavor if it's better for theming."

## 2026-10-30 2026-10-30-blotbeat (ink without words)
- Lesson: A resource economy must be one connected visible story (cause, path, store, pressure, overflow, spend), with costs and lives as physical things in the world, and it must pass a no-words test; separate gauges and banners for the same thing read as disconnected.   Status: one data point (promoted to Bible v9, section 7c)
- Evidence: Slone: "The flow of ink from one place to another needs to be visibly happening, connected. If there's pressure that needs to read visually. If there's overflow, show an overflow. But ink falling on the board having something to do with the character in the middle and the pages in the ui? It's all disconnected today. ... If it can't be communicated clearly without words, then it's not a good design and needs to be overhauled." Process: five options mapped (plumbing, tide, creature-as-tank, pen, hybrid) in `runs/2026-10-30-blotbeat/ink-design.md`, one built, storyboarded and iterated five times.
- Result worth keeping: making the failure itself become the resource (a missed note turns into ink and runs along its own lane into the character) connected the cause to the store with no extra object.

## 2026-10-31 why the demo beat every nightly (Bible rebuilt, v11)
- Lesson: the first demo is better than every nightly prototype because it was verb-first, layered at a good pace with every layer readable from visuals alone, and built to a hilarious, earned peak (berserk), then iterated over five rounds of play; the nightlies over-indexed on theming (systems bent to prove the theme), explained rules with text, and lacked a peak moment.   Status: one data point (promoted to Bible v11, sections 1 and 2)
- Evidence: Slone: "none of the prototypes has been as good as that first demo"; "The game was not complex. It layered at a good pace, but was always sufficiently communicated by visuals, plus the berserk mode is hilarious and fun as heck."; "I think the other games may have overindexed on theming." Also his tenet candidates: "Iteration is critical. Don't polish turds, flush them. Show, don't tell. Identify the verbs and keep the list short. Layer complexity with intention. One great idea is better than 3 good ones."
- Applied: core tenets at the top of the Bible and in `CLAUDE.md`; a section on the shape of the best build; four checks (toy, pace, peak, theme) in the step-back and post mortem; brief template lines for verbs, first ten seconds, peak, layer schedule and theme expression; the themes doc now calls themes sparks, not specs.

## 2026-10-31 pitch before code
- Lesson: agents should spend more time considering and refining an idea before writing code, starting with a design one-pager that is scrutinised and iterated; a good game is marketable, so if it takes too much explanation to sell it, or you do not know who it is for, it is not good; think like you intend to sell it to humans you have to win over.   Status: one data point (promoted to Bible v12, tenet 4)
- Evidence: Slone: "I think it would benefit agents to spend more time considering and refining ideas before writing any code. Perhaps a design one-pager comes first, is scrutinized, iterated on. A good game will be marketable. If it takes too much explanation to sell it to someone, it's not good. If you don't know who it's for, it's not good. Think like you actually intend to sell the game to humans whom you have to win over."
- Applied: a Pitch phase in the run protocol (write, scrutinise with eight tests, hostile reader, revise; about 20 minutes), `night-state.mjs pitch` and a gate that refuses `checkpoint core` before two logged pitch rounds, a two-part brief (pitch, then plan), a Pitch line in the post mortem, and the constitution slimmed to governance with moved sections left as pointers.
