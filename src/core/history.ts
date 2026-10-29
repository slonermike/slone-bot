/** Local play history (localStorage, try/catch). Launcher reads it; the shell writes play time. */
export interface PlayRecord {
  lastPlayed: number;
  count: number;
  ms: number;
}
export type PlayHistory = Record<string, PlayRecord>;

const KEY = 'mgb.history.v1';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadHistory(): PlayHistory {
  try {
    const raw = storage()?.getItem(KEY);
    return raw ? (JSON.parse(raw) as PlayHistory) : {};
  } catch {
    return {};
  }
}

function save(h: PlayHistory): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(h));
  } catch {
    /* storage unavailable: history is a nicety */
  }
}

export function recordLaunch(slug: string, now = Date.now()): void {
  const h = loadHistory();
  const r = h[slug] ?? { lastPlayed: 0, count: 0, ms: 0 };
  r.count += 1;
  r.lastPlayed = now;
  h[slug] = r;
  save(h);
}

export function recordPlayTime(slug: string, ms: number, now = Date.now()): void {
  if (ms <= 0) return;
  const h = loadHistory();
  const r = h[slug] ?? { lastPlayed: now, count: 0, ms: 0 };
  r.ms += ms;
  r.lastPlayed = now;
  h[slug] = r;
  save(h);
}

export function formatPlayTime(ms: number): string {
  const min = Math.round(ms / 60000);
  return min < 1 ? '<1 min' : `${min} min`;
}
