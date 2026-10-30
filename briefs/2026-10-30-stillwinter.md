# Brief: Stillwinter   (2026-10-30-stillwinter)
Question: Does a tower defense feel fresh when the world is frozen solid and the only way to move time forward is to break your own defenses?
Target feeling: Tense, crafty stewardship: a held breath, then a thrilling release. "I chose exactly how much time to let loose."
Mode: content-driven (about 6 to 8 minutes: ramp to dawn, then a result). A winter dawn ends the run; the beacon going dark ends it early (instant restart).
Theme: t018 "Time only moves when something breaks"   Why picked: it turns the clock itself into the resource and gives tower defense a new verb (shatter); the other two options were a skin on a timer and an indirect weather-god that drifts from place-and-build.
Atoms: v-place-build, l-recoverable-setback      Wildcard: none (the theme is already a hard constraint)
Genre roll (`runs/2026-10-30-stillwinter/genre-roll.mjs`, seeded by date): candidates were tower defense, contraption builder, colony sim, stacker, clockwork factory. Rolled: **tower defense**.
Look (rolled, followed in full, no override): arctic (pale blues, white, slate, one orange accent) / stars and spikes / dithered / faux isometric tabletop / minimal text.
Colors: ice white #EAF4FB, frost blue #9CC7E6, deep slate #243447, midnight #131D2A, accent orange #FF8A2B (orange ONLY ever means time, breaking, or the beacon's heart).
At rest: a dithered pale-blue iso ice table floating in a starry slate dark; spiky crystal spires stand frozen, snow-star enemies hang mid-stride on a winding path, the orange beacon pulses slowly in the middle; nothing moves except falling snow flecks and the cursor.
Loop (4 lines):
- Reward: dawn. Every second of thawed time fills the sunrise bar; at 100% the sun comes up (win). Unlocks arrive along the way (new spire types).
- Pressure: snow-stars walk the path to the beacon, but ONLY while time flows. More kinds join as dawn advances (Rams that chew spires, Gliders that are fast, Wisps that fly over the path).
- Failure and recovery: a lost beacon heart blasts every enemy back and eases the wave (reprieve); a spire eaten by enemies refunds half its ice and gives time. With 0 hearts the beacon goes dark: run ends, press A to restart at once. Not a mastery wall.
- Actions: move the cursor on the iso grid, place a spire (A), shatter a spire (X) to release a burst of time and a shockwave, cycle spire type (LB/RB), trigger Cold Snap (Y) when the meter is full.
Core verb: SHATTER. Placing is calm and free of time; shattering is a deliberate choice to let the world move. Chains of crystals break in a ripple. It is a toy before it is a game: smashing a cluster of crystals and watching time surge back in is satisfying with no enemies at all.
Pressure source: enemies on the path advance only during thawed time; the schedule of what spawns is driven by thawed time and by the dawn fraction (new enemy kinds at 20%, 40%, 60%, a big Thaw at 90%). Time costs ice (net), ice comes from kills: time is a resource you pay for. Pressure gains complexity, not just speed.
Forward pressure: kills and refunds grow your ice; dawn milestones unlock Crystal (chains), Lantern (a big burst of time), Chime (pulses area damage), Prism (piercing). Cold Snap (earned power moment): chains fill a meter; at full, Y shatters every spire in a cascade, refunds all the ice, and every enemy near a blast dies in spectacular fashion.
Recovery loop: a failed lane is a story: "I let too much time out and the Ram ate my left flank, but its shards bought me four seconds and I rebuilt."
Different from the last five nights (ledger only): the only earlier night is the original ember/circles demo; this one is a stationary, grid-based, turn-feeling build game (tower defense) in cold pastels with isometric spikes and dither, where the demo was a free-moving glowing-ball arcade game.
Scope cut line: IN: 3 maps (by seed), 5 spire types, 4 enemy kinds (+ the big Thaw), unlock sequence, Cold Snap, music loop + stingers, balance knobs. OUT: save data, more maps, enemy pathing variants, upgrades.
Feel plan: Place = squash-drop of a crystal with a chime tick; Shatter = hit-stop, shake, white flash, shard debris, descending glass noise + rising "time" whoosh, orange ripple; time flowing = orange tick sound, world un-dims, snow speeds; frozen = muffled, cool, dimmed, stars twinkle slowly; pressure = music parts enter as dawn progresses; failure = big shake, beacon crack, shockwave; win = sunrise.
Balance knobs (8): thawPerShatter (1.2, 0.4 to 3), enemySpeed (1.0, 0.5 to 1.8), spawnRate (1.0, 0.5 to 2), dawnLength (120 s, 60 to 240), startIce (10, 4 to 25), hearts (5, 2 to 9), killThaw (0.15, 0 to 0.6), snapGain (1.0, 0.4 to 2.5).
Telemetry plan: thawed seconds, shatters, chain length max, kills, spires placed, dawn %, hearts lost, longest frozen stretch. Bots: idle (nothing happens by design), random, greedy (build ring near the path, shatter when enemies arrive), degenerate-shatter-spam (place/shatter crystals to burn time without defending).
Feedback questions:
1. When you first shattered a spire on purpose, how did it feel? (satisfying / meh / confusing)
2. Did "time only moves when you break something" make you plan differently from other tower defense games? How?
3. Did you ever stall (stand frozen) because you were scared to let time loose? When?
4. Did Cold Snap feel earned, and did it feel big enough?
5. Did you find anything I did not tell you about?
