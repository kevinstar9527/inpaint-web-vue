import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
    reporters: ['verbose'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*'],
      exclude: [],
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/hf-mirror': {
        target: 'https://hf-mirror.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hf-mirror/, ''),
      },
      '/modelscope': {
        target: 'https://www.modelscope.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/modelscope/, ''),
      },
      '/modelscope-cn': {
        target: 'https://modelscope.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/modelscope-cn/, ''),
      },
      '/huggingface': {
        target: 'https://huggingface.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/huggingface/, ''),
      },
      '/hf-cdn': {
        target: 'https://hf-cdn.sufy.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hf-cdn/, ''),
      },
    },
  },
})
