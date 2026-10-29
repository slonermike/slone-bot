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

## Pressure and back pressure
- `p-rising-tide`: a rising or cyclical hazard (Timberborn drought)
- `p-heat-chase`: escalating pursuit (GTA wanted level)
- `p-speed-ramp`: the world speeds up (Tetris)
- `p-clock`: a ticking timer (Crazy Taxi)
- `p-decay`: things degrade unless tended
- `p-scarcity`: limited resource that forces choices
- `p-crowd-demand`: many small agents with needs
- `p-telegraphed-threat`: the threat shows what it will do next (Into the Breach)

## Loops and structure
- `l-short-run`: 60 to 120 second runs with instant restart (Tony Hawk)
- `l-revisit-power`: new ability reopens old spaces (Metroid, Zelda)
- `l-build-observe`: build, then watch consequences (RCT)
- `l-household-history`: entities that remember what happened (Sims)
- `l-recoverable-setback`: failure leads to a recoverable state with a story
- `l-day-night-cycle`: phases with different rules
- `l-roguelite-run`: short run, carry one thing forward
- `l-one-more-run`: self-set goal chasing a better line

## Discovery and surprise
- `d-item-new-verb`: each item adds a way to play, not just a stat (Zelda items)
- `d-vehicle-roster`: a roster of toys with different feel (GTA vehicles)
- `d-emergent-exploit`: leave room for unplanned tricks that become features
- `d-hidden-interaction`: systems that react to each other in surprising ways (immersive-sim style)
- `d-curator-mode`: a system generates surprising situations; the designer curates the best (Braid)

## World and space
- `w-dense-small-world`: small map, dense, learnable
- `w-single-screen`: the whole level fits one screen
- `w-looping-space`: edges wrap
- `w-vertical-slice-tower`: climb or descend one structure
- `w-isolation`: sparse, lonely, atmospheric
- `w-living-crowd`: a place full of small autonomous agents

## Feel and presentation
- `f-weighty-movement`: momentum and heft (RDR)
- `f-toy-movement`: movement joyful on its own (Mario)
- `f-juice-forward`: effects as the main attraction (Fruit Ninja, Breakout juice demo)
- `f-sound-driven`: audio reactive to state; the sound tells the story
- `f-personality-eyes`: characters with expressive faces and reactions
- `f-readable-minimal`: a few clear shapes, heavy on clarity

## Wildcard constraints (draw at most one)
one button only, camera never moves, 60 seconds max, no player character (you influence from outside), one color plus black, no text, left stick only, the world scrolls forever in one direction, everything is a circle, silence except for feedback sounds, controls are inverted halfway through, you only see a small circle around you, the player has one life but infinite continues (soft death), time passes only when you move.

## How to extend
Slone adds atoms by editing this file. Nights may propose new atoms in `pending-lessons.md` under "Proposed atoms"; Slone promotes them here.
