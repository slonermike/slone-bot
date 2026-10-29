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
import { BEATS_PER_BAR } from '../../music/types.ts';

type Verdict = 'keep' | 'tweak' | 'drop';
interface Entry { v?: Verdict; note?: string }
const STORE = 'mgb.jukebox.v1';
const CYCLE: (Verdict | undefined)[] = [undefined, 'keep', 'tweak', 'drop'];
const COLORS: Record<string, string> = { drums: '#ff5d73', bass: '#06d6a0', pad: '#4a4a7a', arp: '#4cc9f0', lead: '#ffd166' };

const root = document.getElementById('root')!;
let metas: SongMeta[] = [];
let focus = 0;
let verdicts: Record<string, Entry> = {};
let volume = 0.6;
let overlay: HTMLElement | null = null;
let exportText = '';
let toastEl: HTMLElement | null = null;
const loaded = new Map<string, Song>();
let player: SongPlayer | null = null;
let canvas: HTMLCanvasElement | null = null;
let noteInput: HTMLInputElement | null = null;

function loadStore(): void {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) ?? '{}');
    verdicts = d.verdicts ?? {};
    if (typeof d.volume === 'number') volume = d.volume;
  } catch { /* storage unavailable */ }
}
function saveStore(): void {
  try { localStorage.setItem(STORE, JSON.stringify({ verdicts, volume })); } catch { /* ignore */ }
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

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
  setTimeout(() => mine.remove(), 2200);
}

function pill(v?: Verdict): HTMLElement {
  return h('span', `pill ${v ?? ''}`, v ? v.toUpperCase() : '·');
}

function render(): void {
  const keepNote = noteInput?.value;
  const editing = document.activeElement === noteInput;
  root.textContent = '';
  const header = h('header');
  const title = h('h1');
  title.append('minigame-', Object.assign(h('span'), { textContent: 'jukebox' }));
  const rated = metas.filter((m) => verdicts[m.id]?.v).length;
  header.append(title, h('div', 'sub', `${metas.length} tracks, ${rated} rated`), Object.assign(h('div', 'filters vol'), { textContent: `volume ${Math.round(volume * 100)}%` }));
  root.append(header);

  const wrap = h('div', 'jb');
  const list = h('div', 'list');
  metas.forEach((m, i) => {
    const row = h('div', `track${i === focus ? ' focus' : ''}`);
    const playing = player?.current?.id === m.id;
    row.append(h('span', 'pp', playing ? '♪' : ''), pill(verdicts[m.id]?.v), h('span', 'nm', m.name), h('span', 'bpm', `${m.tempo} bpm`));
    row.addEventListener('click', () => { focus = i; render(); });
    list.append(row);
  });
  wrap.append(list);

  const m = metas[focus];
  const detail = h('div', 'detail');
  if (m) {
    detail.append(h('h2', '', m.name), h('div', 'style', m.style), h('div', 'desc', m.description));
    detail.append(h('div', 'facts', `${m.tempo} bpm · ${m.scale} · ${m.bars} bars, ${m.seconds}s a loop · ${m.mood}`));
    canvas = h('canvas');
    canvas.width = 900;
    canvas.height = 220;
    detail.append(canvas);
    const vrow = h('div', 'verdict');
    vrow.append(pill(verdicts[m.id]?.v), h('span', '', `${glyph('x')} changes the verdict`));
    detail.append(vrow);
    const nrow = h('div', 'verdict');
    noteInput = h('input');
    noteInput.placeholder = `note (${glyph('y')} to type, Enter to finish)`;
    noteInput.value = keepNote ?? verdicts[m.id]?.note ?? '';
    noteInput.addEventListener('input', () => { (verdicts[m.id] ??= {}).note = noteInput!.value; saveStore(); });
    noteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); noteInput!.blur(); } });
    nrow.append(noteInput);
    detail.append(nrow);
    const link = h('a', '', 'download the .mid file');
    link.href = `./songs/${m.id}.mid`;
    link.download = `${m.id}.mid`;
    detail.append(link);
    if (editing) noteInput.focus();
  }
  wrap.append(detail);
  root.append(wrap);

  const foot = h('footer');
  for (const [k, v] of [[glyph('a'), 'Play / stop'], [glyph('x'), 'Verdict'], [glyph('y'), 'Note'], ['Left/Right', 'Volume'], [glyph('select'), 'Export'], [glyph('b'), 'Back']]) {
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
  let song: Song;
  try { song = await fetchSong(m.id); } catch { return; }
  if (metas[focus]?.id !== m.id || !canvas) return;
  paintRoll(song);
}

function paintRoll(song: Song): void {
  if (!canvas) return;
  const c = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  c.clearRect(0, 0, W, H);
  const total = song.bars * BEATS_PER_BAR;
  c.strokeStyle = '#25254a';
  c.lineWidth = 1;
  for (let b = 0; b <= song.bars; b++) {
    c.beginPath();
    c.moveTo((b / song.bars) * W, 0);
    c.lineTo((b / song.bars) * W, H);
    c.stroke();
  }
  const pitched = song.tracks.filter((t) => t.inst !== 'drums').flatMap((t) => t.notes.map((n) => n.n));
  const lo = Math.min(...pitched, 36);
  const hi = Math.max(...pitched, 72);
  const laneH = H * 0.18;
  for (const tr of song.tracks) {
    c.fillStyle = COLORS[tr.inst] ?? '#fff';
    c.globalAlpha = tr.inst === 'pad' ? 0.45 : 0.95;
    for (const n of tr.notes) {
      const x = (n.t / total) * W;
      const w = Math.max(2, (n.d / total) * W - 1);
      if (tr.inst === 'drums') {
        const row = n.n === 36 ? 0 : n.n === 38 || n.n === 37 ? 1 : 2;
        c.fillRect(x, H - laneH + row * (laneH / 3), w, laneH / 3 - 1);
      } else {
        const y = (1 - (n.n - lo) / Math.max(1, hi - lo)) * (H - laneH - 8);
        c.fillRect(x, y, w, 5);
      }
    }
  }
  c.globalAlpha = 1;
  if (player?.current?.id === song.id) {
    const x = (player.beat / total) * W;
    c.fillStyle = '#fff';
    c.fillRect(x - 1, 0, 3, H);
  }
}

async function togglePlay(): Promise<void> {
  const m = metas[focus];
  if (!m) return;
  const p = getPlayer();
  if (p.current?.id === m.id) { p.stop(); render(); return; }
  try {
    const song = await fetchSong(m.id);
    p.play(song);
    if (p.ctx.state !== 'running') toast('Press a key or click once to enable audio');
  } catch (e) {
    toast(`Could not load that track (${(e as Error).message})`);
  }
  render();
}

function cycleVerdict(): void {
  const m = metas[focus];
  if (!m) return;
  const cur = verdicts[m.id]?.v;
  const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
  const e = (verdicts[m.id] ??= {});
  if (next) e.v = next; else delete e.v;
  saveStore();
  render();
}

function buildExport(): string {
  const groups: Record<string, string[]> = { keep: [], tweak: [], drop: [], unrated: [] };
  for (const m of metas) {
    const e = verdicts[m.id] ?? {};
    groups[e.v ?? 'unrated']!.push(`${m.id} "${m.name}" [${m.style}, ${m.tempo} bpm, ${m.scale}]${e.note ? ' - ' + e.note : ''}`);
  }
  const lines = [`Jukebox verdicts: ${groups.keep!.length} keep, ${groups.tweak!.length} tweak, ${groups.drop!.length} drop, ${groups.unrated!.length} unrated`];
  for (const k of ['keep', 'tweak', 'drop'] as const) if (groups[k]!.length) lines.push('', k.toUpperCase(), ...groups[k]!.map((l) => '- ' + l));
  return lines.join('\n');
}

function openExport(): void {
  exportText = buildExport();
  overlay = h('div', 'overlay');
  const sheet = h('div', 'sheet');
  sheet.append(h('h2', '', 'Your verdicts'));
  const sc = h('div', 'scroll');
  sc.append(h('pre', '', exportText));
  sheet.append(sc, h('div', 'hint', `${glyph('a')} copy to clipboard    ${glyph('b')} close. Paste it into chat.`));
  overlay.append(sheet);
  document.body.append(overlay);
}
function closeOverlay(): void { overlay?.remove(); overlay = null; }

function onAction(a: NavAction): void {
  if (overlay) {
    if (a === 'back' || a === 'start' || a === 'select') closeOverlay();
    else if (a === 'confirm') { void navigator.clipboard?.writeText(exportText).then(() => toast('Copied'), () => toast('Copy failed: select the text instead')); }
    return;
  }
  if (a === 'up') { focus = Math.max(0, focus - 1); render(); }
  else if (a === 'down') { focus = Math.min(metas.length - 1, focus + 1); render(); }
  else if (a === 'left' || a === 'right') { volume = Math.max(0, Math.min(1, Math.round((volume + (a === 'right' ? 0.1 : -0.1)) * 10) / 10)); player?.setVolume(volume); saveStore(); render(); }
  else if (a === 'confirm') void togglePlay();
  else if (a === 'x') cycleVerdict();
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
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    input.poll(now);
    if (!(document.activeElement instanceof HTMLInputElement)) for (const a of nav.read(input, now)) onAction(a);
    const song = player?.current;
    if (song && canvas && metas[focus]?.id === song.id) paintRoll(song);
  };
  requestAnimationFrame(loop);
  onDeviceChange(() => { if (!overlay) render(); });
  window.addEventListener('pointerdown', () => void player?.ctx.resume(), { once: true });
}

void boot();
