import { Particle, ParticleContainer, Texture } from 'pixi.js';
import type { Container } from 'pixi.js';
import { dial } from './dial.ts';
import { fxStats } from './fx.ts';
import { vfx, vfxRange } from './random.ts';

export type ParticlePreset = 'puff' | 'debris' | 'confetti' | 'sparks' | 'dust';

/** Particle look: soft discs (default), hard triangular shards, hard squares, or any texture you bake. */
export type ParticleShape = 'circle' | 'shard' | 'square';

export interface ParticlesOptions {
  shape?: ParticleShape | Texture;
  /** Replaces the default confetti colors (use the game's palette). */
  confettiColors?: number[];
}

export interface EmitOptions {
  count?: number;
  color?: number;
  /** Multiplies preset speed. */
  speed?: number;
  /** Multiplies preset size. */
  size?: number;
  /** Emission direction in radians; omit for all directions. */
  angle?: number;
  /** Half-angle of the cone around `angle`. Default PI/3. */
  spread?: number;
}

interface PState {
  p: Particle;
  vx: number;
  vy: number;
  life: number;
  max: number;
  gravity: number;
  drag: number;
  spin: number;
  s0: number;
  s1: number;
  a0: number;
}

interface PresetDef {
  count: number;
  speed: [number, number];
  life: [number, number];
  size: [number, number];
  gravity: number;
  drag: number;
  grow: number;
  alpha: number;
  spin: number;
  colors?: number[];
  stretch?: number;
}

const PRESETS: Record<ParticlePreset, PresetDef> = {
  puff: { count: 8, speed: [30, 120], life: [0.35, 0.7], size: [0.5, 0.9], gravity: -40, drag: 2.5, grow: 1.8, alpha: 0.6, spin: 0 },
  debris: { count: 10, speed: [120, 380], life: [0.4, 0.9], size: [0.2, 0.4], gravity: 900, drag: 0.4, grow: 0.6, alpha: 1, spin: 12 },
  confetti: { count: 24, speed: [150, 520], life: [0.9, 1.6], size: [0.18, 0.3], gravity: 320, drag: 1.6, grow: 1, alpha: 1, spin: 14, colors: [0xff5d73, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xb388ff], stretch: 2 },
  sparks: { count: 12, speed: [220, 620], life: [0.15, 0.4], size: [0.1, 0.18], gravity: 300, drag: 3, grow: 0.2, alpha: 1, spin: 0, stretch: 3 },
  dust: { count: 5, speed: [10, 60], life: [0.4, 0.9], size: [0.2, 0.4], gravity: -10, drag: 2, grow: 1.4, alpha: 0.35, spin: 0 },
};

const shapeTextures = new Map<ParticleShape, Texture>();
function shapeTexture(shape: ParticleShape): Texture {
  const cached = shapeTextures.get(shape);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  if (shape === 'circle') {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.7, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  } else if (shape === 'square') {
    g.fillStyle = '#fff';
    g.fillRect(8, 8, 48, 48);
  } else {
    // a flat arrowhead pointing right: stretched presets (sparks) then read as hard streaks
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(60, 32);
    g.lineTo(6, 8);
    g.lineTo(18, 32);
    g.lineTo(6, 56);
    g.closePath();
    g.fill();
  }
  const t = Texture.from(c);
  shapeTextures.set(shape, t);
  return t;
}

/**
 * Thin wrapper over Pixi's ParticleContainer (we do not write a particle engine).
 *   const fx = new Particles(view.world);   // in mount(); or new Particles(view.world, { shape: 'shard', confettiColors: [...] })
 *   fx.emit('sparks', x, y, { color: 0xffd166, angle: -Math.PI/2 });
 *   fx.update(dtSeconds);                   // every render frame
 * Counts are capped per emit and in total; the dial's particle layer and intensity scale them.
 */
export class Particles {
  readonly container: ParticleContainer;
  private readonly texture: Texture;
  private readonly confettiColors?: number[];
  private live: PState[] = [];
  /** Hard cap on live particles. */
  maxTotal = 600;
  /** Cap per emit() call before intensity scaling. */
  maxPerEmit = 64;

  constructor(parent: Container, opts: ParticlesOptions = {}) {
    const shape = opts.shape ?? 'circle';
    this.texture = typeof shape === 'string' ? shapeTexture(shape) : shape;
    this.confettiColors = opts.confettiColors;
    this.container = new ParticleContainer({
      texture: this.texture,
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true },
    });
    parent.addChild(this.container);
  }

  get count(): number {
    return this.live.length;
  }

  emit(preset: ParticlePreset, x: number, y: number, opts: EmitOptions = {}): void {
    const def = PRESETS[preset];
    const wanted = Math.round((opts.count ?? def.count) * dial.scale('particles', 1));
    const n = Math.min(wanted, this.maxPerEmit, this.maxTotal - this.live.length);
    for (let i = 0; i < n; i++) {
      const ang = opts.angle === undefined ? vfx() * Math.PI * 2 : opts.angle + (vfx() * 2 - 1) * (opts.spread ?? Math.PI / 3);
      const sp = vfxRange(def.speed[0], def.speed[1]) * (opts.speed ?? 1);
      const size = vfxRange(def.size[0], def.size[1]) * (opts.size ?? 1);
      const palette = preset === 'confetti' && this.confettiColors ? this.confettiColors : def.colors;
      const color = opts.color ?? (palette ? palette[Math.floor(vfx() * palette.length)]! : 0xffffff);
      const p = new Particle({
        texture: this.texture,
        x,
        y,
        anchorX: 0.5,
        anchorY: 0.5,
        scaleX: size * (def.stretch ?? 1),
        scaleY: size,
        rotation: def.stretch ? ang : vfx() * Math.PI * 2,
        tint: color,
        alpha: def.alpha,
      });
      const life = vfxRange(def.life[0], def.life[1]);
      this.live.push({
        p, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life, max: life,
        gravity: def.gravity, drag: def.drag, spin: def.spin * (vfx() * 2 - 1), s0: size, s1: size * def.grow, a0: def.alpha,
      });
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
      const t = 1 - s.life / s.max;
      s.vy += s.gravity * step;
      const damp = Math.exp(-s.drag * step);
      s.vx *= damp;
      s.vy *= damp;
      s.p.x += s.vx * step;
      s.p.y += s.vy * step;
      s.p.rotation += s.spin * step;
      const k = s.s0 + (s.s1 - s.s0) * t;
      const stretch = s.p.scaleX / Math.max(s.p.scaleY, 1e-6);
      s.p.scaleY = k;
      s.p.scaleX = k * stretch;
      s.p.alpha = s.a0 * (1 - t * t);
    }
  }

  clear(): void {
    for (const s of this.live) this.container.removeParticle(s.p);
    this.live.length = 0;
  }
}
