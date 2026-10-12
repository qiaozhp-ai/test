import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "../src/params";
import { TILE } from "../src/physics";
import { type Input, NO_INPUT, createPlayer, stepPlayer } from "../src/player";

const DT = 1 / 60;
const prm = DEFAULT_PARAMS;

// 一块平地：第 10 行及以下是实心
const flat = (_tx: number, ty: number) => ty >= 10;
const FLOOR_Y = 10 * TILE;

function standing(x = 40) {
  const p = createPlayer(x, FLOOR_Y - 7);
  stepPlayer(p, NO_INPUT, DT, prm, flat);
  return p;
}

function run(p: ReturnType<typeof createPlayer>, input: Input, frames: number, solid = flat) {
  for (let i = 0; i < frames; i++) stepPlayer(p, input, DT, prm, solid);
}

describe("角色控制器", () => {
  it("站在地面上不会下沉也不会抖动", () => {
    const p = standing();
    run(p, NO_INPUT, 120);
    expect(p.onGround).toBe(true);
    expect(p.y + p.h).toBe(FLOOR_Y);
    expect(p.vy).toBe(0);
  });

  it("加速到最大速度后不再超过", () => {
    const p = standing();
    run(p, { ...NO_INPUT, right: true }, 60);
    expect(p.vx).toBeCloseTo(prm.runSpeed);
  });

  it("按住跳跃能跳过 4 格高（关卡按这个高度设计）", () => {
    const p = standing();
    const y0 = p.y;
    let minY = y0;
    for (let i = 0; i < 90; i++) {
      stepPlayer(p, { ...NO_INPUT, jump: true }, DT, prm, flat);
      minY = Math.min(minY, p.y);
    }
    const height = y0 - minY;
    expect(height).toBeGreaterThan(4 * TILE + 2);
    expect(height).toBeLessThan(6 * TILE);
    expect(p.onGround).toBe(true);
  });

  it("轻点跳跃比按住跳得低", () => {
    const tap = standing();
    const y0 = tap.y;
    let minTap = y0;
    stepPlayer(tap, { ...NO_INPUT, jump: true }, DT, prm, flat);
    for (let i = 0; i < 4; i++) stepPlayer(tap, { ...NO_INPUT, jump: true }, DT, prm, flat);
    for (let i = 0; i < 80; i++) {
      stepPlayer(tap, NO_INPUT, DT, prm, flat);
      minTap = Math.min(minTap, tap.y);
    }
    expect(y0 - minTap).toBeLessThan(2.5 * TILE);
  });

  it("土狼时间：走出平台边缘后几帧内仍能起跳", () => {
    // 平台只到 x < 48
    const ledge = (tx: number, ty: number) => ty >= 10 && tx < 6;
    const p = createPlayer(40, FLOOR_Y - 7);
    stepPlayer(p, NO_INPUT, DT, prm, ledge);
    let frames = 0;
    while (p.onGround && frames < 120) {
      stepPlayer(p, { ...NO_INPUT, right: true }, DT, prm, ledge);
      frames++;
    }
    expect(p.onGround).toBe(false);
    run(p, { ...NO_INPUT, right: true }, 3, ledge);
    stepPlayer(p, { right: true, left: false, jump: true }, DT, prm, ledge);
    expect(p.justJumped).toBe(true);
  });

  it("土狼时间过后不能在空中起跳", () => {
    const air = () => false;
    const p = createPlayer(40, 0);
    run(p, NO_INPUT, 20, air);
    stepPlayer(p, { ...NO_INPUT, jump: true }, DT, prm, air);
    expect(p.justJumped).toBe(false);
  });

  it("跳跃缓冲：落地前提前按跳跃，落地时自动起跳", () => {
    const p = createPlayer(40, FLOOR_Y - 7 - 30);
    // 下落到离地很近
    while (p.y + p.h < FLOOR_Y - 3) stepPlayer(p, NO_INPUT, DT, prm, flat);
    let jumped = false;
    for (let i = 0; i < 10 && !jumped; i++) {
      stepPlayer(p, { ...NO_INPUT, jump: true }, DT, prm, flat);
      jumped = p.justJumped;
    }
    expect(jumped).toBe(true);
  });

  it("按住跳跃键落地不会连跳", () => {
    const p = standing();
    let jumps = 0;
    for (let i = 0; i < 200; i++) {
      stepPlayer(p, { ...NO_INPUT, jump: true }, DT, prm, flat);
      if (p.justJumped) jumps++;
    }
    expect(jumps).toBe(1);
  });

  it("撞墙会停住，不会穿墙", () => {
    const wall = (tx: number, ty: number) => ty >= 10 || tx >= 8;
    const p = createPlayer(40, FLOOR_Y - 7);
    run(p, { ...NO_INPUT, right: true }, 120, wall);
    expect(p.x + p.w).toBe(8 * TILE);
    expect(p.vx).toBe(0);
  });

  it("头顶擦到砖块边角时会被推开，而不是直接撞停", () => {
    // 头顶正上方 2 格处有一块砖，角色只有 1 像素和它重叠
    const solid = (tx: number, ty: number) => ty >= 10 || (ty === 7 && tx === 4);
    const p = createPlayer(4 * TILE - PLAYER_OVERLAP(), FLOOR_Y - 7);
    stepPlayer(p, NO_INPUT, DT, prm, solid);
    let maxRise = 0;
    const y0 = p.y;
    for (let i = 0; i < 40; i++) {
      stepPlayer(p, { ...NO_INPUT, jump: true }, DT, prm, solid);
      maxRise = Math.max(maxRise, y0 - p.y);
    }
    expect(maxRise).toBeGreaterThan(3 * TILE);
  });
});

function PLAYER_OVERLAP() {
  // 让角色右边缘伸进砖块 1 像素
  return 6 - 1;
}
