import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '../style.css';
import './jukebox.css';
import { glyph, onDeviceChange } from '../../core/glyphs.ts';
import { InputManager } from '../../core/input.ts';
import { Nav } from '../../core/nav.ts';
import type { NavAction } from '../../core/nav.ts';
import { SongPlayer } from '../../music/synth.ts';
import type { Song, SongMeta } from '../../music/types.ts';
import { vibeOf } from '../../music/vibe.ts';

const CATEGORIES = [
  { id: 'l', label: 'Listenability', hint: 'Would you leave it on?' },
  { id: 'c', label: 'Catchiness', hint: 'Does it stick? (Vibe pieces are not trying to.)' },
  { id: 'v', label: 'Vibe', hint: 'Does it make a feeling?' },
] as const;
type Cat = (typeof CATEGORIES)[number]['id'];
interface Entry { l?: number; c?: number; v?: number; note?: string }
const STORE = 'mgb.jukebox.v2';
const COLORS: Record<string, string> = { drums: '#ff5d73', bass: '#06d6a0', pad: '#4a4a7a', arp: '#4cc9f0', lead: '#ffd166', harmony: '#ffb3c1', riff: '#c77dff' };
const SECTION_TINT = ['#1a1a36', '#14142c'];

const root = document.getElementById('root')!;
let metas: SongMeta[] = [];
let focus = 0;
let cat = 0;
let ratings: Record<string, Entry> = {};
let volume = 0.6;
let overlay: HTMLElement | null = null;
let exportText = '';
let toastEl: HTMLElement | null = null;
const loaded = new Map<string, Song>();
let player: SongPlayer | null = null;
let canvas: HTMLCanvasElement | null = null;
let noteInput: HTMLInputElement | null = null;
let shownSong = '';

function loadStore(): void {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) ?? '{}');
    ratings = d.ratings ?? {};
    if (typeof d.volume === 'number') volume = d.volume;
  } catch { /* storage unavailable */ }
}
function saveStore(): void {
  try { localStorage.setItem(STORE, JSON.stringify({ ratings, volume })); } catch { /* ignore */ }
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

const stars = (n = 0) => '★'.repeat(n) + '☆'.repeat(5 - n);
const total = (e?: Entry) => (e ? (e.l ?? 0) + (e.c ?? 0) + (e.v ?? 0) : 0);
const rated = (e?: Entry) => !!e && (e.l !== undefined || e.c !== undefined || e.v !== undefined);

function getPlayer(): SongPlayer {
  if (!player) player = new SongPlayer(new AudioContext());
  player.setVolume(volume);
  return player;
}

async function fetchSong(id: string): Promise<Song> {
  const have = loaded.get(id);
  if (have) return have;
  const res = await fetch(`./songs/${id}.json`);
  if (!res.ok) throw new Error(`song ${id}: HTTP ${res.status}`);
  const s = (await res.json()) as Song;
  loaded.set(id, s);
  return s;
}

function toast(msg: string): void {
  toastEl?.remove();
  toastEl = h('div', 'toast', msg);
  document.body.append(toastEl);
  const mine = toastEl;
  setTimeout(() => mine.remove(), 2400);
}

function ratingRow(m: SongMeta, c: (typeof CATEGORIES)[number], i: number): HTMLElement {
  const row = h('div', `rate${i === cat ? ' sel' : ''}`);
  row.append(h('span', 'rl', c.label), h('span', 'stars', stars(ratings[m.id]?.[c.id as Cat])));
  row.addEventListener('click', () => { cat = i; render(); });
  return row;
}

function meter(label: string, v: number): HTMLElement {
  const r = h('div', 'meter');
  r.append(h('span', '', label));
  const bar = h('div', 'mbar');
  const fill = h('div', 'mfill');
  fill.style.width = `${Math.round(v * 100)}%`;
  bar.append(fill);
  r.append(bar);
  return r;
}

function render(): void {
  const m = metas[focus];
  // keep what is being typed only while the same song is showing
  const keepNote = m && shownSong === m.id && document.activeElement === noteInput ? noteInput?.value : undefined;
  const editing = keepNote !== undefined;
  root.textContent = '';
  const header = h('header');
  const title = h('h1');
  title.append('minigame-', Object.assign(h('span'), { textContent: 'jukebox' }));
  const done = metas.filter((x) => rated(ratings[x.id])).length;
  header.append(title, h('div', 'sub', `${metas.length} tracks, ${done} rated`), Object.assign(h('div', 'filters vol'), { textContent: `volume ${Math.round(volume * 100)}%` }));
  root.append(header);

  const wrap = h('div', 'jb');
  const list = h('div', 'list');
  metas.forEach((x, i) => {
    const row = h('div', `track${i === focus ? ' focus' : ''}`);
    const playing = player?.current?.id === x.id;
    const t = total(ratings[x.id]);
    row.append(h('span', 'pp', playing ? '♪' : ''), h('span', 'score', rated(ratings[x.id]) ? String(t) : '·'), h('span', 'nm', x.name), h('span', 'bpm', `${x.meter} · ${x.tempo}`));
    row.addEventListener('click', () => { focus = i; render(); });
    list.append(row);
  });
  wrap.append(list);

  const detail = h('div', 'detail');
  if (m) {
    const song = loaded.get(m.id);
    detail.append(h('h2', '', m.name), h('div', 'style', m.style));
    const tags = h('div', 'tags');
    tags.append(h('span', `tag ${m.character}`, m.character === 'hook' ? 'hook song' : 'vibe piece'), h('span', 'tag', m.form === 'loop' ? 'loop' : 'one-shot'), h('span', 'tag', m.meter), h('span', 'tag', m.scale), h('span', 'tag', `${m.tempo} bpm`), h('span', 'tag', `${m.barCount} bars, ${m.seconds}s`));
    detail.append(tags, h('div', 'desc', m.description));
    CATEGORIES.forEach((c, i) => detail.append(ratingRow(m, c, i)));
    detail.append(h('div', 'rhint', `${glyph('x')} picks a category (${CATEGORIES[cat]!.hint}) · Left/Right or 1-5 sets stars`));
    canvas = h('canvas');
    canvas.width = 900;
    canvas.height = 220;
    detail.append(canvas);
    const secs = h('div', 'secs');
    if (song) for (const s of song.sections) secs.append(h('span', 'sec', `${s.name} ${s.bars}${s.transpose ? ` (+${s.transpose})` : ''}`));
    detail.append(secs);
    if (song) {
      const v = vibeOf({ mode: song.scale, meters: [...new Set(song.bars.map((b) => `${b.num}/${b.den}`))], bpm: song.tempo });
      const vm = h('div', 'vibes');
      vm.append(meter('energy', v.energy), meter('mood', v.valence), meter('tension', v.tension));
      detail.append(vm);
    }
    noteInput = h('input');
    noteInput.placeholder = `note on ${m.name} (${glyph('y')} to type, Enter to finish)`;
    noteInput.value = keepNote ?? ratings[m.id]?.note ?? '';
    const id = m.id;
    noteInput.addEventListener('input', () => { (ratings[id] ??= {}).note = noteInput!.value; saveStore(); });
    noteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); noteInput!.blur(); } });
    detail.append(noteInput);
    const link = h('a', '', 'download the .mid file');
    link.href = `./songs/${m.id}.mid`;
    link.download = `${m.id}.mid`;
    detail.append(link);
    shownSong = m.id;
    if (editing) noteInput.focus();
  }
  wrap.append(detail);
  root.append(wrap);

  const foot = h('footer');
  for (const [k, v] of [[glyph('a'), 'Play'], [glyph('x'), 'Category'], ['Left/Right', 'Stars'], [glyph('y'), 'Note'], ['LB/RB', 'Volume'], [glyph('select'), 'Export'], [glyph('b'), 'Back']]) {
    const s = h('span');
    s.append(h('b', '', k), v);
    foot.append(s);
  }
  root.append(foot);
  list.querySelector('.focus')?.scrollIntoView({ block: 'nearest' });
  void drawRoll();
}

async function drawRoll(): Promise<void> {
  const m = metas[focus];
  if (!m || !canvas) return;
  const had = loaded.has(m.id);
  let song: Song;
  try { song = await fetchSong(m.id); } catch { return; }
  if (metas[focus]?.id !== m.id || !canvas) return;
  if (!had) render(); // the section chips and vibe meters need the song data
  else paintRoll(song);
}

function paintRoll(song: Song): void {
  if (!canvas) return;
  const c = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const last = song.bars[song.bars.length - 1]!;
  const total = last.start + last.beats;
  const X = (beat: number) => (beat / total) * W;
  c.clearRect(0, 0, W, H);
  // section bands, then bar lines (wider bars are longer bars: a 3/4 bar in 4/4 shows up as a short one)
  song.sections.forEach((s, i) => {
    const a = song.bars[s.startBar]!.start;
    const b = song.bars[s.startBar + s.bars - 1]!;
    c.fillStyle = SECTION_TINT[i % 2]!;
    c.fillRect(X(a), 0, X(b.start + b.beats) - X(a), H);
    c.fillStyle = '#6b6b9a';
    c.font = '15px system-ui, sans-serif';
    c.fillText(s.name, X(a) + 4, 15);
  });
  c.strokeStyle = '#34345c';
  c.lineWidth = 1;
  for (const b of song.bars) { c.beginPath(); c.moveTo(X(b.start), 0); c.lineTo(X(b.start), H); c.stroke(); }
  // hook markers
  c.fillStyle = '#ffd166';
  for (const g of song.hookBars) { const b = song.bars[g]!; c.fillRect(X(b.start), 20, Math.max(3, X(b.beats)), 3); }
  const pitched = song.tracks.filter((t) => t.inst !== 'drums').flatMap((t) => t.notes.map((n) => n.n));
  const lo = Math.min(...pitched, 36);
  const hi = Math.max(...pitched, 72);
  const laneH = H * 0.18;
  for (const tr of song.tracks) {
    c.fillStyle = COLORS[tr.inst] ?? '#fff';
    c.globalAlpha = tr.inst === 'pad' ? 0.4 : 0.95;
    for (const n of tr.notes) {
      const x = X(n.t);
      const w = Math.max(2, X(n.d) - 1);
      if (tr.inst === 'drums') {
        const row = n.n === 36 ? 0 : n.n === 38 || n.n === 37 ? 1 : 2;
        c.fillRect(x, H - laneH + row * (laneH / 3), w, laneH / 3 - 1);
      } else {
        const y = 28 + (1 - (n.n - lo) / Math.max(1, hi - lo)) * (H - laneH - 40);
        c.fillRect(x, y, w, 5);
      }
    }
  }
  c.globalAlpha = 1;
  if (player?.current?.id === song.id) {
    c.fillStyle = '#fff';
    c.fillRect(X(player.beat) - 1, 0, 3, H);
  }
}

async function togglePlay(): Promise<void> {
  const m = metas[focus];
  if (!m) return;
  const p = getPlayer();
  if (p.current?.id === m.id) { p.stop(); render(); return; }
  try {
    const song = await fetchSong(m.id);
    p.play(song, () => render());
    if (p.ctx.state !== 'running') toast('Press a key or click once to enable audio');
  } catch (e) {
    toast(`Could not load that track (${(e as Error).message})`);
  }
  render();
}

function setStars(n: number): void {
  const m = metas[focus];
  if (!m) return;
  const e = (ratings[m.id] ??= {});
  const id = CATEGORIES[cat]!.id;
  const clamped = Math.max(0, Math.min(5, n));
  if (clamped === 0) delete e[id]; else e[id] = clamped;
  saveStore();
  render();
}

function buildExport(): string {
  const done = metas.filter((m) => rated(ratings[m.id]));
  const fmt = (m: SongMeta) => {
    const e = ratings[m.id] ?? {};
    return `${m.id} "${m.name}" [${m.character}, ${m.form}, ${m.meter}, ${m.tempo} bpm, ${m.scale}] listen ${e.l ?? '-'}/5, catchy ${e.c ?? '-'}/5, vibe ${e.v ?? '-'}/5${e.note ? ' - ' + e.note : ''}`;
  };
  const lines = [`Jukebox ratings: ${done.length} of ${metas.length} rated (listenability / catchiness / vibe, out of 5)`];
  if (done.length) lines.push('', ...[...done].sort((a, b) => total(ratings[b.id]) - total(ratings[a.id])).map((m) => '- ' + fmt(m)));
  const left = metas.filter((m) => !rated(ratings[m.id]));
  if (left.length) lines.push('', `Not rated yet: ${left.map((m) => m.id).join(', ')}`);
  return lines.join('\n');
}

function openExport(): void {
  exportText = buildExport();
  overlay = h('div', 'overlay');
  const sheet = h('div', 'sheet');
  sheet.append(h('h2', '', 'Your ratings'));
  const sc = h('div', 'scroll');
  sc.append(h('pre', '', exportText));
  sheet.append(sc, h('div', 'hint', `${glyph('a')} copy to clipboard    ${glyph('b')} close. Paste it into chat.`));
  overlay.append(sheet);
  document.body.append(overlay);
}
function closeOverlay(): void { overlay?.remove(); overlay = null; }

function changeVolume(d: number): void {
  volume = Math.max(0, Math.min(1, Math.round((volume + d) * 10) / 10));
  player?.setVolume(volume);
  saveStore();
  render();
}

function onAction(a: NavAction): void {
  if (overlay) {
    if (a === 'back' || a === 'start' || a === 'select') closeOverlay();
    else if (a === 'confirm') { void navigator.clipboard?.writeText(exportText).then(() => toast('Copied'), () => toast('Copy failed: select the text instead')); }
    return;
  }
  const cur = ratings[metas[focus]?.id ?? '']?.[CATEGORIES[cat]!.id as Cat] ?? 0;
  if (a === 'up') { focus = Math.max(0, focus - 1); render(); }
  else if (a === 'down') { focus = Math.min(metas.length - 1, focus + 1); render(); }
  else if (a === 'left') setStars(cur - 1);
  else if (a === 'right') setStars(cur + 1);
  else if (a === 'confirm') void togglePlay();
  else if (a === 'x') { cat = (cat + 1) % CATEGORIES.length; render(); }
  else if (a === 'y') noteInput?.focus();
  else if (a === 'select') openExport();
  else if (a === 'back' || a === 'start') { player?.stop(); location.href = '../'; }
}

async function boot(): Promise<void> {
  loadStore();
  try {
    const res = await fetch('./songs.json');
    metas = res.ok ? ((await res.json()) as SongMeta[]) : [];
  } catch { metas = []; }
  if (!metas.length) {
    root.append(h('div', 'empty', 'No songs yet. Run node scripts/make-songs.mjs and rebuild.'));
    return;
  }
  render();
  const input = new InputManager();
  input.attach();
  const nav = new Nav();
  window.addEventListener('keydown', (e) => {
    if (overlay || document.activeElement instanceof HTMLInputElement) return;
    if (/^Digit[0-5]$/.test(e.code)) setStars(Number(e.code.slice(5)));
  });
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    input.poll(now);
    if (!(document.activeElement instanceof HTMLInputElement)) {
      for (const a of nav.read(input, now)) onAction(a);
      if (input.justPressed('lb')) changeVolume(-0.1);
      if (input.justPressed('rb')) changeVolume(0.1);
    }
    const song = player?.current;
    if (song && canvas && metas[focus]?.id === song.id) paintRoll(song);
  };
  requestAnimationFrame(loop);
  onDeviceChange(() => { if (!overlay) render(); });
  window.addEventListener('pointerdown', () => void player?.ctx.resume(), { once: true });
}

void boot();
