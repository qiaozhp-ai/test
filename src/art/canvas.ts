// 程序化像素画的公共工具
export type RGB = [number, number, number];

export function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const set = (x: number, y: number, rgb: RGB, a = 255) => {
    const i = (y * w + x) * 4;
    img.data[i] = rgb[0];
    img.data[i + 1] = rgb[1];
    img.data[i + 2] = rgb[2];
    img.data[i + 3] = a;
  };
  const done = () => {
    ctx.putImageData(img, 0, 0);
    return c;
  };
  return { set, done };
}

/** 用字符画画一个精灵帧 */
export function drawPattern(set: (x: number, y: number, rgb: RGB) => void, ox: number, rows: string[], pal: Record<string, string>) {
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (pal[ch]) set(ox + x, y, hex(pal[ch]));
    }),
  );
}

/** 平滑的贴图（光晕、雾）用线性过滤，否则放大后会是一格一格的 */
export function smooth(tex: { setFilter(mode: number): unknown }) {
  tex.setFilter(1); // Phaser.Textures.FilterMode.LINEAR
}
