// Hard-edged particles for Unjam's look: every particle is a flat triangle shard (no soft circles, no glow).
// Same call shape as the scaffold's Particles so the event code reads the same: emit(preset, x, y, opts) and update(dt).
import { Particle, ParticleContainer, Texture } from 'pixi.js';
import type { Container } from 'pixi.js';
import { dial } from '../../juice/dial.ts';
import { fxStats } from '../../juice/fx.ts';
import { vfx, vfxRange } from '../../juice/random.ts';

export type ShardPreset = 'puff' | 'debris' | 'confetti' | 'sparks' | 'dust';

export interface ShardOptions {
  count?: number;
  color?: number;
  speed?: number;
  size?: number;
  angle?: number;
  spread?: number;
}

interface Def {
  count: number;
  speed: [number, number];
  life: [number, number];
  size: [number, number];
  gravity: number;
  drag: number;
  grow: number;
  alpha: number;
  spin: number;
  stretch?: number;
  colors?: number[];
}

/** The sunset palette (kept in sync with PAL in index.ts): violet, magenta, orange, gold. */
const CONFETTI = [0xe83f7a, 0xff8a3d, 0xffd36e, 0x9b4fd0];

const PRESETS: Record<ShardPreset, Def> = {
  puff: { count: 8, speed: [30, 120], life: [0.35, 0.7], size: [0.6, 1.1], gravity: -40, drag: 2.5, grow: 1.7, alpha: 0.55, spin: 3 },
  debris: { count: 10, speed: [120, 380], life: [0.4, 0.9], size: [0.3, 0.55], gravity: 900, drag: 0.4, grow: 0.5, alpha: 1, spin: 12 },
  confetti: { count: 24, speed: [150, 520], life: [0.9, 1.6], size: [0.25, 0.45], gravity: 320, drag: 1.6, grow: 1, alpha: 1, spin: 14, colors: CONFETTI },
  sparks: { count: 12, speed: [220, 620], life: [0.15, 0.4], size: [0.15, 0.25], gravity: 300, drag: 3, grow: 0.2, alpha: 1, spin: 0, stretch: 3.2 },
  dust: { count: 5, speed: [10, 60], life: [0.4, 0.9], size: [0.25, 0.5], gravity: -10, drag: 2, grow: 1.3, alpha: 0.4, spin: 2 },
};

let tex: Texture | null = null;
function shardTexture(): Texture {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(60, 32);
  g.lineTo(6, 8);
  g.lineTo(18, 32);
  g.lineTo(6, 56);
  g.closePath();
  g.fill();
  tex = Texture.from(c);
  return tex;
}

interface PState { p: Particle; vx: number; vy: number; life: number; max: number; gravity: number; drag: number; spin: number; s0: number; s1: number; a0: number }

export class Shards {
  readonly container: ParticleContainer;
  private live: PState[] = [];
  maxTotal = 600;
  maxPerEmit = 64;

  constructor(parent: Container) {
    this.container = new ParticleContainer({
      texture: shardTexture(),
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true },
    });
    parent.addChild(this.container);
  }

  emit(preset: ShardPreset, x: number, y: number, opts: ShardOptions = {}): void {
    const def = PRESETS[preset];
    const wanted = Math.round((opts.count ?? def.count) * dial.scale('particles', 1));
    const n = Math.min(wanted, this.maxPerEmit, this.maxTotal - this.live.length);
    for (let i = 0; i < n; i++) {
      const ang = opts.angle === undefined ? vfx() * Math.PI * 2 : opts.angle + (vfx() * 2 - 1) * (opts.spread ?? Math.PI / 3);
      const sp = vfxRange(def.speed[0], def.speed[1]) * (opts.speed ?? 1);
      const size = vfxRange(def.size[0], def.size[1]) * (opts.size ?? 1);
      const color = opts.color ?? (def.colors ? def.colors[Math.floor(vfx() * def.colors.length)]! : 0xffd36e);
      const p = new Particle({
        texture: shardTexture(), x, y, anchorX: 0.5, anchorY: 0.5,
        scaleX: size * (def.stretch ?? 1), scaleY: size,
        rotation: def.stretch ? ang : vfx() * Math.PI * 2, tint: color, alpha: def.alpha,
      });
      const life = vfxRange(def.life[0], def.life[1]);
      this.live.push({ p, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life, max: life, gravity: def.gravity, drag: def.drag, spin: def.spin * (vfx() * 2 - 1), s0: size, s1: size * def.grow, a0: def.alpha });
      this.container.addParticle(p);
    }
    fxStats.particleMax = Math.max(fxStats.particleMax, this.live.length);
  }

  update(dt: number): void {
    const step = Math.min(dt, 1 / 30);
    const live = this.live;
    for (let i = live.length - 1; i >= 0; i--) {
      const s = live[i]!;
      s.life -= step;
      if (s.life <= 0) {
        this.container.removeParticle(s.p);
        live[i] = live[live.length - 1]!;
        live.pop();
        continue;
      }
      const k = 1 - s.life / s.max;
      s.vy += s.gravity * step;
      const damp = Math.exp(-s.drag * step);
      s.vx *= damp;
      s.vy *= damp;
      s.p.x += s.vx * step;
      s.p.y += s.vy * step;
      s.p.rotation += s.spin * step;
      const sc = s.s0 + (s.s1 - s.s0) * k;
      const stretch = s.p.scaleX / Math.max(0.0001, s.p.scaleY);
      s.p.scaleY = sc;
      s.p.scaleX = sc * (Number.isFinite(stretch) ? Math.min(stretch, 3.5) : 1);
      s.p.alpha = s.a0 * (1 - k * k);
    }
  }
}
