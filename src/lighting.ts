// 光源登记表。所有 Light2D 光源都通过这里创建，
// 这样别的模块（比如投影）能知道场景里有哪些光、在哪、多亮。
import Phaser from "phaser";

/** 受光照影响的物体都用这个管线：obj.setPipeline(LIT_PIPELINE) */
export const LIT_PIPELINE = "Light2D";

/** 场景创建时最先调用：安装光照管线、设置环境光 */
export function installLighting(scene: Phaser.Scene, ambient: number): void {
  scene.lights.enable().setAmbientColor(ambient);
}

export type LightKind = "lantern" | "egg" | "player" | "decor";

export interface LightOptions {
  x: number;
  y: number;
  radius: number; // 美术像素
  color: number;
  intensity: number;
  kind: LightKind;
  /** 不会移动的光源。投影模块只给静态光源算影子。 */
  static: boolean;
}

export interface LightSource extends LightOptions {
  light: Phaser.GameObjects.Light;
}

export class LightRegistry {
  readonly sources: LightSource[] = [];

  constructor(private scene: Phaser.Scene) {}

  add(o: LightOptions): LightSource {
    const light = this.scene.lights.addLight(o.x, o.y, o.radius, o.color, o.intensity);
    const src = { ...o, light };
    this.sources.push(src);
    return src;
  }

  remove(src: LightSource) {
    this.scene.lights.removeLight(src.light);
    const i = this.sources.indexOf(src);
    if (i >= 0) this.sources.splice(i, 1);
  }

  /** 改半径（美术像素） */
  setRadius(src: LightSource, radius: number) {
    src.radius = radius;
    src.light.setRadius(radius);
  }

  /** 移动光源（同时更新登记的位置） */
  move(src: LightSource, x: number, y: number) {
    src.x = x;
    src.y = y;
    src.light.setPosition(x, y);
  }
}
