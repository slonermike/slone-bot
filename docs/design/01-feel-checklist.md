# 01 Feel Checklist (read-only)

Run this on every build before wrap-up. For each item, mark: yes, no, n/a, or untested. Report counts in the post mortem. Items marked [bot] can be checked by telemetry; [Slone] need his feedback. Items written around an actor, a camera, real-time input or collisions apply only if the game has them: mark them n/a otherwise and say what plays that role instead.

## A. Responsiveness
- [ ] Input to visible response is immediate (for real-time input, within one frame, about 16ms) for the main interaction. [bot]
- [ ] Input to audio response under about 50ms. [bot]
- [ ] Input buffering on time-critical actions (accept presses slightly before they are legal). [bot]
- [ ] Coyote time or equivalent forgiveness on edge actions. [bot]
- [ ] If the game uses analog input: shaped with a dead zone and a tuned response curve, no jitter at rest. [bot]
- [ ] Restart after failure is immediate (under a second). [bot]

## B. Motion
- [ ] Everything arrives, moves, and leaves with easing; no linear snaps on UI or entities.
- [ ] The main interaction has weight and is satisfying before anything is built on it (for a controllable actor: acceleration and deceleration, motion that is a toy on its own). [Slone]
- [ ] If the game has a moving camera: it follows with smoothing (`chase`), with look-ahead or deadzone where useful.
- [ ] Entrances use random delay jitter so groups feel organic.

## C. Impact and feedback (stack small effects)
- [ ] Squash and stretch (or an equivalent give) on the main actor, pieces or UI, and on impacts.
- [ ] Flash on contact (white or color), then fade.
- [ ] Hit-stop on big impacts (2 to 6 frames), scaled to impact.
- [ ] Screen shake scaled to event magnitude, trauma-based, amplitude capped. Over-shake is a failure.
- [ ] Particles for impact, pickup, pressure, and recovery events (puff, debris, sparks, confetti).
- [ ] Trails on fast-moving things.
- [ ] Number or text pops for scoring and damage.
- [ ] Destroyed things do something (fall, spin, shatter, darken), not just vanish.
- [ ] Effects scale with magnitude; the biggest event looks and sounds biggest.

## D. Sound
- [ ] Main verb has a sound; each feedback event has a sound; pressure state has audio that changes as pressure rises.
- [ ] Pitch variation per play (a few percent) and round-robin variants for frequent sounds.
- [ ] Layered impacts: transient plus body.
- [ ] Parameters tied to gameplay (combo pitch, filter with pressure, volume with impact).
- [ ] Every rising or rewarding cue (pitch ladder, combo counter) has a consequence the player can feel: a meter, a state, a payoff. [Slone]
- [ ] Rising pitch for progress uses equal semitone steps up to a cap (about an octave), then adds a different layer; each step is audibly distinct. [Slone]
- [ ] No clipping; loudness balanced across sounds. [bot]
- [ ] Silence is intentional, not accidental. [bot]
- [ ] Music only if the brief calls for it.

## E. Personality
- [ ] The main actor has character: eyes, expressions, idle animation, reactions to success and near-miss.
- [ ] The world reacts to the player (things wobble, sway, notice).
- [ ] Failure is funny, dramatic, or readable, never just a freeze.
- [ ] A power moment, if the build has one, is announced with a prompt, triggered by the player, and clearly flips the pressure (what normally pressures the player becomes something they can use or overcome) with the biggest juice in the game. [Slone]
- [ ] A failure or setback gets the same expressive stack as the main interaction (layered sound, a hold beat, a visible reaction). [Slone]

## F. Readability and Deck fit
- [ ] Good and bad things distinguishable by color and shape at a glance.
- [ ] Text readable at 1280x800 at arm's length; minimum text size defined and respected.
- [ ] Nothing important sits at screen edges that a handheld obscures.
- [ ] Palette is deliberate and consistent (apply `frontend-design` thinking in-game).
- [ ] Pressure is visible: the player can see what is coming and how bad it is.

## G. Pressure and recovery (taste)
- [ ] If the game has back pressure: the idle bot proves it acts without player input. [bot]
- [ ] Pressure rises over time or with exploration, with a visible curve.
- [ ] Forward pressure exists: the player's power or options also grow as the pressure does (meter, power moment, unlocks). [Slone]
- [ ] Pressure gains complexity, not just speed: a new source or a change in character appears as the session goes on. [bot: count distinct pressure events by minute]
- [ ] The failure type matches the target feeling and the brief says which: soft reprieve only, or soft failures plus a real run end. A rising-threat game can end. [Slone]
- [ ] A soft failure leads to a recoverable state, with a story-worthy moment. [Slone]
- [ ] After a failure the pressure eases or its ramp restarts (a reprieve), not the pre-death rate. [bot: rate after death < rate before]
- [ ] Collecting or progressing opens new functionality or content, not only score. [Slone]
- [ ] Discovery of a new verb, item, or pattern happens within the first few minutes. [Slone]
- [ ] No mastery wall: a first-time player can progress. [bot: greedy vs. random]

## F2. Legibility of the rule (v4)
- [ ] Anything a break, kill or pickup releases visibly travels to the meter it feeds, and the meter fills on arrival, so cause and effect are linked without words. [Slone]
- [ ] A new player can tell what to do first from the screen alone (markers on what to press), and ghosted or queued states look different from real ones. [Slone]
- [ ] A list the player can cycle (spires, tools) is laid out horizontally with the bumper glyphs (LB / RB) at its ends. [Slone]

## F3. Interface, screens and units (v5)
- [ ] Every prompt is an anchored UI component (key-cap chips on a plate), not loose text over the game; cyclable lists show their bumper glyphs. [Slone]
- [ ] The currency is shown beside where it is spent; unlike meters are apart and differ in shape; state that matters is carried by shape as well as digits. [Slone]
- [ ] The win is unmistakable (hero object powers up, threats cleared in sequence) and the win and loss screens are designed (sequence, counting tally, plain reason, choice cards). Modes and rewards are named plainly with a one-line explanation. [Slone]
- [ ] Projectiles are visible on light and dark ground (size, contrast, trail, particles, flight time); each shooter has a visible, animated emitter; a hit has a big tell; damage marks line up with the art. [Slone]
- [ ] Each unit type has one obvious job that its shape, idle animation and behaviour all show; helping effects travel from source to target. [Slone]

## H. Performance
- [ ] 60fps target; at least 55fps average with all effects on. [bot]
- [ ] Particle counts capped; frame time logged with effects on and off. [bot]
- [ ] Juice dial works (every layer toggles; intensity slider).

## D2. Music
- [ ] The game has its own music (`src/protos/<slug>/music.ts`), composed from a brief, in one key shared by the loop and the stingers. [bot: unit-test your `partsFor` the way you test any pure function]
- [ ] A loop plays under the action (ongoing action has no fixed length); stingers (two to four bars) mark events: win, lose, power-up, secret.
- [ ] Parts enter with the game's pressure (pad, then bass, then drums, then arp), and the hook is held back for an earned moment, so the music tells you how the game is going.
- [ ] The music thins out when pressure resets, ducks under stingers, and is quieter while paused.

## I. Core first sanity check
- [ ] The bare core (juice off) is still interesting for at least 30 seconds of play. State how you judged this (bot variance, decision rate, your own reading of the loop). Never use juice to rescue a flat core.

## J. Agency and clarity (v4)
- [ ] The player's main input produces the effect they intend, with precision and predictability (no "mittens": control is not coarse or approximate where it matters). [Slone]
- [ ] A new player could say, from ten seconds of play with no text, what the goal is, what they control, and whether the last action was good. [Slone]
- [ ] Doing the right thing has distinct, positive feedback where the action happened, readable without any written explanation; wrong or wasted actions look different. [Slone]
- [ ] Progress toward the goal is a first-class on-screen element that changes visibly when the player plays well. [Slone]
- [ ] Activity that carries no information is quiet; the things the player must track at once are few and each says what it is. [Slone]
- [ ] An outcome can be traced to the action that caused it (the cause is highlighted or the consequence visibly arrives). [Slone]

## Reporting
In the post mortem list: items passed, items failed, items untested, and the one item most likely to feel wrong to Slone.

## I. Balance knobs (v3)
- [ ] The build exposes 3 to 8 balance values in the pause menu's Balance screen, each with a default, range, step, and plain label. [bot: spec present and values change the sim]
- [ ] The knobs cover the things most likely to be mis-tuned: pressure rate and ramp, forward-power rate, forgiveness, pacing of new layers.
- [ ] Defaults are playable by the greedy bot (not too easy, not impossible); the post mortem names which knob to try first. [bot]
