// 画面截图：在每个房间的固定位置截一张全分辨率图，外加一张局部放大图，用来检查画面效果。
// 用法：npm run build && npm run shots [输出目录]     默认输出到 screenshots/
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    return createRequire("/opt/node-tools/node_modules/")("playwright");
  }
}

const DIST = new URL("../dist/", import.meta.url).pathname;
const OUT = resolve(process.argv[2] ?? new URL("../screenshots/", import.meta.url).pathname);
if (!existsSync(join(DIST, "index.html"))) {
  console.error("先运行 npm run build");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer((req, res) => {
  const pathname = req.url.split("?")[0];
  const path = join(DIST, pathname === "/" ? "index.html" : pathname);
  let body;
  try {
    body = readFileSync(path);
  } catch {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
  res.end(body);
}).listen(0);

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// 清掉存档，保证每次截图里蛋都在
await page.addInitScript(() => {
  try {
    localStorage.clear();
  } catch {}
});
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => window.__fw?.scene()?.player);
await page.waitForTimeout(2500);

// [文件名, 瓦片 x, 瓦片 y]（世界坐标，房间 40x22）
const SPOTS = [
  ["room-a", 6, 22 + 19],
  ["room-b", 40 + 22, 22 + 6],
  ["room-c", 15, 12],
  ["room-d", 40 + 30, 12],
];

for (const [name, tx, ty] of SPOTS) {
  await page.evaluate(([x, y]) => window.__fw.scene().teleport(x * 8 + 1, y * 8 + 1), [tx, ty]);
  // 等角色落地、镜头切过去、粒子铺开
  await page.waitForTimeout(2500);
  const canvas = page.locator("canvas");
  await canvas.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`${name}.png`);
}

// 局部放大：房间 A 出生点附近，原始分辨率的 1/4 区域，看像素细节
await page.evaluate(() => window.__fw.scene().teleport(6 * 8 + 1, (22 + 19) * 8 + 1));
await page.waitForTimeout(2500);
const box = await page.locator("canvas").boundingBox();
await page.screenshot({
  path: join(OUT, "detail-a.png"),
  clip: { x: box.x, y: box.y + box.height / 2, width: box.width / 2, height: box.height / 2 },
});
console.log("detail-a.png");

console.log(errors.length ? `页面报错：${errors.join(" | ")}` : "没有页面报错");
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
