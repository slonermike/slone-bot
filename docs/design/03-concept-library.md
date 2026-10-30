# 03 Concept Library (read-only; seed)

Low-level atoms for mixing. Each night draws two atoms at random (`scripts/night-state.mjs atoms`, which avoids pairings in the ledger) and builds around them, along with one theme and at most one wildcard. Combine atoms from different categories for the most surprising results.

Format: `id: description (source inspiration)`. Tags go in `prototype.json` and the ledger.

## Verbs (what the player does)
- `v-drive`: steering a momentum-heavy vehicle (GTA)
- `v-grind-chain`: link movement verbs into a combo chain (Tony Hawk)
- `v-grab-throw`: pick up and hurl things (Ape Out)
- `v-place-build`: place pieces on a grid or map (RCT, Timberborn)
- `v-redirect`: change where something is going rather than where you are (water, traffic, crowds)
- `v-carry`: carrying a heavy object changes your movement (carrying-a-magnet idea)
- `v-swap`: exchange places or states with an object
- `v-push-pull`: shove or tug things with consequences
- `v-time-nudge`: rewind, slow, or pause locally
- `v-stack`: stack or arrange pieces by fit (Tetris)
- `v-lure`: attract things to a spot
- `v-hide-reveal`: conceal yourself, reveal the world
- `v-tend`: care for entities over time (Sims)
- `v-plant-revive`: place seeds or pieces that bring a dead place back to life (Cloud Gardens)
- `v-paint-world`: your marks add color and form to an empty world (Chicory)
- `v-rotate-view`: turn the viewpoint; what lines up from another angle changes the world (Fez)
- `v-bounce`: one bounce is the whole movement set; position it, chain it (DuckTales)
- `v-roll-grow`: pick things up by touching them and grow; size decides what you can take (Katamari)
- `v-boost-gamble`: a powerful boost that is hard to control and dangerous to use (Hot Wheels Unleashed)
- `v-flip-rule`: one input flips gravity, orientation or a rule, nothing else (VVVVVV)

## Pressure and back pressure
- `p-rising-tide`: a rising or cyclical hazard (Timberborn drought)
- `p-heat-chase`: escalating pursuit (GTA wanted level)
- `p-speed-ramp`: the world speeds up (Tetris)
- `p-clock`: a ticking timer (Crazy Taxi)
- `p-decay`: things degrade unless tended
- `p-scarcity`: limited resource that forces choices
- `p-crowd-demand`: many small agents with needs
- `p-telegraphed-threat`: the threat shows what it will do next (Into the Breach)
- `p-either-or-spend`: one resource, two good uses; each spend gives up the other (The Last of Us)
- `p-edge-of-catastrophe`: tuned so one mistake is disaster and one good move is triumph (Hot Wheels Unleashed)

## Loops and structure
- `l-short-run`: 60 to 120 second runs with instant restart (Tony Hawk)
- `l-revisit-power`: new ability reopens old spaces (Metroid, Zelda)
- `l-build-observe`: build, then watch consequences (RCT)
- `l-household-history`: entities that remember what happened (Sims)
- `l-recoverable-setback`: failure leads to a recoverable state with a story
- `l-day-night-cycle`: phases with different rules
- `l-roguelite-run`: short run, carry one thing forward
- `l-one-more-run`: self-set goal chasing a better line
- `l-learn-then-layer`: introduce each hazard alone, then combine them in increasingly layered ways (VVVVVV)
- `l-bite-sized-bursts`: tiny single-idea challenges back to back; each ends before it gets stale (WarioWare, Lego Party)
- `l-restoration`: empty or dead space becomes alive and beautiful as you act; the change is the reward (Cloud Gardens, Chicory)
- `l-scale-up`: growth changes what the world offers; new targets at every scale (Katamari)

## Discovery and surprise
- `d-item-new-verb`: each item adds a way to play, not just a stat (Zelda items)
- `d-vehicle-roster`: a roster of toys with different feel (GTA vehicles)
- `d-emergent-exploit`: leave room for unplanned tricks that become features
- `d-hidden-interaction`: systems that react to each other in surprising ways (immersive-sim style)
- `d-curator-mode`: a system generates surprising situations; the designer curates the best (Braid)
- `d-cryptic-fair`: cryptic puzzles whose clues are always findable by looking carefully, never by guessing (Fez)
- `d-sandbox-surprise`: simple placement rules produce layouts the player did not plan (Townscaper)
- `d-perspective-secret`: things only visible or reachable from another angle (Fez)

## World and space
- `w-dense-small-world`: small map, dense, learnable
- `w-single-screen`: the whole level fits one screen
- `w-looping-space`: edges wrap
- `w-vertical-slice-tower`: climb or descend one structure
- `w-isolation`: sparse, lonely, atmospheric
- `w-living-crowd`: a place full of small autonomous agents
- `w-rotatable-world`: a small world with many sides; you turn it to see the rest (Fez)
- `w-regrowth`: nature reclaiming a ruin; hopeful, lush, healing (solarpunk; Cloud Gardens)

## Feel and presentation
- `f-weighty-movement`: momentum and heft (RDR)
- `f-toy-movement`: movement joyful on its own (Mario)
- `f-juice-forward`: effects as the main attraction (Fruit Ninja, Breakout juice demo)
- `f-sound-driven`: audio reactive to state; the sound tells the story
- `f-personality-eyes`: characters with expressive faces and reactions
- `f-readable-minimal`: a few clear shapes, heavy on clarity
- `f-kooky-silly`: unabashedly silly tone and absurd scale (Katamari, Lego Party)
- `f-color-bloom`: gray or empty places fill with saturated color as you act (Chicory)
- `f-chaotic-power`: the strongest move feels unwieldy, loud and a little out of control (Hot Wheels Unleashed)

## Wildcard constraints (draw at most one)
one button only, camera never moves, no fail state (only discovery), each stage teaches exactly one new thing, 60 seconds max, no player character (you influence from outside), one color plus black, no text, left stick only, the world scrolls forever in one direction, everything is a circle, silence except for feedback sounds, controls are inverted halfway through, you only see a small circle around you, the player has one life but infinite continues (soft death), time passes only when you move.

## How to extend
Slone adds atoms by editing this file. Nights may propose new atoms in `pending-lessons.md` under "Proposed atoms"; Slone promotes them here.
