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
