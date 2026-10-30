import { Container, Graphics, Sprite, type Application, type Texture } from 'pixi.js';

/**
 * Bake a small drawing into a texture once, so many copies can be drawn as sprites instead of redrawing vectors every frame.
 *   const tex = bakeTexture(view.app as Application, (g) => g.poly(ngon(0, 0, 16, 6)).fill(0xffd36e));
 * The drawing is centered on (0, 0). `resolution` 2 keeps edges crisp on the Deck.
 */
export function bakeTexture(app: Application, draw: (g: Graphics) => void, resolution = 2): Texture {
  const g = new Graphics();
  draw(g);
  const holder = new Container();
  holder.addChild(g);
  const tex = app.renderer.generateTexture({ target: holder, resolution, frame: g.getLocalBounds().rectangle });
  g.destroy();
  return tex;
}

/**
 * A pool of sprites for crowds (hundreds of blobs, bullets, tiles). Each frame: `begin()`, then `next(texture)` once per entity
 * (position and scale the returned sprite), then `end()` to hide the unused rest. Sprites are created on demand and reused.
 */
export class SpritePool<S extends { visible: boolean; texture: Texture } = Sprite> {
  private readonly sprites: S[] = [];
  private used = 0;

  private readonly parent: Container;
  private readonly create: () => S;

  /** `create` defaults to a centered Pixi Sprite added to `parent`; pass your own for custom sprite types (or tests). */
  constructor(parent: Container, create?: () => S) {
    this.parent = parent;
    this.create = create ?? (() => {
      const sp = new Sprite();
      sp.anchor.set(0.5);
      return sp as unknown as S;
    });
  }

  begin(): void {
    this.used = 0;
  }

  next(texture: Texture): S {
    let sp = this.sprites[this.used];
    if (!sp) {
      sp = this.create();
      this.parent.addChild(sp as never);
      this.sprites.push(sp);
    }
    this.used++;
    sp.visible = true;
    if (sp.texture !== texture) sp.texture = texture;
    return sp;
  }

  end(): void {
    for (let i = this.used; i < this.sprites.length; i++) this.sprites[i]!.visible = false;
  }

  get size(): number {
    return this.sprites.length;
  }
}
