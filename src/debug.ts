// 调参面板：按 ` 键或点页面上的「调参」按钮打开。
import GUI from "lil-gui";
import type { GameScene } from "./GameScene";
import { DEFAULT_PARAMS, type PlayerParams } from "./params";
import { PARAMS_KEY, SAVE_KEY, remove, save } from "./storage";

// [最小值, 最大值, 步长, 中文说明]
const RANGES: Record<keyof PlayerParams, [number, number, number, string]> = {
  runSpeed: [20, 200, 1, "最大速度"],
  groundAccel: [100, 4000, 10, "地面加速"],
  groundDecel: [100, 5000, 10, "地面减速"],
  airAccel: [50, 3000, 10, "空中加速"],
  airDecel: [0, 3000, 10, "空中减速"],
  gravity: [100, 2000, 10, "重力"],
  fallGravityMult: [0.5, 4, 0.05, "下落重力倍数"],
  jumpVelocity: [50, 500, 1, "起跳速度"],
  jumpCutMult: [0, 1, 0.01, "松键减速"],
  apexThreshold: [0, 100, 1, "顶点范围"],
  apexGravityMult: [0.1, 1, 0.05, "顶点重力倍数"],
  maxFallSpeed: [50, 600, 5, "最大下落速度"],
  coyoteTime: [0, 0.3, 0.01, "土狼时间(秒)"],
  jumpBuffer: [0, 0.3, 0.01, "跳跃缓冲(秒)"],
  cornerCorrection: [0, 6, 1, "撞角修正(像素)"],
};

export function createDebugPanel(params: PlayerParams, getScene: () => GameScene | undefined, notify: (msg: string) => void) {
  const gui = new GUI({ title: "调参" });
  gui.hide();

  const persist = () => save(PARAMS_KEY, params);
  const feel = gui.addFolder("手感参数（实时生效）");
  for (const key of Object.keys(RANGES) as (keyof PlayerParams)[]) {
    const [min, max, step, label] = RANGES[key];
    feel.add(params, key, min, max, step).name(label).onChange(persist).listen();
  }

  const actions = {
    copy: async () => {
      const text = JSON.stringify(params, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        notify("参数已复制，粘贴给 Claude 就行");
      } catch {
        console.log(text);
        notify("浏览器不让复制，参数已打印到控制台");
      }
    },
    reset: () => {
      Object.assign(params, DEFAULT_PARAMS);
      remove(PARAMS_KEY);
      notify("已恢复默认手感");
    },
    respawn: () => getScene()?.respawn(),
    clearSave: () => {
      remove(SAVE_KEY);
      location.reload();
    },
  };
  gui.add(actions, "copy").name("复制参数");
  gui.add(actions, "reset").name("恢复默认");

  const view = { hitbox: false };
  const tools = gui.addFolder("调试");
  tools
    .add(view, "hitbox")
    .name("显示碰撞框")
    .onChange((v: boolean) => {
      const s = getScene();
      if (s) s.showHitbox = v;
    });
  tools.add(actions, "respawn").name("回到出生点");
  tools.add(actions, "clearSave").name("清除存档并重开");

  const live = { state: "" };
  tools.add(live, "state").name("状态").listen().disable();
  setInterval(() => {
    const p = getScene()?.player;
    if (p) live.state = `vx ${p.vx.toFixed(0)} vy ${p.vy.toFixed(0)} ${p.onGround ? "着地" : "空中"}`;
  }, 100);

  const toggle = () => (gui._hidden ? gui.show() : gui.hide());
  window.addEventListener("keydown", (e) => {
    if (e.key === "`" || e.key === "·") toggle();
  });
  return { toggle };
}
