// 游戏场景：只管游戏逻辑（角色、收集、存档、镜头）和把各个视觉模块接起来。
// 具体画面效果都在 art/、fx/、view/ 里。
import Phaser from "phaser";
import { createDecor } from "./art/decor";
import { makeSpriteTextures } from "./art/sprites";
import { createTerrain } from "./art/terrain";
import { createAmbient } from "./fx/ambient";
import { setupPostFX } from "./fx/post";
import { createShadows } from "./fx/shadows";
import type { Fx, FxContext } from "./fx/types";
import { Controls } from "./input";
import { LightRegistry, installLighting } from "./lighting";
import type { PlayerParams } from "./params";
import { TILE } from "./physics";
import { NO_INPUT, PLAYER_H, type PlayerState, createPlayer, stepPlayer } from "./player";
import { SAVE_KEY, type SaveData, load, save } from "./storage";
import { PlayerView } from "./view/PlayerView";
import type { HudSource } from "./view/HudScene";
import { EggView, createLanterns } from "./view/props";
import { DEPTH, SCALE } from "./view/screen";
import { type Entity, ROOM_PX_H, ROOM_PX_W, type World, buildWorld } from "./world";

const STEP = 1000 / 60; // 固定 60Hz 逻辑帧，手感不受显示器刷新率影响

/** 环境光：没有灯照到的地方有多亮 */
export const AMBIENT = 0x272d3e;

export interface SceneHooks {
  onEggs?(count: number, total: number): void;
}

export interface Snapshot {
  x: number;
  y: number;
}

interface Egg {
  entity: Entity;
  index: number;
  view?: EggView; // 已经收集过的蛋没有
}

export class GameScene extends Phaser.Scene implements HudSource {
  world!: World;
  player!: PlayerState;
  showHitbox = false;
  /** 测试用：不为空时代替键盘输入 */
  forcedInput: typeof NO_INPUT | null = null;
  room = { rx: 0, ry: 0 };
  hudEggs: HudSource["hudEggs"] = [];

  private controls!: Controls;
  private view!: PlayerView;
  private fx: Fx[] = [];
  private eggs: Egg[] = [];
  private debugGfx!: Phaser.GameObjects.Graphics;
  private acc = 0;
  private saveData: SaveData = { eggs: [] };

  constructor(
    private params: PlayerParams,
    private hooks: SceneHooks = {},
    private snapshot?: Snapshot,
  ) {
    super("game");
  }

  create() {
    this.world = buildWorld();
    this.saveData = load<SaveData>(SAVE_KEY, { eggs: [] });
    makeSpriteTextures(this);

    installLighting(this, AMBIENT);
    const ctx: FxContext = { scene: this, world: this.world, lights: new LightRegistry(this) };
    const ents = (kind: Entity["kind"]) => this.world.entities.filter((e) => e.kind === kind);

    // 视觉模块。顺序有关系：投影需要先知道所有静态光源。
    this.fx.push(createTerrain(ctx));
    this.fx.push(createDecor(ctx));
    this.fx.push(createLanterns(ctx, ents("lantern")));
    ents("egg").forEach((e, index) => {
      const got = this.saveData.eggs.includes(e.id);
      this.eggs.push({ entity: e, index, view: got ? undefined : new EggView(ctx, e, index) });
    });
    this.fx.push(createShadows(ctx));
    this.fx.push(createAmbient(ctx));

    const spawn = ents("spawn")[0];
    this.player = createPlayer(this.snapshot?.x ?? spawn.x + 1, this.snapshot?.y ?? spawn.y + TILE - PLAYER_H);
    this.view = new PlayerView(ctx);

    this.refreshHud();

    // 镜头放大 SCALE 倍。注意保持默认的中心原点，Phaser 的裁剪计算依赖它
    const cam = this.cameras.main.setZoom(SCALE);
    setupPostFX(this, cam);

    this.debugGfx = this.add.graphics().setDepth(DEPTH.debug);
    this.controls = new Controls(this);
    this.updateCamera();
    this.view.update(this.player, 0, 0);
  }

  // ---------- 每帧 ----------

  update(time: number, delta: number) {
    // 最多追 250ms：掉帧时游戏速度不变，切回后台再回来也不会瞬移
    this.acc += Math.min(delta, 250);
    while (this.acc >= STEP) {
      this.fixedStep();
      this.acc -= STEP;
    }
    const t = time / 1000;
    const dt = delta / 1000;
    const p = this.player;
    this.view.update(p, t, dt);
    for (const egg of this.eggs) egg.view?.update(t);
    for (const f of this.fx) {
      f.update?.(t, dt);
      f.onPlayer?.(p.x + p.w / 2, p.y + p.h);
    }
    this.updateCamera();

    this.debugGfx.clear();
    if (this.showHitbox) {
      this.debugGfx.lineStyle(0.25, 0xff4060, 1).strokeRect(p.x, p.y, p.w, p.h);
    }
  }

  private fixedStep() {
    const p = this.player;
    const input = this.forcedInput ?? this.controls.read();
    stepPlayer(p, input, STEP / 1000, this.params, this.world.isSolid);

    const feetX = p.x + p.w / 2;
    const feetY = p.y + p.h;
    if (p.justJumped) this.view.onJump(feetX, feetY);
    if (p.justLanded) this.view.onLand(feetX, feetY, Math.min(1, p.landSpeed / this.params.maxFallSpeed));

    for (const egg of this.eggs) {
      if (!egg.view || this.saveData.eggs.includes(egg.entity.id)) continue;
      const e = egg.entity;
      if (p.x < e.x + TILE && p.x + p.w > e.x && p.y < e.y + TILE && p.y + p.h > e.y) this.collect(egg);
    }
  }

  private collect(egg: Egg) {
    this.saveData.eggs.push(egg.entity.id);
    save(SAVE_KEY, this.saveData);
    egg.view?.collect();
    this.refreshHud();
  }

  private refreshHud() {
    this.hudEggs = this.eggs.map((e) => ({ index: e.index, got: this.saveData.eggs.includes(e.entity.id) }));
    this.hooks.onEggs?.(this.hudEggs.filter((e) => e.got).length, this.eggs.length);
  }

  private updateCamera() {
    const p = this.player;
    const rx = Phaser.Math.Clamp(Math.floor((p.x + p.w / 2) / ROOM_PX_W), 0, this.world.roomsX - 1);
    const ry = Phaser.Math.Clamp(Math.floor((p.y + p.h / 2) / ROOM_PX_H), 0, this.world.roomsY - 1);
    this.room = { rx, ry };
    // 动物井式的整屏切换：一个房间就是一屏，越过边缘立刻切到下一屏
    this.cameras.main.centerOn(rx * ROOM_PX_W + ROOM_PX_W / 2, ry * ROOM_PX_H + ROOM_PX_H / 2);
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
