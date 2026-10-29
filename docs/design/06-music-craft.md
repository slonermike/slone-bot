# 06 Music craft: hooks, structure, and the vibe formula

How the song generator (`src/music/`) decides what to write, and why. Written from a small amount of research plus working knowledge; the sources are mostly blog-quality, so treat every rule as a hypothesis for Slone's jukebox ratings to confirm or overturn. Rating data (listenability, catchiness, vibe, 0 to 5 each) is the real test.

## Not every song should be an earworm
Songs have a `character`:
- **hook:** built around a catchy, repeating motif.
- **vibe:** texture and mood come first. It still has a motif, but a sparse one that does not repeat like a hook. A vibe can be any tempo: frantic is a vibe (see Hyperdrive and Panic Arcade), as are floating, uneasy and cozy.

The jukebox shows which one a song is, so catchiness gets judged against what the song was trying to do. A vibe piece scoring low on catchiness is not a failure.

## What makes a song catchy (research)
Main source: Jakubowski et al. 2016, ["Dissecting an earworm"](https://www.apa.org/news/press/releases/2016/11/earworms) (about 100 earworms compared with 100 equally popular non-earworms; self-reported, pitch and rhythm only, so it says nothing about harmony or timbre). Findings:
- Earworms were **faster** and had rhythms people could move to.
- They tend to follow a **common overall contour** (a phrase that rises, then one that falls), the "Twinkle, Twinkle" shape.
- But they also have **unusual intervals**: more leaps, bigger leaps and more **repeated notes** than average pop. Familiar shape plus a few surprises is "optimal complexity".
- Familiarity matters: repetition and recent exposure make a tune stick, which is why a hook repeats.

## What makes a good hook (research)
General songwriting guides ([Point Blank](https://www.pointblankmusicschool.com/blog/creating-melodic-hooks-that-stick/), [Wisseloord](https://wisseloord.org/uncategorized/how-to-write-stronger-hooks-and-choruses), [Musician Wave](https://www.musicianwave.com/what-is-a-hook-in-music/)) agree on: simple, repetitive, emotionally clear, and a hook can live anywhere (riff, chorus, a vocal "ah-ha-ha"), not only in the chorus. Small tweaks (one note, one rhythmic shift) turn a good hook into a great one.

Max Martin's "melodic math" ([overview](https://www.musicianwave.com/max-martin-melodic-math-formula/), [technique list](https://melodic-math.com/blog/max-martin-25-techniques)), as secondhand blog summaries:
- Write the melody first; reuse a few motifs (verse, pre-chorus, chorus) instead of inventing new material.
- Melodies stay within a few scale degrees, rarely beyond an octave.
- Lines come in **mirrored pairs** of similar length (a statement and an answer).
- Contrast between sections: loose and low in the verse, grounded and higher in the chorus.

I could not find solid technical sources on 80s rock hooks; this is from general knowledge: they are often **riff-driven** (a repeated pentatonic power-chord figure carries the verse), then a **big, simple, singable chorus** doubled in harmony.

## How the generator uses it
**Hook (a one- or two-bar motif):**
- Rhythm: onsets weighted toward beat-group starts plus syncopated anticipations (a note just before the beat). Note counts scale with bar length.
- Contour: one of leap-then-step-down, arch (rise then fall), hammer (repeated notes then a leap) or stairs. All keep the range tight (a few scale degrees).
- Statement and answer: bars go statement, statement with a small change, statement, **resolution** (the last note lands on the tonic if the chord allows it). Exact repetition with a changed ending is the rule the tests check.
- Optional one-eighth pickup into the downbeat. Chorus melody is doubled a third below in some songs (the 80s gang-chorus idea).
- Foreshadowing: the hook is teased quietly in the intro before the chorus lands.
- Verse melody is lower, sparser and shares the hook's rhythm family; the chorus sits higher and denser.

**Structure (sections of four-bar phrases):**
- Intro, verse, pre-chorus, chorus, bridge, outro; loops use short layouts (verse+chorus, or verse, pre-chorus, chorus).
- Every phrase ends on a **cadence**: a dominant chord (third raised in minor modes) that pulls into the next downbeat; choruses resolve to the tonic. A drum fill runs through the last beat group, and a crash marks the arrival.
- The pre-chorus climbs (one more note per bar, rising pitch, building snare) and in some songs **drops out** for the last beat before the chorus lands (a 2000s pop move).
- Loops end on a dominant turnaround with a fill so the last bar leads back to the first. Seams matter most in game loops ([a commercial blog's claim](https://sorceress.games/blog/layer-how-to-make-good-video-game-music-ai-loops-2026), plausible).

**One-shots** ([Winifred Phillips on one-shot cues](https://r-sen-productions.itch.io/modern-video-game-musicvolume-ii): a one-shot needs its own beginning, middle and end, and its ending should dissolve or resolve rather than leave a hole): the last chorus goes up a tone (a key change) and a few percent faster (a gear shift); some songs accelerate throughout; the end is either a **ritardando into a held final chord** or a **fade**.

## Time signature: groups, not just counts
Every meter is stored as groups of eighth notes (7/8 as 2+2+3, 6/8 as 3+3, 5/4 as 3+2+3+2). Drums, bass and melody all hang off the groups, so odd meters get a real backbeat and pulse. Songs can use one meter, change meter by section (verse in 5/4, rest in 4/4), or change measure to measure (4/4, 4/4, 4/4, 3/4 repeating). Rare on purpose.

## The vibe formula (heuristic, in `src/music/vibe.ts`)
Inputs: mode, time signature(s), tempo, optional density. Outputs (each 0 to 1): valence (gloomy to joyful), energy, tension, lilt (swaying or rolling), quirk (off-balance).

| Ingredient | Effect | Basis |
|---|---|---|
| Mode brightness: lydian +3, major +2, mixolydian +1, dorian 0, minor -1, harmonic minor -1.5, phrygian -2 | valence = 0.5 + 0.1 x brightness ... | The usual circle-of-fifths ordering; [mode descriptions](https://www.shockwave-sound.com/blog/notes-and-emotions-the-major-modes/) agree: lydian floating and bright, mixolydian bluesy major, dorian a hopeful minor, phrygian dark (flat 2nd). They are tendencies, and the key matters too. |
| Mode tension: major 0.05 up to phrygian 0.75 | tension | Flat 2nd and raised 7th over a minor 3rd are the sharpest. |
| Tempo (50 to 180 bpm) | energy up, valence nudged up | Earworm study: faster tunes. Plain common sense. |
| 4/4, 2/4 | stable, driving, square | Strong beats and an easy pulse. |
| 3/4, 6/8, 12/8 | high lilt: swaying, rolling | Common description; **I did not find a source for the emotional effect of 6/8 and 3/4, so this part is the least verified.** |
| 5/4, 5/8, 7/8 | high quirk, low stability; 7/8 is rushed | Practitioner writing: listeners keep hunting for the pulse; 7/8 can feel like a 4/4 bar cut short; 5/4 like a broken 3/4 ([Modern Drummer clinic](https://www.moderndrummer.com/2014/03/video-rock-jazz-clinic-give-audience-april-2014-issue/)). Opinion, not measured. |
| Changing meter | extra quirk | Same reasoning. |

`vibeOf()` computes the vector from parameters. `pickForVibe()` is the inverse: give it a target (for example valence 0.8, energy 0.55) and it searches every mode, meter and tempo for the closest match and picks randomly among the best few. Briefs can leave mode and tempo open and let it choose; the jukebox shows the computed energy, mood and tension for every song so the formula can be checked against how a song actually feels.

**The formula is a guess to be tuned.** When Slone's ratings show a song feels different from its computed vibe, adjust the tables.
