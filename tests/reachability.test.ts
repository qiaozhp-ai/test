// 用真实的角色控制器在地图上做搜索，验证用默认手感参数能拿到所有蛋、走遍所有房间。
// 改了关卡或者手感参数以后，这个测试能告诉你关卡是不是被改坏了。
import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "../src/params";
import { TILE } from "../src/physics";
import { type Input, type PlayerState, createPlayer, stepPlayer } from "../src/player";
import { ROOM_PX_H, ROOM_PX_W, buildWorld } from "../src/world";

const DT = 1 / 60;
const world = buildWorld();
const solid = world.isSolid;

interface Plan {
  pre: number; // 起跳前助跑帧数
  preDir: number;
  jump: number; // 按住跳跃的帧数（0 = 不跳，直接走）
  airDir: number;
}

const PLANS: Plan[] = [];
for (const preDir of [-1, 1]) for (const pre of [4, 12]) PLANS.push({ pre, preDir, jump: 0, airDir: preDir });
for (const pre of [0, 8])
  for (const preDir of pre ? [-1, 1] : [0])
    for (const jump of [6, 14, 60])
      for (const airDir of [-1, 0, 1]) PLANS.push({ pre, preDir, jump, airDir });

function input(dir: number, jump: boolean): Input {
  return { left: dir < 0, right: dir > 0, jump };
}

function simulate(sx: number, sy: number, plan: Plan, touch: (p: PlayerState) => void) {
  const p = createPlayer(sx, sy);
  p.onGround = true;
  let f = 0;
  for (; f < plan.pre; f++) {
    stepPlayer(p, input(plan.preDir, false), DT, DEFAULT_PARAMS, solid);
    touch(p);
  }
  let left = false;
  for (let i = 0; i < 240; i++, f++) {
    const jumping = i < plan.jump;
    // 落地后松开方向键停下；走路方案走几帧就松手（走到边缘会掉下去）
    const landed = left && p.onGround;
    const dir = landed || (plan.jump === 0 && !left && i > 6) ? 0 : plan.airDir;
    stepPlayer(p, input(dir, jumping), DT, DEFAULT_PARAMS, solid);
    touch(p);
    if (!p.onGround) left = true;
    if (p.onGround && Math.abs(p.vx) < 1 && (left || i > 20)) break;
  }
  return p.onGround ? p : null;
}

describe("关卡可达性", () => {
  it("从出生点出发，能拿到所有蛋、走遍所有房间", () => {
    const spawn = world.entities.find((e) => e.kind === "spawn")!;
    const eggs = world.entities.filter((e) => e.kind === "egg");
    const gotEggs = new Set<string>();
    const rooms = new Set<string>();

    const touch = (p: PlayerState) => {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      rooms.add(world.roomName(Math.floor(cx / ROOM_PX_W), Math.floor(cy / ROOM_PX_H)) ?? "?");
      for (const e of eggs) {
        if (p.x < e.x + TILE && p.x + p.w > e.x && p.y < e.y + TILE && p.y + p.h > e.y) gotEggs.add(e.id);
      }
    };

    const start = createPlayer(spawn.x + 1, spawn.y + TILE - 7);
    for (let i = 0; i < 30; i++) stepPlayer(start, input(0, false), DT, DEFAULT_PARAMS, solid);
    const key = (x: number, y: number) => `${Math.round(x / 2)},${Math.round(y)}`;
    const seen = new Set([key(start.x, start.y)]);
    const queue: [number, number][] = [[start.x, start.y]];

    while (queue.length) {
      const [x, y] = queue.shift()!;
      for (const plan of PLANS) {
        const end = simulate(x, y, plan, touch);
        if (!end) continue;
        const k = key(end.x, end.y);
        if (!seen.has(k)) {
          seen.add(k);
          queue.push([end.x, end.y]);
        }
      }
    }

    if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.REACH_DEBUG) {
      // 打印每个房间里能站到的位置（瓦片坐标），方便排查哪里上不去
      const byRoom = new Map<string, Set<string>>();
      for (const k of seen) {
        const [hx, y] = k.split(",").map(Number);
        const tx = Math.floor((hx * 2 + 3) / TILE);
        const ty = Math.round((y + 7) / TILE) - 1;
        const r = world.roomName(Math.floor(tx / 40), Math.floor(ty / 22)) ?? "?";
        if (!byRoom.has(r)) byRoom.set(r, new Set());
        byRoom.get(r)!.add(`(${tx % 40},${ty % 22})`);
      }
      for (const [r, s] of byRoom) console.log(r, [...s].join(" "));
    }
    expect([...rooms].sort()).toEqual(["A", "B", "C", "D"]);
    expect([...gotEggs].sort()).toEqual(eggs.map((e) => e.id).sort());
  });
});
