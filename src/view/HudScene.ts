// HUD 放在单独的场景里，叠在游戏画面上面：
// 不受游戏镜头切换和后期特效影响，坐标直接用美术像素（0~320, 0~176）。
import Phaser from "phaser";
import { EGG_COLORS } from "../art/sprites";
import { ROOM_PX_H, ROOM_PX_W } from "../world";
import { DEPTH, SCALE } from "./screen";

/** 左上角收集进度 */
export class Hud {
  private icons: Phaser.GameObjects.Image[];

  constructor(
    scene: Phaser.Scene,
    private eggIndices: number[],
  ) {
    this.icons = eggIndices.map((_, i) =>
      scene.add
        .image(8 + i * 10, 8, "eggSlot")
        .setDepth(DEPTH.hud)
        .setOrigin(0),
    );
  }

  /** has[i]：第 i 颗蛋是否已经拿到 */
  set(has: boolean[]) {
    has.forEach((got, i) => this.icons[i]?.setTexture(got ? `egg${this.eggIndices[i] % EGG_COLORS.length}` : "eggSlot"));
  }
}

/** HUD 需要从游戏场景读的状态 */
export interface HudSource {
  /** 每颗蛋的编号（决定颜色）和是否已经拿到 */
  hudEggs: { index: number; got: boolean }[];
}

export class HudScene extends Phaser.Scene {
  private hud?: Hud;
  private last = "";

  constructor(private source: HudSource) {
    super({ key: "hud", active: true });
  }

  create() {
    this.cameras.main.setZoom(SCALE).centerOn(ROOM_PX_W / 2, ROOM_PX_H / 2);
  }

  update() {
    const eggs = this.source.hudEggs;
    // 游戏场景建好贴图之后才创建
    if (!this.hud && eggs.length && this.textures.exists("eggSlot")) {
      this.hud = new Hud(
        this,
        eggs.map((e) => e.index),
      );
    }
    const key = eggs.map((e) => (e.got ? 1 : 0)).join("");
    if (this.hud && key !== this.last) {
      this.last = key;
      this.hud.set(eggs.map((e) => e.got));
    }
  }
}
