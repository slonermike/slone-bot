import { audio } from '../audio/audio.ts';
import { glyph, onDeviceChange } from './glyphs.ts';
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

export interface MenuHandlers {
  resume(): void;
  restart(): void;
  toLauncher(): void;
  toFeedback(): void;
}

/** DOM pause menu: Resume / Restart / Back to launcher / Juice dial / Feedback sheet. Controller-driven via Nav actions. */
export class PauseMenu {
  readonly el = document.createElement('div');
  private panel = document.createElement('div');
  private screen: 'main' | 'juice' = 'main';
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
        else this.h.resume();
      }
      if (a === 'up' || a === 'down') audio.play('ui-move');
      this.draw();
    }
  }

  private go(screen: 'main' | 'juice', index = 0): void {
    this.screen = screen;
    this.index = index;
    audio.play('ui-select');
  }

  private items(): Item[] {
    if (this.screen === 'main') {
      return [
        { label: () => 'Resume', activate: () => this.h.resume() },
        { label: () => 'Restart', activate: () => this.h.restart() },
        { label: () => 'Back to launcher', activate: () => this.h.toLauncher() },
        { label: () => 'Juice dial', activate: () => this.go('juice') },
        { label: () => 'Feedback sheet', activate: () => this.h.toFeedback() },
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
    const title = this.screen === 'main' ? 'Paused' : 'Juice dial';
    const hint = this.screen === 'main'
      ? `${glyph('a')} select    ${glyph('b')} or ${glyph('start')} resume`
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
