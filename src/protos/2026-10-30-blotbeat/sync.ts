// Locking the game clock to the audio playhead (render side). `err` is audio seconds minus game seconds: positive means
// the game is behind the music. Small errors are eased out a little each frame (no visible jump), a big one that persists
// (after a pause or a long hitch) is resolved by jumping to where the music is.
export interface SyncState { bigFrames: number }

export interface SyncAction { nudge: number; resync: boolean }

const EASE = 0.25;
/** Most the clock may be moved in one frame by easing (seconds). */
const MAX_STEP = 0.012;
const BIG = 0.2;
const BIG_FRAMES = 6;

export function syncStep(err: number, st: SyncState): SyncAction {
  if (Math.abs(err) < BIG) {
    st.bigFrames = 0;
    return { nudge: Math.max(-MAX_STEP, Math.min(MAX_STEP, err * EASE)), resync: false };
  }
  if (++st.bigFrames > BIG_FRAMES) { st.bigFrames = 0; return { nudge: 0, resync: true }; }
  return { nudge: 0, resync: false };
}
