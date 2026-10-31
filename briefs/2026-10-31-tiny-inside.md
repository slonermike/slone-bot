# Brief: Speck   (2026-10-31-tiny-inside)

## Pitch (one page)
Pitch sentence: "An exploration platformer where you run and hop around round little worlds to reach bigger and bigger ones, and each landing the camera pulls back to show how small you really are."
Who it is for: Deck players who like Mario Galaxy, Katamari, Gris and cozy toys; short sessions in bed or on a train.
Why this and not that: Mario Galaxy needs 3D and a console; Katamari only grows, here YOU stay tiny and the WORLD grows; Gris is slow, this is a bouncy toy.
Hook and anchor: the zoom-out reveal on every new tier (anchor: run and jump on a little planet).
First ten seconds: a glowing dot on a pebble; stick runs around the curve, A hops; a trail of glints leads off the edge to a bigger round thing; landing zooms the camera out with a swoosh and chime.
Verbs and the toy: run (around the curve), hop (variable height, steer in the air). Running and hopping around a round world with gravity that swings is a toy alone.
Peak: the last tier, a planet-sized sleeping eye opens and looks at you.
Target feeling: awe and tenderness at being very small in a very large thing.   Question: does the scale-reveal on landing make a simple planet-hopper feel wonderful?
Theme and genre: "Being very small in a very large thing" and exploration platformer. Theme expression: the player is always the same size, the worlds grow 1.45x per tier, the camera shows the player as a speck with a halo. Genre options listed: exploration platformer, puzzle, arcade collector, stealth, idle tending.
What it is not: no combat, no text tutorial, no 3D.
Scrutiny log: round 1 failed hook and complexity: made the zoom reveal the one signature and cut every hazard but one drain. Round 2 failed peak: added the eye finale.

## Plan
Mode: content-driven (about 5 minutes to the eye), restart is instant.
Human input: none (unattended)
Atoms: v-bounce, w-dense-small-world (scale-up flavour: l-scale-up)   Wildcard: none
Look (rolled): paper / ribbons and curves / soft gradients; framing radial; ui stickers. No overrides. Colors: paper 0xf3ecdc, ink 0x1d1b22, spot coral 0xff5638, shade 0xe2d6bb, ribbon 0x8a7f6a. At rest: warm paper with ink swirl lines on soft-shaded round worlds and a coral glowing dot.
Loop: reward = reach a bigger world (zoom reveal, glow refilled) | pressure = your glow drains, faster each tier | fail = glow out: you fade and restart from the first world instantly | actions = run, hop, air-steer
Layer schedule: tier 0 pure toy, no drain for first 12 s; glints appear leading the jumps; drain starts; drain ramps per tier; music layers per tier; eye at the last tier.
Pressure source: glow drain, ramp per tier (knob). Glints refill.
Recovery loop: running out of glow in a high tier sends you back to the start of that tier's world with half glow (soft); only repeated failure ends the run? Decision: soft only, you drop to the previous tier's world and keep the best tier; the run ends at the eye.
Different from the last five nights: planet gravity hopper with a zoom reveal, paper look, slow beatless music; previous nights were tower defense, rhythm and unjamming.
Feel plan: squash on land, dust, trail, glint pitch ladder, tier-up shake + hitstop + confetti + zoom, low-glow warning tone and music shift.
Music plan: weighed (1) driving four-floor chase (urgency, wrong for awe), (2) march (comic, wrong), (3) beatless drift + two moods. Chosen: build by layers + two moods. Calm = 3/4, 66 bpm, lydian, beatless music box/drift; tense (glow low) = 7/8, 96 bpm, phrygian pulse and shimmer, same root. Arc: sparse pad -> bass -> arp -> lead hook on tier-ups. Gauge: parts follow tier; tense loop when glow below 30%. Quiet: lead drops out between tiers. Stingers: powerup (glints chain), win (eye), lose (glow out), secret (tier-up). Differs: slow, beatless, 3/4.
Screens and UI plan: sticker badges: glow ring badge top-left, tier pips top-right, key-cap prompt chips at the bottom on first world only.
Balance knobs: drain (glow loss per second, 0.04), drainRamp (per tier, 0.015), glintGain (0.12), jumpPower (1.0), runSpeed (1.0), gravity (1.0).
Telemetry plan: tier, glints, deaths, best tier; bots: greedy runs to the next body and hops; degenerate-spin runs in circles.
Feedback questions: Is the zoom-out a thrill? Is the toy fun alone? Is the drain fair? Does the eye land? Do you want more things to do on worlds?
