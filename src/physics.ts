// 瓦片碰撞：角色是一个不旋转的矩形，和 8x8 的瓦片网格做轴对齐碰撞。
// 先移动 X 再移动 Y，每一轴单独处理，每帧位移都小于一个瓦片。

export const TILE = 8;
const EPS = 1e-6;

export type SolidFn = (tx: number, ty: number) => boolean;

export interface Box {
  x: number; // 左上角
  y: number;
  w: number;
  h: number;
}

export function overlapsSolid(x: number, y: number, w: number, h: number, solid: SolidFn): boolean {
  const x0 = Math.floor(x / TILE);
  const x1 = Math.floor((x + w - EPS) / TILE);
  const y0 = Math.floor(y / TILE);
  const y1 = Math.floor((y + h - EPS) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (solid(tx, ty)) return true;
    }
  }
  return false;
}

/** 水平移动，撞墙时贴住墙面。返回是否撞到。 */
export function moveX(b: Box, dx: number, solid: SolidFn): boolean {
  if (dx === 0) return false;
  const nx = b.x + dx;
  if (!overlapsSolid(nx, b.y, b.w, b.h, solid)) {
    b.x = nx;
    return false;
  }
  if (dx > 0) {
    const tx = Math.floor((nx + b.w - EPS) / TILE);
    b.x = tx * TILE - b.w;
  } else {
    const tx = Math.floor(nx / TILE);
    b.x = (tx + 1) * TILE;
  }
  return true;
}

/** 竖直移动，撞到地面或天花板时贴住。返回是否撞到。 */
export function moveY(b: Box, dy: number, solid: SolidFn): boolean {
  if (dy === 0) return false;
  const ny = b.y + dy;
  if (!overlapsSolid(b.x, ny, b.w, b.h, solid)) {
    b.y = ny;
    return false;
  }
  if (dy > 0) {
    const ty = Math.floor((ny + b.h - EPS) / TILE);
    b.y = ty * TILE - b.h;
  } else {
    const ty = Math.floor(ny / TILE);
    b.y = (ty + 1) * TILE;
  }
  return true;
}

/** 脚下一像素是否有实心瓦片 */
export function isGrounded(b: Box, solid: SolidFn): boolean {
  return overlapsSolid(b.x, b.y + b.h, b.w, 1, solid);
}
