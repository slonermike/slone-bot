import type { Rng } from './rng.ts';

/** Names for every button on a standard-mapping gamepad. */
export const BUTTONS = [
  'a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt',
  'select', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right',
] as const;
export type ButtonName = (typeof BUTTONS)[number];

export interface ButtonState {
  /** Held this step. */
  down: boolean;
  /** Went down since the previous sim step (true for exactly one step). */
  pressed: boolean;
  /** Went up since the previous sim step. */
  released: boolean;
  /** Analog value 0..1 (triggers); 0 or 1 for digital buttons. */
  value: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

/** What `step()` receives. Plain data, safe to build in a bot. */
export interface InputState {
  /** Left stick after dead zone and shaping, each axis -1..1, y positive = down. */
  left: Vec2;
  right: Vec2;
  buttons: Record<ButtonName, ButtonState>;
  /** Optional gyro via Steam Input; zeros when unavailable. */
  gyro: { x: number; y: number; z: number };
}

/** Compact form a bot returns; the runner expands it to a full InputState. */
export interface BotInput {
  left?: Partial<Vec2>;
  right?: Partial<Vec2>;
  /** Buttons held this step. Edges are derived by the runner. */
  hold?: ButtonName[];
  /** Analog trigger values (also marks lt/rt held above 0.5). */
  lt?: number;
  rt?: number;
}

export interface SimEvent {
  type: string;
  /** Impact strength, 0..1 by convention. Scale juice with it. */
  magnitude?: number;
  x?: number;
  y?: number;
  data?: Record<string, number | string | boolean>;
}

export interface PrototypeMeta {
  slug: string;
  title: string;
  question: string;
  targetFeeling: string;
  mode: 'content' | 'systemic';
}

export interface SimTime {
  /** Sim steps executed so far. */
  readonly steps: number;
  /** Sim seconds (steps * DT). Sim code uses this, never wall time. */
  readonly seconds: number;
}

/** One tweakable balance value, shown in the pause menu's Balance screen. */
export interface BalanceSpec {
  /** Stable id (saved values are keyed by it). */
  id: string;
  /** Plain-language label. */
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** Shown after the value, e.g. "s" or "x". */
  unit?: string;
}

/** Everything sim code may touch. No rendering, DOM, audio, or Math.random. */
export interface Ctx {
  readonly seed: number;
  readonly dt: number;
  readonly rng: Rng;
  /** Visual-only randomness. Never use in sim code. */
  readonly vfxRng: Rng;
  readonly time: SimTime;
  /** URL query params (or {} in sim-only runs), for prototype-level toggles. */
  readonly params: Readonly<Record<string, string>>;
  /** Live balance values (id -> number). Read them every step so menu changes apply immediately; fall back to the spec default when a key is missing. */
  readonly balance: Record<string, number>;
}

export interface Prototype {
  meta: PrototypeMeta;
  /** The 3 to 8 tweakable balance values this build exposes in the pause menu. */
  balance?: BalanceSpec[];
  /** Create sim state. No drawing here. */
  init(ctx: Ctx): void;
  /** ONE fixed sim step. Pure logic: no Pixi, DOM, audio, or Math.random. */
  step(dt: number, input: InputState): void;
  /** Drained every frame. */
  events(): SimEvent[];
  /** Called once after init when a renderer exists (not in sim-only runs). Build display objects here. */
  mount?(view: View): void;
  render(alpha: number): void;
  /** Juice and audio fire here, driven by sim events. */
  onEvent(e: SimEvent): void;
  telemetry(): Record<string, number>;
  getState?(): unknown;
  /** Remove listeners/timers when the shell restarts or leaves. */
  dispose?(): void;
}

/** What a prototype's index.ts exports. */
export interface PrototypeModule {
  createPrototype: () => Prototype;
  /** Prototype-specific bots (greedy, degenerate probe). Idle and random are built in. */
  bots?: Bot[];
}

export interface Observation {
  /** Whatever the prototype exposes via getState() (or telemetry() when absent). Keep it small and numeric. */
  [key: string]: unknown;
}

export interface Bot {
  name: string;
  reset(seed: number): void;
  act(obs: Observation, tick: number): BotInput;
}

/** Handed to mount(). Typed loosely here to keep sim files free of Pixi imports. */
export interface View {
  /** Pixi Application (typed `unknown` in this file to keep sim imports Pixi-free; cast to `Application`). */
  app: unknown;
  /** Layer that shakes with the camera. Put game objects here. */
  world: unknown;
  /** Layer that never shakes. HUD goes here. */
  ui: unknown;
  readonly width: number;
  readonly height: number;
  /** Real-time frame info, updated by the shell before render(): dt in seconds, time in seconds since start. */
  readonly frame: { dt: number; time: number };
  /** Register a per-render-frame callback (particles.update, eyes.update...). Returns an unsubscribe. */
  onFrame(fn: (dtSeconds: number) => void): () => void;
}

export type TelemetryOutcome = 'completed' | 'failed' | 'timeout' | 'crash';
