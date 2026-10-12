// 手感参数。单位：像素、秒。调试面板（按 ` 键）里可以实时修改。
export interface PlayerParams {
  runSpeed: number; // 最大水平速度
  groundAccel: number; // 地面加速度
  groundDecel: number; // 地面松手后的减速度
  airAccel: number; // 空中加速度
  airDecel: number; // 空中松手后的减速度
  gravity: number; // 上升时的重力
  fallGravityMult: number; // 下落时重力倍数（>1 下落更快，跳跃更"脆"）
  jumpVelocity: number; // 起跳初速度
  jumpCutMult: number; // 上升途中松开跳跃键时，速度乘以这个值（可变跳跃高度）
  apexThreshold: number; // |vy| 小于这个值算"顶点附近"
  apexGravityMult: number; // 按住跳跃键时，顶点附近的重力倍数（滞空感）
  maxFallSpeed: number; // 最大下落速度
  coyoteTime: number; // 离开平台后还能起跳的时间
  jumpBuffer: number; // 落地前提前按跳跃，落地时仍会触发的时间窗口
  cornerCorrection: number; // 头顶撞到砖块边角时，最多自动横向挪开的像素
}

export const DEFAULT_PARAMS: PlayerParams = {
  runSpeed: 78,
  groundAccel: 900,
  groundDecel: 1400,
  airAccel: 650,
  airDecel: 450,
  gravity: 620,
  fallGravityMult: 1.45,
  jumpVelocity: 214,
  jumpCutMult: 0.42,
  apexThreshold: 28,
  apexGravityMult: 0.55,
  maxFallSpeed: 230,
  coyoteTime: 0.09,
  jumpBuffer: 0.11,
  cornerCorrection: 3,
};
