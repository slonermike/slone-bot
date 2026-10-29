# 11 Music batch runbook

How to produce a batch of songs (20, 100, whatever) for Slone's jukebox. Written so an agent can do it unattended, start to finish, from this file plus the files it points to. Read `docs/design/06-music-craft.md` (the craft rules and what the generator already does) and `docs/tech/10-music-and-jukebox.md` (the pieces) first.

## What you are making
Pieces for game music, judged by Slone in the jukebox on three 0 to 5 star scales (listenability, catchiness, vibe) plus a per-song note. He reacts to finished pieces better than he designs from nothing, so the job is a wide, varied pile of decent songs, not perfect ones. You cannot hear them; say so. The generator is deterministic, so each brief always yields the same song.

Two kinds of piece, a rule from Slone:
- **Loop** (`form: 'loop'`): plays under ongoing action, so it has no fixed length and its last bar leads back into the first. This is almost everything. Either a **hook song** (built around a catchy repeating motif) or a **vibe piece** (texture and mood first; a vibe can be any tempo, frantic included). Not every song should be an earworm.
- **Stinger** (`form: 'oneshot'`): two to four bars that punctuate an event (level cleared, died, boss down, power-up, secret found). Not a short song.

## Procedure
1. Read the craft doc, this file, the last batch's file in `src/music/`, and any ratings Slone pasted into chat or `docs/design/pending-lessons.md`.
2. Pick the next batch name: `b03`, `b04`, ... Never reuse or edit a published batch (see "Seeds" below).
3. Write `src/music/batches/<name>.ts` exporting `BATCH_<N>: Brief[]` (copy the shape of `src/music/briefs.ts`) and register it in `src/music/batches.ts`.
4. Run `npm run songs -- --batch <name> --facts`. It prints what every brief turned into (mode, tempo, meter, bars, seconds, hook count, computed energy/mood/tension).
5. **Write each description from those facts**, not from the brief you intended (see "Descriptions").
6. Run `npm run songs -- --batch <name> --check`. Fix every PROBLEM. Read every warning; fix it or decide it is intended (a themed batch can be lopsided on purpose; say so in the PR).
7. Run `npm run songs -- --batch <name>` to write `music/songs/<name>-NN-<slug>.json` and `.mid`, then `npm run check`. The jukebox shows only the newest batch, so check the new list in `/jukebox/` (build with `npm run build:site` and `npm run serve`).
8. Open a PR containing the batch file, the registry change and `music/songs/`. In the description list: counts (loops, stingers, hook, vibe), modes and meters used, any warnings you kept and why, and that none of it was heard.

## Brief anatomy
Required for every brief: `name` (unique, evocative, original), `description` (see below), `style` (a short genre and era label, for example `16-bit funk stage`), `mood`, `form`.

**Loops** also take:
| Option | Values | Notes |
|---|---|---|
| `layout` | `loop-8` (verse+chorus), `loop-12` (verse, pre-chorus, chorus), `loop-16` (verse, pre-chorus, 8-bar chorus) | 8 bars is short and repeats fast; 16 has a real arc. |
| `character` | `hook` (default) or `vibe` | Decide first; it changes what the song is for. |
| `mode` | major, minor, dorian, phrygian, lydian, mixolydian, harmonic minor | Or leave out and give a `vibe` target. |
| `meter` | `'4/4'`, `'2/4'`, `'3/4'`, `'6/8'`, `'5/4'`, `'7/8'`, `'9/8'`, `'12/8'`, or `{ cycle: [...] }` (change measure to measure) or `{ bySection: {...}, fallback }` (change by section) | Odd and changing meters are rare on purpose. |
| `bpm` | a number or `[min, max]` | Quarter-note bpm. |
| `vibe` | `{ valence, energy, tension, lilt, quirk }` each 0 to 1 | With `mode` or `bpm` left open, `pickForVibe` chooses them. See the formula in the craft doc. |
| `feel` | `drums` (rock, four, half, march, funk, soft, sparse, none), `bass` (whole, groups, eighths, octaves, walk, sync, gallop, sparse), `bassVoice`, `leadVoice`, `arpVoice` (square, saw, pluck, bell, flute, sub), `arp` (0 to 1), `arpStep` (1 or 0.5), `sync`, `density`, `harmony`, `drop`, `riff`, `pad` | The instrumentation and rhythmic feel. |

**Stingers** take: `event` (`win`, `lose`, `boss`, `powerup`, `secret`), `mode`, `meter`, `bpm`, `bars` (2 to 4), `character`, `leadVoice`.

## Variety targets
The checker enforces hard rules (unique names and descriptions, lengths, hook bars present, loops keep one tempo, stingers under 14 s) and warns about variety. For a batch of 100, aim for roughly:
- 80 to 85% loops, 15 to 20% stingers, spread over all five events.
- Among loops: 55 to 65% hook songs, 35 to 45% vibe pieces, across the whole tempo range 56 to 180 bpm (all four buckets: under 80, 80 to 109, 110 to 139, 140+).
- All seven modes, none over 25%.
- Meter: about 55% 4/4; the rest spread over 3/4, 6/8, 2/4, 5/4, 7/8, 9/8, 12/8; 3 to 6 songs that change meter by section or by bar.
- Style families from the 8-bit and 16-bit eras plus some 80s rock and 2000s pop hook craft: action stage, overworld, castle, boss, shop, village, title, dungeon, underwater, sky, space, racing, puzzle, funk, ballad, chase, and so on. No more than 20% in one family.
- Do not write near-duplicates (same mode, meter, style and tempo); the checker warns.

## Descriptions (tweet length: 60 to 280 characters)
What I was going for, in plain words, written from `--facts`: mode with its character, tempo, meter (and what the grouping does), form, how many bars, what carries the hook or the texture, what the song is for. If it has a risk, say it ("may be too busy to hum"). Do not claim what the song does not do: if `--facts` says 12 bars with 2 hooks, do not write "an eight-bar chorus". Hook songs name the hook; vibe pieces say they are not built to be hummed.

## Originality
Songs are style sketches. Inspiration is instrumentation, tempo, mode and rhythmic feel from era game music, never a melody, and every melody is generated from a seed. Do not transcribe, quote or imitate a specific tune. Names are original (no existing game, band or song titles). Nothing here needs an `ATTRIBUTION.md` row. If you ever add sampled audio or soundfonts, that is a different job with license rules in `docs/tech/08`.

## Seeds, and keeping what Slone likes
A song's seed is the hash of the batch name and its position in the batch (`hashSeed("b03:7")`), so **never reorder or delete briefs in a published batch**; that would change every song after it. To retire a song, leave it, and let it fall out of the next batch.

To carry a keeper into a new batch unchanged, copy its brief into the new batch with `seed: <the seed from its song JSON>`. The song will be identical except for its id prefix. To make a sibling of a song he loved (same feel, new tune), copy the brief and leave the seed out.

Reading Slone's ratings (the Select export): high listenability with low catchiness is a fine vibe piece; low on all three is a drop; a good song with a note is a brief to edit (change `feel`, `bpm` or `mode`) in the next batch. Record patterns in `docs/design/pending-lessons.md` as one data point each. Do not edit the Bible in a batch run; that is a chat-only step.

## Do not
- Edit the generator, jukebox, Bible or craft doc in a batch PR. If a batch needs a new capability (a new drum style, a new stinger event), make that a separate PR first.
- Reuse a published batch name, or change `music/songs/` files by hand.
- Claim it sounds good. Report that it was structurally checked and not heard.

## Size and cost
A song is about 20 to 60 KB of JSON plus a few KB of MIDI (20 songs are about 800 KB), so 100 songs is about 4 MB on the site; the jukebox fetches a song only when it plays. The list scrolls. A batch run is only text and takes minutes; there is no render step.

## Prompt to start a batch run
> Read `docs/tech/11-music-batch-runbook.md` and everything it points to, then produce batch `b03`: 100 songs following the variety targets, and open a PR. Use Slone's ratings in `docs/design/pending-lessons.md` or the notes I paste below to steer. Report what you could not verify.
