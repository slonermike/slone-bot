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
