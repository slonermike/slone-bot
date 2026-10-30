# 06 Music craft: hooks, structure, and the vibe formula

How the song generator (`src/music/`) decides what to write, and why. Written from a small amount of research plus working knowledge; the sources are mostly blog-quality, so treat every rule as a hypothesis for Slone's jukebox ratings to confirm or overturn. Rating data (listenability, catchiness, vibe, 0 to 5 each) is the real test.

## Not every song should be an earworm
Songs have a `character`:
- **hook:** built around a catchy, repeating motif.
- **vibe:** texture and mood come first. It still has a motif, but a sparse one that does not repeat like a hook. A vibe can be any tempo: frantic is a vibe (see Hyperdrive and Panic Arcade), as are floating, uneasy and cozy.

The jukebox shows which one a song is, so catchiness gets judged against what the song was trying to do. A vibe piece scoring low on catchiness is not a failure.

## Music is a design tool, not wallpaper
Music does four jobs in a game: it **sets the mood** (the target feeling), it **paces the session** (tension, release, rest), it **reports state** (how much pressure there is, whether something good just happened) and it **gives the game an identity** the player remembers. A loop that only fills the air does none of these. This section is for choosing music on purpose.

### What the research says, and how far to trust it
- **Layering, resequencing and stingers are the standard toolkit** ([Audiokinetic, "How to use interactive music to score gameplay"](https://www.audiokinetic.com/en/blog/how-to-use-interactive-music-to-score-gameplay/)). *Vertical layering* stacks synchronized stems and fades them in and out to build or release tension; *horizontal resequencing* switches between contrasting sections at bar lines for big changes of state; short stingers give reward and feedback. Our tools map directly: `music.setParts` is vertical layering, swapping the loop with `music.play` is resequencing, `music.stinger` is the stinger.
- **Tempo moves arousal, but the evidence is soft.** One small Tetris study found fast-tempo music raised perceived arousal over a 13-minute session without changing happiness ([Brunel](https://bura.brunel.ac.uk/handle/2438/3111)); a first-person-shooter study measured no difference ([figshare](https://figshare.com/articles/Effect_of_music_tempo_in_First-Person_Shooter_on_arousal_and_aggression/5113537)); a CHI PLAY 2019 paper found that the affect and tempo of music changed immersion and the experienced mastery and challenge ([Rogers et al.](https://www.uni-ulm.de/fileadmin/website_uni_ulm/iui.inst.100/institut/Papers/Prof_Rukzio/2019/p213-rogers.pdf)). Read that as: tempo is a lever on how urgent and how hard a game feels, so choose it deliberately, and let Slone's ratings settle the rest. Samples are small and results conflict.
- **Silence is a lever too.** In a non-game study silence was less arousing than most music conditions. From working knowledge (not measured): when music stops, its return lands, and constant music flattens everything.
- **Classic uses of music as a gauge** (working knowledge): Space Invaders' four-note march speeds up as the aliens thin out; Super Mario Bros. quickens its music when the clock runs low; Tetris speeds its music when the stack gets dangerously high. In each, the music *is* the pressure meter, and the player feels it before reading it.

### The mid-tempo trap
Left to themselves, the first four nightly games chose almost the same music: 92 to 120 bpm, 4/4, D or F dorian or mixolydian, a rock or funk groove, a syncopated sub bass, a bell arpeggio, labelled "playful", all copied from the example in the docs. It sounds fine and says nothing: no rest, no rise, no relief, no personality. That is what this section exists to prevent. The fix is not randomness; the music has to be considered and fit the game. The default zone (4/4 at 100 to 125 bpm) is allowed only when the game truly wants it, and the music plan says why.

### Write a music plan before composing
Answer these in the brief's Music plan (a few lines):
1. **The arc.** What should the player feel at the start, at the peak, and at the end? The music should travel there.
2. **The gauge.** What does the music tell the player about state (pressure, safety, progress)? How is that shown: layers, a tempo step, a switch of loop, a dropout?
3. **The quiet.** Where does the music thin out or stop? (If the answer is "nowhere", the answer is wrong.)
4. **The punctuation.** What are the three to five moments that deserve a stinger, and what does each one say?
5. **The contrast.** What is the second sound the game goes to (a calm and a tense loop, an early and a late phase)? A game's music is a *set* of a few loops and several stingers, not one song.
6. **The options.** Weigh at least three choices from different parts of the spectrum (tempo band, meter, mode, texture; `node scripts/night-state.mjs sound` prints the menu with the generator settings), say what each would do to this game, then choose. Say how the choice differs from the last games' music (the ledger's `music:` tags), and why that difference serves this game and is not variety for its own sake.

### Tension and release: what to reach for, and how
| Technique | What it does | How here |
|---|---|---|
| Add a layer | pressure grows; the bed fills in | `music.setParts` brings in drums, arp, lead on pressure layers |
| Strip to the bass | danger; exposure; the floor drops out | `setParts` with only `bass` and `drums` |
| Dropout before the payoff | a held breath; the payoff hits harder | `feel.drop: true`, or `setParts([])` for a beat, then everything back with a stinger |
| Tempo step | urgency, a countdown | swap to a faster loop in the same key (`play(fast)`); a stinger can slow into a loss |
| Mode and brightness shift | relief, dread, a lift | a second loop on the same root in a brighter or darker mode |
| Meter instability | unease; resolving back to 4/4 feels like relief | a 5/4 or 7/8 tense loop against a steady calm loop |
| Rhythmic density | energy without changing tempo | `arpStep` 0.5 versus 1, drum style, `density` |
| Register and voice | weight versus sparkle | `bassVoice`, `leadVoice`, `arpVoice` (sub, saw, square, bell, flute, warm, pluck) |
| Silence | contrast; the return is an event | `music.release(seconds)`, then bring the music back for the moment that matters |
| A stinger that resolves | closure, reward | `composeStinger` (`win`, `lose`, `boss`, `powerup`, `secret`) with `duck` |

### Matching the music to the feeling
These are starting points, not rules (the vibe formula below computes valence, energy, tension, lilt and quirk):
| To feel | Reach for |
|---|---|
| calm, restorative, wonder | slow, no drums or soft drums, lydian or major, pad and bell, a sparse hook |
| tense, sneaky | slow to mid, sparse bass, phrygian or harmonic minor, little melody, silence |
| frantic, chased | 160+ bpm, gallop or driving bass, minor, fast arpeggio; a vibe, not noise |
| heavy, ominous | half-time drums, sub bass, low riff, harmonic minor, slow |
| funny, kooky | march or 2/4, square lead, bright mode, a wobbling meter, big dynamic jumps |
| cozy, domestic | 3/4 or 6/8, pluck, flute, warm bass, soft drums |
| cool, wry | walking bass, dorian, brushed drums, a lonely lead |
| hypnotic, flow | steady pulse, shimmering arpeggio, no drums, 5/4 or 7/8 if you want it to drift |
| triumphant | a rising hook, a key lift, a held final chord (stingers do this best) |

### Check your work (you cannot hear it)
`reviewGameMusic(songs)` (`src/music/review.ts`) prints each song's tempo, meter, mode, vibe, per-bar energy curve and layers, and flags the traps: the default zone, a loop that never changes energy, music that cannot follow pressure (no layers), loops that share one tempo and meter so switching changes nothing, too few stingers. Call it in your game's music unit test and read the output. It measures; it cannot say the music is good. For that, add the brief to a jukebox batch for Slone to rate (`docs/tech/11-music-batch-runbook.md`).

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

## Loops and one-shots
Slone's rule: **loops cover nearly everything, because ongoing player action cannot be mapped to a length of time.** A loop has no fixed duration and no ending; its last bar is a dominant turnaround with a fill so it leads straight back into the first. So the long songs (anything that plays under action) are loops, however many sections they have.

**A one-shot is a stinger, not a short song:** a couple of measures that punctuate something that just happened (you beat the level, you died, the boss went down, you grabbed a power-up, you found a secret). It states a tiny hook if the moment wants one, then lands. Winifred Phillips's point about [game one-shot cues](https://r-sen-productions.itch.io/modern-video-game-musicvolume-ii) fits: it needs its own beginning, middle and end, and its ending should resolve or dissolve rather than leave a hole. Generated events (`composeStinger`, 2 to 4 bars, about 2 to 12 seconds):
- **win:** a short hook, the same hook a step higher, a climbing run, then a held final chord with a crash while the tempo slows.
- **lose:** a falling line over a sinking chord, slowing to about half speed and ending on a very low tonic. No hook.
- **boss:** a heavy low motif said twice, a leap onto the dominant, a crash on a deep tonic, tempo dragging.
- **powerup:** a rising arpeggio that speeds up, then a ringing top note with sparkle.
- **secret:** bells climbing over a swelling pad, a shimmering chord, slowing as it settles.

Tempo moves with the moment: rising pickups accelerate; losses and big resolves slow to a stop. A loop never changes tempo.

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
