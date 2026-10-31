# Post mortem: Speck (2026-10-31-tiny-inside)

Built short on purpose (low weekly tokens, pencils down early). Genre: exploration platformer, theme: being very small in a very large thing, look: paper / ribbons and curves / soft gradients.

- What it is: you stay the same size, nine round worlds grow 1.45x each tier. Run around the curve, hop (hold for height), steer in the air; gravity follows the nearest world. Landing on a bigger world refills glow and swoops the camera back out; the last world is a sleeping eye that opens.
- Worked (bots and screenshots): idle fades (drain works), random reaches tier 3, greedy completes in about 15 s, spin probe stays low. Zoom plus a halo that never shrinks below 8 px sells "a speck". The eye finale reads.
- Not verified by play: the feel of the hop on the Deck, whether the glow drain is fair, the music in the ear (it is composed and unit-reviewed, not heard).
- Added late: telegraphed gusts from tier 2 (knob `wind`). Weak: little else pressure, nothing to do on a world besides run to the next hop, tiers are fairly uniform, a human run is probably about 2 minutes. The peak is the eye; it is a quiet reveal rather than a loud one.
- Feel checklist: passed (bot) responsiveness, hop buffer and coyote, squash, shake, hit-stop, particles, number pops, pitch ladder, music layers by tier plus a calm/tense pair, stingers; untested by Slone: everything marked [Slone]. n/a: eyes on the actor (it is a speck).
- Most likely to feel wrong: running speed and gravity on the biggest worlds (scaled by size^0.45), and the camera zoom speed.
- Knob to try first: `drain` (Glow loss per second); then `jumpPower`.
- Debug: `?tier=N&eye=1` starts on world N, optionally with the eye open.
- Next ideas: a second layer (wind that pushes you off, or sleepy creatures on bigger worlds), glints that must be chained to unlock the next hop, something living on each world that reacts to you.

## Iteration after the first pass (brutal round)
- Critique: a straight line of nine hops with nothing to do on a world, no choice and no cost; a quiet peak.
- Changed: surface motes (3 + tier per world). Collect them all to bloom the world (coral flood, glow back); hopping on without blooming refills glow only partly, so skipping costs something. Finale now pulls the camera back to the whole constellation. Fewer glints on the arcs.
- Greedy run is now about 38 s (was 15 s). Still untested by a human. Debug: `?done=1` jumps to the end state.

## Urgency and arc fix (user feedback)
- Slone saw thin lines running from drawn rings and ribbons toward the origin on a real device. Cause: Pixi `Graphics.arc()` continues the current path, so an arc without a fresh moveTo gets a connecting line from the path's last point (usually 0,0). The first fix added moveTo; now every arc is an explicit polyline (`arc.ts`). Taken to main as `helper/arc-path` (juice `arcPath`, test, SCAFFOLD_API row).
- Added urgency to leave a world: after landing, ink starts creeping round the surface toward you (2.2 s warning, speed = knob `blot` x your run speed plus 4% per tier). Touching it drains glow fast. Blooming the world (collecting all its motes) clears the ink; hopping on resets it on the new world. Idle and spin probes now fade repeatedly; greedy unchanged at about 38 s.

## Layer schedule (slow, steady growth)
Tier 0 pure toy (no ink, no drain for 12 s). Tier 1: ink chases you. Tier 2: gusts (faster cadence and stronger each tier). Tier 4: a second ink from the side. Tier 6: seeds drift (faster each tier). Plus ink speed +4% and glow drain up every tier. Each new layer is announced once with a short sticker label on arrival. Perfect-play greedy bot still clears in about 35 s, so human difficulty is the open question: tune `blot`, `drainRamp`, `wind`.

## Agent review round (publisher, physics, sound)
- Publisher: worlds felt empty, peak quiet. Added sleeper creatures that wake and look at you, and the first pebble stays as a dot in the wide shot.
- Physics: ink was harmless until tier 6 (2.2 s delay was longer than a half lap), glow pressure was back-loaded, respawn could death-spiral at the top, drifters were near-trivial. Fixed: ink delay 1.0 s, wider with tier, keeps chasing in the air (damages only when grounded on that world); drain 0.05 with ramp 0.008; respawn at full glow with 3 s grace; drifters 20 to 40 percent of run speed; gust default 1.5.
- Sound: tier chime now falls in pitch with a deep boom, own ink and gust sounds, low-glow heartbeat, bloom chord, calm/tense hysteresis, scaled shake.
- Still not done: hand-play on a Deck; camera hold on big jumps; eye reacts on approach.

## PIVOT: sea of worlds (supersedes everything above except the look and music)
Direction from Slone after playing: the gravity around the circles was the most interesting thing. New game: real n-body gravity (every world pulls, 1/d^2), reach the golden home world each level. World types: rock (safe), sun (lethal, strong pull: swing round it), crumble (stand too long and it kills you), fade (vanishes after your stay and drops you into the field, returns later), blink (on/off on a timer, with a flicker warning), gum (bounces you), repel (pushes you away), moving worlds, and from level 9 a Hunter that follows you and spits gravity-bent ink (worlds shield you). Twelve short levels: 1 is one hop, 2 adds a sun, 3 crumble, 4 a long gap that sun pull helps, 5 fade, 6 blink, 7 gum, 8 moons, 9 the Hunter, 10 push and pull, 11 the sea, 12 the eye home. Hop-preview dots show the arc. Bots: greedy forward-simulates 48 launch angles and clears all 12; random reaches about level 5; spin stays at level 1.
