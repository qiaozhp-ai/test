// 所有贴图都在运行时用代码画出来，暂时不需要外部美术资源。
// 以后换成真正的像素画（Aseprite 导出的 PNG）时，只要替换这里生成的贴图即可。
import Phaser from "phaser";

type RGB = [number, number, number];

function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const set = (x: number, y: number, rgb: RGB, a = 255) => {
    const i = (y * w + x) * 4;
    img.data[i] = rgb[0];
    img.data[i + 1] = rgb[1];
    img.data[i + 2] = rgb[2];
    img.data[i + 3] = a;
  };
  const done = () => {
    ctx.putImageData(img, 0, 0);
    return c;
  };
  return { set, done };
}

/** 用字符画画一个精灵帧 */
function drawPattern(set: (x: number, y: number, rgb: RGB) => void, ox: number, rows: string[], pal: Record<string, string>) {
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (pal[ch]) set(ox + x, y, hex(pal[ch]));
    }),
  );
}

// ---------- 岩石瓦片 ----------
// 瓦片编号 = 变体 * 16 + 邻居掩码（上=1 右=2 下=4 左=8，表示那一侧是空气）
export const TILE_VARIANTS = 4;
export const UP = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const LEFT = 8;

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

// ---------- 角色 ----------
export const PLAYER_FRAMES = ["idle0", "idle1", "run0", "run1", "jump", "fall"] as const;
const PLAYER_ART: Record<(typeof PLAYER_FRAMES)[number], string[]> = {
  idle0: ["........", "..aaaa..", ".aaaaaa.", ".aaeaea.", ".aaaaaa.", ".baaaab.", ".bbbbbb.", "..c..c.."],
  idle1: ["........", "........", "..aaaa..", ".aaeaea.", ".aaaaaa.", "baaaaaab", ".bbbbbb.", "..c..c.."],
  run0: ["........", "..aaaa..", ".aaaaaa.", ".aaeaea.", ".aaaaaa.", ".baaaab.", ".bbbbbb.", ".c....c."],
  run1: ["........", "........", "..aaaa..", ".aaeaea.", ".aaaaaa.", ".baaaab.", ".bbbbbb.", "...cc..."],
  jump: ["..aaaa..", ".aaaaaa.", ".aaeaea.", ".aaaaaa.", ".aaaaaa.", "..baab..", "..bbbb..", "..c..c.."],
  fall: ["........", "..aaaa..", ".aaeaea.", "aaaaaaaa", "baaaaaab", ".bbbbbb.", ".c....c.", "........"],
};
const PLAYER_PAL = { a: "#e6f5b8", b: "#a9cf84", c: "#6d8f5a", e: "#0c1018" };

function makePlayer(scene: Phaser.Scene) {
  const c = canvas(8 * PLAYER_FRAMES.length, 8);
  PLAYER_FRAMES.forEach((f, i) => drawPattern(c.set, i * 8, PLAYER_ART[f], PLAYER_PAL));
  const tex = scene.textures.addCanvas("player", c.done())!;
  PLAYER_FRAMES.forEach((f, i) => tex.add(f, 0, i * 8, 0, 8, 8));
}

// ---------- 灯笼 ----------
function makeLantern(scene: Phaser.Scene) {
  const c = canvas(8, 8);
  drawPattern(
    c.set,
    0,
    ["...cc...", "..cccc..", ".cyyyyc.", ".cywyyc.", ".cyyyyc.", ".coyyoc.", "..cccc..", "...cc..."],
    { c: "#3d3631", y: "#ffcf7d", w: "#fff4d6", o: "#e0913f" },
  );
  scene.textures.addCanvas("lantern", c.done());
}

// ---------- 蛋 ----------
export const EGG_COLORS = [0x7fd6e8, 0xf2a2c0, 0xc8e87a];
const EGG_ART = [
  // 横纹
  ["...aa...", "..aaaa..", ".bbbbbb.", ".aaaaaa.", ".bbbbbb.", ".aaaaaa.", "..aaaa..", "........"],
  // 圆点
  ["...aa...", "..abaa..", ".aaaaba.", ".abaaaa.", ".aaabaa.", ".baaaab.", "..aaba..", "........"],
  // 锯齿
  ["...aa...", "..aaaa..", ".aaaaaa.", ".babbab.", ".bbabba.", ".aaaaaa.", "..aaaa..", "........"],
];
const EGG_PAL = [
  { a: "#9fe6f2", b: "#2f7f9c" },
  { a: "#f6bcd2", b: "#9c3f6a" },
  { a: "#d8f094", b: "#5d8a2f" },
];

function makeEggs(scene: Phaser.Scene) {
  EGG_ART.forEach((art, i) => {
    const c = canvas(8, 8);
    drawPattern(c.set, 0, art, EGG_PAL[i]);
    scene.textures.addCanvas(`egg${i}`, c.done());
  });
  // HUD 里没拿到的蛋：只有轮廓
  const c = canvas(8, 8);
  drawPattern(c.set, 0, ["...aa...", "..a..a..", ".a....a.", ".a....a.", ".a....a.", ".a....a.", "..aaaa..", "........"], {
    a: "#3a4558",
  });
  scene.textures.addCanvas("eggSlot", c.done());
}

// ---------- 光晕和粒子 ----------
function makeGlow(scene: Phaser.Scene) {
  const S = 64;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  scene.textures.addCanvas("glow", c);

  const d = canvas(1, 1);
  d.set(0, 0, [255, 255, 255]);
  scene.textures.addCanvas("dot", d.done());
}

export function makeTextures(scene: Phaser.Scene) {
  makeTiles(scene);
  makeBackwall(scene);
  makePlayer(scene);
  makeLantern(scene);
  makeEggs(scene);
  makeGlow(scene);
}
