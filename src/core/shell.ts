import { Application, Container } from 'pixi.js';
import { audio } from '../audio/audio.ts';
import { emptyTelemetry } from '../bots/telemetry.ts';
import type { Telemetry } from '../bots/telemetry.ts';
import { dial } from '../juice/dial.ts';
import { fxStats, registerHitStop, resetFxStats, trauma } from '../juice/fx.ts';
import { setVfxRandom } from '../juice/random.ts';
import { tweens } from '../juice/tween.ts';
import { DebugOverlay } from './debug.ts';
import { recordPlayTime } from './history.ts';
import { InputManager } from './input.ts';
import { DT, FixedStepper } from './loop.ts';
import { PauseMenu } from './menu.ts';
import { Nav } from './nav.ts';
import { expandBotInput } from './input-state.ts';
import { Rng } from './rng.ts';
import { track } from './track.ts';
import { injectStyle, SHELL_CSS } from './ui-style.ts';
import type { Bot, BotInput, ButtonName, Ctx, Prototype, PrototypeModule, SimEvent, View } from './types.ts';

export const WIDTH = 1280;
export const HEIGHT = 800;
const COMBO_HOLD_MS = 500;

export type ShellState = 'title' | 'playing' | 'paused';

export interface Scaffold {
  readonly version: 1;
  proto: Prototype;
  input: InputManager;
  stepper: FixedStepper;
  state(): ShellState;
  /** Telemetry snapshot for the current real-time session (perf, feel, metrics). */
  snapshot(bot?: string): Telemetry;
  restart(): void;
  start(): void;
  setPaused(p: boolean): void;
  /** Drive the prototype with a bot in real time (1x). Pass null to stop. */
  attachBot(bot: Bot | null): void;
  /** Plain data for the smoke test and debug tools. */
  stats(): {
    frames: number;
    simSteps: number;
    fps: number;
    avgFrameMs: number;
    p95FrameMs: number;
    gamepad: boolean;
    audioCalls: number;
    leaving: boolean;
  };
  audioLog: typeof audio.log;
}

declare global {
  interface Window {
    __scaffold?: Scaffold;
  }
}

/** Where "return to launcher" goes: the site root, computed relatively so any hosting subfolder works. */
export function launcherUrl(loc: Location = location): string {
  const path = loc.pathname;
  const i = path.lastIndexOf('/p/');
  const base = i >= 0 ? path.slice(0, i + 1) : '/';
  return loc.origin + base;
}

export function parseParams(search: string = location.search): Record<string, string> {
  const out: Record<string, string> = {};
  new URLSearchParams(search).forEach((v, k) => (out[k] = v));
  return out;
}

/** Boot a prototype inside the shell. Called by the generated entry (src/core/shell/main.ts). */
export async function startPrototype(mod: PrototypeModule): Promise<Scaffold> {
  injectStyle(SHELL_CSS, 'mgb-shell-css');
  const params = parseParams();
  const fixedSeed = params.seed !== undefined && params.seed !== '';
  let seed = fixedSeed ? Number(params.seed) >>> 0 : ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) % 1000000;

  dial.load();
  dial.applyParams(params);

  const host = document.getElementById('app') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }));
  const app = new Application();
  await app.init({
    width: WIDTH,
    height: HEIGHT,
    background: 0x101018,
    antialias: true,
    resolution: 1,
    autoDensity: false,
    powerPreference: 'high-performance',
  });
  app.ticker.stop(); // we drive the frame ourselves
  host.appendChild(app.canvas);

  const fit = () => {
    const s = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    app.canvas.style.width = `${Math.floor(WIDTH * s)}px`;
    app.canvas.style.height = `${Math.floor(HEIGHT * s)}px`;
  };
  fit();
  window.addEventListener('resize', fit);

  const world = new Container();
  world.pivot.set(WIDTH / 2, HEIGHT / 2);
  world.position.set(WIDTH / 2, HEIGHT / 2);
  const ui = new Container();
  app.stage.addChild(world, ui);

  const input = new InputManager();
  input.attach();
  const nav = new Nav();
  const stepper = new FixedStepper();
  registerHitStop((n) => stepper.hitStop(n));

  // ---- per-session state ----
  let proto!: Prototype;
  let ctx!: Ctx;
  let simSteps = 0;
  let state: ShellState = 'title';
  let events: SimEvent[] = [];
  const eventCounts: Record<string, number> = {};
  const frameCallbacks = new Set<(dt: number) => void>();
  const frameInfo = { dt: 0, time: 0 };
  const view: View = {
    app, world, ui, width: WIDTH, height: HEIGHT, frame: frameInfo,
    onFrame(fn) {
      frameCallbacks.add(fn);
      return () => frameCallbacks.delete(fn);
    },
  };

  const frameTimes: number[] = [];
  let frames = 0;
  let lastNow = performance.now();
  let stepsThisFrame = 0;
  let playMs = 0;
  let flushedMs = 0;
  let botAttached: Bot | null = null;
  let botHeld = new Set<ButtonName>();
  let botTick = 0;
  let leaving = false;
  let comboStart = -1;
  const latency = { visual: 0, audio: 0, pendingFrom: -1, audioDone: true };
  const returnBadge = Object.assign(document.createElement('div'), { className: 'mgb-return', textContent: 'Returning to launcher…' });
  returnBadge.style.display = 'none';
  document.body.appendChild(returnBadge);

  const build = () => {
    proto = mod.createPrototype();
    const rng = new Rng(seed);
    const vfxRng = new Rng(seed ^ 0xa5a5a5a5);
    simSteps = 0;
    ctx = {
      seed,
      dt: DT,
      rng,
      vfxRng,
      time: { get steps() { return simSteps; }, get seconds() { return simSteps * DT; } },
      params,
    };
    setVfxRandom(() => vfxRng.next());
    audio.setRandom(() => vfxRng.next());
    proto.init(ctx);
    proto.mount?.(view);
    stepper.reset();
    events = [];
    for (const k of Object.keys(eventCounts)) delete eventCounts[k];
    resetFxStats();
    audio.resetStats();
    track('session_start', { seed });
  };

  const teardown = () => {
    try { proto.dispose?.(); } catch { /* ignore */ }
    frameCallbacks.clear();
    tweens.clear();
    for (const c of [...world.children]) c.destroy({ children: true });
    for (const c of [...ui.children]) c.destroy({ children: true });
    world.position.set(WIDTH / 2, HEIGHT / 2);
    world.rotation = 0;
  };

  const restart = () => {
    track('restart', { simSteps });
    teardown();
    if (!fixedSeed) seed = (seed + 1) % 1000000;
    build();
    input.flush();
    setPaused(false);
  };

  const flushPlayTime = () => {
    const slug = proto?.meta?.slug;
    if (!slug) return;
    recordPlayTime(slug, playMs - flushedMs);
    flushedMs = playMs;
  };

  const goToLauncher = (hash = '') => {
    if (leaving) return;
    leaving = true;
    track('session_end', { simSeconds: Math.round(simSteps * DT), reason: 'launcher' });
    flushPlayTime();
    returnBadge.style.display = 'block';
    location.href = launcherUrl() + hash;
  };

  function setPaused(p: boolean) {
    if (state === 'title') return;
    state = p ? 'paused' : 'playing';
    if (p) menu.show();
    else {
      menu.hide();
      input.flush();
      nav.reset();
    }
  }

  const menu = new PauseMenu({
    resume: () => setPaused(false),
    restart,
    toLauncher: () => goToLauncher(),
    toFeedback: () => goToLauncher(`#feedback=${encodeURIComponent(proto.meta.slug)}`),
  });
  const debug = new DebugOverlay();
  if (params.debug === '1') debug.toggle();

  build();

  // ---- title screen ----
  const titleEl = document.createElement('div');
  titleEl.className = 'mgb-overlay mgb-title';
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  titleEl.innerHTML = `<h1>${esc(proto.meta.title)}</h1><p>${esc(proto.meta.question)}</p><p class="feel">${esc(proto.meta.targetFeeling)}</p><div class="go">PRESS A TO START</div>`;
  document.body.appendChild(titleEl);

  const start = () => {
    if (state !== 'title') return;
    state = 'playing';
    titleEl.style.display = 'none';
    void audio.unlock();
    audio.play('ui-select');
    input.flush();
  };
  if (params.autostart === '1') start();

  // user gestures that unlock audio even before a gamepad press registers
  window.addEventListener('pointerdown', () => void audio.unlock());
  window.addEventListener('keydown', () => void audio.unlock());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      flushPlayTime();
      if (state === 'playing') setPaused(true);
    }
  });
  window.addEventListener('pagehide', flushPlayTime);

  // latency probes: measured from the scaffold's poll, so it excludes display/hardware latency.
  audio.onPlay = (_name, at) => {
    if (!latency.audioDone && latency.pendingFrom >= 0 && at - latency.pendingFrom < 500) {
      latency.audio = at - latency.pendingFrom;
      latency.audioDone = true;
    }
  };

  // ---- the frame ----
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const rawMs = now - lastNow;
    lastNow = now;
    const dtSec = Math.min(rawMs / 1000, 0.1);
    frameInfo.dt = dtSec;
    frameInfo.time += dtSec;
    frames++;
    frameTimes.push(rawMs);
    if (frameTimes.length > 300) frameTimes.shift();

    input.poll(now);
    if (botAttached) {
      const bi = botAttached.act((proto.getState?.() as never) ?? proto.telemetry(), botTick++);
      const held = new Set<ButtonName>();
      expandBotInput(bi, botHeld, held);
      botHeld = held;
      input.inject({ left: bi.left, right: bi.right, hold: [...held] });
    }

    // shell-level input (reserved): pause, debug, return combo
    if (state === 'title') {
      if (input.justPressed('a') || input.justPressed('start')) start();
    } else {
      const f = input.frame;
      if (f.down.select > 0.5 && f.down.start > 0.5) {
        if (comboStart < 0) comboStart = now;
        else if (now - comboStart >= COMBO_HOLD_MS) goToLauncher();
        returnBadge.style.display = now - comboStart > 120 ? 'block' : 'none';
      } else {
        comboStart = -1;
        if (!leaving) returnBadge.style.display = 'none';
        if (input.justPressed('start') && f.down.select < 0.5) setPaused(state !== 'paused');
        if (input.justPressed('a') && f.down.select > 0.5) debug.toggle();
      }
      if (state === 'paused') menu.handle(nav.read(input, now).filter((a) => a !== 'start' && a !== 'select'));
    }

    // sim
    stepsThisFrame = 0;
    if (state === 'playing') {
      playMs += rawMs > 250 ? 0 : rawMs;
      if (playMs - flushedMs > 10000) flushPlayTime();
      if (input.frame.pressed.size > 0) {
        latency.pendingFrom = input.lastPressAt;
        latency.audioDone = false;
      }
      const adv = stepper.advance(dtSec);
      for (let i = 0; i < adv.steps; i++) {
        proto.step(DT, input.takeStepInput());
        simSteps++;
        stepsThisFrame++;
        for (const e of proto.events()) {
          events.push(e);
          track('sim_event', { type: e.type });
        }
      }
      for (const e of events) {
        eventCounts[e.type] = (eventCounts[e.type] ?? 0) + 1;
        proto.onEvent(e);
      }
      events.length = 0;
      trauma.update(dtSec);
      tweens.update(dtSec * 1000);
      for (const fn of frameCallbacks) fn(dtSec);
      const off = trauma.sample(frameInfo.time);
      world.position.set(WIDTH / 2 + off.x, HEIGHT / 2 + off.y);
      world.rotation = off.rot;
      proto.render(adv.alpha);
    } else if (state === 'paused') {
      proto.render(1);
    } else {
      proto.render(1);
    }
    app.render();
    if (latency.pendingFrom >= 0 && stepsThisFrame > 0) {
      latency.visual = performance.now() - latency.pendingFrom;
      latency.pendingFrom = latency.audioDone ? -1 : latency.pendingFrom;
    }
    debug.update(debugData(), now);
  };

  const sortedFrames = () => [...frameTimes].sort((a, b) => a - b);
  const perf = () => {
    const sorted = sortedFrames();
    const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]! : 0;
    return { avg, p95, fps: avg > 0 ? 1000 / avg : 0 };
  };
  const debugData = () => {
    const p = perf();
    return {
      fps: p.fps, frameAvgMs: p.avg, frameP95Ms: p.p95, stepsPerFrame: stepsThisFrame,
      inputToVisualMs: latency.visual, inputToAudioMs: latency.audio, events: eventCounts,
      particles: fxStats.particleMax, layers: dial.activeLayers(), intensity: dial.intensity,
      seed, simSeconds: simSteps * DT, gamepad: input.frame.connected,
    };
  };

  const scaffold: Scaffold = {
    version: 1,
    get proto() { return proto; },
    input,
    stepper,
    state: () => state,
    snapshot(bot = 'realtime') {
      const p = perf();
      const t = emptyTelemetry({
        night: proto.meta.slug, seed, bot, mode: proto.meta.mode, simSeconds: Math.round(simSteps * DT * 100) / 100,
        timescale: 1, outcome: 'timeout',
      });
      for (const [k, v] of Object.entries(proto.telemetry())) t.metrics[k] = Number.isFinite(v) ? v : 0;
      if (!('runLength' in proto.telemetry())) t.metrics.runLength = t.simSeconds;
      t.perf = { avgFrameMs: round2(p.avg), p95FrameMs: round2(p.p95), fps: round2(p.fps), particleMax: fxStats.particleMax, effectsOn: dial.activeLayers().length > 0 };
      t.feel = {
        inputToVisualMs: round2(latency.visual), inputToAudioMs: round2(latency.audio), eventsFired: { ...eventCounts },
        shakePeak: round2(fxStats.shakePeak), hitStopFrames: fxStats.hitStopFrames,
      };
      return t;
    },
    restart,
    start,
    setPaused,
    attachBot(b) {
      botAttached = b;
      botTick = 0;
      botHeld = new Set();
      if (b) b.reset(seed);
      else input.inject(null);
    },
    stats() {
      const p = perf();
      return { frames, simSteps, fps: p.fps, avgFrameMs: p.avg, p95FrameMs: p.p95, gamepad: input.frame.connected, audioCalls: audio.log.length, leaving };
    },
    audioLog: audio.log,
  };
  window.__scaffold = scaffold;
  requestAnimationFrame((t) => {
    lastNow = t;
    requestAnimationFrame(frame);
  });
  return scaffold;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export type { BotInput };
