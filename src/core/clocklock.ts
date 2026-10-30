// Locking a game clock to an audio playhead (render side, for music-driven games). `err` is audio seconds minus game
// seconds: positive means the game is behind the music. Small errors are eased out a little each frame (no visible
// jump); a big one that persists (after a pause or a long hitch) is resolved by jumping to where the music is.
// Do not call it while paused, and switch it off in capture modes where virtual time outruns the audio's wall clock.
export interface ClockLock { bigFrames: number }

export interface ClockLockAction { nudge: number; resync: boolean }

export function newClockLock(): ClockLock {
  return { bigFrames: 0 };
}

export interface ClockLockOptions {
  /** Share of the error removed per frame. Default 0.25. */
  ease?: number;
  /** Most the clock may be moved by easing in one frame, seconds. Default 0.012. */
  maxStep?: number;
  /** Error (seconds) from which easing gives way to a jump. Default 0.2. */
  big?: number;
  /** Frames a big error must persist before the jump. Default 6. */
  bigFrames?: number;
}

export function clockLockStep(err: number, st: ClockLock, o: ClockLockOptions = {}): ClockLockAction {
  const ease = o.ease ?? 0.25;
  const maxStep = o.maxStep ?? 0.012;
  const big = o.big ?? 0.2;
  const frames = o.bigFrames ?? 6;
  if (Math.abs(err) < big) {
    st.bigFrames = 0;
    return { nudge: Math.max(-maxStep, Math.min(maxStep, err * ease)), resync: false };
  }
  if (++st.bigFrames > frames) { st.bigFrames = 0; return { nudge: 0, resync: true }; }
  return { nudge: 0, resync: false };
}
