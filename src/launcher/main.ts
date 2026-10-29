import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import './style.css';
import { audio } from '../audio/audio.ts';
import { parseAttribution } from '../core/attribution.ts';
import type { CreditsSection } from '../core/attribution.ts';
import { glyph, onDeviceChange } from '../core/glyphs.ts';
import { formatPlayTime, loadHistory, recordLaunch } from '../core/history.ts';
import { InputManager } from '../core/input.ts';
import type { PrototypeManifest } from '../core/manifest.ts';
import { Nav } from '../core/nav.ts';
import type { NavAction } from '../core/nav.ts';
import { track } from '../core/track.ts';

type Screen = 'grid' | 'filter' | 'feedback' | 'menu' | 'credits';
const STATUSES = ['needs-feedback', 'assessed', 'favorite'] as const;

const root = document.getElementById('root')!;
let all: PrototypeManifest[] = [];
let brokenCount = 0;
let screen: Screen = 'grid';
let focus = 0;
let menuIndex = 0;
let filterIndex = 0;
const statusFilter = new Set<string>();
const tagFilter = new Set<string>();
let overlayEl: HTMLElement | null = null;
let scrollEl: HTMLElement | null = null;
let sheetText = '';
let credits: { sections: CreditsSection[]; license: string } | null = null;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}

function hueFor(slug: string): number {
  let n = 0;
  for (const c of slug) n = (n * 31 + c.charCodeAt(0)) % 360;
  return n;
}

function visible(): PrototypeManifest[] {
  return all.filter((p) => {
    if (statusFilter.size && !statusFilter.has(p.feedbackStatus)) return false;
    if (tagFilter.size && !p.tags.some((t) => tagFilter.has(t))) return false;
    return true;
  });
}

function allTags(): string[] {
  return [...new Set(all.flatMap((p) => p.tags))].sort();
}

function renderGrid(): void {
  root.innerHTML = '';
  const header = h('header');
  const title = h('h1');
  title.append('minigame-', Object.assign(h('span'), { textContent: 'bot' }));
  header.append(title, h('div', 'sub', `${all.length} prototype${all.length === 1 ? '' : 's'}`));
  if (statusFilter.size || tagFilter.size) header.append(h('div', 'filters', `filter: ${[...statusFilter, ...tagFilter].join(', ')}`));
  root.append(header);

  const main = h('main');
  const list = visible();
  focus = Math.max(0, Math.min(focus, list.length - 1));
  if (list.length === 0) {
    main.append(h('div', 'empty', all.length === 0
      ? 'No prototypes yet. When the first night finishes building, its card shows up here.'
      : 'No prototypes match this filter. Press Y to change it.'));
  } else {
    const grid = h('div', 'grid');
    const hist = loadHistory();
    const unfiltered = !statusFilter.size && !tagFilter.size;
    list.forEach((p, i) => grid.append(card(p, i, i === 0 && unfiltered, hist[p.slug])));
    main.append(grid);
  }
  root.append(main);

  const foot = h('footer');
  for (const [k, v] of [[glyph('a'), 'Play'], [glyph('x'), 'Feedback'], [glyph('y'), 'Filter'], [glyph('start'), 'Menu']]) {
    const s = h('span');
    s.append(h('b', '', k), v);
    foot.append(s);
  }
  if (brokenCount) foot.append(h('span', 'note', `${brokenCount} broken build${brokenCount === 1 ? '' : 's'} hidden`));
  root.append(foot);
  scrollFocusIntoView();
}

function card(p: PrototypeManifest, i: number, hero: boolean, rec?: { count: number; ms: number }): HTMLElement {
  const el = h('div', `card${hero ? ' hero' : ''}${i === focus ? ' focus' : ''}`);
  el.dataset.i = String(i);
  const thumb = h('div', 'thumb');
  const hue = hueFor(p.slug);
  thumb.style.background = `linear-gradient(135deg,hsl(${hue} 55% 28%),hsl(${(hue + 60) % 360} 60% 18%))`;
  if (p.thumbnail) {
    const img = document.createElement('img');
    img.src = `./p/${p.slug}/${p.thumbnail}`;
    img.alt = '';
    img.onerror = () => img.remove();
    thumb.append(img);
  }
  // the focused card plays its gameplay GIF over the still thumbnail (only the focused one is fetched)
  if (p.preview && i === focus && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const gif = document.createElement('img');
    gif.className = 'preview';
    gif.alt = '';
    gif.src = `./p/${p.slug}/${p.preview}`;
    gif.onerror = () => gif.remove();
    thumb.append(gif);
  }
  const body = h('div', 'body');
  body.append(h('h2', '', p.title), h('div', 'q', p.question), h('div', 'feel', p.targetFeeling));
  const meta = h('div', 'meta', p.date);
  for (const t of p.tags.slice(0, 3)) meta.append(h('span', 'tag', t));
  if (rec) meta.append(h('span', '', `played ${rec.count}x · ${formatPlayTime(rec.ms)}`));
  body.append(meta);
  el.append(thumb, body, h('div', `badge ${p.feedbackStatus}`, p.feedbackStatus.replace('-', ' ')));
  if (hero) el.append(h('div', 'new', 'NEWEST'));
  return el;
}

function scrollFocusIntoView(): void {
  root.querySelector('.card.focus')?.scrollIntoView({ block: 'nearest' });
}

function moveFocus(dir: 'up' | 'down' | 'left' | 'right'): void {
  const cards = [...root.querySelectorAll<HTMLElement>('.card')];
  const cur = cards[focus];
  if (!cur) return;
  const c = cur.getBoundingClientRect();
  const cx = c.left + c.width / 2;
  const cy = c.top + c.height / 2;
  let best = -1;
  let bestScore = Infinity;
  cards.forEach((el, i) => {
    if (i === focus) return;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - cx;
    const dy = r.top + r.height / 2 - cy;
    const ok = dir === 'left' ? dx < -10 : dir === 'right' ? dx > 10 : dir === 'up' ? dy < -10 : dy > 10;
    if (!ok) return;
    const along = dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy);
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = along + across * 3;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  if (best >= 0) {
    focus = best;
    audio.play('ui-move');
    renderGrid();
  }
}

// ---- overlays ----
function closeOverlay(): void {
  overlayEl?.remove();
  overlayEl = null;
  scrollEl = null;
  screen = 'grid';
}

function openOverlay(content: (sheet: HTMLElement) => void): void {
  overlayEl?.remove();
  overlayEl = h('div', 'overlay');
  const sheet = h('div', 'sheet');
  content(sheet);
  overlayEl.append(sheet);
  document.body.append(overlayEl);
}

function drawFilter(): void {
  const items: { label: string; on: boolean; toggle: () => void }[] = [
    ...STATUSES.map((s) => ({ label: `Status: ${s}`, on: statusFilter.has(s), toggle: () => toggleSet(statusFilter, s) })),
    ...allTags().map((t) => ({ label: `Tag: ${t}`, on: tagFilter.has(t), toggle: () => toggleSet(tagFilter, t) })),
    { label: 'Clear all', on: false, toggle: () => { statusFilter.clear(); tagFilter.clear(); } },
  ];
  filterIndex = Math.max(0, Math.min(filterIndex, items.length - 1));
  openOverlay((sheet) => {
    sheet.append(h('h2', '', 'Filter'));
    const sc = h('div', 'scroll');
    items.forEach((it, i) => {
      const row = h('div', `row${i === filterIndex ? ' focus' : ''}`);
      row.append(h('span', '', it.label), h('span', '', it.on ? 'ON' : ''));
      sc.append(row);
    });
    sheet.append(sc, h('div', 'hint', `${glyph('a')} toggle    ${glyph('b')} or ${glyph('start')} done`));
    sc.querySelector('.focus')?.scrollIntoView({ block: 'nearest' });
  });
  (drawFilter as unknown as { items: typeof items }).items = items;
}

function toggleSet(s: Set<string>, v: string): void {
  if (s.has(v)) s.delete(v); else s.add(v);
}

async function openFeedback(slug: string): Promise<void> {
  const p = all.find((x) => x.slug === slug);
  const get = async (f: string) => {
    try {
      const r = await fetch(`./p/${slug}/${f}`, { cache: 'no-store' });
      return r.ok ? await r.text() : '';
    } catch {
      return '';
    }
  };
  const [pm, fb] = await Promise.all([get('postmortem.md'), get('feedback-sheet.md')]);
  sheetText = [fb || `PROTOTYPE: ${p?.title ?? slug} (${slug})\n\n(no feedback sheet was shipped with this build)`].join('\n');
  screen = 'feedback';
  openOverlay((sheet) => {
    sheet.append(h('h2', '', `Feedback: ${p?.title ?? slug}`));
    const sc = h('div', 'scroll');
    if (pm) sc.append(h('pre', '', pm));
    sc.append(h('pre', '', sheetText));
    scrollEl = sc;
    sheet.append(sc, h('div', 'hint', `Up/Down scroll    ${glyph('a')} copy sheet text    ${glyph('b')} or ${glyph('start')} back`));
  });
}

async function openCredits(): Promise<void> {
  if (!credits) {
    try {
      const r = await fetch('./credits.json');
      const j = (await r.json()) as { attribution: string; license: string };
      credits = { sections: parseAttribution(j.attribution), license: j.license };
    } catch {
      credits = { sections: [], license: 'Credits unavailable offline.' };
    }
  }
  screen = 'credits';
  openOverlay((sheet) => {
    sheet.append(h('h2', '', 'About and credits'));
    const sc = h('div', 'scroll credits');
    sc.append(h('p', '', 'Small games built unattended by a Claude agent following documents written by Slone. Code is MIT licensed.'));
    for (const s of credits!.sections) {
      if (s.heading) sc.append(h('h3', '', s.heading));
      for (const para of s.paragraphs) sc.append(h('p', '', para));
      if (s.table) {
        const t = h('table');
        const hr = h('tr');
        s.table.head.forEach((c) => hr.append(h('th', '', c)));
        t.append(hr);
        for (const row of s.table.rows) {
          const tr = h('tr');
          row.forEach((c) => tr.append(h('td', '', c)));
          t.append(tr);
        }
        sc.append(t);
      }
    }
    sc.append(h('h3', '', 'License'), h('pre', '', credits!.license));
    scrollEl = sc;
    sheet.append(sc, h('div', 'hint', `Up/Down scroll    ${glyph('b')} or ${glyph('start')} back`));
  });
}

function drawMenu(): void {
  const items = menuItems();
  openOverlay((sheet) => {
    sheet.append(h('h2', '', 'Menu'));
    const sc = h('div', 'scroll');
    items.forEach((it, i) => {
      const row = h('div', `row${i === menuIndex ? ' focus' : ''}`);
      row.append(h('span', '', it.label()), h('span', '', it.value?.() ?? ''));
      sc.append(row);
    });
    sheet.append(sc, h('div', 'hint', `${glyph('a')} select    Left/Right volume    ${glyph('b')} or ${glyph('start')} close`));
  });
}

function menuItems() {
  return [
    { label: () => 'Volume', value: () => `${Math.round(audio.getVolume('master') * 100)}%`, adjust: (d: number) => audio.setVolume('master', audio.getVolume('master') + d * 0.1) },
    { label: () => 'Mute', value: () => (audio.muted ? 'ON' : 'off'), activate: () => audio.setMuted(!audio.muted) },
    { label: () => 'About and credits', activate: () => void openCredits() },
    { label: () => 'Close', activate: () => closeOverlay() },
  ] as { label: () => string; value?: () => string; activate?: () => void; adjust?: (d: number) => void }[];
}

function launch(p: PrototypeManifest): void {
  recordLaunch(p.slug);
  track('card_launch', { slug: p.slug });
  audio.play('ui-select');
  setTimeout(() => (location.href = `./p/${p.slug}/`), 140);
}

function onAction(a: NavAction): void {
  void audio.unlock();
  const list = visible();
  if (screen === 'grid') {
    if (a === 'up' || a === 'down' || a === 'left' || a === 'right') moveFocus(a);
    else if (a === 'confirm' && list[focus]) launch(list[focus]!);
    else if (a === 'x' && list[focus]) void openFeedback(list[focus]!.slug);
    else if (a === 'y') { screen = 'filter'; filterIndex = 0; drawFilter(); }
    else if (a === 'start') { screen = 'menu'; menuIndex = 0; drawMenu(); }
    return;
  }
  if (a === 'back' || a === 'start') {
    if (screen === 'credits') { screen = 'menu'; drawMenu(); } else { const wasFilter = screen === 'filter'; closeOverlay(); if (wasFilter) renderGrid(); }
    audio.play('ui-back');
    return;
  }
  if (screen === 'filter') {
    const items = (drawFilter as unknown as { items: { toggle: () => void }[] }).items;
    if (a === 'down') filterIndex = Math.min(items.length - 1, filterIndex + 1);
    else if (a === 'up') filterIndex = Math.max(0, filterIndex - 1);
    else if (a === 'confirm') { items[filterIndex]?.toggle(); focus = 0; }
    drawFilter();
    audio.play('ui-move');
  } else if (screen === 'menu') {
    const items = menuItems();
    if (a === 'down') menuIndex = Math.min(items.length - 1, menuIndex + 1);
    else if (a === 'up') menuIndex = Math.max(0, menuIndex - 1);
    else if (a === 'confirm') items[menuIndex]?.activate?.();
    else if (a === 'left') items[menuIndex]?.adjust?.(-1);
    else if (a === 'right') items[menuIndex]?.adjust?.(1);
    if (screen === 'menu') drawMenu();
  } else if (screen === 'feedback' || screen === 'credits') {
    if (a === 'down') scrollEl?.scrollBy({ top: 120 });
    else if (a === 'up') scrollEl?.scrollBy({ top: -120 });
    else if (a === 'confirm' && screen === 'feedback') {
      void navigator.clipboard?.writeText(sheetText).catch(() => {});
      audio.play('ui-select');
    }
  }
}

async function boot(): Promise<void> {
  try {
    const r = await fetch('./index.json', { cache: 'no-store' });
    const j = (await r.json()) as { prototypes: PrototypeManifest[] };
    brokenCount = j.prototypes.filter((p) => p.buildStatus === 'broken').length;
    all = j.prototypes.filter((p) => p.buildStatus !== 'broken');
  } catch {
    all = [];
  }
  renderGrid();
  track('launcher_open', { prototypes: all.length });

  const hash = /^#feedback=(.+)$/.exec(location.hash);
  if (hash) void openFeedback(decodeURIComponent(hash[1]!));

  const input = new InputManager();
  input.attach();
  const nav = new Nav();
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    input.poll(now);
    for (const a of nav.read(input, now)) onAction(a);
    if (scrollEl && (input.frame.left.y !== 0)) scrollEl.scrollBy({ top: input.frame.left.y * 14 });
  };
  requestAnimationFrame(loop);
  // button labels follow the device last used
  onDeviceChange(() => { if (!overlayEl) renderGrid(); });
  window.addEventListener('keydown', () => void audio.unlock(), { once: true });
}

void boot();
