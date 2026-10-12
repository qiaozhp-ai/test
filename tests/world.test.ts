import { describe, expect, it } from "vitest";
import { LAYOUT, ROOMS, ROOM_H, ROOM_W, buildWorld } from "../src/world";

const open = (ch: string) => ch !== "#";

describe("世界地图", () => {
  it("每个房间都是 40x22", () => {
    for (const [name, rows] of Object.entries(ROOMS)) {
      expect(rows.length, name).toBe(ROOM_H);
      rows.forEach((r, i) => expect(r.length, `${name} 第 ${i} 行`).toBe(ROOM_W));
      expect([...rows.join("")].every((c) => "#.PL*".includes(c)), name).toBe(true);
    }
  });

  it("相邻房间之间有对齐的通道（至少 2 格宽，角色能通过）", () => {
    // 边界上允许有单边的凸起（比如伸进竖井的平台），但必须有一段两边都是空的通道
    const longestRun = (flags: boolean[]) => {
      let best = 0;
      let cur = 0;
      for (const f of flags) best = Math.max(best, (cur = f ? cur + 1 : 0));
      return best;
    };
    let links = 0;
    LAYOUT.forEach((line, ry) =>
      line.forEach((name, rx) => {
        const a = ROOMS[name];
        const right = LAYOUT[ry][rx + 1];
        if (right) {
          const b = ROOMS[right];
          const shared = a.map((row, y) => open(row[ROOM_W - 1]) && open(b[y][0]));
          expect(longestRun(shared), `${name}→${right}`).toBeGreaterThanOrEqual(2);
          links++;
        }
        const below = LAYOUT[ry + 1]?.[rx];
        if (below) {
          const b = ROOMS[below];
          const shared = [...a[ROOM_H - 1]].map((ch, x) => open(ch) && open(b[0][x]));
          expect(longestRun(shared), `${name}↓${below}`).toBeGreaterThanOrEqual(2);
          links++;
        }
      }),
    );
    expect(links).toBe(4);
  });

  it("世界边缘是封闭的", () => {
    const w = buildWorld();
    for (let x = 0; x < w.cols; x++) {
      expect(w.solid[x], `顶边 ${x}`).toBe(1);
      expect(w.solid[(w.rows - 1) * w.cols + x], `底边 ${x}`).toBe(1);
    }
    for (let y = 0; y < w.rows; y++) {
      expect(w.solid[y * w.cols], `左边 ${y}`).toBe(1);
      expect(w.solid[y * w.cols + w.cols - 1], `右边 ${y}`).toBe(1);
    }
  });

  it("只有一个出生点，有 3 个蛋", () => {
    const w = buildWorld();
    expect(w.entities.filter((e) => e.kind === "spawn")).toHaveLength(1);
    expect(w.entities.filter((e) => e.kind === "egg")).toHaveLength(3);
  });
});
