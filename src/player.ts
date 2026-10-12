// 角色控制器：纯逻辑，不依赖 Phaser，所以可以直接写单元测试。
import type { PlayerParams } from "./params";
import { type Box, type SolidFn, isGrounded, moveX, moveY, overlapsSolid } from "./physics";

export const PLAYER_W = 6;
export const PLAYER_H = 7;

export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean; // 跳跃键当前是否按住
}

export const NO_INPUT: Input = { left: false, right: false, jump: false };

export interface PlayerState extends Box {
  vx: number;
  vy: number;
  onGround: boolean;
  coyote: number; // 剩余土狼时间
  buffer: number; // 剩余跳跃缓冲时间
  jumping: boolean; // 正处于一次主动起跳的上升阶段（用于可变跳跃高度）
  prevJump: boolean;
  facing: 1 | -1;
  // 本帧发生的事件，渲染层用来播放特效
  justJumped: boolean;
  justLanded: boolean;
  landSpeed: number;
}

export function createPlayer(x: number, y: number): PlayerState {
  return {
    x,
    y,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    onGround: false,
    coyote: 0,
    buffer: 0,
    jumping: false,
    prevJump: false,
    facing: 1,
    justJumped: false,
    justLanded: false,
    landSpeed: 0,
  };
}

function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

export function stepPlayer(p: PlayerState, input: Input, dt: number, prm: PlayerParams, solid: SolidFn): void {
  p.justJumped = false;
  p.justLanded = false;

  const jumpPressed = input.jump && !p.prevJump;
  p.prevJump = input.jump;

  // 水平
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) p.facing = dir as 1 | -1;
  const accel = p.onGround ? (dir !== 0 ? prm.groundAccel : prm.groundDecel) : dir !== 0 ? prm.airAccel : prm.airDecel;
  // 反向时用加速度+减速度，转身更利落
  const turning = dir !== 0 && Math.sign(p.vx) === -dir;
  p.vx = approach(p.vx, dir * prm.runSpeed, (turning ? accel + prm.groundDecel * 0.5 : accel) * dt);

  // 计时器
  if (p.onGround) p.coyote = prm.coyoteTime;
  else p.coyote = Math.max(0, p.coyote - dt);
  if (jumpPressed) p.buffer = prm.jumpBuffer;
  else p.buffer = Math.max(0, p.buffer - dt);

  // 起跳：缓冲中的跳跃 + 在地面或土狼时间内
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -prm.jumpVelocity;
    p.buffer = 0;
    p.coyote = 0;
    p.onGround = false;
    p.jumping = true;
    p.justJumped = true;
  }

  // 可变跳跃高度：上升途中松开跳跃键，速度立刻衰减
  if (p.jumping && !input.jump && p.vy < 0) {
    p.vy *= prm.jumpCutMult;
    p.jumping = false;
  }
  if (p.vy >= 0) p.jumping = false;

  // 重力
  let g = prm.gravity;
  if (!p.onGround && input.jump && Math.abs(p.vy) < prm.apexThreshold) g *= prm.apexGravityMult;
  else if (p.vy > 0) g *= prm.fallGravityMult;
  p.vy = Math.min(p.vy + g * dt, prm.maxFallSpeed);

  // 移动 + 碰撞
  if (moveX(p, p.vx * dt, solid)) p.vx = 0;

  const dy = p.vy * dt;
  const before = p.y;
  if (moveY(p, dy, solid)) {
    if (dy < 0) {
      // 头顶撞到边角时，试着横向挪开几像素继续上升
      if (!tryCornerCorrection(p, before, dy, prm.cornerCorrection, solid)) {
        p.vy = 0;
        p.jumping = false;
      }
    } else {
      if (!p.onGround) {
        p.justLanded = true;
        p.landSpeed = p.vy;
      }
      p.vy = 0;
    }
  }

  p.onGround = p.vy >= 0 && isGrounded(p, solid);
}

function tryCornerCorrection(p: PlayerState, y0: number, dy: number, max: number, solid: SolidFn): boolean {
  for (let i = 1; i <= max; i++) {
    for (const s of [-1, 1]) {
      const nx = p.x + s * i;
      if (!overlapsSolid(nx, y0, p.w, p.h, solid) && !overlapsSolid(nx, y0 + dy, p.w, p.h, solid)) {
        p.x = nx;
        p.y = y0 + dy;
        return true;
      }
    }
  }
  return false;
}
