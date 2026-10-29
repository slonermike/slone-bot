import { BUTTONS } from './types.ts';
import type { BotInput, ButtonName, ButtonState, InputState, Vec2 } from './types.ts';

export function blankButton(): ButtonState {
  return { down: false, pressed: false, released: false, value: 0 };
}

/** A fresh all-zero InputState. */
export function blankInput(): InputState {
  const buttons = {} as Record<ButtonName, ButtonState>;
  for (const b of BUTTONS) buttons[b] = blankButton();
  return { left: { x: 0, y: 0 }, right: { x: 0, y: 0 }, buttons, gyro: { x: 0, y: 0, z: 0 } };
}

export interface StickShape {
  /** Radial dead zone, 0..1. Default 0.15. */
  deadzone?: number;
  /** Response exponent; 1 = linear, 2 = fine control near center. Default 1. */
  curve?: number;
}

/** Radial dead zone with rescale, optional response curve, clamped to the unit circle. */
export function shapeStick(x: number, y: number, shape: StickShape = {}): Vec2 {
  const dz = shape.deadzone ?? 0.15;
  const curve = shape.curve ?? 1;
  const mag = Math.hypot(x, y);
  if (mag <= dz || mag === 0) return { x: 0, y: 0 };
  const scaled = Math.min(1, (mag - dz) / (1 - dz));
  const out = Math.pow(scaled, curve);
  return { x: (x / mag) * out, y: (y / mag) * out };
}

/**
 * Expand a bot's compact BotInput into a full InputState, deriving press/release
 * edges from the previous step's held set. Mutates and returns `heldNow`.
 */
export function expandBotInput(
  bot: BotInput,
  prevHeld: ReadonlySet<ButtonName>,
  heldOut: Set<ButtonName>,
): InputState {
  const s = blankInput();
  s.left = { x: clamp1(bot.left?.x ?? 0), y: clamp1(bot.left?.y ?? 0) };
  s.right = { x: clamp1(bot.right?.x ?? 0), y: clamp1(bot.right?.y ?? 0) };
  heldOut.clear();
  for (const b of bot.hold ?? []) heldOut.add(b);
  if ((bot.lt ?? 0) > 0.5) heldOut.add('lt');
  if ((bot.rt ?? 0) > 0.5) heldOut.add('rt');
  for (const name of BUTTONS) {
    const down = heldOut.has(name);
    const was = prevHeld.has(name);
    const st = s.buttons[name];
    st.down = down;
    st.pressed = down && !was;
    st.released = !down && was;
    st.value = down ? 1 : 0;
  }
  if (bot.lt !== undefined) s.buttons.lt.value = clamp01(bot.lt);
  if (bot.rt !== undefined) s.buttons.rt.value = clamp01(bot.rt);
  return s;
}

function clamp1(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Jump-buffer style helper, in SIM STEPS (deterministic). Call `press()` on the
 * button edge, `step()` once per sim step, and `consume()` when the action becomes possible.
 */
export class InputBuffer {
  private remaining = 0;
  readonly windowSteps: number;
  constructor(windowSteps = 6) {
    this.windowSteps = windowSteps;
  }
  press(): void {
    this.remaining = this.windowSteps;
  }
  step(): void {
    if (this.remaining > 0) this.remaining--;
  }
  /** True once if a press happened within the window; clears it. */
  consume(): boolean {
    if (this.remaining > 0) {
      this.remaining = 0;
      return true;
    }
    return false;
  }
  get pending(): boolean {
    return this.remaining > 0;
  }
}

/** Coyote-time helper, in SIM STEPS. Call `ground()` each step you are supported. */
export class Coyote {
  private remaining = 0;
  readonly windowSteps: number;
  constructor(windowSteps = 6) {
    this.windowSteps = windowSteps;
  }
  ground(): void {
    this.remaining = this.windowSteps;
  }
  step(): void {
    if (this.remaining > 0) this.remaining--;
  }
  get active(): boolean {
    return this.remaining > 0;
  }
  /** Spend the grace window (e.g. when the jump fires). */
  use(): void {
    this.remaining = 0;
  }
}
