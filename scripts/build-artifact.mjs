// 把 vite 构建结果打成一个单独的 HTML 片段，用来发布成 claude.ai 的 Artifact 页面。
// 用法：npm run artifact   输出 artifact/firefly-well.html
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/assets/", import.meta.url).pathname;
const out = new URL("../artifact/", import.meta.url).pathname;
const files = readdirSync(dist);
const js = files.filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dist, f), "utf8"));
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(dist, f), "utf8"));
if (js.length !== 1) throw new Error(`应该只有一个 JS 文件，实际有 ${js.length} 个`);

// 内联脚本里不能出现 </script，否则 HTML 会提前截断
const script = js[0].replace(/<\/script/gi, "<\\/script");

const html = `<title>萤井</title>
<style>
${css.join("\n")}
</style>
<script type="module">
${script}
</script>
`;

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "firefly-well.html"), html);
console.log(`artifact/firefly-well.html  ${(html.length / 1024).toFixed(0)} KB`);
