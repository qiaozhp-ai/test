// 场景道具的视觉：灯笼（吊链、火光闪烁）、蛋（漂浮、发光、被收集时的特效）、左上角 HUD。
import Phaser from "phaser";
import { EGG_COLORS } from "../art/sprites";
import type { Fx, FxContext } from "../fx/types";
import type { LightSource } from "../lighting";
import { TILE } from "../physics";
import type { Entity } from "../world";
import { DEPTH } from "./screen";

export const LANTERN_COLOR = 0xffb35c;

export function createLanterns(ctx: FxContext, lanterns: Entity[]): Fx {
  const { scene, world } = ctx;
  const items = lanterns.map((e) => {
    const cx = e.x + 4;
    const cy = e.y + 4;
    // 吊链一直连到天花板
    let top = Math.floor(e.y / TILE) - 1;
    while (top > 0 && !world.isSolid(Math.floor(e.x / TILE), top)) top--;
    const chain = scene.add.graphics().setDepth(DEPTH.props);
    chain.fillStyle(0x2a2622);
    chain.fillRect(cx - 0.5, (top + 1) * TILE, 1, e.y - (top + 1) * TILE);
    scene.add.image(cx, cy, "lantern").setDepth(DEPTH.props);
    const glow = scene.add
      .image(cx, cy, "glow")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(LANTERN_COLOR)
      .setAlpha(0.4)
      .setScale(1.1)
      .setDepth(DEPTH.props);
    const src = ctx.lights.add({ x: cx, y: cy + 2, radius: 150, color: LANTERN_COLOR, intensity: 2.1, kind: "lantern", static: true });
    return { src, glow, seed: e.x * 0.37 + e.y * 0.11 };
  });

  return {
    update(t) {
      for (const l of items) {
        // 两个不同频率的正弦叠加，看起来像火苗在跳
        const f = 0.92 + 0.05 * Math.sin(t * 7.3 + l.seed) + 0.03 * Math.sin(t * 17.1 + l.seed * 2);
        l.src.light.setIntensity(l.src.intensity * f);
        l.glow.setAlpha(0.4 * f);
      }
    },
  };
}

export class EggView {
  private sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private light: LightSource;
  private collected = false;

  constructor(
    private ctx: FxContext,
    private entity: Entity,
    private index: number,
  ) {
    const { scene } = ctx;
    const color = EGG_COLORS[index % EGG_COLORS.length];
    this.sprite = scene.add.image(entity.x + 4, entity.y + 4, `egg${index % EGG_COLORS.length}`).setDepth(DEPTH.pickups);
    this.glow = scene.add
      .image(entity.x + 4, entity.y + 4, "glow")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(color)
      .setAlpha(0.3)
      .setScale(0.5)
      .setDepth(DEPTH.pickups);
    this.light = ctx.lights.add({ x: entity.x + 4, y: entity.y + 4, radius: 44, color, intensity: 1.1, kind: "egg", static: true });
  }

  update(t: number) {
    if (this.collected) return;
    const bob = Math.round(Math.sin(t * 2.2 + this.index) * 1.2);
    this.sprite.y = this.entity.y + 4 + bob;
    this.glow.y = this.sprite.y;
    this.light.light.setIntensity(this.light.intensity * (0.9 + 0.18 * Math.sin(t * 3 + this.index)));
  }

  /** 被收集时播放特效，然后自己销毁 */
  collect() {
    if (this.collected) return;
    this.collected = true;
    const { scene } = this.ctx;
    const color = EGG_COLORS[this.index % EGG_COLORS.length];
    const burst = scene.add.particles(0, 0, "dot", {
      lifespan: { min: 400, max: 900 },
      speed: { min: 20, max: 70 },
      alpha: { start: 1, end: 0 },
      tint: color,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    burst.setDepth(DEPTH.particles);
    burst.explode(24, this.sprite.x, this.sprite.y);
    scene.time.delayedCall(1000, () => burst.destroy());
    this.ctx.lights.remove(this.light);
    scene.tweens.add({
      targets: [this.sprite, this.glow],
      y: this.sprite.y - 12,
      alpha: 0,
      duration: 500,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.sprite.destroy();
        this.glow.destroy();
      },
    });
  }
}
