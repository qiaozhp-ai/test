// 画面分辨率和图层顺序。
//
// 游戏逻辑和美术都按 320x176 的"美术像素"来做，但实际渲染分辨率是它的 SCALE 倍。
// 这样像素画仍然是清晰的方块（贴图用最近邻采样），而光照、光晕、后期特效
// 是在高分辨率下计算的，过渡平滑，不会出现一格一格的色阶。
import { ROOM_PX_H, ROOM_PX_W } from "../world";

function readScale(): number {
  // ?scale=1 可以用低分辨率跑（自动化测试在没有 GPU 的环境里用）
  try {
    const v = Number(new URLSearchParams(location.search).get("scale"));
    if (v >= 1 && v <= 6) return Math.round(v);
  } catch {
    // 没有 location（比如单元测试）就用默认值
  }
  return 4;
}

export const SCALE = readScale();
export const SCREEN_W = ROOM_PX_W * SCALE;
export const SCREEN_H = ROOM_PX_H * SCALE;

/** 图层深度，数字越大越靠前。各个视觉模块都从这里取，不要自己写死数字。 */
export const DEPTH = {
  farBackdrop: -30, // 远景（视差层）
  backwall: -20, // 背景墙
  backwallShadow: -19, // 投在背景墙上的影子
  backDecor: -15, // 背景墙上的装饰（藤蔓、根须等，在岩石后面）
  fogBack: -12, // 后层雾
  terrain: 0, // 岩石瓦片
  decor: 2, // 岩石上的装饰（草、蘑菇、钟乳石）
  props: 3, // 灯笼、链子
  pickups: 4, // 蛋
  playerGlow: 5,
  player: 6,
  particles: 7, // 扬尘、收集特效
  ambient: 8, // 孢子、萤火虫、水滴
  fogFront: 9, // 前层雾
  debug: 50,
  hud: 100,
} as const;
