import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    // 单文件输出，方便打包成 Artifact 页面
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
    chunkSizeWarningLimit: 4000,
  },
});
