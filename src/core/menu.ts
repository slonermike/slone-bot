import { audio } from '../audio/audio.ts';
import { clampValue, formatValue } from './balance.ts';
import { glyph, onDeviceChange } from './glyphs.ts';
import type { BalanceSpec } from './types.ts';
import { dial, LAYERS } from '../juice/dial.ts';
import type { NavAction } from './nav.ts';

interface Item {
  label: () => string;
  value?: () => string;
  /** confirm (A) */
  activate?: () => void;
  /** left/right adjust */
  adjust?: (dir: -1 | 1) => void;
}

/** What the menu needs to show and change a build's balance values. */
export interface BalanceApi {
  spec(): BalanceSpec[];
  values: Record<string, number>;
  /** Persist and apply a new value. */
  set(id: string, value: number): void;
  reset(): void;
  copy(): void;
}

export interface MenuHandlers {
  balance?: BalanceApi;
  resume(): void;
  restart(): void;
  toLauncher(): void;
  toFeedback(): void;
}

/** DOM pause menu: Resume / Restart / Back to launcher / Juice dial / Feedback sheet. Controller-driven via Nav actions. */
export class PauseMenu {
  readonly el = document.createElement('div');
  private panel = document.createElement('div');
  private screen: 'main' | 'juice' | 'balance' = 'main';
  private note = '';
  private index = 0;
  private open = false;

  private readonly h: MenuHandlers;

  constructor(h: MenuHandlers) {
    this.h = h;
    this.el.className = 'mgb-overlay mgb-menu';
    this.el.style.display = 'none';
    this.panel.className = 'mgb-panel';
    this.el.appendChild(this.panel);
    document.body.appendChild(this.el);
    onDeviceChange(() => { if (this.open) this.draw(); });
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.open = true;
    this.screen = 'main';
    this.index = 0;
    this.el.style.display = 'flex';
    this.draw();
  }

  hide(): void {
    this.open = false;
    this.el.style.display = 'none';
  }

  handle(actions: NavAction[]): void {
    for (const a of actions) {
      const items = this.items();
      if (a === 'down') this.index = (this.index + 1) % items.length;
      else if (a === 'up') this.index = (this.index - 1 + items.length) % items.length;
      else if (a === 'left') items[this.index]?.adjust?.(-1);
      else if (a === 'right') items[this.index]?.adjust?.(1);
      else if (a === 'confirm') items[this.index]?.activate?.();
      else if (a === 'back') {
        if (this.screen === 'juice') this.go('main', 3);
        else if (this.screen === 'balance') this.go('main', 4);
        else this.h.resume();
      }
      if (a === 'up' || a === 'down') audio.play('ui-move');
      this.draw();
    }
  }

  private go(screen: 'main' | 'juice' | 'balance', index = 0): void {
    this.screen = screen;
    this.note = '';
    this.index = index;
    audio.play('ui-select');
  }

  private items(): Item[] {
    if (this.screen === 'main') {
      const main: Item[] = [
        { label: () => 'Resume', activate: () => this.h.resume() },
        { label: () => 'Restart', activate: () => this.h.restart() },
        { label: () => 'Back to launcher', activate: () => this.h.toLauncher() },
        { label: () => 'Juice dial', activate: () => this.go('juice') },
      ];
      if (this.h.balance?.spec().length) main.push({ label: () => 'Balance', activate: () => this.go('balance') });
      main.push({ label: () => 'Feedback sheet', activate: () => this.h.toFeedback() });
      return main;
    }
    if (this.screen === 'balance') {
      const api = this.h.balance!;
      const rows: Item[] = api.spec().map((s) => ({
        label: () => s.label,
        value: () => formatValue(s, api.values[s.id] ?? s.default),
        adjust: (d) => api.set(s.id, clampValue(s, (api.values[s.id] ?? s.default) + d * s.step)),
      }));
      return [
        ...rows,
        { label: () => 'Reset to defaults', activate: () => { api.reset(); this.note = 'Reset.'; } },
        { label: () => 'Copy values', activate: () => { api.copy(); this.note = 'Copied. Paste it into chat.'; } },
        { label: () => 'Back', activate: () => this.go('main', 4) },
      ];
    }
    const layerItems: Item[] = LAYERS.map((l) => ({
      label: () => l,
      value: () => (dial.enabled(l) ? 'ON' : 'off'),
      activate: () => dial.toggle(l),
      adjust: () => dial.toggle(l),
    }));
    return [
      {
        label: () => 'Intensity',
        value: () => `${Math.round(dial.intensity * 100)}%`,
        adjust: (d) => dial.setIntensity(dial.intensity + d * 0.1),
      },
      ...layerItems,
      { label: () => 'All on', activate: () => dial.setAll(true) },
      { label: () => 'Back', activate: () => this.go('main', 3) },
    ];
  }

  private draw(): void {
    const items = this.items();
    const title = this.screen === 'main' ? 'Paused' : this.screen === 'juice' ? 'Juice dial' : 'Balance';
    const hint = this.screen === 'main'
      ? `${glyph('a')} select    ${glyph('b')} or ${glyph('start')} resume`
      : this.screen === 'balance'
        ? `left/right change (saved on this device)    ${glyph('b')} back${this.note ? '    ' + this.note : ''}`
        : `${glyph('a')} or left/right change    ${glyph('b')} or ${glyph('start')} back`;
    this.panel.innerHTML = '';
    const h2 = document.createElement('h2');
    h2.textContent = title;
    this.panel.appendChild(h2);
    items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'mgb-item' + (i === this.index ? ' on' : '');
      const l = document.createElement('span');
      l.textContent = it.label();
      row.appendChild(l);
      if (it.value) {
        const v = document.createElement('span');
        v.textContent = it.value();
        row.appendChild(v);
      }
      this.panel.appendChild(row);
      if (i === this.index) queueMicrotask(() => row.scrollIntoView({ block: 'nearest' }));
    });
    const p = document.createElement('div');
    p.className = 'mgb-hint';
    p.textContent = hint;
    this.panel.appendChild(p);
  }
}
