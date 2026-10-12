# 萤井

一个类似《动物井》的 2D 像素探索游戏原型。你是一只会发光的小东西，在黑暗的洞穴里找蛋。

技术栈：TypeScript + [Phaser 3](https://phaser.io)（渲染、光照、输入）+ 自己写的瓦片碰撞 + Vite。

## 玩法

| 操作 | 键盘 | 手柄 | 手机 |
|---|---|---|---|
| 移动 | ← → 或 A D | 左摇杆 / 十字键 | ◀ ▶ 按钮 |
| 跳跃（按住跳更高） | Z、空格、↑、W、K | A 键 | 「跳」按钮 |
| 调参面板 | ` | | 页面上的「调参」按钮 |

目前有 4 个房间、3 颗蛋，收集进度会存在浏览器里。

## 本地运行

需要 [Node.js](https://nodejs.org)（LTS 版）。

```bash
npm install
npm run dev        # 打开 http://localhost:5173 ，改代码会自动刷新
```

## 调手感

按 ` 打开调参面板，拖滑块实时生效，调好以后点「复制参数」把结果发给 Claude，或者直接改 `src/params.ts` 里的默认值。面板里的改动会记在你的浏览器里，点「恢复默认」可以还原。

## 改关卡

地图就是 `src/world.ts` 里的字符画，每个房间 40×22 格：

```
#  岩石    .  空气    P  出生点    L  灯笼    *  蛋
```

直接改字符就行。改完跑一下 `npm test`，会检查房间尺寸、房间之间的通道有没有对齐，还会用真实的角色手感搜索一遍，确认所有房间和蛋都能到达。

## 测试

```bash
npm test           # 单元测试：手感（土狼时间、跳跃缓冲、跳跃高度…）、地图、可达性
npm run build
npm run e2e        # 在真实浏览器里跑：模拟按键、检查状态、截图到 screenshots/
npm run artifact   # 打包成单个 HTML，可以发布成网页
```

## 代码结构

```
src/
  params.ts      手感参数和默认值
  physics.ts     瓦片碰撞（纯逻辑）
  player.ts      角色控制器（纯逻辑，可单测）
  world.ts       地图字符画和解析
  GameScene.ts   Phaser 场景：瓦片、光照、粒子、房间切换、收集
  textures.ts    用代码画的像素贴图（以后换成真美术）
  input.ts       键盘 / 手柄 / 触屏合并
  debug.ts       调参面板
  main.ts        页面和游戏启动
tests/           单元测试
scripts/         浏览器测试、打包
```
