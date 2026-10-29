export interface DebugData {
  fps: number;
  frameAvgMs: number;
  frameP95Ms: number;
  stepsPerFrame: number;
  inputToVisualMs: number;
  inputToAudioMs: number;
  events: Record<string, number>;
  particles: number;
  layers: string[];
  intensity: number;
  seed: number;
  simSeconds: number;
  gamepad: boolean;
  /** Which controller the browser sees, for diagnosing Steam Input (empty when none). */
  padId?: string;
}

/** Plain-DOM debug overlay. Toggle with Select + A. */
export class DebugOverlay {
  readonly el = document.createElement('pre');
  visible = false;
  private last = 0;

  constructor() {
    this.el.className = 'mgb-debug';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
  }

  update(d: DebugData, now: number): void {
    if (!this.visible || now - this.last < 250) return;
    this.last = now;
    const ev = Object.entries(d.events).map(([k, v]) => `${k}:${v}`).join(' ') || '-';
    this.el.textContent =
      `fps ${d.fps.toFixed(0)}  frame ${d.frameAvgMs.toFixed(1)}ms (p95 ${d.frameP95Ms.toFixed(1)})  steps/frame ${d.stepsPerFrame}\n` +
      `input->visual ${d.inputToVisualMs.toFixed(1)}ms  input->audio ${d.inputToAudioMs.toFixed(1)}ms\n` +
      `sim ${d.simSeconds.toFixed(1)}s  seed ${d.seed}  pad ${d.gamepad ? 'yes' : 'NO'}${d.padId ? ` (${d.padId.slice(0, 48)})` : ''}  particles ${d.particles}\n` +
      `events ${ev}\n` +
      `juice x${d.intensity.toFixed(1)}: ${d.layers.join(',') || 'all off'}`;
  }
}
