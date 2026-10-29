import { KEY_BUTTONS, setDevice } from './glyphs.ts';
import { blankInput, shapeStick } from './input-state.ts';
import type { StickShape } from './input-state.ts';
import { BUTTONS } from './types.ts';
import type { ButtonName, InputState } from './types.ts';

/** Standard-mapping button indices -> names. */
const PAD_BUTTONS: ButtonName[] = [
  'a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'select', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right',
];

const KEY_STICK: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
};

type ButtonValues = Record<ButtonName, number>;
const zeroValues = (): ButtonValues => Object.fromEntries(BUTTONS.map((b) => [b, 0])) as ButtonValues;

/**
 * Gamepad API wrapper. Call `poll()` once per rendered frame, then draw sim inputs
 * with `takeStepInput()` (once per sim step). Edges are queued so a press is never
 * lost on a frame that runs zero sim steps.
 *
 * `start` and `select` are reserved by the shell and always read false in the
 * InputState a prototype receives. Use `frame` for shell-level reads.
 */
export class InputManager {
  shape: StickShape = { deadzone: 0.15, curve: 1 };

  /** Raw (unmasked) current values for the shell: held map and stick vectors. */
  readonly frame = {
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
    down: zeroValues(),
    /** Edges seen by the latest poll only. */
    pressed: new Set<ButtonName>(),
    released: new Set<ButtonName>(),
    gyro: { x: 0, y: 0, z: 0 },
    connected: false,
  };

  /** performance.now() of the most recent press edge, for latency measurement. */
  lastPressAt = -1;
  /** Last time any button/stick activity was seen (ms). */
  lastActivityAt = 0;

  private prevDown = zeroValues();
  private pendingPressed = new Set<ButtonName>();
  private pendingReleased = new Set<ButtonName>();
  private injected: Partial<{ left: Partial<{ x: number; y: number }>; right: Partial<{ x: number; y: number }>; hold: ButtonName[] }> | null = null;
  private keys = new Set<string>();
  /** Keys pressed since the last poll, so a tap shorter than one frame is never lost. */
  private tapped = new Set<string>();
  private prevPadDown = zeroValues();
  /** Button values for the NEXT edge comparison: held keys and pad only. A tap that already ended counts as released. */
  private heldNow = zeroValues();
  private listening = false;

  private readonly keyboard: boolean;

  constructor(keyboard = true) {
    this.keyboard = keyboard;
  }

  /** Attach keyboard fallback listeners (debug only). */
  attach(target: Window = window): void {
    if (this.listening || !this.keyboard) return;
    this.listening = true;
    target.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return; // a text box keeps its own keys (e.g. the jukebox note field)
      if (KEY_BUTTONS[e.code] || KEY_STICK[e.code]) e.preventDefault();
      this.keys.add(e.code);
      this.tapped.add(e.code);
      setDevice('keyboard');
    });
    target.addEventListener('keyup', (e) => {
      if (!isTypingTarget(e.target)) this.keys.delete(e.code);
    });
    target.addEventListener('blur', () => this.keys.clear());
  }

  /** Bots in real-time runs inject here; pass null to stop. Same path as a real pad after this point. */
  inject(input: InputManager['injected']): void {
    this.injected = input;
  }

  /** Read hardware, update `frame`, and queue edges for sim steps. */
  poll(now: number = performance.now()): void {
    const down = zeroValues();
    let lx = 0, ly = 0, rx = 0, ry = 0;
    let connected = false;

    const padDown = zeroValues();
    let padStick = 0;
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      connected = true;
      for (let i = 0; i < PAD_BUTTONS.length; i++) {
        const b = pad.buttons[i];
        if (!b) continue;
        const name = PAD_BUTTONS[i]!;
        const v = b.value > 0 ? b.value : b.pressed ? 1 : 0;
        down[name] = Math.max(down[name], v);
        padDown[name] = Math.max(padDown[name], v);
      }
      padStick = Math.max(Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0), Math.hypot(pad.axes[2] ?? 0, pad.axes[3] ?? 0));
      lx += pad.axes[0] ?? 0;
      ly += pad.axes[1] ?? 0;
      rx += pad.axes[2] ?? 0;
      ry += pad.axes[3] ?? 0;
      break; // first connected pad only
    }

    // The gamepad wins the "last used device" label when a pad button goes down or a stick is pushed.
    if (padStick > 0.6 || BUTTONS.some((b) => padDown[b] > 0.5 && this.prevPadDown[b] <= 0.5)) setDevice('gamepad');
    this.prevPadDown = padDown;

    const heldValues = { ...down };
    for (const code of this.keys) {
      const hb = KEY_BUTTONS[code];
      if (hb) heldValues[hb] = 1;
    }
    for (const code of new Set([...this.keys, ...this.tapped])) {
      const btn = KEY_BUTTONS[code];
      if (btn) down[btn] = 1;
      const s = KEY_STICK[code];
      if (s) {
        lx += s[0];
        ly += s[1];
      }
    }

    if (this.injected) {
      lx += this.injected.left?.x ?? 0;
      ly += this.injected.left?.y ?? 0;
      rx += this.injected.right?.x ?? 0;
      ry += this.injected.right?.y ?? 0;
      for (const b of this.injected.hold ?? []) { down[b] = 1; heldValues[b] = 1; }
    }

    this.tapped.clear();

    // D-pad doubles as left stick when the stick is idle.
    const l = shapeStick(clampAxis(lx), clampAxis(ly), this.shape);
    const r = shapeStick(clampAxis(rx), clampAxis(ry), this.shape);
    if (l.x === 0 && l.y === 0) {
      l.x = down.right > 0.5 ? 1 : down.left > 0.5 ? -1 : 0;
      l.y = down.down > 0.5 ? 1 : down.up > 0.5 ? -1 : 0;
      if (l.x !== 0 && l.y !== 0) {
        l.x *= Math.SQRT1_2;
        l.y *= Math.SQRT1_2;
      }
    }

    this.frame.pressed.clear();
    this.frame.released.clear();
    for (const name of BUTTONS) {
      const was = this.prevDown[name] > 0.5;
      const is = down[name] > 0.5;
      if (is && !was) {
        this.frame.pressed.add(name);
        this.pendingPressed.add(name);
        this.lastPressAt = now;
      } else if (!is && was) {
        this.frame.released.add(name);
        this.pendingReleased.add(name);
      }
    }
    if (this.frame.pressed.size > 0 || l.x !== 0 || l.y !== 0) this.lastActivityAt = now;

    this.heldNow = heldValues;
    this.prevDown = this.heldNow;
    this.frame.down = down;
    this.frame.left = l;
    this.frame.right = r;
    this.frame.connected = connected;
  }

  /** True if a button is held right now (raw, includes select/start). */
  isDown(name: ButtonName): boolean {
    return this.frame.down[name] > 0.5;
  }

  /** True if `name` went down in the latest poll (shell-level, unmasked). */
  justPressed(name: ButtonName): boolean {
    return this.frame.pressed.has(name);
  }

  /**
   * Build the InputState for ONE sim step and clear queued edges.
   * Call once per step; only the first step after a poll sees edges.
   */
  takeStepInput(): InputState {
    const s = blankInput();
    s.left = { ...this.frame.left };
    s.right = { ...this.frame.right };
    s.gyro = { ...this.frame.gyro };
    const selectHeld = this.frame.down.select > 0.5;
    for (const name of BUTTONS) {
      const st = s.buttons[name];
      const reserved = name === 'start' || name === 'select' || (name === 'a' && selectHeld);
      if (reserved) continue;
      st.value = this.frame.down[name];
      st.down = st.value > 0.5;
      st.pressed = this.pendingPressed.has(name);
      st.released = this.pendingReleased.has(name);
    }
    this.pendingPressed.clear();
    this.pendingReleased.clear();
    return s;
  }

  /** Drop queued edges (after pause/resume or restart). */
  flush(): void {
    this.pendingPressed.clear();
    this.pendingReleased.clear();
  }
}

function clampAxis(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}
