// 本地存档。浏览器可能禁用存储（隐私模式等），所以每次读写都包在 try/catch 里，失败了游戏照常运行。

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存不了就算了
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // 同上
  }
}

export const SAVE_KEY = "firefly-well/save";
export const PARAMS_KEY = "firefly-well/params";

export interface SaveData {
  eggs: string[];
}
