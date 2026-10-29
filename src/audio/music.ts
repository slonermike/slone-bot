// Game music: a loop that plays under the action, parts that come in and out with the game's pressure, and
// stingers that punctuate events. Songs are plain data (src/music/); a prototype composes its own at start-up with
// `composeSong` and drives this from its render-side event handler. Never call it from sim code.
//
//   const song = composeSong({ ...brief, seed: 7 });
//   music.play(song, ['pad', 'bass']);          // start the loop with these parts
//   music.setParts(['pad', 'bass', 'drums']);   // pressure rises: bring the drums in, on the beat
//   music.stinger(winStinger);                  // a few bars over the top; the loop ducks under it
//   music.stop();
//
// Like `play()` for sound effects, every call is logged so bots and the smoke test can verify the music logic
// even when there is no audio hardware.
import { audio } from './audio.ts';
import { dial } from '../juice/dial.ts';
import { SongPlayer } from '../music/synth.ts';
import type { Inst, Song } from '../music/types.ts';

export interface MusicLogEntry {
  type: 'play' | 'parts' | 'stinger' | 'stop';
  id?: string;
  parts?: Inst[] | null;
  at: number;
}

export interface MusicState {
  songId: string | null;
  parts: Inst[] | null;
  paused: boolean;
  stingers: number;
}

class MusicDirector {
  private loop: SongPlayer | null = null;
  private sting: SongPlayer | null = null;
  private song: Song | null = null;
  private parts: Inst[] | null = null;
  private paused = false;
  private duckUntil = 0;
  private stingers = 0;
  readonly log: MusicLogEntry[] = [];

  private note(e: Omit<MusicLogEntry, 'at'>): void {
    this.log.push({ ...e, at: typeof performance !== 'undefined' ? performance.now() : 0 });
    if (this.log.length > 300) this.log.shift();
  }

  get state(): MusicState {
    return { songId: this.song?.id ?? null, parts: this.parts, paused: this.paused, stingers: this.stingers };
  }

  private players(): { loop: SongPlayer; sting: SongPlayer } | null {
    const ctx = audio.context;
    const out = audio.bus('music');
    if (!ctx || !out || ctx.state !== 'running') return null;
    this.loop ??= new SongPlayer(ctx, out);
    this.sting ??= new SongPlayer(ctx, out);
    return { loop: this.loop, sting: this.sting };
  }

  private enabled(): boolean {
    return dial.enabled('audio') && !audio.muted;
  }

  /** Start (or restart) the loop. `parts` limits which parts are audible at first; omit for all. */
  play(song: Song, parts?: Inst[]): void {
    this.song = song;
    this.parts = parts ?? null;
    this.note({ type: 'play', id: song.id, parts: this.parts });
    audio.whenReady(() => {
      if (this.song !== song || !this.enabled()) return;
      const p = this.players();
      if (!p) return;
      p.loop.play(song, undefined, this.parts ?? undefined);
      this.applyLevel();
    });
  }

  /** Change which parts are audible, with a short fade. Parts keep playing in time so they enter on the beat. */
  setParts(parts: Inst[] | null, fadeSeconds = 0.4): void {
    this.parts = parts;
    this.note({ type: 'parts', parts });
    this.loop?.setParts(parts, fadeSeconds);
  }

  /** Play a one-shot stinger over the loop, ducking the loop while it lasts. */
  stinger(song: Song, opts: { duck?: number } = {}): void {
    this.stingers++;
    this.note({ type: 'stinger', id: song.id });
    if (!this.enabled()) return;
    audio.whenReady(() => {
      const p = this.players();
      if (!p) return;
      const duck = opts.duck ?? 0.4;
      this.duckUntil = Infinity;
      this.loop?.setLevel(duck * (this.paused ? 0.5 : 1), 0.08);
      p.sting.play(song, () => {
        this.duckUntil = 0;
        this.applyLevel();
      });
    });
  }

  /** Fade the loop out over a few seconds, then stop it (a stinger already playing finishes). */
  release(seconds = 1.5): void {
    this.note({ type: 'stop' });
    const loop = this.loop;
    this.song = null;
    this.parts = null;
    loop?.setLevel(0, seconds);
    setTimeout(() => loop?.stop(), seconds * 1000 + 100);
  }

  /** Stop the loop (and any stinger). */
  stop(): void {
    this.note({ type: 'stop' });
    this.song = null;
    this.parts = null;
    this.loop?.stop();
    this.sting?.stop();
    this.duckUntil = 0;
  }

  /** Quieter while the game is paused. */
  setPaused(p: boolean): void {
    this.paused = p;
    this.applyLevel();
  }

  private applyLevel(): void {
    if (this.duckUntil === Infinity) return;
    this.loop?.setLevel(this.paused ? 0.35 : 1, 0.15);
  }
}

export const music = new MusicDirector();
