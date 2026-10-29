# 01 Feel Checklist (read-only)

Run this on every build before wrap-up. For each item, mark: yes, no, n/a, or untested. Report counts in the post mortem. Items marked [bot] can be checked by telemetry; [Slone] need his feedback.

## A. Responsiveness
- [ ] Input to visible response within one frame (about 16ms) for the main verb. [bot]
- [ ] Input to audio response under about 50ms. [bot]
- [ ] Input buffering on time-critical actions (accept presses slightly before they are legal). [bot]
- [ ] Coyote time or equivalent forgiveness on edge actions. [bot]
- [ ] Analog stick shaped: dead zone, response curve tuned, no jitter at rest. [bot]
- [ ] Restart after failure is immediate (under a second). [bot]

## B. Motion
- [ ] Everything arrives, moves, and leaves with easing; no linear snaps on UI or entities.
- [ ] Acceleration and deceleration give the main verb weight; the movement is a toy before any level exists. [Slone]
- [ ] Camera follows with smoothing (`chase`), with look-ahead or deadzone where useful.
- [ ] Entrances use random delay jitter so groups feel organic.

## C. Impact and feedback (stack small effects)
- [ ] Squash and stretch on the main actor and on impacts.
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
- [ ] Rising pitch for progress uses equal semitone steps up to a cap (about an octave), then adds a different layer; each step is audibly distinct. [Slone]
- [ ] No clipping; loudness balanced across sounds. [bot]
- [ ] Silence is intentional, not accidental. [bot]
- [ ] Music only if the brief calls for it.

## E. Personality
- [ ] The main actor has character: eyes, expressions, idle animation, reactions to success and near-miss.
- [ ] The world reacts to the player (things wobble, sway, notice).
- [ ] Failure is funny, dramatic, or readable, never just a freeze.
- [ ] Failure gets the same effect stack as the main verb (layered sound, freeze, shake, flash, particles, text, a reaction from the actor). [Slone]

## F. Readability and Deck fit
- [ ] Good and bad things distinguishable by color and shape at a glance.
- [ ] Text readable at 1280x800 at arm's length; minimum text size defined and respected.
- [ ] Nothing important sits at screen edges that a handheld obscures.
- [ ] Palette is deliberate and consistent (apply `frontend-design` thinking in-game).
- [ ] Pressure is visible: the player can see what is coming and how bad it is.

## G. Pressure and recovery (taste)
- [ ] Idle bot proves back pressure acts without player input. [bot]
- [ ] Pressure rises over time or with exploration, with a visible curve.
- [ ] A soft failure leads to a recoverable state, with a story-worthy moment. [Slone]
- [ ] After a failure the pressure eases or its ramp restarts (a reprieve), not the pre-death rate. [bot: rate after death < rate before]
- [ ] Collecting or progressing opens new functionality or content, not only score. [Slone]
- [ ] Discovery of a new verb, item, or pattern happens within the first few minutes. [Slone]
- [ ] No mastery wall: a first-time player can progress. [bot: greedy vs. random]

## H. Performance
- [ ] 60fps target; at least 55fps average with all effects on. [bot]
- [ ] Particle counts capped; frame time logged with effects on and off. [bot]
- [ ] Juice dial works (every layer toggles; intensity slider).

## I. Core first sanity check
- [ ] The bare core (juice off) is still interesting for at least 30 seconds of play. State how you judged this (bot variance, decision rate, your own reading of the loop). Never use juice to rescue a flat core.

## Reporting
In the post mortem list: items passed, items failed, items untested, and the one item most likely to feel wrong to Slone.
