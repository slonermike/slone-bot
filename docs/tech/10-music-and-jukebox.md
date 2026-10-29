# 10 Music and the jukebox

Craft rules, research and the vibe formula: `docs/design/06-music-craft.md`.

Music is generated as data, auditioned by Slone in the jukebox, and later used by games.

## Pieces
- `src/music/compose.ts`: seeded song generator. Songs are sections (intro, verse, pre-chorus, chorus, bridge, outro) of four-bar phrases with cadences, a hook, and per-bar time signatures. Options: `form` (`loop` or `oneshot`), `character` (`hook` or `vibe`), `layout`, `meter` (one signature, a section map, or a bar cycle), key lift, tempo arc, ending. Same seed, same song.
- `src/music/meter.ts`: time signatures as eighth-note groups. `src/music/timing.ts`: tempo map with ramps (beat to seconds and back). `src/music/vibe.ts`: the mode, meter and tempo vibe formula and its inverse.
- `src/music/briefs.ts`: the curated briefs (`BATCH_2`, 20 songs: 12 loops, 8 one-shots, 13 hook songs, 7 vibe pieces, nine time signatures). Each has a name and a description of at most 280 characters. Style sketches, not copies of any tune.
- `src/music/midi.ts`: standard MIDI file (format 1, 480 PPQ, time signature and tempo changes, drums on channel 10). `src/music/synth.ts`: WebAudio player with tempo maps; one-shots stop by themselves after the last note rings out.
- `scripts/make-songs.mjs`: `node scripts/make-songs.mjs --batch b02` writes `music/songs/<id>.json` and `<id>.mid`; `--facts` prints what each brief turned into without writing.
- `src/launcher/jukebox/`: the page, at `/jukebox/`, linked only from the launcher's Start menu. The build lists only the newest batch (by id prefix); older batches stay in the repo.

## The jukebox
List on the left, details on the right: style, tags (hook song or vibe piece, loop or one-shot, time signature, mode, tempo, length), the description, a piano roll with section bands, bar lines (a short bar is a short bar) and hook markers, section chips, computed energy/mood/tension, ratings and a per-song note.
Controls: Up/Down choose; A play or stop; X picks the rating category (listenability, catchiness, vibe); Left/Right or the keys 1 to 5 set stars (0 clears); Y types a note for this song; LB/RB volume; Select exports; B or Esc back. Ratings and notes are saved per song in the browser (`mgb.jukebox.v2`). Select shows everything as text to paste into chat, best first.

## Rules
- Songs are original: generated from seeds, no transcriptions or sampled material. Inspiration is style, never a melody. Nothing here needs an `ATTRIBUTION.md` row.
- The build copies the newest batch to `jukebox/songs/` and writes `jukebox/songs.json`. `music/` is on main, not in a nightly branch.
- Audio is render-side only; the sim never touches it.

## Next
After Slone's ratings: delete what he rejected, change the briefs or seeds of what he flagged, record what the pattern says about his taste in the Bible. Later: let a prototype pick a kept song and bring parts in by `layer` as pressure grows.
