// 在真实浏览器里跑游戏：模拟按键、读取角色状态、截图。
// 用法：npm run build && npm run e2e        截图保存在 screenshots/
import { createServer } from "node:http";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { createRequire } from "node:module";

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // 云端环境里 playwright 是全局装的
    const require = createRequire("/opt/node-tools/node_modules/");
    return require("playwright");
  }
}

const DIST = new URL("../dist/", import.meta.url).pathname;
const OUT = new URL("../screenshots/", import.meta.url).pathname;
if (!existsSync(join(DIST, "index.html"))) {
  console.error("先运行 npm run build");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer((req, res) => {
  const path = join(DIST, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  try {
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(readFileSync(path));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(url);
await page.waitForFunction(() => window.__fw?.scene()?.player);
await page.waitForTimeout(500);

const state = () => page.evaluate(() => window.__fw.state());
const shot = async (name) => {
  await page.locator("canvas").screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`截图 ${name}.png`, JSON.stringify(await state()));
};
const hold = async (keys, ms) => {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
};
const teleport = (tx, ty) =>
  page.evaluate(([x, y]) => window.__fw.scene().teleport(x * 8 + 1, y * 8 + 1), [tx, ty]);

let failed = false;
const check = (ok, msg) => {
  console.log(`${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) failed = true;
};

// 1. 出生点
await shot("01-spawn");
const s0 = await state();
check(s0.onGround, "出生后站在地面上");

// 2. 往右走
await hold(["ArrowRight"], 600);
const s1 = await state();
check(s1.x > s0.x + 20, `按右键会向右移动（${s0.x.toFixed(0)} → ${s1.x.toFixed(0)}）`);

// 3. 跳起来，在空中截图
await page.keyboard.down("z");
await page.waitForTimeout(250);
const s2 = await state();
await shot("02-jump");
await page.keyboard.up("z");
check(!s2.onGround && s2.y < s1.y - 10, "按 Z 会跳起来");
await page.waitForTimeout(800);

// 4. 一路往右（中间有个台阶，边走边跳），走进房间 B
await page.keyboard.down("ArrowRight");
for (let i = 0; i < 8; i++) {
  await hold(["z"], 220);
  await page.waitForTimeout(250);
}
await page.keyboard.up("ArrowRight");
const s3 = await state();
check(s3.room.rx === 1 && s3.room.ry === 1, `往右走进入房间 B（当前 ${JSON.stringify(s3.room)}）`);
await shot("03-room-b");

// 5. 各个房间的样子（直接传送过去截图）
await teleport(40 + 30, 22 + 17);
await page.waitForTimeout(400);
await teleport(40 + 30, 10);
await page.waitForTimeout(500);
await shot("04-room-d");
await teleport(20, 18);
await page.waitForTimeout(500);
await shot("05-room-c");

check(errors.length === 0, `没有页面报错${errors.length ? "：" + errors.join(" | ") : ""}`);

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
