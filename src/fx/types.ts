// 视觉模块的公共接口。每个模块是一个 create 函数，返回一个可选的每帧更新。
import type Phaser from "phaser";
import type { LightRegistry } from "../lighting";
import type { World } from "../world";

export interface FxContext {
  scene: Phaser.Scene;
  world: World;
  lights: LightRegistry;
}

export interface Fx {
  /** t：秒（场景时间），dt：这一帧的秒数 */
  update?(t: number, dt: number): void;
  /** 角色当前位置（美术像素，脚底中心），给需要和角色互动的效果用 */
  onPlayer?(x: number, y: number): void;
}
