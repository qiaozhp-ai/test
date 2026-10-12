// 环境氛围：空气里飘的孢子等。
import Phaser from "phaser";
import { TILE } from "../physics";
import { DEPTH } from "../view/screen";
import type { Fx, FxContext } from "./types";

export function createAmbient({ scene, world }: FxContext): Fx {
  const W = world.cols * TILE;
  const H = world.rows * TILE;

  // 空气里飘的孢子，只在空的地方生成
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
  const spores = scene.add.particles(0, 0, "dot", {
    lifespan: { min: 5000, max: 9000 },
    speedX: { min: -3, max: 3 },
    speedY: { min: -5, max: -1 },
    alpha: { start: 0, end: 1, ease: (t: number) => Math.sin(t * Math.PI) * 0.45 } as never,
    tint: [0x9fb8ff, 0xd8f0a8, 0xffd9a0],
    frequency: 45,
    blendMode: Phaser.BlendModes.ADD,
    emitZone: { type: "random", source: zone as never },
  });
  spores.setDepth(DEPTH.ambient);
  // 让孢子一开场就铺满，而不是从零开始慢慢出现
  spores.fastForward(8000, 50);
  return {};
}
