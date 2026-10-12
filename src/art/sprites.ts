// 角色、灯笼、蛋、光晕等精灵贴图（运行时用代码画）。
import Phaser from "phaser";
import { canvas, drawPattern, smooth } from "./canvas";

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
  smooth(scene.textures.addCanvas("glow", c)!);

  const d = canvas(1, 1);
  d.set(0, 0, [255, 255, 255]);
  scene.textures.addCanvas("dot", d.done());
}

export function makeSpriteTextures(scene: Phaser.Scene) {
  makePlayer(scene);
  makeLantern(scene);
  makeEggs(scene);
  makeGlow(scene);
}
