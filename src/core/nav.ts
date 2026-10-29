import type { InputManager } from './input.ts';

export type NavAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'x' | 'y' | 'start' | 'select';

/**
 * Turns an InputManager's frame into discrete menu actions with auto-repeat on held
 * stick/d-pad directions. Used by the pause menu and the launcher (not by prototypes).
 */
export class Nav {
  private repeat: Record<string, number> = {};
  private readonly delay = 380;
  private readonly rate = 120;

  /** Call once per rendered frame after `input.poll()`. Returns actions fired this frame. */
  read(input: InputManager, now: number = performance.now()): NavAction[] {
    const out: NavAction[] = [];
    const f = input.frame;
    const dirs: Record<'up' | 'down' | 'left' | 'right', boolean> = {
      up: f.down.up > 0.5 || f.left.y < -0.6,
      down: f.down.down > 0.5 || f.left.y > 0.6,
      left: f.down.left > 0.5 || f.left.x < -0.6,
      right: f.down.right > 0.5 || f.left.x > 0.6,
    };
    for (const d of ['up', 'down', 'left', 'right'] as const) {
      if (dirs[d]) {
        const next = this.repeat[d];
        if (next === undefined) {
          out.push(d);
          this.repeat[d] = now + this.delay;
        } else if (now >= next) {
          out.push(d);
          this.repeat[d] = now + this.rate;
        }
      } else {
        delete this.repeat[d];
      }
    }
    if (input.justPressed('a')) out.push('confirm');
    if (input.justPressed('b')) out.push('back');
    if (input.justPressed('x')) out.push('x');
    if (input.justPressed('y')) out.push('y');
    if (input.justPressed('start')) out.push('start');
    if (input.justPressed('select')) out.push('select');
    return out;
  }

  reset(): void {
    this.repeat = {};
  }
}
