import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    // 1. 设置输出目录为插件根目录下的 media
    outDir: resolve(__dirname, '../media'),
    // 2. 每次构建清空目录
    emptyOutDir: true,
    // 3. 取消文件名的 hash (方便插件后端固定引用)
    rollupOptions: {
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`,
      },
    },
  },
});