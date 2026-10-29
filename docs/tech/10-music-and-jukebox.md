# 10 Music and the jukebox

Music is generated as data, auditioned by Slone in the jukebox, and later used by games.

## Pieces
- `src/music/compose.ts`: seeded loop generator. A song is plain data (`types.ts`): tempo, scale, bars, and parts (`pad`, `bass`, `drums`, `arp`, `lead`), each with a voice and a `layer` (0 always on, higher = could be brought in as pressure grows). Same seed gives the same song.
- `src/music/briefs.ts`: the curated briefs for a batch (`BATCH_1` = 20 loops in the spirit of 8-bit and 16-bit era game music, spread over tempo, mode and genre). They are style sketches, not copies of any existing tune. Each has a name and a tweet-length description (at most 280 characters) of what it was going for.
- `src/music/midi.ts`: writes a standard MIDI file (format 1, 480 PPQ, drums on channel 10).
- `src/music/synth.ts`: WebAudio player (square, saw, pluck, bell, flute, sub and warm-pad voices plus a noise drum kit), scheduled ahead of the clock so loops do not drift.
- `scripts/make-songs.mjs`: `node scripts/make-songs.mjs --batch b01` writes `music/songs/<id>.json` (notes) and `<id>.mid`.
- `src/launcher/jukebox/`: the page, served at `/jukebox/`. It is linked only from the launcher's Start menu ("Jukebox (music test)"), not from the main grid.

## The jukebox
List on the left, details on the right (style, description, a piano roll with a playhead, verdict, note). Controls: Up/Down choose, A play or stop, X cycle verdict (none, keep, tweak, drop), Y type a note, Left/Right volume, Select export the verdicts as text to paste into chat, B or Esc back. Verdicts and notes are saved in the browser (`mgb.jukebox.v1`). Each song also has a download link for its `.mid`.

## Rules
- Songs are original: generated from seeds, no transcriptions or sampled material. Inspiration is style (instrumentation, tempo, mode, rhythm feel), never a melody. Nothing here needs an `ATTRIBUTION.md` row.
- The build copies `music/songs/` to `jukebox/songs/` and writes `jukebox/songs.json`. Adding or deleting files in `music/songs/` is the whole publishing step. `music/` is on main, not in a nightly branch.
- Audio is render-side only; the sim never touches it.

## Next
After Slone's verdicts: drop what he rejected (delete the files), regenerate or tweak what he flagged (briefs are deterministic, change the brief or the seed), and record what the pattern says about his taste in the Bible. Later: let a prototype pick a kept song and bring parts in by `layer` as pressure grows.
