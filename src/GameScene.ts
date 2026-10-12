import Phaser from "phaser";
import { Controls } from "./input";
import type { PlayerParams } from "./params";
import { TILE } from "./physics";
import { NO_INPUT, PLAYER_H, type PlayerState, createPlayer, stepPlayer } from "./player";
import { SAVE_KEY, type SaveData, load, save } from "./storage";
import { DOWN, EGG_COLORS, LEFT, RIGHT, TILE_VARIANTS, UP, makeTextures } from "./textures";
import { type Entity, ROOM_PX_H, ROOM_PX_W, type World, buildWorld } from "./world";

const STEP = 1000 / 60; // 固定 60Hz 逻辑帧，手感不受显示器刷新率影响

const AMBIENT = 0x272d3e;
const LANTERN_COLOR = 0xffb35c;
const PLAYER_LIGHT = 0xd8f0a8;

export interface SceneHooks {
  onEggs?(count: number, total: number): void;
}

export interface Snapshot {
  x: number;
  y: number;
}

interface Lantern {
  light: Phaser.GameObjects.Light;
  glow: Phaser.GameObjects.Image;
  seed: number;
}

interface Egg {
  entity: Entity;
  index: number;
  // 已经收集过的蛋没有这些对象
  sprite?: Phaser.GameObjects.Image;
  light?: Phaser.GameObjects.Light;
  glow?: Phaser.GameObjects.Image;
}

export class GameScene extends Phaser.Scene {
  world!: World;
  player!: PlayerState;
  showHitbox = false;
  /** 测试用：不为空时代替键盘输入 */
  forcedInput: typeof NO_INPUT | null = null;
  room = { rx: 0, ry: 0 };

  private controls!: Controls;
  private sprite!: Phaser.GameObjects.Image;
  private playerLight!: Phaser.GameObjects.Light;
  private playerGlow!: Phaser.GameObjects.Image;
  private lanterns: Lantern[] = [];
  private eggs: Egg[] = [];
  private hud: Phaser.GameObjects.Image[] = [];
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private acc = 0;
  private anim = 0;
  private squash = { x: 1, y: 1 };
  private saveData: SaveData = { eggs: [] };

  constructor(
    private params: PlayerParams,
    private hooks: SceneHooks = {},
    private snapshot?: Snapshot,
  ) {
    super("game");
  }

  create() {
    makeTextures(this);
    this.world = buildWorld();
    this.saveData = load<SaveData>(SAVE_KEY, { eggs: [] });
    const W = this.world.cols * TILE;
    const H = this.world.rows * TILE;

    this.lights.enable().setAmbientColor(AMBIENT);

    // 背景墙：被灯照到的地方才看得见
    this.add.tileSprite(0, 0, W, H, "backwall").setOrigin(0).setPipeline("Light2D").setDepth(-10);

    this.buildTilemap();
    this.buildSpores(W, H);

    for (const e of this.world.entities) {
      if (e.kind === "lantern") this.addLantern(e);
    }
    this.world.entities
      .filter((e) => e.kind === "egg")
      .forEach((e, i) => this.addEgg(e, i));

    // 角色
    const spawn = this.world.entities.find((e) => e.kind === "spawn")!;
    this.player = createPlayer(this.snapshot?.x ?? spawn.x + 1, this.snapshot?.y ?? spawn.y + TILE - PLAYER_H);
    this.sprite = this.add.image(0, 0, "player", "idle0").setOrigin(0.5, 1).setDepth(5);
    this.playerGlow = this.add
      .image(0, 0, "glow")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(PLAYER_LIGHT)
      .setAlpha(0.22)
      .setScale(0.7)
      .setDepth(4);
    this.playerLight = this.lights.addLight(0, 0, 80, PLAYER_LIGHT, 1.0);

    this.dust = this.add.particles(0, 0, "dot", {
      lifespan: 380,
      speed: { min: 8, max: 30 },
      angle: { min: 200, max: 340 },
      gravityY: 60,
      alpha: { start: 0.6, end: 0 },
      tint: 0x8c9ab4,
      emitting: false,
    });
    this.dust.setDepth(6);
    this.burst = this.add.particles(0, 0, "dot", {
      lifespan: { min: 400, max: 900 },
      speed: { min: 20, max: 70 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.burst.setDepth(7);

    // HUD：左上角的蛋
    this.eggs.forEach((_, i) => {
      this.hud.push(this.add.image(8 + i * 10, 8, "eggSlot").setScrollFactor(0).setDepth(100).setOrigin(0));
    });
    this.refreshHud();

    this.debugGfx = this.add.graphics().setDepth(50);
    this.controls = new Controls(this);
    this.updateCamera();
    this.render();
  }

  // ---------- 搭建场景 ----------

  private buildTilemap() {
    const { cols, rows, isSolid } = this.world;
    const data: number[][] = [];
    for (let ty = 0; ty < rows; ty++) {
      const row: number[] = [];
      for (let tx = 0; tx < cols; tx++) {
        if (!isSolid(tx, ty)) {
          row.push(-1);
          continue;
        }
        let mask = 0;
        if (!isSolid(tx, ty - 1)) mask |= UP;
        if (!isSolid(tx + 1, ty)) mask |= RIGHT;
        if (!isSolid(tx, ty + 1)) mask |= DOWN;
        if (!isSolid(tx - 1, ty)) mask |= LEFT;
        const variant = (tx * 7 + ty * 13 + ((tx * ty) % 5)) % TILE_VARIANTS;
        row.push(variant * 16 + mask);
      }
      data.push(row);
    }
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const ts = map.addTilesetImage("tiles", "tiles", TILE, TILE, 0, 0)!;
    map.createLayer(0, ts, 0, 0)!.setPipeline("Light2D");
  }

  private buildSpores(W: number, H: number) {
    // 空气里飘的孢子，只在空的地方生成
    const world = this.world;
    const zone = {
      getRandomPoint(p: Phaser.Types.Math.Vector2Like) {
        for (let i = 0; i < 20; i++) {
          const x = Math.random() * W;
          const y = Math.random() * H;
          if (!world.isSolid(Math.floor(x / TILE), Math.floor(y / TILE))) {
            p.x = x;
            p.y = y;
            return p;
          }
        }
        p.x = -100;
        p.y = -100;
        return p;
      },
    };
    const spores = this.add.particles(0, 0, "dot", {
      lifespan: { min: 5000, max: 9000 },
      speedX: { min: -3, max: 3 },
      speedY: { min: -5, max: -1 },
      alpha: { start: 0, end: 1, ease: (t: number) => Math.sin(t * Math.PI) * 0.45 } as never,
      tint: [0x9fb8ff, 0xd8f0a8, 0xffd9a0],
      frequency: 45,
      blendMode: Phaser.BlendModes.ADD,
      emitZone: { type: "random", source: zone as never },
    });
    spores.setDepth(3);
    // 让孢子一开场就铺满，而不是从零开始慢慢出现
    spores.fastForward(8000, 50);
  }

  private addLantern(e: Entity) {
    const cx = e.x + 4;
    const cy = e.y + 4;
    // 吊链一直连到天花板
    let top = Math.floor(e.y / TILE) - 1;
    while (top > 0 && !this.world.isSolid(Math.floor(e.x / TILE), top)) top--;
    const chain = this.add.graphics().setDepth(1);
    chain.fillStyle(0x2a2622);
    chain.fillRect(cx - 0.5, (top + 1) * TILE, 1, e.y - (top + 1) * TILE);
    this.add.image(cx, cy, "lantern").setDepth(2);
    const glow = this.add
      .image(cx, cy, "glow")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(LANTERN_COLOR)
      .setAlpha(0.4)
      .setScale(1.1)
      .setDepth(2);
    const light = this.lights.addLight(cx, cy + 2, 150, LANTERN_COLOR, 2.1);
    this.lanterns.push({ light, glow, seed: e.x * 0.37 + e.y * 0.11 });
  }

  private addEgg(e: Entity, index: number) {
    if (this.saveData.eggs.includes(e.id)) {
      this.eggs.push({ entity: e, index });
      return;
    }
    const color = EGG_COLORS[index % EGG_COLORS.length];
    const sprite = this.add.image(e.x + 4, e.y + 4, `egg${index % EGG_COLORS.length}`).setDepth(4);
    const glow = this.add
      .image(e.x + 4, e.y + 4, "glow")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(color)
      .setAlpha(0.3)
      .setScale(0.5)
      .setDepth(3);
    const light = this.lights.addLight(e.x + 4, e.y + 4, 44, color, 1.1);
    this.eggs.push({ entity: e, index, sprite, light, glow });
  }

  // ---------- 每帧 ----------

  update(time: number, delta: number) {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP) {
      this.fixedStep();
      this.acc -= STEP;
    }
    this.animate(time / 1000, delta / 1000);
    this.updateCamera();
    this.render();
  }

  private fixedStep() {
    const p = this.player;
    const input = this.forcedInput ?? this.controls.read();
    stepPlayer(p, input, STEP / 1000, this.params, this.world.isSolid);

    const feetX = p.x + p.w / 2;
    const feetY = p.y + p.h;
    if (p.justJumped) {
      this.squash = { x: 0.75, y: 1.3 };
      this.dust.explode(3, feetX, feetY);
    }
    if (p.justLanded) {
      const k = Math.min(1, p.landSpeed / this.params.maxFallSpeed);
      this.squash = { x: 1 + 0.4 * k, y: 1 - 0.35 * k };
      this.dust.explode(Math.round(2 + 5 * k), feetX, feetY);
    }

    for (const egg of this.eggs) {
      if (!egg.sprite?.active) continue;
      const e = egg.entity;
      if (p.x < e.x + TILE && p.x + p.w > e.x && p.y < e.y + TILE && p.y + p.h > e.y) this.collect(egg);
    }
  }

  private collect(egg: Egg) {
    const { sprite, glow, light } = egg;
    if (!sprite || !glow || !light) return;
    const color = EGG_COLORS[egg.index % EGG_COLORS.length];
    this.saveData.eggs.push(egg.entity.id);
    save(SAVE_KEY, this.saveData);
    this.burst.setParticleTint(color);
    this.burst.explode(24, sprite.x, sprite.y);
    this.lights.removeLight(light);
    this.tweens.add({
      targets: [sprite, glow],
      y: sprite.y - 12,
      alpha: 0,
      duration: 500,
      ease: "Quad.easeOut",
      onComplete: () => {
        sprite.destroy();
        glow.destroy();
      },
    });
    sprite.setActive(false);
    this.refreshHud();
  }

  private refreshHud() {
    const got = new Set(this.saveData.eggs);
    this.eggs.forEach((egg, i) => {
      const has = got.has(egg.entity.id);
      this.hud[i]?.setTexture(has ? `egg${egg.index % EGG_COLORS.length}` : "eggSlot");
    });
    this.hooks.onEggs?.(this.eggs.filter((e) => got.has(e.entity.id)).length, this.eggs.length);
  }

  private animate(t: number, dt: number) {
    for (const l of this.lanterns) {
      // 两个不同频率的正弦叠加，看起来像火苗在跳
      const f = 0.92 + 0.05 * Math.sin(t * 7.3 + l.seed) + 0.03 * Math.sin(t * 17.1 + l.seed * 2);
      l.light.setIntensity(2.1 * f);
      l.glow.setAlpha(0.4 * f);
    }
    for (const { sprite, glow, light, entity, index } of this.eggs) {
      if (!sprite?.active || !glow || !light) continue;
      const bob = Math.round(Math.sin(t * 2.2 + index) * 1.2);
      sprite.y = entity.y + 4 + bob;
      glow.y = sprite.y;
      light.setIntensity(1.0 + 0.2 * Math.sin(t * 3 + index));
    }
    const k = 1 - Math.exp(-dt * 14);
    this.squash.x += (1 - this.squash.x) * k;
    this.squash.y += (1 - this.squash.y) * k;
    this.anim += dt;
  }

  private updateCamera() {
    const p = this.player;
    const rx = Phaser.Math.Clamp(Math.floor((p.x + p.w / 2) / ROOM_PX_W), 0, this.world.roomsX - 1);
    const ry = Phaser.Math.Clamp(Math.floor((p.y + p.h / 2) / ROOM_PX_H), 0, this.world.roomsY - 1);
    this.room = { rx, ry };
    // 动物井式的整屏切换：一个房间就是一屏，越过边缘立刻切到下一屏
    this.cameras.main.setScroll(rx * ROOM_PX_W, ry * ROOM_PX_H);
  }

  private render() {
    const p = this.player;
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
    this.playerGlow.setPosition(x, y - 4);
    this.playerLight.setPosition(x, y - 4);

    this.debugGfx.clear();
    if (this.showHitbox) {
      this.debugGfx.lineStyle(1, 0xff4060, 1).strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
    }
  }

  // ---------- 给调试面板和测试用 ----------

  respawn() {
    const spawn = this.world.entities.find((e) => e.kind === "spawn")!;
    Object.assign(this.player, createPlayer(spawn.x + 1, spawn.y + TILE - PLAYER_H));
  }

  teleport(x: number, y: number) {
    Object.assign(this.player, createPlayer(x, y));
  }

  getSnapshot(): Snapshot {
    return { x: this.player.x, y: this.player.y };
  }
}
