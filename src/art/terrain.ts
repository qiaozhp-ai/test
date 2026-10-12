// 地形：岩石瓦片、背景墙，以及把世界数据铺成 tilemap。
import Phaser from "phaser";
import type { Fx, FxContext } from "../fx/types";
import { LIT_PIPELINE } from "../lighting";
import { TILE } from "../physics";
import { DEPTH } from "../view/screen";
import { canvas, hash, hex } from "./canvas";

// ---------- 岩石瓦片 ----------
// 瓦片编号 = 变体 * 16 + 邻居掩码（上=1 右=2 下=4 左=8，表示那一侧是空气）
const TILE_VARIANTS = 4;
const UP = 1;
const RIGHT = 2;
const DOWN = 4;
const LEFT = 8;

const STONE = ["#161c29", "#1a2131", "#1d2536", "#141a26"].map(hex);
const SPECK = hex("#283247");
const RIM_TOP = hex("#55687f");
const RIM_TOP2 = hex("#2e3a4d");
const MOSS = hex("#4f7d5e");
const MOSS2 = hex("#365a46");
const RIM_SIDE = hex("#344156");
const UNDER = hex("#0e121b");

function makeTiles(scene: Phaser.Scene) {
  const W = 16 * 8;
  const H = TILE_VARIANTS * 8;
  const col = canvas(W, H);
  const nrm = canvas(W, H);
  for (let v = 0; v < TILE_VARIANTS; v++) {
    for (let m = 0; m < 16; m++) {
      const ox = m * 8;
      const oy = v * 8;
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const r = hash(v * 16 + m, x, y);
          // 圆角：两侧都是空气的角上那个像素挖掉
          const cornerCut =
            (x === 0 && y === 0 && m & UP && m & LEFT) ||
            (x === 7 && y === 0 && m & UP && m & RIGHT) ||
            (x === 0 && y === 7 && m & DOWN && m & LEFT) ||
            (x === 7 && y === 7 && m & DOWN && m & RIGHT);
          if (cornerCut) {
            col.set(ox + x, oy + y, [0, 0, 0], 0);
            nrm.set(ox + x, oy + y, [128, 128, 255], 0);
            continue;
          }
          let c = STONE[Math.floor(r * STONE.length)];
          if (r > 0.93) c = SPECK;
          // 法线：默认朝屏幕外，边缘朝外倾斜，让灯光照出立体感
          let nx = 0;
          let ny = 0;
          if (m & DOWN && y === 7) {
            c = UNDER;
            ny = -0.6;
          }
          if (m & LEFT && x === 0) {
            c = RIM_SIDE;
            nx = -0.7;
          }
          if (m & RIGHT && x === 7) {
            c = RIM_SIDE;
            nx = 0.7;
          }
          if (m & UP && y <= 1) {
            const mossy = v % 2 === 0 && hash(v, m, x) > 0.35;
            c = y === 0 ? (mossy ? MOSS : RIM_TOP) : mossy && hash(m, x, v) > 0.5 ? MOSS2 : RIM_TOP2;
            ny = 0.7;
          }
          col.set(ox + x, oy + y, c);
          const len = Math.hypot(nx, ny, 1);
          nrm.set(ox + x, oy + y, [
            Math.round(((nx / len) * 0.5 + 0.5) * 255),
            Math.round(((ny / len) * 0.5 + 0.5) * 255),
            Math.round(((1 / len) * 0.5 + 0.5) * 255),
          ]);
        }
      }
    }
  }
  const tex = scene.textures.addCanvas("tiles", col.done())!;
  tex.setDataSource(nrm.done() as unknown as HTMLImageElement);
}

// ---------- 背景墙 ----------
function makeBackwall(scene: Phaser.Scene) {
  const S = 32;
  const c = canvas(S, S);
  const bricks = ["#0f1420", "#111727", "#0d121c"].map(hex);
  const mortar = hex("#080b12");
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const row = Math.floor(y / 8);
      const off = row % 2 ? 6 : 0;
      const bx = Math.floor((x + off) / 12);
      const isMortar = y % 8 === 7 || (x + off) % 12 === 11;
      const r = hash(bx, row, x * 31 + y);
      c.set(x, y, isMortar ? mortar : bricks[Math.floor(hash(bx, row, 7) * bricks.length)], r > 0.97 ? 200 : 255);
    }
  }
  scene.textures.addCanvas("backwall", c.done());
}

/** 根据四邻是否为空气算出瓦片掩码，再选一个变体 */
function tileIndex(isSolid: (tx: number, ty: number) => boolean, tx: number, ty: number): number {
  let mask = 0;
  if (!isSolid(tx, ty - 1)) mask |= UP;
  if (!isSolid(tx + 1, ty)) mask |= RIGHT;
  if (!isSolid(tx, ty + 1)) mask |= DOWN;
  if (!isSolid(tx - 1, ty)) mask |= LEFT;
  const variant = (tx * 7 + ty * 13 + ((tx * ty) % 5)) % TILE_VARIANTS;
  return variant * 16 + mask;
}

export function createTerrain({ scene, world }: FxContext): Fx {
  makeTiles(scene);
  makeBackwall(scene);

  const W = world.cols * TILE;
  const H = world.rows * TILE;

  // 背景墙：被灯照到的地方才看得见
  scene.add.tileSprite(0, 0, W, H, "backwall").setOrigin(0).setPipeline(LIT_PIPELINE).setDepth(DEPTH.backwall);

  const data: number[][] = [];
  for (let ty = 0; ty < world.rows; ty++) {
    const row: number[] = [];
    for (let tx = 0; tx < world.cols; tx++) row.push(world.isSolid(tx, ty) ? tileIndex(world.isSolid, tx, ty) : -1);
    data.push(row);
  }
  const map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
  const ts = map.addTilesetImage("tiles", "tiles", TILE, TILE, 0, 0)!;
  map.createLayer(0, ts, 0, 0)!.setPipeline(LIT_PIPELINE).setDepth(DEPTH.terrain);
  return {};
}
