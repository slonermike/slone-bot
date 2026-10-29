/** A song as plain data: what the generator writes, the MIDI writer reads, and the browser synth plays.
 *  All positions are in quarter-note beats from the start of the song (so a bar of 7/8 is 3.5 beats long). */
export type Inst = 'bass' | 'pad' | 'lead' | 'harmony' | 'riff' | 'arp' | 'drums';
export type Voice = 'square' | 'saw' | 'pluck' | 'bell' | 'flute' | 'sub' | 'warm';
export type SectionKind = 'intro' | 'verse' | 'pre' | 'chorus' | 'bridge' | 'outro' | 'groove' | 'stinger';
/** loop: plays under ongoing action, so it has no fixed length and its last bar leads back to the first.
 *  oneshot: a stinger of a few bars that punctuates an event (level cleared, you died) and stops. */
export type Form = 'loop' | 'oneshot';
/** What a stinger is for. */
export type StingerEvent = 'win' | 'lose' | 'boss' | 'powerup' | 'secret';
/** hook: built around a repeating, catchy motif. vibe: texture and mood first, at any tempo (frantic is a vibe); its motif is sparse and does not repeat like a hook. */
export type Character = 'hook' | 'vibe';

export interface Note {
  /** Start, in beats from the song start. */
  t: number;
  /** Duration in beats. */
  d: number;
  /** MIDI note number (drums: 36 kick, 37 rim, 38 snare, 42 closed hat, 46 open hat, 49 crash). */
  n: number;
  /** MIDI velocity 1..127. */
  v: number;
}

export interface SongTrack {
  inst: Inst;
  voice: Voice;
  /** Which pressure layer this part could belong to (0 = always on, higher = brought in as pressure grows). */
  layer: number;
  notes: Note[];
}

/** One measure. `start` and `beats` are in quarter notes; num/den is the time signature written on the score. */
export interface Bar {
  start: number;
  beats: number;
  num: number;
  den: number;
}

export interface Section {
  kind: SectionKind;
  /** Display name, e.g. "Chorus 2". */
  name: string;
  startBar: number;
  bars: number;
  /** Semitones this section is shifted from the song's key (a key change for the last chorus). */
  transpose: number;
}

/** Tempo at a beat. With `ramp`, the tempo glides linearly to the next point's tempo (accelerando or ritardando). */
export interface TempoPoint {
  beat: number;
  bpm: number;
  ramp?: boolean;
}

export interface Song {
  id: string;
  name: string;
  /** A tweet-length account (280 characters at most) of what the song was going for. */
  description: string;
  /** One line on what the song is for. */
  intent: string;
  mood: string;
  /** Genre and era flavor the brief asked for, e.g. "8-bit action stage". */
  style: string;
  seed: number;
  form: Form;
  character: Character;
  /** Base tempo; the tempo map carries any changes. */
  tempo: number;
  tempoMap: TempoPoint[];
  /** MIDI note of the tonic (octave 3). */
  root: number;
  scale: string;
  /** Time signature summary, e.g. "4/4", "7/8", or "4/4 + 3/4" when it changes. */
  meter: string;
  bars: Bar[];
  sections: Section[];
  /** Bars where the hook is stated, so tools can find it. */
  hookBars: number[];
  tracks: SongTrack[];
}

/** What the jukebox list shows (songs.json). */
export interface SongMeta {
  id: string;
  name: string;
  description: string;
  intent: string;
  mood: string;
  style: string;
  form: Form;
  character: Character;
  tempo: number;
  scale: string;
  meter: string;
  barCount: number;
  seconds: number;
}
