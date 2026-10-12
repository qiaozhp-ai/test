// 角色的视觉表现：精灵帧、挤压拉伸、身上的光和光晕、起跳落地扬尘。
// 只读取 PlayerState，不改游戏逻辑。
import Phaser from "phaser";
import type { FxContext } from "../fx/types";
import type { LightSource } from "../lighting";
import type { PlayerState } from "../player";
import { DEPTH } from "./screen";

export const PLAYER_LIGHT = 0xd8f0a8;

export class PlayerView {
  private sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private light: LightSource;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private squash = { x: 1, y: 1 };
  private anim = 0;

  constructor(private ctx: FxContext) {
    const { scene } = ctx;
    this.sprite = scene.add.image(0, 0, "player", "idle0").setOrigin(0.5, 1).setDepth(DEPTH.player);
    this.glow = scene.add
      .image(0, 0, "glow")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(PLAYER_LIGHT)
      .setAlpha(0.22)
      .setScale(0.7)
      .setDepth(DEPTH.playerGlow);
    this.light = ctx.lights.add({ x: 0, y: 0, radius: 80, color: PLAYER_LIGHT, intensity: 1.0, kind: "player", static: false });
    this.dust = scene.add.particles(0, 0, "dot", {
      lifespan: 380,
      speed: { min: 8, max: 30 },
      angle: { min: 200, max: 340 },
      gravityY: 60,
      alpha: { start: 0.6, end: 0 },
      tint: 0x8c9ab4,
      emitting: false,
    });
    this.dust.setDepth(DEPTH.particles);
  }

  /** 起跳那一帧调用。x、y 是脚底中心 */
  onJump(x: number, y: number) {
    this.squash = { x: 0.75, y: 1.3 };
    this.dust.explode(3, x, y);
  }

  /** 落地那一帧调用。impact 0~1，越大摔得越重 */
  onLand(x: number, y: number, impact: number) {
    this.squash = { x: 1 + 0.4 * impact, y: 1 - 0.35 * impact };
    this.dust.explode(Math.round(2 + 5 * impact), x, y);
  }

  update(p: PlayerState, _t: number, dt: number) {
    const k = 1 - Math.exp(-dt * 14);
    this.squash.x += (1 - this.squash.x) * k;
    this.squash.y += (1 - this.squash.y) * k;
    this.anim += dt;

    const x = Math.round(p.x + p.w / 2);
    const y = Math.round(p.y + p.h);

    let frame = "idle0";
    if (!p.onGround) frame = p.vy < 0 ? "jump" : "fall";
    else if (Math.abs(p.vx) > 10) frame = Math.floor(this.anim / 0.11) % 2 ? "run1" : "run0";
    else frame = Math.floor(this.anim / 0.7) % 2 ? "idle1" : "idle0";

    this.sprite
      .setFrame(frame)
      .setPosition(x, y + 1)
      .setFlipX(p.facing < 0)
      .setScale(this.squash.x, this.squash.y);
    this.glow.setPosition(x, y - 4);
    this.ctx.lights.move(this.light, x, y - 4);
  }
}
