# 10 Music and the jukebox

Craft rules, research and the vibe formula: `docs/design/06-music-craft.md`.

Music is generated as data, auditioned by Slone in the jukebox, and later used by games.

## Pieces
- `src/music/compose.ts`: seeded generator, two paths. **Loops** (`form: 'loop'`) are sections (verse, pre-chorus, chorus and so on) of four-bar phrases with cadences, a hook, and per-bar time signatures; options `character` (`hook` or `vibe`), `layout`, `meter` (one signature, a section map, or a bar cycle). **Stingers** (`form: 'oneshot'`) are 2 to 4 bars for an event (`event`: win, lose, boss, powerup, secret) with their own tempo moves and a big landing. Same seed, same song.
- `src/music/meter.ts`: time signatures as eighth-note groups. `src/music/timing.ts`: tempo map with ramps (beat to seconds and back). `src/music/vibe.ts`: the mode, meter and tempo vibe formula and its inverse.
- `src/music/batches.ts`: the batch registry and `composeBatch`. `src/music/coverage.ts`: the quality gate and variety report. Producing a new batch: `docs/tech/11-music-batch-runbook.md`.
- `src/music/review.ts`: `reviewSong` and `reviewGameMusic` report tempo, meter, mode, vibe, per-bar energy and layers, and flag the default zone, flat loops, no layers, and loops that do not contrast. `scripts/sounds.mjs`: the menu of musical options and generator settings behind `night-state.mjs sound` (a reference, not a roll).
- `src/music/briefs.ts`: the first batch's briefs (`BATCH_2`, 20 pieces: 15 loops and 5 stingers; loops are hook songs or vibe pieces; eight time signatures). Each has a name and a description of at most 280 characters. Style sketches, not copies of any tune.
- `src/music/midi.ts`: standard MIDI file (format 1, 480 PPQ, time signature and tempo changes, drums on channel 10). `src/music/synth.ts`: WebAudio player with tempo maps; a stinger stops by itself after its last note rings out.
- `scripts/make-songs.mjs` (`npm run songs -- --batch b02`): writes `music/songs/<id>.json` and `<id>.mid`; `--facts` prints what each brief turned into; `--check` runs the quality gate and variety report.
- `src/launcher/jukebox/`: the page, at `/jukebox/`, linked only from the launcher's Start menu. The build lists only the newest batch (by id prefix); older batches stay in the repo.

## The jukebox
List on the left, details on the right: style, tags (hook song or vibe piece, loop or stinger, time signature, mode, tempo, length), the description, a piano roll with section bands, bar lines (a short bar is a short bar) and hook markers, section chips, computed energy/mood/tension, ratings and a per-song note.
Controls: Up/Down choose; A play or stop; X picks the rating category (listenability, catchiness, vibe); Left/Right or the keys 1 to 5 set stars (0 clears); Y types a note for this song; LB/RB volume; Select exports; B or Esc back. Ratings and notes are saved per song in the browser (`mgb.jukebox.v2`). Select shows everything as text to paste into chat, best first.

## Rules
- Songs are original: generated from seeds, no transcriptions or sampled material. Inspiration is style, never a melody. Nothing here needs an `ATTRIBUTION.md` row.
- The build copies the newest batch to `jukebox/songs/` and writes `jukebox/songs.json`. `music/` is on main, not in a nightly branch.
- Audio is render-side only; the sim never touches it.

## Next
After Slone's ratings: delete what he rejected, change the briefs or seeds of what he flagged, record what the pattern says about his taste in the Bible. Later: let a prototype pick a kept song and bring parts in by `layer` as pressure grows.

## Music in a game
Nightly agents compose music for their own game (see "Music" in `SCAFFOLD_API.md`). The craft rules in `docs/design/06-music-craft.md` apply, with these game-specific rules:
- Music follows the game: tempo near the game's pulse, mode and meter to match the feeling (use the vibe formula), parts layered with the pressure layers, the hook reserved for an earned moment.
- One tonic for the loops and all stingers in a game; the mode may differ between loops on purpose (calm versus tense). Choose the music for the game (`node scripts/night-state.mjs sound` prints the menu of options), write the Music plan in the brief, and run `reviewGameMusic` (`src/music/review.ts`) in the game's music test. A game is a set: at least two contrasting loops or a loop with a real layer plan, and three to five stingers.
- The song data is generated, never hand-written, and nothing needs an `ATTRIBUTION.md` row.
- A game's music is not part of a jukebox batch; to audition it, add its brief to a batch.
- `src/music/synth.ts` (`SongPlayer`) can route to an output node and mute or unmute parts with a fade; the game engine routes it through the player's music volume bus.
