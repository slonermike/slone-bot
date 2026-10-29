# 05 Source Notes (read-only)

Distilled lessons from the source videos, in our own words. These are the raw material behind the Bible. More sources will be added by Slone over time; he promotes the useful parts into the Bible.

## S1 GMTK Game Dev 101 ep. 2: What is the point of prototyping?
- A prototype answers a question quickly. The big three: Is it fun? Is it viable? Will others like it?
- Brains are poor game simulators. Make before you talk.
- Prototypes can test art style, camera, narrative (Pixar animatics), tech, not just fun.
- Build effort predicts production effort. Easy content creation in a puzzle prototype means fertile ground.
- A flop is a win: a failed prototype saves years.
- Tips: (1) do not make it flashy: grey boxes, borrowed assets, no UI or music, throwaway code, except where juice is part of the fun; do not use juice to rescue a flat core; (2) use other mediums: paper, Lego, spreadsheets, Discord sketches, animations; (3) keep prototypes small, specific, and separate; small means many; (4) you do not need to prototype everything: prototypes give confidence in the soil, not the whole crop; know when to stop; prototype later features too.

## S2 GMTK Game Dev 101 ep. 1: Where do game ideas come from?
- Four sources: existing games (change perspective, theme, medium, or revive), genre (fix a problem, combine genres, subtract a core mechanic, swap the metaphor; reduce genre to its DNA), new mechanics from real-world activities or controls or one isolated mechanic (bottom-up), and experience first (fantasy, theme, personal; top-down).
- A story or a single mechanic is not a game idea. Define: win state, obstacle, fail state, player actions.
- Ten tips: atomize games, critique what you play, challenge conventions, play everything, impose limits, game jams, noodle in the editor, absorb music and art, do something else, keep the idea small.
- Is the idea worth pursuing? Can you make it (a 1 to 2 day prototype implies a 1 to 2 year game), will it stand out (hook plus anchor; appeal types), and is it fun (prototype).
- Appeal types: fantasy, exploration, toy, challenge, comedy, nostalgia. Test by imagining the trailer or the store capsule.

## S3 Mark Brown "Developing": starting a game by prototyping
- Failure pattern: art and story before the core; design is the foundation, not one of five equal parts. The "it is fun in my head" and "I can only find out by building it all" assumptions are both wrong.
- Prototype discipline: borrow code, art, engine components; build only what the core needs.
- Prototypes generate ideas: swapping a magnetic character for a character carrying a magnet opened a better design. Physics gave free game feel.
- Watch for drifting into particles and shaders; scrap that work.
- Go signal: original, supports multiple play styles, ideas flow, and it is fun to pick up and play in the bare scene.

## S4 Mark Brown "Developing": genre drift and analysis paralysis
- A prototype can change the genre, not just the mechanic. The mechanic had a pull toward puzzle despite the designer's wish for platformer; "kill your darlings".
- Too many abilities breaks puzzle design; gate and introduce gradually (Portal, Half-Life 2 gravity gun lesson). A prototype's setup (camera, speed, grid) should match the intended genre.
- Unforeseen interactions force micro-decisions; decide and log.
- Real problem: trying many directions without committing is analysis paralysis, not scope creep.
- Oliver Granlund's cure: adopt a game jam mindset, set an arbitrary time box, define the minimum viable product, build about five levels, ship the small version first.
- Anxiety about showing the work can be data: the work no longer matched the vision.

## S5 GMTK "The Games That Designed Themselves": Follow the Fun
- Ignore preconceived plans; look to the game to see where it should go (Ape Out, Into the Breach, Gunpoint, NecroDancer, Rocket League, Devil May Cry, SpyParty, Braid, Subnautica).
- Biggest changes happen early (white-hot malleable magma). Cost: unpredictable scope (Heat Signature took years).
- Marc LeBlanc's full phrase starts with "fail fast". Speed of iteration is a prerequisite.
- Techniques: game jams, rapid-prototyping tools, paper, custom content tools, placeholder art and music, and one fixed anchor that cannot change (Journey's theme of love) to bound exploration.
- Do not wait for the perfect idea. Build something, then listen.

## S6 GMTK MDA: understanding game mechanics
- Mechanics (rules), dynamics (player behavior and system consequences), aesthetics (feelings). Edit the mechanics; the rest cascades. Name feelings in specific words.
- Borrow mechanics only after understanding why they work. Alien: Isolation's easy checkpoints made players careless and enabled a suicide-run exploit; slow manual saves made saving tense.
- A one-line vision (Subnautica "thrill of the unknown", RE Village "struggle to survive", DOOM 2016 "push forward combat") filters mechanics and settles disputes. Flower cut levels, spells, and timers.
- Non-mechanic layers (music, visuals, animation, camera) create aesthetics too; make everything sing the same notes.
- Caveats: mechanics interact and can undermine each other; players misuse or misread them; desired emotions change over time; aesthetics are subjective and skill-dependent.

## S7 "Juice It or Lose It" (Jonasson and Purho): the juice catalog
- Juice is maximum output for minimum input; adds feel 100 percent of the time in the presenters' view.
- Catalog: color, tweening and easing (slowdown, overshoot, bounce, random delay), squash and stretch (paddle response, impact scale, rotation, velocity stretch, wobble, flash), sound (the most cost-effective and most neglected; a short demo shows sound turns overlap into a bounce), particles (use an existing system; do not build an engine), screen shake (powerful, use with restraint), trails, and personality (eyes, blinking, smile, frown).
- Stacking many small effects makes the feel. Everything on can hurt frame rate.
- Our tension to manage: S1 warns juice cannot rescue a flat core; S7 shows juice transforms a working core. Rule: core first, then the feel pass, and say in the post mortem whether the core was interesting with juice off.

## Cross-source patterns
1. Answer one question per prototype, cheaply and quickly.
2. Foundation first (the core loop), polish second.
3. Listen to the game; subtract; keep a fixed anchor.
4. Name the feeling; check every mechanic against it.
5. Time-box and define an MVP to prevent drift.
6. Log surprises and treat bugs as data.
7. Sound and juice are cheap, high-leverage feel multipliers.
8. Borrowed parts are fine except the core and anything that imports unwanted feelings. In this repo "borrowed" means openly licensed and attributed; the videos' advice to use sprites ripped from other games does not apply (the repo is open source and may become a commercial game).
