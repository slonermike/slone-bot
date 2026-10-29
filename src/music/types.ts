/** A song as plain data: what the generator writes, the MIDI writer reads, and the browser synth plays. */
export type Inst = 'bass' | 'pad' | 'lead' | 'arp' | 'drums';
export type Voice = 'square' | 'saw' | 'pluck' | 'bell' | 'flute' | 'sub' | 'warm';

export interface Note {
  /** Start, in beats from the loop start. */
  t: number;
  /** Duration in beats. */
  d: number;
  /** MIDI note number (for drums: 36 kick, 38 snare, 37 rim, 42 closed hat, 46 open hat). */
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

export interface Song {
  id: string;
  name: string;
  /** A tweet-length account (280 characters at most) of what the loop was going for. */
  description: string;
  /** One line on what the loop is for, so Slone can judge it against its intent. */
  intent: string;
  mood: string;
  /** Genre and era flavor the brief asked for, e.g. "8-bit action stage". */
  style: string;
  seed: number;
  tempo: number;
  /** MIDI note of the tonic (octave 3). */
  root: number;
  scale: string;
  bars: number;
  tracks: SongTrack[];
}

/** What the jukebox list shows (songs.json). */
export type SongMeta = Pick<Song, 'id' | 'name' | 'description' | 'intent' | 'mood' | 'style' | 'tempo' | 'scale' | 'bars'> & { seconds: number };

export const BEATS_PER_BAR = 4;
