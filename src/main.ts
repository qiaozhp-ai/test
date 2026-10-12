import Phaser from "phaser";
import { GameScene, type Snapshot } from "./GameScene";
import { createDebugPanel } from "./debug";
import { touchState } from "./input";
import { DEFAULT_PARAMS } from "./params";
import { PARAMS_KEY, load } from "./storage";
import { ROOM_PX_H, ROOM_PX_W } from "./world";
import "./style.css";

declare global {
  interface Window {
    claude?: {
      hot?: {
        snapshot(fn: () => unknown): void;
        ready?(start: (data: unknown) => void): void;
        data?: unknown;
      };
    };
    __fw?: unknown;
  }
}

function buildPage() {
  const font = document.createElement("link");
  font.rel = "stylesheet";
  font.href = "https://fonts.googleapis.com/css2?family=Silkscreen&display=swap";
  document.head.appendChild(font);

  // 追加而不是替换 body：Artifact 页面的 <style> 和 <script> 也在 body 里
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <main class="shell">
      <div class="stage" id="stage">
        <div class="toast" id="toast" hidden></div>
      </div>
      <div class="bar">
        <div class="title"><span class="name">萤井</span><span class="eggs" id="eggs">蛋 0 / 3</span></div>
        <div class="keys">
          <span><kbd>←</kbd><kbd>→</kbd> 移动</span>
          <span><kbd>Z</kbd><kbd>空格</kbd> 跳跃（按住跳更高）</span>
          <button type="button" id="tune">调参 <kbd>\`</kbd></button>
        </div>
      </div>
      <div class="touch" id="touch">
        <div class="pad">
          <button type="button" data-key="left" aria-label="向左">◀</button>
          <button type="button" data-key="right" aria-label="向右">▶</button>
        </div>
        <button type="button" class="jump" data-key="jump" aria-label="跳跃">跳</button>
      </div>
    </main>`,
  );
}

function fitCanvas(game: Phaser.Game) {
  // 能整数倍放大就整数倍，像素不会糊；窗口太小才用小数倍
  const stage = document.getElementById("stage")!;
  const resize = () => {
    const availW = stage.clientWidth;
    const availH = stage.clientHeight;
    const fit = Math.min(availW / ROOM_PX_W, availH / ROOM_PX_H);
    const zoom = fit >= 1 ? Math.floor(fit) : fit;
    const c = game.canvas;
    c.style.width = `${Math.floor(ROOM_PX_W * zoom)}px`;
    c.style.height = `${Math.floor(ROOM_PX_H * zoom)}px`;
    game.scale.updateBounds();
  };
  new ResizeObserver(resize).observe(stage);
  resize();
}

function bindTouch() {
  const root = document.getElementById("touch")!;
  root.querySelectorAll<HTMLButtonElement>("button[data-key]").forEach((btn) => {
    const key = btn.dataset.key as keyof typeof touchState;
    const set = (v: boolean) => (e: Event) => {
      e.preventDefault();
      touchState[key] = v;
      btn.classList.toggle("down", v);
    };
    btn.addEventListener("pointerdown", set(true));
    btn.addEventListener("pointerup", set(false));
    btn.addEventListener("pointercancel", set(false));
    btn.addEventListener("pointerleave", set(false));
  });
}

let toastTimer = 0;
function toast(msg: string) {
  const el = document.getElementById("toast")!;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), 2600);
}

function start(data: unknown) {
  buildPage();
  const params = { ...DEFAULT_PARAMS, ...load(PARAMS_KEY, {}) };
  const snapshot = (data as { player?: Snapshot } | undefined)?.player;

  let lastEggs = -1;
  const scene = new GameScene(
    params,
    {
      onEggs(count, total) {
        document.getElementById("eggs")!.textContent = `蛋 ${count} / ${total}`;
        if (lastEggs >= 0 && count > lastEggs) toast(count === total ? "三颗蛋都找到了" : `找到一颗蛋（${count}/${total}）`);
        lastEggs = count;
      },
    },
    snapshot,
  );

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: "stage",
    width: ROOM_PX_W,
    height: ROOM_PX_H,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: "#05070c",
    scale: { mode: Phaser.Scale.NONE },
    input: { gamepad: true },
    render: { maxLights: 16 },
    banner: false,
    scene,
  });

  game.events.once(Phaser.Core.Events.READY, () => fitCanvas(game));
  bindTouch();

  const panel = createDebugPanel(params, () => scene, toast);
  document.getElementById("tune")!.addEventListener("click", () => panel.toggle());

  // 给自动化测试用的接口
  window.__fw = {
    scene: () => scene,
    state: () => {
      const p = scene.player;
      return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, onGround: p.onGround, room: scene.room };
    },
    params,
  };

  // Artifact 页面更新时保留角色位置
  window.claude?.hot?.snapshot(() => ({ player: scene.player ? scene.getSnapshot() : undefined }));
}

const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
